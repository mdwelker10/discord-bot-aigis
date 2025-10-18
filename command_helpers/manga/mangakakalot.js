const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const path = require('path');
const { downloadImage } = require('../../utils/utils');
const { insertManga } = require('./manga-general');
const config = require('../../utils/config');
const cheerio = require('cheerio');

/** The display name of the website */
exports.NAME = 'Mangakakalot';

const SITE_URL = 'https://mangakakalot.gg';

/** 
 * True if the followManga method can determine the age rating of a manga. False if not. Some cases:
 * - True if the website has the data available via an API like Mangadex
 * - True if the website does not host pornographic/18+ manga like Mangapill
 * - False if the website hosts pornographic manga and does not have a way to determine the rating like Mangakakalot
 * Note that if this is false then assume all manga is NSFW and do not retrieve cover art for this website, return the default image instead
 */
exports.CAN_CHECK_RATING = false;

/**
 * Get a string detailing how to get the Manga ID for a manga on this website
 * @returns {String} A string with the help message for how to get the Manga ID for a manga on this website
 */
exports.getIdHelpString = () => {
  let str = 'Navigate to the overview page of the manga you wish to follow. **If the URL changes to `manganato.gg` then follow the instructions for manganato**. ';
  str += 'The URL will look something like https://mangakakalot.gg/manga/oomuro-ke. The ID in this case is "oomuro-ke", but to differentiate from other websites, ';
  str += 'you should enter `kakalot-oomuro-ke` as the ID in commands.';
  return str;
}

/**
 * If a database entry for the manga does not exist, create one. If one does exist add this user to the ping list
 * @param {String} manga_id The ID of the manga to follow
 * @param {String} user_id The user ID of the person following the manga
 * @param {Object} guild The guild object of the server the command was run in
 * @param {String} [lang="en"] The language to follow the manga in. Default is English
 * @returns {Promise<String>} Manga title
 */
exports.followManga = async (manga_id, user_id, guild, lang = 'en') => {
  const guild_id = guild.id;
  const id = manga_id.split('kakalot-')[1];
  const ret = await axios.get(`${SITE_URL}/manga/${id}`);
  if (ret.status != 200) {
    if (ret.status >= 500) {
      throw new AigisError(`Mangakakalot seems to be experiencing issues, please try again later.`);
    }
    throw new AigisError(`I could not find manga with ID ${manga_id} on Manganato.`);
  }
  const $ = cheerio.load(ret.data);
  //assuming no chapters means manga doesnt exist
  if ($('.chapter-list').length == 0) {
    throw new AigisError(`I could not find manga with ID ${manga_id} on Mangakakalot.`);
  }
  const chapterInfo = getChapterInfo($);
  const art = await getCoverArt(ret.data);
  const title = $('.manga-info-text').find('h1').first().text();
  let manga = {
    title: title,
    manga_id: manga_id,
    lang: lang,
    latest_chapter: chapterInfo[1],
    latest_chapter_num: chapterInfo[0],
    cover_art: art,
    ping_list: { [`${guild_id}`]: [user_id] },
    website: 'mangakakalot',
    nsfw: !exports.CAN_CHECK_RATING
  }
  await insertManga(manga, guild_id, user_id);
  return title;
}

/**
 * Get cover art
 * @returns {Promise<String>} The filename of the cover art. Not the whole path, just the filename.
 */
async function getCoverArt(html) {
  try {
    const $ = cheerio.load(html);
    const img = $('.manga-info-pic').find('img').first();
    const src = img.attr('src');
    const img_name = `mangakakalot-${src.split('/').pop()}`;
    await downloadImage(src, path.join(__dirname, '..', '..', 'images', img_name),);
    return img_name;
  } catch (err) {
    console.error(err);
    return config.get('DEFAULT_MANGA_IMAGE');
  }
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
 * @returns {*} A manga object with fields for the latest chapter ID, latest chapter number, and latest cover art if there is a new chapter, otherwise null
 */
exports.checkForUpdates = async (manga) => {
  const id = manga.manga_id.split('kakalot-')[1];
  const ret = await axios.get(`${SITE_URL}/manga/${id}`);
  const $ = cheerio.load(ret.data);
  const chapterInfo = getChapterInfo($);
  if (parseFloat(chapterInfo[0]) > parseFloat(manga.latest_chapter_num)) {
    //update cover art
    let cover = await getCoverArt(ret.data);
    if (cover == config.get('DEFAULT_MANGA_IMAGE')) {
      console.error(`Could not retrieve cover art for ${manga.title} on Mangakakalot.`);
      cover = manga.cover_art;
    }
    return {
      latest_chapter: chapterInfo[1],
      latest_chapter_num: chapterInfo[0],
      cover_art: cover,
    }
  } else {
    return null;
  }
}

/**
 * Generate the link for a chapter given the chapter ID
 * @param {String} chapter_id a Chapter ID
 * @returns {String} Link to the manga
 */
exports.generateChapterLink = (chapter_id) => {
  return `${SITE_URL}/manga/${chapter_id}`;
}

/**
 * Generate the link for a manga given the manga ID
 * @param {*} manga_id a manga ID
 * @returns {String} Link to the manga
 */
exports.generateMangaLink = (manga_id) => {
  return `${SITE_URL}/manga/${manga_id.split('kakalot-')[1]}`;
}

/** Returns array that is [chapter number, chapter link] */
function getChapterInfo($) {
  const chapterList = $('.chapter-list'); //list of all a tags for chapters
  const latestChapter = chapterList.find('a').first();
  const arr = latestChapter.text().split(' ');
  let chapterNum = arr.indexOf('Chapter'); //get index of word "chapter" and chapter number should be next
  if (chapterNum == -1 || chapterNum == arr.length - 1 || isNaN(arr[chapterNum + 1])) {
    //no chapter number in chapter name, use length of chapter list
    chapterNum = chapterList.children().length;
  } else {
    chapterNum = arr[chapterNum + 1];
  }
  return [chapterNum, latestChapter.attr('href').split('/manga/')[1] ?? 0];
}