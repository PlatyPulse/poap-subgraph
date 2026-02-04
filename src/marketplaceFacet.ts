import { BigInt } from '@graphprotocol/graph-ts'
import {
  ListingCreated as ListingCreatedEvent,
  ListingCanceled as ListingCanceledEvent,
  ListingSold as ListingSoldEvent,
  DebtTransferredToBuyer as DebtTransferredToBuyerEvent,
} from '../generated/templates/Portfolio/MarketplaceFacet'
import { Listing, Purchase, DebtTransfer } from '../generated/schema'
import { getPortfolio, getOrCreateAccount } from './utils'

export function handleListingCreated(event: ListingCreatedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let listingId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())

  let listing = new Listing(listingId)
  listing.portfolio = portfolio.id
  listing.tokenId = event.params.tokenId
  listing.owner = owner.id
  listing.price = event.params.price
  listing.paymentToken = event.params.paymentToken
  listing.debtAttached = event.params.debtAttached
  listing.expiresAt = event.params.expiresAt
  listing.allowedBuyer = event.params.allowedBuyer
  listing.nonce = event.params.nonce
  listing.status = 'Active'
  listing.createdAt = event.block.timestamp
  listing.transactionHash = event.transaction.hash
  listing.save()
}

export function handleListingCanceled(event: ListingCanceledEvent): void {
  let listingId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())

  let listing = Listing.load(listingId)
  if (listing != null) {
    listing.status = 'Cancelled'
    listing.cancelledAt = event.block.timestamp
    listing.save()
  }
}

export function handleListingSold(event: ListingSoldEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let buyer = getOrCreateAccount(event.params.buyer.toHex())

  // Update listing status
  let listingId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())

  let listing = Listing.load(listingId)
  if (listing != null) {
    listing.status = 'Sold'
    listing.soldAt = event.block.timestamp
    listing.save()
  }

  // Create Purchase record
  let purchaseId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let purchase = new Purchase(purchaseId)
  purchase.portfolio = portfolio.id
  purchase.tokenId = event.params.tokenId
  purchase.seller = listing != null ? listing.owner : buyer.id
  purchase.buyer = buyer.id
  purchase.price = event.params.price
  purchase.debtAmount = BigInt.fromI32(0)
  purchase.unpaidFees = BigInt.fromI32(0)
  purchase.createdAt = event.block.timestamp
  purchase.transactionHash = event.transaction.hash
  purchase.save()
}

export function handleDebtTransferredToBuyer(event: DebtTransferredToBuyerEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let buyer = getOrCreateAccount(event.params.buyer.toHex())
  let seller = getOrCreateAccount(event.params.seller.toHex())

  let transferId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let transfer = new DebtTransfer(transferId)
  transfer.portfolio = portfolio.id
  transfer.tokenId = event.params.tokenId
  transfer.buyer = buyer.id
  transfer.seller = seller.id
  transfer.debtAmount = event.params.debtAmount
  transfer.unpaidFees = event.params.unpaidFees
  transfer.createdAt = event.block.timestamp
  transfer.transactionHash = event.transaction.hash
  transfer.save()
}
