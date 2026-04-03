FROM nginx:alpine-slim
RUN apk upgrade --no-cache
COPY dist /usr/share/nginx/html
EXPOSE 80
