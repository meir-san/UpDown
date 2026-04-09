"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { getBalance, getConfig } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { useInternalWagmiConfig } from "@/hooks/useInternalWagmi";
import { cn } from "@/lib/cn";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "./WithdrawModal";

const nav = [
  { href: "/", label: "Markets" },
  { href: "/positions", label: "Positions" },
  { href: "/history", label: "History" },
];

export function Header() {
  const wagmiConfig = useInternalWagmiConfig();
  const { address, isConnected } = useAccount({ config: wagmiConfig });
  const { connect, connectors, isPending } = useConnect({ config: wagmiConfig });
  const { disconnect } = useDisconnect({ config: wagmiConfig });
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["apiConfig"],
    queryFn: getConfig,
    staleTime: 300_000,
  });

  const { data: bal } = useQuery({
    queryKey: ["balance", address?.toLowerCase() ?? ""],
    queryFn: () => getBalance(address!),
    enabled: !!address && isConnected,
    refetchInterval: 15_000,
  });

  const relayer = cfg?.relayerAddress ?? "";

  return (
    <>
      <header className="sticky top-0 z-40 border-b-2 border-brand-subtle bg-white/95 shadow-card backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-brand transition-opacity hover:opacity-90"
          >
            UpDown
          </Link>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-[12px] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-brand-subtle hover:text-brand"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {isConnected && address && (
              <>
                <span className="hidden text-xs font-medium uppercase tracking-wide text-muted sm:inline">
                  Balance
                </span>
                <span className="rounded-[12px] border border-border bg-surface-muted px-3 py-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                  ${formatUsdt(bal?.available ?? "0")}
                </span>
                <button
                  type="button"
                  className="btn-secondary !py-2 !text-sm"
                  onClick={() => setDepositOpen(true)}
                  disabled={!relayer}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  className="rounded-[12px] border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
                  onClick={() => setWithdrawOpen(true)}
                >
                  Withdraw
                </button>
                <button
                  type="button"
                  className="rounded-[12px] border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand"
                  onClick={() => disconnect()}
                >
                  Disconnect
                </button>
              </>
            )}
            {!isConnected && (
              <div className="flex flex-wrap gap-2">
                {connectors.slice(0, 4).map((c) => (
                  <button
                    key={c.uid}
                    type="button"
                    disabled={isPending || !c.ready}
                    className={cn(
                      "btn-primary !px-4 !py-[13px] !text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    onClick={() => connect({ connector: c })}
                  >
                    {isPending ? "Connecting…" : `Connect ${c.name}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} relayerAddress={relayer} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </>
  );
}
