FROM node:20-slim
WORKDIR /bot_lead

# Install system dependencies for canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
RUN npm install -g pm2
RUN npm rebuild canvas --update-binary

COPY src/ ./src/
EXPOSE 5001
CMD ["pm2-runtime", "start", "src/server.js"]