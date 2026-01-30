# 40 Acres Portfolio Factory Subgraph

A comprehensive indexer for the 40 Acres DeFi protocol, built on The Graph protocol with Goldsky deployment support.

---

## Overview

This subgraph indexes the **40 Acres Portfolio Factory** protocol - a DeFi system using the diamond proxy pattern with multiple facets to manage user portfolios. The protocol supports complex financial operations including:

- Lending and borrowing
- Collateral management (veNFT-based)
- Voting escrow (ve-tokenomics)
- NFT marketplace for portfolios
- Automated rewards processing

### Supported Networks

| Network | DEX | Factory Address | Start Block | Status |
|---------|-----|-----------------|-------------|--------|
| Base | Aerodrome | `0x427D890e5794A8B3AB3b9aEe0B3481F5CBCc09C5` | 39883672 | Active |
| Optimism | Velodrome | TBD | TBD | Placeholder |
| Avalanche | Blackhole | TBD | TBD | Placeholder |

---

## Schema Entities

### Core Entities

#### Portfolio
Represents a user's portfolio contract instance.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Portfolio contract address |
| owner | Account | Owner of the portfolio |
| createdAt | BigInt | Creation timestamp |
| currentLoanAmount | BigInt | Current outstanding loan |
| totalBorrowed | BigInt | Lifetime borrowed amount |
| totalRepaid | BigInt | Lifetime repaid amount |

#### Account
Represents user addresses.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | User address |
| portfolios | [Portfolio] | Derived: all portfolios owned |

#### Facet
Tracks facets added to portfolio contracts (diamond proxy pattern).

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| facet | Bytes | Facet contract address |
| selectors | [Bytes] | Function selectors |
| timestamp | BigInt | When added |
| transactionHash | Bytes | Transaction hash |

#### Setting
Portfolio configuration settings.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Portfolio address |
| portfolio | Portfolio | Parent portfolio |
| rewardOption | RewardOption | Selected reward option |
| topUpEnabled | Boolean | Auto top-up status |

---

### Voting Escrow Entities

#### LockCreated
Records when a user creates a new voting escrow NFT lock.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| tokenId | BigInt | veNFT token ID |
| value | BigInt | Locked amount |
| locktime | BigInt | Lock end timestamp |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### LockIncreased
Records when a user increases their lock amount.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| tokenId | BigInt | veNFT token ID |
| value | BigInt | Additional amount locked |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### LockMerge
Records when two locks are merged together.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| fromTokenId | BigInt | Source token ID |
| toTokenId | BigInt | Destination token ID |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### Vote
Stores voting data for gauge/pool voting.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Voting epoch |
| pools | [Bytes] | Pool addresses voted on |
| weights | [BigInt] | Vote weights per pool |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### UserAsset
Tracks user assets, primarily veNFTs.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Token ID |
| portfolio | Portfolio | Parent portfolio |
| assetType | String | Asset type (e.g., "veNFT") |
| amount | BigInt | Current balance |
| timestamp | BigInt | Last update timestamp |

---

### Lending Entities

#### Borrow
Records borrowing events.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| amount | BigInt | Borrowed amount |
| fee | BigInt | Borrowing fee |
| recipient | Bytes | Optional: specific recipient |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### TopUp
Records top-up borrowing events.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| amount | BigInt | Top-up amount |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### ManualRepayment
Records manual loan repayments.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| amount | BigInt | Repaid amount |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

---

### Collateral Entities

#### CollateralEvent
Tracks collateral additions and removals.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| tokenId | BigInt | veNFT token ID |
| eventType | String | "Added" or "Removed" |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

---

### Marketplace Entities

#### Listing
Portfolio NFT listings.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Listed portfolio |
| price | BigInt | Listing price |
| paymentToken | Bytes | Payment token address |
| debtAttached | BigInt | Debt transferred with sale |
| expiration | BigInt | Listing expiration timestamp |
| status | String | "Active", "Cancelled", or "Sold" |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### Purchase
Purchase transactions of listed portfolios.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| listing | Listing | Related listing |
| buyer | Bytes | Buyer address |
| price | BigInt | Purchase price |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

#### DebtTransfer
Transfers of debt between parties.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| from | Bytes | Debt origin |
| to | Bytes | Debt destination |
| amount | BigInt | Debt amount transferred |
| timestamp | BigInt | Event timestamp |
| transactionHash | Bytes | Transaction hash |

---

### Rewards Processing Entities

All reward entities use epoch-based aggregation with array storage for multi-asset support.

#### RewardOption
Configuration for reward distribution options.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Unique identifier |
| portfolio | Portfolio | Parent portfolio |
| option | BigInt | Option identifier |
| percentage | BigInt | Distribution percentage |

