# Correctness Diagnostic

## Summary

**Status: CRITICAL — needs immediate attention.** The subgraph has several correctness bugs that will produce wrong data in production. The most severe are: duplicate event registrations in the manifest (will crash or double-process), a broken `UserAsset.votes` array that is never populated, incorrect Pharaoh asset type classification, and `currentBorrowed` global stats that are never decremented on loan repayment. Several entity ID schemes also allow silent data clobbering.

---

## Findings

### F1: Duplicate Event Handlers in subgraph.template.yaml
- **Severity**: critical
- **Location**: `subgraph.template.yaml:193-216`
- **Description**: `InvestedToVault` and `PaidToRecipient` are each registered **twice** as event handlers in the Portfolio template:
  - `InvestedToVault` at lines 193–194 and 213–214
  - `PaidToRecipient` at lines 197–198 and 211–212

  The Graph protocol will reject a manifest with duplicate event signatures, or — in some versions — silently process each event twice, producing duplicate entity records.
- **Recommendation**: Remove the second occurrence of each duplicate event handler registration (lines 211–216).

---

### F2: UserAsset.votes Array Never Populated
- **Severity**: high
- **Location**: `schema.graphql:344`, `src/votingFacet.ts:28-49`
- **Description**: `UserAsset.votes` is declared as a direct array (`[Vote!]!`), not a `@derivedFrom` reverse lookup. In The Graph's AssemblyScript runtime, direct entity-array fields must be manually maintained by the handler. The handler in `votingFacet.ts` creates `Vote` entities and sets `vote.userAsset = userAsset.id`, but **never pushes the vote ID into `userAsset.votes`**. The field is initialized to `[]` at creation and stays empty forever.
- **Recommendation**: Change `votes: [Vote!]!` to `votes: [Vote!]! @derivedFrom(field: "userAsset")` in `schema.graphql` and remove the manual `userAsset.votes = []` initialization lines. This makes the reverse-lookup automatic and correct.

---

### F3: Pharaoh Assets Always Typed as 'veNFT' Instead of 'x33'
- **Severity**: high
- **Location**: `src/pharaohTransfer.ts:87`
- **Description**: The schema documents `UserAsset.type` as either `"veNFT"` or `"x33"`. The Pharaoh handler comment acknowledges Pharaoh tokens are ERC20-based and different, yet sets `userAsset.type = 'veNFT'`. All Pharaoh-network assets will be misclassified, making it impossible to distinguish veNFT from x33 assets in queries.
- **Recommendation**: Set `userAsset.type = 'x33'` in `handlePharaohTransfer`.

---

### F4: currentBorrowed Not Decremented on LoanPaid
- **Severity**: high
- **Location**: `src/rewardsProcessingFacet.ts:145-195`, `src/lendingFacet.ts:118-174`
- **Description**: `handleLoanPaid` (automatic protocol repayment) correctly updates `portfolio.currentLoanAmount` and `portfolio.totalRepaid`, but **never decrements `GlobalTokenStats.currentBorrowed`**. Only the manual `handlePaid` event decrements this value. In practice, most repayments happen via `LoanPaid`, so `GlobalTokenStats.currentBorrowed` will monotonically increase and never reflect real outstanding debt.
- **Recommendation**: In `handleLoanPaid`, after updating portfolio stats, add the same `globalTokenStats.currentBorrowed` decrement logic that exists in `handlePaid`.

---

### F5: isNewAsset Flag Computed but Never Used — Stats Double-Count on Re-collateralization
- **Severity**: high
- **Location**: `src/collateralFacet.ts:36, 63-78`
- **Description**: `let isNewAsset = userAsset == null` is computed at line 36 but never referenced. The stats block at lines 63–78 unconditionally increments `totalVeNftDeposited`, `totalVeNftValue`, `currentVeNft`, and `currentVeNftValue`. If `CollateralAdded` fires for a token that already exists as a `UserAsset` (re-collateralization after removal), the counts double.
- **Recommendation**: Wrap the stats increment block in `if (isNewAsset) { ... }`.

---

### F6: Purchase.buyer Set to Raw Address When Buyer Is Not a Portfolio
- **Severity**: high
- **Location**: `src/marketplaceContract.ts:199`
- **Description**: `purchase.buyer = buyerPortfolio != null ? buyerPortfolio.id : event.params.buyer.toHex()`. The schema declares `buyer: Portfolio!` (non-nullable entity reference). When the buyer is not a registered portfolio, the code assigns a raw address string. The Graph will attempt to resolve this as a Portfolio entity ID and may fail to index or silently store a dangling reference.
- **Recommendation**: Either (a) create a stub Portfolio entity for unknown buyers, or (b) change the schema to `buyer: Bytes!` (raw address) since the buyer may not always be a portfolio.

