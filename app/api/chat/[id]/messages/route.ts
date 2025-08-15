import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getChatCollection, getMessagesCollection } from '@/lib/mongodb'

interface RouteParams {
  params: {
    id: string
  }
}

// POST - Add a new message to the chat
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: chatId } = await params
    const body = await request.json()
    const { role, content, type = 'text', metadata = {}, attachments = [] } = body

    // Verify chat exists
    const chatCollection = await getChatCollection()
    const chat = await chatCollection.findOne({ id: chatId })
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    // Create message document
    const messageId = uuidv4()
    const messageDocument = {
      id: messageId,
      chatId,
      role,
      content,
      type,
      timestamp: Date.now(),
      metadata,
      attachments
    }

    // Save message to MongoDB
    const messagesCollection = await getMessagesCollection()
    await messagesCollection.insertOne(messageDocument)

    // Update chat's updatedAt timestamp
    await chatCollection.updateOne(
      { id: chatId },
      { $set: { updatedAt: Date.now() } }
    )

    return NextResponse.json({
      message: {
        id: messageId,
        chatId,
        role,
        content,
        type,
        timestamp: messageDocument.timestamp,
        metadata,
        attachments
      }
    })

  } catch (error) {
    console.error('Error adding message:', error)
    return NextResponse.json(
      { error: 'Failed to add message' },
      { status: 500 }
    )
  }
}

// GET - Get all messages for a chat
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: chatId } = params
    
    const messagesCollection = await getMessagesCollection()
    
    const messages = await messagesCollection
      .find({ chatId })
      .sort({ timestamp: 1 })
      .toArray()

    return NextResponse.json({
      messages: messages.map(msg => ({
        id: msg.id,
        chatId: msg.chatId,
        role: msg.role,
        content: msg.content,
        type: msg.type,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
        attachments: msg.attachments
      }))
    })

  } catch (error) {
    console.error('Error retrieving messages:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve messages' },
      { status: 500 }
    )
  }
}
