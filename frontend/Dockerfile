# frontend/Dockerfile

# Stage 1: Build the React app
FROM node:23-alpine AS build
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application with environment variables
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build


# Stage 2: Serve the static files with Nginx
FROM nginx:1.28.0-alpine-slim
WORKDIR /usr/share/nginx/html

# Install curl for health checks and utilities
RUN apk add --no-cache curl bash

# Create log directories
RUN mkdir -p /var/log/nginx

# Remove default Nginx static assets
RUN rm -rf ./*

# Copy static assets from builder stage
COPY --from=build /app/dist .

# Copy the Nginx configuration file directly (no templating)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directories for logs
RUN mkdir -p /var/log/nginx && \
    chmod -R 755 /var/log/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

EXPOSE 80

# Default command - Nginx automatically runs as foreground process
CMD ["nginx", "-g", "daemon off;"]