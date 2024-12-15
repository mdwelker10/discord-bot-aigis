const { REST, Routes } = require('discord.js');
require('dotenv').config();
const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;
const guildId = process.env.DEV == 1 ? process.env.TEST_GUILD : '803893455934849074'; //Luna's Lounge

const rest = new REST().setToken(token);

(async () => {
  try {
    if (process.env.DEV == 1) {
      console.log('DEVELOPMENT MODE: Fetching commands from server scope.');
      const commands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
      console.log('Registered Commands:', commands);
      return;
    } else {
      const commands = await rest.get(Routes.applicationCommands(clientId));
      console.log('Registered Commands:', commands);
    }
  } catch (error) {
    console.error(error);
  }
})();
