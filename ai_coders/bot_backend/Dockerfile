FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
RUN npm install openai
COPY src/ ./src/
EXPOSE 5000
CMD ["node", "src/server.js"]