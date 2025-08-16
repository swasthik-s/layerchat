import { NextRequest, NextResponse } from 'next/server'
import { ChatService } from '@/lib/chat-service'

// GET - List all chats (for sidebar)
export async function GET(request: NextRequest) {
  try {
    // Use ChatService for fast cached retrieval
    const conversations = await ChatService.getConversationList()
    
    const formattedChats = conversations.map((chat: any) => ({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      metadata: chat.metadata,
      messages: [] // Don't include messages in list view for performance
    }))

    return NextResponse.json({ chats: formattedChats })

  } catch (error) {
    console.error('Error retrieving chats:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve chats' },
      { status: 500 }
    )
  }
}
