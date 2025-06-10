const config = require('../config');
const db = require('../database/db');
const AigisError = require('../utils/AigisError');
const BigNumber = require('bignumber.js');
const { numberToString } = require('../utils/utils');

/** Claims daily tokens and return total token amount, daily streak count, and the bonus if a bonus is applied */
exports.claim = async (guildMember) => {
  const userId = guildMember.id;
  const guildId = guildMember.guild.id;
  const data = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
  if (!data) {
    //user not in database - calc tokens based on join date: 1 token per day since join date
    const oneDay = 24 * 60 * 60 * 1000; //in ms
    const joinDate = new Date(guildMember.joinedAt);
    const now = new Date();
    const diffDays = Math.round(Math.abs((now - joinDate) / oneDay));
    const tokens = 1000 + diffDays;
    console.info(`Created token database entry for user ${userId} in guild ${guildId}`);
    const insertTokens = new BigNumber(tokens).toString();
    await db.insert(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId, vt: insertTokens, daily_claimed: true, daily_streak: 1, bet: config.MIN_BET, gamble_history: '0' });
    return { tokens: numberToString(tokens), bonus: false, streak: 1, new_member: true };
  } else {
    //user in database, collect daily tokens
    if (data.daily_claimed) {
      return false; //already claimed
    }
    ret = { bonus: false, daily_streak: data.daily_streak + 1, new_member: false };
    //calc new tokens and weekly bonus if applicable
    ret.tokens = new BigNumber(data.vt).plus(config.DAILY_TOKEN_AMOUNT);
    if (ret.daily_streak % 7 == 0) {
      //weekly bonus: 2 * daily streak
      const bonus = 2 * (data.daily_streak + 1);
      ret.tokens = ret.tokens.plus(bonus);
      ret.bonus = bonus;
    }
    ret.tokens = ret.tokens.toString();
    //update database
    let update = { daily_claimed: true, vt: ret.tokens, daily_streak: ret.daily_streak };
    const res = await db.updateOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId }, { $set: update });
    if (res == 0) {
      throw new AigisError('the token claim could not successfully be completed.');
    }
    ret.tokens = numberToString(ret.tokens);
    return ret;
  }
}

exports.resetDaily = async () => {
  try {
    const data = await db.find(config.DB_NAME, 'vt', {});
    for (const d of data) {
      const streak = d.daily_claimed ? d.daily_streak : 0;
      await db.updateOne(config.DB_NAME, 'vt', { user_id: d.user_id, guild_id: d.guild_id }, { $set: { daily_claimed: false, daily_streak: streak } });
    }
    console.info('Daily token claims have been reset.');
  } catch (err) {
    console.error(`Could not reset daily token claims. Error: ${err}`);
  }
}