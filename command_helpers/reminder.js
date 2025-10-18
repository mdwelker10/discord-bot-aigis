//const { Queue, Worker, Job } = require('bull');
const Queue = require('bull');
const config = require('../utils/config');

let reminderQueue;

exports.initQueue = async (client) => {
  reminderQueue = new Queue('reminder', config.get('REDIS_URL'));
  reminderQueue.process(async (job) => {
    try {
      const { channel, message, user } = job.data;
      const ch = client.channels.cache.get(channel);
      console.info(`Sending reminder to ${user} in channel ${channel}: ${message}`);
      return ch.send(`<@${user}>-san, you asked me to remind you: ${message}`);
    } catch (err) {
      console.error(`Error processing reminder job: ${err}`);
    }
  });
}

exports.addItem = async (data, options) => {
  return await reminderQueue.add(data, options);
}