const config = require('../config.js');
const fs = require('fs');
const path = require('path');
const db = require('../database/db.js');
const axios = require('axios');
const AigisError = require('./AigisError.js');

/** Will clean the temp directory if the number of files is greater than config.TEMP_MAX_LENGTH */
exports.cleanTemp = () => {
  const len = fs.readdirSync(config.TEMP_PATH).length;
  if (len >= config.TEMP_MAX_LENGTH) {
    for (const file of fs.readdirSync(config.TEMP_PATH)) {
      fs.unlinkSync(path.join(config.TEMP_PATH, file));
    }
  }
}

/**
 * Returns the guild config object from the database, or null if it doesn't exist
 * @param {*} guildId The ID of the guild to get the config for
 * @returns {Promise<Object|null>} The guild config object from the database, or null if it doesn't exist
 */
exports.getGuildConfig = async (guildId) => {
  const server = await db.findOne(config.DB_NAME, 'config', { 'guild_id': guildId });
  return server ?? null;
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

/**
 * returns a map of filename -> folder/filename for all non-admin command files. 
 * By default includes an "all" entry to represetn an all commands selection options
 * */
exports.getCommandNames = (ignoreAllEntry = false) => {
  commands = ignoreAllEntry ? {} : { all: 'all' };
  const foldersPath = path.join(__dirname, '..', 'commands');
  const commandFolders = fs.readdirSync(foldersPath).filter(folder => folder !== 'admin');
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const commandName = file.split('.')[0];
      commands[commandName] = `${folder}/${commandName}`;
    }
  }
  return commands;
}

/** Uses process.env.DEVELOPER_IDS to determine if a given ID is a developer */
exports.isDeveloper = (userId) => {
  return process.env.DEVELOPER_IDS.split(',').includes(userId);
}

/**
 * Check if the user can execute a privileged command by seeing if they have the appropriate role.
 * Throws an AigisError if the role no longer exists or an error occurs while checking.
 * @param {*} guildMember A GuildMember object representing the user as a member of the guild in question. This can be obtained via interaction.member
 * @param {*} guildConfig The guild config object for the guild in question
 * @returns {Promise<boolean>} A promise that resolves to true if the user has the appropriate role, or false if they do not
 */
exports.checkPermission = async (guildMember, guildConfig) => {
  const roleId = guildConfig['permission_role_id'];
  if (roleId == 'everyone') {
    return true;
  }
  //ensure role still exists
  try {
    let exists = await guildMember.guild.roles.fetch(roleId);
    if (!exists) {
      console.warn(`Privileged role ${roleId} no longer exists in guild ${guildMember.guild.id}`);
      throw new AigisError('the privileged role no longer exists in this server. Please run /setup again.');
    }
    return guildMember.roles.cache.has(roleId);
  } catch (err) {
    console.error(`Error checking user ${guildMember.id} for privileged permissions in guild ${guildMember.guild.id}:\n ${err}`);
    throw new AigisError('an error occurred while checking your permissions. Ask for help from one of my developers if this continues.');
  }
}

/** Convert a number to a string with commans. Works with BigNumber objects */
exports.numberToString = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); //<-- copilot magic idk what this is 
}