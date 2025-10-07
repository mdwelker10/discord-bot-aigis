const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { downloadImage } = require('../../utils/utils');
const { insertManga, mangaChannelNSFW } = require('./manga-general');
const config = require('../../utils/config');

/** The display name of the website */
exports.NAME = 'Mangadex';

/** 
 * True if the followManga method can determine the age rating of a manga. False if not. Some cases:
 * - True if the website has the data available via an API like Mangadex
 * - True if the website does not host pornographic/18+ manga like Mangapill
 * - False if the website hosts pornographic manga and does not have a way to determine the rating like Mangakakalot
 */
exports.CAN_CHECK_RATING = true;

/** check if token is valid and refresh if not. Return token value */
exports.checkToken = async () => {
  try {
    let expiry = process.env.MANGADEX_EXPIRE_TIME;
    let current = Math.floor(Date.now() / 1000) + 1000; // 1000 seconds before token expiry
    //token expired or about to expire
    if (current > expiry) {
      let authOptions = {};
      if (current > process.env.MANGADEX_REFRESH_EXPIRE_TIME) {
        //need to update refresh token
        authOptions = {
          method: 'post',
          url: 'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token',
          data: {
            grant_type: 'password',
            username: process.env.MANGADEX_USERNAME,
            password: process.env.MANGADEX_PASSWORD,
            client_id: process.env.MANGADEX_CLIENT_ID,
            client_secret: process.env.MANGADEX_CLIENT_SECRET
          }
        };
        let response = await axios(authOptions);
        process.env.MANGADEX_TOKEN = response.data.access_token;
        process.env.MANGADEX_REFRESH_TOKEN = response.data.refresh;
        process.env.MANGADEX_EXPIRE_TIME = Math.floor(Date.now() / 1000) + response.data.expires_in; //expires in 15 mins
        process.env.MANGADEX_REFRESH_EXPIRE_TIME = Math.floor(Date.now() / 1000) + response.data.refresh_expires_in; //expires in 90 days
      } else {
        //use refresh token
        authOptions = {
          method: 'post',
          url: 'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token',
          data: {
            grant_type: 'refresh_token',
            refresh_token: process.env.MANGADEX_REFRESH_TOKEN,
            client_id: process.env.MANGADEX_CLIENT_ID,
            client_secret: process.env.MANGADEX_CLIENT_SECRET
          }
        };
        let response = await axios(authOptions);
        process.env.MANGADEX_TOKEN = response.data.access_token;
        process.env.MANGADEX_EXPIRE_TIME = Math.floor(Date.now() / 1000) + response.data.expires_in; //expires in 15 mins
      }
    }
    return process.env.SPOTIFY_TOKEN;
  } catch (err) {
    throw new AigisError("I could not verify your authentication token. I cant access Mangadex!");
  }
}

/**
 * Get a string detailing how to get the Manga ID for a manga on this website
 * @returns {String} A string with the help message for how to get the Manga ID for a manga on this website
 */
exports.getIdHelpString = () => {
  let mangadex = 'Navigate to the overview page of the manga you wish to follow. The URL will look something like https://mangadex.org/title/2e0fdb3b-632c-4f8f-a311-5b56952db647/bocchi-the-rock. ';
  mangadex += 'In this case, the ID is `2e0fdb3b-632c-4f8f-a311-5b56952db647`. The title might not be included in the URL, but the ID will always be there.';
  return mangadex;
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
  const res = await axios.get(`https://api.mangadex.org/manga/${manga_id}`);
  const manga_data = res.data.data;
  let chapter_str = `https://api.mangadex.org/manga/${manga_id}/feed?translatedLanguage[]=${lang}&order[chapter]=desc&limit=1`;
  if (manga_data.type !== 'manga') {
    const article = manga_data.type === 'user' || manga_data.type === 'artist' || manga_data.type === 'author' ? 'an' : 'a';
    throw new AigisError(`${username}-san, the ID you provided is not for a manga but for ${article} ${manga.type}.`);
  }
  //check rating and get cover art
  let cover_file_name = 'https://i.imgur.com/usdIJxN.png';
  let ch_nsfw = await mangaChannelNSFW(guild);
  if (manga_data.attributes.contentRating == 'pornographic' && !ch_nsfw) {
    throw new AigisError(`this manga is pornographic or otherwise too explicit. Please mark the manga channel as age-restricted to follow this manga.`);
  }
  if (manga_data.attributes.contentRating == 'pornographic') {
    //pornographic manga needs special url param to retrieve chapters
    chapter_str += '&contentRating[]=pornographic';
  } else {
    //get cover art for non-porn
    cover_file_name = await exports.getCoverArt(manga_id, manga_data.relationships.filter(rel => rel.type === 'cover_art')[0].id, true);
  }
  const title = manga_data.attributes.title[lang] ?? manga_data.attributes.altTitles[lang] ?? Object.values(manga_data.attributes.title)[0];
  //get chapter data
  let ret = {};
  try {
    ret = await axios.get(chapter_str);
  } catch (err) {
    if (err.response.status === 400) {
      console.error(`Mangadex request error, details below:\n${JSON.stringify(err.response.data.errors[0])}`);
      throw new AigisError(`Mangadex has told me that my request was invalid. They say "${err.response.data.errors[0].detail}.`);
    } else {
      throw err;
    }
  }
  //collect data for manga
  let data = {};
  //if no chapters in this language for this manga use some default values
  if (ret.data.data.length === 0) {
    data = {
      title: title,
      manga_id: manga_id,
      lang: lang,
      latest_chapter: 0,
      latest_chapter_num: -1,
      cover_art: cover_file_name,
      ping_list: { [`${guild_id}`]: [user_id] },
      website: 'mangadex',
      nsfw: manga_data.attributes.contentRating == 'pornographic'
    }
  } else {
    const chapter = ret.data.data[0];
    data = {
      title: title,
      manga_id: manga_id,
      lang: lang,
      latest_chapter: chapter.id,
      latest_chapter_num: chapter.attributes.chapter,
      cover_art: cover_file_name,
      ping_list: { [`${guild_id}`]: [user_id] },
      website: 'mangadex',
      nsfw: manga_data.attributes.contentRating == 'pornographic'
    }
  }
  await insertManga(data, guild_id, user_id);
  return title;
}

