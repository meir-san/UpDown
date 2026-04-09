jest.mock('../config', () => ({
  config: {
    usdtAddress: '0x0000000000000000000000000000000000000002',
    depositConfirmations: 1,
  },
}));

jest.mock('../models/Balance', () => ({
  creditBalance: jest.fn().mockResolvedValue(undefined),
  getOrCreateBalance: jest.fn().mockResolvedValue({
    wallet: '0xuser',
    available: '0',
    inOrders: '0',
    totalDeposited: '0',
    totalWithdrawn: '0',
    withdrawNonce: 0,
  }),
}));

jest.mock('../models/ProcessedDepositTx', () => ({
  ProcessedDepositTxModel: {
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    deleteOne: jest.fn().mockResolvedValue({}),
  },
}));

import { ethers } from 'ethers';
import { DepositService } from './DepositService';
import { creditBalance } from '../models/Balance';
import { ProcessedDepositTxModel } from '../models/ProcessedDepositTx';

describe('DepositService', () => {
  let transferListener:
    | ((
        from: string,
        to: string,
        value: bigint,
        event: { transactionHash: string; address?: string }
      ) => void)
    | null = null;
  let contractSpy: jest.SpyInstance;

  class MockUsdt {
    filters = {
      Transfer: (_from?: null, _to?: string) => ['Transfer'],
    };
    on = jest.fn((_filter: unknown, cb: typeof transferListener) => {
      transferListener = cb;
    });
    removeAllListeners = jest.fn();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    transferListener = null;
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(
      () => new MockUsdt() as unknown as ethers.Contract
    );
  });

  afterEach(() => {
    contractSpy.mockRestore();
  });

  it('skips creditBalance when tx hash is duplicate (idempotent)', async () => {
    (ProcessedDepositTxModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ txHash: '0xabc' }),
    });

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    jest.spyOn(provider, 'waitForTransaction').mockResolvedValue({ status: 1 } as any);

    const svc = new DepositService(provider, '0xrelayer');
    await svc.start();
    expect(transferListener).not.toBeNull();

    await transferListener!('0xuser', '0xrelayer', 100n, {
      transactionHash: '0xabc',
      address: '0x0000000000000000000000000000000000000002',
    });

    expect(creditBalance).not.toHaveBeenCalled();
  });

  it('credits after successful insert and confirmed receipt', async () => {
    (ProcessedDepositTxModel.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    jest.spyOn(provider, 'waitForTransaction').mockResolvedValue({ status: 1 } as any);

    const svc = new DepositService(provider, '0xrelayer');
    await svc.start();

    await transferListener!('0xuser', '0xrelayer', 200n, {
      transactionHash: '0xdef',
      address: '0x0000000000000000000000000000000000000002',
    });

    expect(creditBalance).toHaveBeenCalledWith('0xuser', 200n, 'totalDeposited');
    expect(ProcessedDepositTxModel.create).toHaveBeenCalledWith({ txHash: '0xdef' });
  });
});
