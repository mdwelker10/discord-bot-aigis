/** Clean the temp directory every X files */
const config = require('../config.js');
const fs = require('fs');
const path = require('path');
const db = require('../database/db.js');
const axios = require('axios');

exports.cleanTemp = () => {
  const len = fs.readdirSync(config.TEMP_PATH).length;
  if (len >= config.TEMP_MAX_LENGTH) {
    for (const file of fs.readdirSync(config.TEMP_PATH)) {
      fs.unlinkSync(path.join(config.TEMP_PATH, file));
    }
  }
}

exports.getGuildConfig = async (guildId) => {
  const server = await db.findOne(config.DB_NAME, 'config', { 'guild_id': guildId });
  return server;
}

/**
 * Download an image from a given URL and save it to a given path
 * @param {*} url The URL to download the image from
 * @param {*} savepath The path to save the image to
 * @param {*} referer The referer header to set if necessary. If this value is truthy then it will be passed along with a user agent header
 * @returns {Promise<void>} A promise that resolves when the image is downloaded or rejects if an issue occurs
 */
exports.downloadImage = async (url, savepath, referer = null) => {
  if (savepath.includes(config.TEMP_PATH)) {
    exports.cleanTemp();
  }
  let obj = { responseType: 'stream' };
  if (referer) {
    obj['headers'] = { 'User-Agent': config.USER_AGENT, 'Referer': referer };
  }
  const res = await axios.get(url, obj);
  const writer = fs.createWriteStream(savepath, { autoClose: true, flags: 'w+' });
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      resolve(); //for manga being followed (attachment is manually built later)
    });
    writer.on('error', (err) => {
      console.error(err);
      reject();
    });
  });
}
