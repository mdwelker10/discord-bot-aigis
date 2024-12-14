const { REST, Routes } = require('discord.js');
require('dotenv').config();
const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

const rest = new REST().setToken(token);

if (process.env.DEV == 1) {
  rest.put(Routes.applicationGuildCommands(clientId, process.env.TEST_GUILD, { body: [] })).then(() => console.log('deleted')).catch(console.error);
  //rest.put(Routes.applicationGuildCommands(clientId, process.env.TEST_GUILD, "CommandID")).then(() => console.log('deleted')).catch(console.error);
} else {
  rest.put(Routes.applicationCommands(clientId, { body: [] })).then(() => console.log('deleted')).catch(console.error);
  //rest.put(Routes.applicationCommands(clientId, "CommandID")).then(() => console.log('deleted')).catch(console.error);
}
