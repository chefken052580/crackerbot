FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:1.21-alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# Add healthcheck to ensure Nginx is running
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -sSf http://localhost:80 || exit 1
CMD ["nginx", "-g", "daemon off;"]