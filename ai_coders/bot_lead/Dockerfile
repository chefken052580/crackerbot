FROM node:18-slim
WORKDIR /bot_lead
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
RUN npm rebuild canvas --update-binary --verbose > canvas_build.log 2>&1
RUN npm install -g pm2
COPY src/ ./src/
EXPOSE 5001
CMD ["pm2-runtime", "src/server.js"]