# frontend/Dockerfile

# Stage 1: Build the React app
FROM node:23-alpine AS build
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# COPY pnpm-lock.yaml ./ # If using pnpm

# Install dependencies
RUN npm install
# RUN pnpm install # If using pnpm
# RUN yarn install # If using yarn

# Copy the rest of the application code
COPY . .

# Build the application
# The VITE_API_BASE_URL can be set here if needed for the build,
# but often it's better to configure the runtime proxy (Nginx)
ENV VITE_API_BASE_URL=/api
RUN npm run build
# RUN pnpm build # If using pnpm
# RUN yarn build # If using yarn


# Stage 2: Serve the static files with Nginx
FROM nginx:1.28.0-alpine-slim
WORKDIR /usr/share/nginx/html

# Install envsubst utility
RUN apk add --no-cache bash gettext

# Remove default Nginx static assets
RUN rm -rf ./*

# Copy static assets from builder stage
COPY --from=build /app/dist .

# Copy the Nginx configuration as a template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Set default backend URL for Nginx configuration
ENV BACKEND_URL=http://backend:8000

# Create a proper entrypoint script
RUN printf '#!/bin/sh\n\
# Process template with environment variables\n\
echo "Processing Nginx config template with BACKEND_URL=$BACKEND_URL"\n\
envsubst "$$BACKEND_URL" < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf\n\
\n\
# Verify config syntax\n\
echo "Checking Nginx configuration..."\n\
nginx -t\n\
\n\
# Start Nginx\n\
echo "Starting Nginx server..."\n\
exec nginx -g "daemon off;"\n'\
> /docker-entrypoint.sh \
&& chmod +x /docker-entrypoint.sh

EXPOSE 80

# Use our custom entrypoint
CMD ["/docker-entrypoint.sh"]