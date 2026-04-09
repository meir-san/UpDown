"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import Link from "next/link";
import { toast } from "sonner";
import { getPositions, postMarketClaim } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { useInternalWagmiConfig } from "@/hooks/useInternalWagmi";
import { cn } from "@/lib/cn";

export default function PositionsPage() {
  const wagmiConfig = useInternalWagmiConfig();
  const { address, isConnected } = useAccount({ config: wagmiConfig });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["positions", address?.toLowerCase() ?? ""],
    queryFn: () => getPositions(address!),
    enabled: !!address && isConnected,
    refetchInterval: 20_000,
  });

  const claim = useMutation({
    mutationFn: (market: string) => postMarketClaim(market),
    onSuccess: () => {
      toast.success("Claim request sent");
      qc.invalidateQueries({ queryKey: ["positions", address?.toLowerCase()] });
      qc.invalidateQueries({ queryKey: ["balance", address?.toLowerCase()] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isConnected) {
    return <p className="text-muted">Connect your wallet to view positions.</p>;
  }

  if (isLoading) {
    return <p className="text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-foreground">Positions</h1>
      {!data?.length && <p className="text-muted">No open positions.</p>}
      <ul className="space-y-3">
        {data?.map((p) => (
          <li
            key={`${p.market}-${p.option}`}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
            )}
          >
            <div>
              <Link href={`/market/${p.market}`} className="font-semibold text-brand hover:underline">
                {p.market.slice(0, 10)}…
              </Link>
              <p className="text-sm text-muted">
                {p.optionLabel} · {p.marketStatus}
              </p>
              <p className="mt-1 text-sm text-foreground">
                Shares <span className="font-mono">{formatUsdt(p.shares)}</span> · Avg price{" "}
                {p.avgPrice} bps
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(p.marketStatus === "RESOLVED" || p.marketStatus === "CLAIMED") && (
                <button
                  type="button"
                  className="rounded-[12px] bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={claim.isPending}
                  onClick={() => claim.mutate(p.market)}
                >
                  Claim / sync
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Winnings are credited by the relayer after resolution; the Claim button nudges the backend
        relayer path if a market is resolved.
      </p>
    </div>
  );
}
