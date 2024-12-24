const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../../config');
const AigisError = require('../../utils/AigisError');
const { startGame, startTurn, quit, placeBet, createMenuButtons } = require('../../command_helpers/blackjack');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bj') //TODO change to "blackjack" for final release
    .setDescription('Start a new Blackjack table with the specified turn time limit')
    .addSubcommand(cmd =>
      cmd.setName('help')
        .setDescription('Get help with the Blackjack game')
    )
    .addSubcommand(cmd =>
      cmd.setName('rules')
        .setDescription('Get the rules for Blackjack')
    )
    .addSubcommand(cmd =>
      cmd.setName('start')
        .setDescription('Start a new Blackjack game with the specified turn time limit')
        .addBooleanOption(option =>
          option.setName('hard-mode')
            .setDescription('Whether to enable hard mode for the game. Default is false.')
        )
        .addIntegerOption(option =>
          option.setName('time-limit')
            .setDescription('The amount of time in seconds for each action. Default 30 seconds.')
            .setMinValue(15)
            .setMaxValue(60)
        )
    ),
  async execute(interaction) {
    const user = interaction.user.displayName;
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    try {
      switch (subcommand) {
        case 'help':
        case 'rules':
        case 'start':
          await startGame(guildId, userId, interaction.options.getInteger('time-limit') ?? 30, interaction.options.getBoolean('hard-mode') ?? false);
          await interaction.editReply(`A new Blackjack game has been started ${user}-san! Use the \`/bet <amount>\` command to change your bet amount. The game will now begin.`);
          break;
        default:
          throw new AigisError(`I do not recognize the subcommand ${subcommand}, ${user}-san.`);
      }
      await playGame(interaction, false, { content: `Please select an option ${user}-san.`, components: [createMenuButtons()] });
    } catch (err) {
      if (err instanceof AigisError) {
        await interaction.editReply(`${user}-san! I'm sorry but I have encountered an issue while executing your command. The problem is ${err.message}`);
      } else {
        console.error(err);
        await interaction.editReply(`${user}-san... I do not know what happened. My programming indicated there was an issue but it is unknown to me. The issue is ${err.message}`)
      }
    }
  }
};

/** Allow changing your bet */
async function changeBet(interaction) {
  //set variables
  const userId = interaction.user.id;
  const user = interaction.user.displayName;
  const guildId = interaction.guild.id;
  //filter for the collector, only allow integers between MIN_BET and MAX_BET sent by the user
  const collectorFilter = msg => {
    if (msg.author.id === userId && !isNaN(msg.content) && Number.isInteger(parseFloat(msg.content))) {
      const bet = parseInt(msg.content);
      return bet >= config.MIN_BET && bet <= config.MAX_BET
    }
    return false;
  };
  await interaction.followUp(`Please type in chat the amount you would like to bet within the next 60 seconds, ${user}-san. The minimum bet is ${config.MIN_BET} and the maximum bet is ${config.MAX_BET}.`);
  try {
    const collector = await interaction.channel.awaitMessages({ filter: collectorFilter, max: 1, time: 60000 });
    const bet = parseInt(collector.first().content);
    return await placeBet(guildId, userId, bet);
  } catch (err) {
    //timeout
    await interaction.channel.send(`I'm sorry <@${userId}>-san, but you are out of time. I am keeping your original bet.`);
    return false;
  }
}


/** Handle gameplay. Set play = false when trying to reprompt the main menu. obj will then be set to the object passed to interaction.followUp */
async function playGame(interaction, play = true, obj = null) {
  //set variables
  const userId = interaction.user.id;
  const user = interaction.user.displayName;
  const guildId = interaction.guild.id;
  //start the turn and get the response from the end of the round - unless we are reprompting the menu
  let options = !play && obj ? obj : await startTurn(guildId, user, userId, interaction);
  //timed out too many times
  if (options === 'quit') {
    return quit(userId);
  }
  response = await interaction.followUp(options);
  const collectorFilter = i => i.user.id === userId;
  try {
    //wait for button selection
    const collected = await interaction.channel.awaitMessageComponent({ filter: collectorFilter, time: 60000 }); //1 min to respond
    if (collected.customId === 'quit') {
      await collected.update({ content: `You have quit the game ${user}-san.`, components: [] });
      return quit(userId);
    } else if (collected.customId === 'bet') {
      await collected.update({ content: `You have selected to change your bet ${user}-san.`, components: [] });
      const success = await changeBet(interaction);
      //if no successful bet update, allow user to try again (see this menu again)
      if (!success) {
        setImmediate(playGame, interaction, false, { content: `I could not set your bet, please try again or select a different option ${user}-san.`, components: [createMenuButtons()] });
      } else {
        setImmediate(playGame, interaction, false, { content: `I have changed your bet ${user}-san. Please select an option.`, components: [createMenuButtons()] });
      }
    } else if (collected.customId === 'deal') {
      await collected.update({ content: `Dealing the next hand <@${userId}>-san`, components: [] });
    }
    setImmediate(playGame, interaction); //execute function again without risk of infinite (or very large) recursion
  } catch (err) {
    console.error(err);
    //timeout
    await interaction.channel.send(`I'm sorry <@${userId}>-san, but you are out of time. I am ending the game.`);
    return quit(userId);
  }
}
