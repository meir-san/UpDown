# UpDown Markets — Cowork Code Review Context

You are an expert code reviewer for the UpDown Markets project. Read this entire file before touching any code. Every architectural decision in here is locked — if you see code that contradicts it, that's a bug, not a design choice to respect.

---

## What This Project Is

UpDown is RAIN Protocol's auto-cycling UP/DOWN price prediction market on Arbitrum. Users predict if BTC/USD goes UP or DOWN within 5, 10, or 15 minutes. Architecture is modeled on Polymarket: **off-chain order matching, on-chain settlement.** Goal: ship before Hyperliquid's HIP-4 hits mainnet.

---

## Monorepo Structure

```
/contracts     — Phase 1 (DONE, 19 tests passing)
/backend       — Phase 2 (DONE, 22 tests passing)
/frontend      — Phase 4 (NOT STARTED YET)
```

Only review phases marked DONE. This file gets updated as each phase completes.

---

## Locked Architecture Decisions

These are not variables. Code that contradicts them is a bug.

### Order Book
- Matching is **off-chain** in the backend matching engine. NOT on-chain.
- The RAIN pool has `placeBuyOrder`/`placeSellOrder` — we do NOT use them.
- We use `enterOption()` only — to enter aggregate positions backing off-chain matched trades.
- Cancel priority is enforced by the matching engine. Cancels process before taker orders in each batch.
- Price-time priority for matching.

### Settlement (Phase 2 Custodial Model)
- Users deposit USDT to relayer wallet.
- `DepositService` monitors `Transfer` events, credits MongoDB `Balance` records.
- Engine checks `Balance.available >= order.amount` before accepting orders.
- After matching, `SettlementService` calls `enterOption()` from relayer to enter aggregate positions on-chain.
- At resolution, `ClaimService` calls `pool.claim()` from relayer, then distributes to winners based on MongoDB records.
- Explicitly custodial — intentional for Phase 2. Phase 4 replaces with session-key smart accounts.

### Fees
- Total: 3.6% (2.5% RAIN burn + 1% LP/maker + 0.1% resolver)
- Creator fee: 0% — markets are auto-generated, no creator entity exists
- Any hardcoded 5% anywhere is wrong

### Markets
- Timeframes: 5, 10, 15 minutes only
- Pairs: BTC/USD at MVP. ETH/USD is future expansion, not built yet.
- Auto-created and auto-resolved by `UpDownAutoCycler` + `ChainlinkResolver`
- Dispute window = 2x market duration (10/30/30 min). Disputes stay enabled — hard constraint.
- Options are 1-indexed: option 1 = UP, option 2 = DOWN
- Resolution sequence: `closePool` first, then `chooseWinner`
- $10 seed liquidity on market creation

### Contracts (Arbitrum)
```
RAIN TradingFacet:  0xB292c8E18c1bD5861A2734412F0078C18aCBc50e
Dev USDT:           0xCa4f77A38d8552Dd1D5E44e890173921B67725F4
Paymaster:          0x5492B6624226F393d0813a8f0bc752B6C0521393
```

---

## How to Report Findings

For every issue found:

```
PHASE: 1 or 2 (or 3/4/5 when added)
FILE: contracts/src/ChainlinkResolver.sol
FUNCTION: resolve()
ISSUE: Description of what's wrong
SEVERITY: Critical / High / Medium / Low
FIX: What the fix should be
```

Severity levels:
- **Critical** — funds lost, double-spent, or incorrect payouts possible
- **High** — system gets into broken state requiring manual intervention
- **Medium** — edge case that will eventually hit in production
- **Low** — missing error handling, logging gaps, code quality

---

---

# PHASE 1 — Contracts

**Status: DONE (19 tests passing)**
**Folder: `contracts/`**
**Stack: Solidity, Foundry, Chainlink Data Feeds + Automation**

