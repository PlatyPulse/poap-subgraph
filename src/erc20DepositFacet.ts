import { BigInt } from '@graphprotocol/graph-ts'
import {
  Deposited as DepositedEvent,
  Withdrawn as WithdrawnEvent,
} from '../generated/templates/Portfolio/Portfolio'
import { Deposit, Withdrawal, UserAsset } from '../generated/schema'
import { getPortfolio, getOrCreateAccount, addToAllTimeAssets } from './utils'

// ERC20-portfolio deposit/withdraw handlers.
//
// Used by deployments where the portfolio diamond emits Deposited/Withdrawn events for
// underlying-asset accounting (e.g. YieldBasis ETH on mainnet). One UserAsset per portfolio,
// keyed by portfolio address, with `amount` tracking the running net deposit.
//
// Wired in conditionally via the `useDepositEvents` mustache flag in subgraph.template.yaml.

const USER_ASSET_TYPE = 'erc20'

export function handleDeposited(event: DepositedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let user = getOrCreateAccount(event.params.by.toHex())

  let depositId = event.address.toHex()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let deposit = new Deposit(depositId)
  deposit.portfolio = portfolio.id
  deposit.user = user.id
  deposit.amount = event.params.amount
  deposit.createdAt = event.block.timestamp
  deposit.transactionHash = event.transaction.hash
  deposit.save()

  // Maintain UserAsset as the running net deposit per portfolio.
  let userAssetId = portfolio.id
  let userAsset = UserAsset.load(userAssetId)
  if (userAsset == null) {
    userAsset = new UserAsset(userAssetId)
    userAsset.owner = user.id
    userAsset.portfolio = portfolio.id
    userAsset.type = USER_ASSET_TYPE
    userAsset.amount = BigInt.fromI32(0)
    userAsset.isManual = false
    userAsset.isCollateral = false
    addToAllTimeAssets(portfolio, userAssetId)
  }
  userAsset.amount = userAsset.amount.plus(event.params.amount)
  userAsset.save()
}

export function handleWithdrawn(event: WithdrawnEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let recipient = getOrCreateAccount(event.params.to.toHex())

  let withdrawalId = event.address.toHex()
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let withdrawal = new Withdrawal(withdrawalId)
  withdrawal.portfolio = portfolio.id
  withdrawal.to = recipient.id
  withdrawal.amount = event.params.amount
  withdrawal.createdAt = event.block.timestamp
  withdrawal.transactionHash = event.transaction.hash
  withdrawal.save()

  let userAsset = UserAsset.load(portfolio.id)
  if (userAsset == null) return

  if (userAsset.amount.le(event.params.amount)) {
    userAsset.amount = BigInt.fromI32(0)
  } else {
    userAsset.amount = userAsset.amount.minus(event.params.amount)
  }
  userAsset.save()
}
