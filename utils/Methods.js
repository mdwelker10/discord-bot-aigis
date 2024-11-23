/** Clean the temp directory every X files */
const config = require('../config.js');
const fs = require('fs');
const path = require('path');
const db = require('../database/db.js');

exports.cleanTemp = () => {
  const len = fs.readdirSync(path.join(__dirname, '..', 'temp')).length;
  if (len >= config.TEMP_MAX_LENGTH) {
    for (const file of fs.readdirSync(path.join(__dirname, '..', 'temp'))) {
      fs.unlinkSync(path.join(__dirname, '..', 'temp', file));
    }
  }
}

exports.getGuildConfig = async (guildId) => {
  const server = await db.findOne(config.DB_NAME, 'config', { 'guild_id': guildId });
  return server;
}