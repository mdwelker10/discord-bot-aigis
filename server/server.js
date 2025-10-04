require('dotenv').config();
const express = require('express');
const routes = require('./endpoints');
const path = require('node:path');
const session = require('express-session');

exports.startServer = async () => {

  //initialize express server
  const app = express();
  const port = process.env.WEB_SERVER_PORT;

  app.use(express.static(process.env.DOWNLOAD_PATH));
  app.use(express.static(path.join(__dirname, 'static')));
  app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));

  //set up ngrok
  // const listener = await ngrok.forward({
  //   addr: port,
  //   authtoken: process.env.NGROK_AUTHTOKEN,
  //   domain: process.env.NGROK_DOMAIN,
  // });
  // console.log(`Ngrok server listening at ${listener.url()}`);

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
          client_id: process.env.OAUTH_CLIENT_ID,
          client_secret: process.env.OAUTH_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.REDIRECT_URI,
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