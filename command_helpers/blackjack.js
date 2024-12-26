/**
 * @file blackjack.js
 * @description This file manages the Blackjack game for each user
 */
const AigisError = require("../utils/AigisError");
const config = require("../config");
const { AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const db = require("../database/db")
const BigNumber = require('bignumber.js');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { numberToString } = require("../utils/utils");
const { setTimeout } = require('node:timers/promises');

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

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

/** Since game is stored in memory, a bot restart will stop the game */
async function shutdown() {
  if (games.size == 0) {
    return;
  }
  for (let [userId, game] of games) {
    try {
      //give bet back to user
      let playerVT = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: game.guildId });
      await db.updateOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: game.guildId }, { $set: { vt: new BigNumber(playerVT.vt).plus(game.bet).toString() } });
      //send message saying game is ending
      await game.channel.send(`I'm sorry <@${userId}>-san, but I am going to briefly shut down or restart. The game must end. I will return your bet.`);
      games.delete(userId);
    } catch (err) {
      console.error(`Error gracefully shutting down game for ${userId} in guild ${game.guildId}: ${err.message}`);
    }
  }
  games.clear();
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
    splitAces: false,
    bet: playerVT.bet,
    insurance: false,
    doubledown: false,
    guildId: guildId,
    hard: hardmode,
    timeouts: 0,
    channel: null //used only for shutdown
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
    //throw new AigisError(`you must bet between ${config.MIN_BET} and ${config.MAX_BET} tokens.`, 400);
    return false;
  }
  let playerVT = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
  if (!playerVT || playerVT.vt < amount) {
    //throw new AigisError('you do not have enough Velvet Tokens to make that bet.', 400);
    return false;
  }
  const ret = await db.updateOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId }, { $set: { bet: amount } });
  if (ret == 0) {
    return false;
  }
  game.bet = amount;
  return true;
}

/**
 * Use to prompt the user for a turn action after sending a message. Will wait for the button click and resolve with the action
 * @param {*} response The response object from the interaction.followUp or whatever message was sent to prompt for a button click
 * @param {*} game The game object
 * @param {String} userId The user ID of the player
 * @param {*} buttonRow The row of buttons to be sent to the player, the same one used in the prompt (the prompt the response object is from)
 * @param {*} channel The channel to send messages into
 * @param {String} defaultAction The action to take if the player times out. Default is 'stand'
 * @returns {Promise<String>} The action chosen by the player
 */
async function getCollectorResponse(response, game, userId, buttonRow, channel, defaultAction = 'stand') {
  const guildId = game.guildId;
  return new Promise(async (resolve) => {
    const collectorFilter = i => i.user.id === userId;
    const collector = await response.createMessageComponentCollector({ componentType: ComponentType.Button, filter: collectorFilter, time: game.timeLimit * 1000 });

    //stop listening after a response is collected
    collector.on('collect', async (i) => {
      game.timeouts = 0;
      await i.deferUpdate();
      collector.stop('done');
    });

    collector.on('end', async (collected, reason) => {
      const i = collected.first()
      //disable buttons when collection over
      for (const button of buttonRow.components) {
        button.setDisabled(true);
      }

      //timeout
      if (reason == 'time') {
        game.timeouts += 1;
        if (game.timeouts >= 3) {
          await i.channel.send({ content: `I'm sorry <@${userId}>-san, but you have timed out too many times. The game will end.`, components: [buttonRow] });
          resolve('quit');
        }
        await channel.send({ content: `I'm sorry <@${userId}>-san, but you are out of time. You will stand by default.`, components: [buttonRow] });
        return resolve(defaultAction);
      }
      //success
      if (reason == 'done') {
        const customId = i.customId;
        await i.editReply({ content: `You have chosen to **${customId}** <@${userId}>-san.`, components: [buttonRow] });
        return resolve(customId);
      } else {
        console.error(`The button interaction collector ended for an unknown reason - ${reason}. Guild ID: ${guildId}, User ID: ${userId}`);
        throw new AigisError(`The button interaction collector ended for an unknown reason - ${reason}`);
      }
    });
  });
}

