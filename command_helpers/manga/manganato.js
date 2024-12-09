const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const path = require('path');
const { downloadImage } = require('../../utils/utils');
const { insertManga } = require('./manga-general');
const config = require('../../config');
const cheerio = require('cheerio');

/** The display name of the website */
exports.NAME = 'Manganato';

SITE_URL = 'https://chapmanganato.to';

/**
 * Get a string detailing how to get the Manga ID for a manga on this website
 * @returns {String} A string with the help message for how to get the Manga ID for a manga on this website
 */
exports.getIdHelpString = () => {
  let str = 'Use this ID format if your website is `chapmanganato.to` or `manganato.com`. Navigate to the overview page of the manga you wish to follow. The URL should end with something like `/manga-bv100520`. ';
  str += 'The ID is "bv1005204", but to differentiate from other websites, you should enter `nato-bv1005204` as the ID in commands.';
  return str;
}

/**
 * If a database entry for the manga does not exist, create one. If one does exist add this user to the ping list
 * @param {String} manga_id The ID of the manga to follow
 * @param {String} user_id The user ID of the person following the manga
 * @param {String} guild_id The guild ID of the user following the manga
 * @param {String} [lang="en"] The language to follow the manga in. Default is English
 * @returns {Promise<String>} Manga title
 */
exports.followManga = async (manga_id, user_id, guild_id, lang = 'en') => {
  const res = await axios.get(`${SITE_URL}/manga-${manga_id.split('-')[1]}`);
  const $ = cheerio.load(res.data);
  if (res.status != 200) {
    throw new AigisError(`I could not find manga with ID ${manga_id} on Manganato.`);
  }
  const chapterInfo = getChapterInfo($);
  const title = $('.story-info-right').find('h1').first().text();
  const art = await getCoverArt($);
  let manga = {
    title: title,
    manga_id: manga_id,
    lang: lang,
    latest_chapter: chapterInfo[1],
    latest_chapter_num: chapterInfo[0],
    cover_art: art,
    ping_list: { [`${guild_id}`]: [user_id] },
    website: 'manganato'
  }
  await insertManga(manga, guild_id, user_id);
  return title;
}

/**
 * Get cover art
 * @returns {Promise<String>} The filename of the cover art. Not the whole path, just the filename.
 */
getCoverArt = async ($) => {
  try {
    const img = $('.info-image').find('img').first();
    const src = img.attr('src');
    const img_name = `nato-${img.attr('src').split('/').pop()}`;
    await downloadImage(src, path.join(__dirname, '..', '..', 'images', img_name));
    return img_name;
  } catch (err) {
    return config.DEFAULT_MANGA_IMAGE;
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
  const res = await axios.get(`${SITE_URL}/manga-${manga.manga_id.split('-')[1]}`);
  const $ = cheerio.load(res.data);
  const chapterInfo = getChapterInfo($);
  if (parseFloat(chapterInfo[0]) > parseFloat(manga.latest_chapter_num)) {
    //update cover art
    let cover = await getCoverArt($);
    if (cover == config.DEFAULT_MANGA_IMAGE) {
      console.error(`Could not retrieve cover art for ${manga.title} on Manganato.`);
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
 * @returns {String} Link to the manga chapter
 */
exports.generateChapterLink = (chapter_id) => {
  return `${SITE_URL}/manga-${chapter_id}`;
}

/**
 * Generate the link for a manga given the manga ID
 * @param {String} manga_id a manga ID
 * @returns {String} Link to the manga
 */
exports.generateMangaLink = (manga_id) => {
  return `${SITE_URL}/manga-${manga_id.split('-')[1]}`;
}

/** Returns array that is [chapter number, chapter link] */
function getChapterInfo($) {
  const chapters = $('ul.row-content-chapter');
  //defaults if there are no chapters
  let latest_chapter_num = -1;
  let latest_chapter = '0';
  if (chapters.length != 0) {
    //at least 1 chapter
    latest_chapter = chapters.find('a').first().attr('href').split('/manga-')[1];
    latest_chapter_num = latest_chapter.split('-')[1];
  }
  return [latest_chapter_num, latest_chapter];
}