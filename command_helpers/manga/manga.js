/**
 * @fileoverview Contains helper functions for the manga command, including the cron job for checking for new chapters.
 */
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder, hyperlink } = require('discord.js');
const db = require('../../database/db');
const config = require('../../config');
const { getGuildConfig } = require('../../utils/utils');

exports.COLLECTION_NAME = 'manga';

/** Map of website names to their update function */

const websites = {
  mangadex: require('./mangadex'),
  mangapill: require('./mangapill'),
  mangakakalot: require('./mangakakalot'),
  manganato: require('./manganato'),
}

exports.mangaCheck = async (client) => {
  let data = await db.find(config.DB_NAME, exports.COLLECTION_NAME, {});
  for (let manga of data) {
    console.info(`New chapter for ${manga.title} on ${manga.website} in ${exports.getLanguage(manga.lang)} has been released. Sending ping.`);
    //ensure the website functions can be dynamically called
    if (websites[manga.website] == null) {
      console.warn(`Website ${manga.website} is not supported for manga updates.`);
      continue;
    }
    try {
      //dynamically call the correct function based on the website
      const chapter = await websites[manga.website].checkForUpdates(manga);
      if (chapter == null) {
        //no new chapter
        continue;
      }
      // if a new cover art is found then remove the old one
      if (manga.cover_art !== chapter.cover_art) {
        fs.unlink(path.join(__dirname, '..', '..', 'images', manga.cover_art), () => console.info(`Removed old cover art for ${manga.title}`));
      }
      //update database with new chapter
      let res = await db.updateOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga.manga_id, lang: manga.lang },
        { $set: { latest_chapter: chapter.latest_chapter, latest_chapter_num: chapter.latest_chapter_num, cover_art: chapter.cover_art } });
      if (res === 0) {
        console.error(`Could not update database with new chapter for ${manga.title} from ${manga.website} with language ${manga.lang}.`);
      }
      //put together ping and embed for each guild
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
        let link = websites[manga.website].generateChapterLink(chapter.latest_chapter);
        let ping = '';
        for (let id of manga.ping_list[guild_id]) {
          ping += `<@${id}>-san `;
        }
        const manga_link = websites[manga.website].generateMangaLink(manga.manga_id);
        ping += `A new chapter of ${hyperlink(manga.title, manga_link)} on ${websites[manga.website].NAME} in ${exports.getLanguage(manga.lang)} has been released! You can read it ${hyperlink('here', `<${link}>`)}.`;
        const cover = path.join(__dirname, '..', '..', 'images', chapter.cover_art);
        const image = chapter.cover_art === config.DEFAULT_MANGA_IMAGE ? config.DEFAULT_MANGA_IMAGE : `attachment://${chapter.cover_art}`;
        const embed = new EmbedBuilder()
          .setColor(config.EMBED_COLOR)
          .setTitle(`${manga.title} - Chapter ${chapter.latest_chapter_num}`)
          .addFields({ name: 'Language', value: exports.getLanguage(manga.lang) })
          .setFooter({ text: `via ${manga.website}` })
          .setImage(image)
          .setTimestamp();
        if (manga.cover_art === config.DEFAULT_MANGA_IMAGE) {
          await channel.send({ content: ping, embeds: [embed] });
        } else {
          const file = new AttachmentBuilder(path.resolve(cover));
          await channel.send({ content: ping, embeds: [embed], files: [file] });
        }
      }
    } catch (err) {
      console.error(`Could not check for updates for ${manga.title} on ${manga.website} in ${manga.lang}.`);
      console.error(err);
      continue;
    }
  }
}

exports.listManga = async (guild_id, user_id) => {
  let data = await db.find(config.DB_NAME, exports.COLLECTION_NAME, { [`ping_list.${guild_id}`]: user_id });
  let str = '';
  for (const m of data) {
    try {
      const link = websites[m.website].generateMangaLink(m.manga_id);
      if (m.lang !== 'en') {
        str += `- ${hyperlink(`${m.title}`, `<${link}>`)} on ${websites[m.website].NAME} in ${exports.getLanguage(m.lang)}\n`;
      } else {
        str += `- ${hyperlink(`${m.title}`, `<${link}>`)} on ${websites[m.website].NAME}\n`;
      }
    } catch (err) {
      console.error(`Could not generate link for ${m.title} on ${m.website} in ${m.lang}.`);
      continue;
    }
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

/** Unfollows a manga from any website, based solely on the manga id provided. language is optional, default is en */
exports.unfollowManga = async (guild_id, manga_id, user_id, lang = 'en') => {
  let data = await db.findOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang });
  if (!data) {
    return false;
  }
  if (Object.keys(data.ping_list).length === 1 && data.ping_list[guild_id].length === 1) {
    await db.deleteOne(config.DB_NAME, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang });
    const fp = path.join(__dirname, '..', '..', 'images', data.cover_art);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
    }
  } else {
    //$pull will remove the specified user id from the ping list
    await db.updateOne(guild_id, exports.COLLECTION_NAME, { manga_id: manga_id, lang: lang }, { $pull: { [`ping_list.${guild_id}`]: user_id } });
  }
  return data.title;
}

exports.getLanguage = (lang) => {
  if (config.MANGADEX_ISO6391[lang]) {
    return config.MANGADEX_ISO6391[lang];
  } else {
    return ISO6391.getName(lang);
  }
}
