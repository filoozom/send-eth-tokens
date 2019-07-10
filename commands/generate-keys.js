// Dependencies
const Web3 = require('web3')

// Class
class GenerateKeysCommand {
  constructor(args) {
    this.args = args
    this.web3 = new Web3()
  }

  *execute() {
    for (let i = 0; i < this.args.limit; i++) {
      const { address, privateKey } = this.web3.eth.accounts.create()
      yield { address, privateKey }
    }
  }
}

// Functions
async function command(args) {
  const command = new GenerateKeysCommand(args)

  try {
    console.log(`${'Address'.padEnd(42, ' ')}\tPrivate Key`)
    for (const { address, privateKey } of command.execute()) {
      console.log(`${address}\t${privateKey}`)
    }
  } catch (err) {
    console.error(err)
  }
}

// Exports
module.exports = command
