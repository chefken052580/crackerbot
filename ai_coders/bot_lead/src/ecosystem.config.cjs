module.exports = {
  apps: [
    {
      name: "bot_lead_server",
      script: "./server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "bot_lead_client",
      script: "./socket.js",  // Changed from wsClient.js to socket.js as per the structure
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};