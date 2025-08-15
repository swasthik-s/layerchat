import { NextRequest, NextResponse } from 'next/server'

// DELETE - Delete a specific message
export async function DELETE(request: NextRequest, context: any) {
  try {
    // Lazy import MongoDB to avoid build-time errors
    const { getMessagesCollection, getChatCollection, isMongoDBAvailable } = await import('@/lib/mongodb')
    
    if (!isMongoDBAvailable()) {
      return NextResponse.json(
        { error: 'MongoDB is not configured' },
        { status: 500 }
      )
    }

    const { id: chatId, messageId } = context.params
    
    const messagesCollection = await getMessagesCollection()
    
    // Delete the message
    const result = await messagesCollection.deleteOne({
      id: messageId,
      chatId: chatId
    })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Update chat's updatedAt timestamp
    const chatCollection = await getChatCollection()
    await chatCollection.updateOne(
      { id: chatId },
      { $set: { updatedAt: Date.now() } }
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    )
  }
}

// PUT - Update a specific message
export async function PUT(request: NextRequest, context: any) {
  try {
    // Lazy import MongoDB to avoid build-time errors
    const { getMessagesCollection, getChatCollection, isMongoDBAvailable } = await import('@/lib/mongodb')
    
    if (!isMongoDBAvailable()) {
      return NextResponse.json(
        { error: 'MongoDB is not configured' },
        { status: 500 }
      )
    }

    const { id: chatId, messageId } = context.params
    const body = await request.json()
    const { content, metadata } = body
    
    const messagesCollection = await getMessagesCollection()
    
    const updateData: any = {}
    if (content !== undefined) updateData.content = content
    if (metadata !== undefined) updateData.metadata = metadata

    const result = await messagesCollection.updateOne(
      { id: messageId, chatId: chatId },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    // Update chat's updatedAt timestamp
    const chatCollection = await getChatCollection()
    await chatCollection.updateOne(
      { id: chatId },
      { $set: { updatedAt: Date.now() } }
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating message:', error)
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    )
  }
}
