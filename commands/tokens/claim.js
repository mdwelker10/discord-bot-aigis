const { SlashCommandBuilder } = require('discord.js');
const AigisError = require('../../utils/AigisError');
const { claim } = require('../../command_helpers/daily');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim your daily Velvet Tokens. Shortcut for /vt daily'),
  async execute(interaction) {
    const user = interaction.user.displayName;
    try {
      const ret = await claim(interaction.member);
      if (!ret) {
        return await interaction.editReply(`${user}-san, you have already claimed your daily tokens today.`);
      } else if (ret.new_member) {
        return await interaction.editReply(`${user}-san, you have claimed your daily tokens for the first time! You have received 1000 tokens plus one token for each day you have been in the server, meaning you now have ${ret.tokens} VT.`);
      }
      let bonus = ret.bonus ? `Since your streak is at ${ret.daily_streak} days, you received a weekly bonus of ${ret.bonus} tokens.` : `Your streak is now at ${ret.daily_streak} days.`;
      return await interaction.editReply(`Thank you for claiming your daily tokens ${user}-san! ${bonus} You now have ${ret.tokens} VT.`);
    } catch (err) {
      if (err instanceof AigisError) {
        await interaction.editReply(`${user}-san! I'm sorry but I have encountered an issue while executing your command. The problem is ${err.message}`);
      } else {
        console.error(err);
        await interaction.editReply(`${user}-san... I do not know what happened. My programming indicated there was an issue but it is unknown to me. The issue is ${err.message}`)
      }
    }
  }
}