FROM node:18-alpine

WORKDIR /bot_lead

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

COPY package*.json ./
RUN npm install
RUN npm install -g pm2

COPY src/ ./src/

EXPOSE 5001

CMD ["sh", "-c", "echo Starting PM2 && pm2-runtime start src/server.js"]