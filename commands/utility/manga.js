const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, hyperlink } = require("discord.js");
const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const config = require('../../config');
const ISO6391 = require('iso-639-1');
require('dotenv').config();
const { checkToken, getCoverArt, followManga, getTitle, getLanguage, listManga, unfollowManga, DEFAULT_IMAGE, stopMangaCronJob } = require('../../command_helpers/manga');

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
    )
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Stop the manga checks from occuring. Dev only.')
    ),
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const username = interaction.user.displayName;
      if (subcommand === 'help') { //help 
        let desc = `Here is some guidance on how to use the manga command ${username}-san.\n\n`;
        desc += `Below are the subcommands you can use. The "manga-id" is the internal ID for the manga that Mangadex uses. `
        desc += `You can get it by going to Mangadex and finding the manga you want to follow. `;
        desc += `The URL will be something like \`mangadex.org/title/6bf844c8-2ce4-401a-a761-3151042efe30\`, and the ID is the part after \`title/\`. You might find some more text after another slash, but disregard that.\n\n`;
        desc += `Also ${username}-san, the language option can be used to specify what language you want to follow the manga in. The default is English so this is optional. `
        desc += `You need to use the ${hyperlink('ISO 639-1 standard', '<https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes>')} for the language code. `;
        desc += `There are some exceptions listed on ${hyperlink('Mangadex\'s website', '<https://api/mangadex.org/docs/3-enumerations')}.`
        const embed = new EmbedBuilder()
          .setTitle('Manga Command Help')
          .setColor(config.EMBED_COLOR)
          .setDescription(desc)
          .setThumbnail('https://i.imgur.com/1lZnFBP.jpeg')
          .addFields(
            { name: '/manga help', value: 'This command showing all Manga commands' },
            { name: '/manga follow <manga-id> <language>', value: 'Follow a manga to get pinged for new chapter releases.' },
            { name: '/manga list', value: 'List all manga you are following.' },
            { name: '/manga unfollow <manga-id> <language>', value: 'Unfollow a manga to stop getting pinged for new chapter releases.' },
            { name: '/manga random <pornographic>', value: 'Get a random manga from Mangadex. Set the optional pornographic flag to true to include pronographic manga. By default it is false.' }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'follow') { //follow manga command
        //const token = await checkToken();
        const lang = interaction.options.getString('language') ?? 'en';
        if (!validateLanguage(lang)) {
          await interaction.editReply(`I'm sorry ${username}-san, the language code of ${interaction.options.getString('language')} is not valid.`);
          return;
        }
        try {
          const manga_id = interaction.options.getString('manga-id');
          const res = await axios.get(`https://api.mangadex.org/manga/${manga_id}`);
          const manga = res.data;
          if (manga.data.type !== 'manga') {
            const article = manga.data.type === 'user' || manga.data.type === 'artist' || manga.data.type === 'author' ? 'an' : 'a';
            await interaction.editReply(`${username}-san, the ID you provided is not for a manga but for ${article} ${manga.data.type}.`);
            return;
          }
          const manga_title = await followManga(manga_id, lang, manga.data, interaction.user.id);
          await interaction.editReply(`I have added you to the ping list for ${manga_title} in ${getLanguage(lang)} ${username}-san.`);
        } catch (err) {
          //error handle API responses
          if (!err.response || !err.response.status) {
            throw err;
          }
          if (err.response.status === 403) {
            console.error(err);
            throw new AigisError(`Mangadex has forbidden me from accessing this manga. I am not sure why. Ask Trashpanda-san to look at the logs.`)
          } else if (err.response.status === 404 || err.response.status === 400) {
            await interaction.editReply(`${username}-san, I could not find the manga with an ID of ${interaction.options.getString('manga-id')}, please make sure you are using the correct ID.`);
            return;
          } else {
            throw err;
          }
        }
      } else if (subcommand === 'list') { //list manga command
        let embed = await listManga(interaction.user.id);
        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'unfollow') { //unfollow command
        //const token = await checkToken();
        const lang = interaction.options.getString('language') ?? 'en';
        const validLang = validateLanguage(lang);
        if (!validLang) {
          await interaction.editReply(`I'm sorry ${username}-san, the language code of ${interaction.options.getString('language')} is not valid.`);
          return;
        }
        const result = await unfollowManga(interaction.options.getString('manga-id'), lang, interaction.user.id);
        if (result) {
          await interaction.editReply(`Alright ${username}-san, I have removed you from the ping list for ${result} in ${getLanguage(lang)}.`);
        } else {
          await interaction.editReply(`${username}-san, you do not appear to be following that manga in that language.`);
        }
      } else if (subcommand === 'random') { //random manga command
        const porn = interaction.options.getBoolean('pornographic') ?? false;
        let url = 'https://api.mangadex.org/manga/random';
        if (porn) {
          url += '?contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic';
        }
        const data = await axios.get(url);
        let art = null;
        let cover = null;
        if (data.data.data.attributes.contentRating !== 'pornographic') {
          cover = await getCoverArt(data.data.data.id, data.data.data.relationships.filter(rel => rel.type === 'cover_art')[0].id);
          art = Array.isArray(cover) ? cover[0] : cover; //if its an array AttachmentBuilder will be at cover[1]
        }
        const author_arr = data.data.data.relationships.filter(rel => rel.type === 'author');
        let author = 'No listed author';
        if (author_arr.length > 0) {
          author = await getMangaAuthor(author_arr[0].id);
        }
        let desc = data.data.data.attributes.description;
        if (desc.en && desc.en.length > 0) {
          desc = desc.en;
        } else if (Object.values(desc).length > 0 && Object.values(desc)[0].length > 0) {
          desc = Object.values(desc)[0];
        } else {
          desc = `There is no description for this manga.`;
        }
        console.info(`Random manga selected: ${data.data.data.id}`);
        const embed = new EmbedBuilder()
          .setTitle(getTitle(data.data.data.attributes))
          .setURL(`https://mangadex.org/title/${data.data.data.id}`)
          .setDescription(desc)
          .addFields(
            { name: 'Author', value: author },
            { name: 'Status', value: data.data.data.attributes.status },
            { name: 'Content Rating', value: data.data.data.attributes.contentRating })
          .setImage(art ?? DEFAULT_IMAGE) //if no image use default of aigis reading
          .setColor(config.EMBED_COLOR)
          .setFooter({ text: 'via Mangadex' })
          .setTimestamp();
        //attach image if needed
        if (Array.isArray(cover)) {
          //send AttachmentBuilder with attachment
          await interaction.editReply({ embeds: [embed], files: [cover[1]] });
        } else {
          await interaction.editReply({ embeds: [embed] });
        }
      } else if (subcommand === 'stop') {
        console.log(`ID ${interaction.user.id}`);
        console.log(`Owner ID ${process.env.OWNER_ID}`);
        console.log(`comparison using ==: ${interaction.user.id == process.env.OWNER_ID}`);
        if (interaction.user.id != process.env.OWNER_ID) {
          await interaction.editReply(`I'm sorry ${username}-san, but only developers can stop the manga checks.`);
          return;
        } else {
          stopMangaCronJob();
          await interaction.editReply(`I have stopped the manga checks.`);
        }
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

function validateLanguage(lang) {
  if (config.MANGADEX_ISO6391[lang]) {
    return true;
  } else {
    return ISO6391.validate(lang);
  }
}

async function getMangaAuthor(authorID) {
  //const token = await checkToken();
  const data = await axios.get(`https://api.mangadex.org/author/${authorID}`);
  return data.data.data.attributes.name;
}