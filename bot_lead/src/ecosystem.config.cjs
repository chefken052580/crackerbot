module.exports = {
  apps: [
    {
      name: "bot_lead_server",
      script: "/bot_lead/src/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: "./logs/bot_lead_server.err.log",
      out_file: "./logs/bot_lead_server.out.log",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "bot_lead_client",
      script: "/bot_lead/src/socket.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: "./logs/bot_lead_client.err.log",
      out_file: "./logs/bot_lead_client.out.log",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};