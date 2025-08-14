// Core AI Model Interface
export interface AIModel {
  name: string
  provider: string
  type: 'text' | 'image' | 'video' | 'code'
  generate(input: any, options?: object): Promise<AIResponse>
}

// AI Response Interface
export interface AIResponse {
  id: string
  content: string | Buffer | Blob
  type: 'text' | 'image' | 'video' | 'code' | 'file'
  metadata?: {
    model?: string
    provider?: string
    tokens?: number
    duration?: number
    [key: string]: any
  }
  streaming?: boolean
}

// Agent Interface
export interface Agent {
  name: string
  description: string
  trigger: string | RegExp
  run(input: any): Promise<AgentResponse>
}

// Agent Response Interface
export interface AgentResponse {
  id: string
  data: any
  type: 'json' | 'text' | 'media' | 'file'
  metadata?: {
    source?: string
    timestamp?: number
    [key: string]: any
  }
}

// Chat Message Interface
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'text' | 'image' | 'video' | 'code' | 'file'
  timestamp: number
  metadata?: {
    model?: string
    agent?: string
    tokens?: number
  concise?: string // short direct answer extracted
  full?: string // full explanation text
  explanationAvailable?: boolean
    [key: string]: any
  }
  attachments?: MessageAttachment[]
}

// Message Attachment Interface
export interface MessageAttachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  preview?: string
}

// Chat Session Interface
export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: number
  updatedAt: number
  metadata?: {
    [key: string]: any
  }
}

// Model Provider Configuration
export interface ModelProvider {
  name: string
  apiKey?: string
  baseUrl?: string
  models: AIModel[]
}

// Orchestrator Configuration
export interface OrchestratorConfig {
  defaultModel: string
  enableAutoAgents: boolean
  maxChainDepth: number
  timeout: number
}
