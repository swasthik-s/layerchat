import { NextRequest, NextResponse } from 'next/server'
import { ChatService } from '@/lib/chat-service'

// GET /api/conversations/[id] - Get specific conversation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversation = await ChatService.getConversation(params.id)
    
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      conversation
    })
  } catch (error) {
    console.error('Failed to get conversation:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversation' 
      },
      { status: 500 }
    )
  }
}

// PATCH /api/conversations/[id] - Add messages to conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: 'Messages array is required' },
        { status: 400 }
      )
    }

    const conversation = await ChatService.addMessages(params.id, messages)
    
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Failed to update conversation' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      conversation
    })
  } catch (error) {
    console.error('Failed to add messages:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add messages' 
      },
      { status: 500 }
    )
  }
}

// DELETE /api/conversations/[id] - Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await ChatService.deleteConversation(params.id)
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete conversation' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete conversation' 
      },
      { status: 500 }
    )
  }
}
