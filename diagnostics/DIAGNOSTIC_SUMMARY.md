# Diagnostic Summary — poap-subgraph

**Date**: 2026-03-07
**Analyst**: Diagnostician (Chief)
**Codebase**: 40 Acres Official — poap-subgraph
**Workspace**: `/Users/platybou/Documents/GitHub/40-acres-official/poap-subgraph`

---

## Dimensions Analyzed

| Dimension | Status | Report |
|---|---|---|
| Correctness | CRITICAL | [CORRECTNESS.md](./CORRECTNESS.md) |
| Architecture | Needs attention | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Consistency | Needs attention | [CONSISTENCY.md](./CONSISTENCY.md) |
| Completeness | Needs attention | [COMPLETENESS.md](./COMPLETENESS.md) |
| Performance | Healthy (see notes below) | — |
| Security | Healthy (see notes below) | — |
| Dependencies | Healthy (see notes below) | — |

---

## Aggregate Severity Counts

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 10 |
| Medium | 16 |
| Low | 10 |
| **Total** | **37** |

---

## Top 5 Issues by Impact

### 1. Duplicate Event Handlers in Manifest [CRITICAL]
**File**: `subgraph.template.yaml:193-216`
`InvestedToVault` and `PaidToRecipient` are registered twice as event handlers. This will either reject at build time or silently double-process every matching event, creating duplicate entity records. Fix immediately before any deploy.

### 2. UserAsset.votes Always Empty [HIGH]
**File**: `schema.graphql:344`, `src/votingFacet.ts`
`votes: [Vote!]!` is a direct array (not `@derivedFrom`) that is never populated. Every vote recorded will be unreachable through the `userAsset { votes }` query path. All historical vote data is effectively hidden.

### 3. GlobalTokenStats.currentBorrowed Never Decremented on Automatic Repayment [HIGH]
**File**: `src/rewardsProcessingFacet.ts:145-195`
`handleLoanPaid` (automatic protocol repayment) does not decrement `currentBorrowed`. Most loan repayments occur through this event, so the stat will perpetually grow and never reflect actual outstanding debt.

### 4. Pharaoh Assets Misclassified as 'veNFT' [HIGH]
**File**: `src/pharaohTransfer.ts:87`
All Pharaoh x33 tokens are stored with `type = 'veNFT'`. This makes it impossible to distinguish asset types in queries, breaking any downstream logic that branches on `UserAsset.type`.

### 5. Purchase.buyer Set to Raw Address When Buyer Is Not a Portfolio [HIGH]
**File**: `src/marketplaceContract.ts:199`
The `Purchase.buyer` field is typed `Portfolio!` (non-nullable). If the buyer is not a registered portfolio, a raw address string is stored as the reference, creating a dangling entity link that may cause indexing failures or corrupt query results.

---

## Prioritized Action Plan

### Immediate (fix before next deploy)

1. **Remove duplicate event registrations** — `subgraph.template.yaml` lines 211–216. Remove the second `PaidToRecipient` and `InvestedToVault` blocks.

2. **Fix UserAsset.votes** — Change to `@derivedFrom(field: "userAsset")` in `schema.graphql`. Remove all `userAsset.votes = []` initializations.

3. **Fix Pharaoh type** — `src/pharaohTransfer.ts:87`: Change `'veNFT'` to `'x33'`.

4. **Fix currentBorrowed decrement in LoanPaid** — Add GlobalTokenStats.currentBorrowed decrement in `handleLoanPaid`, matching the logic in `handlePaid`.

5. **Fix Purchase.buyer schema mismatch** — Change `buyer: Portfolio!` to `buyer: Bytes!` in schema, or create stub portfolios. Update handler accordingly.

### Short-term (before next feature work)

6. **Fix isNewAsset not used** — `collateralFacet.ts:36`: Guard stats increment with `if (isNewAsset)`. Add a pre-existing `isCollateral` guard to prevent double-counting on re-collateralization.

7. **Fix LockCreated/LockIncreased ID clobbering** — Use `tokenId-blockNumber-logIndex` for both `LockCreated` and `LockIncreased` entity IDs.

8. **Fix handleLockCreated overwriting UserAsset** — Add `UserAsset.load()` check before `new UserAsset()`.

9. **Fix Vote.epoch** — Use `getEpochFromTimestamp(event.block.timestamp)` in `handleVoted`.

10. **Fix createListingHistory ignoring transactionHash param** — Use the passed `transactionHash` parameter.

### Medium-term (code quality)

11. **Extract getOrCreateSetting helper** — Eliminate the 4-way copy-paste in `lendingFacet`, `votingFacet`, and `rewardsProcessingFacet`.

12. **Remove wrapper delegation functions** — `handleZeroBalanceRewardsProcessed`, `handleInvestedToVault`, `handlePaidToRecipient` wrappers are dead code. Remove them and update the manifest.

13. **Handle handleRewardsOptionPercentageSet null case** — Create the RewardOption entity if it doesn't exist, rather than silently dropping the update.

14. **Audit and fix SaleProceeded stats** — Determine if `handleSaleProceeded` (diamond) needs to update GlobalStats, or if `handleListingPurchased` (marketplace) always covers it.

15. **Rename marketplaceContract.ts → portfolioMarketplace.ts** — Reduce naming confusion.

16. **Fix schema naming consistency** — Lowercase PascalCase Setting fields (`RewardsOption`, `TopUpEnabled`, `IsManualVoting`) to camelCase.

17. **Remove/implement isManual field** — Either implement the manual asset detection logic or remove the dead field.

18. **Fix pharaoh.json stub** — Add real addresses or add a deploy-time guard.

19. **Remove stale package.json scripts** — `xdai`, `chiado`, `goerli` prepare scripts and old thegraph.com deploy scripts.

20. **Document UserAsset.amount as snapshot** — Add schema comment noting the balance drifts between events.

---

## Dimensions: Brief Notes on Healthy Areas

**Performance**: No significant performance issues found. The use of `try_balanceOfNFTAt` for on-chain calls is correctly guarded with revert handling. The `addToAllTimeAssets` O(n) scan could be slow for portfolios with thousands of assets, but is not a concern at current scale.

**Security**: No access control issues relevant to a subgraph (read-only indexer). No secret key exposure found. On-chain data is trusted by design.

**Dependencies**: `@graphprotocol/graph-cli@0.51.0` and `@graphprotocol/graph-ts@0.31.0` are reasonably recent. No known CVEs. The `specVersion: 0.0.2` in the manifest is outdated but not a security concern.
