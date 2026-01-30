import { FacetAdded as FacetAddedEvent } from '../generated/templates/Portfolio/Portfolio'
import { Portfolio, Facet } from '../generated/schema'
import { getPortfolio } from './utils'

export function handleFacetAdded(event: FacetAddedEvent): void {
  let portfolio = getPortfolio(event.address.toHex())
  if (portfolio == null) {
    return
  }

  let facetId = event.address.toHex().concat('-').concat(event.params.facet.toHex())
  
  let facet = new Facet(facetId)
  facet.portfolio = portfolio.id
  facet.facetAddress = event.params.facet
  facet.selectors = event.params.selectors
  facet.addedAt = event.block.timestamp
  facet.transactionHash = event.transaction.hash
  facet.save()
}
