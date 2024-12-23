/**
 * @file blackjack.js
 * @description This file manages the Blackjack game for each server
 */

const AigisError = require("../utils/AigisError");
const config = require("../config");

let games = new Map(); //map of game objects, key is guild id
const MAX_PLAYERS = 5;
const RESHUFFLE_AT = 32;

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
  return deck.concat(deck, deck, deck, deck); //5 decks
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

exports.startGame = async (guildId, userId, channel, timeLimit = 30) => {
  //check if game already exists
  if (games.get(guildId)) {
    throw new AigisError('A Blackjack game is already in progress for this server.');
  }
  //check if player has enough tokens
  let playerVT = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
  if (!playerVT || playerVT.vt < config.MIN_BET) {
    throw new AigisError('you do not have enough Velvet Tokens to play Blackjack. Use `/claim` to get your daily tokens or wait until tomorrow. Please be more careful with your money!');
  }
  //generate player object
  let player = {
    cards: [],
    splitcards: false,
    bet: config.MIN_BET,
    insurance: false,
    doubledown: false
  };
  let game = {
    cards: shuffle(getDeck()),
    timeLimit: timeLimit,
    pointer: 0,
    dealer: [],
    players: [
      { [`${userId}`]: player }
    ]
  };
  games.set(guildId, game);
}

exports.joinGame = async (guildId, userId) => {
  let game = games.get(guildId);
  if (!game) {
    throw new AigisError('there is no Blackjack game in progress for this server.');
  }
  if (game.players.length >= MAX_PLAYERS) {
    throw new AigisError('the Blackjack table is full. Please wait for an opening.');
  }
  //check if player is already in game
  if (game.players.find(p => p[`${userId}`])) {
    throw new AigisError('you are already in the game.');
  }
  //check if player has enough tokens
  let playerVT = await db.findOne(config.DB_NAME, 'vt', { user_id: userId, guild_id: guildId });
  if (!playerVT || playerVT.vt < config.MIN_BET) {
    throw new AigisError('you do not have enough Velvet Tokens to play Blackjack. Use `/claim` to get your daily tokens or wait until tomorrow. Please be more careful with your money!');
  }
  //generate player object
  let player = {
    cards: [],
    splitcards: false,
    bet: config.MIN_BET,
    insurance: false,
    doubledown: false
  };
  game.players.push({ [`${userId}`]: player });
}

exports.leaveGame = async (guildId, userId) => {
  let game = games.get(guildId);
  if (!game) {
    throw new AigisError('there is no Blackjack game in progress for this server.');
  }
  let player = game.players.find(p => p[`${userId}`]);
  if (!player) {
    throw new AigisError('you are not in the game.');
  }
  game.players = game.players.filter(p => !p[`${userId}`]);
  if (game.players.length === 0) {
    games.delete(guildId);
  }
}

/** Possible actions are hit, stand, double, split, insure */
exports.handleAction = async (action, interaction) => {

}
/*
server id key
-----
{
cards: [array of card strings],
timeLimit: integer,
pointer: points to card that will be dealt next (reshuffle when pointer reaches arr.lenth - 32)
dealer: [array of card strings],
players: array of objects with id as key 
  - value: 
    { 
    cards: [array of card strings], (first index is face up)
    splitcards: [array of card strings], - false if player is not splitting
    bet: integer,
    insurance: boolean, - set to falsy value unless player takes insurance bet, then set to bet amount
    doubledown: boolean, - set to true if player doubles down, reset to false after end of turn and adjust bet accordingly
    }
}
*/


function genDeck() {
  let deck = [];
  let suits = ['cups', 'coins', 'swords', 'wands'];
  let values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'];
  for (let suit of suits) {
    for (let value of values) {
      deck.push(`${suit}-${value}`);
    }
  }
  console.log(deck);
}