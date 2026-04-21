// This file imports and re-exports all portfolio event handlers
// The Graph requires a single entry point file

// Portfolio events
export { handleFacetAdded } from './portfolio'

// VotingEscrowFacet events
export { handleLockIncreased, handleLockCreated, handleLockMerged } from './votingEscrowFacet'

// VotingFacet events
export { handleVoted, handleVotingModeSet } from './votingFacet'

// LendingFacet events
export {
  handleBorrowed,
  handleBorrowedTo,
  handlePaid,
  handleTopUpSet,
  handleToppedUp,
} from './lendingFacet'

// CollateralFacet events
export { handleCollateralAdded, handleCollateralRemoved } from './collateralFacet'

// MarketplaceFacet events (SaleProceeded from BaseMarketplaceFacet on diamond)
export { handleSaleProceeded } from './marketplaceFacet'

// RewardsProcessingFacet events
export {
  handleRewardsOptionSet,
  handleRewardsTokenSet,
  handleRewardsOptionPercentageSet,
  handleRecipientSet,
  handleCollateralIncreased,
  handleLoanPaid,
  handleGasReclamationPaid,
  handleProtocolFeePaid,
  handleZeroBalanceFeePaid,
  handleLenderPremiumPaid,
  handleRewardsProcessed,
  handlePaidToRecipientEntity,
  handleInvestedToVaultEntity,
  handleZeroBalanceRewardsProcessedEntity,
  handleDebtPaid,
  handleTransferFailed,
  handleActiveBalanceRewardsProcessed,
  handleSwapFailed,
  handleInvestToVaultFailed,
  handleIncreaseCollateralFailed,
} from './rewardsProcessingFacet'

// ClaimingFacet events
export { handleRebaseClaimed } from './claimingFacet'

