const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const path = require('path');
const playwright = require('playwright');
const { downloadImage } = require('../../utils/utils');
const { insertManga, mangaChannelNSFW } = require('./manga-general');
const config = require('../../utils/config');

/** The display name of the website */
exports.NAME = 'Mangaplus';

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
  let str = 'Navigate to the overview page of the manga you wish to follow. The URL will look something like https://mangaplus.shueisha.co.jp/titles/100037. ';
  str += 'The ID is the number at the end of the URL. So in this case, you would enter `100037` as the ID in commands. The ID should always have 6 digits.';
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
  throw new AigisError('following manga on MangaPlus is not supported at the moment.');
  const guild_id = guild.id;
  manga = {
    title: 'default title',
    manga_id: manga_id,
    lang: lang,
    latest_chapter: 0,
    latest_chapter_num: -1,
    cover_art: config.DEFAULT_MANGA_IMAGE,
    ping_list: { [`${guild_id}`]: [user_id] },
    website: 'mangaplus',
    nsfw: !exports.CAN_CHECK_RATING
  }
  try {
    //open browser instance and launch the page
    const browser = await playwright.firefox.launch();
    const context = await browser.newContext({ ignoreHTTPSErrors: true, timeout: 15000, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0' });
    const page = await context.newPage({ referer: 'https://mangaplus.shueisha.co.jp' });
    await page.goto(`https://mangaplus.shueisha.co.jp/titles/${manga_id}`, { waitUntil: 'domcontentloaded' });
    //get the title and cover art, fail fast if the title is not there, meaning ID is invalid
    manga.title = await page.locator('h1').textContent({ timeout: 3000 });
    manga.cover_art = await getCoverArt(page, manga_id);
    try {
      //get chapter number and latest chapter ID (via clicking on chapter link and grabbing new URL)
      let chapterNum = await page.locator('p.ChapterListItem-module_name_3h9dj').last().textContent({ timeout: 3000 });
      chapterNum = chapterNum.substring(1);
      await page.locator('div.ChapterListItem-module_chapterListItem_ykICp').last().click();
      manga.latest_chapter = page.url().split('/viewer/')[1];
      manga.latest_chapter_num = chapterNum;
    } catch (err) {
      //if an error occurs assume no chapters have been released
      console.error(err);
      manga.chapterNum = -1;
      manga.latest_chapter = 0;
    }
  } catch (err) {
    console.error(err);
    throw new AigisError(`I could not get the information for the manga with ID ${manga_id} on Mangaplus. Please make sure the manga ID is correct.`);
  }

  await insertManga(manga, guild_id, user_id);
  return manga.title;
}

/**
 * Get cover art
 * @returns {Promise<String>} The filename of the cover art. Not the whole path, just the filename.
 */
async function getCoverArt(page, manga_id) {
  try {
    const imgElement = page.locator('img.TitleDetailHeader-module_coverImage_3rvaT');
    const img = await imgElement.getAttribute('src');
    let imgName = `mp-${manga_id}.jpg`;
    downloadImage(img, path.join(__dirname, '..', '..', 'images', imgName), 'https://mangaplus.shueisha.co.jp');
    return imgName;
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
 * @returns {Promise<*>} A manga object with fields for the latest chapter ID, latest chapter number, and latest cover art if there is a new chapter, otherwise null
 */
exports.checkForUpdates = async (manga) => {
  const browser = await playwright.firefox.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, timeout: 15000, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0' });
  const page = await context.newPage({ referer: 'https://mangaplus.shueisha.co.jp' });
  await page.goto(`https://mangaplus.shueisha.co.jp/titles/${manga.manga_id}`, { waitUntil: 'domcontentloaded' });

  let chapterNum = await page.locator('p.ChapterListItem-module_name_3h9dj').last().textContent({ timeout: 3000 });
  chapterNum = chapterNum.substring(1);

  if (parseFloat(chapterNum) > parseFloat(manga.latest_chapter_num)) {
    let art = await getCoverArt(page, manga.manga_id);
    if (art == config.DEFAULT_MANGA_IMAGE) {
      console.error(`Could not retrieve cover art for ${manga.title} on Mangaplus.`);
      art = manga.cover_art;
    }
    await page.locator('div.ChapterListItem-module_chapterListItem_ykICp').last().click();
    return {
      latest_chapter: page.url().split('/viewer/')[1],
      latest_chapter_num: chapterNum,
      cover_art: art
    }
  }
  return null;
}

/**
 * Generate the link for a chapter given the chapter ID
 * @param {String} chapter_id a Chapter ID
 * @returns {String} Link to the manga chapter
 */
exports.generateChapterLink = (chapter_id) => {
  return `https://mangaplus.shueisha.co.jp/viewer/${chapter_id}`;
}

/**
 * Generate the link for a manga given the manga ID
 * @param {String} manga_id a manga ID
 * @returns {String} Link to the manga
 */
exports.generateMangaLink = (manga_id) => {
  return `https://mangaplus.shueisha.co.jp/titles/${manga_id}`;
}
