import {
  ZeroBalanceRewardsProcessed as ZeroBalanceRewardsProcessedEvent,
  RewardsOptionSet as RewardsOptionSetEvent,
  RewardsTokenSet as RewardsTokenSetEvent,
  RewardsOptionPercentageSet as RewardsOptionPercentageSetEvent,
  RecipientSet as RecipientSetEvent,
  InvestedToVault as InvestedToVaultEvent,
  CollateralIncreased as CollateralIncreasedEvent,
  PaidToRecipient as PaidToRecipientEvent,
  LoanPaid as LoanPaidEvent,
  GasReclamationPaid as GasReclamationPaidEvent,
  ProtocolFeePaid as ProtocolFeePaidEvent,
  ZeroBalanceFeePaid as ZeroBalanceFeePaidEvent,
  LenderPremiumPaid as LenderPremiumPaidEvent,
  RewardsProcessed as RewardsProcessedEvent,
} from '../generated/templates/Portfolio/RewardsProcessingFacet'
import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  RewardOption,
  Setting,
  LoanPaid,
  GasReclamationPaid,
  ProtocolFeePaid,
  ZeroBalanceFeePaid,
  LenderPremiumPaid,
  RewardsProcessed,
  PaidToRecipient,
  InvestedToVault,
  ZeroBalanceRewardsProcessed,
  CollateralIncreased,
} from '../generated/schema'
import { getPortfolio, getOrCreateAccount, getOrCreateGlobalStats, getOrCreateEpochStats, getOrCreateGlobalTokenStats, getOrCreateEpochTokenStats, getOrCreateSetting, getOrCreateActivityHistoryItem } from './utils'

export function handleRewardsOptionSet(event: RewardsOptionSetEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  // Create or update RewardOption entity
  let rewardOptionId = event.address.toHex()
  let rewardOption = RewardOption.load(rewardOptionId)
  if (rewardOption == null) {
    rewardOption = new RewardOption(rewardOptionId)
    rewardOption.portfolio = portfolio.id
  }
  rewardOption.option = event.params.rewardsOption
  rewardOption.percentage = BigInt.fromI32(0) // Will be set by RewardsOptionPercentageSet
  rewardOption.createdAt = event.block.timestamp
  rewardOption.transactionHash = event.transaction.hash
  rewardOption.save()
}

export function handleRewardsTokenSet(event: RewardsTokenSetEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let setting = getOrCreateSetting(event.address.toHex(), event.block.timestamp, event.transaction.hash)
  setting.rewardsToken = event.params.rewardsToken
  setting.save()
}

export function handleRewardsOptionPercentageSet(event: RewardsOptionPercentageSetEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let rewardOptionId = event.address.toHex()
  let rewardOption = RewardOption.load(rewardOptionId)
  if (rewardOption == null) {
    rewardOption = new RewardOption(rewardOptionId)
    rewardOption.portfolio = portfolio.id
    rewardOption.option = 0
    rewardOption.createdAt = event.block.timestamp
    rewardOption.transactionHash = event.transaction.hash
  }
  rewardOption.percentage = event.params.percentage
  rewardOption.save()
}

export function handleRecipientSet(event: RecipientSetEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let setting = getOrCreateSetting(event.address.toHex(), event.block.timestamp, event.transaction.hash)
  setting.recipient = event.params.recipient
  setting.save()
}

export function handleCollateralIncreased(event: CollateralIncreasedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, owner.id, event.block.timestamp)

  let collateralIncreased = CollateralIncreased.load(id)
  if (collateralIncreased == null) {
    collateralIncreased = new CollateralIncreased(id)
    collateralIncreased.activityHistoryItem = activityHistoryItem.id
    collateralIncreased.portfolio = portfolio.id
    collateralIncreased.epoch = event.params.epoch
    collateralIncreased.tokenId = event.params.tokenId
    collateralIncreased.owner = owner.id
    collateralIncreased.amount = new Array<BigInt>()
    collateralIncreased.asset = new Array<Bytes>()
    collateralIncreased.transactionHash = new Array<Bytes>()
    collateralIncreased.createdAt = event.block.timestamp
  }

  let amounts = collateralIncreased.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  collateralIncreased.amount = amounts

  let assets = collateralIncreased.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  collateralIncreased.asset = assets

  let txHashes = collateralIncreased.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  collateralIncreased.transactionHash = txHashes

  collateralIncreased.save()
}

