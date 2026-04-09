"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrderbook, type OrderBookResponse } from "@/lib/api";
import { cn } from "@/lib/cn";

function SideTable({
  title,
  snapshot,
  accent,
}: {
  title: string;
  snapshot: OrderBookResponse["up"];
  accent: "up" | "down";
}) {
  const rows = [...snapshot.asks].reverse().slice(0, 6);
  const bids = snapshot.bids.slice(0, 6);
  return (
    <div className="rounded-lg border border-border p-3">
      <p
        className={cn(
          "mb-2 text-sm font-bold",
          accent === "up" ? "text-success" : "text-brand-deep"
        )}
      >
        {title}
      </p>
      <div className="grid grid-cols-3 gap-1 text-xs text-muted">
        <span>Price</span>
        <span className="text-right">Depth</span>
        <span className="text-right">#</span>
      </div>
      <div className="mt-1 space-y-0.5 font-mono text-xs">
        {rows.map((l, i) => (
          <div key={`a-${i}`} className="grid grid-cols-3 gap-1 text-[#484b5e]">
            <span>{(l.price / 100).toFixed(2)}¢</span>
            <span className="text-right">{l.depth}</span>
            <span className="text-right">{l.count}</span>
          </div>
        ))}
        <div className="border-t border-border py-1 text-center text-[10px] uppercase text-muted">
          spread
        </div>
        {bids.map((l, i) => (
          <div key={`b-${i}`} className="grid grid-cols-3 gap-1 text-foreground">
            <span>{(l.price / 100).toFixed(2)}¢</span>
            <span className="text-right">{l.depth}</span>
            <span className="text-right">{l.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrderBookPanel({ marketId }: { marketId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["orderbook", marketId.toLowerCase()],
    queryFn: () => getOrderbook(marketId),
    refetchInterval: 20_000,
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted">Loading order book…</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SideTable title="UP (option 1)" snapshot={data.up} accent="up" />
      <SideTable title="DOWN (option 2)" snapshot={data.down} accent="down" />
    </div>
  );
}
