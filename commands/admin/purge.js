const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../../utils/utils');
const db = require('../../database/db');
const AigisError = require('../../utils/AigisError');
const config = require('../../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription("Delete data Aigis has for your server. Use /purge help for more information.")
    .addSubcommand(sub =>
      sub.setName('help')
        .setDescription('Get help on how to delete data.')
    )
    .addSubcommand(sub =>
      sub.setName('revert')
        .setDescription("Reverse a data deletion. If the delay period is passed then purge cannot be reverted.")
    )
    .addSubcommand(sub =>
      sub.setName('confirm')
        .setDescription('Schedule all data related to your server to be removed in 7 days.')
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const username = interaction.user.displayName;
    //check for permission to enable/disable commands (anyone with manage server permission)
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return await interaction.editReply({ content: `${username}-san, you do not have permission to do that!`, flags: MessageFlags.Ephemeral });
    }
    //help command
    if (subcommand === 'help') {
      let desc = `Here is some guidance on deleting data I have stored for your server ${username}-san. `;
      desc += `Manage server permissions are needed to use this command as this is quite the sensitive operation, but it is recommended to run this command if you want to remove me from your server. `;
      desc += `If that is the case, then I am sorry that I could not properly fulfill my duties and will strive to improve.\n\n`;
      desc += `Also ${username}-san, your data will not be deleted immediately. There is a 7 day delay before the data is deleted in case you change your mind. `;
      desc += `If you wish to reverse a data deletion, you can use the \`/purge revert\` command. `;
      desc += `To see a list of commands that store data, you can use \`/command list\` with the \`datastore\` option set to true. Included below is a quick overview of the command for your reference.\n\n`;
      desc += `**Please be careful when using this command ${username}-san.** When the delay period has passed, your data cannot be recovered.`;
      const embed = new EmbedBuilder()
        .setTitle('Purge Command Help')
        .setColor(config.EMBED_COLOR)
        .setDescription(desc)
        .setThumbnail(config.AIGIS_COOLDOWN_IMAGE)
        .addFields(
          { name: '/purge help', value: 'This command showing information for the purge command' },
          { name: `/purge revert`, value: `Reverse the scheduled data deletion. If the delay period has passed then a purge cannot be reverted.` },
          { name: `/purge confirm`, value: `Schedule server-related data to be deleted in 7 days.` }
        )
        .setTimestamp();
      return await interaction.editReply({ embeds: [embed] });
    }
    try {
      const guildId = interaction.guild.id;
      //get the guild config -- no data to delete if no config
      const cfg = await getGuildConfig(guildId);
      if (!cfg) {
        return await interaction.editReply(`I was unable to retrieve the configuration for this server ${username}-san. A server configuration is needed to activate a purge. Please have someone with the "manage server" permission run the \`/setup\` command.`);
      }
      const ping = cfg.permission_role_id == 'everyone' ? `<@${interaction.guild.ownerId}` : `<@&${cfg.permission_role_id}>`
      if (subcommand == 'revert') { //revert command
        let ret = await db.updateOne(config.DB_NAME, 'config', { guild_id: guildId, purge_date: { $exists: true } }, { $unset: { purge_date: "" } });
        if (ret === 0) {
          throw new AigisError(`you do not have a data deletion scheduled.`);
        }
        return await interaction.editReply(`${ping} The schedule purge deletion has been reverted.`);
      }
      let purgeDate = new Date();
      purgeDate.setDate(purgeDate.getDate() + 7);
      //set purge date
      let ret = await db.updateOne(config.DB_NAME, 'config', { guild_id: guildId, purge_date: { $exists: false } }, { $set: { purge_date: purgeDate } });
      if (ret === 0) {
        throw new AigisError(`you already have a data deletion scheduled. It will take place on ${cfg.purge_date.toDateString()}.`);
      }
      console.log(`Purge scheduled for ${guildId} on ${purgeDate.toDateString()}`);
      await interaction.editReply(`${ping} A purge deletion has been scheduled for ${purgeDate.toDateString()}.`);
    } catch (err) {
      if (err instanceof AigisError) {
        await interaction.editReply(`${interaction.user.displayName}-san! I'm sorry but I have encountered an issue while executing your command. The problem is ${err.message}`);
      } else {
        console.error(err);
        await interaction.editReply(`${interaction.user.displayName}-san... I do not know what happened. My programming indicated there was an issue but it is unknown to me. The issue is ${err.message}`)
      }
    }
  }
}