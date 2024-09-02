const { SlashCommandBuilder, EmbedBuilder, bold, hyperlink, } = require("discord.js");
const axios = require('axios');
const db = require("../../database/db");
const AigisError = require('../../utils/AigisError');
const { insertPlaylist, removePlaylist, checkToken, selectSong } = require('../../command_helpers/sotd');
const { DB_NAME, MIN_LENGTH } = require('../../command_helpers/sotd');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sotd')
    .setDescription("For setting up Song of The Day")
    .addSubcommand(subcmd =>
      subcmd.setName('add-playlist')
        .setDescription('Add a playlist to select from for Song of The Day')
        .addStringOption(option =>
          option.setName('playlist-id')
            .setDescription('The id of the playlist to add')
            .setRequired(true)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('remove-playlist')
        .setDescription('Remove a playlist to select from for Song of The Day')
        .addStringOption(option =>
          option.setName('playlist-id')
            .setDescription('The link of the playlist to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('list-playlists')
        .setDescription('List all song of the day playlists')
    )
    .addSubcommand(subcmd =>
      subcmd.setName('select')
        .setDescription('Manually select a song for Song of The Day, mostly to be used for testing'))
    .addSubcommand(subcmd =>
      subcmd.setName('help')
        .setDescription('Get help on how to use the Song of The Day command')
    ),
  async execute(interaction) {
    const roles = process.env.ROLE_IDS.split(", ");
    let persmission = false;
    for (const role of roles) {
      if (interaction.member.roles.cache.has(role)) {
        persmission = true;
        break;
      }
    }
    if (!persmission) {
      return await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, you do not have permission to use this command.`);
    }
    try {
      if (interaction.options.getSubcommand() === 'help') { //help
        let str = `Here is some guidance on how to use the Song of the Day feature ${interaction.user.displayName}-san. I promise it is very easy. Just so you know, the playlist-id is the Spotify ID of the playlist.`;
        str += ` If you have a link for the playlist like \`spotify.com/playlist/2KoXhS4FAumKfk0FJw2mpv\`, the playlist-id is the last part of the link, in this case \`2KoXhS4FAumKfk0FJw2mpv\`.`;
        str += ` There might be more to the link you have, but only worry about text before the question mark.`;
        const embed = new EmbedBuilder()
          .setColor(config.EMBED_COLOR)
          .setTitle('Song of the Day Help')
          .setDescription(str)
          .setThumbnail('https://i.imgur.com/U0ze5EY.png')
          .addFields(
            { name: '/sotd help', value: 'This command showing all the Song of the Day commands' },
            { name: '/sotd add-playlist <playlist-id>', value: 'Add a playlist to the list of playlists to select from for Song of the Day. Playlist must have at least 50 songs.' },
            { name: '/sotd remove-playlist <playlist-id>', value: 'Remove a playlist from the list of playlists to select from for Song of the Day.' },
            { name: '/sotd list-playlists', value: 'List all the playlists that are currently in the list of playlists to select from for Song of the Day.' },
            { name: '/sotd select', value: `Manually select a song for Song of the Day, this is only for testing ${interaction.user.displayName}-san.` }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      }
      else if (interaction.options.getSubcommand() === 'list-playlists') { //list playlists
        let embed = await listPlaylists();
        await interaction.editReply({ embeds: [embed] });
      }
      else if (interaction.options.getSubcommand() === 'select') { //select a song
        if (process.env.DEV != 1) {
          await interaction.editReply(`${interaction.user.displayName}-san, the testing phase for the Song of the Day is over.`);
        } else {
          try {
            const arr = await selectSong();
            await interaction.editReply({ embeds: [arr[0]] });
            if (arr[1] != null) {
              interaction.channel.send({ files: [arr[1]] });
            }
          } catch (err) {
            if (err instanceof AigisError || !err.response || !err.response.status) {
              throw err;
            }
            if (err.response.status === 400) {
              throw new AigisError(`something went wrong getting the Song of the Day. I am not sure what happened. Please tell Trashpanda-san to look at the logs.`);
            } else if (err.response.status === 404) {
              throw new AigisError(`the playlist selected does not exist on Spotify. Was it deleted?`);
            } else if (err.response.status >= 500) {
              throw new AigisError(`something to do with Spotify. It is their fault ${interaction.user.displayName}-san, I am sure of it!`);
            } else if (err.response.status === 401 || err.response.status === 403) {
              throw new AigisError(`the Spotify access token is bad! ${interaction.user.displayName}-san, I cannot get any data without a valid token.`);
            } else if (err.response.status === 429) {
              throw new AigisError(`Spotify is not allowing me to get their data right now. How rude! ${interaction.user.displayName}-san, I need you to please wait and try again later.`);
            } else {
              throw new AigisError(`uh... um... ${interaction.user.displayName}-san? I don't know what happened. The Spotify status code was ${err.response.status}, but my programming does not have protocol for that`);
            }
          }
        }
      }
      else if (interaction.options.getSubcommand() === 'add-playlist') { //add playlist
        let pid = interaction.options.getString('playlist-id');
        let name = await addPlaylist(pid, interaction.user.displayName);
        console.log(`${interaction.user.id} added SOTD playlist ${name}`);
        await interaction.editReply(`I have added the playlist "${name}" to the list of Song of the Day playlists ${interaction.user.displayName}-san.`);
      }
      else if (interaction.options.getSubcommand() === 'remove-playlist') { //remove playlist
        let pid = interaction.options.getString('playlist-id');
        let result = await removePlaylist(pid);
        if (result) {
          console.log(`${interaction.user.id} removed playlist with ID ${pid}`);
          await interaction.editReply(`Alright ${interaction.user.displayName}-san, I have removed the playlist.`);
        } else {
          await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, but that playlist does not seem to be in the Song of the Day playlists.`);
        }
      }
      else {
        await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I do not recognize the command you gave me.`)
      }
    } catch (err) {
      if (err instanceof AigisError) {
        await interaction.editReply(`${interaction.user.displayName}-san! I'm sorry but I have encountered an issue while executing your command. The problem is ${err.message}`);
      }
      else {
        console.error(err);
        await interaction.editReply(`${interaction.user.displayName}-san... I do not know what happened. My programming indicated there was an issue but it is unknown to me. The issue is ${err.message}`)
      }
    }
  },
};

async function addPlaylist(id, name) {
  let token = await checkToken();
  try {
    let res = await axios.get(`https://api.spotify.com/v1/playlists/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    let data = res.data;
    let document = {
      'name': data.name,
      'spotify_id': id,
      'length': data.tracks.total,
      'owner': data.owner.display_name,
      'image': data.images[0].url
    }
    if (data.tracks.total < MIN_LENGTH) {
      throw new AigisError('the playlist needs at least 50 songs, or it is too short to be used for the Song of the Day.');
    }
    let success = await insertPlaylist(document);
    if (!success) {
      throw new AigisError('that playlist is already in the list of Song of the Day playlists.');
    }
    return data.name;
  } catch (err) {
    if (err instanceof AigisError) {
      throw err;
    }
    if (err.response.status === 400) {
      throw new AigisError(`the playlist ID is not valid. You have typed it wrong.`);
    } else if (err.response.status === 404) {
      throw new AigisError(`that playlist does not exist on Spotify. Did you get the ID wrong? Also ${name}-san, I cannot add a playlist if it is private.`);
    } else if (err.response.status >= 500) {
      throw new AigisError(`something to do with Spotify. It is their fault ${name}-san, I am sure of it!`);
    } else if (err.response.status === 401 || err.response.status === 403) {
      throw new AigisError(`the Spotify access token is bad! ${name}-san, I cannot get any data without a valid token.`);
    } else if (err.response.status === 429) {
      throw new AigisError(`Spotify is not allowing me to get their data right now. How rude! ${name}-san, I need you to please wait and try again later.`);
    } else {
      throw new AigisError(`uh... um... ${name}-san? I don't know what happened. The Spotify status code was ${err.response.status}, but my programming does not have protocol for that`);
    }
  }
}

async function listPlaylists() {
  let data = await db.find(DB_NAME, 'playlists', {});
  if (data.length == 0) {
    return new EmbedBuilder()
      .setColor(config.EMBED_COLOR)
      .setTitle('Song of the Day Playlists')
      .setDescription('There are no playlists in the list of Song of the Day playlists.')
      .setTimestamp();
  }
  let str = '';
  for (const playlist of data) {
    str += `- ${hyperlink(`${playlist.name} by ${playlist.owner}`, `<https://open.spotify.com/playlist/${playlist.spotify_id}>`)}\n`;
  }
  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLOR)
    .setTitle('Song of the Day Playlists')
    .setDescription(str)
    .setTimestamp();
  //.setFooter({text: 'Only the first X playlists shown', iconURL: 'https://i.imgur.com/2rZa85n.jpg'});
  return embed;
}