import { NextRequest, NextResponse } from 'next/server'
import { Mistral } from '@mistralai/mistralai'
import { ModelInfo } from '@/lib/models-config'
import { config } from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching Mistral models...')
    
    if (!config.mistral.apiKey) {
      console.log('Mistral API key not configured, returning fallback models')
      return NextResponse.json({
        models: getFallbackMistralModels(),
        count: getFallbackMistralModels().length,
        provider: 'Mistral'
      })
    }

    console.log('API Key configured:', !!config.mistral.apiKey)
    
    const client = new Mistral({ apiKey: config.mistral.apiKey })
    
    console.log('Making request to Mistral models API...')
    const response = await client.models.list()
    
    console.log('Mistral API response received:', response.data?.length || 0, 'models')
    
    if (!response.data) {
      throw new Error('No models data received from Mistral API')
    }

    // Log sample models for debugging
    console.log('Sample models:', response.data.slice(0, 3).map(m => ({ id: m.id, owned_by: m.ownedBy })))

    const categorizedModels: ModelInfo[] = response.data.map(model => ({
      id: model.id,
      name: model.id,
      category: categorizeMistralModel(model.id),
      provider: 'Mistral'
    }))

    const categories = {
      text: categorizedModels.filter(m => m.category === 'text'),
      image: categorizedModels.filter(m => m.category === 'image'), 
      voice: categorizedModels.filter(m => m.category === 'voice')
    }


    return NextResponse.json({
      models: categorizedModels,
      count: categorizedModels.length,
      provider: 'Mistral'
    })

  } catch (error) {
    console.error('Error fetching Mistral models:', error)
    
    // Return fallback models in case of error
    return NextResponse.json({
      models: getFallbackMistralModels(),
      count: getFallbackMistralModels().length,
      provider: 'Mistral'
    })
  }
}

function categorizeMistralModel(modelId: string): 'text' | 'image' | 'voice' {
  const id = modelId.toLowerCase()
  
  // Voice models
  if (id.includes('voxtral')) {
    return 'voice'
  }
  
  // Image models  
  if (id.includes('pixtral')) {
    return 'image'
  }
  
  // All other Mistral models are text models
  return 'text'
}

function getFallbackMistralModels(): ModelInfo[] {
  return [
    // Latest models
    { id: 'mistral-large-latest', name: 'mistral-large-latest', category: 'text', provider: 'Mistral' },
    { id: 'mistral-medium-latest', name: 'mistral-medium-latest', category: 'text', provider: 'Mistral' },
    { id: 'mistral-small-latest', name: 'mistral-small-latest', category: 'text', provider: 'Mistral' },
    
    // Reasoning models
    { id: 'magistral-small-latest', name: 'magistral-small-latest', category: 'text', provider: 'Mistral' },
    { id: 'magistral-medium-latest', name: 'magistral-medium-latest', category: 'text', provider: 'Mistral' },
    
    // Code models
    { id: 'codestral-latest', name: 'codestral-latest', category: 'text', provider: 'Mistral' },
    { id: 'devstral-small-latest', name: 'devstral-small-latest', category: 'text', provider: 'Mistral' },
    { id: 'devstral-medium-latest', name: 'devstral-medium-latest', category: 'text', provider: 'Mistral' },
    
    // Image models
    { id: 'pixtral-large-latest', name: 'pixtral-large-latest', category: 'image', provider: 'Mistral' },
    { id: 'pixtral-12b-2409', name: 'pixtral-12b-2409', category: 'image', provider: 'Mistral' },
    
    // Voice models
    { id: 'voxtral-small-latest', name: 'voxtral-small-latest', category: 'voice', provider: 'Mistral' },
    { id: 'voxtral-mini-latest', name: 'voxtral-mini-latest', category: 'voice', provider: 'Mistral' },
    
    // Mini models
    { id: 'ministral-3b-latest', name: 'ministral-3b-latest', category: 'text', provider: 'Mistral' },
    { id: 'ministral-8b-latest', name: 'ministral-8b-latest', category: 'text', provider: 'Mistral' },
    
    // Open source
    { id: 'open-mistral-nemo', name: 'open-mistral-nemo', category: 'text', provider: 'Mistral' },
    
    // Other specialized
    { id: 'mistral-moderation-latest', name: 'mistral-moderation-latest', category: 'text', provider: 'Mistral' },
    { id: 'mistral-ocr-latest', name: 'mistral-ocr-latest', category: 'text', provider: 'Mistral' },
    { id: 'mistral-saba-latest', name: 'mistral-saba-latest', category: 'text', provider: 'Mistral' }
  ]
}
