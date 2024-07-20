/* For getting ranks from a game via tracker.gg */
const axios = require('axios');
const AigisError = require('../../utils/AigisError');

const GAME_CONVERT = {
  'Rocket League': 'rocket-league',
  'CS:GO': 'csgo',
  'Apex Legends': 'apex',
  'Splitgate': 'splitgate'
}

const PLATFORM_CONVERT = {
  'Steam': 'steam',
  'Xbox': 'xbl',
  'Playstation': 'psn',
  'PC': 'origin'
}

/** Expects the game and platform names to be the display names, will be converted for internal use */
exports.getRank = async function getRank(game, platform, username) {
  //convert to internal names
  const game_name = GAME_CONVERT[game];
  const platform_name = PLATFORM_CONVERT[platform];
  try {
    if (game_name === 'rocket-league') {
      // Rocket League has a different platform name for PC than Overwatch
      if (platform === 'pc') {
        platform_name = 'epic';
      }
    }
    const url = `https://public-api.tracker.gg/v2/${game_name}/standard/profile/${platform}/${username}`;
    const response = await axios.get(url, {
      headers: {
        'TRN-Api-Key': process.env.TRACKER_API_KEY
      }
    });
    return response.data;
  } catch (err) {
    if (err.response && err.response.status == 401) {
      throw new AigisError(`I seem to have encountered an authentication issue. Please blame Trashpanda-san.`);
    } else if (err.response && err.response.status == 404) {
      throw new AigisError(`I could not find a profile for ${username} on ${platform} for ${game}.`);
    } else if (err.response && err.response.status >= 500) {
      throw new AigisError('The tracker.gg API is currently experiencing issues. This is not my fault.');
    } else {
      throw err;
    }
  }
}