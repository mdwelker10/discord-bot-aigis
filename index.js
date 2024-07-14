require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection, ActivityType, PresenceUpdateStatus } = require('discord.js');
const { initSOTD, startCronJob } = require('./command_helpers/sotd');
const { CronJob } = require('cron');

//list of commands that require deferred replies (longer than 3 seconds)
long_commands = ['ping', 'sotd']

// BOT token
const token = process.env.TOKEN;
//create client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
      console.log(`Invalid following command file is missing the "data" or "execute" property: ${filePath}`);
  }
}

//run following code only once when client is ready
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
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
    if (long_commands.includes(interaction.commandName))
      await interaction.deferReply(); //defer reply for long commands (longer than 3 seconds)
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
  client.user.setPresence({
    activities: [{
      name: 'The 1s and 0s of AWS',
      type: ActivityType.Watching
    }],
    status: PresenceUpdateStatus.Online
  });
});

initSOTD().then(() => {
  console.log('Song of the Day initialized and ready.')
});

if (process.env.DEV != 1) {
  startCronJob(client);
  console.log('Cron job for Song of the Day started.');
}

// job = new CronJob(
//   '0 * * * * *',
//   () => {
//     const general = client.channels.cache.get('803893455934849077');
//     general.send('Trashpanda-san, when will I be fixed?');
//   },
//   null,
//   true,
//   'America/New_York'
// );
