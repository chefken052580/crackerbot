# Use Node.js 18 for compatibility
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /bot_lead

# Install FFmpeg, build dependencies for canvas, and font support
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libpng-dev \
    fontconfig \
    ttf-dejavu

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install PM2 globally
RUN npm install pm2 -g

# Copy all source code
COPY src/ ./src/

# Expose the port for the bot_lead server
EXPOSE 5001

# Start the server directly with PM2
CMD ["pm2-runtime", "/bot_lead/src/server.js"]