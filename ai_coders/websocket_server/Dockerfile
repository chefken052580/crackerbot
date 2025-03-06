FROM node:18-alpine
WORKDIR /websocket_server
RUN apk add --no-cache curl  # Add curl for health check
COPY package*.json ./
RUN npm install
RUN npm install -g pm2
COPY server.js .
EXPOSE 5002
CMD ["pm2-runtime", "start", "server.js"]