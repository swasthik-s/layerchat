import { NextRequest, NextResponse } from 'next/server'
import { getChatCollection } from '@/lib/mongodb'

// GET - List all chats (for sidebar)
export async function GET(request: NextRequest) {
  try {
    const chatCollection = await getChatCollection()
    
    const chats = await chatCollection
      .find({})
      .sort({ updatedAt: -1 })
      .limit(50) // Limit to 50s most recent chats
      .toArray()

    const formattedChats = chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
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
