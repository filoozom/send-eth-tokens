module.exports = {
  ropsten: {
    name: 'ropsten',
    provider: 'https://ropsten.infura.io/v3/a920c260dd3145c5a3770e182c3333d8',
    chainId: 3,
    etherscan: {
      getTxUrl: tx => {
        return `https://ropsten.etherscan.io/tx/${tx}`
      }
    }
  },
  mainnet: {
    name: 'mainnet',
    provider: 'https://api.myetherwallet.com/eth',
    // provider: 'https://mainnet.infura.io/v3/a920c260dd3145c5a3770e182c3333d8',
    chainId: 1,
    etherscan: {
      getTxUrl: tx => {
        return `https://etherscan.io/tx/${tx}`
      }
    }
  }
}
