// Utils
const Ledger = require('../utils/ledger')

// Class
class LedgerCommand {
  constructor(args) {
    this.args = args
    this.ledger = new Ledger()
  }

  async execute() {
    await this.ledger.start()
    return await this.ledger.getAddresses(this.args.limit)
  }
}

// Functions
async function command(args) {
  const command = new LedgerCommand(args)

  try {
    const addresses = await command.execute()

    console.log('Addresses:')
    for (const address of addresses) {
      console.log(address.address)
    }
  } catch (err) {
    console.error(err)
  }
}

// Exports
module.exports = command
