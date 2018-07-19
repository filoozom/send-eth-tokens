// Dependencies
const csv = require('csvtojson')
const path = require('path')

// Cache
let data

// Functions
async function getData() {
  if (data) {
    return data
  }

  const file = path.join(__dirname, '../data/addresses.csv')
  return (data = await csv({
    delimiter: ';'
  }).fromFile(file))
}

function matchSearch(search, name) {
  if (search.startsWith('@')) {
    search = search.substr(1)
  }

  if (search.startsWith('/') && search.endsWith('/')) {
    search = search.substr(1, search.length - 2)
    return !!name.match(new RegExp(`^${search}$`))
  }

  return search === name
}

async function getNames(search) {
  const matches = (await getData()).filter(line =>
    matchSearch(search, line.name)
  )

  if (!search.startsWith('@') && matches.length > 1) {
    throw new Error(
      `The search "${search}" matches multiple addresses but does not starts with an "@"`
    )
  }

  return matches
}

async function getAddress(address) {
  const addresses = (await getData()).filter(line => line.address === address)

  if (addresses.length !== 1) {
    return null
  }

  return addresses[0]
}

// Exports
module.exports = {
  getData,
  getNames,
  getAddress
}
