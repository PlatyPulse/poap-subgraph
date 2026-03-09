import { BigInt } from '@graphprotocol/graph-ts'
import {
  Borrowed as BorrowedEvent,
  BorrowedTo as BorrowedToEvent,
  Paid as PaidEvent,
  TopUpSet as TopUpSetEvent,
  ToppedUp as ToppedUpEvent,
} from '../generated/templates/Portfolio/LendingFacet'
import { Borrow, ManualRepayment, TopUp } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, getOrCreateGlobalStats, getOrCreateEpochStats, getOrCreateGlobalTokenStats, getOrCreateEpochTokenStats, getDebtTokenForPortfolio, getOrCreateSetting } from './utils'

export function handleBorrowed(event: BorrowedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let borrowId = event.address.toHex()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  // Get debt token for this portfolio
  let debtToken = getDebtTokenForPortfolio(event.address)

  let borrow = new Borrow(borrowId)
  borrow.portfolio = portfolio.id
  borrow.owner = owner.id
  borrow.amount = event.params.amount
  borrow.amountAfterFees = event.params.amountAfterFees
  borrow.originationFee = event.params.originationFee
  borrow.debtToken = debtToken
  borrow.to = null
  borrow.createdAt = event.block.timestamp
  borrow.transactionHash = event.transaction.hash
  borrow.save()

  // Update current loan amount
  portfolio.currentLoanAmount = portfolio.currentLoanAmount.plus(event.params.amount)
  portfolio.totalBorrowed = portfolio.totalBorrowed.plus(event.params.amount)
  portfolio.save()

  // Update global stats (counts only)
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  globalStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()

  // Update epoch stats (counts only)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)
  epochStats.lastUpdatedAt = event.block.timestamp
  epochStats.save()

  // Update token-specific stats
  let globalTokenStats = getOrCreateGlobalTokenStats(debtToken)
  globalTokenStats.totalBorrowed = globalTokenStats.totalBorrowed.plus(event.params.amount)
  globalTokenStats.currentBorrowed = globalTokenStats.currentBorrowed.plus(event.params.amount)
  globalTokenStats.save()

  let epochTokenStats = getOrCreateEpochTokenStats(event.block.timestamp, debtToken)
  epochTokenStats.borrowed = epochTokenStats.borrowed.plus(event.params.amount)
  epochTokenStats.save()
}

export function handleBorrowedTo(event: BorrowedToEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let borrowId = event.address.toHex()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  // Get debt token for this portfolio
  let debtToken = getDebtTokenForPortfolio(event.address)

  let borrow = new Borrow(borrowId)
  borrow.portfolio = portfolio.id
  borrow.owner = owner.id
  borrow.amount = event.params.amount
  borrow.amountAfterFees = event.params.amountAfterFees
  borrow.originationFee = event.params.originationFee
  borrow.debtToken = debtToken
  borrow.to = event.params.to
  borrow.createdAt = event.block.timestamp
  borrow.transactionHash = event.transaction.hash
  borrow.save()

  // Update current loan amount
  portfolio.currentLoanAmount = portfolio.currentLoanAmount.plus(event.params.amount)
  portfolio.totalBorrowed = portfolio.totalBorrowed.plus(event.params.amount)
  portfolio.save()

  // Update global stats (counts only)
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  globalStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()

  // Update epoch stats (counts only)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)
  epochStats.lastUpdatedAt = event.block.timestamp
  epochStats.save()

  // Update token-specific stats
  let globalTokenStats = getOrCreateGlobalTokenStats(debtToken)
  globalTokenStats.totalBorrowed = globalTokenStats.totalBorrowed.plus(event.params.amount)
  globalTokenStats.currentBorrowed = globalTokenStats.currentBorrowed.plus(event.params.amount)
  globalTokenStats.save()

  let epochTokenStats = getOrCreateEpochTokenStats(event.block.timestamp, debtToken)
  epochTokenStats.borrowed = epochTokenStats.borrowed.plus(event.params.amount)
  epochTokenStats.save()
}

