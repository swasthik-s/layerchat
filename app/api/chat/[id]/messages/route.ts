import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { ChatService } from '@/lib/chat-service'
import type { SupabaseMessage } from '@/lib/supabase'

// POST - Add a new message to the chat
export async function POST(request: NextRequest, context: any) {
  try {
    const { id: chatId } = await context.params
    const body = await request.json()
    const { id: messageId, role, content, type = 'text', metadata = {}, attachments = [] } = body

    console.log('📥 POST /api/chat/[id]/messages - Received:', {
      chatId,
      messageId: messageId || 'auto-generated',
      role,
      contentLength: content?.length,
      type
    })

    // Verify chat exists using ChatService
    const conversation = await ChatService.getConversation(chatId)
    
    if (!conversation) {
      console.log('❌ Chat not found:', chatId)
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    console.log('✅ Chat found:', conversation.id)

    // Use provided ID or generate new one
    const finalMessageId = messageId || uuidv4()
    const message = {
      id: finalMessageId,
      role,
      content,
      type,
      timestamp: new Date().toISOString(),
      metadata,
      attachments: attachments || []
    }

    console.log('💾 Saving message:', {
      id: finalMessageId,
      chatId,
      role,
      contentLength: content?.length
    })

    // Add message using ChatService with AI title generation
    await ChatService.addMessages(chatId, [message])
    
    console.log('✅ Message saved successfully')

    return NextResponse.json({
      message: {
        id: finalMessageId,
        chatId,
        role,
        content,
        type,
        timestamp: message.timestamp,
        metadata,
        attachments
      }
    })

  } catch (error) {
    console.error('❌ Error adding message:', error)
    return NextResponse.json(
      { error: 'Failed to add message' },
      { status: 500 }
    )
  }
}

// GET - Get all messages for a chat
export async function GET(request: NextRequest, context: any) {
  try {
    const { id: chatId } = context.params
    
    // Get conversation with messages using ChatService
    const conversation = await ChatService.getConversation(chatId)
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      messages: conversation.messages.map((msg: any) => ({
        id: msg.id,
        chatId: chatId,
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
