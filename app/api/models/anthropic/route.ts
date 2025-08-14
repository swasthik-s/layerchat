import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Anthropic doesn't have a public models API endpoint like OpenAI
    // So we'll return the known available models
    const models = [
      { name: 'claude-3-opus-20240229', provider: 'Anthropic' },
      { name: 'claude-3-sonnet-20240229', provider: 'Anthropic' },
      { name: 'claude-3-haiku-20240307', provider: 'Anthropic' },
      { name: 'claude-2.1', provider: 'Anthropic' },
      { name: 'claude-2.0', provider: 'Anthropic' },
      { name: 'claude-instant-1.2', provider: 'Anthropic' }
    ]

    return NextResponse.json({ models })

  } catch (error) {
    console.error('Anthropic models API error:', error)
    
    // Return fallback models
    const fallbackModels = [
      { name: 'claude-3-sonnet-20240229', provider: 'Anthropic' },
      { name: 'claude-3-haiku-20240307', provider: 'Anthropic' }
    ]
    
    return NextResponse.json({ models: fallbackModels })
  }
}
