import { ethers } from 'ethers';
import { config } from '../config';
import { creditBalance, getOrCreateBalance } from '../models/Balance';
import { ProcessedDepositTxModel } from '../models/ProcessedDepositTx';
import type { WsServer } from '../ws/WebSocketServer';
import ERC20Abi from '../abis/ERC20.json';

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
        const receipt = await this.provider.waitForTransaction(
          event.transactionHash,
          config.depositConfirmations
        );
        if (!receipt || receipt.status !== 1) return;

        const txHash = event.transactionHash.toLowerCase();
        try {
          await ProcessedDepositTxModel.create({ txHash });
        } catch (e: any) {
          if (e.code === 11000) {
            return;
          }
          throw e;
        }

        try {
          await creditBalance(from, value, 'totalDeposited');
        } catch (creditErr) {
          await ProcessedDepositTxModel.deleteOne({ txHash }).catch(() => {});
          throw creditErr;
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
