require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection, ActivityType, PresenceUpdateStatus } = require('discord.js');
const { initSOTD, startSotdCronJob } = require('./command_helpers/sotd');
const { startMangaCronJob, mangaCheck } = require('./command_helpers/manga');
const { CronJob } = require('cron');

//list of commands that require deferred replies (longer than 3 seconds)
long_commands = ['ping', 'sotd', 'manga']

// BOT token
const token = process.env.TOKEN;
//create client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

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
  if (message.content.toLowerCase().includes('aigis')) {
    message.reply(`Did you need me ${message.author.displayName}-san?`);
  }
  else if (message.content.toLowerCase().includes('debug manga') && message.author.id == process.env.OWNER_ID) {
    //this stays in until manga command fully debugged. Manual testing shows its fine but cronjob bugs
    await mangaCheck(client);
    message.reply('I have checked for manga updates');
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  //interaction is a command
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`No command named ${interaction.commandName} found`);
    return;
  }
  try {
    //log command execution
    let subcommand = interaction.options.getSubcommand(false);
    let str = `User ${interaction.user.id} executed command: ${interaction.commandName}`
    str += subcommand ? ` -- with subcommand: ${subcommand}` : '';
    console.log(str);
    //execute commands
    if (long_commands.includes(interaction.commandName)) {
      await interaction.deferReply(); //defer reply for long commands (longer than 3 seconds)
    }
    await command.execute(interaction); //execute the command

  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error executing this command. Blame the dumb developer that created me.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error executing this command. Blame the dumb developer that created me.', ephemeral: true });
    }
  }
});

//login with client token
client.login(token).then(token => {
  if (process.env.DEV == 1) { //dev status
    client.user.setPresence({
      activities: [{
        name: 'Trashpanda-san incorrectly program me',
        type: ActivityType.Watching
      }],
      status: PresenceUpdateStatus.Online
    });
  } else { //prod status
    client.user.setPresence({
      activities: [{
        name: 'Makoto-san',
        type: ActivityType.Watching
      }],
      status: PresenceUpdateStatus.Online
    });
  }
});

initSOTD().then(() => {
  console.info('Song of the Day initialized and ready.')
});

if (process.env.DEV != 1) {
  startSotdCronJob(client);
  console.info('Cron job for Song of the Day started.');
  startMangaCronJob(client);
  console.info('Cron job for Manga updates started.');
}

// job = new CronJob(
//   '* * * * * *',
//   () => {
//     const botdev = client.channels.cache.get('1261541686723739758');
//     botdev.send(`<@754934858081632376>-san please get ready for the watchparty!`);
//   },
//   null,
//   true,
//   'America/New_York'
// );