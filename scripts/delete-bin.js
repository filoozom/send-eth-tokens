// Dependencies
const fs = require('fs-extra')
const path = require('path')

// Script
fs.removeSync(path.join(__dirname, '/../bin/'))