/** Start a turn of blackjack. This means dealing the cards and moving to the player's turn */
exports.startTurn = async (guildId, userDisplayName, userId, interaction) => {
  //deal 2 cards to player and dealer
  let game = games.get(userId);
  game.channel = interaction.channel;
  if (!game || !game.guildId == guildId) {
    throw new AigisError('you do not have a blackjack game in progress.', 400);
  }
  //deal 2 cards to player
  game.playerCards.push(game.cards[game.pointer++]);
  game.playerCards.push(game.cards[game.pointer++]);

  //split test
  // const card = 'swords-a';
  // game.playerCards.push(card);
  // game.playerCards.push(card);

  //deal 2 cards to dealer
  game.dealerCards.push(game.cards[game.pointer++]);
  game.dealerCards.push(game.cards[game.pointer++]);

  //reshuffle if necessary
  if (game.pointer >= game.cards.length - RESHUFFLE_AT) {
    interaction.channel.send('Please wait while I reshuffle the deck.');
    game.pointer = 0;
    game.cards = shuffle(game.cards);
  }

  //calculate hand value
  let handValue = calculateHandValue(game.playerCards);

  //need to have separate draw tables so they are updated with new VT total
  let dealerVal = calculateHandValue(game.dealerCards);

  //generate table image 
  let buffer = await drawTable(game, guildId, userId, userDisplayName);
  const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });

  //insurance
  if (game.dealerCards[1].split('-')[1] === 'a') {
    //offer insurance
    const insurance = new ButtonBuilder()
      .setCustomId('insure')
      .setLabel('Insure')
      .setStyle(ButtonStyle.Secondary);
    const noInsurance = new ButtonBuilder()
      .setCustomId('no-insure')
      .setLabel('No Insurance')
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(insurance, noInsurance);
    const response = await interaction.followUp({ content: `<@${userId}>-san, the dealer's face up card is an Ace. Would you like to insure your bet?`, files: [attachment], components: [row] });
    const action = await getCollectorResponse(response, game, userId, row, interaction.channel, 'no-insure');
    if (action === 'insure') {
      game.insurance = true;
    }
  }
  if (dealerVal === '21' && handValue === '21') {
    //blackjack push
    return await sendOutcome(interaction, 21, [{ outcome: 'push', val: 21 }]);
  }
  else if (dealerVal === '21') {
    //only dealer has blackjack
    return await sendOutcome(interaction, 21, [{ outcome: 'loss', val: handValue }]);
  }
  else if (handValue === '21') {
    if (dealerVal.includes('/')) {
      dealerVal = parseInt(dealerVal.split('/')[1].trim());
    }
    return await sendOutcome(interaction, dealerVal, [{ outcome: 'bj', val: 21 }]);
  }
  //create the response buttons and wait for player action
  const split = game.playerCards[0].split('-')[1] === game.playerCards[1].split('-')[1];
  const buttonRow = await createButtons(userId, guildId, game, true, split);
  const response = await interaction.followUp({
    content: `Please select an action <@${userId}>-san.\nThe time limit is **${game.timeLimit}** seconds.\nYour hand value is: **${handValue}**.${game.insurance ? '\nYou have also lost your insurance bet.' : ''}`,
    files: [attachment],
    components: [buttonRow]
  });
  const action = await getCollectorResponse(response, game, userId, buttonRow, interaction.channel);

  //handle the action
  switch (action) {
    case 'hit':
      return await handleAction('hit', interaction);
    case 'stand':
      return await handleAction('stand', interaction);
    case 'double':
      return await handleAction('double', interaction);
    case 'split':
      return await handleAction('split', interaction);
    case 'quit':
      return exports.quit(userId);
    default:
      throw new AigisError(`an invalid action of "${action}" was processed.`);
  }
}

/** Possible actions are hit, stand, double, split, insure */
async function handleAction(action, interaction) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
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
      if ((!newVal.includes('/') && parseInt(newVal) > 21) || game.splitAces) {
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
      const response = await interaction.followUp({
        content: `Please select an action <@${userId}>-san.\nThe time limit is **${game.timeLimit}** seconds.\nYour hand value is: **${newVal}**.`,
        files: [attachment],
        components: [buttonRow]
      });
      //use collector to get chosen action
      const action = await getCollectorResponse(response, game, userId, buttonRow, interaction.channel);

      //handle the action. Cannot double or split here
      switch (action) {
        case 'hit':
          return await handleAction('hit', interaction);
        case 'stand':
          return await handleAction('stand', interaction);
        case 'quit':
          return exports.quit(userId);
        default:
          throw new AigisError(`an invalid action of "${action}" was processed.`);
      }
    case 'stand':
      //if player has split cards, switch to the other hand that hasnt been played
      if (game.splitCards.length == 1) {
        let buffer = await drawTable(game, guildId, userId, interaction.user.displayName);
        const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });
        const firstTotal = calculateHandValue(game.playerCards);
        await interaction.channel.send({ content: `Alright <@${userId}>-san, your first hand total is **${firstTotal}**. Now we will play your second hand.`, files: [attachment] });
        //swap this hand with split cards hand (1 card that was split) and play new hand
        let temp = game.splitCards;
        game.splitCards = game.playerCards;
        game.playerCards = temp;
        await setTimeout(3000); //wait 5 secs to let the user read the message
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
      let card = game.playerCards.pop();
      if (card.split('-')[1] === 'a') {
        game.splitAces = true;
      }
      game.splitCards.push(card);
      //treat it like a hit on the first hand
      return await handleAction('hit', interaction);
  }
}

