// Dependencies
const fs = require('fs-extra')
const path = require('path')
const { exec } = require('child_process')

// Data
const regex = /The addon must be distributed with executable as %2\.(?:\r\n|\r|\n)\s*([^\r\n\s]*)(?:\r\n|\r|\n)\s*([^\r\n\s]*)/g

// Script
// Remove the build folder if it exists
fs.removeSync(path.join(__dirname, '/../bin/'))

// Run the packaging code
const npm = exec('npm run pkg', (err, stdout) => {
  // Add comment
  console.log('\nAdding addons:\n')

  // Copy all addons
  let match
  do {
    match = regex.exec(stdout)
    if (match) {
      const destination = path.resolve(
        __dirname,
        '../bin/',
        match[2].replace('path-to-executable/', '')
      )

      console.log(`Moving ${match[1]} to ${destination}`)
      fs.copyFileSync(match[1], destination)
    }
  } while (match)

  // Copy data
  fs.mkdirSync(path.join(__dirname, '/../bin/data'))
  fs.copyFileSync(
    path.join(__dirname, '/../data/addresses.csv.template'),
    path.join(__dirname, '/../bin/data/addresses.csv')
  )
})

// Pipe stdout and stderr
npm.stdout.pipe(process.stdout)
npm.stderr.pipe(process.stderr)
