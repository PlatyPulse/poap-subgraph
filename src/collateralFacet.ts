import { BigInt, store, Address } from '@graphprotocol/graph-ts'
import {
  CollateralAdded as CollateralAddedEvent,
  CollateralRemoved as CollateralRemovedEvent,
} from '../generated/templates/Portfolio/CollateralFacet'
import { VotingEscrow } from '../generated/templates/Portfolio/VotingEscrow'
import { CollateralEvent, UserAsset } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, getVeNFTAddress } from './utils'

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
  if (userAsset == null) {
    userAsset = new UserAsset(userAssetId)
    userAsset.owner = owner.id
    userAsset.portfolio = portfolio.id
    userAsset.type = 'veNFT'
    userAsset.amount = BigInt.fromI32(0)
    userAsset.isManual = false
    userAsset.votes = []
  }
  
  // Fetch balance from veNFT contract
  let veNFTAddress = getVeNFTAddress()
  let veNFTContract = VotingEscrow.bind(veNFTAddress)
  let balanceResult = veNFTContract.try_balanceOfNFTAt(event.params.tokenId, event.block.timestamp)
  if (!balanceResult.reverted) {
    userAsset.amount = balanceResult.value
  }
  
  userAsset.save()
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

  // Remove UserAsset when collateral is withdrawn
  let userAssetId = event.params.tokenId.toString()
  let userAsset = UserAsset.load(userAssetId)
  if (userAsset != null && userAsset.portfolio == portfolio.id) {
    store.remove('UserAsset', userAssetId)
  }
}

