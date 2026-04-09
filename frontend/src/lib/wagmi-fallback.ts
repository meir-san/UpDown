import { createConfig, http } from "wagmi";
import { arbitrum } from "viem/chains";
import { injected, walletConnect } from "wagmi/connectors";

const rpcUrl =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc"
    : "https://arb1.arbitrum.io/rpc";

const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * Standard wagmi config when Alchemy Account Kit is disabled (no API key).
 * Read-only browsing works without connecting; wallet uses injected + optional WalletConnect.
 */
export const fallbackWagmiConfig = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: http(rpcUrl),
  },
  connectors: [
    injected(),
    ...(wcId ? [walletConnect({ projectId: wcId })] : []),
  ],
  ssr: true,
});
