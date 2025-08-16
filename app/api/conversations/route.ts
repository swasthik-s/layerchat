import { NextRequest, NextResponse } from 'next/server'
import { ChatService } from '@/lib/chat-service'

// GET /api/conversations - Get all conversations
export async function GET() {
  try {
    const conversations = await ChatService.getConversationList()
    
    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length
    })
  } catch (error) {
    console.error('Failed to get conversations:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversations' 
      },
      { status: 500 }
    )
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, model = 'gpt-4', messages = [] } = body

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      )
    }

    const conversation = await ChatService.createConversation(title, model, messages)
    
    return NextResponse.json({
      success: true,
      conversation,
      id: conversation.id
    })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create conversation' 
      },
      { status: 500 }
    )
  }
}
