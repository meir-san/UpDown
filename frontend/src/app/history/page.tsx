"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import Link from "next/link";
import { getMarket, getTrades, type TradeRow } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { useInternalWagmiConfig } from "@/hooks/useInternalWagmi";

const PAGE = 20;

function tradeResult(t: TradeRow, winner: number | null | undefined, wallet: string): string {
  if (winner == null || winner === 0) return "—";
  const w = wallet.toLowerCase();
  const wonOpt = t.option === winner;
  if (t.buyer.toLowerCase() === w) {
    return wonOpt ? "Win (buy)" : "Lose (buy)";
  }
  if (t.seller.toLowerCase() === w) {
    return wonOpt ? "Lose (sell)" : "Win (sell)";
  }
  return "—";
}

export default function HistoryPage() {
  const wagmiConfig = useInternalWagmiConfig();
  const { address, isConnected } = useAccount({ config: wagmiConfig });
  const [offset, setOffset] = useState(0);

  const { data: trades, isLoading } = useQuery({
    queryKey: ["trades", address?.toLowerCase() ?? "", offset],
    queryFn: () => getTrades(address!, PAGE, offset),
    enabled: !!address && isConnected,
  });

  const markets = useMemo(() => {
    const s = new Set<string>();
    trades?.forEach((t) => s.add(t.market.toLowerCase()));
    return Array.from(s);
  }, [trades]);

  const marketQueries = useQueries({
    queries: markets.map((m) => ({
      queryKey: ["market", m],
      queryFn: () => getMarket(m),
      enabled: !!trades?.length,
      staleTime: 60_000,
    })),
  });

  const winnerByMarket = useMemo(() => {
    const map = new Map<string, number | null>();
    markets.forEach((m, i) => {
      const d = marketQueries[i]?.data;
      map.set(m, d?.winner ?? null);
    });
    return map;
  }, [markets, marketQueries]);

  if (!isConnected) {
    return <p className="text-muted">Connect to view trade history.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">History</h1>
      {isLoading && <p className="text-muted">Loading…</p>}
      {!isLoading && (!trades || trades.length === 0) && (
        <p className="text-muted">No trades yet.</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-[var(--shadow-card)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-[rgba(148,151,169,0.08)] text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Market</th>
              <th className="px-3 py-2">Dir</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {trades?.map((t) => (
              <tr key={t.tradeId} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/market/${t.market}`} className="text-brand hover:underline">
                    {t.market.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-2">{t.option === 1 ? "UP" : "DOWN"}</td>
                <td className="px-3 py-2 font-mono">{formatUsdt(t.amount)}</td>
                <td className="px-3 py-2">{(t.price / 100).toFixed(2)}¢</td>
                <td className="px-3 py-2 text-muted">
                  {new Date(t.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {address
                    ? tradeResult(t, winnerByMarket.get(t.market.toLowerCase()), address)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-[12px] border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-[12px] border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          disabled={!trades || trades.length < PAGE}
          onClick={() => setOffset((o) => o + PAGE)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
