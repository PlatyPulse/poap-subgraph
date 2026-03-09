# Consistency Diagnostic

## Summary

**Status: needs attention.** There are recurring inconsistencies across the codebase: Setting entity initialization is copy-pasted in four separate handlers with slight variations; schema field naming mixes conventions (PascalCase and camelCase); stale prepare scripts in `package.json` reference networks with no config files; and the epoch concept is used differently in `Vote` entities vs. all other entities.

---

## Findings

### C1: Setting Entity Initialization Copy-Pasted Across Four Handlers
- **Severity**: medium
- **Location**: `src/lendingFacet.ts:180-202`, `src/votingFacet.ts:53-78`, `src/rewardsProcessingFacet.ts:57-83`, `src/rewardsProcessingFacet.ts:99-126`
- **Description**: The pattern of creating a `Setting` entity (if it doesn't exist) and ensuring a default `RewardOption` exists is duplicated verbatim in `handleTopUpSet`, `handleVotingModeSet`, `handleRewardsTokenSet`, and `handleRecipientSet`. The copies are nearly identical but have minor variations — `handleRewardsTokenSet` and `handleRecipientSet` initialize `rewardOptionId` inline; `handleTopUpSet` and `handleVotingModeSet` use the same `rewardOptionId` pattern. Any future change to Setting initialization must be made in all four places.
- **Recommendation**: Extract a `getOrCreateSetting(portfolioId, timestamp, txHash)` helper in `utils.ts` that handles both Setting and RewardOption initialization, analogous to `getOrCreateGlobalStats`.

---

### C2: Schema Field Naming Is Inconsistent (PascalCase vs camelCase)
- **Severity**: medium
- **Location**: `schema.graphql:42-46`
- **Description**: The `Setting` entity mixes naming conventions:
  - `RewardsOption: RewardOption!` — PascalCase
  - `TopUpEnabled: Boolean!` — PascalCase
  - `IsManualVoting: Boolean!` — PascalCase
  - `rewardsToken: Bytes` — camelCase
  - `recipient: Bytes` — camelCase

  GraphQL convention is camelCase for fields. PascalCase fields also pass through to generated TypeScript types (`setting.RewardsOption`, `setting.TopUpEnabled`, `setting.IsManualVoting`), which is non-idiomatic for AssemblyScript.
- **Recommendation**: Rename all Setting fields to camelCase: `rewardsOption`, `topUpEnabled`, `isManualVoting`. Update all handler references.

---

### C3: Vote.epoch Uses Block Number; All Other Epochs Use Timestamps
- **Severity**: medium
- **Location**: `src/votingFacet.ts:39`, `src/utils.ts:10-13`
- **Description**: Every other entity and the stats system uses `getEpochFromTimestamp()` (week-based Unix timestamps rounded to Thursday 00:00 UTC). `Vote` entities use `event.block.number` as the epoch. This makes it impossible to correlate Vote records with EpochStats records, and the Vote entity's comment `# tokenId-{epoch}` is misleading.
- **Recommendation**: Use `getEpochFromTimestamp(event.block.timestamp)` in `handleVoted`.

---

### C4: ID Schemes Are Inconsistent Across Event Types
- **Severity**: medium
- **Location**: Multiple handler files
- **Description**: Entity IDs use different schemes without apparent rationale:
  - `LockCreated` / `LockIncreased`: `tokenId` only (clobbers history — see CORRECTNESS F7)
  - `Borrow`, `TopUp`, `ManualRepayment`, `CollateralEvent`, `SaleProceeded` (marketplaceFacet): `address-blockNumber-logIndex`
  - `LoanPaid`, `GasReclamationPaid`, `ProtocolFeePaid`, etc.: `tokenId-epoch` (aggregation pattern)
  - `Listing`: `portfolioAddress-tokenId`
  - `Purchase`: `portfolioAddress-tokenId-blockNumber-logIndex`

  Some types use the aggregation pattern (arrays), others use unique-per-event IDs. There is no documented convention, making it hard to reason about uniqueness guarantees.
- **Recommendation**: Document the ID scheme for each entity type. For event-log entities, standardize on `address-blockNumber-logIndex`. For aggregated entities, document the aggregation key.

---

### C5: stale Package.json prepare Scripts
- **Severity**: low
- **Location**: `package.json:7-9`
- **Description**: `prepare:xdai`, `prepare:chiado`, and `prepare:goerli` reference config files (`config/xdai.json`, `config/chiado.json`, `config/goerli.json`) that do not exist in the repository. These scripts will silently fail or error if run.
- **Recommendation**: Remove stale scripts or add the missing config files.

---

### C6: deploy:* Scripts Reference Old thegraph.com Hosted Service
- **Severity**: low
- **Location**: `package.json:14-17`
- **Description**: Deploy scripts point to `https://api.thegraph.com/deploy/` — the deprecated hosted service, which was shut down in 2024. These scripts will fail.
- **Recommendation**: Update deploy targets to The Graph's decentralized network or a self-hosted node. The `deploy.js` file appears to handle this at runtime but the npm scripts are stale.

---

### C7: Velodrome/Blackhole Configs Missing marketplaceAddress
- **Severity**: low
- **Location**: `config/velodrome.json`, `config/blackhole.json`
- **Description**: The aerodrome config includes `marketplaceAddress` and `marketplaceStartBlock`. The other configs should be verified to include the same fields, since the template requires them. Missing fields in mustache rendering will silently become empty strings `""`.
- **Recommendation**: Verify all config files include all required template variables and add validation in the deploy script.

---

### C8: handleCollateralIncreased Is an Empty No-op
- **Severity**: low
- **Location**: `src/rewardsProcessingFacet.ts:134-137`
- **Description**: `handleCollateralIncreased` has an empty body with only a comment: "Can be extended in the future if needed." However, it is registered in the manifest and exported, consuming indexer resources on every `CollateralIncreased` event for nothing.
- **Recommendation**: Either implement the handler or unregister the event from the manifest to avoid wasted processing.

---

## Statistics
- Files analyzed: 12 source files, 1 schema, 4 configs, 1 package.json
- Issues found: 8 (critical: 0, high: 0, medium: 4, low: 4)
