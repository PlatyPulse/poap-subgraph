import { Address, dataSource } from '@graphprotocol/graph-ts'
import { Portfolio, Account } from '../generated/schema'

export function getOrCreateAccount(address: string): Account {
  let account = Account.load(address)
  if (account == null) {
    account = new Account(address)
    account.save()
  }
  return account
}

export function getPortfolio(address: string): Portfolio | null {
  return Portfolio.load(address)
}

export function getVeNFTAddress(): Address {
  let network = dataSource.network()
  
  // Map network to veNFT contract address
  if (network == 'base') {
    // Aerodrome
    return Address.fromString('0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4')
  } else if (network == 'optimism') {
    // Velodrome
    return Address.fromString('0xFAf8FD17D9840595845582fCB047DF13f006787d')
  } else if (network == 'avalanche') {
    // Blackhole
    return Address.fromString('0xEac562811cc6abDbB2c9EE88719eCA4eE79Ad763')
  }
  
  // Default fallback (should not happen in production)
  return Address.fromString('0x0000000000000000000000000000000000000000')
}

