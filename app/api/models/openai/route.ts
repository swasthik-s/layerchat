import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import config from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching OpenAI models...')
    console.log('API Key configured:', !!config.openai.apiKey)
    
    if (!config.openai.apiKey) {
      console.error('OpenAI API key not configured')
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: config.openai.apiKey,
    })

  
    
    // Fetch models from OpenAI API exactly as shown in documentation
    const response = await openai.models.list()
  
    
    // Categorize models by type
    const textModels = response.data.filter(model => {
      const modelId = model.id.toLowerCase()
      return (
        modelId.includes('gpt') && 
        !modelId.includes('dall-e') && 
        !modelId.includes('whisper') && 
        !modelId.includes('tts') &&
        !modelId.includes('image') &&
        !modelId.includes('transcribe') &&
        !modelId.includes('realtime') // These are for real-time audio
      )
    })

    const imageModels = response.data.filter(model => {
      const modelId = model.id.toLowerCase()
      return (
        modelId.includes('dall-e') || 
        modelId.includes('image')
      )
    })

    const voiceModels = response.data.filter(model => {
      const modelId = model.id.toLowerCase()
      return (
        modelId.includes('tts') || 
        modelId.includes('whisper') ||
        modelId.includes('audio') ||
        modelId.includes('transcribe')
      )
    })

    // Format all models with categories
    const models = [
      ...textModels.map(model => ({
        name: model.id,
        provider: 'OpenAI',
        category: 'text',
        id: model.id,
        created: model.created,
        owned_by: model.owned_by
      })),
      ...imageModels.map(model => ({
        name: model.id,
        provider: 'OpenAI',
        category: 'image',
        id: model.id,
        created: model.created,
        owned_by: model.owned_by
      })),
      ...voiceModels.map(model => ({
        name: model.id,
        provider: 'OpenAI',
        category: 'voice',
        id: model.id,
        created: model.created,
        owned_by: model.owned_by
      }))
    ].sort((a, b) => {
      // Sort by category first, then by name
      if (a.category !== b.category) {
        const categoryOrder = { text: 0, image: 1, voice: 2 }
        return categoryOrder[a.category as keyof typeof categoryOrder] - categoryOrder[b.category as keyof typeof categoryOrder]
      }
      return a.name.localeCompare(b.name)
    })



    return NextResponse.json({ models })

  } catch (error) {
    console.error('OpenAI models API error:', error)
    
    // Return fallback models if API fails
    const fallbackModels = [
      // Text models
      { name: 'gpt-4', provider: 'OpenAI', category: 'text' },
      { name: 'gpt-4-turbo', provider: 'OpenAI', category: 'text' },
      { name: 'gpt-4o', provider: 'OpenAI', category: 'text' },
      { name: 'gpt-4o-mini', provider: 'OpenAI', category: 'text' },
      { name: 'gpt-3.5-turbo', provider: 'OpenAI', category: 'text' },
      // Image models
      { name: 'dall-e-3', provider: 'OpenAI', category: 'image' },
      { name: 'dall-e-2', provider: 'OpenAI', category: 'image' },
      // Voice models
      { name: 'tts-1', provider: 'OpenAI', category: 'voice' },
      { name: 'tts-1-hd', provider: 'OpenAI', category: 'voice' },
      { name: 'whisper-1', provider: 'OpenAI', category: 'voice' }
    ]
    
    console.log('Using fallback models:', fallbackModels.length)
    return NextResponse.json({ models: fallbackModels })
  }
}
