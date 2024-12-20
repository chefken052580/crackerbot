const Queue = require('bull');
const config = require('./config');

// Create a task queue connected to Redis
const taskQueue = new Queue(config.taskQueue.name, {
  redis: { host: config.redis.host, port: config.redis.port },
});

// Function to add tasks
async function addTask(taskName, bot) {
  const job = await taskQueue.add({ taskName, bot });
  console.log(`Task added: ${taskName}, assigned to bot: ${bot}`);
  return job.id;
}

// Task processor
taskQueue.process(async (job) => {
  console.log(`Processing task: ${job.data.taskName}`);
  // Simulate task delegation (actual bot integration here)
  return Promise.resolve(`Task "${job.data.taskName}" completed by ${job.data.bot}`);
});

module.exports = { addTask, taskQueue };
