const express = require('express');
const path = require('path');
const sanitize = require('sanitize-filename');
const config = require('../utils/config');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    console.log('Setting returnTo:', req.originalUrl); // Debug log
    console.log('Session ID:', req.sessionID); // Debug log
    console.log('Session before save:', req.session); // Debug log
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      } else {
        console.log('Session saved successfully'); // Debug log
      }
      res.redirect("/login");
    });
    return;
  }
  next();
}

//router.use(requireAuth);
router.get('/login', (req, res) => {
  res.redirect(config.get('LOGIN_URI'));
});

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'templates', 'index.html'));
});

router.get("/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Not logged in" });
  res.json(req.session.user);
});

router.get("/downloads/:filename", requireAuth, (req, res) => {
  const safeFilename = sanitize(req.params.filename);
  console.info(`User ${req.session.user.username} is downloading file ${safeFilename}`);
  const filepath = path.join(__dirname, '..', 'downloads', safeFilename);
  res.sendFile(filepath, (err) => {
    if (err) {
      res.status(404).sendFile(path.join(__dirname, 'static', 'templates', '404.html'));
    }
  });
});

module.exports = router;