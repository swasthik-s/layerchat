/**
 * Environment Configuration Utility
 * Validates and provides type-safe access to environment variables
 */

interface AppConfig {
  // Application
  nodeEnv: string
  appEnv: string
  nextAuthUrl: string
  nextAuthSecret: string
  publicAppUrl: string

  // AI Providers
  openai: {
    apiKey?: string
    orgId?: string
    projectId?: string
  }
  anthropic: {
    apiKey?: string
    version: string
  }
  google: {
    aiApiKey?: string
    vertexProjectId?: string
    vertexLocation: string
  }
  mistral: {
    apiKey?: string
    endpoint: string
  }
  groq: {
    apiKey?: string
    endpoint: string
  }

  // Database
  mongodb: {
    uri: string
    db: string
    maxPoolSize: number
    minPoolSize: number
  }
  supabase: {
    url?: string
    anonKey?: string
    serviceRoleKey?: string
  }
  redis: {
    url?: string
    password?: string
  }

  // Agents & Tools
  serper: {
    apiKey?: string
    endpoint: string
  }
  youtube: {
    apiKey?: string
    maxResults: number
  }
  openWeather: {
    apiKey?: string
    endpoint: string
  }
  wolframAlpha: {
    apiKey?: string
  }
  replicate: {
    apiToken?: string
  }
  stability: {
    apiKey?: string
  }

  // File Upload
  fileUpload: {
    maxFileSize: number
    allowedFileTypes: string[]
    maxFilesPerUpload: number
  }

  // Storage
  storage: {
    provider: string
    aws?: {
      accessKeyId?: string
      secretAccessKey?: string
      region: string
      s3Bucket?: string
    }
    cloudinary?: {
      cloudName?: string
      apiKey?: string
      apiSecret?: string
    }
  }

  // Security & Rate Limiting
  security: {
    rateLimitEnabled: boolean
    rateLimitRequestsPerMinute: number
    rateLimitBurstSize: number
    securityHeadersEnabled: boolean
    corsAllowedOrigins: string[]
    apiRateLimitEnabled: boolean
    apiKeyRequired: boolean
  }

  // Logging & Monitoring
  logging: {
    level: string
    analyticsEnabled: boolean
    sentryDsn?: string
    posthogApiKey?: string
    posthogHost?: string
    vercelAnalyticsEnabled: boolean
    googleAnalyticsId?: string
  }

  // Feature Flags
  features: {
    ai: {
      enableAutoAgents: boolean
      enableStreaming: boolean
      enableImageGeneration: boolean
      enableVoiceInput: boolean
    }
    ui: {
      enableDarkMode: boolean
      enableKeyboardShortcuts: boolean
      enableChatExport: boolean
      enableChatImport: boolean
    }
    experimental: {
      enableMultimodal: boolean
      enablePluginSystem: boolean
      enableCustomModels: boolean
    }
  }

  // Development
  development: {
    debugMode: boolean
    verboseLogging: boolean
    mockApiResponses: boolean
    testMode: boolean
    e2eTestMode: boolean
    bundleAnalyzer: boolean
    turbopackEnabled: boolean
  }

  // Third-party Integrations
  integrations: {
    email: {
      provider?: string
      resendApiKey?: string
      sendgridApiKey?: string
      mailgunApiKey?: string
    }
    auth: {
      githubClientId?: string
      githubClientSecret?: string
      googleClientId?: string
      googleClientSecret?: string
    }
  }
}

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  return value
}

function getOptionalEnvVar(name: string, defaultValue?: string): string | undefined {
  return process.env[name] || defaultValue
}

