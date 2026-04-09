import { ethers } from 'ethers';
import { config } from '../config';
import { creditBalance, getOrCreateBalance } from '../models/Balance';
import { ProcessedDepositTxModel } from '../models/ProcessedDepositTx';
import type { WsServer } from '../ws/WebSocketServer';
import ERC20Abi from '../abis/ERC20.json';

const USDT_LOWER = config.usdtAddress.toLowerCase();

/**
 * Monitors USDT Transfer events to the relayer address.
 * On confirmed deposit, credits the sender's balance in MongoDB.
 */
export class DepositService {
  private provider: ethers.JsonRpcProvider;
  private usdtContract: ethers.Contract;
  private relayerAddress: string;
  private ws: WsServer | null;
  private running = false;

  constructor(provider: ethers.JsonRpcProvider, relayerAddress: string, ws: WsServer | null = null) {
    this.provider = provider;
    this.relayerAddress = relayerAddress.toLowerCase();
    this.ws = ws;
    this.usdtContract = new ethers.Contract(config.usdtAddress, ERC20Abi, provider);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const filter = this.usdtContract.filters.Transfer(null, this.relayerAddress);

    this.usdtContract.on(filter, async (from: string, _to: string, value: bigint, event: ethers.EventLog) => {
      try {
        const logAddr = (event as { address?: string }).address?.toLowerCase();
        if (logAddr !== USDT_LOWER) {
          return;
        }

        const receipt = await this.provider.waitForTransaction(
          event.transactionHash,
          config.depositConfirmations
        );
        if (!receipt || receipt.status !== 1) return;

        const txHash = event.transactionHash.toLowerCase();
        const existing = await ProcessedDepositTxModel.findOne({ txHash }).lean();
        if (existing) return;

        await creditBalance(from, value, 'totalDeposited');

        try {
          await ProcessedDepositTxModel.create({ txHash });
        } catch (e: unknown) {
          const code = (e as { code?: number })?.code;
          if (code === 11000) return;
          console.error('[Deposit] Credited balance but failed to record tx; manual reconciliation may be needed', {
            txHash,
            err: e,
          });
          throw e;
        }

        const wallet = from.toLowerCase();
        const bal = await getOrCreateBalance(wallet);
        this.ws?.broadcastBalanceUpdate(wallet, {
          available: bal.available,
          inOrders: bal.inOrders,
          totalDeposited: bal.totalDeposited,
          totalWithdrawn: bal.totalWithdrawn,
          withdrawNonce: bal.withdrawNonce,
        });

        console.log(
          `[Deposit] Credited ${value.toString()} USDT to ${from} (tx: ${event.transactionHash})`
        );
      } catch (err) {
        console.error('[Deposit] Error processing deposit:', err);
      }
    });

    console.log(`[Deposit] Listening for USDT transfers to ${this.relayerAddress}`);
  }

  stop(): void {
    this.running = false;
    this.usdtContract.removeAllListeners();
  }
}
