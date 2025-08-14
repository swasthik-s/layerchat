// Environment configuration and validation
export const config = {
  // AI Provider API Keys
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: 'https://api.openai.com/v1',
    models: {
      'gpt-4': 'gpt-4',
      'gpt-4-turbo': 'gpt-4-turbo-preview',
      'gpt-3.5-turbo': 'gpt-3.5-turbo',
      'dall-e-3': 'dall-e-3',
      'dall-e-2': 'dall-e-2',
    }
  },
  
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseURL: 'https://api.anthropic.com',
    models: {
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307',
    }
  },
  
  google: {
    apiKey: process.env.GOOGLE_AI_API_KEY || '',
    models: {
      'gemini-pro': 'gemini-pro',
      'gemini-pro-vision': 'gemini-pro-vision',
    }
  },
  
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY || 'BnSyuAgKIqQakD3F5Y7Bl3cjsoMsNSQ6',
    baseURL: 'https://api.mistral.ai/v1',
    models: {
      'mistral-large-latest': 'mistral-large-latest',
      'mistral-medium-latest': 'mistral-medium-latest',
      'mistral-small-latest': 'mistral-small-latest',
      'open-mistral-7b': 'open-mistral-7b',
      'open-mixtral-8x7b': 'open-mixtral-8x7b',
      'codestral-latest': 'codestral-latest',
    }
  },
  
  // Database
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  
  // External APIs
  serper: {
    apiKey: process.env.SERPER_API_KEY || '',
    baseURL: 'https://google.serper.dev/search',
  },
  
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    baseURL: 'https://www.googleapis.com/youtube/v3',
  },
  
  weather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '',
    baseURL: 'https://api.openweathermap.org/data/2.5',
  },
  
  // File handling
  files: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || '').split(',').filter(Boolean),
    uploadDir: './uploads',
  },
  
  // App settings
  app: {
    maxTokens: 4000,
    temperature: 0.7,
    streamTimeout: 30000,
    maxRetries: 3,
  }
}

// Validation function
export function validateConfig() {
  const warnings = []
  
  if (!config.openai.apiKey) warnings.push('OPENAI_API_KEY not set')
  if (!config.anthropic.apiKey) warnings.push('ANTHROPIC_API_KEY not set')
  if (!config.google.apiKey) warnings.push('GOOGLE_AI_API_KEY not set')
  if (!config.mistral.apiKey) warnings.push('MISTRAL_API_KEY not set (using default)')
  if (!config.supabase.url) warnings.push('SUPABASE_URL not set')
  if (!config.supabase.anonKey) warnings.push('SUPABASE_ANON_KEY not set')
  
  if (warnings.length > 0) {
    console.warn('⚠️  Missing environment variables:', warnings.join(', '))
    console.warn('ℹ️  Copy .env.example to .env.local and fill in your API keys')
  }
  
  return warnings.length === 0
}

export default config
