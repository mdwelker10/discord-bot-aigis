const axios = require('axios');
const AigisError = require('../utils/AigisError');
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder, hyperlink } = require('discord.js');
const db = require('../database/db');
const config = require('../config');
const ISO6391 = require('iso-639-1');
const { CronJob } = require('cron');
const { cleanTemp, getGuildConfig } = require('../utils/methods')

exports.COLLECTION_NAME = 'manga';
exports.DEFAULT_IMAGE = 'https://i.imgur.com/usdIJxN.png';

let job; //cronjob object

//check if token is valid and refresh if not. Return token value
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
 * get cover art file path / link given a manga ID and cover art ID.
 *  If keep is true file is saved to images/
 * if keep is false file is saved to temp/ 
 */
exports.getCoverArt = async (mangaID, coverID, keep = false) => {
  //const token = await checkToken();
  const data = await axios.get(`https://api.mangadex.org/cover/${coverID}`);
  const filename = data.data.data.attributes.fileName;
  const url = `https://uploads.mangadex.org/covers/${mangaID}/${filename}`;
  const filePath = keep ? path.join(__dirname, '..', 'images', `${filename}`) : path.join(__dirname, '..', 'temp', `${filename}`);
  cleanTemp();
  //download image and place in folder
  const res = await axios.get(url, { responseType: 'stream' });
  const writer = fs.createWriteStream(filePath, { autoClose: true, flags: 'w+' });
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      if (keep) {
        resolve(filename); //for manga being followed (attachment is manually built later)
      } else {
        resolve([`attachment://${filename}`, new AttachmentBuilder(path.resolve(filePath))]); //need to have attachment for local files (i.e. random manga)
      }
    });
    writer.on('error', (err) => {
      console.error(err);
      resolve(exports.DEFAULT_IMAGE); //default image of Aigis reading
    });
  });
}

exports.getTitle = (attributes, lang = 'en') => {
  return attributes.title[lang] ?? attributes.altTitles[lang] ?? Object.values(attributes.title)[0]
}

exports.getLanguage = (lang) => {
  if (config.MANGADEX_ISO6391[lang]) {
    return config.MANGADEX_ISO6391[lang];
  } else {
    return ISO6391.getName(lang);
  }
}

exports.followManga = async (guild_id, manga_id, lang, manga_data, user_id) => {
  const title = exports.getTitle(manga_data.attributes, lang);
  //get chapter data
  let ret = {};
  try {
    ret = await axios.get(`https://api.mangadex.org/manga/${manga_id}/feed?translatedLanguage[]=${lang}&order[chapter]=desc&limit=1`);
  } catch (err) {
    if (err.response.status === 400) {
      console.error(`Mangadex request error, details below:\n${JSON.stringify(err.response.data.errors[0])}`);
      throw new AigisError(`Mangadex has told me that my request was invalid. They say "${err.response.data.errors[0].detail}.`);
    } else {
      throw err;
    }
  }
  //ping_list is a map (JSON object) of guild id to a list of user ids
  const existing_data = await db.findOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang });
  //if an entry exists in the database for this manga and this language just edit ping list
  if (existing_data && existing_data.manga_id === manga_id && existing_data.lang === lang) {
    if (existing_data.ping_list[guild_id] && existing_data.ping_list[guild_id].includes(user_id)) {
      throw new AigisError('you are already following that manga in that language.');
    }
    //push user id to the ping list - Use a computed property for name of key
    await db.updateOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang }, { $push: { [`ping_list.${guild_id}`]: user_id } });
  } else {
    let data = {};
    let cover_file_name = 'https://i.imgur.com/usdIJxN.png';
    if (manga_data.contentRating !== 'pornographic') {
      cover_file_name = await exports.getCoverArt(manga_id, manga_data.relationships.filter(rel => rel.type === 'cover_art')[0].id, true);
    }
    //if no chapters in this language for this manga use some default values
    if (ret.data.data.length === 0) {
      data = {
        title: title,
        manga_id: manga_id,
        lang: lang,
        latest_chapter: 0,
        latest_chapter_num: -1,
        cover_art: cover_file_name,
        ping_list: { [`${guild_id}`]: [user_id] }
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
        ping_list: { [`${guild_id}`]: [user_id] }
      }
    }
    await db.insert(config.DB_NAME, exports.COLLECTION_NAME, data);
  }
  return title;
}

exports.listManga = async (guild_id, user_id) => {
  let data = await db.find(config.DB_NAME, exports.COLLECTION_NAME, { [`ping_list.${guild_id}`]: user_id });
  let str = '';
  for (const m of data) {
    str += `- ${hyperlink(`${m.title} in ${exports.getLanguage(m.lang)}`, `<https://mangadex.org/title/${m.manga_id}>`)}\n`;
  }
  if (str === '') {
    str = 'You are not following any manga.';
  }
  let embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('Manga You Are Following')
    .setDescription(str)
    .setTimestamp();
  return embed;
}

