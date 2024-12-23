const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../../config');
const AigisError = require('../../utils/AigisError');
const { createCanvas, loadImage } = require('canvas');
const { numberToString } = require('../../utils/utils');
const path = require('path');
const { startGame, joinGame } = require('../../command_helpers/blackjack');

const CARD_PATH = path.join(__dirname, '..', '..', 'images', 'cards');

//testing variables
const JACK = path.join(CARD_PATH, 'wand-jack.png');
const QUEEN = path.join(CARD_PATH, 'sword-queen.png');
const KING = path.join(CARD_PATH, 'coin-king.png');
const ACE = path.join(CARD_PATH, 'cup-ace.png');
const JOKER = path.join(CARD_PATH, 'joker.png');
const DEALER_TEST = [JACK, QUEEN, KING, ACE, QUEEN];
const PLAYER_TEST = [
  JOKER,
  path.join(CARD_PATH, 'cup-8.png'),
  path.join(CARD_PATH, 'sword-2.png'),
  path.join(CARD_PATH, 'wand-5.png')
];

const CARD_WIDTH = 284;
const CARD_HEIGHT = 400;
const CANVAS_WIDTH = 1920;
const CANVAS_WIDTH_WIDE = 2937;
const CANVAS_HEIGHT = 1200;
const CARDS_WIDE = 5; //number of cards required to switch to wide table (must be over this value)

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
        .setDescription('Start a new Blackjack table with the specified turn time limit')
        .addIntegerOption(option =>
          option.setName('time-limit')
            .setDescription('The amount of time in seconds for each action. Default 30 seconds.')
            .setMinValue(15)
            .setMaxValue(45)
        )
    )
    .addSubcommand(cmd =>
      cmd.setName('join')
        .setDescription('Join a Blackjack table')
    )
    .addSubcommand(cmd =>
      cmd.setName('leave')
        .setDescription('Leave the Blackjack table')
    )
    .addSubcommand(cmd =>
      cmd.setName('bet')
        .setDescription('Change your bet amount')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('The amount of money you want to bet')
            .setRequired(true)
            .setMinValue(config.MIN_BET)
            .setMaxValue(config.MAX_BET)
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
          await startGame(guildId, userId, interaction.options.getInteger('time-limit') ?? 30);
          await interaction.editReply(`A new Blackjack game has been started ${user}-san! Use the \`/bet <amount>\` command to change your bet amount.`);
        case 'join':
          await joinGame(guildId, userId);
          await interaction.editReply(`You have joined the Blackjack game ${user}-san! Use the \`/bet <amount>\` command to change your bet amount. You will be dealt in on the next turn.`);
        case 'leave':
        case 'bet':
      }
      //TODO - get card paths before this, and load dealer and player card arrays with file paths
      const buffer = await drawTable(user, config.MAX_BET, Number.MAX_SAFE_INTEGER, DEALER_TEST, PLAYER_TEST);
      const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });
      return await interaction.editReply({ files: [attachment] });
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

/** Draw the blackjack table */
async function drawTable(username, bet, balance, dealerCards, playerCards = []) {
  const wide = dealerCards.length > CARDS_WIDE || playerCards.length > CARDS_WIDE;
  const canvas = createCanvas(wide ? CANVAS_WIDTH_WIDE : CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');
  //draw table
  if (wide) {
    //wide
    const table = await loadImage(path.join(CARD_PATH, 'table-wide.jpg'));
    ctx.drawImage(table, 0, 0, CANVAS_WIDTH_WIDE, CANVAS_HEIGHT);
  } else {
    const table = await loadImage(path.join(CARD_PATH, 'table.jpg'));
    ctx.drawImage(table, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  //player name and bet
  ctx.font = '40px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Player - ${username}`, 20, 40);
  ctx.fillText(`Balance - ${numberToString(balance)} VT`, 20, 100);
  ctx.fillText(`Bet - ${numberToString(bet)} VT`, 20, 160);

  //draw cards 
  await drawCards(ctx, dealerCards, 200, wide);
  await drawCards(ctx, playerCards, 780, wide);
  //finalize image and return buffer to be used with attachment
  return canvas.toBuffer('image/jpeg');
}

/**
 * Draw the cards on the given 2d canvas
 * @param {*} ctx the canvas
 * @param {*} cards the array of cards to draw
 * @param {*} y the starting y position of the cards. X is dynamically calculated
 */
async function drawCards(ctx, cards, y, wide) {
  const canvasWidth = wide ? CANVAS_WIDTH_WIDE : CANVAS_WIDTH;
  //calculate x pos of first card
  let cardLengths = Math.floor(cards.length / 2);
  let x = (canvasWidth / 2) - (cardLengths * CARD_WIDTH) - (cardLengths * 20);
  //account for odd number of cards
  if (cards.length % 2 == 1) {
    x -= CARD_WIDTH / 2;
  }
  //draw all cards
  for (let i = 0; i < cards.length; i++) {
    const image = await loadImage(cards[i]);
    ctx.drawImage(image, x, y, CARD_WIDTH, CARD_HEIGHT);
    x += CARD_WIDTH + 20;
  }
}