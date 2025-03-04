FROM node:18-alpine

WORKDIR /bot_lead

# Install system dependencies for canvas, pdfkit, ffmpeg, imagemagick, etc.
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
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
    ttf-dejavu \
    curl

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Install PM2 globally
RUN npm install -g pm2

# Copy the src directory containing all .js files
COPY src/ ./src/

# Expose port 5001 as per websocketHandler.js
EXPOSE 5001

# Start with PM2
CMD ["sh", "-c", "echo Starting PM2 && pm2-runtime src/server.js"]