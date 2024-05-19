require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');

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
client.login(token);