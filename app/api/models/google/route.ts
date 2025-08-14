import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Google AI available models based on their official documentation
    const models = [
      { name: 'gemini-2.5-flash', provider: 'Google' },
      { name: 'gemini-1.5-pro', provider: 'Google' },
      { name: 'gemini-1.5-flash', provider: 'Google' },
      { name: 'gemini-pro', provider: 'Google' },
    ]

    return NextResponse.json({ models })

  } catch (error) {
    console.error('Google models API error:', error)
    
    // Return fallback models
    const fallbackModels = [
      { name: 'gemini-2.5-flash', provider: 'Google' },
      { name: 'gemini-1.5-pro', provider: 'Google' }
    ]
    
    return NextResponse.json({ models: fallbackModels })
  }
}
