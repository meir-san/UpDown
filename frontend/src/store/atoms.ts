import { atom } from "jotai";
import type { ApiConfig } from "@/lib/api";
import type { BalanceResponse } from "@/lib/api";

export const apiConfigAtom = atom<ApiConfig | null>(null);

export const wsConnectedAtom = atom(false);

export const balanceSnapshotAtom = atom<BalanceResponse | null>(null);
