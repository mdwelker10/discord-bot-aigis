const db = require('../database/db');
const config = require('../utils/config');

exports.purgeAll = async (guildId) => {
  await db.deleteOne(config.DB_NAME, 'config', { guild_id: guildId });
  await purgeSotd(guildId);
  await purgeManga(guildId);
  await purgeVT(guildId);
}

async function purgeSotd(guildId) {
  await db.deleteOne(config.DB_NAME, 'sotd-ds', { guild_id: guildId });
  let modified = await db.updateMany(config.DB_NAME, 'sotd-playlists', {}, { $pull: { guild_ids: guildId } });
  if (modified != 0) {
    await db.deleteMany(config.DB_NAME, 'sotd-playlists', { guild_ids: { $size: 0 } });
  }
}

async function purgeManga(guildId) {
  let modified = await db.updateMany(config.DB_NAME, 'manga', {}, { $unset: { [`ping_list.${guildId}`]: "" } });
  if (modified != 0) {
    await db.deleteMany(config.DB_NAME, 'manga', { ping_list: {} });
  }
}

async function purgeVT(guildId) {
  await db.deleteMany(config.DB_NAME, 'vt', { guild_id: { guildId } });
}
