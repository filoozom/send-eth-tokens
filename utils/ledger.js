// Ledger
const { default: Eth } = require('@ledgerhq/hw-app-eth')
const { default: TransportNodeUid } = require('@ledgerhq/hw-transport-node-hid')

// Data
const PATH = "m/44'/60'/0'"

// Class
class Ledger {
  constructor(path = PATH) {
    this.path = path
  }

  async getAddress(address) {
    return this.ledger.getAddress(`${this.path}/${address}`)
  }

  async findPath(address) {
    for (let i = 0; i < 50; i++) {
      const data = await this.getAddress(i)
      if (data.address === address) {
        return `${this.path}/${i}`
      }
    }

    throw new Error('Did not find address with which to sign')
  }

  async start() {
    const transport = await TransportNodeUid.create()
    this.ledger = new Eth(transport)
  }

  async signTransaction(address, transaction) {
    // `v` needs to be set to the value of `chainId` or the transaction won't work
    // https://github.com/LedgerHQ/ledgerjs/issues/43#issuecomment-366984725
    transaction.v = transaction._chainId
    transaction.r = 0
    transaction.s = 0

    const result = await this.ledger.signTransaction(
      await this.findPath(address),
      transaction.serialize().toString('hex')
    )

    Object.keys(result).forEach(key => {
      transaction[key] = Buffer.from(result[key], 'hex')
    })

    return transaction
  }
}

// Exports
module.exports = Ledger
