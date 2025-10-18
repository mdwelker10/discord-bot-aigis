const { SlashCommandBuilder, EmbedBuilder, bold, hyperlink, PermissionsBitField, MessageFlags } = require("discord.js");
const axios = require('axios');
const db = require("../../database/db");
const AigisError = require('../../utils/AigisError');
const { insertPlaylist, removePlaylist, checkToken, selectSong, stopSotdCronJob } = require('../../command_helpers/sotd');
const { PLAYLISTS_COLL_NAME } = require('../../command_helpers/sotd');
const config = require('../../utils/config');
const { getGuildConfig, isDeveloper, checkPermission } = require('../../utils/utils');

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
        .setDescription('Manually select a song for Song of The Day.'))
    .addSubcommand(subcmd =>
      subcmd.setName('help')
        .setDescription('Get help on how to use the Song of The Day command')
    )
    .addSubcommand(subcmd =>
      subcmd.setName('permissions')
        .setDescription('Set the permissions for adding and removing playlists from the Song of the Day')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to set permissions for.')
            .setRequired(true)
        )
    )
    .addSubcommand(subcmd =>
      subcmd.setName('stop')
        .setDescription('Stop the Song of the Day from running. Developer only.')
    ),
  async execute(interaction) {
    try {
      if (interaction.options.getSubcommand() === 'help') { //help
        let str = `Here is some guidance on how to use the Song of the Day feature ${interaction.user.displayName}-san. I promise it is very easy. Just so you know, the playlist-id is the Spotify ID of the playlist.`;
        str += ` If you have a link for the playlist like \`spotify.com/playlist/2KoXhS4FAumKfk0FJw2mpv\`, the playlist-id is the last part of the link, in this case \`2KoXhS4FAumKfk0FJw2mpv\`.`;
        str += ` There might be more to the link you have, but only worry about text before the question mark.`;
        const embed = new EmbedBuilder()
          .setColor(config.get('EMBED_COLOR'))
          .setTitle('Song of the Day Help')
          .setDescription(str)
          .setThumbnail(config.get('AIGIS_DANCING_IMAGE'))
          .addFields(
            { name: '/sotd help', value: 'This command showing all the Song of the Day commands' },
            { name: '/sotd add-playlist <playlist-id>', value: 'Add a playlist to the list of playlists to select from for Song of the Day. Playlist must have at least 50 songs.' },
            { name: '/sotd remove-playlist <playlist-id>', value: 'Remove a playlist from the list of playlists to select from for Song of the Day.' },
            { name: '/sotd list-playlists', value: 'List all the playlists that are currently in the list of playlists to select from for Song of the Day.' },
            { name: '/sotd select', value: `Manually select a song for Song of the Day, this is only for testing ${interaction.user.displayName}-san.` },
            { name: '/sotd permissions <role>', value: 'Set the permissions for modifying the Song of the Day rotation. Anyone with the given role will be allowed to add/remove playlists. Use the server ID to give this permission to everyone.' }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      }
      else if (interaction.options.getSubcommand() === 'list-playlists') { //list playlists
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command`);
          return;
        }
        let embed = await listPlaylists(interaction.guildId);
        await interaction.editReply({ embeds: [embed] });
      }
      else if (interaction.options.getSubcommand() === 'select') { //select a song
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command`);
          return;
        }
        if (config.get('DEV') != 1) {
          await interaction.editReply(`${interaction.user.displayName}-san, the testing phase for the Song of the Day is over.`);
        } else {
          try {
            const arr = await selectSong(interaction.guildId);
            await interaction.editReply({ embeds: [arr[0]] });
            if (arr[1] != null) {
              interaction.channel.send({ files: [arr[1]] });
            }
          } catch (err) {
            if (err instanceof AigisError || !err.response || !err.response.status) {
              throw err;
            }
            if (err.response.status === 400) {
              throw new AigisError(`something went wrong getting the Song of the Day. I am not sure what happened. Please tell a developer to look at my logs.`);
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
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command`);
          return;
        }
        //check for permission
        let p = await checkPermission(interaction.member, cfg, 'sotd_role_id');
        if (!p) {
          return await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, but you do not have the permission for that.`);
        }
        let pid = interaction.options.getString('playlist-id');
        let name = await addPlaylist(pid, interaction.user.displayName, interaction.guildId);
        console.log(`${interaction.user.id} added SOTD playlist ${name} in guild ${interaction.guildId}`);
        await interaction.editReply(`I have added the playlist "${name}" to the list of Song of the Day playlists ${interaction.user.displayName}-san.`);
      }
      else if (interaction.options.getSubcommand() === 'remove-playlist') { //remove playlist
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command.`);
          return;
        }
        //check for permission
        let p = await checkPermission(interaction.member, cfg, 'sotd_role_id');
        if (!p) {
          return await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, but you do not have the permission for that.`);
        }
        let pid = interaction.options.getString('playlist-id');
        let result = await removePlaylist(pid, interaction.guildId);
        if (result) {
          console.log(`${interaction.user.id} removed playlist with ID ${pid} in guild ${interaction.guildId}`);
          await interaction.editReply(`Alright ${interaction.user.displayName}-san, I have removed the playlist.`);
        } else {
          await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, but that playlist does not seem to be in the Song of the Day playlists.`);
        }
      }
      else if (interaction.options.getSubcommand() === 'permissions') { //set add/remove playlist persmissions
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, but you do not have the permissions to do that.`);
        }
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          return await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command.`);
        }
        const role = interaction.options.getRole('role');
        let exists = await interaction.guild.roles.fetch(role.id);
        if (!exists) {
          throw new AigisError(`the role ID of ${role.id} that you have given me does not exist.`);
        }
        let ret = await db.updateOne(config.get('DB_NAME'), 'config', { guild_id: interaction.guildId }, { $set: { sotd_role_id: role.id } });
        if (ret === 0) {
          throw new AigisError('I was unable to update the role ID in the database.');
        }
        return await interaction.editReply(`Alright ${interaction.user.displayName}-san, I have set the role ${role.name} to have permissions to add and remove playlists from the Song of the Day.`);
      }
      else if (interaction.options.getSubcommand() === 'stop') { //stop song of the day selection
        if (isDeveloper(interaction.user.id)) {
          await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, but only developers can stop the Song of the Day.`);
          return;
        } else {
          stopSotdCronJob();
          await interaction.editReply(`I have stopped the Song of the Day.`, { flags: MessageFlags.Ephemeral });
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

async function addPlaylist(id, name, guildId) {
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
    if (data.tracks.total < config.get('SOTD_MIN_PLAYLIST_LENGTH')) {
      throw new AigisError('the playlist needs at least 50 songs, or it is too short to be used for the Song of the Day.');
    }
    let success = await insertPlaylist(document, guildId);
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

async function listPlaylists(guildId) {
  let data = await db.find(config.get('DB_NAME'), PLAYLISTS_COLL_NAME, {});
  data = data.filter(p => p.guild_ids.includes(guildId));
  if (data.length == 0) {
    return new EmbedBuilder()
      .setColor(config.get('EMBED_COLOR'))
      .setTitle('Song of the Day Playlists')
      .setDescription('There are no playlists in the list of Song of the Day playlists.')
      .setTimestamp();
  }
  let str = '';
  for (const playlist of data) {
    str += `- ${hyperlink(`${playlist.name} by ${playlist.owner}`, `<https://open.spotify.com/playlist/${playlist.spotify_id}>`)}\n`;
    if (str.length > 3900) {
      console.error(`Song of the Day playlists list is too long for guild ${guildId}`);
      break;
    }
  }
  const embed = new EmbedBuilder()
    .setColor(config.get('EMBED_COLOR'))
    .setTitle('Song of the Day Playlists')
    .setDescription(str)
    .setTimestamp();
  //.setFooter({text: 'Only the first X playlists shown', iconURL: 'https://i.imgur.com/2rZa85n.jpg'});
  return embed;
}
