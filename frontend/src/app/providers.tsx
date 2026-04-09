"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { Provider as JotaiProvider } from "jotai";
import { useState } from "react";
import { Toaster } from "sonner";
import { alchemyAccountConfig } from "@/lib/alchemy";
import { fallbackWagmiConfig } from "@/lib/wagmi-fallback";
import { AppWagmiConfigProvider } from "@/context/AppWagmiConfigContext";

/**
 * Account Kit styles (harmless when running without NEXT_PUBLIC_ALCHEMY_API_KEY).
 * Wallet: WagmiProvider uses Account Kit’s internal wagmi config when the key is set,
 * otherwise fallbackWagmiConfig (injected + optional WalletConnect) — no signer iframe.
 */
import "@account-kit/react/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  const wagmiConfig =
    alchemyAccountConfig?._internal.wagmiConfig ?? fallbackWagmiConfig;

  return (
    <QueryClientProvider client={queryClient}>
      <AppWagmiConfigProvider value={wagmiConfig}>
        <WagmiProvider config={wagmiConfig}>
          <JotaiProvider>
            {children}
            <Toaster position="top-center" richColors />
          </JotaiProvider>
        </WagmiProvider>
      </AppWagmiConfigProvider>
    </QueryClientProvider>
  );
}
