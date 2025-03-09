# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.26.3-alpine
# Clear any default or leftover files in Nginx's html directory
RUN rm -rf /usr/share/nginx/html/*
# Copy only the built files from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html
COPY ./default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]