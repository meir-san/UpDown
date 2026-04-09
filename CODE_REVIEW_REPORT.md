# UpDown Markets — Code Review Report

**Date:** 2026-04-09
**Phases Reviewed:** Phase 1 (Contracts), Phase 2 (Backend)
**Reviewer:** Claude (automated review against COWORK.md checklist)

---

## Summary

| Severity | Phase 1 | Phase 2 | Total |
|----------|---------|---------|-------|
| Critical | 4       | 5       | 9     |
| High     | 2       | 8       | 10    |
| Medium   | 1       | 3       | 4     |
| Low      | 0       | 4       | 4     |
| **Total**| **7**   | **20**  | **27**|

---

## PHASE 1 — Contracts

### Critical Issues

```
PHASE: 1
FILE: contracts/src/UpDownAutoCycler.sol
FUNCTION: constructor()
ISSUE: Timeframes are set to 5, 15, and 60 minutes (durations 300, 900, 3600 seconds). Locked architecture requires exactly 5, 10, 15 minutes. The 60-minute timeframe is wrong and the 10-minute timeframe is missing entirely.
SEVERITY: Critical
FIX: Change timeframes to durations 300 (5 min), 600 (10 min), 900 (15 min). Update dispute durations to 600 (2x5), 1200 (2x10), 1800 (2x15).
```

```
PHASE: 1
FILE: contracts/src/ChainlinkResolver.sol
FUNCTION: resolve()
ISSUE: chooseWinner() is not wrapped in try-catch. info.resolved is set to TRUE before calling chooseWinner(). If chooseWinner reverts (e.g., disputed market), the market is orphaned — marked resolved=true but winner never chosen. Cannot be re-resolved, cannot be finalized. Funds locked.
SEVERITY: Critical
FIX: Either (a) set resolved=true only AFTER successful chooseWinner, or (b) wrap chooseWinner in try-catch with explicit error handling for disputed markets.
```

```
PHASE: 1
FILE: contracts/src/UpDownAutoCycler.sol
FUNCTION: performUpkeep()
ISSUE: Resolved markets are never removed from activeMarkets during performUpkeep. Array grows unbounded with stale entries. checkUpkeep scans resolved markets every block wasting gas. Could eventually hit block gas limit.
SEVERITY: Critical
FIX: Call pruneResolved() at end of performUpkeep, or remove markets inline using swap-and-pop after successful resolution.
```

```
PHASE: 1
FILE: contracts/src/UpDownAutoCycler.sol
FUNCTION: performUpkeep()
ISSUE: _createMarket() calls are not wrapped in try-catch. If createPool() reverts (factory paused, insufficient seed USDT), the entire performUpkeep halts — no markets created for ANY timeframe.
SEVERITY: Critical
FIX: Wrap _createMarket() in try-catch. Emit failure event on revert. Allow upkeep to continue for other timeframes.
```

### High Issues

```
PHASE: 1
FILE: contracts/test/UpDownForkTest.t.sol
FUNCTION: (all tests)
ISSUE: No test validates all three timeframes are created and cycle correctly. This means the wrong-timeframe bug (5/15/60 instead of 5/10/15) was never caught by tests.
SEVERITY: High
FIX: Add test_createMarketsAllTimeframes() that verifies markets are created with correct durations for all three timeframes.
```

```
PHASE: 1
FILE: contracts/test/UpDownForkTest.t.sol
FUNCTION: (all tests)
ISSUE: No test for chooseWinner() revert scenario. The orphaned-state Critical bug is completely untested.
SEVERITY: High
FIX: Add test_resolveChooseWinnerReverts() with a MockPool that reverts on chooseWinner, verifying the resolver handles it gracefully.
```

### Medium Issues

```
PHASE: 1
FILE: contracts/test/UpDownForkTest.t.sol
FUNCTION: (all tests)
ISSUE: No integration test calls checkUpkeep → encodes performData → calls performUpkeep to validate the full resolve+create cycle and array consistency.
SEVERITY: Medium
FIX: Add test_performUpkeepResolvesAndCreates() covering the full keeper lifecycle.
```

