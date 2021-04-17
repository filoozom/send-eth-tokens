# send-eth-tokens

send ETH/ERC20 tokens at the same time to multiple wallet addresses. 

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/filoozom/send-eth-tokens.git
   ```
2. Install specific version of node
   ```sh
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
   export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   nvm install 10.14.2
   ```
4. Install NPM packages
   ```JS
   npm install request
   ```
### Usage
  
    node index.js --help
    
      Commands:
      index.js transfer       Transfer ethereum or tokens from addresses to others
      index.js list-tokens    List available tokens
      index.js ledger         List addresses from a Ledger device (takes some time)
      index.js generate-keys  Generate ethereum acconts
      index.js list-balances  List balances

      Options:
       --version   Show version number                                      [boolean]
       -h, --help  Show help  
 #### Example for transfer
 
Request funds https://faucet.goerli.mudit.blog/

Edit `data/addresses.csv` and then run the following commands:<br>
```sh
node index.js transfer --from source --to @target --network goerli --amount 0.05 --gas 1
```

If you want to send token:<br>
```sh
node index.js transfer --from source --to @target --network goerli --amount 10 --token gbzz --gas 1
```
