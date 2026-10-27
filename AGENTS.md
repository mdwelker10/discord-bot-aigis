# AGENTS.md

Aigis is a multi-purpose Discord bot (Node.js, discord.js v14, CommonJS). See README.md for user-facing features and README-Data.md for what data is stored.

## Layout
- `index.js`: entry point
- `commands/`: slash commands (feature commands live in `commands/feature/`)
- `command_helpers/`: logic backing commands (e.g. `manga/manga-template.js` is the template for adding a manga site)
- `database/`: MongoDB access
- `server/`: Express server (port 3000)
- `utils/`: shared helpers
- `.github/skills/discord-feature-command-scaffold`: use this skill when adding a new feature command

## Stack
- MongoDB (driver pinned to 3.6, server 4.2.x; stick to that API) and Redis (Bull queues, sessions)
  - Mongo must stay pinned here due to hardware limitations for production
- `cron` for scheduled jobs (daily jobs run at 12:00 AM EST), `luxon` for time handling
- `canvas` for card images, `playwright` and `cheerio` for scraping, yt-dlp for the download command

## Commands
- Lint: `npm run lint`
- Dev: `npm run dev` (pm2 with `ecosystem.dev.config.js`); Docker dev setup is `compose-dev.yml` + `dev.dockerfile`
- There is no test suite. Don't invent test commands; just lint and check the code paths by reading.

## Deployment
- Prod runs via `compose.yml` (app, mongo, redis, cloudflared) on a Raspberry Pi 400, headless Ubuntu, **arm64**.
- Keep it light: low RAM and a slow SD card/disk. Avoid heavy dependencies, and any new Docker image must have an arm64 build.
- Config comes from `.env` (see `.env.sample`). Never commit secrets or edit `.env`. Add new variables to `.env.sample`.
- Access environment variables by doing the following:
  - import `const config = require('../../utils/config');` at the top of the file
  - access an environment variable via `config.get(<key>, <optional-default-value>)` where if a default is not provided, undefined is returned

## Conventions
- Follow the existing style and `.eslintrc.json`.
- New commands must work with the per-server enable/disable system and `/setup` channel overrides; check an existing feature command first.
- Commands that store data should appear in the datastore list and be covered by the purge flow in README-Data.md.
- Update README.md when adding or changing user-facing commands.
- Dev-only commands (like `/sotd select`) must stay disabled outside dev.