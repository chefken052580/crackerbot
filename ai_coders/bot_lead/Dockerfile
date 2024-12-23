# Use Node.js 18 for compatibility
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code
COPY . .

# Copy the .env file explicitly (ensure it's in the same directory as Dockerfile)
COPY .env .env

# Expose the port for the bot lead
EXPOSE 5001

# Start the bot lead server
CMD ["node", "src/server.js"]