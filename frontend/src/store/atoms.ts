import { atom } from "jotai";
import type { PublicClient } from "viem";
import type { ApiConfig } from "@/lib/api";
import type { BalanceResponse } from "@/lib/api";

/** Speed-market–style smart account state (WalletContext). */
export const userSmartAccount = atom<string>("");
export const userSmartAccountClient = atom<unknown>(null);
export const userPublicClient = atom<PublicClient | null>(null);

export const apiConfigAtom = atom<ApiConfig | null>(null);

export const wsConnectedAtom = atom(false);

export const balanceSnapshotAtom = atom<BalanceResponse | null>(null);
