import { PortfolioRegistered as PortfolioRegisteredEvent } from '../generated/PortfolioFactory/PortfolioFactory'
import { Portfolio } from '../generated/schema'
import { Portfolio as PortfolioTemplate } from '../generated/templates'
import { getOrCreateAccount } from './utils'
import { BigInt } from '@graphprotocol/graph-ts'

export function handlePortfolioRegistered(event: PortfolioRegisteredEvent): void {
  // Create or load owner account
  let owner = getOrCreateAccount(event.params.owner.toHex())

  // Create portfolio
  let portfolioId = event.params.portfolio.toHex()
  let portfolio = new Portfolio(portfolioId)
  portfolio.user = owner.id
  portfolio.createdAt = event.block.timestamp
  portfolio.currentLoanAmount = BigInt.fromI32(0)
  portfolio.totalBorrowed = BigInt.fromI32(0)
  portfolio.totalRepaid = BigInt.fromI32(0)
  portfolio.save()

  // Create template for this portfolio to track its events
  PortfolioTemplate.create(event.params.portfolio)
}

