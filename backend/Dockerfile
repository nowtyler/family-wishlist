# backend/Dockerfile
FROM python:3.12-slim-bookworm

WORKDIR /app

# Set environment variables for Python (correct format)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    python3-dev \
    libffi-dev \
    zlib1g-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies - fix the pip install command
# Note: Added verbose output to help debug any installation issues
RUN pip install --no-cache-dir --verbose -r requirements.txt

# Copy application code and config files
COPY ./app /app/app
COPY ./alembic.ini /app/alembic.ini

# Create required directories
RUN mkdir -p /app/data/backups && \
    mkdir -p /app/app/migrations/versions && \
    mkdir -p /app/app/migrations/versions/__pycache__

# Copy the migration script template
COPY ./app/migrations/script.py.mako /app/app/migrations/script.py.mako

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application using Uvicorn
# The host 0.0.0.0 makes it accessible from outside the container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]