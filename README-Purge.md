<!-- omit in toc -->
# Purge Command and Data Storage

<!-- omit in toc -->
## Quick Links
- [Purge Command](#purge-command)
  - [When to Purge](#when-to-purge)
  - [Command Reference](#command-reference)
- [What Data is Stored](#what-data-is-stored)
  - [Server Configuration](#server-configuration)
  - [Song of the Day](#song-of-the-day)
  - [Manga](#manga)


## Purge Command
The purge command is used to delete all data Aigis has stored about your server. This command is, of course, locked behind "manage server" permissions. This essentially means anyone that can invite Aigis to the server, so most likely mods or admins. The data deletion includes:
- Server configuration set in the `/setup` command
- Configuration on commands that are enabled/disabled
- Song of the Day data, including playlist rotation
- Manga data, including manga that members of the server follow

The deletion does not happen right away, but 7 days from when the command is used. Data is marked for deletion but still used, so users will still receive manga pings, the Song of the Day will still be chosen, etc. This is implemented mianly for two reasons
- In case you want to reverse the decision to delete data.
- If the deletion was scheduled by a malicious actor.

After the deletion, it will be like Aigis has joined your server for the first time with one exception, **reminders are not deleted**. This is due to the fact that reminders are stored in a queue using [bull](https://github.com/OptimalBits/bull#readme), and deleting a particular entry from that queue is more trouble than it's worth (for me since I am a bad programmer). This also means that the `/setup` command will need to be rerun, assuming you want to configure Aigis again.

A few more notes on the purge command:
- When a data deletion is scheduled, Aigis will ping the privileged role ID set via the `/setup` command. If it was set to everyone, Aigis will ping the server owner. This is to ensure that others know a data deletion is occuring.
  - The same occurs if the deletion is reverted.
- The deletion is not *exactly* 7 days from the time the command was run. A cronjob is scheduled once a day at midnight EST to check if the date to delete (7 days from when the command was run) has passed. So the real time is a few hours longer than 7 days.
- Once 7 days have passed and the data has been deleted **it cannot be recovered**

***Be careful when using this command***

### When to Purge
This is not an operation to be taken lightly, as it essentially resets Aigis to when she first joins your server. Here are some situations when you can, or should, run a data purge:
- When you no longer want Aigis in your server, *you should run this command before kicking her*.
- If you want to disable all commands after having Aigis in the server for a while.
- If you want to stop Song of the Day and Manga pings for all users in your server
- If someone has messed up your data and typing the commands to fix it is too tedious, like if they added hundreds of playlists to the Song of the Day rotation for example.

### Command Reference
- `/purge help` - Get information on the purge command. A less detailed version of this documentation.
- `/purge revert` - Reverse a scheduled data deletion.
- `/purge conitnue` - Schedule a data deletion.


## What Data is Stored
Here is a brief overview of what data is being stored by Aigis. This documentation also servers as an overview of the database layout. Aigis uses [MongoDB](https://www.mongodb.com/).
- Note that Discord internally uses the word "guild" to represent servers
- Reminders are not stored in Mongo but are managed by [bull](https://github.com/OptimalBits/bull#readme) which uses Redis. They will not be documented in detail here, but a reminder consists of 3 things: The channel ID to send the reminder to, the actual reminder message, and the Discord ID of the user that set the reminder.
- For data that is collected and stored by Aigis' AI functionality, see the [Shapes.inc privacy policy](https://wiki.shapes.inc/shape-essentials/guidelines-and-privacy/privacy-policy). This data is not accessed by me (the developer) or the code that I write for Aigis.

**The data below is the only data stored and accessed by Aigis. It is not sold or shared. Apart from your Discord ID and what servers you are in with Aigis, no identifying infromation is stored. Only developers have direct access to this data, and right now I am the only developer. At the moment, this data is stored on AWS along with the code that runs Aigis.**

### Server Configuration
When the `/setup` command is run, Aigis stores a configuration document for your server. It has the information provided in the setup as well as other administrator configurations like disabled commands. Here is an example of a server configuration document:

```json
{
  "channel_sotd": "1317223943068717150",
  "channel_manga": "1317223943068717150",
  "permission_role_id": "everyone",
  "channel_default": "1317223943068717150",
  "guild_id": "1309659688593522698",
  "disabled_commands": [
    "remindme",
    "sotd"
  ]
}
```
- Each command that has the option to have it's own channel gets stored in this document
- `permission_role_id` could also be an ID like the other fields.
- When a data purge is scheduled, a new `purge_date` field with the scheduled deletion date is created.

### Song of the Day
The most obvious piece of data stored by the Song of the Day command is playlists. A playlist entry has information such as the name, it's ID, and a list of servers that the playlist is used in. If a playlist is removed from all servers, it is deleted from the database. 
- If you schedule a purge and your playlist is used by another server, it will not be removed from the database.

```json
{
  "name": "Favorites",
  "spotify_id": "1F0UF9B5AWMy6YzpQx34dV",
  "length": 343,
  "owner": "Trashpanda70",
  "image": "https://image-cdn-fa.spotifycdn.com/image/ab67706c0000da84e4314d3fa351a51d6717ee3c",
  "guild_ids": [ "803893455934849074" ]
}
```
Also stored are 2 data structures that help maintain the state of the Song of the Day for your server, a list of songs and a [circular buffer](https://en.wikipedia.org/wiki/Circular_buffer) representing the playlist selection cycle.

The list of songs is a list of the 35 most recently chosen songs for the Song of the Day on your server, which is also the minimum length a playlist must be to be added to the rotation.

The curcular buffer holds all playlists your server uses for Song of the Day, and the current place in the queue that the selection is at. Both this and the list of songs are removed upon a purge as they are server specific. If you are curious as to how the circular buffer is implemented, its code is [here](https://github.com/mdwelker10/discord-bot-aigis/blob/main/utils/MyBuffer.js).

```json
//List of songs
{
  "guild_id": "803893455934849074",
  "structure": "songs",
  "data": "7fcEOJGsOOVyz8XeDwvLRZ,2cwvwUyyjjFsv55EywX9Zo,6ho0GyrWZN3mhi9zVRW7xi,7J9fqb0aSUGIgUveOtv1YJ,4foJEDuEjNDwQESdCQyA17,1QEEqeFIZktqIpPI4jSVSF,0bBl2jjpCFCgRd60BowZoV,0ru1ATGEAwgtSylajGg8yV,66B8m2u4nLLZcbjAPu29w9,5ISX62GKNkwcFI3QT68gjY,0WSa1sucoNRcEeULlZVQXj,3298yRJKPcCndQdNiTZKIo,2StLz1e2VTwCm8Jnkke7OF,0N3W5peJUQtI4eyR6GJT5O,7oaEjLP2dTJLJsITbAxTOz,3l82N3AcTxE2xhgnoanNuX,14dW3sfyW0RtSPYmv3Ol48,5CALUfj9oLMtK5vwpCAQgS,0LNyWv4RYKbaXIvzk6nMxZ,1mAKnHmu4XuStwSXho1p9B,6vmy0RP96JIwvCaX8XS1GR,6jpVXXVUFJLLE00qPsUfCi"
}
```

```json
//Circular Buffer
{
  "guild_id": "803893455934849074",
  "structure": "playlists",
  "data": {
    "length":6,
    "pointer":4,
    "buffer":[
      "5zUuT0pKvDjFo94adV0zrc",
      "1F0UF9B5AWMy6YzpQx34dV",
      "1ymD0Ury6jR1GSkQ1BpQkk",
      "0BMaIivV8qpXDprkemGOgC",
      "74HI592NpHLI5BOfMy8nbR",
      "2LV9lVgxcCMdmQFmnRCwmh"
    ]
  }
}
```

### Manga
The manga user's are following are not stored on a server basis. Rather, each manga is stored with a map of server IDs to an array of user IDs following that manga in that server. When a purge is scheduled, your server's entry will be removed. If a manga has nobody following it from any server it will be removed. 

Manga are also separated by website meaning the same series could have duplicate entries. For example, if someone in Server A follows Chainsaw Man on Mangadex and someone in Server B follows Chainsaw Man on Mangapill, then there will be a Chainsaw Man on Mangadex entry and a Chainsaw Man on Mangapill entry.

```json
 {
    "title": "Bocchi the Rock!",
    "manga_id": "2e0fdb3b-632c-4f8f-a311-5b56952db647",
    "lang": "en",
    "latest_chapter": "b93ee274-332e-4f4e-b7d6-f7db65451018",
    "latest_chapter_num": "82",
    "cover_art": "acfd5a05-1691-45fc-a5f3-4d0e77347840.jpg",
    "ping_list": { 
      "803893455934849074": [ 
        "365986896733536278" 
      ],
      "1309659688593522698": [
        "754934858081632376",
        "155149108183695360"
      ] 
    },
    "website": "mangadex"
  }
```
- In the above example, the user with ID "365986896733536278" is following the manga in the server with ID "803893455934849074". You can follow the same manga in multiple servers.
- In the above example, if a purge was activated on the server with ID "1309659688593522698", then only that entry would be removed.
- The `cover_art` field will default to [a link to a picture of Aigis reading](https://i.imgur.com/usdIJxN.png) if the manga has a pronographic rating or if the cover art could not be retrieved. 
  - Be warned, on some websites it might not be possible to determine the rating of a manga programatically.