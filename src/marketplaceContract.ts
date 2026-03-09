import { BigInt, Bytes, store } from '@graphprotocol/graph-ts'
import {
  ListingCreated as ListingCreatedEvent,
  ListingCanceled as ListingCanceledEvent,
  ListingPurchased as ListingPurchasedEvent,
} from '../generated/PortfolioMarketplace/PortfolioMarketplace'
import { VotingEscrow } from '../generated/PortfolioMarketplace/VotingEscrow'
import { Listing, ListingHistory, Purchase, UserAsset, Portfolio } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, getVeNFTAddress, getOrCreateGlobalStats, getOrCreateEpochStats, getOrCreateGlobalTokenStats, getOrCreateEpochTokenStats } from './utils'

export function handleListingCreated(event: ListingCreatedEvent): void {
  let portfolio = getPortfolio(event.params.sellerPortfolio.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(portfolio.user)

  let listingId = event.params.sellerPortfolio.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())

  let listing = new Listing(listingId)
  listing.portfolio = portfolio.id
  listing.tokenId = event.params.tokenId
  listing.userAsset = event.params.tokenId.toString()
  listing.owner = owner.id
  listing.price = event.params.price
  listing.paymentToken = event.params.paymentToken
  listing.expiresAt = event.params.expiresAt
  listing.allowedBuyer = event.params.allowedBuyer
  listing.nonce = event.params.nonce
  listing.createdAt = event.block.timestamp
  listing.transactionHash = event.transaction.hash
  listing.save()

  // Update stats
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)

  globalStats.totalListings = globalStats.totalListings.plus(BigInt.fromI32(1))
  globalStats.activeListings = globalStats.activeListings.plus(BigInt.fromI32(1))
  epochStats.listings = epochStats.listings.plus(BigInt.fromI32(1))

  globalStats.lastUpdatedAt = event.block.timestamp
  epochStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()
  epochStats.save()
}

function createListingHistory(
  listing: Listing,
  outcome: string,
  timestamp: BigInt,
  buyer: string | null,
  soldPrice: BigInt | null,
  transactionHash: string
): void {
  let historyId = listing.portfolio
    .concat('-')
    .concat(listing.tokenId.toString())
    .concat('-')
    .concat(timestamp.toString())

  let history = new ListingHistory(historyId)
  history.portfolio = listing.portfolio
  history.tokenId = listing.tokenId
  history.owner = listing.owner

  // Fetch asset amount from contract using balanceOfNFTAt
  let userAssetId = listing.tokenId.toString()
  let userAsset = UserAsset.load(userAssetId)
  history.assetId = userAssetId
  history.assetType = userAsset != null ? userAsset.type : 'veNFT'

  let veNFTAddress = getVeNFTAddress()
  let veNFTContract = VotingEscrow.bind(veNFTAddress)
  let balanceResult = veNFTContract.try_balanceOfNFTAt(listing.tokenId, timestamp)
  if (!balanceResult.reverted) {
    history.assetAmount = balanceResult.value
  } else {
    history.assetAmount = BigInt.fromI32(0)
  }

  // Listing details
  history.price = listing.price
  history.paymentToken = listing.paymentToken
  history.expiresAt = listing.expiresAt
  history.allowedBuyer = listing.allowedBuyer
  history.nonce = listing.nonce
  history.createdAt = listing.createdAt

  // Outcome
  history.outcome = outcome
  if (outcome == 'Cancelled') {
    history.cancelledAt = timestamp
    history.soldAt = null
    history.soldTo = null
    history.soldPrice = null
  } else {
    history.cancelledAt = null
    history.soldAt = timestamp
    history.soldTo = buyer
    history.soldPrice = soldPrice
  }
  history.transactionHash = Bytes.fromHexString(transactionHash)

  history.save()
}

export function handleListingCanceled(event: ListingCanceledEvent): void {
  let listingId = event.params.sellerPortfolio.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())

  let listing = Listing.load(listingId)
  if (listing != null) {
    createListingHistory(
      listing,
      'Cancelled',
      event.block.timestamp,
      null,
      null,
      event.transaction.hash.toHex()
    )
    store.remove('Listing', listingId)

    // Update stats
    let globalStats = getOrCreateGlobalStats(event.block.timestamp)
    if (globalStats.activeListings.gt(BigInt.fromI32(0))) {
      globalStats.activeListings = globalStats.activeListings.minus(BigInt.fromI32(1))
    }
    globalStats.lastUpdatedAt = event.block.timestamp
    globalStats.save()
  }
}

