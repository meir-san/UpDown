"use client";

import { useQuery } from "@tanstack/react-query";
import { getMarkets, getStats } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { MarketCard } from "@/components/MarketCard";
import { EmptyState } from "@/components/EmptyState";

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
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          UpDown markets
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          Trade UP / DOWN on short-lived pools. Connect, deposit USDT to the relayer, and place signed
          orders. Markets and balances refresh over WebSocket when available, with REST polling as a
          fallback.
        </p>
      </div>

      {stats && (
        <div className="card-kraken flex flex-wrap gap-8 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Protocol volume</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
              ${formatUsdt(stats.totalVolume)}
            </p>
            <p className="mt-0.5 text-xs text-muted">USDT (display)</p>
          </div>
          <div className="h-auto w-px bg-border" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active markets</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-brand">
              {stats.activeMarketsCount}
            </p>
          </div>
          <div className="h-auto w-px bg-border" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Traders</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
              {stats.totalTraders}
            </p>
          </div>
        </div>
      )}

      {SECTIONS.map((s) => (
        <section key={s.tf}>
          <div className="mb-5 border-b border-border pb-3">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {s.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">{s.subtitle}</p>
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
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 py-16 text-center text-sm text-muted">
        Loading markets…
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState title="No markets">
        Nothing listed for this timeframe yet. If the backend syncer is running, new pools will appear
        here automatically.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((m) => (
        <MarketCard key={m.address} market={m} />
      ))}
    </div>
  );
}