/**
 * Get the cover art of a manga from Mangadex. Keep would be true if following a manga, false if getting a manga at random or temporarily
 * @param {String} mangaID The manga ID to get the cover art for
 * @param {String} coverID The cover art ID to get the cover art for
 * @param {boolean} keep Whether to store this in the images folder (true) or the temp folder (false)
 * @returns {Promise<String|Array>} The filename if keep is true, otherwise an array with the attachment string and the attachment object.
 */
exports.getCoverArt = async (mangaID, coverID, keep = false) => {
  //const token = await checkToken();
  const data = await axios.get(`https://api.mangadex.org/cover/${coverID}`);
  const filename = data.data.data.attributes.fileName;
  const url = `https://uploads.mangadex.org/covers/${mangaID}/${filename}`;
  const filePath = keep ? path.join(__dirname, '..', '..', 'images', `${filename}`) : path.join(__dirname, '..', '..', 'temp', `${filename}`);
  try {
    await downloadImage(url, filePath);
    if (keep) {
      return (filename); //for manga being followed (attachment is manually built later)
    } else {
      return ([`attachment://${filename}`, new AttachmentBuilder(path.resolve(filePath))]); //need to have attachment for local files (i.e. random manga)
    }
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
  try {
    let str = `https://api.mangadex.org/manga/${manga.manga_id}/feed?translatedLanguage[]=${manga.lang}&order[chapter]=desc&limit=1`;
    if (manga.nsfw) {
      str += '&contentRating[]=pornographic';
    }
    let ret = await axios.get(str);
    //no chapters
    if (ret.data.data.length === 0) {
      return null;
    }
    if (parseFloat(ret.data.data[0].attributes.chapter) > parseFloat(manga.latest_chapter_num)) {
      let obj = {
        cover_art: manga.cover_art,
      };
      //update return object with new chapter data
      obj.latest_chapter = ret.data.data[0].id;
      obj.latest_chapter_num = ret.data.data[0].attributes.chapter;
      //check for cover art update if non-porn manga
      if (!manga.nsfw) {
        const updated_data = await axios.get(`https://api.mangadex.org/manga/${manga.manga_id}`);
        const new_cover = await exports.getCoverArt(manga.manga_id, updated_data.data.data.relationships.filter(rel => rel.type === 'cover_art')[0].id, true);
        if (new_cover !== manga.cover_art) {
          obj.cover_art = new_cover; //update manga object to reflect new cover art for sending ping
        }
      }
      return obj;
    } else {
      return null;
    }
  } catch (err) {
    if (err.response && err.response.status === 400 || err.response.status === 404) {
      console.error(`Mangadex error with ${manga.title} in ${exports.getLanguage(manga.lang)}. Details below:\n${JSON.stringify(err.response.data.errors[0])}`);
      return null;
    } else if (err.response && err.response.status >= 500) {
      console.error(`Mangadex API error with code ${err.response.status}. Message:\n${JSON.stringify(err.response.statusText)}`);
      return null;
    } else {
      throw err;
    }
  }
}

/**
 * Generate the link for a chapter given the chapter ID
 * @param {String} chapter_id a Chapter ID
 */
exports.generateChapterLink = (chapter_id) => {
  return `https://mangadex.org/chapter/${chapter_id}`;
}

/**
 * Generate the link for a manga given the manga ID
 * @param {*} manga_id a manga ID
 * @returns {String} Link to the manga
 */
exports.generateMangaLink = (manga_id) => {
  return `https://mangadex.org/title/${manga_id}`;
}

/** Used only for Random Manga */
exports.getMangaAuthor = async (authorID) => {
  //const token = await checkToken();
  const data = await axios.get(`https://api.mangadex.org/author/${authorID}`);
  return data.data.data.attributes.name;
}
