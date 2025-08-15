# Build the Docker image
Write-Host "Building Docker image..." -ForegroundColor Green
docker build -t layerchat .

# Run the container
Write-Host "Starting container..." -ForegroundColor Green
docker run -p 3000:3000 --env-file .env.local layerchat
