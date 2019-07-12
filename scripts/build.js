// Dependencies
const bindings = require('bindings')
const fs = require('fs-extra')
const path = require('path')
const { exec } = require('child_process')

// Data
const regex = /The addon must be distributed with executable as %2\.(?:\r\n|\r|\n)\s*([^\r\n\s]*)(?:\r\n|\r|\n)\s*([^\r\n\s]*)/g
const addons = [
  // Ledger
  { package: 'usb', file: 'usb_bindings.node' },
  { package: 'node-hid', file: 'HID.node' }
]

// Functions
function copyAddon(from, to) {
  console.log(`Copying ${from} to ${to}`)
  fs.copyFileSync(from, to)
}

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
      copyAddon(
        match[1],
        path.resolve(
          __dirname,
          '../bin/',
          match[2].replace('path-to-executable/', '')
        )
      )
    }
  } while (match)

  // Copy data
  fs.mkdirSync(path.join(__dirname, '/../bin/data'))
  fs.copyFileSync(
    path.join(__dirname, '/../data/addresses.csv.template'),
    path.join(__dirname, '/../bin/data/addresses.csv')
  )

  // Manually add some more modules not detected by zeit/pkg
  for (let { package, file } of addons) {
    const binding = bindings({
      bindings: file,
      module_root: path.join(__dirname, '../node_modules/', package),
      path: true
    })

    copyAddon(binding, path.join(__dirname, `/../bin/${path.parse(file).base}`))
  }
})

// Pipe stdout and stderr
npm.stdout.pipe(process.stdout)
npm.stderr.pipe(process.stderr)