export function handleLoanPaid(event: LoanPaidEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let user = getOrCreateAccount(event.params.user.toHex())
  
  let loanPaidId = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, user.id, event.block.timestamp)

  let loanPaid = LoanPaid.load(loanPaidId)
  if (loanPaid == null) {
    loanPaid = new LoanPaid(loanPaidId)
    loanPaid.activityHistoryItem = activityHistoryItem.id
    loanPaid.portfolio = portfolio.id
    loanPaid.epoch = event.params.epoch
    loanPaid.tokenId = event.params.tokenId
    loanPaid.user = user.id
    loanPaid.amount = new Array<BigInt>()
    loanPaid.asset = new Array<Bytes>()
    loanPaid.transactionHash = new Array<Bytes>()
    loanPaid.createdAt = event.block.timestamp
  }
  
  // Use temp variables to ensure arrays are properly initialized
  let amounts = loanPaid.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  loanPaid.amount = amounts
  
  let assets = loanPaid.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  loanPaid.asset = assets
  
  let txHashes = loanPaid.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  loanPaid.transactionHash = txHashes
  
  loanPaid.save()

  // Update portfolio and global stats for automatic repayment
  portfolio.totalRepaid = portfolio.totalRepaid.plus(event.params.amount)
  if (portfolio.currentLoanAmount.ge(event.params.amount)) {
    portfolio.currentLoanAmount = portfolio.currentLoanAmount.minus(event.params.amount)
  } else {
    portfolio.currentLoanAmount = BigInt.fromI32(0)
  }
  portfolio.save()

  // Decrement currentBorrowed in GlobalTokenStats
  let globalTokenStats = getOrCreateGlobalTokenStats(event.params.asset)
  globalTokenStats.totalRepaid = globalTokenStats.totalRepaid.plus(event.params.amount)
  if (globalTokenStats.currentBorrowed.ge(event.params.amount)) {
    globalTokenStats.currentBorrowed = globalTokenStats.currentBorrowed.minus(event.params.amount)
  } else {
    globalTokenStats.currentBorrowed = BigInt.fromI32(0)
  }
  globalTokenStats.save()

  let epochTokenStats = getOrCreateEpochTokenStats(event.block.timestamp, event.params.asset)
  epochTokenStats.repaid = epochTokenStats.repaid.plus(event.params.amount)
  epochTokenStats.save()
}

export function handleGasReclamationPaid(event: GasReclamationPaidEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let user = getOrCreateAccount(event.params.user.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, user.id, event.block.timestamp)

  let gasReclamationPaid = GasReclamationPaid.load(id)
  if (gasReclamationPaid == null) {
    gasReclamationPaid = new GasReclamationPaid(id)
    gasReclamationPaid.activityHistoryItem = activityHistoryItem.id
    gasReclamationPaid.portfolio = portfolio.id
    gasReclamationPaid.epoch = event.params.epoch
    gasReclamationPaid.tokenId = event.params.tokenId
    gasReclamationPaid.user = user.id
    gasReclamationPaid.amount = new Array<BigInt>()
    gasReclamationPaid.asset = new Array<Bytes>()
    gasReclamationPaid.transactionHash = new Array<Bytes>()
    gasReclamationPaid.createdAt = event.block.timestamp
  }
  
  let amounts = gasReclamationPaid.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  gasReclamationPaid.amount = amounts
  
  let assets = gasReclamationPaid.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  gasReclamationPaid.asset = assets
  
  let txHashes = gasReclamationPaid.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  gasReclamationPaid.transactionHash = txHashes
  
  gasReclamationPaid.save()
}

export function handleProtocolFeePaid(event: ProtocolFeePaidEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let user = getOrCreateAccount(event.params.user.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, user.id, event.block.timestamp)

  let protocolFeePaid = ProtocolFeePaid.load(id)
  if (protocolFeePaid == null) {
    protocolFeePaid = new ProtocolFeePaid(id)
    protocolFeePaid.activityHistoryItem = activityHistoryItem.id
    protocolFeePaid.portfolio = portfolio.id
    protocolFeePaid.epoch = event.params.epoch
    protocolFeePaid.tokenId = event.params.tokenId
    protocolFeePaid.user = user.id
    protocolFeePaid.amount = new Array<BigInt>()
    protocolFeePaid.asset = new Array<Bytes>()
    protocolFeePaid.transactionHash = new Array<Bytes>()
    protocolFeePaid.createdAt = event.block.timestamp
  }
  
  let amounts = protocolFeePaid.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  protocolFeePaid.amount = amounts
  
  let assets = protocolFeePaid.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  protocolFeePaid.asset = assets
  
  let txHashes = protocolFeePaid.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  protocolFeePaid.transactionHash = txHashes
  
  protocolFeePaid.save()
}

