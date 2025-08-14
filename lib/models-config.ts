// Organized models by provider
export const MODELS_BY_PROVIDER: { [key: string]: ModelInfo[] } = {
  'OpenAI': [
    { name: 'GPT-4', provider: 'OpenAI', category: 'text' },
    { name: 'GPT-4-Turbo', provider: 'OpenAI', category: 'text' },
    { name: 'GPT-3.5-Turbo', provider: 'OpenAI', category: 'text' },
    { name: 'DALL-E 3', provider: 'OpenAI', category: 'image' }
  ],
  'Anthropic': [
    { name: 'Claude-3-Opus', provider: 'Anthropic', category: 'text' },
    { name: 'Claude-3-Sonnet', provider: 'Anthropic', category: 'text' },
    { name: 'Claude-3-Haiku', provider: 'Anthropic', category: 'text' }
  ],
  'Google': [
    { name: 'Gemini-Pro', provider: 'Google', category: 'text' },
    { name: 'Gemini-Pro-Vision', provider: 'Google', category: 'text' },
    { name: 'PaLM-2', provider: 'Google', category: 'text' }
  ],
  'Mistral': [
    { name: 'Mistral-Large', provider: 'Mistral', category: 'text' },
    { name: 'Mistral-Medium', provider: 'Mistral', category: 'text' },
    { name: 'Mistral-Small', provider: 'Mistral', category: 'text' }
  ]
}

// Define the model interface
export interface ModelInfo {
  name: string
  provider: string
  category?: 'text' | 'image' | 'voice'
  id?: string
  created?: number
  owned_by?: string
}

// Cache for fetched models
let modelsCache: { [key: string]: ModelInfo[] } = {}

// Fetch models from OpenAI API
async function fetchOpenAIModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('/api/models/openai')
    if (response.ok) {
      const data = await response.json()
      return data.models || MODELS_BY_PROVIDER.OpenAI
    }
  } catch (error) {
    console.error('Failed to fetch OpenAI models:', error)
  }
  return MODELS_BY_PROVIDER.OpenAI
}

// Fetch models from Anthropic API
async function fetchAnthropicModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('/api/models/anthropic')
    if (response.ok) {
      const data = await response.json()
      return data.models || MODELS_BY_PROVIDER.Anthropic
    }
  } catch (error) {
    console.error('Failed to fetch Anthropic models:', error)
  }
  return MODELS_BY_PROVIDER.Anthropic
}

// Fetch models from Google API
async function fetchGoogleModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('/api/models/google')
    if (response.ok) {
      const data = await response.json()
      return data.models || MODELS_BY_PROVIDER.Google
    }
  } catch (error) {
    console.error('Failed to fetch Google models:', error)
  }
  return MODELS_BY_PROVIDER.Google
}

// Fetch models from Mistral API
async function fetchMistralModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch('/api/models/mistral')
    if (response.ok) {
      const data = await response.json()
      return data.models || MODELS_BY_PROVIDER.Mistral
    }
  } catch (error) {
    console.error('Failed to fetch Mistral models:', error)
  }
  return MODELS_BY_PROVIDER.Mistral
}

// Get list of providers
export function getProviders() {
  return Object.keys(MODELS_BY_PROVIDER)
}

// Get models for a specific provider (with caching and API fetching)
export async function getModelsByProvider(provider: string): Promise<ModelInfo[]> {
  console.log('getModelsByProvider called with:', provider)
  
  // Check cache first
  if (modelsCache[provider]) {
    console.log('Returning cached models for:', provider, modelsCache[provider])
    return modelsCache[provider]
  }

  let models: ModelInfo[] = []

  try {
    switch (provider) {
      case 'OpenAI':
        console.log('Fetching OpenAI models...')
        models = await fetchOpenAIModels()
        break
      case 'Anthropic':
        console.log('Fetching Anthropic models...')
        models = await fetchAnthropicModels()
        break
      case 'Google':
        console.log('Fetching Google models...')
        models = await fetchGoogleModels()
        break
      case 'Mistral':
        console.log('Fetching Mistral models...')
        models = await fetchMistralModels()
        break
      default:
        console.log('Using hardcoded models for provider:', provider)
        models = MODELS_BY_PROVIDER[provider as keyof typeof MODELS_BY_PROVIDER] || []
    }

    console.log('Final models for', provider, ':', models)
    
    // Cache the results
    modelsCache[provider] = models
    return models
  } catch (error) {
    console.error('Error in getModelsByProvider:', error)
    return MODELS_BY_PROVIDER[provider as keyof typeof MODELS_BY_PROVIDER] || []
  }
}

// Get models for a specific provider (synchronous fallback)
export function getModelsByProviderSync(provider: string): ModelInfo[] {
  return modelsCache[provider] || MODELS_BY_PROVIDER[provider as keyof typeof MODELS_BY_PROVIDER] || []
}

// List of available models (backwards compatibility)
export const AVAILABLE_MODELS = [
  { name: 'GPT-4', provider: 'OpenAI' },
  { name: 'Claude-3-Sonnet', provider: 'Anthropic' },
  { name: 'Gemini-Pro', provider: 'Google' },
  { name: 'DALL-E 3', provider: 'OpenAI' },
  // Add more models here as needed
]

// Simulate fetching models (could be replaced with API call)
export async function fetchAvailableModels() {
  return AVAILABLE_MODELS
}
