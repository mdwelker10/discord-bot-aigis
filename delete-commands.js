const { REST, Routes } = require('discord.js');
require('dotenv').config();
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

const rest = new REST().setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId, { body: [] })).then(() => console.log('deleted')).catch(console.error);
//rest.put(Routes.applicationGuildCommands(clientId, guildId, "Command ID")).then(() => console.log('deleted')).catch(console.error);

//rest.put(Routes.applicationCommands(clientId, { body: [] })).then(() => console.log('deleted')).catch(console.error);
//rest.put(Routes.applicationCommands(clientId, "Command ID")).then(() => console.log('deleted')).catch(console.error);
