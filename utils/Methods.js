/** Clean the temp directory every X files */
const config = require('../config.js');
const fs = require('fs');
const path = require('path');

exports.cleanTemp = () => {
  const len = fs.readdirSync(path.join(__dirname, '..', 'temp')).length;
  if (len >= config.TEMP_MAX_LENTH) {
    for (const file of fs.readdirSync(path.join(__dirname, '..', 'temp'))) {
      fs.unlinkSync(path.join(__dirname, '..', 'temp', file));
    }
  }
}