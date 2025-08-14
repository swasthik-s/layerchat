import { NextRequest, NextResponse } from 'next/server'
import { Orchestrator } from '@/app/orchestrator'
import { ChatMessage } from '@/types'
import { AIGovernance } from '@/lib/governance'

// Create a global orchestrator instance
const orchestrator = new Orchestrator({
  defaultModel: 'GPT-4',
  enableAutoAgents: true,
  maxChainDepth: 3,
  timeout: 30000
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, model, settings } = body

    if (!message || !message.content) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Update governance settings if provided
    if (settings?.governance) {
      orchestrator.updateGovernanceConfig({
        defaultMode: settings.governance.mode || 'smart',
        enableGovernance: settings.governance.enabled !== false
      })
    }

    const chatMessage: ChatMessage = {
      id: message.id || `msg-${Date.now()}`,
      role: 'user',
      content: message.content,
      type: 'text',
      timestamp: Date.now()
    }

    const response = await orchestrator.processMessage(chatMessage, model, settings)

    return NextResponse.json({ response })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return available models and agents
  return NextResponse.json({
    models: orchestrator.getAvailableModels(),
    agents: orchestrator.getAvailableAgents()
  })
}
