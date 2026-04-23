# Use an official lightweight Python image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Set the working directory
WORKDIR /app

# Install system dependencies (if any needed for scikit-learn/fairlearn)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port (Cloud Run uses PORT environment variable)
EXPOSE 8080

# Command to run the application
# We use 0.0.0.0 to bind to all interfaces
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
