/**
 * @file blackjack.js
 * @description This file manages the Blackjack game for each user
 */
const AigisError = require("../utils/AigisError");
const config = require("../config");
const { AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const db = require("../database/db")
const BigNumber = require('bignumber.js');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { numberToString } = require("../utils/utils");

let games = new Map(); //map of game objects, key is player's user id

const RESHUFFLE_AT = 32;
const CARD_PATH = path.join(__dirname, '..', 'images', 'cards');
const CARD_WIDTH = 284;
const CARD_HEIGHT = 400;
const CANVAS_WIDTH = 1920;
const CANVAS_WIDTH_WIDE = 2937;
const CANVAS_HEIGHT = 1200;
const CARDS_WIDE = 5; //number of cards required to switch to wide table (must be over this value)

const values = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'j': 10, 'q': 10, 'k': 10, 'a': "11/1"
}

function getDeck() {
  //generated deck of cards, to speed up each array initialization
  //use genDeck() code in separate node file to generate 1 array
  let deck = ['cups-2', 'cups-3', 'cups-4', 'cups-5', 'cups-6',
    'cups-7', 'cups-8', 'cups-9', 'cups-10', 'cups-j',
    'cups-q', 'cups-k', 'cups-a', 'coins-2', 'coins-3',
    'coins-4', 'coins-5', 'coins-6', 'coins-7', 'coins-8',
    'coins-9', 'coins-10', 'coins-j', 'coins-q', 'coins-k',
    'coins-a', 'swords-2', 'swords-3', 'swords-4', 'swords-5',
    'swords-6', 'swords-7', 'swords-8', 'swords-9', 'swords-10',
    'swords-j', 'swords-q', 'swords-k', 'swords-a', 'wands-2',
    'wands-3', 'wands-4', 'wands-5', 'wands-6', 'wands-7',
    'wands-8', 'wands-9', 'wands-10', 'wands-j', 'wands-q',
    'wands-k', 'wands-a'];
  return deck.concat(deck, deck, deck, deck, deck, deck, deck); //8 decks
}

function shuffle(array) {
  let currentIndex = array.length;
  while (currentIndex != 0) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    let temp = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temp;
  }
  return array;
}

function calculateHandValue(cards) {
  let value = 0;
  let aces = 0;
  for (let card of cards) {
    let val = values[card.split('-')[1]];
    if (val === '11/1') {
      aces++;
    } else {
      value += val;
    }
  }
  //calculate aces - first ace is 11 if possible, rest are 1
  for (let i = 1; i < aces; i++) {
    value += 1;
  }
  if (aces > 0) {
    if (value + 11 == 21) {
      value = 21;
    } else if (value + 11 < 21) {
      value = `${value + 1} / ${value + 11}`;
    } else {
      value += 1;
    }
  }
  return `${value}`;
}

/** Start a new game in the server */
exports.startGame = async (guildId, userId, timeLimit = 30, hardmode = false) => {
  //check if game already exists
  if (games.get(userId)) {
    throw new AigisError('you already have a Blackjack game in progress.', 400);
  }
  //check if player has enough tokens
  let playerVT = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
  if (!playerVT || playerVT.vt < config.MIN_BET) {
    throw new AigisError('you do not have enough Velvet Tokens to play Blackjack. Use `/claim` to get your daily tokens or wait until tomorrow. Please be more careful with your money!', 400);
  }
  let game = {
    cards: shuffle(getDeck()),
    timeLimit: timeLimit,
    pointer: 0, //to track which card to deal next
    dealerCards: [], //dealers first card (index 0) is face down
    playerCards: [],
    splitCards: [],
    bet: playerVT.bet,
    insurance: false,
    doubledown: false,
    guildId: guildId,
    hard: hardmode,
    timeouts: 0
  };
  games.set(userId, game);
}

exports.quit = async (userId) => {
  return games.delete(userId);
}

exports.placeBet = async (guildId, userId, amount) => {
  let game = games.get(userId);
  if (!game || !game.guildId == guildId) {
    //can set bet even if no game in progress
    const ret = await db.updateOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId }, { $set: { bet: amount } });
    if (ret == 0) {
      return false;
    }
    return true;
  }
  if (amount < config.MIN_BET || amount > config.MAX_BET) {
    throw new AigisError(`you must bet between ${config.MIN_BET} and ${config.MAX_BET} tokens.`, 400);
  }
  let playerVT = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
  if (!playerVT || playerVT.vt < amount) {
    throw new AigisError('you do not have enough Velvet Tokens to make that bet.', 400);
  }
  const ret = await db.updateOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId }, { $set: { bet: amount } });
  if (ret == 0) {
    return false;
  }
  game.bet = amount;
  return true;
}

