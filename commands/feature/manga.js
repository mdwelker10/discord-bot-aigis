/*
 * TO ADD A NEW WEBSITE TO THE MANGA COMMAND:
 * 1. Add a new case to the parseID function
 * 2. Copy the command_helpers/manga/manga-template.js file to a new file and complete all functions
 * 3. Add a new field entry to the idhelp command
 * 4. Add a new field entry to the ratinghelp command
 * 5. Add a new entry in the websites object in this file and the command_helpers/manga/manga.js file
 */
const { SlashCommandBuilder, EmbedBuilder, hyperlink } = require("discord.js");
const axios = require('axios');
const AigisError = require('../../utils/AigisError');
const config = require('../../config');
const ISO6391 = require('iso-639-1');
const { listManga, unfollowManga, getLanguage } = require('../../command_helpers/manga/manga');
const { stopMangaCronJob } = require('../../command_helpers/cronjobs');
const { getGuildConfig, isDeveloper } = require('../../utils/utils');
const Mangadex = require('../../command_helpers/manga/mangadex');

const websites = {
  mangadex: Mangadex,
  mangapill: require('../../command_helpers/manga/mangapill'),
  mangakakalot: require('../../command_helpers/manga/mangakakalot'),
  manganato: require('../../command_helpers/manga/manganato'),
  mangaplus: require('../../command_helpers/manga/mangaplus')
}

