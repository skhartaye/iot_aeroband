import { getFullnodeUrl } from '@mysten/sui/client'

export const networkConfig = {
  networks: {
    testnet: getFullnodeUrl('testnet'),
    mainnet: getFullnodeUrl('mainnet'),
    devnet: getFullnodeUrl('devnet'),
  },
  defaultNetwork: 'testnet',
}

export const SUI_NETWORKS = {
  TESTNET: 'testnet',
  MAINNET: 'mainnet',
  DEVNET: 'devnet',
}
