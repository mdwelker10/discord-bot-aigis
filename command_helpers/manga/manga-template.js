const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const path = require('path');
const cheerio = require('cheerio');
//const playwright = require('playwright');
const { downloadImage } = require('../../utils/utils');
const { insertManga, mangaChannelNSFW } = require('./manga-general');
const config = require('../../config');

/** The display name of the website */
exports.NAME = 'Website';

/** 
 * True if the followManga method can determine the age rating of a manga. False if not. Some cases:
 * - True if the website has the data available via an API like Mangadex
 * - True if the website does not host pornographic/18+ manga like Mangapill
 * - False if the website hosts pornographic manga and does not have a way to determine the rating like Mangakakalot
 */
exports.CAN_CHECK_RATING = false;

/**
 * Get a string detailing how to get the Manga ID for a manga on this website
 * @returns {String} A string with the help message for how to get the Manga ID for a manga on this website
 */
exports.getIdHelpString = () => {
  let str = '';
  return str;
}

/**
 * If a database entry for the manga does not exist, create one. If one does exist add this user to the ping list
 * Uses the insertManga function from manga-general.js to insert the manga into the database
 * @param {String} manga_id The ID of the manga to follow
 * @param {String} user_id The user ID of the person following the manga
 * @param {Object} guild The guild object of the server the command was run in
 * @param {String} [lang="en"] The language to follow the manga in. Default is English
 * @returns {Promise<String>} Manga title
 */
exports.followManga = async (manga_id, user_id, guild, lang = 'en') => {
  const guild_id = guild.id;
  /**
   * Retrieve the manga information from the website and create an object to be saved to the database.
   * This function should check if the manga exists on the website and throw an AigisError with an appropriate message if it does not.
   * 
   * If the manga is pornographic/18+/adult content OR it is not possible to check, make sure the channel is marked as NSFW.
   *  - Get the channel and check channel.nsfw (boolean)
   *  - If the channel is not NSFW, throw an Aigis error and make the message as either:
   *    - "this manga is pornographic or otherwise too explicit. Please mark the manga channel as age-restricted to follow this manga."
   *    - "it is not possible to check the content rating of manga on this website. Please mark this channel as age-restricted to follow this manga."
   * 
   * Do not save the manga to the database in this function, instead call the imported insertManga function.
   * the insertManga function takes an object with manga info, which is defined below.
   * 
   * Set the following variables and end this function with the code below
   * - title: The title of the manga
   * - latest_chapter: The ID of the latest chapter
   * - latest_chapter_num: The number of the latest chapter
   * - art: The filename of the cover art, not the whole path
   * - website: The name of the website. This can (and should) be all lowercase with dashes or underscores separating words
   * - nsfw: Change the value if the nsfw rating (porn or 18+) is determined based on the manga and not the website
   * 
   * leave ping_list as it is, it will be updated in the insertManga function if needed
   * 
   */
  let manga = {
    title: title,
    manga_id: manga_id,
    lang: lang,
    latest_chapter: latest_chapter,
    latest_chapter_num: latest_chapter_num,
    cover_art: art,
    ping_list: { [`${guild_id}`]: [user_id] },
    website: 'mangapill',
    nsfw: !exports.CAN_CHECK_RATING
  }
  await insertManga(manga, guild_id, user_id);
  return title;
}

/**
 * Get cover art
 * @returns {Promise<String>} The filename of the cover art. Not the whole path, just the filename.
 */
async function getCoverArt(params) {
  /*
    Retrieve cover art for a manga. Parameters vary based on how the image needs to be retrieved.
    If web scraping with Cheerio is being used, the $ variable can be the only parameter
    If the image cannot be retrieved or exports.CAN_CHECK_RATING is false, return config.DEFAULT_MANGA_IMAGE.
    Should be used only in this file, but is a very nice helper function to have.
  */
}

/**
 * Check for manga updates and return an object with the newest information. The object should have the form of:
 * {
 *  latest_chapter: The ID of the latest chapter,
 *  latest_chapter_num: The number of the latest chapter,
 *  cover_art: The filename of the cover art
 * }
 * No database updates take place in this function. If there is a cover art update, it will not be acknowledged until a new chapter is released.
 * @param {*} manga The manga object retrieved from the database of the manga to check for updates
 * @returns {Promise<*>} A manga object with fields for the latest chapter ID, latest chapter number, and latest cover art if there is a new chapter, otherwise null
 */
exports.checkForUpdates = async (manga) => {
  /*
    The manga object will look like this:
    {
      title: 'Title of the manga',
      manga_id: 'Manga ID',
      lang: 'ISO language code',
      latest_chapter: 'Latest chapter ID',
      latest_chapter_num: 'Latest chapter number',
      cover_art: 'Cover art filename (not path)',
      ping_list: {
        guild_id: [user_id],
      },
      website: 'website name'
    }

    Retrieve the most recent chapter number and link from the website. 
    If chapter number indicates the chapter is new, also check for updated cover art and return the object in noted docstring.
    If there is no chapter update return null
    Do not handle removing the old cover art image and updating the database with new chapter info, that is done in the manga.js cronjob execute function
  */
}

/**
 * Generate the link for a chapter given the chapter ID
 * @param {String} chapter_id a Chapter ID
 * @returns {String} Link to the manga chapter
 */
exports.generateChapterLink = (chapter_id) => {
  //return `https://website.com/chapter/${chapter_id}`;
}

/**
 * Generate the link for a manga given the manga ID
 * @param {String} manga_id a manga ID
 * @returns {String} Link to the manga
 */
exports.generateMangaLink = (manga_id) => {
  //return `https://website.com/manga/${manga_id}`;
}