function getBooleanEnvVar(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

function getNumberEnvVar(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

function getArrayEnvVar(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name]
  if (!value) return defaultValue
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

// Accept only the three canonical NODE_ENV values; fall back to production for unknown
function sanitizeNodeEnv(raw: string | undefined): 'development' | 'production' | 'test' {
  if (raw === 'development' || raw === 'production' || raw === 'test') return raw
  if (raw && typeof window === 'undefined') {
    // Log once on server side so we notice but don't crash
    console.warn(`[env-config] Non‑standard NODE_ENV="${raw}" detected. Falling back to 'production'. Use APP_ENV for custom stages.`)
  }
  return raw === 'test' ? 'test' : (raw === 'development' ? 'development' : 'production')
}

export const config: AppConfig = {
  // Application
  nodeEnv: sanitizeNodeEnv(getOptionalEnvVar('NODE_ENV', 'development')),
  appEnv: getOptionalEnvVar('APP_ENV', 'local') || 'local',
  nextAuthUrl: getRequiredEnvVar('NEXTAUTH_URL'),
  nextAuthSecret: getRequiredEnvVar('NEXTAUTH_SECRET'),
  publicAppUrl: getOptionalEnvVar('PUBLIC_APP_URL') || getRequiredEnvVar('NEXTAUTH_URL'),

  // AI Providers
  openai: {
    apiKey: getOptionalEnvVar('OPENAI_API_KEY'),
    orgId: getOptionalEnvVar('OPENAI_ORG_ID'),
    projectId: getOptionalEnvVar('OPENAI_PROJECT_ID'),
  },
  anthropic: {
    apiKey: getOptionalEnvVar('ANTHROPIC_API_KEY'),
    version: getOptionalEnvVar('ANTHROPIC_VERSION', '2023-06-01') || '2023-06-01',
  },
  google: {
    aiApiKey: getOptionalEnvVar('GOOGLE_AI_API_KEY'),
    vertexProjectId: getOptionalEnvVar('GOOGLE_VERTEX_PROJECT_ID'),
    vertexLocation: getOptionalEnvVar('GOOGLE_VERTEX_LOCATION', 'us-central1') || 'us-central1',
  },
  mistral: {
    apiKey: getOptionalEnvVar('MISTRAL_API_KEY'),
    endpoint: getOptionalEnvVar('MISTRAL_ENDPOINT', 'https://api.mistral.ai') || 'https://api.mistral.ai',
  },
  groq: {
    apiKey: getOptionalEnvVar('GROQ_API_KEY'),
    endpoint: getOptionalEnvVar('GROQ_ENDPOINT', 'https://api.groq.com/openai/v1') || 'https://api.groq.com/openai/v1',
  },

  // Database
  mongodb: {
    uri: getOptionalEnvVar('MONGODB_URI') || '',
    db: getOptionalEnvVar('MONGODB_DB', 'layerchat') || 'layerchat',
    maxPoolSize: getNumberEnvVar('MONGODB_MAX_POOL_SIZE', 10),
    minPoolSize: getNumberEnvVar('MONGODB_MIN_POOL_SIZE', 5),
  },
  supabase: {
    url: getOptionalEnvVar('SUPABASE_URL'),
    anonKey: getOptionalEnvVar('SUPABASE_ANON_KEY'),
    serviceRoleKey: getOptionalEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  },
  redis: {
    url: getOptionalEnvVar('REDIS_URL'),
    password: getOptionalEnvVar('REDIS_PASSWORD'),
  },

  // Agents & Tools
  serper: {
    apiKey: getOptionalEnvVar('SERPER_API_KEY'),
    endpoint: getOptionalEnvVar('SERPER_ENDPOINT', 'https://google.serper.dev/search') || 'https://google.serper.dev/search',
  },
  youtube: {
    apiKey: getOptionalEnvVar('YOUTUBE_API_KEY'),
    maxResults: getNumberEnvVar('YOUTUBE_MAX_RESULTS', 10),
  },
  openWeather: {
    apiKey: getOptionalEnvVar('OPENWEATHER_API_KEY'),
    endpoint: getOptionalEnvVar('OPENWEATHER_ENDPOINT', 'https://api.openweathermap.org/data/2.5') || 'https://api.openweathermap.org/data/2.5',
  },
  wolframAlpha: {
    apiKey: getOptionalEnvVar('WOLFRAM_ALPHA_API_KEY'),
  },
  replicate: {
    apiToken: getOptionalEnvVar('REPLICATE_API_TOKEN'),
  },
  stability: {
    apiKey: getOptionalEnvVar('STABILITY_API_KEY'),
  },

  // File Upload
  fileUpload: {
    maxFileSize: getNumberEnvVar('MAX_FILE_SIZE', 10485760),
    allowedFileTypes: getArrayEnvVar('ALLOWED_FILE_TYPES', ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'text/csv']),
    maxFilesPerUpload: getNumberEnvVar('MAX_FILES_PER_UPLOAD', 5),
  },

  // Storage
  storage: {
    provider: getOptionalEnvVar('STORAGE_PROVIDER', 'local') || 'local',
    aws: {
      accessKeyId: getOptionalEnvVar('AWS_ACCESS_KEY_ID'),
      secretAccessKey: getOptionalEnvVar('AWS_SECRET_ACCESS_KEY'),
      region: getOptionalEnvVar('AWS_REGION', 'us-east-1') || 'us-east-1',
      s3Bucket: getOptionalEnvVar('AWS_S3_BUCKET'),
    },
    cloudinary: {
      cloudName: getOptionalEnvVar('CLOUDINARY_CLOUD_NAME'),
      apiKey: getOptionalEnvVar('CLOUDINARY_API_KEY'),
      apiSecret: getOptionalEnvVar('CLOUDINARY_API_SECRET'),
    },
  },

  // Security & Rate Limiting
  security: {
    rateLimitEnabled: getBooleanEnvVar('RATE_LIMIT_ENABLED', true),
    rateLimitRequestsPerMinute: getNumberEnvVar('RATE_LIMIT_REQUESTS_PER_MINUTE', 60),
    rateLimitBurstSize: getNumberEnvVar('RATE_LIMIT_BURST_SIZE', 10),
    securityHeadersEnabled: getBooleanEnvVar('SECURITY_HEADERS_ENABLED', true),
    corsAllowedOrigins: getArrayEnvVar('CORS_ALLOWED_ORIGINS', ['http://localhost:3000', 'http://127.0.0.1:3000']),
    apiRateLimitEnabled: getBooleanEnvVar('API_RATE_LIMIT_ENABLED', true),
    apiKeyRequired: getBooleanEnvVar('API_KEY_REQUIRED', false),
  },

  // Logging & Monitoring
  logging: {
    level: getOptionalEnvVar('LOG_LEVEL', 'info') || 'info',
    analyticsEnabled: getBooleanEnvVar('ANALYTICS_ENABLED', false),
    sentryDsn: getOptionalEnvVar('SENTRY_DSN'),
    posthogApiKey: getOptionalEnvVar('POSTHOG_API_KEY'),
    posthogHost: getOptionalEnvVar('POSTHOG_HOST', 'https://app.posthog.com'),
    vercelAnalyticsEnabled: getBooleanEnvVar('VERCEL_ANALYTICS_ENABLED', false),
    googleAnalyticsId: getOptionalEnvVar('GOOGLE_ANALYTICS_ID'),
  },

  // Feature Flags
  features: {
    ai: {
      enableAutoAgents: getBooleanEnvVar('ENABLE_AUTO_AGENTS', true),
      enableStreaming: getBooleanEnvVar('ENABLE_STREAMING', true),
      enableImageGeneration: getBooleanEnvVar('ENABLE_IMAGE_GENERATION', false),
      enableVoiceInput: getBooleanEnvVar('ENABLE_VOICE_INPUT', false),
    },
    ui: {
      enableDarkMode: getBooleanEnvVar('ENABLE_DARK_MODE', true),
      enableKeyboardShortcuts: getBooleanEnvVar('ENABLE_KEYBOARD_SHORTCUTS', true),
      enableChatExport: getBooleanEnvVar('ENABLE_CHAT_EXPORT', true),
      enableChatImport: getBooleanEnvVar('ENABLE_CHAT_IMPORT', false),
    },
    experimental: {
      enableMultimodal: getBooleanEnvVar('ENABLE_MULTIMODAL', false),
      enablePluginSystem: getBooleanEnvVar('ENABLE_PLUGIN_SYSTEM', false),
      enableCustomModels: getBooleanEnvVar('ENABLE_CUSTOM_MODELS', false),
    },
  },

  // Development
  development: {
    debugMode: getBooleanEnvVar('DEBUG_MODE', true),
    verboseLogging: getBooleanEnvVar('VERBOSE_LOGGING', false),
    mockApiResponses: getBooleanEnvVar('MOCK_API_RESPONSES', false),
    testMode: getBooleanEnvVar('TEST_MODE', false),
    e2eTestMode: getBooleanEnvVar('E2E_TEST_MODE', false),
    bundleAnalyzer: getBooleanEnvVar('BUNDLE_ANALYZER', false),
    turbopackEnabled: getBooleanEnvVar('TURBOPACK_ENABLED', true),
  },

  // Third-party Integrations
  integrations: {
    email: {
      provider: getOptionalEnvVar('EMAIL_PROVIDER'),
      resendApiKey: getOptionalEnvVar('RESEND_API_KEY'),
      sendgridApiKey: getOptionalEnvVar('SENDGRID_API_KEY'),
      mailgunApiKey: getOptionalEnvVar('MAILGUN_API_KEY'),
    },
    auth: {
      githubClientId: getOptionalEnvVar('GITHUB_CLIENT_ID'),
      githubClientSecret: getOptionalEnvVar('GITHUB_CLIENT_SECRET'),
      googleClientId: getOptionalEnvVar('GOOGLE_CLIENT_ID'),
      googleClientSecret: getOptionalEnvVar('GOOGLE_CLIENT_SECRET'),
    },
  },
}

// Validation function to check critical configuration
export function validateConfig(): void {
  const errors: string[] = []

  // Check critical variables
  if (!config.nextAuthSecret) {
    errors.push('NEXTAUTH_SECRET is required')
  }
  
  // MongoDB is optional during build time, only warn in production
  if (!config.mongodb.uri && process.env.NODE_ENV === 'production') {
    console.warn('⚠️ MONGODB_URI not configured - MongoDB features will be disabled')
  }

  // Check if at least one AI provider is configured
  const hasAiProvider = !!(
    config.openai.apiKey || 
    config.anthropic.apiKey || 
    config.google.aiApiKey || 
    config.mistral.apiKey || 
    config.groq.apiKey
  )
  
  if (!hasAiProvider) {
    errors.push('At least one AI provider API key must be configured')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`)
  }
}

// Helper to check if a feature is enabled
export function isFeatureEnabled(feature: string): boolean {
  const parts = feature.split('.')
  let current: any = config.features
  
  for (const part of parts) {
    current = current?.[part]
    if (current === undefined) return false
  }
  
  return Boolean(current)
}

// Helper to get AI provider config
export function getAiProviderConfig(provider: string) {
  const providers = {
    openai: config.openai,
    anthropic: config.anthropic,
    google: config.google,
    mistral: config.mistral,
    groq: config.groq,
  }
  
  return providers[provider as keyof typeof providers]
}

export default config
