# Completeness Diagnostic

## Summary

**Status: needs attention.** Several schema entities are defined but effectively non-functional: `UserAsset.votes` is always empty (see CORRECTNESS F2), `UserAsset.isManual` is never set to `true` anywhere, and `SaleProceeded` events from the marketplace contract don't update global stats. The `ManualRepayment` schema comment says `portfolio-{paymentIndex}` but the actual ID is `address-blockNumber-logIndex`. The `pharaoh.json` config is a stub with zero addresses that will never produce useful data. Some stats fields in `GlobalStats` and `EpochStats` have no corresponding update paths for certain scenarios.

---

## Findings

### CP1: UserAsset.isManual Never Set to True
- **Severity**: high
- **Location**: `schema.graphql:346`, all UserAsset creation sites
- **Description**: The `isManual: Boolean!` field exists on `UserAsset` (schema line 346) with an implied purpose of distinguishing manually-managed assets. Every creation site in the codebase sets `userAsset.isManual = false`:
  - `src/collateralFacet.ts:44`
  - `src/veNFTTransfer.ts:68`
  - `src/pharaohTransfer.ts:79`
  - `src/votingFacet.ts:26`
  - `src/votingEscrowFacet.ts:37, 67`

  No code path ever sets it to `true`. If this is intentional dead schema for future use, it should be documented. If it was meant to track a specific condition, that logic is missing.
- **Recommendation**: Either implement the `isManual` logic (what makes an asset "manual"?), or remove the field from the schema and all initialization sites.

---

### CP2: SaleProceeded Handler Does Not Update GlobalStats
- **Severity**: high
- **Location**: `src/marketplaceFacet.ts:8-29`
- **Description**: `handleSaleProceeded` creates a `SaleProceeded` entity but does **not** update any of `GlobalStats.totalSales`, `GlobalStats.activeListings`, `EpochStats.sales`, or token-level stats. This handler fires when the Portfolio diamond processes a sale internally (via `SaleProceeded` event). The `handleListingPurchased` in `marketplaceContract.ts` does update these stats, but they are emitted from different contracts. If a sale goes through the diamond but not the marketplace contract (or vice versa), stats will be incomplete.
- **Recommendation**: Audit the contract logic to determine whether `SaleProceeded` (diamond) and `ListingPurchased` (marketplace contract) are always co-emitted or mutually exclusive. If co-emitted, document which one drives stats. If independent, add stats updates to `handleSaleProceeded`.

---

### CP3: ManualRepayment Entity ID Does Not Match Schema Comment
- **Severity**: medium
- **Location**: `schema.graphql:59`, `src/lendingFacet.ts:124-128`
- **Description**: Schema comment says `id: ID! # portfolio-{paymentIndex}`. Actual handler generates `address-blockNumber-logIndex`. The comment is stale and the ID scheme changed without updating documentation.
- **Recommendation**: Update the schema comment to reflect the actual ID format.

---

### CP4: Pharaoh Config Is a Non-Functional Stub
- **Severity**: medium
- **Location**: `config/pharaoh.json`
- **Description**: All critical addresses are `0x000...000` and `startBlock: 0`. The `veNFTAddress` is `0x26e9dbe75aed331E41272BEcE932Ff1B48926Ca9` (set), but factory and marketplace are zero. If deployed, the pharaoh subgraph would:
  - Index from block 0 (entire chain history)
  - Never register any portfolios (zero factory address)
  - Never process marketplace events (zero marketplace address)
  This is a deployment risk.
- **Recommendation**: Fill in real addresses or add a deploy-time guard that prevents deploying a config with zero addresses.

---

### CP5: GlobalStats Has No Mechanism to Track Total Borrow Volume
- **Severity**: medium
- **Location**: `schema.graphql:352-370`
- **Description**: `GlobalStats` tracks `totalListings`, `totalSales`, `totalVeNftDeposited`, etc. but total borrow volume is **only** available in `GlobalTokenStats` (per-token). There is no aggregate `totalBorrowed` at the global level. While the token-level stats are more precise, a simple sum query requires fetching all `GlobalTokenStats` entities and summing client-side.
- **Recommendation**: Add `totalBorrowed: BigInt!` and `totalRepaid: BigInt!` to `GlobalStats` for quick aggregate queries.

---

### CP6: EpochTokenStats Lacks a Direct Link to Epoch Number
- **Severity**: low
- **Location**: `schema.graphql:406-416`
- **Description**: `EpochTokenStats` has a reference to `epochStats: EpochStats!` which contains the epoch timestamp, but `EpochTokenStats` itself has no `epoch: BigInt!` field for direct querying. Querying token stats for a specific epoch requires joining through `epochStats`.
- **Recommendation**: Add `epoch: BigInt!` directly to `EpochTokenStats` for query convenience.

---

### CP7: Votes Array on UserAsset Never Populated (Cross-reference CORRECTNESS F2)
- **Severity**: high
- **Location**: `schema.graphql:344`, `src/votingFacet.ts`
- **Description**: Already documented in CORRECTNESS F2. `UserAsset.votes` is always `[]`. The entire vote history for an asset is inaccessible via the `userAsset { votes }` query path.
- **Recommendation**: See CORRECTNESS F2. Fix: use `@derivedFrom(field: "userAsset")`.

---

### CP8: No Handler for veNFT Balance Updates Outside Transfers
- **Severity**: low
- **Location**: `src/collateralFacet.ts`, `src/veNFTTransfer.ts`
- **Description**: veNFT balances decay over time (voting escrow mechanics). The `UserAsset.amount` is only updated at: CollateralAdded, CollateralRemoved, and veNFT Transfer events. Between transfers, the stored amount drifts from the real on-chain balance. Any query of `userAsset.amount` is a snapshot, not the current value.
- **Recommendation**: This is a known subgraph limitation (no time-based handlers). Document this constraint clearly in the schema or README: `amount` represents the balance at last event, not current balance.

---

## Statistics
- Files analyzed: 12 source files, 1 schema, 4 configs
- Issues found: 8 (critical: 0, high: 3, medium: 3, low: 2)
