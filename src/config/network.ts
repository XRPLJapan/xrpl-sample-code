import { env } from './env';

enum EnvTypes {
  devnet = 'devnet',
  testnet = 'testnet',
  mainnet = 'mainnet',
}

type NetworkType = {
  rpc: string;
  ws: string;
  explorer: string;
};

const networks: Record<EnvTypes, NetworkType> = {
  [EnvTypes.mainnet]: {
    rpc: 'https://xrplcluster.com',
    ws: 'wss://xrplcluster.com',
    explorer: 'https://livenet.xrpl.org',
  },
  [EnvTypes.testnet]: {
    rpc: 'https://s.altnet.rippletest.net:51234',
    ws: 'wss://s.altnet.rippletest.net:51233',
    explorer: 'https://testnet.xrpl.org',
  },
  [EnvTypes.devnet]: {
    rpc: 'https://s.devnet.rippletest.net:51234',
    ws: 'wss://s.devnet.rippletest.net:51233',
    explorer: 'https://devnet.xrpl.org',
  },
};

export const getNetworkUrl = (): NetworkType => {
  return networks[env.NODE_ENV as EnvTypes];
};
