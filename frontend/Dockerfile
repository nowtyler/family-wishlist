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
ARG ENVIRONMENT=prod
ENV ENVIRONMENT=${ENVIRONMENT}

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

# Copy the Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Create directories for logs
RUN mkdir -p /var/log/nginx && \
    chmod -R 755 /var/log/nginx

# Set up environment variables
ENV ENVIRONMENT=prod
ENV BACKEND_SERVICE=backend

# Add startup script to apply configuration based on environment
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Make sure the entrypoint script has proper line endings
RUN sed -i 's/\r$//' /docker-entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

EXPOSE 80

# Use the custom entrypoint script to set the correct backend service
ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command - Nginx automatically runs as foreground process
CMD ["nginx", "-g", "daemon off;"]