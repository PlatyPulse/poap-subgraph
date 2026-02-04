import { BigInt, Address, store } from '@graphprotocol/graph-ts'
import { Transfer as PharaohTransfer, PharaohVotingEscrow as PharaohContract } from '../generated/PharaohVotingEscrow/PharaohVotingEscrow'
import { Portfolio, UserAsset } from '../generated/schema'
import { getOrCreateAccount, getPortfolio, addToAllTimeAssets } from './utils'

// Zero address constant
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Checks if an address is a registered 40 Acres portfolio
 */
function isPortfolio(address: string): boolean {
  let portfolio = Portfolio.load(address)
  return portfolio != null
}

/**
 * Gets the ERC20 balance for Pharaoh using balanceOf
 */
function getPharaohBalance(contractAddress: Address, accountAddress: Address): BigInt {
  let contract = PharaohContract.bind(contractAddress)
  let balanceResult = contract.try_balanceOf(accountAddress)
  if (balanceResult.reverted) {
    return BigInt.fromI32(0)
  }
  return balanceResult.value
}

/**
 * Handler for Pharaoh ERC20 Transfer events
 * Transfer(indexed address from, indexed address to, uint256 value)
 */
export function handlePharaohTransfer(event: PharaohTransfer): void {
  let fromAddress = event.params.from.toHex()
  let toAddress = event.params.to.toHex()

  let fromIsPortfolio = isPortfolio(fromAddress)
  let toIsPortfolio = isPortfolio(toAddress)

  // Only process if at least one side is a 40 Acres portfolio
  if (!fromIsPortfolio && !toIsPortfolio) {
    return
  }

  // Handle transfer OUT from a portfolio (decrease balance)
  if (fromIsPortfolio && fromAddress != ZERO_ADDRESS) {
    let portfolio = getPortfolio(fromAddress)
    if (portfolio != null) {
      // For Pharaoh, use portfolio address as the UserAsset ID
      let userAssetId = fromAddress
      let userAsset = UserAsset.load(userAssetId)

      if (userAsset != null) {
        // Get current balance from contract
        let newBalance = getPharaohBalance(event.address, event.params.from)

        if (newBalance.equals(BigInt.fromI32(0))) {
          // Remove UserAsset if balance is zero
          store.remove('UserAsset', userAssetId)
        } else {
          userAsset.amount = newBalance
          userAsset.save()
        }
      }
    }
  }

  // Handle transfer IN to a portfolio (increase balance)
  if (toIsPortfolio && toAddress != ZERO_ADDRESS) {
    let portfolio = getPortfolio(toAddress)
    if (portfolio != null) {
      // For Pharaoh, use portfolio address as the UserAsset ID
      let userAssetId = toAddress
      let userAsset = UserAsset.load(userAssetId)

      if (userAsset == null) {
        userAsset = new UserAsset(userAssetId)
        userAsset.votes = []
        userAsset.isManual = false
        userAsset.isCollateral = false
        addToAllTimeAssets(portfolio, userAssetId)
      }

      let owner = getOrCreateAccount(portfolio.user)
      userAsset.owner = owner.id
      userAsset.portfolio = portfolio.id
      userAsset.type = 'veNFT' // Pharaoh is also a veNFT type, just ERC20-based

      // Get current balance from contract
      let newBalance = getPharaohBalance(event.address, event.params.to)
      userAsset.amount = newBalance
      userAsset.save()
    }
  }
}
