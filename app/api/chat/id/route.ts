import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    // Lazy import MongoDB to avoid build-time errors
    const { getChatCollection, isMongoDBAvailable } = await import('@/lib/mongodb')
    
    if (!isMongoDBAvailable()) {
      return NextResponse.json(
        { error: 'MongoDB is not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { title, model } = body

    // Generate a new UUID for the chat
    const chatId = uuidv4()
    const now = Date.now()

    // Create chat document
    const chatDocument = {
      id: chatId,
      title: title || 'New Chat',
      model: model || 'GPT-4',
      createdAt: now,
      updatedAt: now,
      metadata: {}
    }

    // Save to MongoDB
    const chatCollection = await getChatCollection()
    const result = await chatCollection.insertOne(chatDocument)

    return NextResponse.json({ 
      id: chatId,
      chat: {
        ...chatDocument,
        _id: result.insertedId
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
