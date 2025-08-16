import { NextRequest, NextResponse } from 'next/server'
import { OptimizedChatService } from '@/lib/optimized-chat-service'

// GET - Retrieve a chat and its messages
export async function GET(request: NextRequest, context: any) {
  try {
    const { id } = await context.params
    
    // Use OptimizedChatService for fast cached retrieval
    const conversation = await OptimizedChatService.getConversation(id)
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      chat: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        metadata: conversation.metadata,
        messages: conversation.messages.map((msg: any) => ({
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
    
    // Update conversation using OptimizedChatService
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (metadata !== undefined) updateData.metadata = metadata

    const success = await OptimizedChatService.updateConversation(id, updateData)

    if (!success) {
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
    
    // Delete conversation using OptimizedChatService
    const success = await OptimizedChatService.deleteConversation(id)

    if (!success) {
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
