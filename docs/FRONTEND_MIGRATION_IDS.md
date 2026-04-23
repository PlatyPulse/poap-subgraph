# Frontend Migration: Entity ID Scheme Change

**Status:** Required change for any subgraph redeployed at or after the YieldBasis ETH (mainnet) deployment.

**Applies to:** All 40Acres subgraphs (Aerodrome, Velodrome, Supernova, Blackhole, Pharaoh, YieldBasis ETH). Existing already-synced subgraphs keep their old IDs until they're re-indexed on a new version.

---

## Why this changed

Several entities were keyed as `tokenId-epoch`. On veNFT chains this is unique because `tokenId` is globally unique. On ERC20-based deployments (YieldBasis ETH, future Pharaoh/Supernova-style), the portfolio contract emits events with `tokenId = 0` as a placeholder — which caused every user's epoch-level activity (repayments, fees, rewards, etc.) to collide into the same row across the entire subgraph.

The fix: prefix the composite ID with the **portfolio address**. It stays unique on veNFT chains and becomes correctly disambiguated on ERC20 chains.

---

## ID format: before → after

| Entity | Before | After |
|---|---|---|
| `ActivityHistoryItem` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `LoanPaid` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `GasReclamationPaid` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `ProtocolFeePaid` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `ZeroBalanceFeePaid` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `LenderPremiumPaid` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `RewardsProcessed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `PaidToRecipient` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `InvestedToVault` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `ZeroBalanceRewardsProcessed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `CollateralIncreased` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `DebtPaid` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `TransferFailed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `ActiveBalanceRewardsProcessed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `SwapFailed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `InvestToVaultFailed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `IncreaseCollateralFailed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `RebaseClaimed` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |
| `Vote` | `{tokenId}-{epoch}` | `{portfolio}-{tokenId}-{epoch}` |

- `{portfolio}` is the **lowercase** portfolio address (e.g. `0xabc123...`), matching `Portfolio.id` in the schema.
- `{tokenId}` is the decimal string form of the `BigInt` token id (`"0"` on ERC20 chains like YieldBasis ETH).
- `{epoch}` is the Thursday 00:00 UTC unix timestamp as a decimal string.

---

## Unchanged IDs (for reference)

These entities already include a disambiguator and were NOT modified:

| Entity | ID |
|---|---|
| `Portfolio` | `{portfolio_address}` |
| `Account` | `{user_address}` |
| `Setting` | `{portfolio_id}` |
| `RewardOption` | `{portfolio_id}` |
| `Facet` | `{portfolio_id}-{facet_address}` |
| `LockCreated` | `{tokenId}-{block}-{logIndex}` |
| `LockIncreased` | `{tokenId}-{block}-{logIndex}` |
| `LockMerge` | `{toTokenId}-{block}-{logIndex}` |
| `CollateralEvent` | `{portfolio}-{tokenId}-{block}-{logIndex}` |
| `Listing` | `{portfolio}-{tokenId}` |
| `ListingHistory` | `{portfolio}-{tokenId}-{timestamp}` |
| `Purchase` | `{portfolio}-{tokenId}-{purchaseIndex}` |
| `SaleProceeded` | unchanged |
| `UserAsset` | `{tokenId}` (veNFT chains) **or** `{portfolio_address}` (ERC20 chains, via `handlePharaohTransfer`) |
| `ManualRepayment` | `{portfolio}-{paymentIndex}` |

---

## Query examples

### Before

```graphql
{
  loanPaid(id: "12345-1710979200") {
    portfolio { id }
    amount
  }
}
```

### After

```graphql
{
  loanPaid(id: "0xabc123abc123abc123abc123abc123abc123abcd-12345-1710979200") {
    portfolio { id }
    amount
  }
}
```

### Listing a user's activity (unchanged — filter by field, not id)

This style of query was always preferred and is unaffected:

```graphql
{
  portfolio(id: "0xabc123...") {
    loanPaids(orderBy: createdAt, orderDirection: desc) {
      id
      epoch
      amount
    }
  }
}
```

If you were filtering by `epoch` field (not id), no change needed.

---

## Frontend migration checklist

Search your frontend for:

- [ ] String concatenation of the form `` `${tokenId}-${epoch}` `` used to build entity IDs → change to `` `${portfolioAddress}-${tokenId}-${epoch}` ``
- [ ] Direct entity lookups by id (`loanPaid(id: "...")`, `rewardsProcessed(id: "...")`, etc.) on any of the 19 entities listed above
- [ ] Parsing code that splits an id on `"-"` and assumes two parts → now three parts
- [ ] Caching layers / IndexedDB keys that store these IDs → invalidate them on deploy
- [ ] Subgraph snapshot / fixture files used in tests → regenerate after redeploy

Queries that **only use field filters** (`where: { epoch: ..., portfolio: ... }`) are unaffected and the recommended pattern going forward.

---

## Cross-asset subgraph scoping (no frontend change required)

Multiple subgraphs can share a PortfolioFactory on the same chain (e.g. Supernova + YieldBasis
ETH both on mainnet). Each subgraph now filters `PortfolioRegistered` events by an allowlist of
sub-factory addresses (configured per deployment in `config/<name>.json` → `portfolioSubFactories`),
so each subgraph only indexes portfolios belonging to its asset family.

**Frontend impact:** none — no schema change, no ID change, no query change. Data content is now
correctly scoped: queries that previously returned a mix of Supernova and YieldBasis portfolios
will now return only the portfolios belonging to the subgraph being queried.

---

## YieldBasis ETH subgraph notes

- Network: Ethereum mainnet
- PortfolioFactory: `0x40Ac2e40ACb7bdD6EC83E468143262fe216529ec`
- YieldBasis ETH token (ERC20): `0x01791F726B4103694969820be083196cC7c045fF`
- startBlock: `24938546`
- No marketplace — `Listing`, `ListingHistory`, `Purchase`, `SaleProceeded` entities will not be populated on this subgraph.
- `tokenId` in all events will be `"0"` — always scope queries by `portfolio` id to get per-user data.
- `UserAsset` on this subgraph is keyed by portfolio address (via `handlePharaohTransfer`), not by token id.
