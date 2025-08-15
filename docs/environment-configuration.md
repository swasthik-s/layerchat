# Environment Configuration Guide

## Overview

LayerChat uses a comprehensive environment configuration system that supports multiple AI providers, databases, monitoring tools, and feature flags. This guide explains how to set up and manage your environment variables.

## Quick Setup

1. **Copy the template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Generate required secrets**:
   ```bash
   # Generate NEXTAUTH_SECRET
   openssl rand -base64 32
   ```

3. **Configure minimum required variables**:
   ```bash
   NEXTAUTH_SECRET=<generated-secret>
   MONGODB_URI=<your-mongodb-connection-string>
   OPENAI_API_KEY=<your-openai-api-key>
   ```

## Configuration Sections

### Application Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Node.js environment |
| `APP_ENV` | No | `local` | Application environment |
| `NEXTAUTH_URL` | Yes | - | Base URL for the application |
| `NEXTAUTH_SECRET` | Yes | - | Secret for NextAuth.js |
| `PUBLIC_APP_URL` | No | `NEXTAUTH_URL` | Public-facing URL |

### AI Model Providers

#### OpenAI
```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...          # Optional
OPENAI_PROJECT_ID=proj_...     # Optional
```

#### Anthropic (Claude)
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_VERSION=2023-06-01
```

#### Google AI (Gemini)
```bash
GOOGLE_AI_API_KEY=AIza...
GOOGLE_VERTEX_PROJECT_ID=my-project    # For Vertex AI
GOOGLE_VERTEX_LOCATION=us-central1     # For Vertex AI
```

#### Mistral AI
```bash
MISTRAL_API_KEY=...
MISTRAL_ENDPOINT=https://api.mistral.ai
```

#### Groq
```bash
GROQ_API_KEY=gsk_...
GROQ_ENDPOINT=https://api.groq.com/openai/v1
```

### Database Configuration

#### MongoDB (Primary)
```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority
MONGODB_DB=layerchat
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=5
```

#### Supabase (Legacy/Backup)
```bash
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Redis (Optional - Caching)
```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
```

### Agent & Tool Integrations

#### Search Agent
```bash
SERPER_API_KEY=your-serper-key    # For web search
SERPER_ENDPOINT=https://google.serper.dev/search
```

#### YouTube Agent
```bash
YOUTUBE_API_KEY=AIza...
YOUTUBE_MAX_RESULTS=10
```

#### Weather Agent
```bash
OPENWEATHER_API_KEY=your-openweather-key
OPENWEATHER_ENDPOINT=https://api.openweathermap.org/data/2.5
```

#### Math Agent
```bash
WOLFRAM_ALPHA_API_KEY=your-wolfram-key
```

#### Image Generation
```bash
REPLICATE_API_TOKEN=r8_...
STABILITY_API_KEY=sk-...
```

### File Upload & Storage

#### Basic Configuration
```bash
MAX_FILE_SIZE=10485760                    # 10MB
MAX_FILES_PER_UPLOAD=5
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain,text/csv,text/markdown,application/json
STORAGE_PROVIDER=local                    # local, aws-s3, cloudinary, supabase
```

#### AWS S3 Storage
```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-layerchat-bucket
```

#### Cloudinary Storage
```bash
CLOUDINARY_CLOUD_NAME=my-cloud
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret
```

### Security & Rate Limiting

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST_SIZE=10
SECURITY_HEADERS_ENABLED=true
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
API_RATE_LIMIT_ENABLED=true
API_KEY_REQUIRED=false
```

### Feature Flags

#### AI Features
```bash
ENABLE_AUTO_AGENTS=true
ENABLE_STREAMING=true
ENABLE_IMAGE_GENERATION=false
ENABLE_VOICE_INPUT=false
```

#### UI Features
```bash
ENABLE_DARK_MODE=true
ENABLE_KEYBOARD_SHORTCUTS=true
ENABLE_CHAT_EXPORT=true
ENABLE_CHAT_IMPORT=false
```

#### Experimental Features
```bash
ENABLE_MULTIMODAL=false
ENABLE_PLUGIN_SYSTEM=false
ENABLE_CUSTOM_MODELS=false
```

### Logging & Monitoring

```bash
LOG_LEVEL=info                           # error, warn, info, debug
ANALYTICS_ENABLED=false
SENTRY_DSN=https://...@sentry.io/...
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com
VERCEL_ANALYTICS_ENABLED=false
GOOGLE_ANALYTICS_ID=G-...
```

### Development & Debugging

```bash
DEBUG_MODE=true
VERBOSE_LOGGING=false
MOCK_API_RESPONSES=false
TEST_MODE=false
E2E_TEST_MODE=false
BUNDLE_ANALYZER=false
TURBOPACK_ENABLED=true
```

## Environment-Specific Configurations

### Development (.env.local)
- Enable debug mode and verbose logging
- Use local storage provider
- Enable all development features
- Mock external APIs if needed

### Staging (.env.staging)
- Use staging databases
- Enable monitoring
- Test production-like configurations
- Limited rate limiting

### Production (.env.production)
- Strict security settings
- Production databases
- Full monitoring and analytics
- Proper rate limiting
- Disable debug features

## Configuration Validation

The application includes built-in configuration validation:

```typescript
import { validateConfig } from '@/lib/env-config'

// Validates critical configuration on startup
validateConfig()
```

### Required Variables
- `NEXTAUTH_SECRET`
- `MONGODB_URI`
- At least one AI provider API key

### Optional but Recommended
- `SERPER_API_KEY` (for web search)
- `OPENWEATHER_API_KEY` (for weather agent)
- `YOUTUBE_API_KEY` (for YouTube agent)
- Monitoring keys for production

## Security Best Practices

1. **Never commit `.env.local`** to version control
2. **Use strong, unique secrets** for production
3. **Rotate API keys regularly**
4. **Use environment-specific configurations**
5. **Enable rate limiting** in production
6. **Configure proper CORS origins**
7. **Use service accounts** for database access
8. **Enable monitoring and alerts**

## API Key Management

### Getting API Keys

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Anthropic**: https://console.anthropic.com/
3. **Google AI**: https://console.cloud.google.com/
4. **MongoDB Atlas**: https://cloud.mongodb.com/
5. **Serper**: https://serper.dev/
6. **OpenWeatherMap**: https://openweathermap.org/api

### Key Rotation

1. Generate new keys in provider console
2. Update environment variables
3. Deploy with new configuration
4. Verify functionality
5. Delete old keys

## Troubleshooting

### Common Issues

1. **"Configuration validation failed"**
   - Check required variables are set
   - Verify API key formats
   - Ensure at least one AI provider is configured

2. **"MongoDB connection failed"**
   - Verify MONGODB_URI format
   - Check network connectivity
   - Validate credentials

3. **"API rate limit exceeded"**
   - Check rate limiting configuration
   - Verify API key quotas
   - Monitor usage patterns

### Debug Mode

Enable debug mode for detailed logging:
```bash
DEBUG_MODE=true
VERBOSE_LOGGING=true
LOG_LEVEL=debug
```

## Configuration Utils

Use the configuration utility for type-safe access:

```typescript
import config, { isFeatureEnabled, getAiProviderConfig } from '@/lib/env-config'

// Access configuration
const mongoUri = config.mongodb.uri
const openaiKey = config.openai.apiKey

// Check feature flags
if (isFeatureEnabled('ai.enableStreaming')) {
  // Enable streaming
}

// Get provider config
const openaiConfig = getAiProviderConfig('openai')
```
