# Use Node.js 18 on Alpine Linux for a lightweight build stage
FROM node:18-alpine AS build-stage
WORKDIR /ai_coders/bot_frontend

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps --frozen-lockfile

# Copy all source code
COPY . .

# Build the application
RUN npm run build --verbose

# Serve the app with Nginx
FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /ai_coders/bot_frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