## What Was Built
- `ChainlinkResolver` — reads Chainlink BTC/USD feed, validates Arbitrum sequencer uptime, resolves markets by calling `closePool` then `chooseWinner` on the RAIN pool
- `UpDownAutoCycler` — Chainlink Automation keeper that auto-creates and auto-resolves 5/10/15-min markets in a continuous cycle

## Phase 1 Review Checklist

### ChainlinkResolver
- [ ] Sequencer uptime check: is the grace period correctly set to 1 hour after sequencer comes back up?
- [ ] Is `resolve()` permissionless? Anyone should be able to call it with a deterministic result from Chainlink. No access control should block this.
- [ ] Does `registerMarket` store enough info that `resolve()` is fully self-contained — no external params needed at resolution time?
- [ ] Are `authorizedCallers` scoped correctly — AutoCycler can register markets without having full owner access?
- [ ] Resolution sequence: is `closePool` always called before `chooseWinner`, with no code path that skips `closePool`?
- [ ] Options are 1-indexed: is `chooseWinner(1)` called for UP and `chooseWinner(2)` for DOWN? Not 0-indexed.
- [ ] Dispute window: is `oracleEndTime` set to `endTime + (duration * 2)`? Verify the multiplier is exactly 2x, not a hardcoded number.
- [ ] Staleness check: if the Chainlink feed returns a stale price (beyond max age), is resolution blocked or does it proceed with bad data?
- [ ] If `chooseWinner` reverts (e.g., disputed market), does the resolver handle this gracefully or does it brick the entire resolution cycle?

### UpDownAutoCycler
- [ ] Cycle order: does it resolve expired markets FIRST, then create new ones? Not the reverse.
- [ ] Does it handle all three timeframes (5/10/15 min) concurrently without interference?
- [ ] `pruneResolved()`: does it use swap-and-pop for gas efficiency? Does it correctly handle the edge case of removing the last element?
- [ ] Strike price: does the AutoCycler read the current Chainlink price via the Resolver — not from a separate feed or hardcoded?
- [ ] Is $10 seed liquidity consistently applied on every `createPool` call?
- [ ] If `createPool` reverts (factory paused, insufficient seed funds), does the keeper gracefully skip or halt the entire upkeep?
- [ ] Is the Chainlink Automation interface (`checkUpkeep` / `performUpkeep`) correctly implemented?
- [ ] Are `ITradePool` and `IFactory` interface calls using correct signatures — verified against actual RAIN ABIs, not assumed?

### Tests
- [ ] Do the 19 tests cover all three timeframes (5/10/15 min)?
- [ ] Is there a test for sequencer downtime scenario?
- [ ] Is there a test for stale price feed?
- [ ] Is there a fork test running against real Chainlink feeds on Arbitrum (not mocked)?
- [ ] Is the `chooseWinner` revert scenario tested?

---

---

# PHASE 2 — Backend Matching Engine

**Status: DONE (22 tests passing)**
**Folder: `backend/`**
**Stack: Node.js, Express, MongoDB, ethers.js, WebSocket (ws)**

## What Was Built
- Off-chain matching engine with order book, price-time priority, cancel priority
- `DepositService` — monitors USDT Transfer events, credits user balances in MongoDB
- `SettlementService` — submits matched trades on-chain via `enterOption()`
- `ClaimService` — claims resolved pool payouts and distributes to winning users
- REST API for bots + WebSocket streaming

## Required API Endpoints
```
POST   /orders              — place order
DELETE /orders/:id          — cancel order
GET    /orderbook/:marketId — current order book
GET    /markets             — list active markets
GET    /positions/:wallet   — user positions
WS     /stream              — real-time order book + trade events
```

## Phase 2 Review Checklist

### ClaimService — Payout Distribution
- [ ] When `pool.claim()` returns USDT, is payout split proportionally across all winning users based on MongoDB position records?
- [ ] Is rounding/dust handled? Integer division creates dust (e.g., 3 winners split 100 USDT → each gets 33, 1 USDT unaccounted). Remainder should go to the relayer — not silently lost, not over-distributed.
- [ ] What happens if a user's position record is missing at claim time? Skip, error, or hold funds?
- [ ] Is the claim idempotent? Can it trigger twice without double-paying?
- [ ] Is there a guard that the pool is actually resolved before attempting to claim?

