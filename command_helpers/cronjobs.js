const { CronJob } = require('cron');
const config = require('../config.js');
const { selectSong } = require('./sotd');
const { mangaCheck } = require('./manga/manga');
const { purgeAll } = require('./purge');
const { resetDaily } = require('./daily');
const { getGuildConfig } = require('../utils/utils');
const db = require('../database/db');
const AigisError = require('../utils/AigisError');

//All cronjob objects
let sotdJob;
let mangaJob;
let purgeJob;
let tokenJob;

/* --------------- SOTD --------------- */
exports.startSotd = (client) => {
  sotdJob = new CronJob(
    '0 0 0 * * *',
    async () => {
      //get all server configurations
      const data = await db.find(config.DB_NAME, 'config', {});
      //execute song of the day for each server
      for (const d of data) {
        try {
          let channel = client.channels.cache.get(d.channel_sotd);
          const arr = await selectSong(d.guild_id);
          await channel.send({ embeds: [arr[0]] });
          if (arr[1] != null) {
            await channel.send({ files: [arr[1]] });
          }
        } catch (err) {
          if (err instanceof AigisError && err.status === 400) {
            continue; //no playlists to select from - ignore this error it's not important
          } else {
            console.error(`Could not get song of the day for guild ${d.guild_id}. Error: ${err}`);
          }
        }
      }
    },
    null,
    true,
    'America/New_York'
  );
}

exports.stopSotd = () => {
  sotdJob.stop();
}

/* --------------- Manga --------------- */
exports.startMangaChecks = async (client) => {
  mangaJob = new CronJob(
    '0 0 * * * *',
    async () => {
      await mangaCheck(client);
    },
    null,
    true,
    'America/New_York'
  );
}

exports.stopMangaChecks = () => {
  mangaJob.stop();
}

/* --------------- Purge --------------- */
exports.startPurgeChecks = (client) => {
  purgeJob = new CronJob(
    '0 0 0 * * *',
    async () => {
      //get all server configurations
      const guilds = client.guilds.cache.map(g => g.id);
      for (const guildId of guilds) {
        try {
          const cfg = await getGuildConfig(guildId);
          if (cfg && cfg.purge_date && cfg.purge_date < new Date()) {
            console.info(`Purging data for guild ${guildId}`);
            await purgeAll(guildId);
          }
        } catch (err) {
          console.error(`Error purging data for guild ${guildId}`, err);
          continue;
        }
      }
    },
    null,
    true,
    'America/New_York'
  );
}

exports.stopPurgeChecks = () => {
  purgeJob.stop();
}

/* --------------- Tokens --------------- */
exports.startDailyTokenChecks = (client) => {
  tokenJob = new CronJob(
    '0 0 0 * * *',
    async () => {
      await resetDaily();
    },
    null,
    true,
    'America/New_York'
  );
}

exports.stopDailyTokenChecks = () => {
  tokenJob.stop();
}

