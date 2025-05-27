# backend/Dockerfile
FROM python:3.12-slim-bookworm

WORKDIR /app

# Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies if any (e.g., for database drivers if not using SQLite)
# RUN apt-get update && apt-get install -y some-package

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    python3-dev \
    libffi-dev \
    zlib1g-dev
# Clean up apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
# Install Python dependencies
# Using --no-cache-dir to avoid caching the packages in the image
# This is useful for reducing the image size
# and ensuring that the latest versions are installed
# If you have a requirements.txt file, it should be in the same directory as this Dockerfil

RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and config files
COPY ./app /app/app
COPY ./alembic.ini /app/alembic.ini

# Create migrations directory and add template
RUN mkdir -p /app/app/migrations/versions && \
    mkdir -p /app/app/migrations/versions/__pycache__

# Copy the migration script template
COPY ./app/migrations/script.py.mako /app/app/migrations/script.py.mako

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application using Uvicorn
# The host 0.0.0.0 makes it accessible from outside the container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]