"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlchemyAccountProvider } from "@account-kit/react";
import { Provider as JotaiProvider } from "jotai";
import { useState } from "react";
import { Toaster } from "sonner";
import { alchemyAccountConfig } from "@/lib/alchemy";
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

  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider config={alchemyAccountConfig} queryClient={queryClient}>
        <JotaiProvider>
          {children}
          <Toaster position="top-center" richColors />
        </JotaiProvider>
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
}
