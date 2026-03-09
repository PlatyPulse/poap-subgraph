import { BigInt, Address, store } from '@graphprotocol/graph-ts'
import { Transfer as VeNFTTransfer, VotingEscrowTransfer as VotingEscrowContract } from '../generated/VotingEscrowTransfer/VotingEscrowTransfer'
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
 * Gets the veNFT balance at a specific time using balanceOfNFTAt
 */
function getVeNFTBalance(contractAddress: Address, tokenId: BigInt, timestamp: BigInt): BigInt {
  let contract = VotingEscrowContract.bind(contractAddress)
  let balanceResult = contract.try_balanceOfNFTAt(tokenId, timestamp)
  if (balanceResult.reverted) {
    return BigInt.fromI32(0)
  }
  return balanceResult.value
}

/**
 * Handler for veNFT Transfer events (Aerodrome, Velodrome, Blackhole)
 * Transfer(indexed address from, indexed address to, indexed uint256 tokenId)
 */
export function handleVeNFTTransfer(event: VeNFTTransfer): void {
  let fromAddress = event.params.from.toHex()
  let toAddress = event.params.to.toHex()
  let tokenId = event.params.tokenId

  let fromIsPortfolio = isPortfolio(fromAddress)
  let toIsPortfolio = isPortfolio(toAddress)

  // Only process if at least one side is a 40 Acres portfolio
  if (!fromIsPortfolio && !toIsPortfolio) {
    return
  }

  // Get the current balance of the NFT
  let balance = getVeNFTBalance(event.address, tokenId, event.block.timestamp)
  let userAssetId = tokenId.toString()

  // Handle transfer OUT from a portfolio
  if (fromIsPortfolio && fromAddress != ZERO_ADDRESS) {
    let userAsset = UserAsset.load(userAssetId)
    if (userAsset != null && userAsset.portfolio == fromAddress) {
      // Remove the UserAsset since the NFT left the portfolio
      store.remove('UserAsset', userAssetId)
    }
  }

  // Handle transfer IN to a portfolio
  if (toIsPortfolio && toAddress != ZERO_ADDRESS) {
    let portfolio = getPortfolio(toAddress)
    if (portfolio != null) {
      let userAsset = UserAsset.load(userAssetId)
      if (userAsset == null) {
        userAsset = new UserAsset(userAssetId)
        userAsset.isManual = false
        userAsset.isCollateral = false
        addToAllTimeAssets(portfolio, userAssetId)
      }

      let owner = getOrCreateAccount(portfolio.user)
      userAsset.owner = owner.id
      userAsset.portfolio = portfolio.id
      userAsset.type = 'veNFT'
      userAsset.amount = balance
      userAsset.save()
    }
  }
}
