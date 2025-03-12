FROM node:22-alpine AS build-stage
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --verbose
COPY . .
RUN echo "Listing /usr/src/app contents:" && ls -la /usr/src/app/ && echo "Listing /usr/src/app/src contents:" && ls -la /usr/src/app/src/
RUN [ -f tailwind.config.js ] || (echo "Error: tailwind.config.js not found" && exit 1)
RUN echo "Running npm run build..." && npm run build || (echo "Build failed" && cat /usr/src/app/vite.config.js && cat /usr/src/app/index.html && exit 1)
RUN echo "Build output:" && ls -la /usr/src/app/build
RUN echo "Generated index.html:" && cat /usr/src/app/build/index.html

FROM nginx:stable-alpine AS production-stage
COPY --from=build-stage /usr/src/app/build /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN echo "bot_frontend is healthy" > /usr/share/nginx/html/health
RUN echo "Nginx serving directory:" && ls -la /usr/share/nginx/html/
RUN echo "Served index.html:" && cat /usr/share/nginx/html/index.html
RUN mkdir -p /var/log/nginx && touch /var/log/nginx/access.log
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]