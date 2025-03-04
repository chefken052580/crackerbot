export default {
  server: {
    port: parseInt(process.env.SERVER_PORT, 10) || 5001,
    websocketPort: parseInt(process.env.WEBSOCKET_PORT, 10) || 7001,
    host: process.env.SERVER_HOST || 'localhost',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },
  taskQueue: {
    name: process.env.TASK_QUEUE_NAME || 'tasks',
    concurrency: parseInt(process.env.TASK_QUEUE_CONCURRENCY, 10) || 5,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    output: process.env.LOG_OUTPUT || 'console',
  },
};