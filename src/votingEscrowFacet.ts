import { BigInt } from '@graphprotocol/graph-ts'
import {
  LockIncreased as LockIncreasedEvent,
  LockCreated as LockCreatedEvent,
  LockMerged as LockMergedEvent,
} from '../generated/templates/Portfolio/VotingEscrowFacet'
import { LockCreated, LockIncreased, LockMerge, UserAsset } from '../generated/schema'
import { getPortfolio, getOrCreateAccount } from './utils'

export function handleLockIncreased(event: LockIncreasedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  // LockIncreased ID is just tokenId
  let lockId = event.params.tokenId.toString()

  let lockIncreased = new LockIncreased(lockId)
  lockIncreased.portfolio = portfolio.id
  lockIncreased.tokenId = event.params.tokenId
  lockIncreased.owner = owner.id
  lockIncreased.amount = event.params.amount
  lockIncreased.createdAt = event.block.timestamp
  lockIncreased.transactionHash = event.transaction.hash
  lockIncreased.save()
  
  // Create or update UserAsset
  let userAssetId = event.params.tokenId.toString()
  let userAsset = UserAsset.load(userAssetId)
  if (userAsset == null) {
    userAsset = new UserAsset(userAssetId)
    userAsset.owner = owner.id
    userAsset.portfolio = portfolio.id
    userAsset.type = 'veNFT'
    userAsset.isManual = false
    userAsset.votes = []
  }
  userAsset.amount = event.params.amount
  userAsset.save()
}

export function handleLockCreated(event: LockCreatedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  // LockCreated ID is just tokenId
  let lockId = event.params.tokenId.toString()

  let lockCreated = new LockCreated(lockId)
  lockCreated.portfolio = portfolio.id
  lockCreated.tokenId = event.params.tokenId
  lockCreated.owner = owner.id
  lockCreated.amount = event.params.amount
  lockCreated.createdAt = event.block.timestamp
  lockCreated.transactionHash = event.transaction.hash
  lockCreated.save()
  
  // Create UserAsset
  let userAssetId = event.params.tokenId.toString()
  let userAsset = new UserAsset(userAssetId)
  userAsset.owner = owner.id
  userAsset.portfolio = portfolio.id
  userAsset.type = 'veNFT'
  userAsset.amount = event.params.amount
  userAsset.isManual = false
  userAsset.votes = []
  userAsset.save()
}

export function handleLockMerged(event: LockMergedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  // LockMerge ID is tokenId-mergeIndex (using block number + log index as mergeIndex)
  let mergeIndex = event.block.number.toString().concat('-').concat(event.logIndex.toString())
  let lockMergeId = event.params.to.toString()
    .concat('-')
    .concat(mergeIndex)

  let lockMerge = new LockMerge(lockMergeId)
  lockMerge.portfolio = portfolio.id
  lockMerge.fromTokenId = event.params.from
  lockMerge.toTokenId = event.params.to
  lockMerge.weightIncrease = event.params.weightIncrease
  lockMerge.owner = owner.id
  lockMerge.createdAt = event.block.timestamp
  lockMerge.transactionHash = event.transaction.hash
  lockMerge.save()
  
  // Update UserAsset amount for the merged token
  let userAssetId = event.params.to.toString()
  let userAsset = UserAsset.load(userAssetId)
  if (userAsset != null) {
    userAsset.amount = userAsset.amount.plus(event.params.weightIncrease)
    userAsset.votes = []
    userAsset.save()
  }
}
