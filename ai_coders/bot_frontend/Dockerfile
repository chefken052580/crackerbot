# Build stage
FROM node:22.12.0-alpine AS build-stage
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . /usr/src/app/  
RUN ls -la /usr/src/app/  # Debug: Verify copied files
RUN npm run build  # Outputs to /usr/src/app/build per vite.config.js
RUN ls -la /usr/src/app/build  # Debug: Verify build output

# Production stage
FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /usr/src/app/build /usr/share/nginx/html/  
RUN echo "bot_frontend is healthy" > /usr/share/nginx/html/health
RUN nginx -t
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]