export function handleZeroBalanceFeePaid(event: ZeroBalanceFeePaidEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let user = getOrCreateAccount(event.params.user.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, user.id, event.block.timestamp)

  let zeroBalanceFeePaid = ZeroBalanceFeePaid.load(id)
  if (zeroBalanceFeePaid == null) {
    zeroBalanceFeePaid = new ZeroBalanceFeePaid(id)
    zeroBalanceFeePaid.activityHistoryItem = activityHistoryItem.id
    zeroBalanceFeePaid.portfolio = portfolio.id
    zeroBalanceFeePaid.epoch = event.params.epoch
    zeroBalanceFeePaid.tokenId = event.params.tokenId
    zeroBalanceFeePaid.user = user.id
    zeroBalanceFeePaid.amount = new Array<BigInt>()
    zeroBalanceFeePaid.asset = new Array<Bytes>()
    zeroBalanceFeePaid.transactionHash = new Array<Bytes>()
    zeroBalanceFeePaid.createdAt = event.block.timestamp
  }
  
  let amounts = zeroBalanceFeePaid.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  zeroBalanceFeePaid.amount = amounts
  
  let assets = zeroBalanceFeePaid.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  zeroBalanceFeePaid.asset = assets
  
  let txHashes = zeroBalanceFeePaid.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  zeroBalanceFeePaid.transactionHash = txHashes
  
  zeroBalanceFeePaid.save()
}

export function handleLenderPremiumPaid(event: LenderPremiumPaidEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let user = getOrCreateAccount(event.params.user.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, user.id, event.block.timestamp)

  let lenderPremiumPaid = LenderPremiumPaid.load(id)
  if (lenderPremiumPaid == null) {
    lenderPremiumPaid = new LenderPremiumPaid(id)
    lenderPremiumPaid.activityHistoryItem = activityHistoryItem.id
    lenderPremiumPaid.portfolio = portfolio.id
    lenderPremiumPaid.epoch = event.params.epoch
    lenderPremiumPaid.tokenId = event.params.tokenId
    lenderPremiumPaid.user = user.id
    lenderPremiumPaid.amount = new Array<BigInt>()
    lenderPremiumPaid.asset = new Array<Bytes>()
    lenderPremiumPaid.transactionHash = new Array<Bytes>()
    lenderPremiumPaid.createdAt = event.block.timestamp
  }
  
  let amounts = lenderPremiumPaid.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  lenderPremiumPaid.amount = amounts
  
  let assets = lenderPremiumPaid.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  lenderPremiumPaid.asset = assets
  
  let txHashes = lenderPremiumPaid.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  lenderPremiumPaid.transactionHash = txHashes
  
  lenderPremiumPaid.save()
}

export function handleRewardsProcessed(event: RewardsProcessedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let user = getOrCreateAccount(event.params.user.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, user.id, event.block.timestamp)

  let rewardsProcessed = RewardsProcessed.load(id)
  if (rewardsProcessed == null) {
    rewardsProcessed = new RewardsProcessed(id)
    rewardsProcessed.activityHistoryItem = activityHistoryItem.id
    rewardsProcessed.portfolio = portfolio.id
    rewardsProcessed.epoch = event.params.epoch
    rewardsProcessed.tokenId = event.params.tokenId
    rewardsProcessed.user = user.id
    rewardsProcessed.rewardsAmount = new Array<BigInt>()
    rewardsProcessed.asset = new Array<Bytes>()
    rewardsProcessed.transactionHash = new Array<Bytes>()
    rewardsProcessed.createdAt = event.block.timestamp
  }
  
  let rewardsAmounts = rewardsProcessed.rewardsAmount
  if (rewardsAmounts == null) {
    rewardsAmounts = new Array<BigInt>()
  }
  rewardsAmounts.push(event.params.rewardsAmount)
  rewardsProcessed.rewardsAmount = rewardsAmounts
  
  let assets = rewardsProcessed.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  rewardsProcessed.asset = assets
  
  let txHashes = rewardsProcessed.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  rewardsProcessed.transactionHash = txHashes

  rewardsProcessed.save()

  // Update global stats (counts only)
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  globalStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()

  // Update epoch stats (counts only)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)
  epochStats.lastUpdatedAt = event.block.timestamp
  epochStats.save()

  // Update token-specific stats for rewards
  let globalTokenStats = getOrCreateGlobalTokenStats(event.params.asset)
  globalTokenStats.totalRewards = globalTokenStats.totalRewards.plus(event.params.rewardsAmount)
  globalTokenStats.save()

  let epochTokenStats = getOrCreateEpochTokenStats(event.block.timestamp, event.params.asset)
  epochTokenStats.rewards = epochTokenStats.rewards.plus(event.params.rewardsAmount)
  epochTokenStats.save()
}