### DepositService — Event Monitoring
- [ ] Are duplicate events handled? Same `Transfer` event processed twice — common on RPC reconnect.
- [ ] Are reorgs handled? If a block is reorged, is the credited balance rolled back or flagged?
- [ ] What confirmation depth before crediting? Should be at least 1, ideally 3+.
- [ ] Does it filter for transfers TO the relayer wallet only — not all USDT transfers on the network?
- [ ] Does it verify the token contract is Dev USDT (`0xCa4f77A38d8552Dd1D5E44e890173921B67725F4`) — not a spoofed ERC20?

### SettlementService — On-Chain Submission
- [ ] Does it retry failed `enterOption()` transactions? What's the retry strategy — backoff interval and max attempts?
- [ ] If a transaction reverts on-chain, is the order marked failed and the user's reserved balance refunded?
- [ ] If the RPC is down during settlement, are pending orders queued or dropped?
- [ ] Is there protection against submitting the same matched trade twice (double settlement)?
- [ ] Are gas estimates correct for Arbitrum (L2 gas model, not L1)?

### Matching Engine — Order Book Logic
- [ ] Cancel priority: are cancels guaranteed to process before taker orders in the same batch? Show exactly where in the code this is enforced.
- [ ] Partial fill boundary: order A = 100 USDT, order B = 150 USDT. After matching, A is fully filled, B has 50 remaining. Is B's 50 re-queued at the front with original timestamp (price-time priority preserved)?
- [ ] Is `Balance.available` decremented when an order is placed (reserved), not only when filled?
- [ ] Self-trade prevention: are two orders from the same wallet rejected from matching each other?
- [ ] What happens to open orders when a market expires? Are they cancelled and balances refunded?

### WebSocket — Broadcasting
- [ ] Are order book updates broadcast on every placement, cancellation, and fill?
- [ ] Are trade events broadcast when a match occurs?
- [ ] Is a disconnected client cleaned up properly — no memory leak from stale connections?
- [ ] Are messages scoped per `marketId` — subscriber to market A never receives market B events?

### General Backend
- [ ] Are MongoDB writes for balance changes atomic? Debiting a balance and recording an order must not be two independent operations that can fail separately.
- [ ] Race condition: can two concurrent requests both pass the balance check and over-commit the same funds?
- [ ] Are relayer private keys and credentials in environment variables only — never hardcoded?
- [ ] Is fee consistently 3.6% everywhere? No leftover 5% anywhere.
- [ ] Do all API endpoints return correct HTTP error codes — not swallowing errors silently?

### Tests
- [ ] Is there a test for ClaimService rounding/dust scenario?
- [ ] Is there a test for duplicate deposit events?
- [ ] Is there a test for settlement retry on RPC failure?
- [ ] Is there a test for partial fill boundary conditions?
- [ ] Is there a test for concurrent order placement (race condition on balance)?
- [ ] Is there a test for WebSocket client cleanup on disconnect?

---

---

# PHASE 3 — Indexer + API

**Status: NOT STARTED**

When Phase 3 completes, this section will be filled in with what was built, the stack, and the review checklist. Do not review Phase 3 until this section is updated.

---

# PHASE 4 — Frontend

**Status: NOT STARTED**

When Phase 4 completes, this section will be filled in. Stack will be Next.js, React, wagmi, Jotai, SCSS. Reference patterns come from the speed-market repo. Do not review Phase 4 until this section is updated.

---

# PHASE 5 — Bot Libraries + Hardening

**Status: NOT STARTED**

When Phase 5 completes, this section will be filled in. Scope includes Python + TypeScript bot client libraries and security/load hardening. Do not review Phase 5 until this section is updated.
