import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  RebaseClaimed as RebaseClaimedEvent,
} from '../generated/templates/Portfolio/ClaimingFacet'
import { RebaseClaimed } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, getOrCreateActivityHistoryItem, getEpochFromTimestamp } from './utils'

export function handleRebaseClaimed(event: RebaseClaimedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let epoch = getEpochFromTimestamp(event.block.timestamp)

  let id = event.params.tokenId.toString()
    .concat('-')
    .concat(epoch.toString())

  let activityHistoryItem = getOrCreateActivityHistoryItem(event.params.tokenId, epoch, portfolio.id, portfolio.user, event.block.timestamp)

  let rebaseClaimed = RebaseClaimed.load(id)
  if (rebaseClaimed == null) {
    rebaseClaimed = new RebaseClaimed(id)
    rebaseClaimed.activityHistoryItem = activityHistoryItem.id
    rebaseClaimed.portfolio = portfolio.id
    rebaseClaimed.epoch = epoch
    rebaseClaimed.tokenId = event.params.tokenId
    rebaseClaimed.amount = new Array<BigInt>()
    rebaseClaimed.transactionHash = new Array<Bytes>()
    rebaseClaimed.createdAt = event.block.timestamp
  }

  let amounts = rebaseClaimed.amount
  if (amounts == null) {
    amounts = new Array<BigInt>()
  }
  amounts.push(event.params.amount)
  rebaseClaimed.amount = amounts

  let txHashes = rebaseClaimed.transactionHash
  if (txHashes == null) {
    txHashes = new Array<Bytes>()
  }
  txHashes.push(event.transaction.hash)
  rebaseClaimed.transactionHash = txHashes

  rebaseClaimed.save()
}
