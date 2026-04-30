import { BigInt, store } from '@graphprotocol/graph-ts'
import {
  LockIncreased as LockIncreasedEvent,
  LockCreated as LockCreatedEvent,
  LockMerged as LockMergedEvent,
} from '../generated/templates/Portfolio/VotingEscrowFacet'
import { VotingEscrow } from '../generated/templates/Portfolio/VotingEscrow'
import { LockCreated, LockIncreased, LockMerge, UserAsset } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, addToAllTimeAssets, getVeNFTAddress } from './utils'

export function handleLockIncreased(event: LockIncreasedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  let lockId = event.params.tokenId.toString()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

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
    userAsset.amount = BigInt.fromI32(0)
    userAsset.isManual = false
    userAsset.isCollateral = false
    addToAllTimeAssets(portfolio, userAssetId)
  }
  // event.params.amount is the increment ("ADD TO veNFT" amount), not the new total. Read the
  // authoritative post-increase balance from the veNFT contract; fall back to additive math if
  // the call reverts.
  let veNFTContract = VotingEscrow.bind(getVeNFTAddress())
  let balanceResult = veNFTContract.try_balanceOfNFTAt(event.params.tokenId, event.block.timestamp)
  if (!balanceResult.reverted) {
    userAsset.amount = balanceResult.value
  } else {
    userAsset.amount = userAsset.amount.plus(event.params.amount)
  }
  userAsset.save()
}

export function handleLockCreated(event: LockCreatedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  let lockId = event.params.tokenId.toString()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let lockCreated = new LockCreated(lockId)
  lockCreated.portfolio = portfolio.id
  lockCreated.tokenId = event.params.tokenId
  lockCreated.owner = owner.id
  lockCreated.amount = event.params.amount
  lockCreated.createdAt = event.block.timestamp
  lockCreated.transactionHash = event.transaction.hash
  lockCreated.save()
  
  // Create or update UserAsset (may already exist from a Transfer event)
  let userAssetId = event.params.tokenId.toString()
  let userAsset = UserAsset.load(userAssetId)
  if (userAsset == null) {
    userAsset = new UserAsset(userAssetId)
    userAsset.isManual = false
    userAsset.isCollateral = false
    addToAllTimeAssets(portfolio, userAssetId)
  }
  userAsset.owner = owner.id
  userAsset.portfolio = portfolio.id
  userAsset.type = 'veNFT'
  userAsset.amount = event.params.amount
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
    userAsset.save()
  }

  // The `from` token is burned by the merge. Aerodrome's veNFT typically emits a Transfer to
  // 0x0 which veNFTTransfer.ts already cleans up — but defensively remove here too in case
  // event ordering or future contract changes leave it behind. Idempotent.
  store.remove('UserAsset', event.params.from.toString())
}
