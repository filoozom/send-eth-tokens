// Dependencies
const BigNumber = require('bignumber.js')
const fs = require('fs')
const path = require('path')
const Tx = require('ethereumjs-tx')
const Web3 = require('web3')

// Ledger
const { default: Eth } = require('@ledgerhq/hw-app-eth')
const { default: TransportNodeUid } = require('@ledgerhq/hw-transport-node-hid')

// Utils
const networks = require('./networks')
const tokens = require('./tokens')
const { decodeTokens } = require('./binary-decoder')

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

  async getTokenConfig(token, key) {
    const tokenConfig = (await this.getTokens())[token]
    return key ? tokenConfig[key] : tokenConfig
  }

  getAbi(name) {
    return JSON.parse(
      fs.readFileSync(path.resolve(__dirname, `../abis/${name}.json`), {
        encoding: 'utf8'
      })
    )
  }

  // https://github.com/MyEtherWallet/utility-contracts/raw/master/build/contracts/PublicTokens.json
  getPublicTokensContract() {
    return new this.web3.eth.Contract(
      this.getAbi('public-tokens'),
      '0xBE1ecF8e340F13071761e0EeF054d9A511e1Cb56'
    )
  }

  // https://github.com/ethereum/wiki/wiki/Contract-ERC20-ABI
  async getTokenContract(token, from) {
    return new this.web3.eth.Contract(
      this.getAbi('erc20'),
      await this.getTokenConfig(token, 'address'),
      {
        from
      }
    )
  }

  async getTokens(refresh = false) {
    const tokensPath = path.join(process.cwd(), '/data/tokens.json')

    if (!refresh) {
      try {
        const json = fs.readFileSync(tokensPath)
        return (this.tokens = JSON.parse(json))
      } catch (_) {}
    }

    if (this.network.name !== 'mainnet') {
      return tokens[this.network.name]
    }

    if (this.tokens) {
      return this.tokens
    }

    const contract = this.getPublicTokensContract()
    const method = contract.methods.getAllBalance(
      '0xBE1ecF8e340F13071761e0EeF054d9A511e1Cb56',
      true,
      false,
      false,
      0
    )

    const hex = await method.call()
    const result = {}

    decodeTokens(hex).forEach(token => {
      delete token.balance
      result[token.symbol.toLowerCase()] = token
    })

    try {
      fs.writeFileSync(tokensPath, JSON.stringify(result, null, 2))
    } catch (err) {
      console.error('Could not save tokens:', err)
    }

    return (this.tokens = result)
  }

  toBigNumber(number) {
    return new BigNumber(number)
  }

  async toDecimals(amount, { token, opposite } = {}) {
    amount = this.toBigNumber(amount)

    if (!token) {
      const method = opposite ? 'fromWei' : 'toWei'
      return this.toBigNumber(
        this.web3.utils[method](amount.toString(), 'ether')
      )
    }

    let decimals = this.toBigNumber(
      await this.getTokenConfig(token, 'decimals')
    )

    if (opposite) {
      decimals = decimals.multipliedBy(-1)
    }

    return amount.multipliedBy(this.toBigNumber(10).pow(decimals))
  }

  async fromDecimals(amount, data) {
    return await this.toDecimals(amount, {
      ...data,
      opposite: true
    })
  }

  async getLedger() {
    if (!this.ledger) {
      const transport = await TransportNodeUid.create()
      this.ledger = new Eth(transport)
    }

    return this.ledger
  }

  async sendSigned(rawTransaction, sign) {
    const transaction = new Tx(rawTransaction)

    switch (sign.type) {
      case 'privateKey':
        const privateKey = Buffer.from(sign.privateKey, 'hex')
        transaction.sign(privateKey)
        break

      case 'ledger':
        const ledger = await this.getLedger()
        const result = await ledger.signTransaction(
          "44'/60'",
          transaction.serialize().toString('hex')
        )
        Object.keys(result).forEach(key => {
          transaction[key] = Buffer.from(result[key], 'hex')
        })
        break

      default:
        throw new Error('No signing method given')
    }

    const serializedTx = '0x' + transaction.serialize().toString('hex')
    const method = this.web3.eth.sendSignedTransaction.method
    const payload = method.toPayload([serializedTx])

    return new Promise((resolve, reject) => {
      method.requestManager.send(payload, (err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }

  getGasPrice(price) {
    return this.web3.utils.toHex(price * 1e9)
  }

  async getEthereumBalance(address) {
    return this.toBigNumber(await this.web3.eth.getBalance(address))
  }

  async getTokenBalance(contract, address) {
    return this.toBigNumber(await contract.methods.balanceOf(address).call())
  }

  async getNonce(from, addNonce = 0) {
    const transactionCount = await this.web3.eth.getTransactionCount(from)
    return this.web3.utils.toHex(transactionCount + addNonce)
  }

  async sendTokens(data) {
    const tokenConfig = await this.getTokenConfig(data.token)

    if (!tokenConfig) {
      throw new Error('Unknown token')
    }

    const contract = await this.getTokenContract(data.token, data.from)

    if (data.amount) {
      data.amount = await this.toDecimals(data.amount, { token: data.token })
    }

    if (data.keep) {
      const balance = await this.getTokenBalance(contract, data.from)
      data.amount = balance.minus(
        await this.toDecimals(data.keep, { token: data.token })
      )
    }

    if (data.amount <= 0) {
      return
    }

    const result = {
      message: `Send ${await this.fromDecimals(data.amount, {
        token: data.token
      })} ${data.token.toUpperCase()} tokens from ${data.from} to ${data.to}`
    }

    if (data.dryRun) {
      return result
    }

    const method = contract.methods.transfer(data.to, data.amount)
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

    return new Promise(async (resolve, reject) => {
      try {
        const tx = await this.sendSigned(rawTransaction, data.sign)
        resolve({
          ...result,
          tx
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  async sendEthereum(data) {
    const gasPrice = this.getGasPrice(data.gasPrice)
    const gasLimit = 21000

    if (data.amount) {
      data.amount = await this.toDecimals(data.amount)
    }

    if (data.keep) {
      const balance = await this.getEthereumBalance(data.from)
      data.amount = balance.minus(
        await this.toDecimals(data.keep).minus(gasLimit * gasPrice)
      )
    }

    if (data.amount <= 0) {
      return
    }

    const result = {
      message: `Send ${await this.fromDecimals(data.amount)} ethereum from ${
        data.from
      } to ${data.to}`
    }

    if (data.dryRun) {
      return result
    }

    const rawTransaction = {
      from: data.from,
      nonce: await this.getNonce(data.from, data.addNonce),
      gasPrice,
      gasLimit,
      to: data.to,
      value: this.web3.utils.toHex(data.amount),
      chainId: this.network.chainId
    }

    return new Promise(async (resolve, reject) => {
      try {
        const tx = await this.sendSigned(rawTransaction, data.sign)
        resolve({
          ...result,
          tx
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  async send(data) {
    if (data.token) {
      return this.sendTokens(data)
    }

    return this.sendEthereum(data)
  }

  close() {
    if (this.engine) {
      this.engine.stop()
      this.engine = null
    }
  }
}

// Export
module.exports = Ethereum
