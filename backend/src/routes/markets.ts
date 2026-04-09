import { Router, Request, Response } from 'express';
import { MarketModel } from '../models/Market';
import { TradeModel } from '../models/Trade';

export function createMarketsRouter(): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const markets = await MarketModel.find({
        status: { $in: ['ACTIVE', 'TRADING_ENDED', 'RESOLVED'] },
      })
        .sort({ endTime: -1 })
        .lean();

      const result = markets.map((m) => ({
        address: m.address,
        pairId: m.pairId,
        startTime: m.startTime,
        endTime: m.endTime,
        duration: m.duration,
        status: m.status,
        winner: m.winner,
        upPrice: m.upPrice,
        downPrice: m.downPrice,
        volume: m.volume,
      }));

      res.json(result);
    } catch (err) {
      console.error('[Markets] GET error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/:address', async (req: Request, res: Response) => {
    try {
      const market = await MarketModel.findOne({
        address: (req.params.address as string).toLowerCase(),
      }).lean();

      if (!market) {
        res.status(404).json({ error: 'Market not found' });
        return;
      }

      // Calculate volume from trades
      const trades = await TradeModel.find({ market: market.address });
      let volume = 0n;
      for (const t of trades) {
        volume += BigInt(t.amount);
      }

      res.json({
        ...market,
        volume: volume.toString(),
      });
    } catch (err) {
      console.error('[Markets] GET /:address error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
