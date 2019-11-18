// Dependencies
const axios = require('axios')
const BigNumber = require('bignumber.js')
const fs = require('fs')
const path = require('path')
const Tx = require('ethereumjs-tx')
const Web3 = require('web3')

// Utils
const networks = require('./networks')
const tokens = require('./tokens')
const Ledger = require('./ledger')

// Class
class Ethereum {
  constructor(network = 'mainnet') {
    this.network = networks[network]

    if (!this.network) {
      throw new Error('Unknown network')
    }

    this.web3 = new Web3(new Web3.providers.HttpProvider(this.network.provider))
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

  // https://github.com/ethereum/wiki/wiki/Contract-ERC20-ABI
  async getTokenContract(token, defaultAccount) {
    return new this.web3.eth.Contract(
      this.getAbi('erc20'),
      await this.getTokenConfig(token, 'address'),
      {
        defaultAccount
      }
    )
  }

  async getTokens(refresh = false) {
    if (this.network.name !== 'mainnet') {
      return tokens[this.network.name]
    }

    const tokensPath = path.join(process.cwd(), '/data/tokens.json')

    if (!refresh) {
      try {
        const json = fs.readFileSync(tokensPath)
        return (this.tokens = JSON.parse(json))
      } catch (_) {}
    }

    if (this.tokens) {
      return this.tokens
    }

    let result
    try {
      const { data } = await axios(
        'https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/dist/tokens/eth/tokens-eth.min.json'
      )
      result = data.reduce((tokens, token) => {
        tokens[token.symbol.toLowerCase()] = token
        return tokens
      }, {})
    } catch (err) {
      console.error('Could not fetch tokens:', err)
      return
    }

    try {
      fs.writeFileSync(tokensPath, JSON.stringify(result, null, 2))
    } catch (err) {
      console.error('Could not save tokens:', err)
      return
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
        this.web3.utils[method](amount.toString(10), 'ether')
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
      this.ledger = new Ledger()
      await this.ledger.start()
    }

    return this.ledger
  }

  async signTransaction(transaction, sign) {
    switch (sign.type) {
      case 'privateKey':
        const privateKey = Buffer.from(sign.privateKey, 'hex')
        transaction.sign(privateKey)
        return transaction

      case 'ledger':
        const ledger = await this.getLedger()
        return await ledger.signTransaction(sign.from, transaction)

      default:
        throw new Error('No signing method given')
    }
  }

  async sendSigned(rawTransaction, sign) {
    const transaction = await this.signTransaction(new Tx(rawTransaction), {
      ...sign,
      from: rawTransaction.from
    })
    const serializedTx = '0x' + transaction.serialize().toString('hex')

    return new Promise((resolve, reject) => {
      this.web3.eth.sendSignedTransaction(serializedTx, (err, result) => {
        if (err) {
          reject(err)
          return
        }
        resolve(result)
      })
    })
  }

  getGasPrice(price) {
    return this.web3.utils.toHex(this.getGasPriceBigNumber(price))
  }

  getGasPriceBigNumber(price) {
    return this.toBigNumber(price).times(1e9)
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

  async getTokensData(data) {
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

    // Current ethereum balance
    const ethBalance = await this.getEthereumBalance(data.from)

    // Calculate gas
    // Cannot pass a BigNumber.js instance for now: https://github.com/ethereum/web3.js/issues/2077#issuecomment-482932690
    const method = contract.methods.transfer(data.to, data.amount.toFixed())
    const gasLimit = this.web3.utils.toHex(
      await method.estimateGas({
        from: data.from
      })
    )
    const totalGas = this.getGasPriceBigNumber(data.gasPrice).times(gasLimit)

    // Create message
    const innerMessage = `${await this.fromDecimals(data.amount, {
      token: data.token
    })} ${data.token.toUpperCase()} tokens from ${data.from} to ${data.to}`

    // Check if there is enough ether to pay for gas
    if (ethBalance.lt(totalGas)) {
      return {
        message: `Not enough ether to pay for gas to send ${innerMessage} (${await this.fromDecimals(
          ethBalance
        )} < ${await this.fromDecimals(totalGas)})`
      }
    }

    const message = `Send ${innerMessage}`

    if (data.dryRun) {
      return { message }
    }

    return {
      transactionData: {
        gasLimit,
        to: tokenConfig.address,
        value: '0x0',
        data: method.encodeABI()
      },
      message
    }
  }

  async getEthereumData(data) {
    const gasLimit = 21000

    if (data.amount) {
      data.amount = await this.toDecimals(data.amount)
    }

    if (data.keep) {
      const balance = await this.getEthereumBalance(data.from)
      data.amount = balance.minus(
        await this.toDecimals(data.keep).minus(
          gasLimit * this.getGasPriceBigNumber(data.gasPrice)
        )
      )
    }

    if (data.amount <= 0) {
      return
    }

    const message = `Send ${await this.fromDecimals(
      data.amount
    )} ethereum from ${data.from} to ${data.to}`

    if (data.dryRun) {
      return { message }
    }

    return {
      transactionData: {
        gasLimit,
        to: data.to,
        value: this.web3.utils.toHex(data.amount)
      },
      message
    }
  }

  async send(data) {
    const txData = data.token
      ? await this.getTokensData(data)
      : await this.getEthereumData(data)

    if (!txData) {
      return
    }

    const { transactionData, message } = txData

    if (!transactionData) {
      return { message }
    }

    const rawTransaction = Object.assign(
      {
        from: data.from,
        gasPrice: this.getGasPrice(data.gasPrice),
        nonce: await this.getNonce(data.from, data.addNonce),
        chainId: this.network.chainId
      },
      transactionData
    )

    return new Promise(async (resolve, reject) => {
      try {
        const tx = await this.sendSigned(rawTransaction, data.sign)
        resolve({ message, tx })
      } catch (err) {
        reject(err)
      }
    })
  }
}

// Export
module.exports = Ethereum