#### LoanPaid
Automatic loan repayments per epoch.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Repayment amounts per asset |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### GasReclamationPaid
Gas refund distributions.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Refund amounts |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### ProtocolFeePaid
Protocol fee distributions.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Fee amounts |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### ZeroBalanceFeePaid
Zero balance fees paid.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Fee amounts |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### LenderPremiumPaid
Premium payments to lenders.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Premium amounts |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### RewardsProcessed
Processed rewards distribution.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Reward amounts |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### PaidToRecipient
Payments made to designated recipients.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Payment amounts |
| assets | [Bytes] | Asset addresses |
| recipients | [Bytes] | Recipient addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### InvestedToVault
Investments to vault contracts.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Investment amounts |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

#### ZeroBalanceRewardsProcessed
Rewards for zero-balance positions.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | portfolio-epoch composite |
| portfolio | Portfolio | Parent portfolio |
| epoch | BigInt | Reward epoch |
| amounts | [BigInt] | Reward amounts |
| assets | [Bytes] | Asset addresses |
| timestamps | [BigInt] | Event timestamps |
| transactionHashes | [Bytes] | Transaction hashes |

---

### Analytics Entity

#### Stats
Aggregated statistics per epoch.

| Field | Type | Description |
|-------|------|-------------|
| id | ID | Epoch identifier |
| epoch | BigInt | Epoch number |
| totalBorrowed | BigInt | Total borrowed this epoch |
| totalRepaid | BigInt | Total repaid this epoch |
| totalFees | BigInt | Total fees this epoch |
| transactionCount | BigInt | Number of transactions |

---

## Event Handlers

### veNFT Transfer Handlers (`src/veNFTTransfer.ts`)

For Aerodrome, Velodrome, and Blackhole (NFT-based veNFT):

| Event | Handler | Description |
|-------|---------|-------------|
| Transfer(indexed address, indexed address, indexed uint256) | `handleVeNFTTransfer` | Tracks veNFT transfers to/from portfolios; updates UserAsset entities |

### Pharaoh Transfer Handlers (`src/pharaohTransfer.ts`)

For Pharaoh (ERC20-based veNFT):

| Event | Handler | Description |
|-------|---------|-------------|
| Transfer(indexed address, indexed address, uint256) | `handlePharaohTransfer` | Tracks ERC20 veNFT transfers to/from portfolios; updates UserAsset entities |

### Factory Handlers (`src/factory.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| PortfolioRegistered | `handlePortfolioRegistered` | Creates Portfolio and Account entities; spawns dynamic template for portfolio tracking |

### Portfolio Base Handlers (`src/portfolio.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| FacetAdded | `handleFacetAdded` | Tracks facets added to portfolio diamond proxy |

### Voting Escrow Handlers (`src/votingEscrowFacet.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| LockCreated | `handleLockCreated` | Creates LockCreated and UserAsset entities |
| LockIncreased | `handleLockIncreased` | Updates lock amounts and UserAsset |
| LockMerged | `handleLockMerged` | Merges locks and updates UserAsset |

### Voting Handlers (`src/votingFacet.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| Voted | `handleVoted` | Creates Vote entity with pools and weights |
| VotingModeSet | `handleVotingModeSet` | Placeholder for future use |

### Lending Handlers (`src/lendingFacet.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| Borrowed | `handleBorrowed` | Records borrows, updates portfolio loan tracking |
| BorrowedTo | `handleBorrowedTo` | Records borrows with specific recipient |
| Paid | `handlePaid` | Records manual repayments, updates totals |
| TopUpSet | `handleTopUpSet` | Placeholder for configuration |
| ToppedUp | `handleToppedUp` | Records top-up borrows |

### Collateral Handlers (`src/collateralFacet.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| CollateralAdded | `handleCollateralAdded` | Creates CollateralEvent and UserAsset; queries veNFT balance |
| CollateralRemoved | `handleCollateralRemoved` | Creates CollateralEvent, removes UserAsset |

### Marketplace Handlers (`src/marketplaceFacet.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| ListingCreated | `handleListingCreated` | Creates Listing with "Active" status |
| ListingCancelled | `handleListingCancelled` | Updates listing to "Cancelled" |
| PurchaseFinalized | `handlePurchaseFinalized` | Creates Purchase, marks Listing "Sold" |
| DebtTransferredToBuyer | `handleDebtTransferredToBuyer` | Records debt transfer |
| MarketplaceListingBought | `handleMarketplaceListingBought` | Creates Purchase for direct buys |

### Rewards Processing Handlers (`src/rewardsProcessingFacet.ts`)

