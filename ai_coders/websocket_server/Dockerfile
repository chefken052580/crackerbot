# Use Node.js 18 for compatibility
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install PM2 globally
RUN npm install pm2 -g

# Copy all source code including ecosystem.config.js
COPY . .

# Expose the port for the WebSocket server
EXPOSE 5002

# Start the WebSocket server with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]