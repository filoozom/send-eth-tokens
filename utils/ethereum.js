// Dependencies
const fs = require('fs')
const path = require('path')
const Tx = require('ethereumjs-tx')
const Web3 = require('web3')

// Utils
const networks = require('./networks')
const tokens = require('./tokens')

// Class
class Ethereum {
  constructor(network = 'mainnet') {
    this.network = networks[network]

    if (!this.network) {
      throw new Error('Unknown network')
    }

    this.web3 = new Web3()
    this.web3.setProvider(
      new this.web3.providers.HttpProvider(this.network.provider)
    )
  }

  getTokenConfig(token) {
    return tokens[this.network.name][token]
  }

  getAbi(token) {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `/../abis/${this.network.name}/${token}.json`),
        {
          encoding: 'utf8'
        }
      )
    )
  }

  getContract(token, from) {
    return new this.web3.eth.Contract(
      this.getAbi(token),
      this.getTokenConfig(token).address,
      {
        from
      }
    )
  }

  toDecimals(token, amount) {
    return parseFloat(amount) * 10 ** this.getTokenConfig(token).decimals
  }

  sendSigned(rawTransaction, key) {
    const privateKey = new Buffer(key, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)

    const serializedTx = transaction.serialize().toString('hex')
    return this.web3.eth.sendSignedTransaction('0x' + serializedTx)
  }

  async sendTokens(data) {
    const tokenConfig = this.getTokenConfig(data.token)

    if (!tokenConfig) {
      throw new Error('Unknown token')
    }

    const contract = this.getContract(data.token, data.from)
    const method = contract.methods.transfer(
      data.to,
      this.toDecimals(data.token, data.amount)
    )
    const rawTransaction = {
      from: data.from,
      nonce: await this.getNonce(data.from, data.addNonce),
      gasPrice: this.getGasPrice(data.gasPrice),
      gasLimit: this.web3.utils.toHex(
        await method.estimateGas({
          from: data.from
        })
      ),
      to: tokenConfig.address,
      value: '0x0',
      data: method.encodeABI(),
      chainId: this.network.chainId
    }

    return new Promise(resolve => {
      this.sendSigned(rawTransaction, data.privateKey).once(
        'transactionHash',
        resolve
      )
    })
  }

  async getNonce(from, addNonce = 0) {
    const transactionCount = await this.web3.eth.getTransactionCount(from)
    return this.web3.utils.toHex(transactionCount + addNonce)
  }

  getGasPrice(price) {
    return this.web3.utils.toHex(price * 1e9)
  }

  async sendEthereum(data) {
    const rawTransaction = {
      from: data.from,
      nonce: await this.getNonce(data.from, data.addNonce),
      gasPrice: this.getGasPrice(data.gasPrice),
      gasLimit: 21000,
      to: data.to,
      value: this.web3.utils.toHex(this.web3.utils.toWei(data.amount, 'ether')),
      chainId: this.network.chainId
    }

    return new Promise(resolve => {
      this.sendSigned(rawTransaction, data.privateKey).once(
        'transactionHash',
        resolve
      )
    })
  }

  async send(data) {
    if (data.token) {
      return this.sendTokens(data)
    }

    return this.sendEthereum(data)
  }
}

// Export
module.exports = Ethereum
