import { BigInt } from '@graphprotocol/graph-ts'
import {
  Borrowed as BorrowedEvent,
  BorrowedTo as BorrowedToEvent,
  Paid as PaidEvent,
  TopUpSet as TopUpSetEvent,
  ToppedUp as ToppedUpEvent,
} from '../generated/templates/Portfolio/LendingFacet'
import { Borrow, ManualRepayment, TopUp } from '../generated/schema'
import { getPortfolio, getOrCreateAccount } from './utils'

export function handleBorrowed(event: BorrowedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  let borrowId = event.address.toHex()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let borrow = new Borrow(borrowId)
  borrow.portfolio = portfolio.id
  borrow.owner = owner.id
  borrow.amount = event.params.amount
  borrow.amountAfterFees = event.params.amountAfterFees
  borrow.originationFee = event.params.originationFee
  borrow.to = null
  borrow.createdAt = event.block.timestamp
  borrow.transactionHash = event.transaction.hash
  borrow.save()

  // Update current loan amount
  portfolio.currentLoanAmount = portfolio.currentLoanAmount.plus(event.params.amount)

  // Update total borrowed
  portfolio.totalBorrowed = portfolio.totalBorrowed.plus(event.params.amount)
  portfolio.save()
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

  let borrow = new Borrow(borrowId)
  borrow.portfolio = portfolio.id
  borrow.owner = owner.id
  borrow.amount = event.params.amount
  borrow.amountAfterFees = event.params.amountAfterFees
  borrow.originationFee = event.params.originationFee
  borrow.to = event.params.to
  borrow.createdAt = event.block.timestamp
  borrow.transactionHash = event.transaction.hash
  borrow.save()

  // Update current loan amount
  portfolio.currentLoanAmount = portfolio.currentLoanAmount.plus(event.params.amount)

  // Update total borrowed
  portfolio.totalBorrowed = portfolio.totalBorrowed.plus(event.params.amount)
  portfolio.save()
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

  let manualRepayment = new ManualRepayment(manualRepaymentId)
  manualRepayment.portfolio = portfolio.id
  manualRepayment.owner = owner.id
  manualRepayment.amount = event.params.amount
  manualRepayment.createdAt = event.block.timestamp
  manualRepayment.transactionHash = event.transaction.hash
  manualRepayment.save()

  // Update current loan amount
  if (portfolio.currentLoanAmount.ge(event.params.amount)) {
    portfolio.currentLoanAmount = portfolio.currentLoanAmount.minus(event.params.amount)
  } else {
    portfolio.currentLoanAmount = BigInt.fromI32(0)
  }

  // Update total repaid
  portfolio.totalRepaid = portfolio.totalRepaid.plus(event.params.amount)
  portfolio.save()
}

export function handleTopUpSet(event: TopUpSetEvent): void {
  // TopUpSet event is handled via Setting entity in schema
  // This handler can be removed or kept empty if Setting is managed elsewhere
  // For now, we'll leave it empty as Setting entity should be managed separately
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

  // Update total borrowed
  portfolio.totalBorrowed = portfolio.totalBorrowed.plus(event.params.amount)
  portfolio.save()
}

