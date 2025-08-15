import { NextRequest, NextResponse } from 'next/server'
import { Orchestrator } from '@/app/orchestrator'
import { ChatMessage } from '@/types'
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
    // Lazy import MongoDB to avoid build-time errors
    const { getChatCollection, getMessagesCollection, isMongoDBAvailable } = await import('@/lib/mongodb')
    
    const { id: chatId } = await context.params
    const body = await request.json()
    const { message, model, settings } = body

    if (!message || !message.content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Verify chat exists
    const chatCollection = await getChatCollection()
    const chat = await chatCollection.findOne({ id: chatId })
    
    if (!chat) {
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

    // Save assistant response to MongoDB
    const assistantMessageId = uuidv4()
    const messagesCollection = await getMessagesCollection()
    await messagesCollection.insertOne({
      id: assistantMessageId,
      chatId,
      role: 'assistant',
      content: response.content,
      type: response.type || 'text',
      timestamp: Date.now(),
      metadata: response.metadata || {},
      attachments: []
    })

    // Update chat's updatedAt timestamp
    await chatCollection.updateOne(
      { id: chatId },
      { $set: { updatedAt: Date.now() } }
    )

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
