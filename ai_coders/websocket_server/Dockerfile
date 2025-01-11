# Use Node.js 18 for compatibility
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /websocket_server

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install PM2 globally
RUN npm install pm2 -g

# Copy the server.js file directly into the container
COPY server.js .

# Expose the port for the WebSocket server
EXPOSE 5002

# Start the server with PM2
CMD ["pm2-runtime", "start", "server.js"]