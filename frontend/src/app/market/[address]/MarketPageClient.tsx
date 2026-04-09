"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getMarket, getPositions } from "@/lib/api";
import { formatProbabilityPrice, formatUsdt } from "@/lib/format";
import { TradingChart } from "@/components/TradingChart";
import { TradeForm } from "@/components/TradeForm";
import { OrderBookPanel } from "@/components/OrderBook";
import { useInternalWagmiConfig } from "@/hooks/useInternalWagmi";
import { cn } from "@/lib/cn";

export function MarketPageClient({ address }: { address: string }) {
  const wagmiConfig = useInternalWagmiConfig();
  const { address: wallet } = useAccount({ config: wagmiConfig });

  const { data: market, isLoading } = useQuery({
    queryKey: ["market", address.toLowerCase()],
    queryFn: () => getMarket(address),
    refetchInterval: 15_000,
  });

  const { data: positions } = useQuery({
    queryKey: ["positions", wallet?.toLowerCase() ?? ""],
    queryFn: () => getPositions(wallet!),
    enabled: !!wallet,
    refetchInterval: 20_000,
  });

  const localPositions = positions?.filter((p) => p.market.toLowerCase() === address.toLowerCase()) ?? [];

  if (isLoading || !market) {
    return <p className="text-muted">Loading market…</p>;
  }

  const strike =
    market.strikePrice && market.strikePrice !== "0"
      ? formatProbabilityPrice(market.strikePrice)
      : "—";

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm font-medium text-brand hover:underline">
        ← Markets
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">{market.pairId}</h1>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-foreground">{market.address}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-md bg-[rgba(104,107,130,0.12)] px-2 py-1 text-[#484b5e]">
            {market.status}
          </span>
          <span>
            Strike: <span className="font-semibold text-foreground">{strike}</span>
          </span>
          <span>
            Ends in:{" "}
            <span className="font-mono font-semibold text-foreground">
              {market.timeRemainingSeconds}s
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TradingChart symbol="BTC" />
        <TradeForm marketAddress={address} />
      </div>

      <section>
        <h2 className="font-display mb-3 text-xl font-bold text-foreground">Order book</h2>
        <OrderBookPanel marketId={address} />
      </section>

      <section>
        <h2 className="font-display mb-3 text-xl font-bold text-foreground">Your positions</h2>
        {!wallet && <p className="text-sm text-muted">Connect to see positions.</p>}
        {wallet && localPositions.length === 0 && (
          <p className="text-sm text-muted">No open position in this market.</p>
        )}
        <ul className="space-y-2">
          {localPositions.map((p) => (
            <li
              key={`${p.market}-${p.option}`}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              )}
            >
              <span className="font-semibold text-foreground">{p.optionLabel}</span>
              <span className="text-sm text-muted">Shares {formatUsdt(p.shares)}</span>
              <span className="text-sm text-muted">Avg {p.avgPrice} bps</span>
              <span className="text-xs text-muted">{p.marketStatus}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