/** Start a turn of blackjack. This means dealing the cards and moving to the player's turn */
exports.startTurn = async (guildId, userDisplayName, userId, interaction) => {
  //deal 2 cards to player and dealer
  let game = games.get(userId);
  if (!game || !game.guildId == guildId) {
    throw new AigisError('you do not have a blackjack game in progress.', 400);
  }
  //deal 2 cards to player
  game.playerCards.push(game.cards[game.pointer++]);
  game.playerCards.push(game.cards[game.pointer++]);

  //deal 2 cards to dealer
  game.dealerCards.push(game.cards[game.pointer++]);
  game.dealerCards.push(game.cards[game.pointer++]);
  //reshuffle if necessary
  if (game.pointer >= game.cards.length - RESHUFFLE_AT) {
    channel.send('Please wait while I reshuffle the deck.');
    game.pointer = 0;
    game.cards = shuffle(game.cards);
  }

  //calculate hand value
  const handValue = calculateHandValue(game.playerCards);

  //need to have separate draw tables so they are updated with new VT total
  const dealerVal = calculateHandValue(game.dealerCards);
  if (dealerVal === '21' && handValue === '21') {
    //blackjack push
    return await sendOutcome(interaction, 'push');
  }
  else if (dealerVal === '21') {
    //only dealer has blackjack
    return await sendOutcome(interaction, 'loss');
  }
  else if (handValue === '21') {
    return await sendOutcome(interaction, 'bj');
  }
  //create the response buttons and attachment wait for player action
  const split = game.playerCards[0].split('-')[1] === game.playerCards[1].split('-')[1];
  const buttonRow = await createButtons(userId, guildId, game, true, split);
  let buffer = await drawTable(game, guildId, userId, userDisplayName);
  const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });
  response = await interaction.followUp({
    content: `Please select an action ${userDisplayName}-san. Your hand value is: **${handValue}**`,
    files: [attachment],
    components: [buttonRow]
  });
  const collectorFilter = i => i.user.id === userId;
  try {
    const collected = await interaction.channel.awaitMessageComponent({ filter: collectorFilter, time: game.timeLimit * 1000 });
    game.timeouts = 0;
    await collected.update({ content: `You have selected to ${collected.customId == 'double' ? 'double down' : collected.customId}.`, components: [] });
    return await handleAction(collected.customId, interaction);
  } catch (err) {
    if (game.timeouts >= 3) {
      await interaction.channel.send(`I'm sorry <@${userId}>-san, but you have timed out too many times. The game will end.`);
      return 'quit';
    }
    //timeout
    await interaction.channel.send(`I'm sorry <@${userId}>-san, but you are out of time. You will stand by default.`);
    game.timeouts += 1;
    return await handleAction('stand', interaction);
  }
}

/** 
 * Calculate and process the payout. result is either "bj", "push", "win", or "loss" 
 * returns the payout
 * */
async function payout(userId, game, result) {
  const bet = game.doubledown ? game.bet * 2 : game.bet;
  game.doubledown = false;
  let vtChange = 0;
  switch (result) {
    case 'bj':
      vtChange = bet * 2.5;
      break;
    case 'push':
      return vtChange;
    case 'win':
      vtChange = bet * 2;
    case 'loss':
      vtChange = -1 * bet;
    default:
      throw new AigisError('an invalid hand result was processed. Result: ' + result);
  }
  let playerVT = await db.findOne(config.DB_NAME, "vt", { user_id: userId, guild_id: game.guildId });
  let newVT = new BigNumber(playerVT.vt).plus(vtChange).toString();
  let newGambleHistory = new BigNumber(playerVT.gamble_history).plus(vtChange).toString();
  await db.updateOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: game.guildId }, { $set: { vt: newVT, gamble_history: newGambleHistory } });
  return Math.abs(vtChange);
}

