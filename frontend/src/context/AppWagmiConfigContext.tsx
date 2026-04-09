"use client";

import { createContext, useContext } from "react";
import type { Config } from "@wagmi/core";
import { fallbackWagmiConfig } from "@/lib/wagmi-fallback";

const AppWagmiConfigContext = createContext<Config>(fallbackWagmiConfig);

export function AppWagmiConfigProvider({
  value,
  children,
}: {
  value: Config;
  children: React.ReactNode;
}) {
  return <AppWagmiConfigContext.Provider value={value}>{children}</AppWagmiConfigContext.Provider>;
}

export function useAppWagmiConfig(): Config {
  return useContext(AppWagmiConfigContext);
}
