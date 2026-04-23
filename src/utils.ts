import { Address, dataSource, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { Portfolio, Account, GlobalStats, EpochStats, GlobalTokenStats, EpochTokenStats, Setting, RewardOption, ActivityHistoryItem } from '../generated/schema'
import { Portfolio as PortfolioContract } from '../generated/templates/Portfolio/Portfolio'
import { PortfolioAccountConfig } from '../generated/templates/Portfolio/PortfolioAccountConfig'
import { VotingEscrow } from '../generated/templates/Portfolio/VotingEscrow'

// Thursday 00:00 UTC epoch calculation
// Unix epoch (Jan 1, 1970) was a Thursday, so we can use modulo with week seconds
const WEEK_SECONDS = BigInt.fromI32(604800) // 7 * 24 * 60 * 60

export function getEpochFromTimestamp(timestamp: BigInt): BigInt {
  // Round down to the nearest Thursday 00:00 UTC
  return timestamp.div(WEEK_SECONDS).times(WEEK_SECONDS)
}

export function getOrCreateGlobalStats(timestamp: BigInt): GlobalStats {
  let stats = GlobalStats.load('global')
  if (stats == null) {
    stats = new GlobalStats('global')
    stats.totalUsers = BigInt.fromI32(0)
    stats.totalPortfolios = BigInt.fromI32(0)
    stats.totalVeNftDeposited = BigInt.fromI32(0)
    stats.totalVeNftValue = BigInt.fromI32(0)
    stats.currentVeNft = BigInt.fromI32(0)
    stats.currentVeNftValue = BigInt.fromI32(0)
    stats.totalListings = BigInt.fromI32(0)
    stats.totalSales = BigInt.fromI32(0)
    stats.activeListings = BigInt.fromI32(0)
    stats.lastUpdatedAt = timestamp
  }
  return stats
}

export function getOrCreateEpochStats(timestamp: BigInt): EpochStats {
  let epoch = getEpochFromTimestamp(timestamp)
  let id = epoch.toString()
  let stats = EpochStats.load(id)
  if (stats == null) {
    stats = new EpochStats(id)
    stats.epoch = epoch
    stats.newUsers = BigInt.fromI32(0)
    stats.newPortfolios = BigInt.fromI32(0)
    stats.veNftDeposited = BigInt.fromI32(0)
    stats.veNftValueDeposited = BigInt.fromI32(0)
    stats.veNftWithdrawn = BigInt.fromI32(0)
    stats.veNftValueWithdrawn = BigInt.fromI32(0)
    stats.listings = BigInt.fromI32(0)
    stats.sales = BigInt.fromI32(0)
    stats.lastUpdatedAt = timestamp
  }
  return stats
}

export function getOrCreateGlobalTokenStats(token: Bytes): GlobalTokenStats {
  let id = 'global-'.concat(token.toHexString())
  let stats = GlobalTokenStats.load(id)
  if (stats == null) {
    stats = new GlobalTokenStats(id)
    stats.globalStats = 'global'
    stats.token = token
    stats.totalBorrowed = BigInt.fromI32(0)
    stats.currentBorrowed = BigInt.fromI32(0)
    stats.totalRepaid = BigInt.fromI32(0)
    stats.totalRewards = BigInt.fromI32(0)
    stats.totalSalesVolume = BigInt.fromI32(0)
  }
  return stats
}

export function getOrCreateEpochTokenStats(timestamp: BigInt, token: Bytes): EpochTokenStats {
  let epoch = getEpochFromTimestamp(timestamp)
  let id = epoch.toString().concat('-').concat(token.toHexString())
  let stats = EpochTokenStats.load(id)
  if (stats == null) {
    stats = new EpochTokenStats(id)
    stats.epochStats = epoch.toString()
    stats.token = token
    stats.borrowed = BigInt.fromI32(0)
    stats.repaid = BigInt.fromI32(0)
    stats.rewards = BigInt.fromI32(0)
    stats.salesVolume = BigInt.fromI32(0)
  }
  return stats
}

export function getOrCreateActivityHistoryItem(tokenId: BigInt, epoch: BigInt, portfolioId: string, userId: string, timestamp: BigInt): ActivityHistoryItem {
  let id = portfolioId.concat('-').concat(tokenId.toString()).concat('-').concat(epoch.toString())
  let item = ActivityHistoryItem.load(id)
  if (item == null) {
    item = new ActivityHistoryItem(id)
    item.portfolio = portfolioId
    item.epoch = epoch
    item.tokenId = tokenId
    item.user = userId
    item.createdAt = timestamp

    let veNFTAddress = getVeNFTAddress()
    let veNFTContract = VotingEscrow.bind(veNFTAddress)
    let balanceResult = veNFTContract.try_balanceOfNFTAt(tokenId, timestamp)
    if (!balanceResult.reverted) {
      item.lockedValue = balanceResult.value
    } else {
      item.lockedValue = BigInt.fromI32(0)
    }

    item.save()
  }
  return item
}

export function getOrCreateAccount(address: string): Account {
  let account = Account.load(address)
  if (account == null) {
    account = new Account(address)
    account.save()
  }
  return account
}

export function getPortfolio(address: string): Portfolio | null {
  return Portfolio.load(address)
}

export function addToAllTimeAssets(portfolio: Portfolio, assetId: string): void {
  let assets = portfolio.allTimeAssets
  for (let i = 0; i < assets.length; i++) {
    if (assets[i] == assetId) return
  }
  assets.push(assetId)
  portfolio.allTimeAssets = assets
  portfolio.save()
}

export function getVeNFTAddress(): Address {
  let network = dataSource.network()

  // Map network to veNFT contract address
  if (network == 'base') {
    // Aerodrome
    return Address.fromString('0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4')
  } else if (network == 'optimism') {
    // Velodrome
    return Address.fromString('0xFAf8FD17D9840595845582fCB047DF13f006787d')
  } else if (network == 'avalanche') {
    // Blackhole
    return Address.fromString('0xEac562811cc6abDbB2c9EE88719eCA4eE79Ad763')
  } else if (network == 'mainnet') {
    // YieldBasis ETH (ERC20 — balanceOfNFTAt will revert and fall back gracefully)
    return Address.fromString('0x01791F726B4103694969820be083196cC7c045fF')
  }

  // Default fallback (should not happen in production)
  return Address.fromString('0x0000000000000000000000000000000000000000')
}

// Default borrow token address (USDC on Base) - fallback if contract call fails
export function getDefaultBorrowToken(): Bytes {
  let network = dataSource.network()

  if (network == 'base') {
    return Bytes.fromHexString('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') // USDC on Base
  } else if (network == 'optimism') {
    return Bytes.fromHexString('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85') // USDC on Optimism
  } else if (network == 'avalanche') {
    return Bytes.fromHexString('0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E') // USDC on Avalanche
  } else if (network == 'mainnet') {
    return Bytes.fromHexString('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') // USDC on Ethereum mainnet
  }

  return Bytes.fromHexString('0x0000000000000000000000000000000000000000')
}

export function getOrCreateSetting(portfolioId: string, timestamp: BigInt, txHash: Bytes): Setting {
  let setting = Setting.load(portfolioId)
  if (setting == null) {
    setting = new Setting(portfolioId)
    setting.portfolio = portfolioId
    setting.TopUpEnabled = false
    setting.IsManualVoting = false

    let rewardOption = RewardOption.load(portfolioId)
    if (rewardOption == null) {
      rewardOption = new RewardOption(portfolioId)
      rewardOption.portfolio = portfolioId
      rewardOption.option = 0
      rewardOption.percentage = BigInt.fromI32(0)
      rewardOption.createdAt = timestamp
      rewardOption.transactionHash = txHash
      rewardOption.save()
    }
    setting.RewardsOption = portfolioId
  }
  return setting as Setting
}

export function getDebtTokenForPortfolio(portfolioAddress: Address): Bytes {
  // Step 1: Call portfolio.getPortfolioAccountConfig()
  let portfolioContract = PortfolioContract.bind(portfolioAddress)
  let configResult = portfolioContract.try_getPortfolioAccountConfig()

  if (configResult.reverted) {
    return getDefaultBorrowToken()
  }

  // Step 2: Call accountConfig.getDebtToken()
  let accountConfigContract = PortfolioAccountConfig.bind(configResult.value)
  let debtTokenResult = accountConfigContract.try_getDebtToken()

  if (debtTokenResult.reverted) {
    return getDefaultBorrowToken()
  }

  return debtTokenResult.value as Bytes
}
