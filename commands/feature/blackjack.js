const { SlashCommandBuilder, ComponentType, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const AigisError = require('../../utils/AigisError');
const { startGame, startTurn, quit, placeBet, createMenuButtons } = require('../../command_helpers/blackjack');
const { numberToString } = require('../../utils/utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
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
            .setMinValue(10)
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
          let desc = `Here is some help with playing the Blackjack game ${user}-san.\n\n`;
          desc += 'To start a new game, use the `/bj start` command. You have the option of setting a time limit for each turn, with the default being 30 seconds. ';
          desc += 'This time limit is for each action, like a hit, stand, double down, etc., not for the entire round. ';
          desc += 'You can also enable hard mode, which means that the dealer will hit on a soft 17, which is when the dealer has an ace and a 6. ';
          desc += 'Hard mode does not pay more than normal games, it\'s just there if you want a bit more of a challenge. '
          desc += 'Below is a full command reference:\n\n';
          const help = new EmbedBuilder()
            .setColor(config.EMBED_COLOR)
            .setTitle('Blackjack Help')
            .setThumbnail(config.AIGIS_ORGIA_ICON_IMAGE)
            .setDescription(desc)
            .addFields(
              { name: '/blackjack help', value: 'Get help with the Blackjack game' },
              { name: '/blackjack rules', value: 'Get the rules for Blackjack' },
              { name: '/blackjack start <hard-mode> <time-limit>', value: 'Start a new Blackjack game with the specified turn time limit and an optional hard mode. By default the time limit is 30 seconds and hard mode is false.' }
            )
            .setTimestamp();
          return await interaction.editReply({ embeds: [help] });
        case 'rules':
          let rules = `The basic rules of Blackjack are simple ${user}-san, but the game can have complex strategies. `;
          rules += `Blackjack is a card game where you play against the dealer with the goal of getting a hand as close to 21 as possible without going over. `;
          rules += 'For our purposes, the game is played with 8 decks of 52 cards, although the number of decks can vary in reality. ';
          rules += 'The cards are worth their numerical value, with face cards being worth 10 and aces being worth 1 or 11, depending on what you want them to be.\n\n';
          rules += 'The basic actions are `hit` and `stand`, where `hit` means you draw another card and `stand` means to keep your current hand. ';
          rules += 'The dealer will always hit until they reach a hand value of 17 or higher. The dealer will also only show 1 card, and the other is face down until your turn is over.\n\n';
          rules += 'If you go over 21, it is called a `bust` and you lose the round. The dealer always goes last, so you have the chance to bust first. ';
          rules += 'If you get a hand value of 21 with your first two cards, meaning an Ace and 10 value card, you get a `Blackjack` and win the round. That is unless the dealer also has a Blackjack, then it is a `push` (tie). ';
          rules += `Below are 3 other possible actions you can take in the game and the payouts for each outcome. For more about the game's full rules you can look [here](<https://bicyclecards.com/how-to-play/blackjack>). `
          //each action
          let doubledown = 'This action allows you to double your bet in exchange for only being able to draw one more card on your turn. This action is mutually exclusive with `split`. The dealer does not have this option.';
          let split = 'If you have two cards of the same value, you can split them into two separate hands. You then place a bet equal to your original bet on both hands individually. ';
          split += 'You can then play each hand as if they were separate games, but in the same round against a single dealer hand. If you get a Blackjack after splitting, it is not considered a Blackjack, but a normal 21. ';
          split += 'If you split aces, you can only draw one more card on each hand. You can only split once per turn, and the dealer cannot split.';
          let insurance = 'If the dealer\'s face-up card is an ace, you can take insurance. This is a side bet that the dealer has a Blackjack and is equal to half your normal bet. This bet pays 2-to-1, ';
          insurance += 'so if your insurance bet was 50 VT, you would win 100 VT and get your 50 VT back if the dealer has a Blackjack. If the dealer does not have a Blackjack, you lose the insurance bet. ';
          insurance += 'Keep in mind that if your insurance bet wins, your normal bet will still lose unless you also have Blackjack. The dealer does not have the option to take insurance.';
          const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLOR)
            .setTitle('Blackjack Rules')
            .setThumbnail(config.AIGIS_ORGIA_ICON_IMAGE)
            .setDescription(rules)
            .addFields(
              { name: 'Payouts', value: '- Win: 1:1\n- Blackjack: 3:2\n- Insurance: 2:1\n- Split: 1:1' },
              { name: 'Double Down', value: doubledown },
              { name: 'Split', value: split },
              { name: 'Insurance', value: insurance }
            )
            .setTimestamp();
          return await interaction.editReply({ embeds: [embed] });
        case 'start':
          await startGame(guildId, userId, interaction.options.getInteger('time-limit') ?? 30, interaction.options.getBoolean('hard-mode') ?? false);
          await interaction.editReply(`A new Blackjack game has been started <@${userId}>-san!`);
          break;
        default:
          throw new AigisError(`I do not recognize the subcommand ${subcommand}, ${user}-san.`);
      }
      await playGame(interaction, false, { content: `Please select an option <@${userId}>-san.`, components: [createMenuButtons()] });
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
  return new Promise(async (resolve) => {
    //set variables
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    await interaction.followUp(`Please type in chat the amount you would like to bet within the next 60 seconds, <@${userId}>-san. The minimum bet is ${config.MIN_BET} and the maximum bet is ${numberToString(config.MAX_BET)}.`);
    //filter for the collector, only allow integers between MIN_BET and MAX_BET sent by the user
    const collectorFilter = msg => {
      if (msg.author.id === userId && !isNaN(msg.content) && Number.isInteger(parseFloat(msg.content))) {
        const bet = parseInt(msg.content);
        return bet >= config.MIN_BET && bet <= config.MAX_BET
      }
      return false;
    };
    const collector = await interaction.channel.createMessageCollector({ filter: collectorFilter, time: 60_000 });
    //stop collecting when a valid collecged bet is received
    collector.on('collect', async (msg) => {
      const bet = parseInt(msg.content);
      let succ = await placeBet(guildId, userId, bet);
      collector.stop('done');
      return resolve(succ);
    });

    collector.on('end', async (collected, reason) => {
      //if collector ended due to timeout, inform user and keep their original bet
      if (reason === 'time') {
        await interaction.channel.send(`I'm sorry <@${userId}>-san, but you are out of time. I am keeping your original bet.`);
        return resolve(false);
      } else if (reason !== 'done') {
        console.error(`The bet collector ended for an unknown reason - ${reason}. Guild ID: ${guildId}, User ID: ${userId}`);
        throw new AigisError(`the bet collector ended for an unknown reason - ${reason}`);
      }
    });
  });
}


