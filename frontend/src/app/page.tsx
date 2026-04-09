"use client";

import { useQuery } from "@tanstack/react-query";
import { getMarkets, getStats } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { MarketCard } from "@/components/MarketCard";

const SECTIONS = [
  { title: "QuickFire", subtitle: "300s markets", tf: 300 as const },
  { title: "PowerPlay", subtitle: "900s markets", tf: 900 as const },
  { title: "MasterMode", subtitle: "3600s markets", tf: 3600 as const },
];

export default function HomePage() {
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => getStats(),
    refetchInterval: 20_000,
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          UpDown markets
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Trade UP / DOWN on short-lived pools. Connect, deposit USDT to the relayer, and place signed
          orders. Balances and markets update over WebSocket when connected, with REST polling as fallback.
        </p>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-white p-4 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-xs text-muted">Volume (USDT atomic)</p>
            <p className="font-mono text-lg font-bold text-foreground">{formatUsdt(stats.totalVolume)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Active markets</p>
            <p className="font-mono text-lg font-bold text-foreground">{stats.activeMarketsCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Traders</p>
            <p className="font-mono text-lg font-bold text-foreground">{stats.totalTraders}</p>
          </div>
        </div>
      )}

      {SECTIONS.map((s) => (
        <section key={s.tf}>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">{s.title}</h2>
              <p className="text-sm text-muted">{s.subtitle}</p>
            </div>
          </div>
          <MarketSection timeframe={s.tf} />
        </section>
      ))}
    </div>
  );
}

function MarketSection({ timeframe }: { timeframe: 300 | 900 | 3600 }) {
  const { data, isLoading } = useQuery({
    queryKey: ["markets", timeframe],
    queryFn: () => getMarkets(timeframe),
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Loading markets…</p>;
  }

  if (!data?.length) {
    return <p className="text-sm text-muted">No markets in this timeframe (syncer may be idle).</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((m) => (
        <MarketCard key={m.address} market={m} />
      ))}
    </div>
  );
}
