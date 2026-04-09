"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketListItem } from "@/lib/api";
import { formatProbabilityPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

function useCountdown(endTime: number) {
  const [left, setLeft] = useState(() => Math.max(0, endTime - Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const t = setInterval(() => {
      setLeft(Math.max(0, endTime - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [endTime]);
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function bestFromList(m: MarketListItem): { bid: string; ask: string } {
  try {
    const up = BigInt(m.upPrice);
    const down = BigInt(m.downPrice);
    const upP = Number(up) / 1e18;
    const downP = Number(down) / 1e18;
    if (!Number.isFinite(upP) || !Number.isFinite(downP)) return { bid: "—", ask: "—" };
    const upC = `${(upP * 100).toFixed(1)}¢`;
    const downC = `${(downP * 100).toFixed(1)}¢`;
    return { bid: `UP ${upC}`, ask: `DN ${downC}` };
  } catch {
    return { bid: "—", ask: "—" };
  }
}

export function MarketCard({ market }: { market: MarketListItem }) {
  const cd = useCountdown(market.endTime);
  const strike =
    market.strikePrice && market.strikePrice !== "0"
      ? formatProbabilityPrice(market.strikePrice)
      : "—";
  const { bid, ask } = bestFromList(market);

  return (
    <Link
      href={`/market/${market.address}`}
      className={cn(
        "block rounded-xl border border-border bg-white p-4 transition-shadow",
        "shadow-[var(--shadow-card)] hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold text-foreground">{market.pairId}</p>
          <p className="mt-1 text-xs text-muted">
            Strike <span className="font-medium text-foreground">{strike}</span>
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
            market.status === "ACTIVE"
              ? "bg-[rgba(20,158,97,0.16)] text-success-dark"
              : "bg-[rgba(104,107,130,0.12)] text-[#484b5e]"
          )}
        >
          {market.status}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          <p className="text-xs text-muted">Ends in</p>
          <p className="font-mono text-base font-semibold text-foreground">{cd}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Pool prices</p>
          <p className="text-sm text-foreground">{bid}</p>
          <p className="text-sm text-foreground">{ask}</p>
        </div>
      </div>
    </Link>
  );
}
