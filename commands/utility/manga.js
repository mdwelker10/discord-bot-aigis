const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require('axios');
const db = require("../../database/db");
const AigisError = require('../../utils/AigisError');
const config = require('../../config');
const ISO6391 = require('iso-639-1');
const { checkToken, getCoverArt, getMangaAuthor } = require('../../command_helpers/manga');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manga')
    .setDescription("For getting pings about new manga releases.")
    .addSubcommand(sub =>
      sub.setName('help')
        .setDescription('Get help with how to use the manga command.')
    )
    .addSubcommand(sub =>
      sub.setName('follow')
        .setDescription('Follow a manga to get pinged for new releases.')
        .addStringOption(option =>
          option.setName('manga-id')
            .setDescription('The Mangadex ID of the manga to follow.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('language')
            .setDescription('The language for the manga using the ISO 639-1 standard. Default is en (English).')
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all manga you are following')
    )
    .addSubcommand(sub =>
      sub.setName('unfollow')
        .setDescription('Unfollow a manga to stop getting pinged for new releases.')
        .addStringOption(option =>
          option.setName('manga-id')
            .setDescription('The Mangadex ID of the manga to unfollow.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('language')
            .setDescription('The language you read the manga in using the ISO 639-1 standard. Default is English.')
        )
    )
    .addSubcommand(sub =>
      sub.setName('random')
        .setDescription('Get a random manga from Mangadex')
        .addBooleanOption(option =>
          option.setName('pornographic')
            .setDescription('Set to true to include pornographic manga. Default is false.')
        )
    ),
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const username = interaction.user.displayName;
      if (subcommand === 'help') { //help 
        await interaction.editReply(`I'm sorry ${username}-san, I am not programmed for that command yet.`);
      } else if (subcommand === 'follow') { //follow manga command
        //const token = await checkToken();
        const lang = processLanguage(interaction.options.getString('language') ?? 'en');
        if (!lang) {
          await interaction.editReply(`I'm sorry ${username}-san, the language code of ${interaction.options.getString('language')} is not valid.`);
          return;
        }
        await interaction.editReply(`I'm sorry ${username}-san, I am not programmed for that command yet.`);
      } else if (subcommand === 'list') { //list manga command
        await interaction.editReply(`I'm sorry ${username}-san, I am not programmed for that command yet.`);
      } else if (subcommand === 'unfollow') { //unfollow command
        //const token = await checkToken();
        const lang = processLanguage(interaction.options.getString('language') ?? 'en');
        if (!lang) {
          await interaction.editReply(`I'm sorry ${username}-san, the language code of ${interaction.options.getString('language')} is not valid.`);
          return;
        }
        await interaction.editReply(`I'm sorry ${username}-san, I am not programmed for that command yet.`);
      } else if (subcommand === 'random') { //random manga command
        const porn = interaction.options.getBoolean('pornographic') ?? false;
        let url = 'https://api.mangadex.org/manga/random';
        if (porn) {
          url += '?contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic';
        }
        const data = await axios.get(url);
        const art = await getCoverArt(data.data.data.id, data.data.data.relationships.filter(rel => rel.type === 'cover_art')[0].id);
        const author = await getMangaAuthor(data.data.data.relationships.filter(rel => rel.type === 'author')[0].id);
        let desc = data.data.data.attributes.description.en;
        if (!desc || desc == '') {
          desc = `There is no English description for this manga.\n${Object.values(data.data.data.attributes.description)[0]}`;
        }
        const embed = new EmbedBuilder()
          .setTitle(data.data.data.attributes.title['en'] ?? data.data.data.attributes.altTitles['en'] ?? Object.values(data.data.data.attributes.title)[0])
          .setURL(`https://mangadex.org/title/${data.data.data.id}`)
          .setDescription(desc)
          .addFields(
            { name: 'Author', value: author, inline: true },
            { name: 'Status', value: data.data.data.attributes.status, inline: true },
            { name: 'Content Rating', value: data.data.data.attributes.contentRating, inline: true })
          .setImage(art)
          .setColor(config.EMBED_COLOR)
          .setFooter({ text: 'via Mangadex' })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply(`I'm sorry ${username}-san, I do not recognize the command you gave me.`);
      }
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

function processLanguage(lang) {
  if (config.MANGADEX_ISO6391[lang]) {
    return lang;
  } else if (ISO6391.validate(lang)) {
    return ISO6391.getCode(lang);
  } else {
    return false;
  }
}