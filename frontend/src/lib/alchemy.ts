"use client";

import { createConfig, configForExternalWallets } from "@account-kit/react";
import { alchemy, arbitrum } from "@account-kit/infra";

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";
const nodeRpc =
  process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc";
const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

function transport() {
  if (alchemyKey) {
    return alchemy({ apiKey: alchemyKey });
  }
  return alchemy({ rpcUrl: nodeRpc });
}

const t = transport();

const ext = configForExternalWallets({
  wallets: [
    "metamask",
    "coinbase_wallet",
    ...(walletConnectId ? (["wallet_connect"] as const) : []),
  ],
  chainType: ["evm"],
  walletConnectProjectId: walletConnectId,
});

/**
 * Alchemy Account Kit + wagmi config. Uses public Arbitrum RPC when no Alchemy API key is set.
 * Until backend WebSocket broadcasts are fully wired, the UI polls REST (see useUpDownWebSocket).
 */
export const alchemyAccountConfig = createConfig(
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

export const targetChain = arbitrum;
