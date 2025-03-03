FROM node:22.12.0-alpine as build-stage
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /usr/src/app/dist /usr/share/nginx/html

# Ensure the nginx config is valid
RUN nginx -t

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
