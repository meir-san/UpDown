import mongoose, { Schema, Document } from 'mongoose';

export interface IBalance extends Document {
  wallet: string;
  available: string;
  inOrders: string;
  totalDeposited: string;
  totalWithdrawn: string;
  withdrawNonce: number;
  updatedAt: Date;
}

const BalanceSchema = new Schema<IBalance>(
  {
    wallet: { type: String, required: true, unique: true, lowercase: true, index: true },
    available: { type: String, required: true, default: '0' },
    inOrders: { type: String, required: true, default: '0' },
    totalDeposited: { type: String, required: true, default: '0' },
    totalWithdrawn: { type: String, required: true, default: '0' },
    withdrawNonce: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const BalanceModel = mongoose.model<IBalance>('Balance', BalanceSchema);

export async function getOrCreateBalance(wallet: string): Promise<IBalance> {
  const normalized = wallet.toLowerCase();
  let balance = await BalanceModel.findOne({ wallet: normalized });
  if (!balance) {
    balance = await BalanceModel.create({ wallet: normalized });
  }
  return balance;
}

export async function creditBalance(wallet: string, amount: bigint, field: 'available' | 'totalDeposited' = 'available'): Promise<void> {
  const normalized = wallet.toLowerCase();
  const bal = await getOrCreateBalance(normalized);
  const current = BigInt(bal[field]);
  bal[field] = (current + amount).toString();
  if (field === 'totalDeposited') {
    const avail = BigInt(bal.available);
    bal.available = (avail + amount).toString();
  }
  await bal.save();
}

/** Atomic move from available → inOrders when balance is sufficient (MongoDB $expr + aggregation update). */
export async function debitAvailable(wallet: string, amount: bigint): Promise<boolean> {
  const normalized = wallet.toLowerCase();
  const amtStr = amount.toString();
  const doc = await BalanceModel.findOneAndUpdate(
    {
      wallet: normalized,
      $expr: {
        $gte: [{ $toDecimal: '$available' }, { $toDecimal: amtStr }],
      },
    },
    [
      {
        $set: {
          available: {
            $toString: {
              $subtract: [{ $toDecimal: '$available' }, { $toDecimal: amtStr }],
            },
          },
          inOrders: {
            $toString: {
              $add: [{ $toDecimal: '$inOrders' }, { $toDecimal: amtStr }],
            },
          },
        },
      },
    ],
    { new: true }
  );
  return doc !== null;
}

/**
 * After an on-chain USDT transfer succeeds, atomically debit available, bump withdraw nonce,
 * and increase totalWithdrawn.
 */
export async function applyWithdrawalAccounting(wallet: string, amount: bigint): Promise<boolean> {
  const normalized = wallet.toLowerCase();
  const amtStr = amount.toString();
  const doc = await BalanceModel.findOneAndUpdate(
    {
      wallet: normalized,
      $expr: {
        $gte: [{ $toDecimal: '$available' }, { $toDecimal: amtStr }],
      },
    },
    [
      {
        $set: {
          available: {
            $toString: {
              $subtract: [{ $toDecimal: '$available' }, { $toDecimal: amtStr }],
            },
          },
          totalWithdrawn: {
            $toString: {
              $add: [{ $toDecimal: '$totalWithdrawn' }, { $toDecimal: amtStr }],
            },
          },
          withdrawNonce: { $add: ['$withdrawNonce', 1] },
        },
      },
    ],
    { new: true }
  );
  return doc !== null;
}

export async function releaseFromOrders(wallet: string, amount: bigint): Promise<void> {
  const normalized = wallet.toLowerCase();
  const bal = await getOrCreateBalance(normalized);
  const inOrd = BigInt(bal.inOrders);
  bal.inOrders = (inOrd >= amount ? inOrd - amount : 0n).toString();
  bal.available = (BigInt(bal.available) + amount).toString();
  await bal.save();
}

export async function settleTrade(buyer: string, seller: string, amount: bigint, makerFee: bigint): Promise<void> {
  const buyerBal = await getOrCreateBalance(buyer.toLowerCase());
  const buyerInOrders = BigInt(buyerBal.inOrders);
  buyerBal.inOrders = (buyerInOrders >= amount ? buyerInOrders - amount : 0n).toString();
  await buyerBal.save();

  const sellerBal = await getOrCreateBalance(seller.toLowerCase());
  sellerBal.available = (BigInt(sellerBal.available) + amount + makerFee).toString();
  await sellerBal.save();
}
