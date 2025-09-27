const axios = require('axios');
const path = require('path');
const { downloadImage } = require('../../utils/utils');
const cheerio = require('cheerio');
const { insertManga } = require('./manga-general');
const config = require('../../config');
const AigisError = require('../../utils/AigisError');

/** The display name of the website */
exports.NAME = 'Mangapill';

/** 
 * True if the followManga method can determine the age rating of a manga. False if not. Some cases:
 * - True if the website has the data available via an API like Mangadex
 * - True if the website does not host pornographic/18+ manga like Mangapill
 * - False if the website hosts pornographic manga and does not have a way to determine the rating like Mangakakalot
 */
exports.CAN_CHECK_RATING = true;

/**
 * Get a string detailing how to get the Manga ID for a manga on this website
 * @returns {String} A string with the help message for how to get the Manga ID for a manga on this website
 */
exports.getIdHelpString = () => {
  let mangapill = 'Navigate to the overview page of the manga you wish to follow. The URL will look something like https://mangapill.com/manga/601/boku-no-hero-academia. ';
  mangapill += 'Both the ID and the title are required. So in this case, you would enter `601/boku-no-hero-academia` as the ID in commands.';
  return mangapill;
}

/**
 * If a database entry for the manga does not exist, create one. If one does exist add this user to the ping list
 * @param {*} manga_id The manga ID to follow
 * @param {*} user_id The user ID of the user following the manga
 * @param {Object} guild The guild object of the server the command was run in
 * @param {*} lang The language to follow the manga in. Mangapill does not support languages other than English (afaik)
 * @returns {Promise<String>} Manga title
 */
exports.followManga = async (manga_id, user_id, guild, lang = 'en') => {
  const guild_id = guild.id;
  const ret = await axios.get(`https://mangapill.com/manga/${manga_id}`);
  if (ret.status !== 200) {
    if (ret.status >= 500) {
      throw new AigisError(`Mangapill seems to be experiencing issues, please try again later.`);
    }
    throw new AigisError(`I could not find manga with ID ${manga_id} on Mangapill.`);
  }
  const $ = cheerio.load(ret.data);
  //get chapter data
  const chapter = $('#chapters').find('a').first();
  const latest_chapter = chapter.attr('href').split('/chapters/')[1] ?? 0;
  const latest_chapter_num = latest_chapter == 0 ? -1 : chapter.text().split(' ')[1];
  //get cover art
  const art = await getCoverArt($);
  //get title
  let title = $('div').filter('.text-secondary').first().text();
  if (title === '') {
    title = $('h1').text();
  }
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
 * Attempt to retrieve the cover art for a manga
 * @param {*} html The HTML of the manga page retrieved via axios.get(url).data
 * @returns The string of the cover art file name or the default imgur image to use if the cover art cannot be retrieved
 */
async function getCoverArt($) {
  try {
    const img = $('img').first().attr('data-src'); //image link
    let img_name_init = `mangapill-${img.split('/').pop()}`;
    const img_name = img_name_init.split('?')[0];
    await downloadImage(img, path.join(__dirname, '..', '..', 'images', img_name), 'https://mangapill.com');
    return img_name;
  } catch (err) {
    console.error(err);
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
  const ret = await axios.get(`https://mangapill.com/manga/${manga.manga_id}`);
  if (ret.status !== 200) {
    if (ret.status >= 500) {
      console.error(`Mangapill seems to be experiencing issues.`);
    } else {
      console.error(`Could not find manga with ID ${manga.manga_id} on Mangapill. Skipping chapter check...`);
    }
    return null;
  }
  const $ = cheerio.load(ret.data);
  const chapter = $('#chapters').find('a').first();
  const latest_chapter = chapter.attr('href').split('/chapters/')[1] ?? 0;
  const latest_chapter_num = latest_chapter == 0 ? -1 : chapter.text().split(' ')[1];
  if (parseFloat(latest_chapter_num) > parseFloat(manga.latest_chapter_num)) {
    let cover = await getCoverArt($);
    if (cover == config.DEFAULT_MANGA_IMAGE) {
      console.error(`Could not retrieve cover art for ${manga.title} on Mangapill.`);
      cover = manga.cover_art;
    }
    return {
      latest_chapter: latest_chapter,
      latest_chapter_num: latest_chapter_num,
      cover_art: cover,
    }
  }
  return null;
}

/**
 * Generate the link for a chapter given the chapter ID
 * @param {String} chapter_id a Chapter ID
 * @returns {String} Link to the chapter
 */
exports.generateChapterLink = (chapter_id) => {
  return `https://mangapill.com/chapters/${chapter_id}`;
}

/**
 * Generate the link for a manga given the manga ID
 * @param {*} manga_id a manga ID
 * @returns {String} Link to the manga
 */
exports.generateMangaLink = (manga_id) => {
  return `https://mangapill.com/manga/${manga_id}`;
}