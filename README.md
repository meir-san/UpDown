# UpDown

Prediction markets on **Arbitrum** with an off-chain matching engine, EIP-712 signed orders, and a Next.js interface. Users trade **UP** / **DOWN** outcomes on time-boxed markets; the backend maintains order books, matches flow, and coordinates settlement with on-chain contracts via a relayer wallet.

---

## Repository layout

| Path | Role |
|------|------|
| [`backend/`](backend/) | Express REST API, WebSocket stream, MongoDB persistence, matching engine, deposit monitoring |
| [`frontend/`](frontend/) | Next.js 15 app: markets, positions, history, wallet connect (Wagmi + Alchemy smart accounts) |
| [`contracts/`](contracts/) | Solidity (Foundry): auto-cycler, trade pool integration, Chainlink resolver, deploy scripts |

---

## Architecture (high level)

1. **Frontend** talks to the backend over HTTP (`/config`, `/markets`, `/orders`, …) and WebSocket (`/stream` for live updates).
2. **Users** connect an EOA (MetaMask, WalletConnect, or Coinbase Wallet), sign a message, and get an **Alchemy smart account** client; session permissions can be stored in **IndexedDB** for follow-up flows.
3. **Orders** are signed off-chain (EIP-712) and submitted to the API; the **matching engine** pairs resting liquidity.
4. **Relayer** (configured on the server) submits batched on-chain operations; **USDT** and contract addresses come from backend config and env.

---

## Prerequisites

- **Node.js** 20+ (recommended for the frontend; backend uses modern TypeScript)
- **MongoDB** (local or hosted URI)
- **Arbitrum RPC** URL and a **relayer private key** with ETH for gas (and operational USDT handling as per your deployment)
- For contracts: **[Foundry](https://book.getfoundry.sh/getting-started/installation)**

---

## Quick start

### 1. MongoDB

Ensure MongoDB is running, for example:

```bash
# default assumed by backend if MONGODB_URI is unset
mongodb://localhost:27017/updown
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env` (see [Backend environment variables](#backend-environment-variables)). Minimum required:

- `ARBITRUM_RPC_URL`
- `RELAYER_PRIVATE_KEY`

```bash
npm run dev
```

Default API: `http://localhost:3001`  
Health: `GET http://localhost:3001/health`  
WebSocket: `ws://localhost:3001/stream`

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local` (see [Frontend environment variables](#frontend-environment-variables)). At minimum set:

- `NEXT_PUBLIC_ALCHEMY_API_KEY` — smart account / Alchemy transport
- `NEXT_PUBLIC_API_BASE_URL` — if the API is not on `http://localhost:3001`

```bash
npm run dev
```

Default app: `http://localhost:3000`

> The app loads wallet-only providers on the client (`ssr: false` wrapper) so browser APIs such as IndexedDB and WalletConnect do not run during Next.js static generation.

### 4. Contracts (optional)

```bash
cd contracts
forge build
forge test
```

See [`contracts/script/Deploy.s.sol`](contracts/script/Deploy.s.sol) and Foundry docs for deployment.

---

## Backend environment variables

Defined in [`backend/src/config.ts`](backend/src/config.ts).

| Variable | Required | Description |
|----------|----------|-------------|
| `ARBITRUM_RPC_URL` | **Yes** | JSON-RPC URL for Arbitrum |
| `RELAYER_PRIVATE_KEY` | **Yes** | Hex private key for the relayer wallet |
| `PORT` | No | HTTP port (default `3001`) |
| `MONGODB_URI` | No | Mongo connection string |
| `CHAIN_ID` | No | Chain ID (default `42161`) |
| `FACTORY_ADDRESS` | No | Market factory address |
| `USDT_ADDRESS` | No | USDT token on Arbitrum |
| `AUTOCYCLER_ADDRESS` | No | Auto-cycler contract when used |
| `PLATFORM_FEE_BPS` / `MAKER_FEE_BPS` | No | Fee basis points |
| `MATCHING_INTERVAL_MS` | No | Matching tick interval |
| `SETTLEMENT_BATCH_INTERVAL_MS` | No | Settlement batching |
| `MARKET_SYNC_INTERVAL_MS` | No | On-chain market sync interval |
| `DEPOSIT_CONFIRMATIONS` | No | Block confirmations for deposits |
| `SPEED_MARKET_API_BASE_URL` | No | Upstream base URL for proxied price history |

---

## Frontend environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | **Yes** (for smart accounts) | Alchemy API key for Account Kit transport / smart wallet |
| `NEXT_PUBLIC_API_BASE_URL` | No | Backend origin (default `http://localhost:3001`) |
| `NEXT_PUBLIC_CHAIN_ID` | No | Display / client chain hint (default `42161`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_PAYMASTER_POLICY_ID` | No | Alchemy paymaster policy for sponsored gas (if used) |

Client-side API base and WebSocket URL derivation: [`frontend/src/lib/env.ts`](frontend/src/lib/env.ts).

---

## HTTP API (overview)

All paths are relative to the backend origin (e.g. `http://localhost:3001`).

| Area | Examples |
|------|----------|
| Config | `GET /config` — chain, USDT, relayer, EIP-712 domain for signing |
| Markets | `GET /markets`, `GET /markets/:address` |
| Order book | `GET /orderbook/:marketId` |
| Orders | `POST /orders` (submit signed order), cancel flows as implemented |
| Positions | `GET /positions/:wallet` |
| Balance | `GET /balance/:wallet` |
| Trades | `GET /trades/:wallet` |
| Prices | `GET /prices/...` (includes proxied history when configured) |
| Health | `GET /health` |

Exact request/response shapes match the TypeScript types in [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) and the routers under [`backend/src/routes/`](backend/src/routes/).

---

## WebSocket

Connect to `ws://<host>:<port>/stream` (or `wss://` in production). The server pushes order book, balance, and related events so the UI can update without polling.

---

## Wallet connection (frontend)

The UI follows a **Wagmi** + **Alchemy Account Kit** smart-wallet pattern:

1. User picks **MetaMask**, **WalletConnect**, or **Coinbase Wallet**.
2. After connection, the user **signs a message** (personal sign of the EOA address).
3. The app builds a **smart wallet client** and calls **`requestAccount`**.
4. **Root session permissions** may be granted and the session material stored in **IndexedDB** (`UpDownDB`), with expiry metadata in `localStorage`.

Relevant code: [`frontend/src/context/WalletContext.tsx`](frontend/src/context/WalletContext.tsx), [`frontend/src/config/wagmi.ts`](frontend/src/config/wagmi.ts), [`frontend/src/lib/grantSessionPermissions.ts`](frontend/src/lib/grantSessionPermissions.ts).

---

## Scripts

**Backend** (`backend/package.json`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled `dist/index.js` |
| `npm test` | Jest tests |

**Frontend** (`frontend/package.json`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run lint` | ESLint |

---

## Security notes

- Never commit **private keys**, **Alchemy keys**, or **WalletConnect project IDs** for production. Use `.env` / your host’s secret store.
- The relayer key controls on-chain actions; restrict RPC keys and rotate credentials if exposed.

---

## Contributing

1. Open issues or PRs against this repository.
2. Run `npm run lint` / `npm run build` in `frontend` and `npm test` in `backend` where relevant before submitting.

---

## License

No root license file is specified; subprojects may include their own licenses (e.g. vendored Foundry / OpenZeppelin under `contracts/lib/`).
