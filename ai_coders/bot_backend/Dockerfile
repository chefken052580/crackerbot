# Use Node.js 18 for the backend bot
FROM node:18-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 5000

# Since we're adding a WebSocket client, we need to run both server.js and socket.js
CMD ["sh", "-c", "node server.js & node socket.js"]