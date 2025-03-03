module.exports = {
  server: {
    port: parseInt(process.env.SERVER_PORT, 10) || 5001, // Set server port dynamically
    websocketPort: parseInt(process.env.WEBSOCKET_PORT, 10) || 7001, // WebSocket port
    host: process.env.SERVER_HOST || 'localhost', // Allow dynamic host configuration
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1', // Redis host
    port: parseInt(process.env.REDIS_PORT, 10) || 6379, // Redis port
    password: process.env.REDIS_PASSWORD || '', // Optional Redis authentication
    db: parseInt(process.env.REDIS_DB, 10) || 0, // Redis database selection
  },
  taskQueue: {
    name: process.env.TASK_QUEUE_NAME || 'tasks', // Task queue name
    concurrency: parseInt(process.env.TASK_QUEUE_CONCURRENCY, 10) || 5, // Set concurrency limit
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info', // Log level (debug, info, warn, error)
    output: process.env.LOG_OUTPUT || 'console', // Log output target (console, file, etc.)
  },
};