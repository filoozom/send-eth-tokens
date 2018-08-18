// Utils
const Ethereum = require('../utils/ethereum')
const csvData = require('../utils/csv-data')

// Class
class TransferCommand {
  constructor(args) {
    this.args = args
    this.ethereum = new Ethereum(args.network)
  }

  async getAddresses(query) {
    const address = await csvData.getAddress(query)

    if (address) {
      return [address]
    } else {
      return await csvData.getNames(query)
    }
  }

  async searchAddresses(query) {
    const addresses = await this.getAddresses(query)

    if (!addresses || !addresses.length) {
      throw new Error(`No address was found for the following query: ${query}`)
    }

    for (let address of addresses) {
      if (!this.ethereum.web3.utils.isAddress(address.address)) {
        throw new Error(`The following address is invalid: ${address.address}`)
      }
    }

    return addresses
  }

  async generateTransactions(fromArray, toArray) {
    if (fromArray.length > 1 && toArray.length > 1) {
      throw new Error(
        'Multiple origin and destination addresses are not allowed at the same time'
      )
    }

    const { amount, gas, token, keep, dryRun } = this.args
    const promises = []
    const results = []
    let addNonce = 0
    let ledgerSign = 0

    for (let from of fromArray) {
      if (from.sign === 'ledger') {
        ledgerSign++
      }
    }

    for (let from of fromArray) {
      for (let to of toArray) {
        const promise = this.ethereum.send({
          sign: {
            type: from.sign,
            privateKey: from.privateKey
          },
          from: from.address,
          to: to.address,
          gasPrice: gas,
          addNonce: addNonce++,
          amount,
          token,
          keep,
          dryRun
        })

        // Ledger signatures must be done sequentially
        if (ledgerSign > 1 && from.sign === 'ledger') {
          try {
            results.push(await promise)
          } catch (err) {
            console.error(err)
          }
        } else {
          promises.push(promise.catch(err => console.log(err)))
        }
      }
    }

    return results.concat(await Promise.all(promises))
  }

  async execute({ convert }) {
    if (this.args.from.startsWith('@') && this.args.to.startsWith('@')) {
      throw new Error(
        "You can't use a group for both the origin and destination addresses at the same time"
      )
    }

    const from = await this.searchAddresses(this.args.from)
    const to = await this.searchAddresses(this.args.to)

    if (this.args.keep && to.length > 1) {
      throw new Error('--keep cannot be used with multiple destinations')
    }

    const transactions = (await this.generateTransactions(from, to)).filter(
      tx => !!tx
    )

    if (!this.args.dryRun && convert === 'etherscan') {
      return transactions.map(tx => ({
        ...tx,
        txUrl: this.ethereum.network.etherscan.getTxUrl(tx.tx)
      }))
    }

    return transactions
  }
}

// Functions
async function command(args) {
  const command = new TransferCommand(args)

  try {
    ;(await command.execute({
      convert: 'etherscan'
    })).forEach(tx => {
      console.log(tx.message)

      if (!args.dryRun) {
        console.log(tx.txUrl)
        console.log()
      }
    })
  } catch (err) {
    console.error(err)
  }
}

// Exports
module.exports = command
