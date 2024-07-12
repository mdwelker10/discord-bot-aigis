const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription("Provides information about the user who ran the command."),
  async execute(interaction) {
    // interaction.user is the object representing the User who ran the command
    // interaction.member is the GuildMember object representing the User in the specific guild
    // guild is the term used for a discord server in the docs and API
    const month = interaction.member.joinedAt.getMonth();
    const date = interaction.member.joinedAt.getDate();
    const day = interaction.member.joinedAt.getDay();
    const year = interaction.member.joinedAt.getFullYear();
    await interaction.reply(`Allow me to dox you. Your username is ${interaction.user.tag}-san, but you prefer ${interaction.user.displayName}-san. and you joined the server on ${numToMonth(month)} ${date}, ${year}. It was a ${numToDate(day)}.`);
  },
};

function numToDate(num) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][num];
}

function numToMonth(num) {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][num];
}