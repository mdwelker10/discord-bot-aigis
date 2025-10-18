const { exec } = require("child_process");
const { SlashCommandBuilder, EmbedBuilder, hyperlink, time } = require("discord.js");
const { promisify } = require("util");
const AigisError = require("../../utils/AigisError");
const config = require("../../utils/config");
const { cleanDownloads } = require("../../utils/utils");
const crypto = require("crypto");
const { DateTime } = require("luxon");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('download')
    .setDescription('Download a video from various different websites')
    .addSubcommand(sub =>
      sub.setName("help")
        .setDescription("Get help on how to use the download command.")
    )
    .addSubcommand(sub =>
      sub.setName("video")
        .setDescription("Download a video from a URL.")
        .addStringOption(option =>
          option.setName("url")
            .setDescription("The URL of the video to download.")
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName("ext")
            .setDescription("The file extension to use for the downloaded video. Default is mp4 for video, mp3 for audio.")
            .setRequired(false)
            .addChoices(
              { name: "mp4", value: "mp4_v" },
              { name: "mp3", value: "mp3_a" },
              { name: "mov", value: "mov_v" },
              { name: "mkv", value: "mkv_v" },
              { name: "webm", value: "webm_v" },
              { name: "flv", value: "flv_v" },
              { name: "m4a", value: "m4a_a" },
              { name: "ogg", value: "ogg_a" },
              { name: "opus", value: "opus_a" }
            )
        )
        .addBooleanOption(option =>
          option.setName("audio-only")
            .setDescription("Whether to only extract audio from the video.")
            .setRequired(false)
        )
    ),
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const username = interaction.user.displayName;
      const estMidnight = DateTime.now().setZone("America/New_York").startOf("day");
      if (subcommand === "help") { //help command
        let desc = `Here is some guidance on how to use the download command ${username}-san. It is much easier than finding an advertisement filled website to use.\n\n`;
        desc += `The command simply uses ${hyperlink("yt-dlp", 'https://github.com/yt-dlp/yt-dlp')} to download the video from the URL provided. It supports many kinds of files `;
        desc += `but for the moment, my focus is on video and audio files. Also, yt-dlp supports many websites, if you are curious which websites are supported, you can find a list ${hyperlink("here", 'https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md')}. `
        desc += `Also, I can download multiple files from one link just like yt-dlp, but they will all be given the same extension.\n\n`;
        desc += `Something important to note is that since this command exposes files stored on my system directly to the internet, I have taken some security precautions. The main one being requiring Discord authentication to access the files. `;
        desc += `The permissions I ask for are minimal and include basic information like your username, display name, profile picture, and other similar surface level information for identification. This is for logging purposes to combat spam and unauthorized access to my file system. `;
        desc += `You can always review my source code on ${hyperlink("GitHub", 'https://github.com/mdwelker10/discord-bot-aigis')} if you want to see how I work and manage your data.\n\n`;
        desc += `The command syntax is \`/download video <url> <ext> <audio-only>\`. Only \`download video\` is available at the moment, but it should work on audio-only files too. The fields for the command are explained below:`;
        const embed = new EmbedBuilder()
          .setColor(config.get('EMBED_COLOR'))
          .setTitle('Download Help')
          .setDescription(desc)
          .setThumbnail(config.get('AIGIS_EPISODE_AIGIS_IMAGE'))
          .addFields(
            { name: 'url', value: 'The URL of the video(s) or audio(s) to download. This is required.' },
            { name: 'ext', value: 'The file extension to use for the downloaded video. This is optional as the default is mp4 for video, mp3 for audio. Supported extensions for video are mp4, mov, mkv, webm, and flv. Supported extensions for audio are mp3, m4a, ogg, and opus.' },
            { name: 'audio-only', value: 'Whether to only extract audio from the video. This is optional as the default is false. Note that by using this option with an audio extension, you can download audio files or the audio from video files.' }
          )
          .setTimestamp();
        return await interaction.editReply({ embeds: [embed] });
      } else { //video download command
        const audioOnly = interaction.options.getBoolean("audio-only") ?? false;
        const url = interaction.options.getString("url");
        let ext = interaction.options.getString("ext") ?? audioOnly ? "mp3_a" : "mp4_v";
        //check extension can be used for video/audio
        if (audioOnly && ext.split("_")[1] != "a") {
          return await interaction.editReply(`${username}-san, you have indicated to extract audio, but have provided a video extension. Please specify whether you want a video or audio.`);
        } else if (!audioOnly && ext.split("_")[1] != "v") {
          return await interaction.editReply(`${username}-san, you have indicated to extract video, but have provided an audio extension. Please specify whether you want a video or audio.`);
        }
        ext = ext.split("_")[0];
        const files = await downloadFiles(url, audioOnly, ext);
        const fileLinks = getFileLinks(files);
        //get file deletion time (next midnight EST)
        let now = DateTime.now().setZone("America/New_York");
        let nextMidnight = now.plus({ days: 1 }).startOf("day");
        const deleteTime = nextMidnight.toJSDate();
        //create embed return
        const plural = files.length > 1 ? "s" : "";
        let desc = `Thank you for waiting ${username}-san, your file${plural} are ready to be downloaded. You can access ${plural ? "them" : "it"} at the link${plural} below. `
        desc += `Please keep in mind that the file${plural} will be deleted at ${time(deleteTime)}.\n\n`;
        for (const [idx, f] of fileLinks.entries()) {
          desc += `- ${hyperlink(`File ${idx + 1}`, f)}\n`;
        }
        const embed = new EmbedBuilder()
          .setTitle('File Download Links')
          .setColor(config.get('EMBED_COLOR'))
          .setThumbnail(config.get('AIGIS_EPISODE_AIGIS_IMAGE'))
          .setDescription(desc)
          .setFooter({
            text: 'Files downloaded by yt-dlp',
            iconURL: 'https://i.imgur.com/O7ztHse.png'
          })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      const user = interaction.user.displayName;
      if (err instanceof AigisError) {
        await interaction.editReply(`${user}-san! I'm sorry but I have encountered an issue while executing your command. The problem is ${err.message}`);
      } else {
        console.error(err);
        await interaction.editReply(`${user}-san... I do not know what happened. My programming indicated there was an issue but it is unknown to me. The issue is ${err.message}`)
      }
    }
  }
}

//returns array of file names
async function downloadFiles(url, audioOnly, ext) {
  try {
    const execPromise = promisify(exec);
    const filename = crypto.randomBytes(16).toString('hex');
    cleanDownloads();
    let command = '';
    if (audioOnly) {
      command = `yt-dlp -x --audio-format ${ext} -o "${config.get('DOWNLOAD_PATH')}/${filename}_%(autonumber)s_audio.%(ext)s" --print after_move:filename --max-filesize 2G "${url}"`
    } else {
      command = `yt-dlp --merge-output-format ${ext} -o "${config.get('DOWNLOAD_PATH')}/${filename}%(autonumber)s_video.%(ext)s" --print after_move:filename --max-filesize 2G "${url}"`
    }
    const { stdout } = await execPromise(command);
    let files = stdout.trim().split("\n");
    files.forEach((f, idx) => {
      files[idx] = f.split("downloads/")[1];
    });
    return files;
  } catch (err) {
    console.error(err);
    throw new AigisError(`There was an error downloading the video. This means the website might not be supported, might have changed how they embed videos, or there was no video to download, among other options. Please double check the URL and try again.`);
  }
}

function getFileLinks(files) {
  return files.map((file) => {
    return `${config.get('DOMAIN')}/downloads/${file}`;
  });
}