/** Called when its the dealers turn */
async function dealersTurn(interaction, handValue) {
  let game = games.get(interaction.user.id);
  let splitBusted = true; //default true means it wont impact dealer check if no split occured
  if (game.splitCards.length != 0) {
    const splitVal = calculateHandValue(game.splitCards);
    //determine if split hand busted
    splitBusted = splitVal > 21;
  }
  let outcomes = [];
  let dealerVal = calculateHandValue(game.dealerCards);
  if (dealerVal.includes('/')) {
    const split = dealerVal.split('/')[1].trim();
    if (split == '17') {
      dealerVal = game.hard ? '7' : '17';
    }
  }
  dealerVal = parseInt(dealerVal);
  //dealer must hit on 16 or less, stand on 17 or more (unless soft 17 in hard mode, taken care of above)
  while (dealerVal < 17 && !(handValue > 21 && splitBusted)) {
    game.dealerCards.push(game.cards[game.pointer++]);
    dealerVal = calculateHandValue(game.dealerCards);
    if (dealerVal.includes('/')) {
      const split = dealerVal.split('/')[1].trim();
      if (split == '17') {
        dealerVal = game.hard ? '7' : '17';
      }
    }
    dealerVal = parseInt(dealerVal);
  }
  //determine winner
  if (dealerVal > 21 || (dealerVal < handValue && handValue <= 21)) {
    outcomes.push({ outcome: 'win', val: handValue });
  } else if (dealerVal === handValue) {
    outcomes.push({ outcome: 'push', val: handValue });
  } else {
    outcomes.push({ outcome: 'loss', val: handValue });
  }
  //dont forget in case player split
  if (game.splitCards.length != 0) {
    let val = calculateHandValue(game.splitCards);
    if (val.includes('/')) {
      val = val.split('/')[1].trim();
    }
    val = parseInt(val);
    if (dealerVal > 21 || (dealerVal < val && val <= 21)) {
      outcomes.push({ outcome: 'win', val: val });
    } else if (dealerVal === val) {
      outcomes.push({ outcome: 'push', val: val });
    } else {
      outcomes.push({ outcome: 'loss', val: val });
    }
    return await sendOutcome(interaction, dealerVal, outcomes);
  } else {
    return await sendOutcome(interaction, dealerVal, outcomes);
  }

}
/**
 * Shows the end outcome of the game to the user
 * @param {*} interaction the interaction event that stores info about the user/server/game and channel
 * @param {*} dealerVal The value of the dealer's cards
 * @param {*} outcomes Array of outcomes for each of the user's hands. Each entry is an object of { outcome: 'win/loss/push/bj', val: hand value }
 * @returns The final message with the game total
 */
