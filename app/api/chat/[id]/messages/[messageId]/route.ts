import { NextRequest, NextResponse } from 'next/server'
import { OptimizedChatService } from '@/lib/optimized-chat-service'

// DELETE - Delete a specific message
export async function DELETE(request: NextRequest, context: any) {
  try {
    const { id: chatId, messageId } = context.params
    
    // Delete message using OptimizedChatService
    const success = await OptimizedChatService.deleteMessage(chatId, messageId)

    if (!success) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    )
  }
}

// PATCH - Partially update a specific message (supports soft delete)
export async function PATCH(request: NextRequest, context: any) {
  try {
    const { id: chatId, messageId } = await context.params
    const body = await request.json()
    
    console.log('📥 PATCH /api/chat/[id]/messages/[messageId] - Received:', {
      chatId,
      messageId,
      updates: Object.keys(body)
    })
    
    // Build update object with only provided fields
    const updateData: any = {}
    if (body.content !== undefined) updateData.content = body.content
    if (body.metadata !== undefined) updateData.metadata = body.metadata
    if (body.deleted !== undefined) updateData.deleted = body.deleted
    if (body.embedding !== undefined) updateData.embedding = body.embedding

    // Update message using OptimizedChatService
    const success = await OptimizedChatService.updateMessage(chatId, messageId, updateData)

    if (!success) {
      console.log('❌ Message not found for PATCH:', { messageId, chatId })
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    console.log('✅ Message updated via PATCH:', { messageId })

    return NextResponse.json({ success: true, updated: updateData })

  } catch (error) {
    console.error('❌ Error in PATCH message:', error)
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    )
  }
}

// PUT - Update a specific message
export async function PUT(request: NextRequest, context: any) {
  try {
    const { id: chatId, messageId } = context.params
    const body = await request.json()
    const { content, metadata } = body
    
    const updateData: any = {}
    if (content !== undefined) updateData.content = content
    if (metadata !== undefined) updateData.metadata = metadata

    // Update message using OptimizedChatService
    const success = await OptimizedChatService.updateMessage(chatId, messageId, updateData)

    if (!success) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating message:', error)
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    )
  }
}
