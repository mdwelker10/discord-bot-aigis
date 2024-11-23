//const { Queue, Worker, Job } = require('bull');
const Queue = require('bull');

let reminderQueue;

exports.initQueue = async (client) => {
  reminderQueue = new Queue('reminder', 'redis://127.0.0.1:6379');
  reminderQueue.process(async (job) => {
    try {
      const { channel, message, user } = job.data;
      const ch = client.channels.cache.get(channel);
      return ch.send(`<@${user}>-san, you asked me to remind you: ${message}`);
    } catch (err) {
      console.error(`Error processing reminder job: ${err}`);
    }
  });
}

exports.addItem = async (data, options) => {
  reminderQueue.add(data, options);
}