async function sendOutcome(interaction, dealerVal, outcomes) {
  const userId = interaction.user.id;
  let game = games.get(userId);
  //calcualte insurance bet and string
  let insureStr = '';
  let insureAmt = 0;
  if (game.insurance && dealerVal == 21 && game.dealerCards.length == 2) {
    insureStr += `You have won your separate insurance bet, **winning ${bet}**.\n\n`;
    insureAmt = bet;
  } else if (game.insurance) {
    insureStr += `You have lost your separate insurance bet, **losing ${Math.floor(game.bet / 2)}**.\n\n`;
    insureAmt = -1 * Math.floor(game.bet / 2);
  }
  game.insurance = false;
  //calculate change in VT exlcuding insurance
  let vtChange = await payout(userId, game, outcomes[0].outcome, insureAmt);
  let str = '';
  if (outcomes.length == 2) {
    //account for second hand
    const change2 = await payout(userId, game, outcomes[1].outcome);
    //if they are the same add together and check for loss
    if (outcomes[0].outcome == outcomes[1].outcome) {
      //works for win/win, draw/draw, and loss/loss
      vtChange += change2;
      if (outcomes[0].outcome == 'loss') {
        vtChange = -1 * vtChange;
      }
    } else {
      //if they are different find the winner, subtract the loss from the win
      if (outcomes[0].outcome == 'loss') {
        //works for loss/draw and loss/win
        vtChange = change2 - vtChange;
      } else if (outcomes[1].outcome == 'loss') {
        //works for win/loss and draw/loss
        vtChange = vtChange - change2;
      } else {
        //works for draw/win and win/draw
        vtChange += change2;
      }
    }
    //build message for split hands
    str = `<@${userId}>-san, between your split hands, **you have ${outcomes[0].outcome == 'loss' && outcomes[1].outcome == 'loss' ? 'lost' : 'gained'} ${numberToString(vtChange)} VT**.\n${insureStr}\n`;
    //hands get switched during processing
    str += `Your first hand total was **${outcomes[1].val}**\n`;
    str += `Your second hand total was **${outcomes[0].val}**\n`;
    str += `My hand total was **${dealerVal}**\n`;
  } else {
    switch (outcomes[0].outcome) {
      case 'bj':
        str = `Congratulations <@${userId}>-san! You have won with a Blackjack! **You have gained ${numberToString(vtChange)} VT**.\n${insureStr}\n`;
        break;
      case 'push':
        str = `It is a push. Your bet has been returned to you <@${userId}>-san.\n${insureStr}\n`;
        break;
      case 'win':
        str = `Congratulations <@${userId}>-san! You won! **You have gained ${numberToString(vtChange)} VT**.\n${insureStr}\n`;
        break;
      case 'loss':
        str = `I won! Better luck next time <@${userId}>-san. **You have lost ${numberToString(vtChange)} VT**.\n${insureStr}\n`;
        break;
      default:
        throw new AigisError('an invalid outcome was processed.');
    }
    str += `Your hand total was **${outcomes[0].val}**\n`;
    str += `My hand total was **${dealerVal}**\n`;
  }
  let buffer = await drawTable(game, interaction.guild.id, userId, interaction.user.displayName, false);
  const attachment = new AttachmentBuilder(buffer, { name: 'table.jpeg' });
  game.splitCards = [];
  game.playerCards = [];
  game.dealerCards = [];
  game.splitAces = false;
  return {
    content: str + '\nWould you like to play again? Please use the buttons below to make your choice within 60 seconds.',
    files: [attachment],
    components: [exports.createMenuButtons()]
  };
}

/** 
 * Calculate and process the payout. result is either "bj", "push", "win", or "loss" 
 * returns the payout
 * */
async function payout(userId, game, result, insuranceBet = 0) {
  const bet = game.doubledown ? game.bet * 2 : game.bet;
  game.doubledown = false;
  let vtChange = 0;
  switch (result) {
    case 'bj':
      vtChange = bet * 1.5;
      break;
    case 'push':
      vtChange = 0;
      break;
    case 'win':
      vtChange = bet;
      break;
    case 'loss':
      vtChange = -1 * bet;
      break;
    default:
      throw new AigisError('an invalid hand result was processed. Result: ' + result);
  }
  let playerVT = await db.findOne(config.DB_NAME, "vt", { user_id: userId, guild_id: game.guildId });
  let newVT = new BigNumber(playerVT.vt).plus(vtChange).plus(insuranceBet).toString();
  let newGambleHistory = new BigNumber(playerVT.gamble_history).plus(vtChange).plus(insuranceBet).toString();
  await db.updateOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: game.guildId }, { $set: { vt: newVT, gamble_history: newGambleHistory } });
  return Math.abs(vtChange);
}

/* ----------------- Button Creation ----------------- */

/**
 * Create the buttons for the player to choose their action
 * @param {*} guildId ID of the guild the game is happening in
 * @param {*} game The game object for this guild from the Map
 * @param {Boolean} double whether the player can double down
 * @param {Boolean} split whether the player can split
 * @param {Boolean} insure wether the player can cast an insurance bet. Not implemented right now
 * @returns {Promise<ActionRowBuilder>} the row of buttons to be sent to the player
 */
async function createButtons(userId, guildId, game, double, split) {
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
