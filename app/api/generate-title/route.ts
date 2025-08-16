import { NextRequest, NextResponse } from 'next/server'
import { TitleGenerator } from '@/lib/title-generator'

// POST /api/generate-title - Test title generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userMessage, assistantResponse, method = 'local' } = body

    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      )
    }

    let title = ''
    const startTime = Date.now()

    if (method === 'ai') {
      // Test AI-powered title generation
      title = await TitleGenerator.generateTitle({
        userMessage,
        assistantResponse,
        conversationLength: assistantResponse ? 2 : 1
      })
    } else {
      // Test local title generation
      title = TitleGenerator.generateLocalTitle(userMessage, assistantResponse)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      title,
      method,
      duration: `${duration}ms`,
      input: {
        userMessage: userMessage.slice(0, 100) + (userMessage.length > 100 ? '...' : ''),
        hasAssistantResponse: !!assistantResponse
      }
    })

  } catch (error) {
    console.error('Title generation test failed:', error)
    return NextResponse.json(
      { 
        error: 'Title generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
