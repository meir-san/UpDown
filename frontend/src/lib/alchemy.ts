"use client";

import { createConfig, configForExternalWallets } from "@account-kit/react";
import { alchemy, arbitrum } from "@account-kit/infra";

const alchemyKey =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim() ?? "" : "";

const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

function buildAlchemyConfig() {
  if (!alchemyKey) {
    return null;
  }

  const t = alchemy({ apiKey: alchemyKey });

  const ext = configForExternalWallets({
    wallets: [
      "metamask",
      "coinbase_wallet",
      ...(walletConnectId ? (["wallet_connect"] as const) : []),
    ],
    chainType: ["evm"],
    walletConnectProjectId: walletConnectId,
  });

  return createConfig(
    {
      transport: t,
      chain: arbitrum,
      chains: [{ chain: arbitrum, transport: t }],
      ssr: true,
      connectors: ext.connectors,
    },
    {
      auth: {
        sections: [[{ type: "external_wallets", ...ext.uiConfig }]],
      },
    }
  );
}

/**
 * Alchemy Account Kit config — only created when `NEXT_PUBLIC_ALCHEMY_API_KEY` is set.
 * Otherwise use `fallbackWagmiConfig` so the app never initializes AlchemySigner without a key.
 */
export const alchemyAccountConfig = buildAlchemyConfig();

export const targetChain = arbitrum;
