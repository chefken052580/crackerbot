# Build stage: Compile the React application
FROM node:22.12.0-alpine AS build-stage
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage: Serve the built app with Nginx
FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /usr/src/app/dist /usr/share/nginx/html

# Add a simple health check endpoint
RUN echo "bot_frontend is healthy" > /usr/share/nginx/html/health

# Verify Nginx configuration
RUN nginx -t

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]