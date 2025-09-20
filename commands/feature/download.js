const { exec } = require("child_process");
const { SlashCommandBuilder } = require("discord.js");
const { promisify } = require("util");
const AigisError = require("../../utils/AigisError");
const config = require("../../config");
const crypto = require("crypto");

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
      if (subcommand === "help") { //help command
        return await interaction.editReply("help command");
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
        const files = await downloadVideo(url, audioOnly, ext);
        return await interaction.editReply(`${username}-san, the following files have been downloaded: ${files.map(file => `\`${file}\``).join(", ")}`);
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

async function downloadVideo(url, audioOnly, ext) {
  try {
    const execPromise = promisify(exec);
    const filename = crypto.randomBytes(16).toString('hex');
    let command = '';
    if (audioOnly) {
      command = `yt-dlp -x --audio-format ${ext} -o "downloads/${filename}_%(autonumber)s_audio.%(ext)s --print after_move:filename "${url}"`
    } else {
      command = `yt-dlp --merge-output-format ${ext} -o "downloads/${filename}%(autonumber)s_video.%(ext)s" --print after_move:filename "${url}"`
    }
    const { stdout } = await execPromise(command);
    const files = stdout.trim().split("\n");
    return files;
  } catch (err) {
    console.error(err);
    throw new AigisError(`There was an error downloading the video. This means the website might not be supported, might have changed how they embed videos, or there was no video to download, among other options. Please double check the URL and try again.`);
  }
}