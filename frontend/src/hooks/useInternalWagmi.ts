"use client";

import { useAlchemyAccountContext } from "@account-kit/react";
import type { Config } from "@wagmi/core";

export function useInternalWagmiConfig(): Config {
  const { config } = useAlchemyAccountContext();
  return config._internal.wagmiConfig;
}
