import { NextRequest, NextResponse } from 'next/server'
import { getChatCollection, getMessagesCollection } from '@/lib/mongodb'

// GET - Retrieve a chat and its messages
export async function GET(request: NextRequest, context: any) {
  try {
    const { id } = await context.params
    
    const chatCollection = await getChatCollection()
    const messagesCollection = await getMessagesCollection()

    // Get chat document
    const chat = await chatCollection.findOne({ id })
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    // Get all messages for this chat
    const messages = await messagesCollection
      .find({ chatId: id })
      .sort({ timestamp: 1 })
      .toArray()

    return NextResponse.json({
      chat: {
        id: chat.id,
        title: chat.title,
        model: chat.model,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        metadata: chat.metadata,
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          type: msg.type,
          timestamp: msg.timestamp,
          metadata: msg.metadata,
          attachments: msg.attachments
        }))
      }
    })

  } catch (error) {
    console.error('Error retrieving chat:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve chat' },
      { status: 500 }
    )
  }
}

// PUT - Update chat title or metadata
export async function PUT(request: NextRequest, context: any) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { title, metadata } = body
    
    const chatCollection = await getChatCollection()
    
    const updateData: any = {
      updatedAt: Date.now()
    }
    
    if (title !== undefined) updateData.title = title
    if (metadata !== undefined) updateData.metadata = metadata

    const result = await chatCollection.updateOne(
      { id },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating chat:', error)
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a chat and all its messages
export async function DELETE(request: NextRequest, context: any) {
  try {
    const { id } = await context.params
    
    const chatCollection = await getChatCollection()
    const messagesCollection = await getMessagesCollection()

    // Delete all messages for this chat
    await messagesCollection.deleteMany({ chatId: id })
    
    // Delete the chat
    const result = await chatCollection.deleteOne({ id })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    )
  }
}
