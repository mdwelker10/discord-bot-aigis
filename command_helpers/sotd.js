const MyBuffer = require('../utils/MyBuffer');
const AigisError = require('../utils/AigisError');
const { EmbedBuilder, bold } = require('discord.js');
const db = require('../database/db');
const axios = require('axios');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { cleanTemp } = require('../utils/utils');

exports.MIN_LENGTH = 35;

exports.DS_COLL_NAME = 'sotd-ds';
exports.PLAYLISTS_COLL_NAME = 'sotd-playlists';

const MAX_TRIES = 5; //number of tries before giving up on finding a new song
const MAX_CHARS = Number.MAX_SAFE_INTEGER; //max number of characters for embed values (experimenting)

//check if Spotify JWT token is expired and create a new one if necessary. Return token value
exports.checkToken = async () => {
  let expiry = process.env.SPOTIFY_EXPIRE_TIME;
  let current = Math.floor(Date.now() / 1000) + 1000; // 1000 seconds before token expiry
  if (current > expiry) {
    let authOptions = {
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      headers: {
        'Authorization': 'Basic ' + (new Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({ 'grant_type': 'client_credentials' })
    };
    try {
      let response = await axios(authOptions);
      process.env.SPOTIFY_TOKEN = response.data.access_token;
      process.env.SPOTIFY_EXPIRE_TIME = Math.floor(Date.now() / 1000) + response.data.expires_in; //expires in an hour
      return process.env.SPOTIFY_TOKEN;
    } catch (err) {
      throw new AigisError("I could not verify your authentication token. I cant access Spotify!");
    }
  } else {
    return process.env.SPOTIFY_TOKEN;
  }
}



exports.insertPlaylist = async (playlist, guildId) => {
  data = await db.findOne(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, { 'spotify_id': playlist.spotify_id });
  //if this server has this playlist added already
  if (data && data.guild_ids.includes(guildId)) {
    return false;
  }
  let playlists = await getPlaylistBuffer(guildId);
  //if this playlist exists but this server does not have it added
  if (data) {
    //add playlist to database
    await db.updateOne(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, { 'spotify_id': playlist.spotify_id }, { $push: { 'guild_ids': guildId } });
  } else {
    //playlist is not in database
    playlist.guild_ids = [guildId];
    await db.insert(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, playlist);
  }
  //add playlist to buffer and insert into database
  playlists.insert(playlist.spotify_id);
  await writePlaylists(guildId, playlists);
  return true;
}

//force determines whether to remove the playlist even if multiple guilds have it added
exports.removePlaylist = async (playlist_id, guildId, playlists = null, force = false) => {
  let data = await db.findOne(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, { spotify_id: playlist_id });
  //if playlist doesnt exist or this server does not have it added
  if (!data || (!force && !data.guild_ids.includes(guildId))) {
    return false;
  }
  //if this playlist is only added by this server, remove it from database
  if (data.guild_ids.length === 1 || force) {
    await db.deleteOne(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, { spotify_id: playlist_id });
  } else {
    //remove this server from the guild_ids array
    await db.updateOne(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, { spotify_id: playlist_id }, { $pull: { guild_ids: guildId } });
  }
  if (!playlists) {
    playlists = await getPlaylistBuffer(guildId);
  }
  //pass a function to remove that returns false for elements to be removed, and the id to remove. See docs for MyBuffer.remove
  playlists.remove((item, arr) => item != arr[0], playlist_id);
  await writePlaylists(guildId, playlists);
  return true;
}

exports.selectSong = async (guildId) => {
  let playlists = await getPlaylistBuffer(guildId);
  if (playlists.length === 0) {
    throw new AigisError('there are no playlists to select a song from.');
  }
  let token = await exports.checkToken();
  let searching = true; // still searching for new song
  let tries = 0; // number of tries before giving up and returning current song
  let id = playlists.get(); // get playlist from buffer
  let playlist = await db.findOne(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, { spotify_id: id }); //get playlist object from database
  let length = playlist.length; //get length from database
  let offset = Math.floor(Math.random() * length); //generate offset based on length in database
  let songs = await getSongs(guildId); //get recently chosen songs list from database
  lbl: while (searching) {
    //get playlist tracks
    try {
      const res = await axios.get(`https://api.spotify.com/v1/playlists/${id}/tracks?offset=${offset}&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const song = res.data.items[0];
      //only check for repeat if within max number of tries
      if (tries < MAX_TRIES) {
        for (let s of songs) {
          if (s === song.track.id) {
            tries += 1;
            continue lbl;
          }
        }
      }
      if (tries >= MAX_TRIES) {
        console.info(`SOTD -- Could not find a new song in less than ${MAX_TRIES} tries. New song might be repeat. Selected song ${song.track.name}.`);
      }
      searching = false;
      //update length of playlist in database - does not need to be concurrent
      await db.updateOne(config.DB_NAME, exports.PLAYLISTS_COLL_NAME, { 'spotify_id': id }, { $set: { 'length': res.data.total } }, true).then(result => {
        if (res.data.total < exports.MIN_LENGTH) {
          console.error('Playlist ' + id + ' is too short to be used for Song of the Day. It is being removed.');
          exports.removePlaylist(id, guildId, playlists, true);
        }
      });
      songs.push(song.track.id);
      await writeSongs(guildId, songs);
      await writePlaylists(guildId, playlists);
      //adjust lengths for better display
      let songStr = song.track.name.length > MAX_CHARS ? song.track.name.substring(0, MAX_CHARS) + '...' : song.track.name;
      let albumStr = song.track.album.name.length > MAX_CHARS ? song.track.album.name.substring(0, MAX_CHARS) + '...' : song.track.album.name;
      let playlistOwnerStr = playlist.owner.length > MAX_CHARS ? playlist.owner.substring(0, MAX_CHARS) + '...' : playlist.owner;
      //get artist string for possible multiple artists
      let artistStr = '';
      if (song.track.artists.length == 1) {
        artistStr = song.track.artists[0].name;
      } else {
        artistStr = `${song.track.artists[0].name} and ${song.track.artists.length - 1} other`;
        artistStr += song.track.artists.length - 1 > 1 ? 's' : '';
      }
      //build embed to display song
      const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setTitle('Song of the Day')
        .addFields(
          { name: `${bold('Song')}`, value: `[${songStr}](${song.track.external_urls.spotify})` },
          { name: `Artist`, value: artistStr },
          { name: `Album`, value: albumStr },
          { name: `Playlist`, value: `[${playlist.name}](<https://open.spotify.com/playlist/${id}>)` },
          { name: `Playlist Owner`, value: playlistOwnerStr }
        )
        .setImage(song.track.album.images[0].url)
        .setTimestamp()
      const preview_url = song.track.preview_url;
      if (preview_url != null) {
        const res = await axios.get(preview_url, { responseType: 'stream' });
        cleanTemp();
        const filePath = path.join(__dirname, '..', 'temp', `${song.track.name} [Preview].mp3`);
        const writer = fs.createWriteStream(filePath, { autoClose: true });
        res.data.pipe(writer);
        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            resolve([embed, path.resolve(filePath)]);
          });
          writer.on('error', (err) => {
            console.error(err);
            resolve([embed, null]);
          });
        });
      } else {
        console.info(`SOTD -- song ${song.track.name} does not have a preview URL.`);
      }
      return [embed, song.track.preview_url];
    } catch (err) {
      throw err;
    }
  }
}

/**
 * get playlist buffer from database, write to it, place back in database
 * probably inefficient but it guaranteed circular buffer works properly 
 */
async function getPlaylistBuffer(guildId) {
  let obj = await db.findOne(config.DB_NAME, exports.DS_COLL_NAME, { structure: 'playlists', guild_id: guildId });
  let playlists = null;
  if (!obj) {
    playlists = new MyBuffer();
  } else {
    playlists = new MyBuffer(obj.data);
  }
  return playlists;
}

async function writePlaylists(guildId, playlists) {
  await db.updateOne(config.DB_NAME, exports.DS_COLL_NAME, { structure: 'playlists', guild_id: guildId }, { $set: { 'data': playlists.toString() } }, true);
}

async function getSongs(guildId) {
  let obj = await db.findOne(config.DB_NAME, exports.DS_COLL_NAME, { structure: 'songs', guild_id: guildId });
  if (!obj) {
    return [];
  } else {
    return obj.data.split(',');
  }
}

async function writeSongs(guildId, songs) {
  await db.updateOne(config.DB_NAME, exports.DS_COLL_NAME, { structure: 'songs', guild_id: guildId }, { $set: { 'data': songs.length == 0 ? '' : songs.join(',') } }, true);
}