# Docker Deployment Guide for LayerChat

This guide will help you deploy LayerChat using Docker on Koyeb or any other container platform.

## Prerequisites

- Docker installed on your machine
- A MongoDB database (MongoDB Atlas recommended)
- API keys for AI providers (OpenAI, Anthropic, etc.)

## Quick Start

1. **Clone and setup environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual values
   ```

2. **Build the Docker image:**
   ```bash
   docker build -t layerchat .
   ```

3. **Run locally for testing:**
   ```bash
   docker run -p 3000:3000 --env-file .env.local layerchat
   ```

## Koyeb Deployment

### Option 1: Using Koyeb CLI

1. **Install Koyeb CLI:**
   ```bash
   npm install -g @koyeb/cli
   koyeb auth login
   ```

2. **Deploy from Docker Hub:**
   ```bash
   # First push to Docker Hub
   docker tag layerchat your-dockerhub-username/layerchat
   docker push your-dockerhub-username/layerchat
   
   # Deploy to Koyeb
   koyeb app create layerchat
   koyeb service create \
     --app layerchat \
     --docker your-dockerhub-username/layerchat \
     --ports 3000:http \
     --name layerchat-web
   ```

3. **Set environment variables:**
   ```bash
   koyeb secret create mongodb-uri --value "your_mongodb_connection_string"
   koyeb secret create openai-api-key --value "your_openai_api_key"
   # Add other secrets as needed
   ```

### Option 2: Using Koyeb Web Interface

1. Go to [Koyeb Console](https://app.koyeb.com)
2. Create a new app
3. Choose "Docker" as the source
4. Enter your Docker image: `your-dockerhub-username/layerchat`
5. Set the port to `3000`
6. Add environment variables in the "Environment" section
7. Deploy

## Environment Variables for Production

Required variables for Koyeb:

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/layerchat
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
NODE_ENV=production
NEXTAUTH_URL=https://your-app.koyeb.app
NEXTAUTH_SECRET=your-secret-key
```

## Docker Image Optimization

The Dockerfile uses multi-stage builds to minimize image size:

- **Base stage**: Sets up Bun runtime
- **Dependencies stage**: Installs all dependencies
- **Builder stage**: Builds the Next.js application
- **Runner stage**: Creates minimal production image

## Health Checks

The application runs on port 3000 and responds to HTTP requests at the root path `/`.

## Troubleshooting

### Common Issues:

1. **Build fails**: Ensure all dependencies are properly installed
2. **Runtime errors**: Check environment variables are set correctly
3. **MongoDB connection**: Verify connection string and network access
4. **API keys**: Ensure all required API keys are provided

### Logs:

```bash
# View local container logs
docker logs <container-id>

# View Koyeb logs
koyeb service logs layerchat-web
```

## Performance Tuning

- The image uses Bun for faster package management and runtime
- Next.js standalone output reduces image size
- Non-root user for security
- Production optimizations enabled

## Security Considerations

- Never include sensitive data in the Docker image
- Use environment variables for all secrets
- The container runs as non-root user
- Consider using Koyeb's secret management for sensitive data

## Support

For issues with:
- Docker: Check Docker documentation
- Koyeb: Check Koyeb documentation
- LayerChat: Create an issue in the repository
