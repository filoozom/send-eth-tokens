// Dependencies
const fs = require('fs')
const path = require('path')

// Config
const addons = [
  'sha3/build/Release/sha3.node',
  'scrypt/build/Release/scrypt.node',
  'websocket/build/Release/bufferutil.node',
  'websocket/build/Release/validation.node'
]

// Script
for (let addon of addons) {
  fs.copyFileSync(
    path.join(__dirname, '/../node_modules/', addon),
    path.join(__dirname, `/../bin/${path.parse(addon).base}`)
  )
}

fs.mkdirSync(path.join(__dirname, '/../bin/data'))
fs.copyFileSync(
  path.join(__dirname, '/../data/addresses.csv.template'),
  path.join(__dirname, '/../bin/data/addresses.csv')
)
