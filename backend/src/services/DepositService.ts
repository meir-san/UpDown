import { ethers } from 'ethers';
import { config } from '../config';
import { creditBalance } from '../models/Balance';
import { ProcessedDepositTxModel } from '../models/ProcessedDepositTx';
import ERC20Abi from '../abis/ERC20.json';

/**
 * Monitors USDT Transfer events to the relayer address.
 * On confirmed deposit, credits the sender's balance in MongoDB.
 */
export class DepositService {
  private provider: ethers.JsonRpcProvider;
  private usdtContract: ethers.Contract;
  private relayerAddress: string;
  private running = false;

  constructor(provider: ethers.JsonRpcProvider, relayerAddress: string) {
    this.provider = provider;
    this.relayerAddress = relayerAddress.toLowerCase();
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
