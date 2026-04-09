"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  relayerAddress: string;
};

export function DepositModal({ open, onClose, relayerAddress }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#101114]/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-xl bg-white p-6",
          "shadow-[var(--shadow-card)]"
        )}
      >
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Deposit USDT</h2>
        <p className="mt-2 text-sm text-muted">
          Send USDT (Arbitrum) to the relayer address below. Your balance updates after confirmations
          (poll or WebSocket).
        </p>
        <div className="mt-4 flex justify-center rounded-lg border border-border bg-white p-4">
          <QRCodeSVG value={relayerAddress} size={180} level="M" />
        </div>
        <p className="mt-4 break-all rounded-lg bg-[rgba(148,151,169,0.08)] p-3 font-mono text-xs text-foreground">
          {relayerAddress}
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-[12px] bg-brand py-[13px] text-base font-semibold text-white"
          onClick={async () => {
            await navigator.clipboard.writeText(relayerAddress);
          }}
        >
          Copy address
        </button>
        <button
          type="button"
          className="mt-3 w-full rounded-[12px] border border-brand-dark py-3 text-base font-medium text-brand-dark"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
