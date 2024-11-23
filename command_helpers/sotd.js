const MyBuffer = require('../utils/MyBuffer');
const AigisError = require('../utils/AigisError');
const { EmbedBuilder, bold } = require('discord.js');
const db = require('../database/db');
const axios = require('axios');
const { CronJob } = require('cron');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { cleanTemp } = require('../utils/methods');

exports.MIN_LENGTH = 50;
exports.DB_NAME = 'sotd';

const MAX_TRIES = 5; //number of tries before giving up on finding a new song
const MAX_CHARS = Number.MAX_SAFE_INTEGER; //max number of characters for embed values (experimenting)

let playlists; //buffer for playlists
let songs; //songs array for recently used songs
let job; //cronjob object

/** Initialize the data structures */
exports.initSOTD = async () => {
  try {
    let obj = await db.find(exports.DB_NAME, 'ds', { 'structure': 'playlists' });
    playlists = new MyBuffer(obj[0].data);
    obj = await db.find(exports.DB_NAME, 'ds', { 'structure': 'songs' });
    songs = obj[0].data.split(',');
  } catch (err) {
    console.warn('Error initializing SOTD data structures, expected on first time.');
    playlists = new MyBuffer();
    songs = [];
    writeData();
    console.error(err);
  }
}

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

exports.startSotdCronJob = (client) => {
  job = new CronJob(
    '0 0 0 * * *',
    async () => {
      let channel = client.channels.cache.get(config.SOTD_CHANNEL_ID);
      const arr = await exports.selectSong();
      await channel.send({ embeds: [arr[0]] });
      if (arr[1] != null) {
        await channel.send({ files: [arr[1]] });
      }
    },
    null,
    true,
    'America/New_York'
  );
}

exports.stopSotdCronJob = () => {
  job.stop();
}

exports.insertPlaylist = async (playlist) => {
  data = await db.findOne(exports.DB_NAME, 'playlists', { 'spotify_id': playlist.spotify_id });
  if (data) {
    return false;
  }
  await db.insert(exports.DB_NAME, 'playlists', playlist);
  playlists.insert(playlist.spotify_id);
  writeData();
  return true;
}

exports.removePlaylist = async (playlist_id) => {
  let res = await db.deleteOne(exports.DB_NAME, 'playlists', { 'spotify_id': playlist_id });
  if (res === 0) {
    return false;
  }
  //pass a function to remove that returns false for elements to be removed, and the id to remove. See docs for MyBuffer.remove
  playlists.remove((item, arr) => item != arr[0], playlist_id);
  writeData();
  return true;
}

exports.selectSong = async () => {
  if (playlists.length === 0) {
    throw new AigisError('there are no playlists to select a song from.');
  }
  let token = await exports.checkToken();
  let searching = true; // still searching for new song
  let tries = 0; // number of tries before giving up and returning current song
  let id = playlists.get(); // get playlist from buffer
  let playlist = await db.findOne(exports.DB_NAME, 'playlists', { 'spotify_id': id }); //get playlist object from database
  let length = playlist.length; //get length from database
  let offset = Math.floor(Math.random() * length); //generate offset based on length in database
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
      await db.updateOne(exports.DB_NAME, 'playlists', { 'spotify_id': id }, { $set: { 'length': res.data.total } }, true).then(result => {
        if (res.data.total < exports.MIN_LENGTH) {
          console.error('Playlist ' + id + ' is too short to be used for Song of the Day. It is being removed.');
          exports.removePlaylist(id);
        }
      });
      songs.push(song.track.id);
      await writeData();
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

async function writeData() {
  await db.updateOne(exports.DB_NAME, 'ds', { 'structure': 'playlists' }, { $set: { 'data': playlists.toString() } }, true);
  await db.updateOne(exports.DB_NAME, 'ds', { 'structure': 'songs' }, { $set: { 'data': songs.length == 0 ? '' : songs.join(',') } }, true);
}   
