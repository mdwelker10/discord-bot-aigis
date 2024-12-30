require('dotenv').config();
const db = require('../database/db');
const config = require('../config');
const bignumber = require('bignumber.js');

if (process.argv.length !== 3) {
  console.log('Command useage: node reward.js <amount>\nRewards all users with specified amount of tokens');
  process.exit(1);
}

(async () => {
  const amount = parseInt(process.argv[2]);
  if (isNaN(amount)) {
    console.log('Invalid amount');
    process.exit(1);
  }
  const data = await db.find(config.DB_NAME, 'vt', {});
  for (const user of data) {
    const vt = new bignumber(user.vt);
    const newVt = vt.plus(amount);
    const ret = await db.updateOne(config.DB_NAME, 'vt', { user_id: user.user_id, guild_id: user.guild_id }, { $set: { vt: newVt.toString() } });
    if (ret == 0) {
      console.log(`Failed to reward user ${user.user_id} in guild ${user.guild_id}`);
    }
  }
  console.log('rewards granted');
  process.exit(0);
})();