---

### F7: LockIncreased Entity ID Overwrites on Multiple Increases
- **Severity**: high
- **Location**: `src/votingEscrowFacet.ts:17`
- **Description**: `let lockId = event.params.tokenId.toString()` — each `LockIncreased` event for the same tokenId overwrites the same entity. History of lock increases is completely lost. Same problem exists for `LockCreated` at line 52.
- **Recommendation**: Use a unique ID such as `tokenId-blockNumber-logIndex` to preserve the full history.

---

### F8: handleLockCreated Overwrites Existing UserAsset
- **Severity**: high
- **Location**: `src/votingEscrowFacet.ts:63-74`
- **Description**: `handleLockCreated` always calls `new UserAsset(userAssetId)` without checking if the entity already exists. If the token was previously transferred into the portfolio via `handleVeNFTTransfer` (creating a UserAsset), the lock creation will overwrite its `isCollateral` state, votes, and other fields.
- **Recommendation**: Use `UserAsset.load(userAssetId)` first; create only if null.

---

### F9: createListingHistory transactionHash Parameter Is Ignored
- **Severity**: medium
- **Location**: `src/marketplaceContract.ts:49-107`
- **Description**: `createListingHistory` accepts a `transactionHash: string` parameter but inside the function sets `history.transactionHash = listing.transactionHash` — using the **original listing transaction hash** instead of the current event's hash. The cancel/purchase transaction hash is silently discarded. The parameter itself is never used.
- **Recommendation**: Use the passed `transactionHash` parameter (after converting it appropriately), or remove the parameter and document that the original listing hash is intentionally used.

---

### F10: Vote.epoch Set to Block Number, Not Actual Epoch Timestamp
- **Severity**: medium
- **Location**: `src/votingFacet.ts:39`
- **Description**: `vote.epoch = event.block.number` — the `Vote` schema defines `epoch: BigInt!` with a comment `# tokenId-{epoch}`, and `EpochStats` uses week-based timestamps for epoch. Using block number here is inconsistent with the epoch concept used everywhere else.
- **Recommendation**: Use `getEpochFromTimestamp(event.block.timestamp)` for consistency with the rest of the stats system.

---

### F11: handleVeNFTTransfer Does Not Update Global Stats
- **Severity**: medium
- **Location**: `src/veNFTTransfer.ts:51-79`
- **Description**: When a veNFT transfers out of a portfolio, `store.remove('UserAsset', ...)` is called but `GlobalStats.currentVeNft` and `currentVeNftValue` are **not decremented**. These stats are only managed in `collateralFacet.ts`. If a token is deposited without ever calling `CollateralAdded` (e.g., direct transfer), the global stats will be wrong in both directions.
- **Recommendation**: Either move global stat management to the Transfer handler (which tracks all veNFT movements), or document the invariant that stats only track collateralized assets.

---

### F12: pharaoh.json Has Zero Addresses and Zero Start Block
- **Severity**: medium
- **Location**: `config/pharaoh.json`
- **Description**: Factory address and marketplace address are `0x0000000000000000000000000000000000000000`, start block is `0`. Deploying the pharaoh subgraph will index from genesis and likely emit errors on null address calls.
- **Recommendation**: Either add real addresses or add a build-time guard that rejects placeholder configs.

---

### F13: handleRewardsOptionPercentageSet Silently Fails If RewardOption Missing
- **Severity**: medium
- **Location**: `src/rewardsProcessingFacet.ts:91-97`
- **Description**: If `RewardOption` doesn't exist when `RewardsOptionPercentageSet` fires, the handler returns silently — the percentage update is lost with no error or log.
- **Recommendation**: Create the `RewardOption` entity if it doesn't exist (consistent with other handlers that lazy-create it).

---

### F14: handleCollateralAdded Doesn't Guard Against Already-Collateral Assets in Stats
- **Severity**: medium
- **Location**: `src/collateralFacet.ts:63-78`
- **Description**: Related to F5. If an asset is already `isCollateral = true` and another `CollateralAdded` event fires (e.g., contract replay or re-add), stats increment again without checking the current state.
- **Recommendation**: Guard the stats increment with `if (!userAsset.isCollateral) { ... }` before setting `isCollateral = true`.

---

## Statistics
- Files analyzed: 12 source files, 1 schema, 1 manifest template, 4 configs
- Issues found: 14 (critical: 1, high: 7, medium: 5, low: 1)
