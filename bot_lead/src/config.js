module.exports = {
    server: {
      port: parseInt(process.env.SERVER_PORT, 10) || 5001, // Dynamically set port from environment variable or fallback
      websocketPort: parseInt(process.env.WEBSOCKET_PORT, 10) || 7001, // Dynamically set websocket port
    },
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1', // Dynamically set Redis host
      port: parseInt(process.env.REDIS_PORT, 10) || 6379, // Ensure Redis port is numeric
    },
    taskQueue: {
      name: process.env.TASK_QUEUE_NAME || 'tasks', // Dynamically set task queue name
    },
  };
  