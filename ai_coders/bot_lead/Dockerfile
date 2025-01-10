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

# Expose the port for the bot lead server
EXPOSE 5001

# Install PM2 globally for process management
RUN npm install pm2 -g

# Start command using PM2 to manage both processes
CMD ["pm2-runtime", "start", "ecosystem.config.js"]