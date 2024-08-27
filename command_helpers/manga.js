const axios = require('axios');
const AigisError = require('../utils/AigisError');

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

/** get cover art URL given a manga ID and cover art ID */
exports.getCoverArt = async (mangaID, coverID) => {
  //const token = await checkToken();
  const data = await axios.get(`https://api.mangadex.org/cover/${coverID}`);
  const filename = data.data.data.attributes.fileName;
  const ret = `https://uploads.mangadex.org/covers/${mangaID}/${filename}`;
  console.log(ret);
  return ret;
}

exports.getMangaAuthor = async (authorID) => {
  //const token = await checkToken();
  const data = await axios.get(`https://api.mangadex.org/author/${authorID}`);
  return data.data.data.attributes.name;
}