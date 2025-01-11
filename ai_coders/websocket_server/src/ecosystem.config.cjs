module.exports = {
  apps: [
    {
      name: "websocket_server",
      script: "./server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: "./logs/websocket_server.err.log",
      out_file: "./logs/websocket_server.out.log",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};