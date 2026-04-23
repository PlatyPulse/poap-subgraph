// AUTO-GENERATED from config/<name>.json via `pnpm prepare:<name>`.
// Do not edit by hand — this file is regenerated on every prepare step.
// The committed source lives in src/generated-config.template.ts.

import { Address, Bytes } from '@graphprotocol/graph-ts'

// Sub-factory addresses that this subgraph deployment should index portfolios for.
// Multiple subgraphs can share a PortfolioFactory on the same chain (e.g. Supernova +
// YieldBasis both on mainnet), so PortfolioRegistered events are filtered by the indexed
// `factory` param to avoid cross-asset contamination.
export const ALLOWED_SUB_FACTORIES: string[] = '{{ portfolioSubFactories }}'.toLowerCase().split(',')

// Token address used for asset balance lookups (veNFT.balanceOfNFTAt or ERC20.balanceOf).
export const VE_NFT_ADDRESS: Address = Address.fromString('{{ veNFTAddress }}')

// Debt token fallback when PortfolioAccountConfig.getDebtToken() reverts.
export const DEFAULT_BORROW_TOKEN: Bytes = Bytes.fromHexString('{{ defaultBorrowToken }}')
