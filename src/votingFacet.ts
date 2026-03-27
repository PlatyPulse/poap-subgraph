import { Bytes, BigInt } from '@graphprotocol/graph-ts'
import {
  Voted as VotedEvent,
  VotingModeSet as VotingModeSetEvent,
} from '../generated/templates/Portfolio/VotingFacet'
import { Vote, UserAsset } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, addToAllTimeAssets, getEpochFromTimestamp, getOrCreateSetting } from './utils'

export function handleVoted(event: VotedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let owner = getOrCreateAccount(event.params.owner.toHex())
  
  // UserAsset ID is tokenId (for veNFT type)
  let userAssetId = event.params.tokenId.toString()
  let userAsset = UserAsset.load(userAssetId)
  
  // If UserAsset doesn't exist, create it
  if (userAsset == null) {
    userAsset = new UserAsset(userAssetId)
    userAsset.owner = owner.id
    userAsset.portfolio = portfolio.id
    userAsset.type = 'veNFT'
    userAsset.amount = event.params.weights.length > 0 ? event.params.weights[0] : BigInt.fromI32(0) as BigInt
    userAsset.isManual = false
    userAsset.isCollateral = false
    userAsset.save()
    addToAllTimeAssets(portfolio, userAssetId)
  }

  let epoch = getEpochFromTimestamp(event.block.timestamp)
  let voteId = event.params.tokenId.toString()
    .concat('-')
    .concat(epoch.toString())

  let vote = new Vote(voteId)
  vote.epoch = epoch
  vote.userAsset = userAsset.id
  
  // Convert Address[] to Bytes[]
  let pools = new Array<Bytes>(event.params.pools.length)
  for (let i = 0; i < event.params.pools.length; i++) {
    pools[i] = event.params.pools[i] as Bytes
  }
  vote.pools = pools
  vote.weights = event.params.weights
  vote.timestamp = event.block.timestamp
  vote.save()
}

export function handleVotingModeSet(event: VotingModeSetEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let setting = getOrCreateSetting(event.address.toHex(), event.block.timestamp, event.transaction.hash)
  setting.IsManualVoting = event.params.setToManualVoting
  setting.save()
}

