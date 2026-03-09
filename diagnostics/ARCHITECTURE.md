# Architecture Diagnostic

## Summary

**Status: needs attention.** The overall architecture is sound — diamond-pattern contracts with a factory, dynamic templates, and separate data sources per contract type is a well-established Graph subgraph pattern. However, there are meaningful structural issues: the handler split between `marketplaceFacet.ts` and `marketplaceContract.ts` is confusingly named; `portfolioHandlers.ts` exists solely as a re-export barrel that introduces redundant "compatibility" wrapper functions; and the `UserAsset` design conflates two fundamentally different asset types (ERC-721 veNFTs and ERC-20 x33 tokens) in a single entity model that is not fully flexible for either.

---

## Findings

### A1: portfolioHandlers.ts Introduces Redundant Wrapper Functions
- **Severity**: medium
- **Location**: `src/portfolioHandlers.ts`, `src/rewardsProcessingFacet.ts:33-37, 128-143`
- **Description**: `portfolioHandlers.ts` is the entry point file declared in the manifest. It re-exports all handlers from the individual facet files — which is correct and necessary. However, `rewardsProcessingFacet.ts` exports both:
  - `handleZeroBalanceRewardsProcessed` → just delegates to `handleZeroBalanceRewardsProcessedEntity`
  - `handleInvestedToVault` → just delegates to `handleInvestedToVaultEntity`
  - `handlePaidToRecipient` → just delegates to `handlePaidToRecipientEntity`

  These wrapper functions exist "for backwards compatibility" but serve no purpose — they add indirection, create naming confusion, and are the root cause of the duplicate event registrations in the manifest (CORRECTNESS finding F1). The actual entity handler functions are the same ones; the wrappers are dead code paths except as delegation shims.
- **Recommendation**: Remove the wrapper functions and the compatibility comments. The manifest should register only the `*Entity` variants (or rename them to drop the suffix). This eliminates the manifest duplication.

---

### A2: MarketplaceFacet Naming Is Misleading
- **Severity**: medium
- **Location**: `src/marketplaceFacet.ts`, `src/marketplaceContract.ts`
- **Description**: There are two marketplace handler files:
  - `marketplaceFacet.ts` — handles `SaleProceeded` emitted by the Portfolio diamond facet
  - `marketplaceContract.ts` — handles `ListingCreated/Canceled/Purchased` from the standalone `PortfolioMarketplace` contract

  The naming is inverted from what one might expect: "Facet" file handles diamond events (correct), but "Contract" file handles the external contract events. The split is architecturally valid but discoverers (and maintainers) will be confused about which file to open for marketplace logic. `marketplaceContract.ts` is also a new file (untracked in git history) added alongside the new ABI.
- **Recommendation**: Rename `marketplaceContract.ts` to `portfolioMarketplace.ts` to match the contract name. Or add a top-level comment explaining the split.

---

### A3: UserAsset Entity Models Two Different Asset Types Poorly
- **Severity**: medium
- **Location**: `schema.graphql:339-348`, `src/pharaohTransfer.ts`, `src/veNFTTransfer.ts`, `src/collateralFacet.ts`
- **Description**: `UserAsset` uses a discriminator string `type: String! # "veNFT" or "x33"` to model two fundamentally different things:
  - **veNFT**: ERC-721 token with `tokenId` as entity ID; tracked per-token
  - **x33 (Pharaoh)**: ERC-20 token with `portfolioAddress` as entity ID; tracked per-portfolio

  This ID collision risk is real: a `tokenId` could theoretically match a portfolio address (both are hex strings). Additionally, `isCollateral` is only meaningful for veNFTs (Pharaoh tokens are not collateralized in the same way), and `votes` is only meaningful for veNFTs. The `isManual` field is never set to `true` anywhere in the codebase — it's dead schema.
- **Recommendation**: Split into `VeNFTAsset` and `X33Asset` entity types, each tailored to their specific fields. At minimum, document the ID space collision risk.

---

### A4: Global Stats and EpochStats Have Inconsistent Save Patterns
- **Severity**: medium
- **Location**: Multiple handlers
- **Description**: The `getOrCreateGlobalStats` and `getOrCreateEpochStats` functions return unsaved entities. Every caller is responsible for calling `.save()`. In some handlers (e.g. `handleRewardsProcessed`), the stats are fetched, `lastUpdatedAt` is set, and saved — even though no actual stat values changed. This "touch on every event" pattern bloats writes without adding information. In other handlers, epoch stats are updated but `epochStats.save()` is not called (e.g. missing in some token stat update paths).
- **Recommendation**: Audit all save call sites. Consider a convention of saving all modified entities in a single terminal block per handler.

---

### A5: specVersion 0.0.2 Is Outdated
- **Severity**: low
- **Location**: `subgraph.template.yaml:1`
- **Description**: `specVersion: 0.0.2` is used; the current stable spec version is `1.0.0` (or `0.0.6`+). Newer versions unlock features like `graph-node` 0.30+ improvements, better IPFS, and `@graphprotocol/graph-ts` 0.31 compatibility improvements.
- **Recommendation**: Upgrade to `specVersion: 0.0.6` at minimum. Review the changelog for any breaking changes.

---

### A6: apiVersion 0.0.5 May Limit Available Features
- **Severity**: low
- **Location**: `subgraph.template.yaml` (multiple data sources)
- **Description**: `apiVersion: 0.0.5` is used across all data sources. Version 0.0.6 introduced `ethereum.call` improvements and better error handling for reverted calls.
- **Recommendation**: Upgrade to `apiVersion: 0.0.7` to benefit from the latest call handling.

---

### A7: Template Entities List References Non-Existent Schema Types
- **Severity**: low
- **Location**: `subgraph.template.yaml:119-137`
- **Description**: The Portfolio template `entities` list references `VotingMode`, `Payment`, and `TopUpConfig` — none of which exist in `schema.graphql`. The `entities` field in the manifest is informational for The Graph's tooling but having ghost references is a maintenance smell that suggests the schema and manifest have diverged.
- **Recommendation**: Remove `VotingMode`, `Payment`, and `TopUpConfig` from the entities list, and audit for any other stale references.

---

## Statistics
- Files analyzed: 12 source files, 1 schema, 1 manifest template
- Issues found: 7 (critical: 0, high: 0, medium: 4, low: 3)
