const db = require('../database/db');
const config = require('../config.json');

if (process.env.argv.length !== 3) {
  console.log('Command useage: node reward.js <amount>\nRewards all users with specified amount of tokens');
  process.exit(1);
}

(async () => {
  const amount = parseInt(process.argv[2]);
  if (isNaN(amount)) {
    console.log('Invalid amount');
    process.exit(1);
  }
  const numModified = await db.updateMany(config.DB_NAME, 'vt', {}, { $inc: { tokens: amount } });
  console.log(`Modified ${numModified} documents`);
}); 