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

  toDecimals(amount, { token, opposite }) {
    amount = parseFloat(amount)

    if (!token) {
      const method = opposite ? 'fromWei' : 'toWei'
      return this.web3.utils[method](amount, 'ether')
    }

    let decimals = this.getTokenConfig(token).decimals

    if (opposite) {
      decimals = -1 * decimals
    }

    return amount * 10 ** decimals
  }

  fromDecimals(amount, data) {
    return this.toDecimals(amount, {
      ...data,
      opposite: true
    })
  }

  sendSigned(rawTransaction, key) {
    const privateKey = new Buffer(key, 'hex')
    const transaction = new Tx(rawTransaction)
    transaction.sign(privateKey)

    const serializedTx = transaction.serialize().toString('hex')
    return this.web3.eth.sendSignedTransaction('0x' + serializedTx)
  }

  getGasPrice(price) {
    return this.web3.utils.toHex(price * 1e9)
  }

  getEthereumBalance(address) {
    return this.web3.eth.getBalance(address)
  }

  async getTokenBalance(contract, address) {
    return parseFloat(await contract.methods.balanceOf(address).call())
  }

  async getNonce(from, addNonce = 0) {
    const transactionCount = await this.web3.eth.getTransactionCount(from)
    return this.web3.utils.toHex(transactionCount + addNonce)
  }

  async sendTokens(data) {
    const tokenConfig = this.getTokenConfig(data.token)

    if (!tokenConfig) {
      throw new Error('Unknown token')
    }

    const contract = this.getContract(data.token, data.from)

    if (data.keep) {
      const balance = await this.getTokenBalance(contract, data.from)
      data.amount = balance - this.toDecimals(data.keep, { token: data.token })
    }

    if (data.amount <= 0) {
      return
    }

    if (data.dryRun) {
      return `Send ${this.fromDecimals(data.amount, {
        token: data.token
      })} ${data.token.toUpperCase()} tokens from ${data.from} to ${data.to}`
    }

    const method = contract.methods.transfer(
      data.to,
      this.toDecimals(data.amount, { token: data.token })
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

  async sendEthereum(data) {
    const gasPrice = this.getGasPrice(data.gasPrice)
    const gasLimit = 21000

    if (data.keep) {
      const balance = this.getEthereumBalance(data.from)
      data.amount = balance - this.toDecimals(data.keep) - gasLimit * gasPrice
    }

    if (data.amount <= 0) {
      return
    }

    if (data.dryRun) {
      return `Send ${this.fromDecimals(data.amount)} ethereum from ${
        data.from
      } to ${data.to}`
    }

    const rawTransaction = {
      from: data.from,
      nonce: await this.getNonce(data.from, data.addNonce),
      gasPrice,
      gasLimit,
      to: data.to,
      value: this.web3.utils.toHex(this.toDecimals(data.amount)),
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
