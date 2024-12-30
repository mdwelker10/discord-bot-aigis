const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../../config');

const db = require('../../database/db');
const SPECIAL_COMMANDS = ['sotd', 'manga'];
const { getGuildConfig } = require('../../utils/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up Aigis for your server.')
    .addBooleanOption(option =>
      option.setName('force')
        .setDescription('Force configuration override')
        .setRequired(false)
    ),
  async execute(interaction) {
    const username = interaction.user.displayName;
    //check for permission to set up the bot (anyone with manage server permission)
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return await interaction.reply({ content: `${username}-san, you do not have permission to do that!`, ephemeral: true });
    }
    //build modal
    const modal = new ModalBuilder()
      .setCustomId('setup')
      .setTitle('Aigis Setup');
    //add inputs for each configuration option
    // const roleIdInput = new TextInputBuilder()
    //   .setCustomId('roleID')
    //   .setPlaceholder('Enter a role ID')
    //   .setLabel('Role ID for privileged commands')
    //   .setStyle(TextInputStyle.Short)
    //   .setRequired(true);

    const defaultChannelInput = new TextInputBuilder()
      .setCustomId('defaultChannel')
      .setPlaceholder('Enter a channel ID')
      .setLabel('Default channel for Aigis commands')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const specialChannels = new TextInputBuilder()
      .setCustomId('specialChannels')
      .setPlaceholder(`Format:\n${SPECIAL_COMMANDS.map(c => `${c}:channelID`).join('\n')}`)
      .setLabel('Command announcement channels. Optional')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    //NOTE: Can only have 5 the above builders, will need a setup 2 command or restructure if adding more
    // const ar1 = new ActionRowBuilder().addComponents(roleIdInput);
    const ar2 = new ActionRowBuilder().addComponents(defaultChannelInput);
    const ar3 = new ActionRowBuilder().addComponents(specialChannels);
    modal.addComponents(ar2, ar3);
    await interaction.showModal(modal);

    //handle modal submission
    const submitted = await interaction.awaitModalSubmit({
      time: 90000, //timeout after 90 seconds. Required in case user closes modal without submitting
      filter: i => i.user.id === interaction.user.id //only accept modals from user that sent original interaction
    }).catch(error => {
      return null; //in case theres a time out or user closes modal
    });

    if (submitted) {
      const guild = interaction.guild;
      //const roleId = submitted.fields.getTextInputValue('roleID');
      const defaultChannel = submitted.fields.getTextInputValue('defaultChannel');
      //check if the role ID and default channel ID are valid IDs. If identifier is invalid a DiscordAPI error is thrown, so 2 checks needed 
      // try {
      //   if (roleId.trim().toLowerCase() != 'everyone') {
      //     let role = await guild.roles.fetch(roleId);
      //     if (role == null) {
      //       return await submitted.reply({ content: `${username}-san! The role ID "${roleId}" is not valid. Please try the setup again.`, ephemeral: true });
      //     }
      //   }
      // } catch (error) {
      //   return await submitted.reply({ content: `${username}-san! The role ID "${roleId}" is not valid. Please try the setup again.`, ephemeral: true });
      // }
      //since channel id check also happens later, get all channels in one go
      let channels = null
      try {
        channels = await guild.channels.fetch();
        if (channels.find(c => c.id === defaultChannel) == null) {
          return await submitted.reply({ content: `${username}-san! The default channel ID ${defaultChannel} is not valid. Please try the setup again.`, ephemeral: true });
        }
      } catch (error) {
        return await submitted.reply({ content: `${username}-san! The default channel ID ${defaultChannel} is not valid. Please try the setup again.`, ephemeral: true });
      }
      //special channels can be empty so errors will be shown to user but transaction will still go through
      const specialChannels = submitted.fields.getTextInputValue('specialChannels');
      //parse input
      const map = new Map();
      SPECIAL_COMMANDS.forEach(c => map.set(`channel_${c}`, defaultChannel));
      let errMsg = ''; //will remain empty if no errors
      specialChannels.split('\n').forEach(r => {
        if (!r || r === '') return;
        const [command, channel] = r.split(':');
        if (command && channel) {

          let ch = channels.find(c => c.id === channel);
          if (!SPECIAL_COMMANDS.includes(command)) {
            errMsg += `Invalid command: ${command}\n`;
          } else if (ch == null) {
            errMsg += `Invalid channel ID: ${channel}\n`;
          } else {
            map.set(`channel_${command}`, channel);
          }
        } else {
          errMsg += `Invalid line format: ${r}\n`;
        }
      });
      if (errMsg != '') {
        try {
          await submitted.reply({
            content: `${username}-san, there were errors in your input. If a command's announcement channel could not be set then the default channel will be used by default. The errors are:\n${errMsg}`, ephemeral: true
          });
          return;
        } catch (error) {
          //if there is an error sending the error message, log it and send a generic error message. Could happen if too many errors in input
          console.error(error);
          await submitted.reply({ content: `${username}-san, you really messed up big time. There was an error sending the error message. Please try again.`, ephemeral: true });
        }
      }
      map.set('channel_default', defaultChannel);
      map.set('guild_id', guild.id);
      const force = interaction.options.getBoolean('force') ?? false;
      //get the config document for the server if it exists.
      const guildConfig = await getGuildConfig(guild.id);
      const disabledCommands = guildConfig ? guildConfig.disabled_commands : [];
      map.set('disabled_commands', disabledCommands);
      map.set('sotd_role_id', guildConfig ? guildConfig.sotd_role_id : guild.id);
      if (!guildConfig || force) {
        //if no config document exists or force enabled then replace/upsert config document
        await db.replace(config.DB_NAME, 'config', { guild_id: guild.id }, map, true);
      } else {
        //if config document exists and force not enabled then return error
        return await submitted.reply({ content: `${username}-san, the configuration for this server already exists. Please use the force option to override.`, ephemeral: true });
      }
      //send success message
      return await submitted.reply({ content: `The configuration has been set up successfully.`, ephemeral: true });
    }
  }
};