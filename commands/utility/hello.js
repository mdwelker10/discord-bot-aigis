const { SlashCommandBuilder } = require("discord.js");

const responses = [
  'Hello!',
  'Hi there!',
  'Hiiiii! \\^-^/',
  ':3',
  'Hello! Are you silly today? I am silly today. I have learned being silly is the optimal way of living. :D'
];

module.exports = {
  //command /hello with description of "Says hello!"
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Say hello!'),
  //command response
  async execute(interaction) {
    let msg = responses[Math.floor(Math.random() * responses.length)];
    await interaction.reply(msg);
  },
};