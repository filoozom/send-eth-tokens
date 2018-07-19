// Dependencies
const yargs = require('yargs')

// Utils
const Ethereum = require('./utils/ethereum')
const networks = require('./utils/networks')
const tokens = require('./utils/tokens')

// Commands
const transferCommand = require('./commands/transfer')

// Parse args
yargs
  .command(
    'transfer',
    'Transfer ethereum or tokens from addresses to others',
    yargs => {
      yargs
        .option('from', {
          demandOption: true,
          describe: 'Origin address(es)',
          nargs: 1
        })
        .option('to', {
          demandOption: true,
          describe: 'Destination address(es)',
          nargs: 1
        })
        .option('token', {
          describe: 'Send tokens instead of ethereum',
          nargs: 1
        })
        .option('amount', {
          describe: 'Amount of ethereum or tokens to send',
          nargs: 1,
          conflicts: 'keep',
          type: 'string'
        })
        .option('keep', {
          describe: 'Keep at least that amount of tokens',
          nargs: 1,
          conflicts: 'amount',
          type: 'string'
        })
        .option('network', {
          demandOption: true,
          describe: 'Change the network on which to send the transactions',
          nargs: 1,
          choices: Object.keys(networks),
          default: 'mainnet'
        })
        .option('gas', {
          describe: 'Set the gas price (in gwei)',
          nargs: 1,
          default: 50,
          type: 'number'
        })
        .option('dry-run', {
          describe:
            'Simulate which transactions will be created without sending them',
          nargs: 0,
          type: 'boolean',
          default: false
        })
        .check(argv => {
          if (!argv.keep && !argv.amount) {
            throw new Error('You must use either --keep or --amount')
          }
          return true
        })
    },
    transferCommand
  )
  .command(
    'list-tokens',
    'List available tokens',
    yargs => {
      yargs.option('network', {
        demandOption: true,
        alias: 'n',
        nargs: 1,
        describe: 'Network for which to list tokens',
        choices: Object.keys(networks)
      })
    },
    argv => {
      Object.keys(tokens[argv.network]).forEach(token => console.log(token))
    }
  )
  .help('h')
  .alias('h', 'help').argv

// Error handling
process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error.message)
})
