import { PortfolioRegistered as PortfolioRegisteredEvent } from '../generated/PortfolioFactory/PortfolioFactory'
import { Portfolio, Account } from '../generated/schema'
import { Portfolio as PortfolioTemplate } from '../generated/templates'
import { getOrCreateAccount, getOrCreateGlobalStats, getOrCreateEpochStats } from './utils'
import { BigInt } from '@graphprotocol/graph-ts'

export function handlePortfolioRegistered(event: PortfolioRegisteredEvent): void {
  // Check if this is a new user
  let existingAccount = Account.load(event.params.owner.toHex())
  let isNewUser = existingAccount == null

  // Create or load owner account
  let owner = getOrCreateAccount(event.params.owner.toHex())

  // Create portfolio
  let portfolioId = event.params.portfolio.toHex()
  let portfolio = new Portfolio(portfolioId)
  portfolio.user = owner.id
  portfolio.factory = event.params.factory
  portfolio.createdAt = event.block.timestamp
  portfolio.currentLoanAmount = BigInt.fromI32(0)
  portfolio.totalBorrowed = BigInt.fromI32(0)
  portfolio.totalRepaid = BigInt.fromI32(0)
  portfolio.allTimeAssets = []
  portfolio.save()

  // Update stats
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)

  globalStats.totalPortfolios = globalStats.totalPortfolios.plus(BigInt.fromI32(1))
  epochStats.newPortfolios = epochStats.newPortfolios.plus(BigInt.fromI32(1))

  if (isNewUser) {
    globalStats.totalUsers = globalStats.totalUsers.plus(BigInt.fromI32(1))
    epochStats.newUsers = epochStats.newUsers.plus(BigInt.fromI32(1))
  }

  globalStats.lastUpdatedAt = event.block.timestamp
  epochStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()
  epochStats.save()

  // Create template for this portfolio to track its events
  PortfolioTemplate.create(event.params.portfolio)
}