/** Possible actions are hit, stand, double, split, insure */
async function handleAction(action, interaction) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.ud;
  let game = games.get(userId);
  if (!game || !game.guildId == guildId) {
    throw new AigisError('you do not have a blackjack game in progress.', 400);
  }
  switch (action) {
    case 'hit':
      //add card, redraw table, send back to player with buttons for another turn choice
      game.playerCards.push(game.cards[game.pointer++]);
      let newVal = calculateHandValue(game.playerCards);
      const newValBlackJack = newVal.includes('/') ? parseInt(newVal.split('/')[1].trim()) == 21 : parseInt(newVal) == 21;
      if (!newVal.includes('/') && parseInt(newVal) > 21) {
        console.log(newVal.includes('/'), parseInt(newVal) > 21);
        //busted - stand to make it dealer's turn
        return await handleAction('stand', interaction);
      } else if (newValBlackJack) {
        //"blackjack" - stand to make it dealer's turn but show the table
        let buffer = await drawTable(game, guildId, userId, interaction.user.displayName);
        const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });
        await interaction.channel.send({ content: `It seems you have reached 21 <@${userId}>-san. Now it is my turn.`, files: [attachment] });
        return await handleAction('stand', interaction);
      }
      //send options for next turn 
      const buttonRow = await createButtons(userId, guildId, game, false, false);
      let buffer = await drawTable(game, guildId, userId, interaction.user.displayName);
      const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });
      //send response and wait for interaction
      response = await interaction.followUp({
        content: `Please select an action ${interaction.user.displayName}-san. Your hand value is **${newVal}**`,
        files: [attachment],
        components: [buttonRow]
      });
      const collectorFilter = i => i.user.id === userId;
      try {
        console.log(game.timeLimit * 1000)
        const collected = await interaction.channel.awaitMessageComponent({ filter: collectorFilter, time: game.timeLimit * 1000 });
        await collected.update({ content: `You have selected to ${collected.customId == 'double' ? 'double down' : collected.customId}.`, components: [] });
        return await handleAction(collected.customId, interaction);
      } catch (err) {
        //timeout
        await interaction.channel.send(`I'm sorry <@${userId}>-san, but you are out of time. You will stand by default.`);
        console.log('standing by default');
        return await handleAction('stand', interaction);
      }
    case 'stand':
      console.log('i stood lol');
      //if player has split cards, switch to the other hand that hasnt been played
      if (game.splitCards.length == 1) {
        await interaction.channel.send(`Alright <@${userId}>-san, now we will play your second hand.`);
        let temp = game.splitCards;
        game.splitCards = game.playerCards;
        game.playerCards = temp;
        return await handleAction('hit', interaction);
      }
      let val = calculateHandValue(game.playerCards);
      //get larger value if ace allows for 2 hand values
      if (val.includes('/')) {
        val = val.split('/')[1].trim();
      }
      val = parseInt(val);
      //dealer's turn
      return await dealersTurn(interaction, val);
    case 'double':
      game.playerCards.push(game.cards[game.pointer++]);
      game.doubledown = true;
      //show table and then stand to make it dealer's turn
      let bufferDouble = await drawTable(game, guildId, userId, interaction.user.displayName);
      const attachmentDouble = new AttachmentBuilder(bufferDouble, { name: 'table.jpeg' });
      await interaction.channel.send({ content: `Alright <@${userId}>-san, here is your new hand.`, attachment: attachmentDouble });
      //add a card and double down bet and handle it like a stand since turn is over
      return await handleAction('stand', interaction);
    case 'split':
      await interaction.channel.send(`Alright <@${userId}>-san, we will split your hand. Now we will play your first hand.`);
      game.splitCards.push(game.playerCards.pop());
      //treat it like a hit on the first hand
      return await handleAction('hit', interaction);
  }
}

/** Called when its the dealers turn */
async function dealersTurn(interaction, handValue) {
  let game = games.get(interaction.user.id);
  let dealerVal = calculateHandValue(game.dealerCards);
  if (dealerVal.includes('/')) {
    const split = dealerVal.split('/')[1].trim();
    dealerVal = game.hard && split == '17' ? '7' : '17';
  }
  dealerVal = parseInt(dealerVal);
  //dealer must hit on 16 or less, stand on 17 or more (unless soft 17 in hard mode, taken care of above)
  while (dealerVal < 17) {
    game.dealerCards.push(game.cards[game.pointer++]);
    dealerVal = calculateHandValue(game.dealerCards);
    if (dealerVal.includes('/')) {
      const split = dealerVal.split('/')[1].trim();
      dealerVal = game.hard && split == '17' ? '7' : '17';
    }
    dealerVal = parseInt(dealerVal);
  }
  //determine winner
  let outcome1 = '';
  if (dealerVal > 21 || (dealerVal < handValue && handValue <= 21)) {
    outcome1 = 'win';
  } else if (dealerVal === handValue) {
    outcome1 = 'push';
  } else {
    outcome1 = 'loss';
  }
  //dont forget in case player split
  if (game.splitCards.length != 0) {
    let outcome2 = '';
    let val = calculateHandValue(game.splitCards);
    if (val.includes('/')) {
      val = val.split('/')[1].trim();
    }
    val = parseInt(val);
    if (dealerVal > 21 || (dealerVal < val && val <= 21)) {
      outcome2 = 'win';
    } else if (dealerVal === val) {
      outcome2 = 'push';
    } else {
      outcome2 = 'loss';
    }
    return await sendOutcome(interaction, outcome1, outcome2);
  } else {
    return await sendOutcome(interaction, outcome1);
  }

}

