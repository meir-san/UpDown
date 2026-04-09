import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { OrderBookManager } from './OrderBook';
import {
  InternalOrder,
  OrderSide,
  OrderType,
  OrderStatus,
  TradeResult,
  OrderParams,
} from './types';
import { config } from '../config';
import { OrderModel } from '../models/Order';
import { TradeModel } from '../models/Trade';
import { debitAvailable, releaseFromOrders, settleTrade } from '../models/Balance';

/**
 * Off-chain matching engine with cancel-before-taker priority.
 *
 * Runs in a batch loop: processes all pending cancels, then all new orders.
 * Emits events for WebSocket broadcasting.
 */
export class MatchingEngine extends EventEmitter {
  readonly books: OrderBookManager;

  private pendingOrders: InternalOrder[] = [];
  private pendingCancels: { orderId: string; maker: string }[] = [];
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(books: OrderBookManager) {
    super();
    this.books = books;
  }

  start(): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => {
      this.runCycle().catch((err) =>
        console.error('[MatchingEngine] cycle error:', err)
      );
    }, config.matchingIntervalMs);
    console.log(`[MatchingEngine] Started (interval=${config.matchingIntervalMs}ms)`);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async submitOrder(params: OrderParams): Promise<InternalOrder> {
    const order: InternalOrder = {
      id: uuidv4(),
      maker: params.maker.toLowerCase(),
      market: params.market.toLowerCase(),
      option: params.option,
      side: params.side,
      type: params.type,
      price: params.price,
      amount: BigInt(params.amount),
      filledAmount: 0n,
      nonce: params.nonce,
      expiry: params.expiry,
      signature: params.signature,
      status: OrderStatus.OPEN,
      createdAt: Date.now(),
    };

    const debited = await debitAvailable(order.maker, order.amount);
    if (!debited) {
      throw new Error('Insufficient balance');
    }

    await OrderModel.create({
      orderId: order.id,
      maker: order.maker,
      market: order.market,
      option: order.option,
      side: order.side,
      type: order.type,
      price: order.price,
      amount: order.amount.toString(),
      filledAmount: '0',
      nonce: order.nonce,
      expiry: order.expiry,
      signature: order.signature,
      status: order.status,
    });

    this.pendingOrders.push(order);
    return order;
  }

  submitCancel(orderId: string, maker: string): void {
    this.pendingCancels.push({ orderId, maker: maker.toLowerCase() });
  }

  private async runCycle(): Promise<void> {
    // Step 1: Process cancels (cancel priority)
    const cancels = this.pendingCancels.splice(0);
    for (const cancel of cancels) {
      await this.processCancel(cancel.orderId, cancel.maker);
    }

    await this.sweepExpiredRestingOrders();

    // Step 2: Process new taker orders
    const orders = this.pendingOrders.splice(0);
    for (const order of orders) {
      if (order.expiry > 0 && Date.now() / 1000 > order.expiry) {
        order.status = OrderStatus.CANCELLED;
        await this.updateOrderStatus(order);
        await releaseFromOrders(order.maker, order.amount);
        continue;
      }
      await this.matchOrder(order);
    }
  }

  private async sweepExpiredRestingOrders(): Promise<void> {
    const now = Date.now() / 1000;
    for (const book of this.books.allBooks()) {
      const snapshotOrders = [...book.getAllOrders()];
      for (const order of snapshotOrders) {
        if (order.expiry <= 0 || now <= order.expiry) continue;
        book.removeOrder(order.id);
        order.status = OrderStatus.CANCELLED;
        await this.updateOrderStatus(order);
        const remaining = order.amount - order.filledAmount;
        if (remaining > 0n) {
          await releaseFromOrders(order.maker, remaining);
        }
        this.emit('order_update', order);
        this.emit('orderbook_update', {
          market: order.market,
          option: order.option,
          snapshot: book.getSnapshot(),
        });
      }
    }
  }

  private async processCancel(orderId: string, maker: string): Promise<void> {
    // Try all markets and options
    for (const market of this.books.allMarkets()) {
      for (const option of [1, 2]) {
        const book = this.books.get(market, option);
        if (!book) continue;
        const removed = book.removeOrder(orderId);
        if (removed && removed.maker === maker) {
          removed.status = OrderStatus.CANCELLED;
          await this.updateOrderStatus(removed);
          const remaining = removed.amount - removed.filledAmount;
          if (remaining > 0n) {
            await releaseFromOrders(removed.maker, remaining);
          }
          this.emit('order_update', removed);
          return;
        }
      }
    }
  }

  private async matchOrder(order: InternalOrder): Promise<void> {
    const book = this.books.getOrCreate(order.market, order.option);
    const oppositeSide = order.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;

    while (this.remainingAmount(order) > 0n) {
      const bestOrders =
        oppositeSide === OrderSide.SELL
          ? book.peekBestAskOrders()
          : book.peekBestBidOrders();

      if (bestOrders.length === 0) break;

      const bestPrice =
        oppositeSide === OrderSide.SELL ? book.getBestAsk()! : book.getBestBid()!;

      if (order.type === OrderType.LIMIT) {
        if (order.side === OrderSide.BUY && bestPrice > order.price) break;
        if (order.side === OrderSide.SELL && bestPrice < order.price) break;
      }

      const takerKey = order.maker.toLowerCase();
      const resting = bestOrders.find((r) => r.maker.toLowerCase() !== takerKey);
      if (!resting) break;
      const fillAmount = this.calculateFillAmount(order, resting);
      if (fillAmount <= 0n) break;

      await this.executeFill(order, resting, bestPrice, fillAmount, book);
    }

    // If order still has remaining amount and is a limit order, add to book
    if (this.remainingAmount(order) > 0n && order.type === OrderType.LIMIT) {
      book.addOrder(order);
      this.emit('orderbook_update', {
        market: order.market,
        option: order.option,
        snapshot: book.getSnapshot(),
      });
    } else if (this.remainingAmount(order) > 0n && order.type === OrderType.MARKET) {
      // Market order with unfilled remainder: cancel the rest
      const remaining = this.remainingAmount(order);
      if (order.filledAmount > 0n) {
        order.status = OrderStatus.PARTIALLY_FILLED;
      } else {
        order.status = OrderStatus.CANCELLED;
      }
      await this.updateOrderStatus(order);
      await releaseFromOrders(order.maker, remaining);
    }

    if (order.filledAmount > 0n) {
      await this.updateOrderStatus(order);
    }
  }

  private async executeFill(
    taker: InternalOrder,
    maker: InternalOrder,
    price: number,
    fillAmount: bigint,
    book: ReturnType<OrderBookManager['getOrCreate']>
  ): Promise<void> {
    taker.filledAmount += fillAmount;
    maker.filledAmount += fillAmount;

    if (maker.filledAmount >= maker.amount) {
      maker.status = OrderStatus.FILLED;
      book.removeOrder(maker.id);
    } else {
      maker.status = OrderStatus.PARTIALLY_FILLED;
    }

    if (taker.filledAmount >= taker.amount) {
      taker.status = OrderStatus.FILLED;
    } else {
      taker.status = OrderStatus.PARTIALLY_FILLED;
    }

    const totalFeeBps = config.platformFeeBps + config.makerFeeBps;
    const platformFee = (fillAmount * BigInt(config.platformFeeBps)) / 10000n;
    const makerFee = (fillAmount * BigInt(config.makerFeeBps)) / 10000n;

    const [buyer, seller] =
      taker.side === OrderSide.BUY
        ? [taker, maker]
        : [maker, taker];

    const trade: TradeResult = {
      id: uuidv4(),
      market: taker.market,
      option: taker.option,
      buyOrderId: buyer.id,
      sellOrderId: seller.id,
      buyer: buyer.maker,
      seller: seller.maker,
      price,
      amount: fillAmount,
      platformFee,
      makerFee,
      timestamp: Date.now(),
    };

    // Settle balances: buyer's locked funds go to seller (minus fees)
    const sellerReceives = fillAmount - platformFee - makerFee;
    await settleTrade(buyer.maker, seller.maker, sellerReceives, makerFee);

    await TradeModel.create({
      tradeId: trade.id,
      market: trade.market,
      option: trade.option,
      buyOrderId: trade.buyOrderId,
      sellOrderId: trade.sellOrderId,
      buyer: trade.buyer,
      seller: trade.seller,
      price: trade.price,
      amount: trade.amount.toString(),
      platformFee: trade.platformFee.toString(),
      makerFee: trade.makerFee.toString(),
    });

    await this.updateOrderStatus(maker);
    await this.updateOrderStatus(taker);

    this.emit('trade', trade);
    this.emit('order_update', maker);
    this.emit('order_update', taker);
    this.emit('orderbook_update', {
      market: taker.market,
      option: taker.option,
      snapshot: book.getSnapshot(),
    });
  }

  private remainingAmount(order: InternalOrder): bigint {
    return order.amount - order.filledAmount;
  }

  private calculateFillAmount(taker: InternalOrder, maker: InternalOrder): bigint {
    const takerRemaining = this.remainingAmount(taker);
    const makerRemaining = this.remainingAmount(maker);
    return takerRemaining < makerRemaining ? takerRemaining : makerRemaining;
  }

  private async updateOrderStatus(order: InternalOrder): Promise<void> {
    await OrderModel.updateOne(
      { orderId: order.id },
      {
        status: order.status,
        filledAmount: order.filledAmount.toString(),
      }
    );
  }
}
