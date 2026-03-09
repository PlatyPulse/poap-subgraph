import { BigInt } from '@graphprotocol/graph-ts'
import {
  SaleProceeded as SaleProceededEvent,
} from '../generated/templates/Portfolio/Portfolio'
import { SaleProceeded } from '../generated/schema'
import { getPortfolio } from './utils'

export function handleSaleProceeded(event: SaleProceededEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) return

  let entityId = event.address.toHex()
    .concat('-')
    .concat(event.params.tokenId.toString())
    .concat('-')
    .concat(event.block.number.toString())
    .concat('-')
    .concat(event.logIndex.toString())

  let entity = new SaleProceeded(entityId)
  entity.portfolio = portfolio.id
  entity.tokenId = event.params.tokenId
  entity.buyerPortfolio = event.params.buyerPortfolio
  entity.paymentAmount = event.params.paymentAmount
  entity.debtPaid = event.params.debtPaid
  entity.createdAt = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
}