async function sendOutcome(interaction, outcome1, outcome2 = null) {
  let game = games.get(interaction.user.id);
  let vtChange = await payout(interaction.user.id, game, outcome1);
  let str = '';
  if (outcome2 && outcome2 != null) {
    vtChange += await payout(interaction.user.id, game, outcome2);
    str = `Between your split hands, you have ${outcome1 == 'loss' && outcome2 == 'loss' ? 'lost' : 'gained'} ${vtChange} VT.`;
  } else {
    switch (outcome1) {
      case 'bj':
        str = `Congratulations ${interaction.user.displayName}-san! You have won with a Blackjack! You have gained ${vtChange} VT.`;
        break;
      case 'push':
        str = `It is a push. Your bet has been returned to you ${interaction.user.displayName}-san.`;
        break;
      case 'win':
        str = `Congratulations ${interaction.user.displayName}-san! You won! You have gained ${vtChange} VT.`;
        break;
      case 'loss':
        str = `I won! Better luck next time ${interaction.user.displayName}-san. You have lost ${vtChange} VT.`;
        break;
      default:
        throw new AigisError('an invalid outcome was processed.');
    }
  }
  let buffer = await drawTable(game, interaction.guild.id, interaction.user.id, interaction.user.displayName, false);
  const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });
  game.splitCards = [];
  game.userCards = [];
  game.dealerCards = [];
  return {
    content: str + ' Would you like to play again? Please use the buttons below to make your choice within 60 seconds.',
    files: [attachment],
    components: [exports.createMenuButtons()]
  };
}

/**
 * Create the buttons for the player to choose their action
 * @param {*} guildId ID of the guild the game is happening in
 * @param {*} game The game object for this guild from the Map
 * @param {Boolean} double whether the player can double down
 * @param {Boolean} split whether the player can split
 * @param {Boolean} insure wether the player can cast an insurance bet. Not implemented right now
 * @returns {Promise<ActionRowBuilder>} the row of buttons to be sent to the player
 */
async function createButtons(userId, guildId, game, double, split, insure = false) {
  const hit = new ButtonBuilder()
    .setCustomId('hit')
    .setLabel('Hit')
    .setStyle(ButtonStyle.Primary);

  const stand = new ButtonBuilder()
    .setCustomId('stand')
    .setLabel('Stand')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(hit, stand);
  if (double) {
    const userVT = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
    if (userVT && userVT.vt >= game.bet * 2) {
      const double = new ButtonBuilder()
        .setCustomId('double')
        .setLabel('Double')
        .setStyle(ButtonStyle.Primary);
      row.addComponents(double);
    }
  }

  if (split) {
    const split = new ButtonBuilder()
      .setCustomId('split')
      .setLabel('Split')
      .setStyle(ButtonStyle.Danger);
    row.addComponents(split);
  }
  // if (insure) {
  //   const insure = new ButtonBuilder()
  //     .setCustomId('insure')
  //     .setLabel('Insure')
  //     .setStyle(ButtonStyle.Success);
  //   row.addComponents(insure);
  // }
  return row;
}

exports.createMenuButtons = () => {
  const deal = new ButtonBuilder()
    .setCustomId('deal')
    .setLabel('Deal')
    .setStyle(ButtonStyle.Success);

  const changeBet = new ButtonBuilder()
    .setCustomId('bet')
    .setLabel('Change Bet')
    .setStyle(ButtonStyle.Primary);

  const quit = new ButtonBuilder()
    .setCustomId('quit')
    .setLabel('Quit')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(deal, changeBet, quit);
  return row;
}

/* ----------------- Drawing the Canvas ----------------- */

/** Draw the blackjack table. Set hideDealerFirst to false when showing the dealer's full hand */
async function drawTable(game, guildId, userId, username, hideDealerFirst = true) {
  //get appropriate variables set
  const balance = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
  const wide = game.dealerCards.length > CARDS_WIDE || game.playerCards.length > CARDS_WIDE;
  //set canvas
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
  ctx.fillText(`Balance: ${numberToString(balance.vt)} VT`, 20, 100);
  ctx.fillText(`Bet: ${numberToString(game.doubledown ? 2 * game.bet : game.bet)} VT`, 20, 160);

  //get appropriate card names
  const dealerCards = hideDealerFirst ? [path.join(CARD_PATH, 'back.png'), path.join(CARD_PATH, `${game.dealerCards[1]}.png`)] : game.dealerCards.map(c => path.join(CARD_PATH, `${c}.png`));
  const playerCards = game.playerCards.map(c => path.join(CARD_PATH, `${c}.png`));
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


// function genDeck() {
//   let deck = [];
//   let suits = ['cups', 'coins', 'swords', 'wands'];
//   let values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'];
//   for (let suit of suits) {
//     for (let value of values) {
//       deck.push(`${suit}-${value}`);
//     }
//   }
//   console.log(deck);
// }