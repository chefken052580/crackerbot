# Use Node.js 18 for compatibility
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /bot_lead

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install PM2 globally
RUN npm install pm2 -g

# Copy all source code including ecosystem.config.cjs
COPY src/ ./src/

# Expose the port for the bot_lead server
EXPOSE 5001

# Start the server with PM2
CMD ["pm2-runtime", "start", "src/ecosystem.config.cjs"]