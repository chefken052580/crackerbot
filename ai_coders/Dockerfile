FROM node:18-alpine
WORKDIR /websocket_server
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm install
RUN npm install -g pm2
COPY src/ ./src/
EXPOSE 5002
CMD ["pm2-runtime", "start", "src/server.js"]