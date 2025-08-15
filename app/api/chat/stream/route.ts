import { NextRequest } from 'next/server'
import { Orchestrator } from '@/app/orchestrator'
import { ChatMessage } from '@/types'
import { validateConfig } from '@/lib/config'
import { AIGovernance } from '@/lib/governance'

// Use Node.js runtime for full compatibility
export const runtime = 'nodejs'

const orchestrator = new Orchestrator({
  defaultModel: 'GPT-4',
  enableAutoAgents: true,
  maxChainDepth: 3,
  timeout: 30000
})

// Handle CORS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    // Validate configuration
    validateConfig()
    
    const body = await request.json()
    const { message, model, settings } = body

    if (!message || !message.content) {
      return new Response(
        JSON.stringify({ error: 'Message content is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const chatMessage: ChatMessage = {
      id: message.id || `msg-${Date.now()}`,
      role: 'user',
      content: message.content,
      type: 'text',
      timestamp: Date.now()
    }

    // Update governance settings if provided
    if (settings?.governance) {
      orchestrator.updateGovernanceConfig({
        defaultMode: settings.governance.mode || 'smart',
        enableGovernance: settings.governance.enabled !== false
      })
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial response
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: 'start',
                timestamp: Date.now(),
                model: model || 'GPT-4'
              })}\n\n`
            )
          )

          // Process with orchestrator
          const response = await orchestrator.processMessageStream(
            chatMessage, 
            model,
            settings
          )

          // Stream the response
          if (response.stream) {
            const reader = response.stream.getReader()
            
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) break
              
              controller.enqueue(value)
            }
          } else {
            // Non-streaming response
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ 
                  type: 'content',
                  content: response.content,
                  metadata: response.metadata
                })}\n\n`
              )
            )
          }

          // Send completion signal
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: 'done',
                timestamp: Date.now()
              })}\n\n`
            )
          )

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error'
              })}\n\n`
            )
          )
          
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })

  } catch (error) {
    console.error('Stream API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