/** Array of websites that takes an ISO language to determine the language of the manga  */
takesLanguage = ['mangadex'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manga')
    .setDescription("For getting pings about new manga releases.")
    .addSubcommand(sub =>
      sub.setName('help')
        .setDescription('Get help with how to use the manga command.')
    )
    .addSubcommand(sub =>
      sub.setName('idhelp')
        .setDescription('Get help with how to get a manga ID from a supported website.')
    )
    .addSubcommand(sub =>
      sub.setName('ratinghelp')
        .setDescription("Get help understanding how a manga's content rating affects this command's functionality.")
    )
    .addSubcommand(sub =>
      sub.setName('follow')
        .setDescription('Follow a manga to get pinged for new releases.')
        .addStringOption(option =>
          option.setName('manga-id')
            .setDescription('The identifier of the manga to follow.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('language')
            .setDescription('The language for the manga using ISO 639-1 standard. Default is English, Mangadex only.')
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
            .setDescription('The identifier of the manga to unfollow.')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('language')
            .setDescription('The language for the manga using the ISO 639-1 standard. Default is English, Mangadex Only.')
        )
    )
    .addSubcommand(sub =>
      sub.setName('random')
        .setDescription('Get a random manga from Mangadex')
        .addStringOption(option =>
          option.setName('tag-1')
            .setDescription('Optional tag to filter the random manga by.')
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName('tag-2')
            .setDescription('Optional tag to filter the random manga by.')
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName('tag-3')
            .setDescription('Optional tag to filter the random manga by.')
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Stop the manga checks from occuring. Dev only.')
    ),
  //autocomplete for tags
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices = Object.keys(config.MANGADEX_TAGS);
    const filteredChoices = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
    if (filteredChoices.length > 25) {
      filteredChoices.length = 25; //25 is the most amount of choices allowed
    }
    await interaction.respond(filteredChoices.map(choice => ({ name: choice, value: config.MANGADEX_TAGS[choice] })));
  },
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const username = interaction.user.displayName;
      if (subcommand === 'help') { //help 
        let desc = `Here is some guidance on how to use the manga command ${username}-san.\n\n`;
        desc += `Below are the subcommands you can use. The "manga-id" is the internal ID for the manga that the website uses. `;
        desc += `For help identifying the manga ID, and for a list of supported manga websites, please use the command \`/manga idhelp\`.\n\n`;
        desc += `Also ${username}-san, the language option can be used to specify what language you want to follow the manga in, however this feature is only available for Mangadex. The default is English so this is optional. `;
        desc += `To specify a language, you need to use the ${hyperlink('ISO 639-1 standard', '<https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes>')} for the language code, `;
        desc += `there are also some exceptions listed on ${hyperlink("Mangadex's website", '<https://api.mangadex.org/docs/3-enumerations/')}.\n\n`;
        desc += `If you wish to follow explicit manga that is pornographic or 18+ content, the channel which does manga chapter ping releases must be marked as "age restricted". `;
        desc += `This is to ensure that the content is only seen by those who wish to see it, and to comply with Discord's Terms of Service.`;
        desc += `For more information, please use \`/manga ratinghelp\`.`;
        //string for random command description is very long
        let rand = `Get a random manga from Mangadex with the option to filter by 3 tags using OR logic. To see valid tags visit ${hyperlink("Mangadex's website", '<https://mangadex.org/tag>')}.`;
        const embed = new EmbedBuilder()
          .setTitle('Manga Command Help')
          .setColor(config.EMBED_COLOR)
          .setDescription(desc)
          .setThumbnail(config.AIGIS_YUKATA_IMAGE)
          .addFields(
            { name: '/manga help', value: 'This command showing all Manga commands.' },
            { name: '/manga idhelp', value: 'Get help on how to find the ID for a manga on supported websites.' },
            { name: '/manga follow <manga-id> <language>', value: 'Follow a manga to get pinged for new chapter releases.' },
            { name: '/manga list', value: 'List all manga you are following.' },
            { name: '/manga unfollow <manga-id> <language>', value: 'Unfollow a manga to stop getting pinged for new chapter releases.' },
            { name: '/manga random <tag-1> <tag-2> <tag-3>', value: rand }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'idhelp') { //idhelp command
        //build strings for descriptions 
        let desc = `A Manga's ID is a unique identifier used by each website to identify a manga. Below is a guide on how to retrieve the ID for a manga on each supported website. `;
        desc += `When you provide an ID for me, I will parse it to figure out which website it belongs to automatically, so you do not need to worry about that. `;
        const embed = new EmbedBuilder()
          .setTitle('Manga ID Help')
          .setColor(config.EMBED_COLOR)
          .setDescription(desc)
          .setThumbnail(config.AIGIS_YUKATA_IMAGE)
          .addFields(
            { name: 'Mangadex', value: websites['mangadex'].getIdHelpString() },
            { name: 'Mangapill', value: websites['mangapill'].getIdHelpString() },
            { name: 'Mangakakalot', value: websites['mangakakalot'].getIdHelpString() },
            { name: 'Manganato', value: websites['manganato'].getIdHelpString() },
            { name: 'Mangaplus', value: websites['mangaplus'].getIdHelpString() }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'ratinghelp') { //ratinghelp command
        //build strings for descriptions 
        let desc = `The following message is from my developer ${username}-san: \n\n`
        desc += "To comply with Discord's Terms of Service, manga with age restricted content can only be followed if the manga release channel is marked as age restricted. ";
        desc += "This channel is where manga chapter pings will occur, and is determined during the `/setup` command. If one is not provided, the default bot channel is used.\n\n";
        desc += "If the channel was marked as age restricted when you followed an 18+ manga and later lost it's age restricted status, you will receive a ping notifying you of this during the next chapter release. ";
        desc += "Due to how manga IDs are collected and the possibility of a NSFW title, the manga itself will not be specified and no links to chapters or the manga will be shared. However, the chapter number will be shown. ";
        desc += "If this happens, pings notifying you of chapter releases will continue unless you unfollow the manga, but the manga itself will not be specified. ";
        desc += "If a moderator marks the channel as age restricted again, pings will resume as normal.\n\n";
        desc += "For the purpose of this command, age restricted manga is defined as a manga featuring pornographic material, such as uncensored nudity/sexual content. In general, Mangadex's rating system can be applied. ";
        desc += "Manga with suggestive or erotica content will not be restricted as this is more akin to PG-13 content, and Discord requires users to be 13 years old to use the platform. ";
        desc += "Also, some websites do not provide a way to programatically determine the content rating of a manga. ";
        desc += "If this is the case, and the website actually serves explicit manga, then all manga will be assumed to be NSFW, and the rules above will apply even if the manga itself is not explicit. ";
        desc += "Below is a list of supported websites, and whether or not the content rating can be determined programatically.\n\n";
        const embed = new EmbedBuilder()
          .setTitle('Manga ID Help')
          .setColor(config.EMBED_COLOR)
          .setDescription(desc)
          .setThumbnail(config.AIGIS_YUKATA_IMAGE)
          .addFields(
            { name: 'Mangadex', value: "Content rating can be determined." },
            { name: 'Mangapill', value: "Does not have 18+ Manga." },
            { name: 'Mangakakalot', value: "Content rating cannot be determined." },
            { name: 'Manganato', value: "Content rating cannot be determined." },
            { name: 'Mangaplus', value: "Does not have 18+ Manga." }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'follow') { //follow manga command
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          await interaction.editReply(`I'm sorry ${username}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command.`);
          return;
        }
        //parse the ID and check with the corresponding website if the ID is valid
        try {
          const manga_id = interaction.options.getString('manga-id');
          const website = parseID(manga_id);
          //ID not valid for any website
          if (!website) {
            await interaction.editReply(`${username}-san, the ID you provided is not valid. Please see the /manga idhelp command for guidance on getting the correct ID.`);
            return;
          }
          if (takesLanguage.includes(website)) { //if a language check is required
            //validate language
            const lang = interaction.options.getString('language') ?? 'en';
            if (!validateLanguage(lang)) {
              await interaction.editReply(`I'm sorry ${username}-san, the language code of ${interaction.options.getString('language')} is not valid.`);
              return;
            }
            const title = await websites[website].followManga(manga_id, interaction.user.id, interaction.guild, lang);
            await interaction.editReply(`I have added you to the ping list for ${title} in ${getLanguage(lang)} on ${websites[website].NAME} ${username}-san.`);
          } else {
            //dynamically call other website functions
            const title = await websites[website].followManga(manga_id, interaction.user.id, interaction.guild);
            await interaction.editReply(`I have added you to the ping list for ${title} on ${websites[website].NAME} ${username}-san.`);
          }
        } catch (err) {
          //error handle API responses
          if (!err.response || !err.response.status) {
            throw err;
          }
          if (err.response.status === 403) {
            console.error(err);
            throw new AigisError(`I am forbidden from accessing this manga. I am not sure why. Ask a developer to look at my logs.`)
          } else if (err.response.status === 404 || err.response.status === 400) {
            await interaction.editReply(`${username}-san, I could not find the manga with an ID of ${interaction.options.getString('manga-id')}, please make sure you are using the correct ID.`);
            return;
          } else {
            throw err;
          }
        }
      } else if (subcommand === 'list') { //list manga command
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          await interaction.editReply(`I'm sorry ${username}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command.`);
          return;
        }
        let embed = await listManga(interaction.guildId, interaction.user.id);
        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'unfollow') { //unfollow command
        const cfg = await getGuildConfig(interaction.guildId);
        if (!cfg) {
          await interaction.editReply(`I'm sorry ${username}-san, I was unable to retrieve the configuration for this server. Please have somone with the "manage server" permission execute the \`/setup\` command.`);
          return;
        }
        const lang = interaction.options.getString('language') ?? 'en';
        const validLang = validateLanguage(lang);
        if (!validLang) {
          await interaction.editReply(`I'm sorry ${username}-san, the language code of ${interaction.options.getString('language')} is not valid.`);
          return;
        }
        const result = await unfollowManga(interaction.guildId, interaction.options.getString('manga-id'), interaction.user.id, lang);
        if (result) {
          await interaction.editReply(`Alright ${username}-san, I have removed you from the ping list for ${result}.`);
        } else {
          await interaction.editReply(`${username}-san, you do not appear to be following that manga.`);
        }
      } else if (subcommand === 'random') { //random manga command
        let url = 'https://api.mangadex.org/manga/random?includedTagsMode=OR';
        //handle tags
        const tag1 = interaction.options.getString('tag-1') ?? false;
        const tag2 = interaction.options.getString('tag-2') ?? false;
        const tag3 = interaction.options.getString('tag-3') ?? false;
        let tagsUsed = []; //for later logging
        for (const tag of [tag1, tag2, tag3]) {
          if (tag && !tagsUsed.includes(tag) && Object.values(config.MANGADEX_TAGS).includes(tag)) {
            tagsUsed.push(tag);
            console.log(`Tag: ${tag}`);
            url += `&includedTags[]=${tag}`;
          }
        }
        let data;
        try {
          data = await axios.get(url);
        } catch (err) {
          console.error(err);
          if (err.response.status) {
            throw new AigisError(`I'm sorry ${username}-san, I asked Mangadex for a manga and they gave me an error. The code was ${err.response.status}. Please tell a developer to check my logs.`);
          }
          throw new AigisError(`I'm sorry ${username}-san, I could not get a random manga. There was a problem connecting to Mangadex. You can try again at a later time.`);
        }
        // In case there is no ID somehow. It apprently happened once
        const manga = data.data.data;
        if (!manga.id) {
          console.log(`Manga with no ID found: ${JSON.stringify(manga)}`);
          throw new AigisError(`I'm sorry ${username}-san, the manga I received has no ID and I cannot do anything with it. Please try again and maybe "the RNG gods will smile upon us", as they say.`);
        }
        let art = null;
        let cover = null;
        cover = await Mangadex.getCoverArt(manga.id, manga.relationships.filter(rel => rel.type === 'cover_art')[0].id);
        art = Array.isArray(cover) ? cover[0] : cover; //if its an array AttachmentBuilder will be at cover[1]
        const author_arr = manga.relationships.filter(rel => rel.type === 'author');
        let author = 'No listed author';
        if (author_arr.length > 0) {
          author = await Mangadex.getMangaAuthor(author_arr[0].id);
        }
        let desc = manga.attributes.description;
        if (desc.en && desc.en.length > 0) {
          desc = desc.en;
        } else if (Object.values(desc).length > 0 && Object.values(desc)[0].length > 0) {
          desc = Object.values(desc)[0];
        } else {
          desc = `There is no description for this manga.`;
        }
        console.info(`Random manga selected: ${manga.id}. Tags used: ${tagsUsed.join(', ')}`);
        const title = manga.attributes.title[manga.lang] ?? manga.attributes.altTitles[manga.lang] ?? Object.values(manga.attributes.title)[0]
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setURL(`https://mangadex.org/title/${manga.id}`)
          .setDescription(desc)
          .addFields(
            { name: 'Author', value: author },
            { name: 'Status', value: manga.attributes.status },
            { name: 'Content Rating', value: manga.attributes.contentRating })
          .setImage(art ?? config.DEFAULT_MANGA_IMAGE) //if no image use default of aigis reading
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
        if (isDeveloper(interaction.user.id)) {
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

function parseID(id) {
  //mangadex
  if (id.split('-').length === 5) {
    return 'mangadex';
  }
  //mangapill
  if (id.split('/').length === 2) {
    return 'mangapill';
  }
  //mangakakalot
  if (id.includes('kakalot') && id.split('kakalot-').length === 2) {
    return 'mangakakalot';
  }
  //manganato
  if (id.includes('nato') && id.split('nato-').length === 2) {
    return 'manganato';
  }
  //mangaplus
  if (id.length === 6 && !isNaN(id)) {
    return 'mangaplus';
  }
  return null;
}