| Event | Handler | Description |
|-------|---------|-------------|
| RewardsOptionSet | `handleRewardsOptionSet` | Creates/updates RewardOption |
| RewardsOptionPercentageSet | `handleRewardsOptionPercentageSet` | Updates reward percentages |
| LoanPaid | `handleLoanPaid` | Aggregates loan payments per epoch |
| GasReclamationPaid | `handleGasReclamationPaid` | Aggregates gas refunds |
| ProtocolFeePaid | `handleProtocolFeePaid` | Aggregates protocol fees |
| ZeroBalanceFeePaid | `handleZeroBalanceFeePaid` | Aggregates zero-balance fees |
| LenderPremiumPaid | `handleLenderPremiumPaid` | Aggregates lender premiums |
| RewardsProcessed | `handleRewardsProcessed` | Aggregates reward distributions |
| PaidToRecipient | `handlePaidToRecipientEntity` | Aggregates recipient payments |
| InvestedToVault | `handleInvestedToVaultEntity` | Aggregates vault investments |
| ZeroBalanceRewardsProcessed | `handleZeroBalanceRewardsProcessedEntity` | Aggregates zero-balance rewards |

---

## ABIs

| ABI File | Contract | Purpose |
|----------|----------|---------|
| `PortfolioFactory.json` | PortfolioFactory | Factory contract - portfolio creation |
| `Portfolio.json` | Portfolio (Diamond) | Main portfolio contract with all facet events |
| `VotingEscrowFacet.json` | VotingEscrowFacet | veNFT lock operations |
| `VotingFacet.json` | VotingFacet | Gauge/pool voting |
| `LendingFacet.json` | LendingFacet | Borrow/repay operations |
| `CollateralFacet.json` | CollateralFacet | Collateral management |
| `MarketplaceFacet.json` | MarketplaceFacet | Portfolio marketplace |
| `RewardsProcessingFacet.json` | RewardsProcessingFacet | Automated rewards distribution |
| `VotingEscrow.json` | External veNFT | External contract for balance queries |
| `VotingEscrowTransfer.json` | veNFT Transfer | NFT Transfer event + balanceOfNFTAt (Aero/Velo/Black) |
| `PharaohVotingEscrow.json` | Pharaoh veNFT | ERC20 Transfer event + balanceOf (Pharaoh) |

---

## Utility Functions (`src/utils.ts`)

| Function | Description |
|----------|-------------|
| `getOrCreateAccount(address)` | Lazy-loads or creates Account entity |
| `getPortfolio(address)` | Loads Portfolio by address |
| `getVeNFTAddress()` | Returns network-specific veNFT contract address |

### veNFT Contract Addresses

| Network | DEX | Address |
|---------|-----|---------|
| Base | Aerodrome | `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4` |
| Optimism | Velodrome | `0xFAf8FD17D9840595845582fCB047DF13f006787d` |
| Avalanche | Blackhole | `0xEac562811cc6abDbB2c9EE88719eCA4eE79Ad763` |

---

## Architecture Patterns

### Dynamic Contract Instantiation
When a Portfolio is registered via the factory, a template instance is created to track all future events from that portfolio contract. This allows indexing an arbitrary number of portfolios.

### Diamond Proxy Pattern
The protocol uses the diamond proxy pattern where multiple facets (VotingEscrow, Voting, Lending, Collateral, Marketplace, RewardsProcessing) are attached to a single Portfolio contract. The subgraph tracks facet additions and handles events from all facets.

### Array-Based Multi-Asset Tracking
Rewards-related entities store amounts and assets as parallel arrays, enabling flexible multi-asset tracking within a single epoch.

### Epoch-Based Aggregation
Many reward entities use composite IDs (`portfolio-epoch`) to aggregate related transactions, enabling historical analysis per reward epoch.

### Cross-Contract Calls
The CollateralFacet handler calls external veNFT contracts to fetch current NFT balances at event time, ensuring accurate balance tracking.

---

## Build & Deployment

### Technology Stack

- **Graph Protocol**: CLI 0.51.0, graph-ts 0.31.0
- **Language**: AssemblyScript
- **Templating**: Mustache
- **Deployment**: Goldsky

### Scripts

```bash
# Prepare network-specific subgraph.yaml
pnpm prepare:<network>    # aerodrome, velodrome, blackhole

# Generate types from schema and ABIs
pnpm codegen

# Build the subgraph
pnpm build

# Deploy to Goldsky
pnpm deploy:<network>
```

### Interactive Deployment

```bash
node deploy.js
```

The interactive CLI prompts for:
1. Network selection
2. Version number
3. Confirmation before deployment

---

## Project Structure

