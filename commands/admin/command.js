const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const path = require('path');
const fs = require('fs');
const config = require('../../utils/config');
const db = require('../../database/db');
const { getCommandNames } = require('../../utils/utils');

let commandList = getCommandNames();
let datastoreCommands = ['sotd', 'manga']

module.exports = {
  data: new SlashCommandBuilder()
    .setName('command')
    .setDescription("Enable or disable Aigis' commands. Admin commands cannot be disabled.")
    .addSubcommand(sub =>
      sub.setName('help')
        .setDescription('Get help on how to enable or disable commands.')
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Get a list of all non-admin commands Aigis has and if they are enabled in this server.')
        .addBooleanOption(option =>
          option.setName('datastore')
            .setDescription('Whether to only include commands that store data (true) or not (false). Default is false.')
        )
    )
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable a command')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Name of the command to enable. Use "all" to apply to all commands.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable a command')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Name of the command to disable. Use "all" to apply to all commands.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    //const commandList = getCommandNames();
    const filderdChoices = Object.keys(commandList).filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
    if (filderdChoices.length > 25) {
      filderdChoices.length = 25; //25 is max number of choices allowed
    }
    await interaction.respond(filderdChoices.map(choice => ({ name: choice, value: commandList[choice] })));
  },
  async execute(interaction, guildConfig) {
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.user.displayName;
    const guildId = interaction.guild.id;
    let disabled_commands = guildConfig.disabled_commands;
    //subcommands that do not require a command name
    if (subcommand == 'help') { //help
      let desc = `Here is some guidance on enabling or disabling some of my commands ${username}-san. Manage server permissions are needed to use this command, and by default all my commands are enabled. `;
      desc += `Just so you know ${username}-san, admin commands cannot be disabled. These include this command and the \`setup\` command. `;
      desc += `Also, if a command like \`manga\` or \`sotd\` is disabled, scheduled pings and messages will still occur if any were set up, so please keep that in mind.\n\n `;
      desc += `The \`<command-name>\` parameter is the name of the command you want to enable or disable. This is the name of the command you would type to execute it, like \`remindme\` or \`manga\`. Note that the slash is not included.`;
      desc += `If you wish to enable or disable all non-admin commands, use the command name \`all\`. Below is each subcommand officially documented.`;
      const embed = new EmbedBuilder()
        .setTitle('Command Enable/Disable Help')
        .setColor(config.EMBED_COLOR)
        .setDescription(desc)
        .setThumbnail(config.AIGIS_BUSTUP_IMAGE)
        .addFields(
          { name: '/command help', value: 'This command showing how to enable and disable commands.' },
          { name: '/command list <datastore>', value: 'Get a list of all non-admin commands I have and whether they are enabled (\u2705) or disabled (\u274c) in your server. Set `datastore` to `True` to only list commands that store data.' },
          { name: '/command enable <command-name>', value: 'Enable a command. Use command name "all" to enable all commands.' },
          { name: '/command disable <command-name>', value: 'Disable a command. Use command name "all" to disable all non-admin commands.' }
        )
        .setTimestamp();
      return await interaction.editReply({ embeds: [embed] });
    } else if (subcommand == 'list') { //list commands
      const datastore = interaction.options.getBoolean('datastore') ?? false;
      let desc = `Here is a list of all commands I have ${datastore ? 'that store data ' : ''}${username}-san. Admin commands like this one and \`/setup\` are not included in this list. `;
      desc += `For more detail on each command, see the documentation [here](<https://github.com/mdwelker10/discord-bot-aigis/blob/main/README.md>)\n\n`;
      const list = datastore ? datastoreCommands : Object.keys(commandList);
      for (const cmd of list) {
        if (cmd == 'all') continue;
        if (disabled_commands.includes(cmd)) {
          desc += `- **${cmd}** - \u274c\n`;
        } else {
          desc += `- **${cmd}** - \u2705\n`;
        }
      }
      const embed = new EmbedBuilder()
        .setTitle(datastore ? 'Aigis Command List - Data Storing Commands' : 'Aigis Command List')
        .setColor(config.EMBED_COLOR)
        .setDescription(desc)
        .setThumbnail(config.AIGIS_BUSTUP_IMAGE)
        .setTimestamp();
      return await interaction.editReply({ embeds: [embed] });
    }
    //check for permission to enable/disable commands (anyone with manage server permission)
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return await interaction.reply({ content: `${username}-san, you do not have permission to do that!`, flags: MessageFlags.Ephemeral });
    }
    const commandPath = interaction.options.getString('command');
    const command = commandPath == 'all' ? 'all' : commandPath.split('/')[1];
    if (!command || !commandList[command]) {
      return await interaction.editReply(`${username}-san, you need to specify a valid command to enable or disable.`);
    }
    if (subcommand == 'enable') { //enable a command
      //check for all commands
      if (command == 'all') {
        await db.updateOne(config.DB_NAME, 'config', { guild_id: guildId }, { $set: { disabled_commands: [] } });
        console.log(`All commands have been enabled in guild ${guildId}`);
        return await interaction.editReply(`${username}-san, all commands have been disabled.`);
      }
      //filter out the command to enable from the disabled list
      disabled_commands = disabled_commands.filter(c => c != command);
    } else if (subcommand == 'disable') { //disable a command
      //check for all commands
      if (command == 'all') {
        await db.updateOne(config.DB_NAME, 'config', { guild_id: guildId }, { $set: { disabled_commands: Object.keys(getCommandNames()) } });
        console.log(`All commands have been disabled in guild ${guildId}`);
        return await interaction.editReply(`${username}-san, all commands have been disabled.`);
      }
      //add command to disabled list if it's not there already
      if (!disabled_commands.includes(command)) {
        disabled_commands.push(command);
      }
    } else {
      return await interaction.editReply(`${username}-san, but I am having trouble parsing your command.`);
    }
    await db.updateOne(config.DB_NAME, 'config', { guild_id: guildId }, { $set: { disabled_commands: disabled_commands } });
    console.log(`Command ${command} has been ${subcommand == 'enable' ? 'enabled' : 'disabled'} in guild ${guildId}`);
    return await interaction.editReply(`Alright ${username}-san, the command "${command}" has been ${subcommand == 'enable' ? 'enabled' : 'disabled'}.`);
  }
};

