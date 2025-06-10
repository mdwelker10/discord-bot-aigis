/*
This is meant to be a script to deploy the commands run once. Will deploy commands to the guild specified in the .env file.
Only need to rerun when a command definition (name/description) changes, NOT when the execute function changes
*/
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, '..', 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  //only deploy dev commands in dev environment
  if (folder == 'dev' && process.env.DEV != 1) {
    continue;
  }
  // Grab all the command files from the commands directory
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    if (process.env.DEV == 10) { //server config for development
      console.log('DEVELOPMENT MODE: Deploying to server scope.');
      const ret = await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.TEST_GUILD),
        { body: commands },
      );
      console.log(`Successfully reloaded ${ret.length} application (/) commands to test server.`);
    } else { //global config
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    }
  } catch (error) {
    console.error(error);
  }
})();