### Passing Checklist Items (Phase 1)

- Sequencer grace period correctly set to 1 hour
- resolve() is permissionless (external, no access control)
- registerMarket stores enough info for self-contained resolution
- authorizedCallers properly scoped (not full owner)
- closePool() called before chooseWinner() (correct sequence)
- Options correctly 1-indexed: OPTION_UP = 1, OPTION_DOWN = 2
- Staleness check blocks resolution if price > 1 hour old
- Chainlink Automation interface (checkUpkeep/performUpkeep) correctly implemented
- pruneResolved() uses swap-and-pop correctly including last-element edge case
- $10 seed liquidity (10_000_000 wei = $10 USDT 6 decimals) applied per market
- Cycle order correct: resolve expired markets first, then create new ones
- Strike price read from Chainlink via Resolver, not separate feed

---

## PHASE 2 — Backend

### Critical Issues

```
PHASE: 2
FILE: backend/src/models/Balance.ts
FUNCTION: debitAvailable() / settleTrade()
ISSUE: Race condition on concurrent order placement. Balance check and order creation are separate operations. Two concurrent requests can both pass the balance check before either debit is persisted, over-committing the same funds.
SEVERITY: Critical
FIX: Use MongoDB atomic transactions (session.startTransaction()) or findAndModify with $inc operators instead of read-modify-write.
```

```
PHASE: 2
FILE: backend/src/services/ClaimService.ts
FUNCTION: distributeWinnings()
ISSUE: Rounding/dust not handled. Integer division creates unaccounted remainder (e.g., 3 winners split 100 USDT → 33+33+33 = 99, 1 USDT lost). Spec says remainder goes to relayer.
SEVERITY: Critical
FIX: Track totalDistributed, then send (totalPool - totalDistributed) to relayer address.
```

```
PHASE: 2
FILE: backend/src/services/ClaimService.ts
FUNCTION: distributeWinnings()
ISSUE: Missing idempotency guard. If processResolvedMarket() runs twice (or crashes after pool.claim() but before marking claimedByRelayer), winners get double-paid.
SEVERITY: Critical
FIX: Set market.claimedByRelayer = true immediately AFTER successful pool.claim(), BEFORE distributeWinnings().
```

```
PHASE: 2
FILE: backend/src/services/DepositService.ts
FUNCTION: start()
ISSUE: Duplicate Transfer events not deduplicated. Same event processed twice on RPC reconnect credits the user twice. No txHash tracking.
SEVERITY: Critical
FIX: Track processed transaction hashes in MongoDB. Before creditBalance(), check if event.transactionHash was already processed.
```

```
PHASE: 2
FILE: backend/src/services/SettlementService.ts
FUNCTION: settleBatch()
ISSUE: No retry logic for failed enterOption() calls. Failed trades are marked FAILED permanently with no re-attempt. No backoff, no requeue.
SEVERITY: Critical
FIX: Implement exponential backoff retry up to 5 attempts. Track retry count in Trade model. Only mark FAILED after max retries.
```

### High Issues

```
PHASE: 2
FILE: backend/src/services/SettlementService.ts
FUNCTION: settleBatch()
ISSUE: No protection against double-settlement. If settleBatch() runs twice before trade status transitions, the same enterOption() call executes twice on-chain.
SEVERITY: High
FIX: Atomically transition trades PENDING → SUBMITTED before calling enterOption(). Use findAndModify so only one caller wins the transition.
```

```
PHASE: 2
FILE: backend/src/services/DepositService.ts
FUNCTION: start()
ISSUE: No reorg handling. If a block with a deposit Transfer is reorged, the credited balance is never reversed. User keeps phantom balance.
SEVERITY: High
FIX: Track confirmed block numbers. Listen for chain rewinds and debit balances from reorged deposits.
```