export function handleListingPurchased(event: ListingPurchasedEvent): void {
  let sellerPortfolio = getPortfolio(event.params.sellerPortfolio.toHex())
  if (sellerPortfolio == null) return

  let listingId = event.params.sellerPortfolio.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())

  let listing = Listing.load(listingId)

  // Create listing history before removing
  if (listing != null) {
    let buyerAccount = getOrCreateAccount(event.params.buyer.toHex())
    createListingHistory(
      listing,
      'Sold',
      event.block.timestamp,
      buyerAccount.id,
      event.params.price,
      event.transaction.hash.toHex()
    )
    store.remove('Listing', listingId)

    // Update global stats (counts only)
    let globalStats = getOrCreateGlobalStats(event.block.timestamp)
    globalStats.totalSales = globalStats.totalSales.plus(BigInt.fromI32(1))
    if (globalStats.activeListings.gt(BigInt.fromI32(0))) {
      globalStats.activeListings = globalStats.activeListings.minus(BigInt.fromI32(1))
    }
    globalStats.lastUpdatedAt = event.block.timestamp
    globalStats.save()

    // Update epoch stats (counts only)
    let epochStats = getOrCreateEpochStats(event.block.timestamp)
    epochStats.sales = epochStats.sales.plus(BigInt.fromI32(1))
    epochStats.lastUpdatedAt = event.block.timestamp
    epochStats.save()

    // Update token-specific stats for sales volume
    let globalTokenStats = getOrCreateGlobalTokenStats(listing.paymentToken)
    globalTokenStats.totalSalesVolume = globalTokenStats.totalSalesVolume.plus(event.params.price)
    globalTokenStats.save()

    let epochTokenStats = getOrCreateEpochTokenStats(event.block.timestamp, listing.paymentToken)
    epochTokenStats.salesVolume = epochTokenStats.salesVolume.plus(event.params.price)
    epochTokenStats.save()
  }

  // Create "Bought" listing history for the buyer's portfolio
  let buyerPortfolio = getPortfolio(event.params.buyer.toHex())
  if (buyerPortfolio != null && listing != null) {
    let buyerAccount = getOrCreateAccount(buyerPortfolio.user)
    let buyerHistoryId = event.params.buyer.toHex()
      .concat('-')
      .concat(event.params.tokenId.toString())
      .concat('-')
      .concat(event.block.timestamp.toString())

    let buyerHistory = new ListingHistory(buyerHistoryId)
    buyerHistory.portfolio = buyerPortfolio.id
    buyerHistory.tokenId = listing.tokenId
    buyerHistory.owner = buyerAccount.id

    let userAssetId = listing.tokenId.toString()
    let buyerUserAsset = UserAsset.load(userAssetId)
    buyerHistory.assetId = userAssetId
    buyerHistory.assetType = buyerUserAsset != null ? buyerUserAsset.type : 'veNFT'

    let veNFTAddress = getVeNFTAddress()
    let veNFTContract = VotingEscrow.bind(veNFTAddress)
    let balanceResult = veNFTContract.try_balanceOfNFTAt(listing.tokenId, event.block.timestamp)
    if (!balanceResult.reverted) {
      buyerHistory.assetAmount = balanceResult.value
    } else {
      buyerHistory.assetAmount = BigInt.fromI32(0)
    }

    buyerHistory.price = listing.price
    buyerHistory.paymentToken = listing.paymentToken
    buyerHistory.expiresAt = listing.expiresAt
    buyerHistory.allowedBuyer = listing.allowedBuyer
    buyerHistory.nonce = listing.nonce
    buyerHistory.createdAt = listing.createdAt
    buyerHistory.outcome = 'Bought'
    buyerHistory.cancelledAt = null
    buyerHistory.soldAt = event.block.timestamp
    buyerHistory.soldTo = buyerAccount.id
    buyerHistory.soldPrice = event.params.price
    buyerHistory.transactionHash = event.transaction.hash
    buyerHistory.save()
  }

  // Create Purchase record
  let purchaseId = event.params.sellerPortfolio.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let purchase = new Purchase(purchaseId)
  purchase.portfolio = sellerPortfolio.id
  purchase.tokenId = event.params.tokenId
  purchase.seller = sellerPortfolio.id
  purchase.buyer = event.params.buyer
  purchase.price = event.params.price
  purchase.protocolFee = event.params.protocolFee
  purchase.createdAt = event.block.timestamp
  purchase.transactionHash = event.transaction.hash
  purchase.save()
}
