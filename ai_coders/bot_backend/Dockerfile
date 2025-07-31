# bot_backend/Dockerfile
# Version: v2025-07-23-01
FROM node:20-bullseye-slim AS base

WORKDIR /bot_backend
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Install system dependencies in a builder stage
FROM base AS builder
RUN echo "deb http://deb.debian.org/debian bullseye main" > /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security bullseye-security main" >> /etc/apt/sources.list && \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    && apt-get upgrade -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    npm rebuild canvas --update-binary

# Final stage
FROM base
COPY --from=builder /usr/lib /usr/lib
COPY --from=builder /usr/include /usr/include
COPY src/ ./src/
EXPOSE 5000
CMD ["node", "src/server.js"]