```
PHASE: 2
FILE: backend/src/services/DepositService.ts
FUNCTION: start()
ISSUE: Token contract address not verified at runtime. A misconfigured config.usdtAddress could credit deposits from a spoofed ERC20.
SEVERITY: High
FIX: Validate token address matches Dev USDT (0xCa4f77A38d8552Dd1D5E44e890173921B67725F4) on startup. Throw if mismatch.
```

```
PHASE: 2
FILE: backend/src/engine/MatchingEngine.ts
FUNCTION: executeFill()
ISSUE: Partial fill loses price-time priority. After partial fill, remaining amount re-queued with current timestamp instead of original createdAt. Violates FIFO ordering.
SEVERITY: High
FIX: Preserve original createdAt when re-queuing partially-filled orders.
```

```
PHASE: 2
FILE: backend/src/engine/MatchingEngine.ts
FUNCTION: matchOrder()
ISSUE: Self-trade prevention missing. Two orders from the same wallet can match against each other.
SEVERITY: High
FIX: Before executeFill(), check if taker.wallet === maker.wallet. If true, skip the match.
```

```
PHASE: 2
FILE: backend/src/engine/MatchingEngine.ts
FUNCTION: runCycle()
ISSUE: Expired resting orders remain on the book and can still be matched. Expiry is only checked for new incoming orders.
SEVERITY: High
FIX: During matching, check maker order expiry before matching. Sweep expired orders periodically.
```

```
PHASE: 2
FILE: backend/src/routes/balance.ts
FUNCTION: POST /withdraw
ISSUE: Balance debited in MongoDB BEFORE on-chain USDT transfer. If transfer fails, user's balance is lost — debited but never sent.
SEVERITY: High
FIX: Transfer USDT first, confirm on-chain, then debit balance. Or use two-phase: PENDING withdrawal → transfer → confirm debit.
```

```
PHASE: 2
FILE: backend/src/models/Balance.ts
FUNCTION: debitAvailable()
ISSUE: If bal.save() fails after in-memory modification, function may return success despite balance not being persisted. Caller assumes balance was reserved.
SEVERITY: High
FIX: Wrap in try-catch, return false on save failure. Or use MongoDB atomic $inc operators.
```

### Medium Issues

```
PHASE: 2
FILE: backend/src/services/SettlementService.ts
FUNCTION: enterOption()
ISSUE: No explicit gas estimation for Arbitrum L2 gas model. Transactions may fail silently with incorrect gas limits.
SEVERITY: Medium
FIX: Estimate gas before calling enterOption(). Apply 1.2x buffer. Catch reverts and retry with higher gas.
```

```
PHASE: 2
FILE: backend/src/services/ClaimService.ts
FUNCTION: processResolvedMarket()
ISSUE: If pool.claim() fails with a non-"AlreadyClaimed" error, function returns silently without retry or severity logging.
SEVERITY: Medium
FIX: Distinguish expected vs. unexpected errors. Queue unexpected failures for retry in next sync cycle.
```

```
PHASE: 2
FILE: backend/src/routes/orders.ts
FUNCTION: POST /orders
ISSUE: Signature verification error handling may be loose. Malformed signatures could potentially bypass verification depending on catch block behavior.
SEVERITY: Medium
FIX: Verify SignatureService.verifyOrderSignature() explicitly returns false (not throws) on invalid signatures. Add explicit catch for malformed input.
```

### Low Issues

```
PHASE: 2
FILE: backend/src/ws/WebSocketServer.ts
FUNCTION: constructor / broadcast()
ISSUE: No connection limit. Rapid reconnect cycles could leave stale ClientState objects if GC doesn't clean up fast enough.
SEVERITY: Low
FIX: Limit concurrent connections. Track connection time. Disconnect idle clients after timeout.
```

