//MOVE THIS FILE TO commands/utility WHEN THE COMMAND IS READY TO BE WORKED ON

// const { SlashCommandBuilder } = require("discord.js");
// const AigisError = require('../../utils/AigisError');
// const { getRank } = require('../../command_helpers/rank_helpers/tracker-network');

// //NOTE: PC is for non-steam. Use "steam" for steam games. EX: Epic Games, Riot client, Battle.net, etc. would be "pc"
// const GAME_PLATFORM_TABLE = {
//   'rocket_league': ['steam', 'xbox', 'ps', 'switch', 'pc'],
//   'valorant': ['pc', 'xbox', 'ps'],
//   'csgo': ['steam'],
//   'apex_legends': ['pc', 'steam', 'ps', 'xbox', 'switch'],
//   'overwatch': ['pc', 'steam', 'ps', 'xbox', 'switch'],
//   'league_of_legends': ['pc'],
//   'fortnite': ['pc', 'xbox', 'ps', 'switch'],
//   'splitgate': ['steam', 'xbox', 'ps'],
// }

// const PLATFORM_NAMES = {
//   'steam': 'Steam',
//   'xbox': 'Xbox',
//   'ps': 'Playstation',
//   'switch': 'Switch',
//   'pc': 'PC',
// }

// const GAME_NAMES = {
//   'rocket_league': 'Rocket League',
//   'valorant': 'Valorant',
//   'csgo': 'CS:GO',
//   'apex_legends': 'Apex Legends',
//   'overwatch': 'Overwatch',
//   'league_of_legends': 'League of Legends',
//   'fortnite': 'Fortnite',
//   'splitgate': 'Splitgate',
// }

// module.exports = {
//   data: new SlashCommandBuilder()
//     .setName('rank')
//     .setDescription("Get a user's rank in an online game.")
//     .addStringOption(option =>
//       option.setName('game')
//         .setDescription('The game to get the rank for.')
//         .setRequired(true)
//         .addChoices(
//           { name: 'Rocket League', value: 'rocket_league' },
//           { name: 'Valorant', value: 'valorant' },
//           { name: 'CSGO', value: 'csgo' },
//           { name: 'Apex Legends', value: 'apex_legends' },
//           { name: 'Overwatch', value: 'overwatch' },
//           { name: 'League of Legends', value: 'league_of_legends' },
//           { name: 'Fortnite', value: 'fortnite' },
//           { name: 'Splitgate', value: 'splitgate' },
//         ))
//     .addStringOption(option =>
//       option.setName('platform')
//         .setDescription('The platform of the user to get the rank for.')
//         .setRequired(true)
//         .addChoices(
//           { name: 'Steam', value: 'steam' },
//           { name: 'Xbox', value: 'xbox' },
//           { name: 'Playstation', value: 'ps' },
//           { name: 'Switch', value: 'switch' },
//           { name: 'pc', value: 'pc' },
//         ))
//     .addStringOption(option =>
//       option.setName('username')
//         .setDescription('The username of the user to get the rank for.')
//         .setRequired(true)),
//   async execute(interaction) {
//     try {
//       const game = interaction.options.getString('game');
//       const game_display = GAME_NAMES[game];
//       const platform = interaction.options.getString('platform');
//       const platform_display = PLATFORM_NAMES[platform];
//       //check if platform is valid for game
//       if (GAME_PLATFORM_TABLE[game].indexOf(platform) === -1) {
//         //build string for available platforms
//         let str = '';
//         for (let i = 0; i < GAME_PLATFORM_TABLE[game].length; i++) {
//           str += PLATFORM_NAMES[GAME_PLATFORM_TABLE[game][i]];
//           if (i === GAME_PLATFORM_TABLE[game].length - 2)
//             str += ' and ';
//           else if (i !== GAME_PLATFORM_TABLE[game].length - 1) {
//             str += ', ';
//           }
//         }
//         throw new AigisError(`${platform_display} is not a valid platform for ${game_display}. That game is on ${str}`);
//       }
//       const username = interaction.options.getString('username');
//       let data;
//       switch (game) {
//         case 'rocket_league':
//           await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I am not programmed to get ranks for ${game_display} at this time.`);
//           // data = await getRank(game_display, platform_display, username);
//           // await interaction.editReply(JSON.stringify(data));
//           break;
//         case 'valorant':
//           await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I am not programmed to get ranks for ${game_display} at this time.`);
//           break;
//         case 'csgo':
//           data = await getRank(game_display, platform_display, username);
//           await interaction.editReply(JSON.stringify(data));
//           break;
//         case 'apex_legends':
//           data = await getRank(game_display, platform_display, username);
//           await interaction.editReply(JSON.stringify(data));
//           break;
//         case 'overwatch':
//           await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I am not programmed to get ranks for ${game_display} at this time.`);
//           break;
//         case 'league_of_legends':
//           await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I am not programmed to get ranks for ${game_display} at this time.`);
//           break;
//         case 'fortnite':
//           await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, I am not programmed to get ranks for ${game_display} at this time.`);
//           break;
//         case 'splitgate':
//           data = await getRank(game_display, platform_display, username);
//           await interaction.editReply(JSON.stringify(data));
//           break;
//         default:
//           throw new AigisError(`I am unsure how to get ranks for ${game_display}. ${interaction.user.displayName}-san, please use the command with a valid game.`);
//       }
//     } catch (err) {
//       if (err instanceof AigisError) {
//         await interaction.editReply(`I'm sorry ${interaction.user.displayName}-san, but I cannot get your rank because ${err.message}`);
//       } else {
//         console.error(err);
//         await interaction.editReply(`${interaction.user.displayName}-san... I do not know what happened. My programming indicated there was an issue but it is unknown to me. The issue is ${err.message}`)
//       }
//     }
//   }
// }