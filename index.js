require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection, ActivityType, PresenceUpdateStatus } = require('discord.js');
const { startSotd, startMangaChecks, startPurgeChecks, startDailyTokenChecks } = require('./command_helpers/cronjobs');
const { mangaCheck } = require('./command_helpers/manga/manga');
const { initQueue } = require('./command_helpers/reminder');
const { getGuildConfig, isDeveloper } = require('./utils/utils');
//const { purgeAll } = require('./command_helpers/purge');
const { startServer } = require('./server/server');

//list of commands that require deferred replies (longer than 3 seconds)
long_commands = ['ping', 'sotd', 'manga', 'command', 'purge', 'blackjack', 'vt', 'claim', 'download'];
//list of commands that need the server configuration to work. All of these should also be in the long_commands list
setup_required = ['command'];

// BOT token
const token = process.env.TOKEN;

//create client
const client = new Client({
  allowedMentions: { parse: ['users', 'roles'] },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers]
});
//attach .commands property to client to allow access to commands in other files
client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // New item in commands collection with key as command name and value as command module
    if ('data' in command && 'execute' in command)
      client.commands.set(command.data.name, command);
    else
      console.warn(`Invalid following command file is missing the "data" or "execute" property: ${filePath}`);
  }
}

//run following code only once when client is ready
client.once(Events.ClientReady, readyClient => {
  console.info(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase().includes('debug manga') && isDeveloper(message.author.id) && process.env.DEV == 1) { //For manually testing manga cronjob
    console.log('Debugging manga...');
    await mangaCheck(client);
    return message.reply('I have checked for manga updates');
  }
  if (message.content.toLowerCase().includes('gn aigis') || message.content.toLowerCase().includes('good night aigis') || message.content.toLowerCase().includes('goodnight aigis')) {
    return message.reply(goodnight(message.author.displayName));
  }
  // if (message.content.toLowerCase().includes('debug purge') && isDeveloper(message.author.id)) {
  //   console.log('Debugging purge...');
  //   await purgeAll(message.guild.id);
  //   return message.reply('I have purged all data for this server');
  // }
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) { //interaction is a command
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command named ${interaction.commandName} found`);
      return;
    }
    try {
      //get guild config to check if command is disabled
      const server = await getGuildConfig(interaction.guildId);
      if (server && server.disabled_commands && server.disabled_commands.includes(interaction.commandName)) {
        return await interaction.reply({ content: `I'm sorry ${interaction.user.displayName}-san, but the command ${interaction.commandName} has been disabled for this server.`, ephemeral: true });
      }
      //log command execution
      let subcommand = interaction.options.getSubcommand(false);
      let str = `User ${interaction.user.id} executed command: ${interaction.commandName}`
      str += subcommand ? ` -- with subcommand: ${subcommand}` : '';
      console.log(str);
      //defer reply if command could take longer than 3 seconds
      if (long_commands.includes(interaction.commandName))
        await interaction.deferReply();
      //if command requires server configuration
      if (setup_required.includes(interaction.commandName)) {
        if (!server)
          return await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command`);
        return await command.execute(interaction, server); //execute the command passing in server config
      }
      //execute commands
      await command.execute(interaction); //execute the command

    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "There was an error executing this command. This is no fault of my own, please blame a developer.", ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error executing this command. This is no fault of my own, please blame a developer.', ephemeral: true });
      }
    }
  } else if (interaction.isAutocomplete()) { //interaction is an autocomplete query
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command named ${interaction.commandName} found`);
      return;
    }
    if (!command.autocomplete) {
      console.error(`No autocomplete function found for command ${interaction.commandName}`);
      return;
    }
    try {
      //log command execution
      // let str = `User ${interaction.user.id} executed autocomplete query: ${interaction.commandName}`;
      // console.log(str);
      await command.autocomplete(interaction); //execute the command
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "There was an error executing this command. This is no fault of my own, please blame a developer.", ephemeral: true });
      } else {
        await interaction.reply({ content: "There was an error executing this command. This is no fault of my own, please blame a developer.", ephemeral: true });
      }
    }
  }
});

//login with client token
client.login(token).then(token => {
  if (process.env.DEV == 1) {
    console.info('Bot is running in development mode.');
    client.user.setPresence({
      activities: [{
        name: 'The error messages rolling in',
        type: ActivityType.Watching
      }],
      status: PresenceUpdateStatus.Online
    });
  } else {
    client.user.setPresence({
      activities: [{
        name: 'Persona 3 Reload',
        type: ActivityType.Playing
      }],
      status: PresenceUpdateStatus.Online
    });
  }
});

//initialize reminder queue
initQueue(client).then(() => {
  console.info('Reminder queue initialized and ready.');
});

//initialize cron jobs
if (process.env.DEV != 1) {
  startSotd(client);
  console.info('Cron job for Song of the Day started.');
  startMangaChecks(client);
  console.info('Cron job for Manga updates started.');
  startPurgeChecks(client);
  console.info('Cron job for purging data started.');
  startDailyTokenChecks(client);
  console.info('Cron job for daily token checks started.');
}

//start server
(async function () {
  await startServer();
})();


function goodnight(username) {
  const arr = [
    `Good night ${username}-san. May your rest be peaceful and refreshing.`,
    `Good night ${username}-san. May your sleep be as restful as a properly implemented POST request.`,
    `Good night ${username}-san. Please ensure you achieve optimal rest levels to maximize your efficiency tomorrow.`,
    `Rest assured ${username}-san. I will remain on standby mode to monitor for shadow activity so you may rest peacefully.`,
    `I hope your rest is peaceful ${username}-san. Please ensure you get the recommended 8 hours of sleep for peak human performance.`,
    `Good night ${username}-san. I will remain on standby mode while you "catch some Z's" as they say.`,
    `I am glad you are initiating your resting protocol ${username}-san. I wish you great success in your sleeping endeavors.`,
    `Good night ${username}-san. I will continue to monitor for shadow activity while you rest and sleep soundly.`,
    `Good night ${username}-san. I hope you have some "sweet dreams", as they say.`,
    `Good night ${username}-san. I hope you have a pleasant night's sleep. I will remain operational should any needs arise during your rest cycle.`,
    `Good night ${username}-san, and as they say "don't let the bed bugs bite". I hope you do not have any bugs inside your bed, as that would make relaxation quite difficult.`,
    `Good night and sweet dreams ${username}-san, may your night be as relaxing as resting in the arms of Makoto-san.`,
    `Good night ${username}-san. I wish you optimal rest and recovery during your sleep cycle. I will maintain my standard patrol and readiness protocols while you recharge.`,
    `${username}-san. I have been told "gn" is an efficient way to wish someone a good night's sleep. With this in mind, gn ${username}-san.`
  ]
  return arr[Math.floor(Math.random() * arr.length)];
}