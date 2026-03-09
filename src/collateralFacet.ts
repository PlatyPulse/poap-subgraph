import { BigInt, Address } from '@graphprotocol/graph-ts'
import {
  CollateralAdded as CollateralAddedEvent,
  CollateralRemoved as CollateralRemovedEvent,
} from '../generated/templates/Portfolio/CollateralFacet'
import { VotingEscrow } from '../generated/templates/Portfolio/VotingEscrow'
import { CollateralEvent, UserAsset } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, getVeNFTAddress, addToAllTimeAssets, getOrCreateGlobalStats, getOrCreateEpochStats } from './utils'

export function handleCollateralAdded(event: CollateralAddedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let collateralId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let collateral = new CollateralEvent(collateralId)
  collateral.portfolio = portfolio.id
  collateral.tokenId = event.params.tokenId
  collateral.owner = owner.id
  collateral.eventType = 'CollateralAdded'
  collateral.createdAt = event.block.timestamp
  collateral.transactionHash = event.transaction.hash
  collateral.save()

  // Create or update UserAsset
  let userAssetId = event.params.tokenId.toString()
  let userAsset = UserAsset.load(userAssetId)
  let isNewCollateral = userAsset == null || !userAsset.isCollateral
  if (userAsset == null) {
    userAsset = new UserAsset(userAssetId)
    userAsset.owner = owner.id
    userAsset.portfolio = portfolio.id
    userAsset.type = 'veNFT'
    userAsset.amount = BigInt.fromI32(0)
    userAsset.isManual = false
    userAsset.isCollateral = false
    addToAllTimeAssets(portfolio, userAssetId)
  }

  // Fetch balance from veNFT contract
  let veNFTAddress = getVeNFTAddress()
  let veNFTContract = VotingEscrow.bind(veNFTAddress)
  let balanceResult = veNFTContract.try_balanceOfNFTAt(event.params.tokenId, event.block.timestamp)
  let assetValue = BigInt.fromI32(0)
  if (!balanceResult.reverted) {
    assetValue = balanceResult.value
    userAsset.amount = assetValue
  }

  userAsset.isCollateral = true
  userAsset.save()

  // Only update stats when first collateralized (not on re-collateralization)
  if (isNewCollateral) {
    let globalStats = getOrCreateGlobalStats(event.block.timestamp)
    let epochStats = getOrCreateEpochStats(event.block.timestamp)

    globalStats.totalVeNftDeposited = globalStats.totalVeNftDeposited.plus(BigInt.fromI32(1))
    globalStats.totalVeNftValue = globalStats.totalVeNftValue.plus(assetValue)
    globalStats.currentVeNft = globalStats.currentVeNft.plus(BigInt.fromI32(1))
    globalStats.currentVeNftValue = globalStats.currentVeNftValue.plus(assetValue)

    epochStats.veNftDeposited = epochStats.veNftDeposited.plus(BigInt.fromI32(1))
    epochStats.veNftValueDeposited = epochStats.veNftValueDeposited.plus(assetValue)

    globalStats.lastUpdatedAt = event.block.timestamp
    epochStats.lastUpdatedAt = event.block.timestamp
    globalStats.save()
    epochStats.save()
  }
}

export function handleCollateralRemoved(event: CollateralRemovedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())

  let collateralId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let collateral = new CollateralEvent(collateralId)
  collateral.portfolio = portfolio.id
  collateral.tokenId = event.params.tokenId
  collateral.owner = owner.id
  collateral.eventType = 'CollateralRemoved'
  collateral.createdAt = event.block.timestamp
  collateral.transactionHash = event.transaction.hash
  collateral.save()

  // Get asset value before marking as not collateral
  let userAssetId = event.params.tokenId.toString()
  let userAsset = UserAsset.load(userAssetId)
  let assetValue = BigInt.fromI32(0)

  if (userAsset != null && userAsset.portfolio == portfolio.id) {
    // Fetch current balance from veNFT contract
    let veNFTAddress = getVeNFTAddress()
    let veNFTContract = VotingEscrow.bind(veNFTAddress)
    let balanceResult = veNFTContract.try_balanceOfNFTAt(event.params.tokenId, event.block.timestamp)
    if (!balanceResult.reverted) {
      assetValue = balanceResult.value
    }

    userAsset.isCollateral = false
    userAsset.save()
  }

  // Update stats
  let globalStats = getOrCreateGlobalStats(event.block.timestamp)
  let epochStats = getOrCreateEpochStats(event.block.timestamp)

  if (globalStats.currentVeNft.gt(BigInt.fromI32(0))) {
    globalStats.currentVeNft = globalStats.currentVeNft.minus(BigInt.fromI32(1))
  }
  if (globalStats.currentVeNftValue.ge(assetValue)) {
    globalStats.currentVeNftValue = globalStats.currentVeNftValue.minus(assetValue)
  } else {
    globalStats.currentVeNftValue = BigInt.fromI32(0)
  }

  epochStats.veNftWithdrawn = epochStats.veNftWithdrawn.plus(BigInt.fromI32(1))
  epochStats.veNftValueWithdrawn = epochStats.veNftValueWithdrawn.plus(assetValue)

  globalStats.lastUpdatedAt = event.block.timestamp
  epochStats.lastUpdatedAt = event.block.timestamp
  globalStats.save()
  epochStats.save()
}
