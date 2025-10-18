const express = require('express');
const routes = require('./endpoints');
const path = require('node:path');
const session = require('express-session');
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');
const config = require('../utils/config');

exports.startServer = async () => {

  //initialize express server
  const app = express();
  const port = config.get('WEB_SERVER_PORT');

  // Create Redis client for sessions
  const redisClient = createClient({
    url: config.get('REDIS_URL')
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  await redisClient.connect();
  console.info('Redis client connected for session storage');

  app.use(express.static(config.get('DOWNLOAD_PATH')));
  app.use(express.static(path.join(__dirname, 'static')));

  // Configure session with Redis store
  app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: config.get('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.get('DEV') === "1" ? false : true,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  }));

  //set up discord oauth
  app.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code)
      return res.status(400).send("No code provided");

    try {
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.get('OAUTH_CLIENT_ID'),
          client_secret: config.get('OAUTH_CLIENT_SECRET'),
          grant_type: "authorization_code",
          code,
          redirect_uri: config.get('REDIRECT_URI'),
          scope: "identify"
        }),
      });

      const tokenData = await tokenResponse.json();
      if (tokenData.error)
        return res.status(400).json(tokenData);

      const accessToken = tokenData.access_token;
      const tokenType = tokenData.token_type;

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `${tokenType} ${accessToken}` },
      });

      const user = await userResponse.json();
      req.session.user = user;
      console.info(`User ${user.username} authenticated via Discord OAuth.`);
      const redirectTo = req.session.returnTo || "/";
      console.log('returnTo value:', req.session.returnTo, '-> redirecting to:', redirectTo); // Debug log
      delete req.session.returnTo;
      req.session.save(() => {
        res.redirect(redirectTo);
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Something went wrong. Please try again.");
    }
  });

  app.use("/", routes);

  app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'static', 'templates', '404.html'));
  });

  app.listen(port, "0.0.0.0", () => {
    console.info(`Express server listening on port ${port}`);
  });
};