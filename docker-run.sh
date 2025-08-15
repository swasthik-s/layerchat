#!/bin/bash

# Build the Docker image
echo "Building Docker image..."
docker build -t layerchat .

# Run the container
echo "Starting container..."
docker run -p 3000:3000 --env-file .env.local layerchat
