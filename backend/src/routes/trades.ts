import { Router, Request, Response } from 'express';
import { TradeModel } from '../models/Trade';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export function createTradesRouter(): Router {
  const router = Router();

  router.get('/:wallet', async (req: Request, res: Response) => {
    try {
      const wallet = (req.params.wallet as string).toLowerCase();

      let limit = DEFAULT_LIMIT;
      const rawLimit = req.query.limit;
      if (rawLimit !== undefined && rawLimit !== '') {
        const n = typeof rawLimit === 'string' ? parseInt(rawLimit, 10) : Number(rawLimit);
        if (!Number.isFinite(n) || n < 1) {
          res.status(400).json({ error: 'Invalid limit' });
          return;
        }
        limit = Math.min(n, MAX_LIMIT);
      }

      const rows = await TradeModel.find({
        $or: [{ buyer: wallet }, { seller: wallet }],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const trades = rows.map((t) => ({
        tradeId: t.tradeId,
        market: t.market,
        option: t.option,
        buyOrderId: t.buyOrderId,
        sellOrderId: t.sellOrderId,
        buyer: t.buyer,
        seller: t.seller,
        price: t.price,
        amount: t.amount,
        platformFee: t.platformFee,
        makerFee: t.makerFee,
        settlementStatus: t.settlementStatus,
        createdAt: t.createdAt,
      }));

      res.json(trades);
    } catch (err) {
      console.error('[Trades] GET error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
