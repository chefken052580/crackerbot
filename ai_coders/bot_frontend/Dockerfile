# bot_frontend/Dockerfile
# Version: v2025-07-30-02
FROM node:20-alpine AS build-stage

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm config set cache /usr/src/app/.npm-cache --global && \
    npm install && \
    npm cache clean --force
COPY . .
RUN npm run build
RUN ls -la /usr/src/app/build  # Debug: Verify build output

FROM nginx:1.28.0-alpine
COPY --from=build-stage /usr/src/app/build /usr/share/nginx/html/
# Remove existing default.conf to avoid file/directory conflict
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN echo "bot_frontend is healthy" > /usr/share/nginx/html/health
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]