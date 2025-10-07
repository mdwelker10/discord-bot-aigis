/**
 * @fileoverview  This file will have anything required by all website specific js files. 
 * They are put here instead of in manga.js to avoid circular dependencies.
 */
const AigisError = require('../../utils/AigisError');
const db = require('../../database/db');
const config = require('../../utils/config');
const { getGuildConfig } = require('../../utils/utils');

COLLECTION_NAME = 'manga';
/** Function to insert/update a manga when someone follows it. Pass in the JSON object that would get saved the the database. The form of:
  {
    title: Manga Title,
    manga_id: Manga ID,
    lang: ISO language specifier,
    latest_chapter: ID of latest chapter or 0 if no chapters
    latest_chapter_num: Latest chapter number or -1 if no chapters,
    cover_art: The file name of the cover art (note that this is the file name only, not the full path),
    ping_list: { [`${guild_id}`]: [user_id] },
    website: Website Name
  }
  Pinglist should have exactly that value, as if the manga exists then the user is added to the ping list
 */
exports.insertManga = async (manga, guild_id, user_id) => {
  //ping_list is a map (JSON object) of guild id to a list of user ids
  const existing_data = await db.findOne(config.DB_NAME, COLLECTION_NAME, { manga_id: manga.manga_id, lang: manga.lang });
  //if an entry exists in the database for this manga and this language just edit ping list
  if (existing_data) {
    if (existing_data.ping_list[guild_id] && existing_data.ping_list[guild_id].includes(user_id)) {
      throw new AigisError('you are already following that manga in that language.');
    }
    //push user id to the ping list - Use a computed property for name of key. $push creates the list's key if it doesn't exist
    await db.updateOne(config.DB_NAME, COLLECTION_NAME, { manga_id: manga_id, lang: lang }, { $push: { [`ping_list.${guild_id}`]: user_id } });
  } else {
    await db.insert(config.DB_NAME, COLLECTION_NAME, manga);
  }
}

/**
 * Gets whether the manga channel for the server is marked as NSFW or not
 * @param {*} guild The guild object for the server
 * @returns {Promise<boolean>} True if the channel is marked as NSFW, false otherwise
 */
exports.mangaChannelNSFW = async (guild) => {
  try {
    const guild_config = await getGuildConfig(guild.id);
    if (!guild_config) {
      throw new AigisError('I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command.');
    }
    //get channel Manga releases happen in
    const ch = guild.channels.cache.get(guild_config.channel_manga);
    return ch.nsfw;
  } catch (err) {
    throw new AigisError('I was unable to retrieve the manga channel for this server. Please have someone with the "manage server" permission execute the \`/setup\` command.');
  }
}