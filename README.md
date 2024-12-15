<!-- omit in toc -->
# Aigis
A multi-purpose Discord bot I made for fun because I like programming and I like Persona. She just does a bunch of silly things I thought would be neat to implement and perhaps useful too. And yes, Aigis will address you with the "-san" honorific.
<br>
<br>
You can join [the "official" Aigis Discord support server](https://discord.gg/CQyQYXBtca) for questions or feature requests. If you want to hang out and have more casual chats you can also join [another discord server](https://discord.com/invite/hpyeSZ4XCU) I am more active in. That is where I use Aigis' functionality.
<br>
<br>
Aigis is a [shape](https://wiki.shapes.inc/), and thus has AI functionality. To get more information about shapes, join the [Shapes.inc Discord server](https://discord.gg/shapes). To get more information about Aigis' specific AI configurations, check out the documentation for it [here](https://github.com/mdwelker10/discord-bot-aigis/blob/main/README-AI.md).
<br>
<br>
To get information on what data Aigis stores, and how to remove your server's data from her database, check out the documentation for the [purge command](https://github.com/mdwelker10/discord-bot-aigis/blob/main/README-Purge.md).

<!-- omit in toc -->
## Quick Links

- [Setup](#setup)
- [Enabling and Disabling Commands](#enabling-and-disabling-commands)
  - [Command Reference](#command-reference)
- [Basic Commands](#basic-commands)
- [Remindme Command](#remindme-command)
- [Song of the Day Command (SOTD)](#song-of-the-day-command-sotd)
  - [Playlist IDs](#playlist-ids)
  - [Command Reference](#command-reference-1)
- [Manga Command](#manga-command)
  - [Manga IDs](#manga-ids)
  - [ISO Language Standard](#iso-language-standard)
  - [Random Manga](#random-manga)
  - [Command Reference](#command-reference-2)


## Setup

To invite Aigis to your server, use [this link](https://discord.com/oauth2/authorize?client_id=1241558106396168192&permissions=563364418149440&integration_type=0&scope=bot+applications.commands).

The first thing to do when Aigis joins would be to run the `/setup` command. This command helps configure Aigis' core features for the server. The person running `/setup` needs "manage server" permissions. If they can invite Aigis, they can run `/setup`.

To properly execute `/setup`, the person doing it should have [developer mode enabled to get channel and role IDs](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID)

The setup screen will have 3 input boxes.
1. **A role ID to allow a user to run privileged bot commands. There are not many of these at the moment.**
   - Being the server owner does not mean you are exempt from needing the role. The server owner should also have this role.
   - This does not include administrative commands like `setup` and `purge`. For those, the user needs "manage server" permissions. This role is used for Aigis' feature configuration.
   - To allow everyone in the server to run privileged bot commands, put "everyone" for the role ID.
   - This might be removed if it is decided that only separating "manager server" permissions from everyone else makes more sense.
2. **A default channel ID for Aigis to send messages in**
   - This does not force her to send all messages in this channel, but messages that are not responses to commands will automatically go there. This could be your dedicated bot channel other bots use.
3. **A list of commands with channel IDs for them to use**
   - Core features of Aigis might want to have their own dedicated channels, since they can be announcement-esque features. Think of this as being an override for the default channel ID for this specific command.
   - The format should be `<command>:<Channel ID>` with one per line.
   - This works for the `manga` and `sotd` (Song of the Day) commands.
   - If a command is not included, its channel will be set as the default channel you provided above.

These settings can all be changed later by running `/setup` again with the `force` option set to `True`. The pop up will only be valid for 90 seconds, so I suggest copying the IDs somewhere beforehand for easy access.

>Sometimes Aigis will respond twice when you run `/setup`, especially if you closed the pop-up and ran the command again. If you receive a successful response then you can ignore any error responses.

<p align="center">
<img src="attachments/setup.png" alt="Aigis setup pop up" width="350"/>
</p>

## Enabling and Disabling Commands
Aigis comes with the ability to customize which commands are enabled and disabled on your server. This was added due to the fact that Aigis is a [shape](https://wiki.shapes.inc/), and some people might only want her for that functionality. Others might only want the manga functionality, etc.
- This functionality is locked behind "manage server" permissions. 
- This command also requires that `/setup` has been run successfully.
- Administrative commands (this command, setup, purge) cannot be disabled.
- Subcommands cannot be individually disabled, so you cannot disable `/manga follow` while keeping `/manga random` enabled for example.
- All commands are enabled by default

To disable a command, run `/command disable <command-name>`, and to enable it again, run `/command enable <command-name>`. If you wish to enable/disable all commands, use `all` as the command name. If a command that has scheduled pings, such as `manga` or `remindme` is disabled, scheduled pings are not stopped. If you would like to stop the scheduled pings.
- The command name is what you would put after the forward slash when typing a command. Valid names include `manga`, `echo`, and `sotd` for example.
- If you would like to stop scheduled pings, you have 3 options:
  - Ask users to run commands such as `/sotd playlist remove` or `/manga unfollow` to get rid of any pings that would happen.
  - Start a data purge, which will stop all pings in 7 days and remove all data Aigis has saved about your server. This cannot be done with specific commands (cannot purge only manga information for example). After 7 days all data will be removed and the `/setup` command will need to be run again. For more information see the [purge command documentation](https://github.com/mdwelker10/discord-bot-aigis/blob/main/README-Purge.md).
  - Make a forum post on the support server with the `Data Deletion` tag describing why the two options above will not work, and I will manually remove the data. If this happens enough I will look into implementing command-based data deletion.

To see all Aigis commands, and whether they are enabled or disabled on your server, run `/command list`. This functionality and `/command help`, are not locked behind manage server permissions.
- Administrative commands are not shown on this list since they are always enabled.

### Command Reference
- `/command help` - Get more information on enabling/disabling commands, similar to the documentation.
- `/command list <datastore>` - Get a list of all non-admin Aigis commands. Optionally, set `datastore` to true to only list commands that store data.
- `/command enable <command-name>` - Enable an Aigis command on the server. Use command name "all" to enable all non-admin commands.
- `/command disable <command-name>` - Disable an Aigis command on the server. Use command name "all" to disable all non-admin commands.

## Basic Commands

Aigis has a few basic commands summarized below:
- `/echo <message>` - Repeats the message back to you
- `/ping` - Get Aigis' roundtrip latency
- `/user` - Get information about yourself

## Remindme Command

You can set reminders with Aigis using the `/remindme` command, and she will ping you when it is time. The reminder is set for a certain amount of time in the future, not at a specific date.
- The full syntax of the command is `/remindme <time> <message>`
- The valid units of time to set reminders for are days, hours, and minutes. There is no limitations on what numbers to use for these (you could set a reminder for 200 hours for example).

Some valid examples of `/remindme` are:
- `/remindme 1d Today is a new day`
- `/remindme 32d Today is a new month`
- `/remindme 7h30m Wake up Makoto-san`
- `/remindme 5d100m What a weird time interval`
- `/remindme 5m Hey <@365986896733536278>! Aigis can ping with reminders!`

## Song of the Day Command (SOTD)
One of Aigis' core features is that she can choose a "Song of the Day". This works by using Spotify's API to add playlists to select from. Aigis will shuffle through the playlists and select random song from one each day at 12:00 AM EST.

The announcement for what song is chosen to be the Song of the Day will happen in the channel set using `sotd:<channel ID>` in the `/setup` command or the default bot channel if one is not specified. There is no `@everyone`, `@here`, or role ping for this, just a message.

There are a few restrictions on what playlists can be chosen:
1. The playlist **MUST** be a Spotify playlist, no other platforms are supported.
2. The playlist must be public.
3. The playlist must have at least 35 songs. This is to promote diversity in what songs are chosen. Aigis will not check for duplicate song entries though. If a playlist has 35 songs, is added, and then songs are removed to make it less than 35 songs, the playlist will be removed from rotation. 

**NOTE:** Adding and removing a playlist from the Song of the Day list are currently **privileged commands**. That is, only users with the role ID set in `/setup` can execute them. This is to prevent random people in the server from tampering with the rotation.
- These are currently the only privileged commands Aigis has

### Playlist IDs
To identify playlists, Spotify has an internal ID system. That is how playlists need to be referred to when using them in commands. To get a playlist's ID, copy the link as if you were going to share it. The link should be something like:

`https://open.spotify.com/playlist/1F0UF9B5AWMy6YzpQx34dV?si=279ffe2755f641e9`

In the above link, the playlist ID is `1F0UF9B5AWMy6YzpQx34dV`. The ID will always be after `playlist/` and before `?`.

### Command Reference
The following menu can be brought up by Aigis, along with the explanation of playlist IDs, via the `/sotd help` command.

- `/sotd add-playlist <playlist-id>` - Add a playlist to the list of playlists to select from for Song of the Day. Playlist must have at least 35 songs.
- `/sotd remove-playlist <playlist-id>` - Remove a playlist from the list of playlists to select from for Song of the Day.
- `/sotd list-playlists` - List all the playlists that are currently in the list of playlists to select from for Song of the Day.
- `/sotd select` - Manually select a song for Song of the Day. Used only for testing purposes and currently disabled on non-dev environments.
- `/sotd stop` - Stop the Song of the Day selection for all servers. Bot developer only.

## Manga Command
Aigis can also interact with various manga websites to retrive information about manga. This feature is mainly used to track manga releases and receive pings when a new chapter is uploaded.
- Aigis checks for updates once every hour. This could change in the future.
- Aigis can check the following websites for manga updates:
  - [Mangadex](https://mangadex.org)
  - [Mangapill](https://mangapill.com)
  - [Mangakakalot](https://mangakakalot.com)
  - [Manganato](https://manganato.com)

The announcement for manga chapter releases will happen in the channel set using `manga:<channel ID>` in the `/setup` command, or the default bot channel if one is not specified.

Since the manga command is implemented on a user basis instead of a server basis like Song of the Day, there are no privileged subcommands.

### Manga IDs
Similar to how Spotify uses playlist IDs to identify playlists, manga websites use manga IDs to identify manga. Getting the ID of a manga is different depending on the website, and some websites do not use IDs unique enough to differentiate them from other websites based on ID alone.

The `/manga idhelp` command should be the go-to documentation for how to retrive the ID of a manga for a website. If a website is not listed, then it is not supported. If you need futher clarification on getting the manga ID right, or need help, open an issue or message me on Discord.

If you would like to request a manga website to be supported, you can create an issue, message me on discord, or code it yourself and create a pull request (I need to set the repository up to allow pull requests from forks so if you code it for now just message me).

Instructions for adding a new manga are in [the main Manga command file](https://github.com/mdwelker10/discord-bot-aigis/blob/978d12fee44197e76a01ff09af9e67a50baec33c/commands/feature/manga.js), but most of the process is filling out the functions defined in the [Manga Template file](https://github.com/mdwelker10/discord-bot-aigis/blob/main/command_helpers/manga/manga-template.js).

### ISO Language Standard
When following a manga, you can specify what language you want to follow the manga in using the correlating [ISO 639 language code](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes). The language parameter is optional and will default to English if not included. Note that there is no check to determine if any chapter releases contain the specified language (or if there are even any chapter releases at all for that matter).

This feature is not available for every manga website. If you follow a manga on a website that does not support language variants, then the language parameter is ignored even if you provide it. The websites below support language variants:
- Mangadex

It is worth mentioning that Mangadex has some codes not defined by the standard that can be found [here](https://api.mangadex.org/docs/3-enumerations/). These are mostly language variants (like Latin-American Spanish) or Romanized languages (like Romanized Japanese).

### Random Manga
Unrelated to the following of manga, Aigis can also grab a random manga from Mangadex. This can be a fun way to pass time seeing the different kinds of manga and stories there are. The syntax of the random manga command is:

`/manga random <tag> <tag> <tag> <pornographic>`

- The `pornographic` field is an optional boolean to determine whether to include pornographic manga in the query to Mangadex for a random manga. It is `False` by default. If it is set to `True` and a pornographic manga is chosen, the cover will **not** be shown.
  - Since it is false by default, *I am not responsible for anything that happens if you enable it.*

The command can take up to 3 tags. The list of valid tags can be found [here](https://mangadex.org/tag/). There is also autocomplete functionality when typing in a tag name. 

The tags are used with **OR logic**. This means if you use 2 tags the chosen manga is guaranteed to have at least one of them, but not both. Although it is possible it will have both.

Aigis will attempt to display the title and description in English, but if English is unavailable she will either display it in the manga's native language or just say the title/description is unavailable.

### Command Reference
The following menu can be brought up by Aigis, along with the explanation of the command basics and language codes, via the `/manga help` command.

- `/manga idhelp` - The command that documents what to use for a manga's ID for each supported website.
- `/manga follow <manga-id> <language>` - Follow a manga to get pinged for new chapter releases.
- `/manga list` - List all manga you are following.
- `/manga unfollow <manga-id> <language>` - Unfollow a manga to stop getting pinged for new chapter releases.
- `/manga random <tag-1> <tag-2> <tag-3> <pornographic>` - Get a random manga from Mangadex with at least one of the given tags. Pornographic manga excluded by default.
- `/manga stop` - Stop manga chapter release checks for all servers. Bot developer only. 