exports.unfollowManga = async (guild_id, manga_id, lang, user_id) => {
  let data = await db.findOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang });
  if (!data) {
    return false;
  }
  if (Object.keys(data.ping_list).length === 1 && data.ping_list[guild_id].length === 1) {
    await db.deleteOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang });
    fs.unlinkSync(path.join(__dirname, '..', 'images', data.cover_art));
  } else {
    //$pull will remove the specified user id from the ping list
    await db.updateOne(guild_id, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang }, { $pull: { [`ping_list.${guild_id}`]: user_id } });
  }
  return data.title;
}

exports.startMangaCronJob = async (client) => {
  job = new CronJob(
    '0 0 */3 * * *',
    async () => {
      await exports.mangaCheck(client);
    },
    null,
    true,
    'America/New_York'
  );
}

exports.stopMangaCronJob = () => {
  job.stop();
}

exports.mangaCheck = async (client) => {
  let data = await db.find(config.DB_NAME, exports.COLLECTION_NAME, {});
  //console.log(`Data from database: ${JSON.stringify(data)}`);
  for (let manga of data) {
    let ret = {};
    try {
      ret = await axios.get(`https://api.mangadex.org/manga/${manga.manga_id}/feed?translatedLanguage[]=${manga.lang}&order[chapter]=desc&limit=1`);
      if (ret.data.data.length === 0) {
        continue;
      }
      if (parseFloat(ret.data.data[0].attributes.chapter) > parseFloat(manga.latest_chapter_num)) {
        //get data again to check for cover art update
        const updated_data = await axios.get(`https://api.mangadex.org/manga/${manga.manga_id}`);
        const new_cover = await exports.getCoverArt(manga.manga_id, updated_data.data.data.relationships.filter(rel => rel.type === 'cover_art')[0].id, true);
        if (new_cover !== manga.cover_art) {
          //update cover art in database
          const old_cover = manga.cover_art;
          await db.updateMany(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga.manga_id }, { $set: { cover_art: new_cover } });
          fs.unlink(path.join(__dirname, '..', 'images', old_cover), () => console.info(`Updated cover art for ${manga.title}`));
          manga.cover_art = new_cover; //update manga object to reflect new cover art for sending ping
        }
        const chapter = ret.data.data[0];
        console.info(`New chapter for ${manga.title} in ${exports.getLanguage(manga.lang)} has been released. Sending ping.`);
        //update database with new chapter
        let res = await db.updateOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga.manga_id, lang: manga.lang }, { $set: { latest_chapter: chapter.id, latest_chapter_num: chapter.attributes.chapter } });
        if (res === 0) {
          console.error(`Could not update database with new chapter for ${manga.title} in ${exports.getLanguage(manga.lang)}.`);
        }
        //put together ping and embed
        for (let guild_id in manga.ping_list) {
          const guild_config = await getGuildConfig(guild_id);
          //get guild config for the manga channel
          if (!guild_config) {
            console.error(`Could not find config for guild ${guild_id} when doing manga ping.`);
            continue;
          }
          let channel = null;
          try {
            channel = client.channels.cache.get(guild_config.channel_manga);
            if (!channel) {
              throw new Error('Channel not found');
            }
          } catch (err) {
            console.error(`Could not find channel for manga in guild ${guild_id}.`);
            continue;
          }
          let link = `https://mangadex.org/chapter/${chapter.id}`;
          let ping = '';
          for (let id of manga.ping_list[guild_id]) {
            ping += `<@${id}>-san `;
          }
          ping += `A new chapter of ${manga.title} in ${exports.getLanguage(manga.lang)} has been released! You can read it ${hyperlink('here', `<${link}>`)}.`;
          const cover = path.join(__dirname, '..', 'images', manga.cover_art);
          const image = manga.cover_art === exports.DEFAULT_IMAGE ? exports.DEFAULT_IMAGE : `attachment://${manga.cover_art}`;
          const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLOR)
            .setTitle(`${manga.title} - Chapter ${chapter.attributes.chapter}`)
            .addFields({ name: 'Language', value: exports.getLanguage(manga.lang) })
            .setFooter({ text: 'via Mangadex' })
            .setImage(image)
            .setTimestamp();
          if (manga.cover_art === exports.DEFAULT_IMAGE) {
            await channel.send({ content: ping, embeds: [embed] });
          } else {
            const file = new AttachmentBuilder(path.resolve(cover));
            await channel.send({ content: ping, embeds: [embed], files: [file] });
          }
        }
      }
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.error(`Mangadex error with ${manga.title} in ${exports.getLanguage(manga.lang)}. Details below:\n${JSON.stringify(err.response.data.errors[0])}`);
        continue;
        //  throw new AigisError(`<@${process.env.OWNER_ID}-san, in trying to check for manga updates Mangadex has told me my request is invalid. They say "${err.response.data.errors[0].detail}.`);
      } else {
        throw err;
      }
    }
  };
}