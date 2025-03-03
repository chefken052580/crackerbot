FROM node:18-alpine

WORKDIR /bot_lead

# Install necessary dependencies (including `curl`)
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
    ttf-dejavu \
    curl  # ✅ Fix: Add curl for healthcheck

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install PM2 globally
RUN npm install pm2 -g

# Copy all source code
COPY src/ ./src/

EXPOSE 5001

CMD ["pm2-runtime", "/bot_lead/src/server.js"]
