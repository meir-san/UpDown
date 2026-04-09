"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getBalance, getConfig } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "./WithdrawModal";
import { SignModal } from "./SignModal";
import { useWalletContext } from "@/context/WalletContext";
import { useWalletList } from "@/hooks/useWalletList";
import { getFormattedAddress } from "@/utils/walletHelpers";

const nav = [
  { href: "/", label: "Markets" },
  { href: "/positions", label: "Positions" },
  { href: "/history", label: "History" },
];

export function Header() {
  const {
    isWalletConnected,
    isLoading,
    loadingStep,
    walletAddress,
    connectWallet,
    disconnectWallet,
    showSignModal,
    handleSign,
    closeSignModal,
  } = useWalletContext();

  const { isConnected: wagmiConnected } = useAccount();
  const walletList = useWalletList();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const connectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (connectRef.current && !connectRef.current.contains(e.target as Node)) {
        setConnectOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const { data: cfg } = useQuery({
    queryKey: ["apiConfig"],
    queryFn: getConfig,
    staleTime: 300_000,
  });

  const { data: bal } = useQuery({
    queryKey: ["balance", walletAddress?.toLowerCase() ?? ""],
    queryFn: () => getBalance(walletAddress!),
    enabled: !!walletAddress && isWalletConnected,
    refetchInterval: 15_000,
  });

  const relayer = cfg?.relayerAddress ?? "";

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          {loadingStep ? (
            <p className="max-w-xs text-center text-sm font-medium text-foreground">{loadingStep}</p>
          ) : null}
        </div>
      )}

      <SignModal open={showSignModal} onSign={() => void handleSign()} onCancel={closeSignModal} />

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
            {isWalletConnected && walletAddress && (
              <>
                <span className="hidden text-xs font-medium uppercase tracking-wide text-muted sm:inline">
                  Balance
                </span>
                <span className="rounded-[12px] border border-border bg-surface-muted px-3 py-2 font-mono text-sm font-semibold tabular-nums text-foreground">
                  ${formatUsdt(bal?.available ?? "0")}
                </span>
                <span className="hidden rounded-[12px] border border-border bg-white px-3 py-2 font-mono text-xs text-muted sm:inline">
                  {getFormattedAddress(walletAddress)}
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
                  onClick={() => void disconnectWallet()}
                >
                  Disconnect
                </button>
              </>
            )}
            {!isWalletConnected && wagmiConnected && (
              <span className="text-sm font-medium text-muted">Complete signing in the modal…</span>
            )}
            {!isWalletConnected && !wagmiConnected && (
              <div className="relative" ref={connectRef}>
                <button
                  type="button"
                  className="btn-primary !px-4 !py-[13px] !text-sm"
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConnectOpen((o) => !o);
                  }}
                >
                  {isLoading ? "Connecting…" : "Connect wallet"}
                </button>
                {connectOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-[12px] border border-border bg-white py-1 shadow-card-hover">
                    {walletList.map(({ name, connector, isAvailable }) => (
                      <button
                        key={name}
                        type="button"
                        disabled={!isAvailable || !connector || isLoading}
                        className="block w-full px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-brand-subtle disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          if (connector) {
                            void connectWallet(connector);
                            setConnectOpen(false);
                          }
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
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
