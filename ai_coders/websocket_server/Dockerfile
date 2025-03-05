FROM node:18-alpine
WORKDIR /websocket_server
COPY package*.json ./
RUN npm install
RUN npm install pm2 -g
COPY server.js .
EXPOSE 5002
CMD ["pm2-runtime", "start", "server.js"]