require('dotenv').config();
const { stopMangaCronJob } = require('./command_helpers/manga');
const { stopSotdCronJob } = require('./command_helpers/sotd');

stopMangaCronJob();
//stopSotdCronJob();