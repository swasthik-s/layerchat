import { NextRequest, NextResponse } from 'next/server'
import { ChatService } from '@/lib/chat-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, model } = body

    // Create conversation using ChatService
    const conversation = await ChatService.createConversation(
      title || 'New Chat',
      model || 'GPT-4',
      [] // No initial messages
    )

    return NextResponse.json({ 
      id: conversation.id,
      chat: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        metadata: conversation.metadata,
        messages: conversation.messages
      }
    })

  } catch (error) {
    console.error('Error creating chat:', error)
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    )
  }
}