```
poap-subgraph/
├── abis/                          # Contract ABIs
│   ├── CollateralFacet.json
│   ├── LendingFacet.json
│   ├── MarketplaceFacet.json
│   ├── PharaohVotingEscrow.json  # Pharaoh ERC20 Transfer + balanceOf
│   ├── Portfolio.json
│   ├── PortfolioFactory.json
│   ├── RewardsProcessingFacet.json
│   ├── VotingEscrow.json
│   ├── VotingEscrowFacet.json
│   ├── VotingEscrowTransfer.json # veNFT Transfer + balanceOfNFTAt
│   └── VotingFacet.json
├── config/                        # Network configurations
│   ├── aerodrome.json            # Base network
│   ├── blackhole.json            # Avalanche network
│   ├── pharaoh.json              # Legacy
│   └── velodrome.json            # Optimism network
├── src/                          # Event handlers
│   ├── collateralFacet.ts
│   ├── factory.ts
│   ├── lendingFacet.ts
│   ├── marketplaceFacet.ts
│   ├── pharaohTransfer.ts        # Pharaoh ERC20 transfer handler
│   ├── portfolio.ts
│   ├── portfolioHandlers.ts      # Re-exports all handlers
│   ├── rewardsProcessingFacet.ts
│   ├── utils.ts
│   ├── veNFTTransfer.ts          # veNFT transfer handler (Aero/Velo/Black)
│   ├── votingEscrowFacet.ts
│   └── votingFacet.ts
├── schema.graphql                # Entity definitions
├── subgraph.template.yaml        # Subgraph manifest template
├── deploy.js                     # Interactive deployment script
└── package.json
```

---

## What This Indexer Tracks

### Portfolio Lifecycle
- Portfolio creation and registration
- Facet additions (diamond proxy updates)
- Owner tracking

### Lending Operations
- Borrow events (standard and to-recipient)
- Top-up borrows
- Manual repayments
- Automatic loan repayments (via rewards)

### Collateral Management
- veNFT collateral deposits
- veNFT collateral withdrawals
- Balance tracking via external contract calls

### Voting Escrow
- Lock creation (new veNFT positions)
- Lock increases
- Lock merges

### Voting Participation
- Gauge/pool votes with weights
- Voting mode configuration

### NFT Marketplace
- Portfolio listings (price, payment token, debt)
- Listing cancellations
- Purchases and sales
- Debt transfers between parties

### Rewards Distribution
- Epoch-based automatic loan repayments
- Gas reclamation refunds
- Protocol fee distributions
- Zero balance fees
- Lender premium payments
- General reward distributions
- Recipient-specific payments
- Vault investments
- Zero balance reward processing

### User Assets
- veNFT holdings per portfolio
- Balance tracking over time

### veNFT Transfers
The indexer listens to Transfer events on the veNFT contracts to track when tokens move in or out of 40 Acres portfolios:

**Transfer Detection Logic:**
1. On every Transfer event, check if either `from` or `to` is a registered 40 Acres portfolio
2. If neither party is a portfolio, the event is ignored (performance optimization)
3. **Transfer OUT**: If the `from` address is a portfolio, remove the UserAsset entity
4. **Transfer IN**: If the `to` address is a portfolio, create/update UserAsset with current balance

**Protocol-Specific Behavior:**

| Protocol | Event Signature | Balance Method | UserAsset ID |
|----------|-----------------|----------------|--------------|
| Aerodrome | `Transfer(indexed address, indexed address, indexed uint256)` | `balanceOfNFTAt(tokenId, timestamp)` | tokenId |
| Velodrome | `Transfer(indexed address, indexed address, indexed uint256)` | `balanceOfNFTAt(tokenId, timestamp)` | tokenId |
| Blackhole | `Transfer(indexed address, indexed address, indexed uint256)` | `balanceOfNFTAt(tokenId, timestamp)` | tokenId |
| Pharaoh | `Transfer(indexed address, indexed address, uint256)` | `balanceOf(address)` | portfolio address |

**veNFT Contract Addresses:**

| Network | Protocol | Address |
|---------|----------|---------|
| Base | Aerodrome | `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4` |
| Optimism | Velodrome | `0xFAf8FD17D9840595845582fCB047DF13f006787d` |
| Avalanche | Blackhole | `0xEac562811cc6abDbB2c9EE88719eCA4eE79Ad763` |
| Avalanche | Pharaoh | `0x26e9dbe75aed331E41272BEcE932Ff1B48926Ca9` |

---

## Complete Audit Trail

Every indexed event includes:
- Timestamp
- Transaction hash
- Portfolio reference
- Account/owner reference

This enables complete historical reconstruction of all protocol activity.
