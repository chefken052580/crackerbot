# Use Node.js as a builder stage for installing dependencies and building the app
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Use Nginx to serve the app, and run Node.js for WebSocket handling
FROM nginx:1.21-alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/package*.json /app/
COPY --from=builder /app/server.js /app/
COPY --from=builder /app/socket.js /app/

# Install Node.js runtime for WebSocket server
RUN apk add --no-cache nodejs npm
WORKDIR /app
RUN npm install

EXPOSE 80      
EXPOSE 8080    

CMD ["sh", "-c", "node /app/server.js & nginx -g 'daemon off;'"]