/** 
 * Handle gameplay. 
 * 
 * Set play = false when trying to reprompt the main menu. 
 * obj should then be set to the object passed to interaction.followUp which will prompt the user for an action*/
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
  //grab the response from the follow up which holds the clicked button
  const response = await interaction.followUp(options);
  const result = await new Promise(async (resolve) => {
    //create collector to listen for button clicks
    const collectorFilter = i => i.user.id === userId; //ensure only target user can click on button
    const collector = await response.createMessageComponentCollector({ componentType: ComponentType.Button, filter: collectorFilter, time: 60_000 });
    //listen for button clicks
    collector.on('collect', async (i) => {
      await i.deferUpdate();
      //stop listening for clicks
      collector.stop('done');
    });

    collector.on('end', async (collected, reason) => {
      const i = collected.first();
      //disable buttons when collection over
      for (const button of options.components[0].components) {
        button.setDisabled(true);
      }
      //collector timed out, end game
      if (reason == 'time') {
        await interaction.channel.send({ content: `I'm sorry <@${userId}>-san, but you are out of time. I am ending the game.`, components: options.components });
        return resolve('quit');
      }
      //button was clicked, resolve with action
      if (reason == 'done') {
        const customId = i.customId;
        let content = options.content;
        if (play == false) {
          content = `You have chosen to **${customId}**  <@${userId}>-san.`
        }
        await i.editReply({ content: content, components: options.components });
        return resolve(customId);
      } else {
        console.error(`The button interaction collector ended for an unknown reason - ${reason}. Guild ID: ${guildId}, User ID: ${userId}`);
        throw new AigisError(`The button interaction collector ended for an unknown reason - ${reason}`);
      }
    });
  });
  //handle result of collector / promise
  switch (result) {
    case 'quit':
      await interaction.channel.send(`Thank you for playing <@${userId}>-san.`);
      return quit(userId);
    case 'bet':
      const success = await changeBet(interaction);
      //if no successful bet update, allow user to try again (see this menu again)
      if (!success) {
        setImmediate(playGame, interaction, false, { content: `I could not set your bet, please try again or select a different option <@${userId}>-san.`, components: [createMenuButtons()] });
      } else {
        setImmediate(playGame, interaction, false, { content: `I have changed your bet <@${userId}>-san. Please select an option.`, components: [createMenuButtons()] });
      }
      break;
    case 'deal':
      setImmediate(playGame, interaction); //execute function again without risk of infinite (or very large) recursion
      break;
    default:
      throw new AigisError(`I do not recognize the button click action: ${result}.`);
  }
}