export function handlePaid(event: PaidEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let manualRepaymentId = event.address.toHex()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  // Get debt token for this portfolio
  let debtToken = getDebtTokenForPortfolio(event.address)

  let manualRepayment = new ManualRepayment(manualRepaymentId)
  manualRepayment.portfolio = portfolio.id
  manualRepayment.owner = owner.id
  manualRepayment.amount = event.params.amount
  manualRepayment.debtToken = debtToken
  manualRepayment.createdAt = event.block.timestamp
  manualRepayment.transactionHash = event.transaction.hash
  manualRepayment.save()

  // Update current loan amount
  if (portfolio.currentLoanAmount.ge(event.params.amount)) {
    portfolio.currentLoanAmount = portfolio.currentLoanAmount.minus(event.params.amount)
  } else {
    portfolio.currentLoanAmount = BigInt.fromI32(0)
  }
  portfolio.totalRepaid = portfolio.totalRepaid.plus(event.params.amount)
  portfolio.save()

  // Update global stats (counts only)
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  globalStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()

  // Update epoch stats (counts only)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)
  epochStats.lastUpdatedAt = event.block.timestamp
  epochStats.save()

  // Update token-specific stats
  let globalTokenStats = getOrCreateGlobalTokenStats(debtToken)
  globalTokenStats.totalRepaid = globalTokenStats.totalRepaid.plus(event.params.amount)
  if (globalTokenStats.currentBorrowed.ge(event.params.amount)) {
    globalTokenStats.currentBorrowed = globalTokenStats.currentBorrowed.minus(event.params.amount)
  } else {
    globalTokenStats.currentBorrowed = BigInt.fromI32(0)
  }
  globalTokenStats.save()

  let epochTokenStats = getOrCreateEpochTokenStats(event.block.timestamp, debtToken)
  epochTokenStats.repaid = epochTokenStats.repaid.plus(event.params.amount)
  epochTokenStats.save()
}

export function handleTopUpSet(event: TopUpSetEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let setting = getOrCreateSetting(event.address.toHex(), event.block.timestamp, event.transaction.hash)
  setting.TopUpEnabled = event.params.topUpEnabled
  setting.save()
}

export function handleToppedUp(event: ToppedUpEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let topUpId = event.address.toHex()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let topUp = new TopUp(topUpId)
  topUp.portfolio = portfolio.id
  topUp.owner = owner.id
  topUp.amount = event.params.amount
  topUp.amountAfterFees = event.params.amountAfterFees
  topUp.originationFee = event.params.originationFee
  topUp.createdAt = event.block.timestamp
  topUp.transactionHash = event.transaction.hash
  topUp.save()

  // Update current loan amount
  portfolio.currentLoanAmount = portfolio.currentLoanAmount.plus(event.params.amount)
  portfolio.totalBorrowed = portfolio.totalBorrowed.plus(event.params.amount)
  portfolio.save()

  // Get debt token for this portfolio
  let debtToken = getDebtTokenForPortfolio(event.address)

  // Update global stats (counts only)
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  globalStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()

  // Update epoch stats (counts only)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)
  epochStats.lastUpdatedAt = event.block.timestamp
  epochStats.save()

  // Update token-specific stats
  let globalTokenStats = getOrCreateGlobalTokenStats(debtToken)
  globalTokenStats.totalBorrowed = globalTokenStats.totalBorrowed.plus(event.params.amount)
  globalTokenStats.currentBorrowed = globalTokenStats.currentBorrowed.plus(event.params.amount)
  globalTokenStats.save()

  let epochTokenStats = getOrCreateEpochTokenStats(event.block.timestamp, debtToken)
  epochTokenStats.borrowed = epochTokenStats.borrowed.plus(event.params.amount)
  epochTokenStats.save()
}
