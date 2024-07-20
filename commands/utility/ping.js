const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  //command /hello with description of "Says hello!"
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping Aigis (get roundtrip latency)'),
  //command response
  async execute(interaction) {
    const sent = await interaction.editReply({ content: 'Pinging...', fetchReply: true });
    interaction.editReply(`OK ${interaction.user.displayName}-san, the ping is ${sent.createdTimestamp - interaction.createdTimestamp}ms.`);
  },
}; 