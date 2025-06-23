# backend/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make entrypoint script executable
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory
RUN mkdir -p data

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Set default environment variables (can be overridden by docker-compose)
ENV ENVIRONMENT=prod
ENV WISHLIST_DATABASE_URL=sqlite:///./data/wishlist.db
ENV PUID=1000
ENV PGID=1000

# Expose the port the app runs on
EXPOSE 8000

# Set the entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]