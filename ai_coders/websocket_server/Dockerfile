# websocket_server/Dockerfile
# Version: v2025-07-23-01
FROM node:20-alpine

WORKDIR /websocket_server
COPY package*.json ./
RUN apk add --no-cache curl && \
    npm ci --only=production && \
    npm cache clean --force
COPY src/ ./src/
EXPOSE 5002
CMD ["node", "src/server.js"]