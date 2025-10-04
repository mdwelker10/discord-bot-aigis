const crypto = require('crypto');

const len = 32;
console.log(crypto.randomBytes(len).toString('hex'));