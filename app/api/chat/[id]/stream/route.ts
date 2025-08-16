import { NextRequest, NextResponse } from 'next/server'
import { Orchestrator } from '@/app/orchestrator'
import { ChatMessage } from '@/types'
import { ChatService } from '@/lib/chat-service'
import type { SupabaseMessage } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Create a global orchestrator instance
const orchestrator = new Orchestrator({
  defaultModel: 'GPT-4',
  enableAutoAgents: true,
  maxChainDepth: 3,
  timeout: 30000
})

export async function POST(request: NextRequest, context: any) {
  try {
    const { id: chatId } = await context.params
    const body = await request.json()
    const { message, model, settings } = body

    if (!message || !message.content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Verify chat exists using OptimizedChatService
    const conversation = await ChatService.getConversation(chatId)
    
    if (!conversation) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    // Update governance settings if provided
    if (settings?.governance) {
      orchestrator.updateGovernanceConfig({
        defaultMode: settings.governance.mode || 'smart',
        enableGovernance: settings.governance.enabled !== false
      })
    }

    // Create message for processing (user message is already saved separately)
    const chatMessage: ChatMessage = {
      id: message.id || uuidv4(),
      role: 'user',
      content: message.content,
      type: 'text',
      timestamp: Date.now()
    }

    // Process with orchestrator - this will handle streaming
    const response = await orchestrator.processMessage(chatMessage, model, settings)

    // Save assistant response using OptimizedChatService
    const assistantMessageId = uuidv4()
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: response.content,
      type: (response.type === 'code' || response.type === 'video') ? 'text' as const : (response.type || 'text') as 'text' | 'file' | 'image',
      timestamp: new Date().toISOString(),
      metadata: response.metadata || {}
    }

    // Add message using new ChatService with AI title generation
    await ChatService.addMessages(chatId, [assistantMessage])

    // Return streaming response format that matches the original chat endpoint
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Send start event
        const startData = JSON.stringify({ 
          type: 'start', 
          model: model || 'GPT-4',
          assistantMessageId 
        })
        controller.enqueue(encoder.encode(`data: ${startData}\n\n`))

        // Send content
        const contentData = JSON.stringify({
          type: 'content',
          content: response.content,
          metadata: response.metadata
        })
        controller.enqueue(encoder.encode(`data: ${contentData}\n\n`))

        // Send done event with assistant message details
        const doneData = JSON.stringify({ 
          type: 'done',
          assistantMessage: {
            id: assistantMessageId,
            chatId,
            role: 'assistant',
            content: response.content,
            type: response.type || 'text',
            timestamp: Date.now(),
            metadata: response.metadata
          }
        })
        controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
        
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Chat stream API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