```
PHASE: 2
FILE: backend/src/engine/MatchingEngine.ts
FUNCTION: submitCancel()
ISSUE: No validation that orderId exists or belongs to caller. Non-existent order cancel requests are silently ignored.
SEVERITY: Low
FIX: Verify order exists and caller is the maker before adding to pendingCancels.
```

```
PHASE: 2
FILE: backend/src/models/Balance.ts
FUNCTION: creditBalance()
ISSUE: Non-atomic compound update — two fields modified then saved. If logic error occurs between them, state is inconsistent.
SEVERITY: Low
FIX: Use MongoDB atomic $inc operators in a single updateOne call.
```

```
PHASE: 2
FILE: backend/src/services/MarketSyncer.ts
FUNCTION: checkResolution()
ISSUE: Catch block logs "Pool may not be in a state to check yet" for ALL errors, hiding real failures (RPC down, ABI mismatch).
SEVERITY: Low
FIX: Distinguish expected vs. unexpected errors. Log unexpected errors at WARN level.
```

### Design Issue (Informational)

```
PHASE: 2
FILE: backend/src/config (fee configuration)
FUNCTION: N/A
ISSUE: Fee values in config total ~1.5% (platformFeeBps=70, makerFeeBps=80). Spec requires 3.6% total (2.5% RAIN burn + 1% LP/maker + 0.1% resolver). Implementation is missing ~2.1% of fees. No resolver fee is collected anywhere.
SEVERITY: High
FIX: Update config: platformFeeBps=250 (2.5% RAIN burn), makerFeeBps=100 (1.0% LP/maker), add resolverFeeBps=10 (0.1% resolver). Total = 360 bps = 3.6%.
```

### Test Coverage Gaps (Phase 2)

```
PHASE: 2
FILE: (missing) backend/src/services/ClaimService.test.ts
ISSUE: ClaimService has ZERO tests. Rounding/dust, idempotency, double-claim, and missing-position scenarios are all untested.
SEVERITY: Critical
FIX: Create ClaimService.test.ts covering: rounding/dust, idempotency, missing positions, unfinalized pool guard.
```

```
PHASE: 2
FILE: (missing) backend/src/services/SettlementService.test.ts
ISSUE: SettlementService has ZERO tests. Retry logic, double-settlement prevention, and revert handling are all untested.
SEVERITY: Critical
FIX: Create SettlementService.test.ts covering: RPC failure retry, double-settlement, trade status transitions, gas estimation.
```

```
PHASE: 2
FILE: (missing) backend/src/services/DepositService.test.ts
ISSUE: DepositService has ZERO tests. Duplicate events, reorgs, confirmation depth, and token verification are all untested.
SEVERITY: Critical
FIX: Create DepositService.test.ts covering: duplicate txHash, reorg rollback, confirmation depth, wrong token address.
```

```
PHASE: 2
FILE: backend/src/engine/MatchingEngine.test.ts
ISSUE: Missing tests for: partial fill price-time priority preservation, self-trade prevention, concurrent order placement race condition, expired resting orders.
SEVERITY: High
FIX: Add test cases for each of these four scenarios.
```

---

## Top Priority Fixes

1. **Phase 1 — Wrong timeframes** (Critical): 5/15/60 must be 5/10/15. Fundamental spec violation.
2. **Phase 1 — chooseWinner revert orphans market** (Critical): Funds locked if dispute occurs.
3. **Phase 2 — Balance race condition** (Critical): Double-spend possible on concurrent orders.
4. **Phase 2 — ClaimService dust + idempotency** (Critical): Funds lost or double-paid.
5. **Phase 2 — DepositService duplicate events** (Critical): Phantom balances on RPC reconnect.
6. **Phase 2 — Fee misconfiguration** (High): Collecting 1.5% instead of 3.6%. Revenue loss.
7. **Phase 2 — Withdrawal atomicity** (High): User balance lost if transfer fails.
8. **Phase 2 — Three services with zero tests** (Critical): ClaimService, SettlementService, DepositService.
