// Utils
const Ethereum = require('../utils/ethereum')
const csvData = require('../utils/csv-data')

// Class
class ListBalancesCommand {
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

  async execute() {
    const { filter, token } = this.args
    const addresses = filter
      ? await this.searchAddresses(filter)
      : await csvData.getData()

    let getBalance = this.ethereum.getEthereumBalance.bind(this.ethereum)

    if (token) {
      const contract = await this.ethereum.getTokenContract(token)
      getBalance = this.ethereum.getTokenBalance.bind(this.ethereum, contract)
    }

    return await Promise.all(
      addresses.map(async address => ({
        ...address,
        balance: await this.ethereum.fromDecimals(
          await getBalance(address.address),
          { token }
        )
      }))
    )
  }
}

// Functions
async function command(args) {
  const command = new ListBalancesCommand(args)

  try {
    ;(await command.execute()).forEach(({ name, address, balance }) => {
      console.log(`${name || address}: ${balance} ${args.token || 'eth'}`)
    })
  } catch (err) {
    console.error(err)
  }
}

// Exports
module.exports = command
