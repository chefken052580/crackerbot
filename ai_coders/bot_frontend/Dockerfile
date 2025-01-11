# Build stage
FROM node:18-alpine AS build-stage
WORKDIR /ai_coders/bot_frontend
COPY package*.json ./
RUN npm install --legacy-peer-deps --frozen-lockfile
COPY . .
RUN npm run build --verbose

# Production stage
FROM nginx:stable-alpine AS production-stage
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /ai_coders/bot_frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]