export function handlePaidToRecipientEntity(event: PaidToRecipientEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let recipient = getOrCreateAccount(event.params.recipient.toHex())
  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, owner.id, event.block.timestamp)

  let paidToRecipient = PaidToRecipient.load(id)
  if (paidToRecipient == null) {
    paidToRecipient = new PaidToRecipient(id)
    paidToRecipient.activityHistoryItem = activityHistoryItem.id
    paidToRecipient.portfolio = portfolio.id
    paidToRecipient.epoch = event.params.epoch
    paidToRecipient.tokenId = event.params.tokenId
    paidToRecipient.recipient = recipient.id
    paidToRecipient.owner = owner.id
    paidToRecipient.amount = new Array<BigInt>()
    paidToRecipient.asset = new Array<Bytes>()
    paidToRecipient.transactionHash = new Array<Bytes>()
    paidToRecipient.createdAt = event.block.timestamp
  }
  
  let amounts = paidToRecipient.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  paidToRecipient.amount = amounts
  
  let assets = paidToRecipient.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  paidToRecipient.asset = assets
  
  let txHashes = paidToRecipient.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  paidToRecipient.transactionHash = txHashes
  
  paidToRecipient.save()
}

export function handleInvestedToVaultEntity(event: InvestedToVaultEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, owner.id, event.block.timestamp)

  let investedToVault = InvestedToVault.load(id)
  if (investedToVault == null) {
    investedToVault = new InvestedToVault(id)
    investedToVault.activityHistoryItem = activityHistoryItem.id
    investedToVault.portfolio = portfolio.id
    investedToVault.epoch = event.params.epoch
    investedToVault.tokenId = event.params.tokenId
    investedToVault.owner = owner.id
    investedToVault.amount = new Array<BigInt>()
    investedToVault.asset = new Array<Bytes>()
    investedToVault.transactionHash = new Array<Bytes>()
    investedToVault.createdAt = event.block.timestamp
  }
  
  let amounts = investedToVault.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  investedToVault.amount = amounts
  
  let assets = investedToVault.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  investedToVault.asset = assets
  
  let txHashes = investedToVault.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  investedToVault.transactionHash = txHashes
  
  investedToVault.save()
}

export function handleZeroBalanceRewardsProcessedEntity(event: ZeroBalanceRewardsProcessedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let recipient = getOrCreateAccount(event.params.recipient.toHex())
  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(event.params.epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, event.params.epoch, portfolio.id, owner.id, event.block.timestamp)

  let zeroBalanceRewardsProcessed = ZeroBalanceRewardsProcessed.load(id)
  if (zeroBalanceRewardsProcessed == null) {
    zeroBalanceRewardsProcessed = new ZeroBalanceRewardsProcessed(id)
    zeroBalanceRewardsProcessed.activityHistoryItem = activityHistoryItem.id
    zeroBalanceRewardsProcessed.portfolio = portfolio.id
    zeroBalanceRewardsProcessed.epoch = event.params.epoch
    zeroBalanceRewardsProcessed.tokenId = event.params.tokenId
    zeroBalanceRewardsProcessed.recipient = recipient.id
    zeroBalanceRewardsProcessed.owner = owner.id
    zeroBalanceRewardsProcessed.remainingAmount = new Array<BigInt>()
    zeroBalanceRewardsProcessed.asset = new Array<Bytes>()
    zeroBalanceRewardsProcessed.transactionHash = new Array<Bytes>()
    zeroBalanceRewardsProcessed.createdAt = event.block.timestamp
  }
  
  let remainingAmounts = zeroBalanceRewardsProcessed.remainingAmount
  if (remainingAmounts == null) {
    remainingAmounts = new Array<BigInt>()
  }
  remainingAmounts.push(event.params.remainingAmount)
  zeroBalanceRewardsProcessed.remainingAmount = remainingAmounts
  
  let assets = zeroBalanceRewardsProcessed.asset
  if (assets == null) {
    assets = new Array<Bytes>()
  }
  assets.push(event.params.asset)
  zeroBalanceRewardsProcessed.asset = assets
  
  let txHashes = zeroBalanceRewardsProcessed.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  zeroBalanceRewardsProcessed.transactionHash = txHashes
  
  zeroBalanceRewardsProcessed.save()
}
