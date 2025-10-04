const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Replies with your input')
    .addStringOption(option => option.setName('input').setDescription('Input to echo back').setRequired(true))
    .addBooleanOption(option => option.setName('ephemeral').setDescription('If only you should see the message')),
  async execute(interaction) {
    const input = interaction.options.getString('input');
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false; //return false if option not provided (more useful for non-required strings)
    if (ephemeral) {
      await interaction.reply({ content: `${input}, as they say.`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply(`${input}, as they say.`);
    }
  }
}