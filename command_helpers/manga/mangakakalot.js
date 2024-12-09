const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const path = require('path');
const { downloadImage } = require('../../utils/utils');
const { insertManga } = require('./manga-general');
const config = require('../../config');
const cheerio = require('cheerio');

/** The display name of the website */
exports.NAME = 'Mangakakalot';

/**
 * Get a string detailing how to get the Manga ID for a manga on this website
 * @returns {String} A string with the help message for how to get the Manga ID for a manga on this website
 */
exports.getIdHelpString = () => {
  let str = 'Navigate to the overview page of the manga you wish to follow. **If the URL changes to `chapmanganato.to` or `manganato.com` then follow the instructions for manganato**. ';
  str += 'The URL will look something like https://mangakakalot.com/manga/ve928185. The ID in this case is "ve928185", but to differentiate from other websites, ';
  str += 'you should enter `kakalot-ve928185` as the ID in commands.';
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
  const id = manga_id.split('-')[1];
  console.log(id);
  const ret = await axios.get(`https://mangakakalot.com/manga/${id}`);
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
    website: 'mangakakalot'
  }
  await insertManga(manga, guild_id, user_id);
  return title;
}

/**
 * Get cover art
 * @returns {Promise<String>} The filename of the cover art. Not the whole path, just the filename.
 */
getCoverArt = async (html) => {
  try {
    const $ = cheerio.load(html);
    const img = $('.manga-info-pic').find('img').first();
    const src = img.attr('src');
    const img_name = `mangakakalot-${src.split('/').pop()}`;
    await downloadImage(src, path.join(__dirname, '..', '..', 'images', img_name));
    return img_name;
  } catch {
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
  const ret = await axios.get(`https://mangakakalot.com/manga/${manga.manga_id.split('-')[1]}`);
  const $ = cheerio.load(ret.data);
  const chapterInfo = getChapterInfo($);
  if (parseFloat(chapterInfo[0]) > parseFloat(manga.latest_chapter_num)) {
    //update cover art
    let cover = await getCoverArt(ret.data);
    if (cover == config.DEFAULT_MANGA_IMAGE) {
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
  return `https://mangakakalot.com/chapter/${chapter_id}`;
}

/**
 * Generate the link for a manga given the manga ID
 * @param {*} manga_id a manga ID
 * @returns {String} Link to the manga
 */
exports.generateMangaLink = (manga_id) => {
  return `https://mangakakalot.com/manga/${manga_id.split('-')[1]}`;
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
  return [chapterNum, latestChapter.attr('href').split('/chapter/')[1] ?? 0];
}