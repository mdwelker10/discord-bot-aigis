const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../database/db');
const AigisError = require('../../utils/AigisError');
const { claim } = require('../../command_helpers/daily');
const { numberToString } = require('../../utils/utils');
const BigNumber = require('bignumber.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vt')
    .setDescription("Do various actions relating to Velvet Tokens")
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Get information on Velvet Tokens')
    )
    .addSubcommand(sub =>
      sub.setName('balance')
        .setDescription('Check your current Velvet Token balance and gambling profits/losses')
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('View the server leaderboard for Velvet Tokens')
    )
    .addSubcommand(sub =>
      sub.setName('daily')
        .setDescription('claim daily Velvet Tokens')
    )
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('Give Velvet Tokens to another user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to give Velvet Tokens to')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('The amount of Velvet Tokens to give')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1_000_000_000_000) //1 trillion
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.user.displayName;
    try {
      if (subcommand === 'info') {
        let str = `Velvet Tokens (VT) are a currency that I keep track of for you to use in the server ${user}-san. As such, they do not have a conversion rate to Yen, USD or other currency. `;
        str += `You can earn VT by claiming your daily tokens with the \`/vt daily\` or \`/claim\` commands. You can earn bonus VT by collecting daily tokens on consecutive days and building a streak. `;
        str += `Every 7 consecutive days you collect your daily VT, you will receive a bonus equal to twice the number of consecutive days your streak is at.\n\n`;
        str += `You can use this VT to play various games, such as Blackjack, and possibly earn more by doing so. At the moment, there is no actual use for VT other than this. `;
        str += `Although, I do keep track of all VT that you have gained or lost via gambling means, and you can see this information with the \`/vt balance\` command. `;
        str += `Below are the commands you can use with regards to Velvet Tokens, not including the games you can play with them:\n\n`;
        const embed = new EmbedBuilder()
          .setColor(config.EMBED_COLOR)
          .setThumbnail(config.AIGIS_BUSTUP_IMAGE)
          .setTitle('Velvet Tokens Information')
          .setDescription(str)
          .addFields(
            { name: '/vt info', value: 'This command showing information about Velvet Tokens.' },
            { name: '/vt balance', value: 'Check your current Velvet Token balance and total won/lost via gambling.' },
            { name: '/vt leaderboard', value: 'View the server leaderboard for Velvet Tokens.' },
            { name: '/vt give <user> <amount>', value: 'Give Velvet Tokens to another user.' },
            { name: '/vt daily', value: 'Claim daily Velvet Tokens.' },
            { name: '/claim', value: 'Claim daily Velvet Tokens, alias for /vt daily.' }
          )
          .setTimestamp();
        return await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'balance') { //check balance
        const data = await db.findOne(config.DB_NAME, 'vt', { user_id: interaction.user.id, guild_id: interaction.guild.id });
        if (!data) {
          return await interaction.editReply(`${user}-san, you do not have any Velvet Tokens yet. You can claim your daily tokens with the /vt daily command.`);
        } else {
          let str = `You have **${numberToString(new BigNumber(data.vt))} VT**.\n`;
          let history = new BigNumber(data.gamble_history);
          str += `You have ${history.isNegative() ? 'lost' : 'won'} ${numberToString(history.abs())} VT from gambling.`;
          return await interaction.editReply(str);
        }
      } else if (subcommand === 'leaderboard') { //show leaderboard
        const conn = await db.connect(config.DB_NAME);
        const collection = conn.collection('vt');
        const data = await collection.find().sort({ vt: -1 }).collation({ locale: "en_US", numericOrdering: true }).limit(10).toArray();
        await db.disconnect();
        str = data.length === 0 ? 'No users have any Velvet Tokens yet.' : '';
        for (let i = 0; i < data.length; i++) {
          let name = null;
          try {
            let user = await interaction.guild.members.fetch(data[i].user_id);
            name = user.user.username;
          } catch (err) {
            //member not found
            name = data[i].user_id;
          }
          str += `${i + 1}. ${name} - ${numberToString(data[i].vt)} VT -- Streak: ${data[i].daily_streak}\n`;
        }
        const embed = new EmbedBuilder()
          .setColor(config.EMBED_COLOR)
          .setThumbnail(config.AIGIS_BUSTUP_IMAGE)
          .setTitle(`${interaction.guild.name} VT Leaderboard`)
          .setDescription(str)
          .setTimestamp();
        return await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'daily') { //claim daily tokens
        const ret = await claim(interaction.member);
        if (!ret) {
          return await interaction.editReply(`${user}-san, you have already claimed your daily tokens today.`);
        } else if (ret.new_member) {
          return await interaction.editReply(`${user}-san, you have claimed your daily tokens for the first time! You have received 1000 tokens plus one token for each day you have been in the server, meaning you now have ${ret.tokens} VT.`);
        }
        let bonus = ret.bonus ? `Since your streak is at ${ret.daily_streak} days, you received a weekly bonus of ${ret.bonus} tokens.` : `Your streak is now at ${ret.daily_streak} days.`;
        return await interaction.editReply(`Thank you for claiming your daily tokens ${user}-san! ${bonus} You now have ${ret.tokens} VT.`);
      } else if (subcommand === 'give') { //give tokens
        const targetUser = interaction.options.getUser('user');
        if (targetUser.id === interaction.user.id) {
          return await interaction.editReply(`You cannot give Velvet Tokens to yourself ${targetUser.displayName}-san.`);
        }
        const vt = interaction.options.getInteger('amount');
        if (vt <= 0) {
          return await interaction.editReply(`You cannot give less than 1 Velvet Token ${targetUser.displayName}-san.`);
        }
        const sender = await db.findOne(config.DB_NAME, 'vt', { user_id: interaction.user.id, guild_id: interaction.guild.id });
        let senderVT = new BigNumber(sender.vt);
        if (!sender || senderVT.lt(vt)) {
          return await interaction.editReply(`You do not have enough Velvet Tokens to give ${vt} VT to ${targetUser.displayName}-san.`);
        }
        const receiver = await db.findOne(config.DB_NAME, 'vt', { user_id: targetUser.id, guild_id: interaction.guild.id });
        if (!receiver) {
          return await interaction.editReply(`${targetUser.displayName}-san does not have any Velvet Tokens yet. Please tell them to claim their daily tokens to initialize their account.`);
        }
        //calculate new vt totals
        let newSenderVT = senderVT.minus(vt);
        let newReceiverVT = new BigNumber(receiver.vt).plus(vt);
        await db.updateOne(config.DB_NAME, 'vt', { user_id: targetUser.id, guild_id: interaction.guild.id }, { $set: { vt: newReceiverVT.toString() } });
        await db.updateOne(config.DB_NAME, 'vt', { user_id: interaction.user.id, guild_id: interaction.guild.id }, { $set: { vt: newSenderVT.toString() } });
        console.log(`${interaction.user.id} gave ${vt} VT to ${targetUser.id} in guild ${interaction.guild.id}`);
        return await interaction.editReply(`The transfer was a success! Your current balance is ${numberToString(newSenderVT)} VT. ${targetUser.displayName}-san now has ${numberToString(newReceiverVT)} VT.`);
      } else {
        return await interaction.editReply(`I'm sorry ${user}-san, I do not recognize the command you gave me.`)
      }
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