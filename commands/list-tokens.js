// Utils
const Ethereum = require('../utils/ethereum')

// Class
class ListTokensCommand {
  constructor(args) {
    this.args = args
    this.ethereum = new Ethereum(args.network)
  }

  async execute() {
    return await this.ethereum.getTokens()
  }
}

// Functions
async function command(args) {
  try {
    const tokens = await new ListTokensCommand(args).execute()
    console.log(`${Object.keys(tokens).length} tokens are supported:`)
    Object.keys(tokens)
      .sort()
      .forEach(symbol => {
        const { name } = tokens[symbol]
        console.log(`${symbol}: ${name}`)
      })
  } catch (err) {
    console.error(err)
  }
}

// Exports
module.exports = command
