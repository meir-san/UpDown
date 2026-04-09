"use client";

import { useQuery } from "@tanstack/react-query";
import { getMarkets, getStats, type PairSymbol } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { MarketCard } from "@/components/MarketCard";
import { EmptyState } from "@/components/EmptyState";

const SECTIONS = [
  { title: "QuickFire", subtitle: "5 min markets", tf: 300 as const },
  { title: "PowerPlay", subtitle: "15 min markets", tf: 900 as const },
  { title: "MasterMode", subtitle: "60 min markets", tf: 3600 as const },
];

const PAIR_ROWS: { pair: PairSymbol; label: string }[] = [
  { pair: "BTC-USD", label: "BTC / USD" },
  { pair: "ETH-USD", label: "ETH / USD" },
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
          <div className="space-y-10">
            {PAIR_ROWS.map((row) => (
              <div key={row.pair}>
                <h3 className="mb-4 font-display text-lg font-bold text-foreground">{row.label}</h3>
                <MarketSection timeframe={s.tf} pair={row.pair} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MarketSection({
  timeframe,
  pair,
}: {
  timeframe: 300 | 900 | 3600;
  pair: PairSymbol;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["markets", timeframe, pair],
    queryFn: () => getMarkets(timeframe, pair),
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
      <EmptyState title={`No ${pair} markets`}>
        No pools for this pair and timeframe yet. Ensure the auto-cycler lists this pair on-chain and the
        backend syncer is running.
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
