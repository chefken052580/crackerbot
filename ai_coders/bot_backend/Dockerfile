# Use Node.js 18 for compatibility
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
RUN npm install openai  # Add OpenAI package

# Copy all source code
COPY src/ ./src/

# Expose the port for the bot_backend server
EXPOSE 5000

# Run the server.js file directly with Node
CMD ["node", "src/server.js"]