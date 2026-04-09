import { formatUnits, parseUnits } from "viem";

export const USDT_DECIMALS = 6;

export function formatUsdt(raw: string | bigint): string {
  const v = typeof raw === "bigint" ? raw : BigInt(raw || "0");
  const s = formatUnits(v, USDT_DECIMALS);
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (Math.abs(n) >= 1_000_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function parseUsdtToAtomic(dollars: string): bigint {
  const normalized = dollars.trim().replace(/,/g, "");
  return parseUnits(normalized || "0", USDT_DECIMALS);
}

/** Format on-chain probability price (often 18 decimals) for display. */
export function formatProbabilityPrice(raw: string): string {
  try {
    const v = formatUnits(BigInt(raw), 18);
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${(n * 100).toFixed(1)}¢`;
  } catch {
    return "—";
  }
}
