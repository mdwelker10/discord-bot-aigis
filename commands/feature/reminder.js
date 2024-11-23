const { SlashCommandBuilder, time, TimestampStyles } = require('discord.js');
const config = require('../../config');
const { addItem } = require('../../command_helpers/reminder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Schedule messages to be sent at a later time. EX: /remindme 4h30m explore tartarus')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('How long until the reminder triggers. EX: 4d3h2m, 3h21m, 100d, 50h')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to send when the reminder is triggered')
        .setRequired(true)
    ),
  async execute(interaction) {
    const user = interaction.user.displayName;
    try {
      const time = interaction.options.getString('time');
      const message = interaction.options.getString('message');
      const regex = new RegExp(/(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?/, 'g');
      if (!regex.test(time)) {
        return interaction.reply(`I'm sorry ${user}-san, your time parameter does not seem to be formatted properly. 
        You must state the days, hours, and minutes in that order, or only include one or 2 of them. 
        Examples of valid time parameters are: 4d3h2m, 3h21m, 100d, 69h90m, 6d7m, 48h, and 1m.`);
      }
      regex.lastIndex = 0; //reset after call to test
      const timeMatch = regex.exec(time); //exec regex search
      const days = timeMatch[1] ? parseInt(timeMatch[1]) : 0; //matches first group, which is days
      const hours = timeMatch[2] ? parseInt(timeMatch[2]) : 0; //matches second group which is hours
      const minutes = timeMatch[3] ? parseInt(timeMatch[3]) : 0; //matches third group which is minutes
      const delay = ((days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60)) * 1000;
      addItem(
        {
          channel: interaction.channelId,
          message: message,
          user: interaction.user.id
        },
        {
          delay: delay,
          removeOnComplete: true,
        }
      );
      //let date = new Date(reminderTime);
      return interaction.reply(`I have scheduled your reminder for <t:${Math.floor((Date.now() + delay) / 1000)}>, ${user}-san`);
    } catch (err) {
      console.error(err);
      return interaction.reply(`I'm sorry ${user}-san, I was unable to schedule your reminder. Please tell one of my maintainers to look at my logs.`);
    }
  }
}
