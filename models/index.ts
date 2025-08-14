import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { AIModel, AIResponse } from '@/types'
import config from '@/lib/config'

// Dynamic OpenAI Model - can handle any OpenAI model ID
export class DynamicOpenAIModel implements AIModel {
  name: string
  provider = 'OpenAI'
  type = 'text' as const
  private client: OpenAI
  private modelId: string

  constructor(modelId: string) {
    this.modelId = modelId
    this.name = modelId
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    })
  }

  // Helper method to determine the correct token parameter for different model versions
  private getTokenParams(maxTokens?: number) {
    const tokens = maxTokens || 4000
    
    // Newer models (GPT-4o, GPT-5, o1 series) use max_completion_tokens
    if (this.modelId.includes('gpt-4o') || 
        this.modelId.includes('gpt-5') || 
        this.modelId.includes('o1') ||
        this.modelId.includes('chatgpt-4o')) {
      return { max_completion_tokens: tokens }
    }
    
    // Older models use max_tokens
    return { max_tokens: tokens }
  }

  async generate(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number; stream?: boolean }): Promise<AIResponse> {
    try {
      if (!config.openai.apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const tokenParams = this.getTokenParams(options?.maxTokens)

      const messages = typeof input === 'string'
        ? [{ role: 'user', content: input }]
        : [ { role: 'system', content: input.system }, { role: 'user', content: input.user } ]
      const completion = await this.client.chat.completions.create({
        model: this.modelId,
        messages: messages as any,
        temperature: options?.temperature || 0.7,
        ...tokenParams,
        stream: options?.stream || false,
      })

      if ('choices' in completion) {
        const content = completion.choices[0]?.message?.content || ''
        return {
          id: completion.id,
          content,
          type: 'text',
          metadata: {
            model: this.name,
            provider: this.provider,
            tokens: completion.usage?.total_tokens,
            duration: Date.now()
          }
        }
      }

      throw new Error('Invalid response from OpenAI')
    } catch (error) {
      console.error(`${this.modelId} generation error:`, error)
      throw error
    }
  }

  async generateStream(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<ReadableStream> {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const tokenParams = this.getTokenParams(options?.maxTokens)

    const messages = typeof input === 'string'
      ? [{ role: 'user', content: input }]
      : [ { role: 'system', content: input.system }, { role: 'user', content: input.user } ]
    const stream = await this.client.chat.completions.create({
      model: this.modelId,
      messages: messages as any,
      temperature: options?.temperature || 0.7,
      ...tokenParams,
      stream: true,
    })

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
                type: 'content',
                content 
              })}\n\n`))
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }
}

// Dynamic Mistral Model - can handle any Mistral model ID
export class DynamicMistralModel implements AIModel {
  name: string
  provider = 'Mistral'
  type = 'text' as const
  private modelId: string

  constructor(modelId: string) {
    this.modelId = modelId
    this.name = modelId
  }

  async generate(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number; stream?: boolean }): Promise<AIResponse> {
    try {
      if (!config.mistral.apiKey) {
        throw new Error('Mistral API key not configured')
      }

      const bodyPayload = typeof input === 'string'
        ? { model: this.modelId, messages: [{ role: 'user', content: input }], temperature: options?.temperature || 0.7, max_tokens: options?.maxTokens || 4000, stream: options?.stream || false }
        : { model: this.modelId, messages: [ { role: 'system', content: input.system }, { role: 'user', content: input.user } ], temperature: options?.temperature || 0.7, max_tokens: options?.maxTokens || 4000, stream: options?.stream || false }
      const response = await fetch(`${config.mistral.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.mistral.apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      })

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
      }

      const completion = await response.json()

      return {
        id: completion.id || `mistral-${Date.now()}`,
        content: completion.choices[0]?.message?.content || '',
        type: 'text',
        metadata: {
          model: this.name,
          provider: this.provider,
          tokens: completion.usage?.total_tokens,
          duration: Date.now()
        }
      }
    } catch (error) {
      console.error(`${this.modelId} generation error:`, error)
      throw error
    }
  }

  async generateStream(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<ReadableStream> {
    if (!config.mistral.apiKey) {
      throw new Error('Mistral API key not configured')
    }

    const response = await fetch(`${config.mistral.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.mistral.apiKey}`,
      },
      body: JSON.stringify(typeof input === 'string'
        ? { model: this.modelId, messages: [{ role: 'user', content: input }], temperature: options?.temperature || 0.7, max_tokens: options?.maxTokens || 4000, stream: true }
        : { model: this.modelId, messages: [ { role: 'system', content: input.system }, { role: 'user', content: input.user } ], temperature: options?.temperature || 0.7, max_tokens: options?.maxTokens || 4000, stream: true }),
    })

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
    }

    return new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No response body')
          }

          const decoder = new TextDecoder()
          
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) break
            
            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.close()
                  return
                }
                
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices[0]?.delta?.content || ''
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
                      type: 'content',
                      content 
                    })}\n\n`))
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }
}

// OpenAI GPT Models
export class GPT4Model implements AIModel {
  name = 'GPT-4'
  provider = 'OpenAI'
  type = 'text' as const
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    })
  }

  async generate(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number; stream?: boolean }): Promise<AIResponse> {
    try {
      if (!config.openai.apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const messages = typeof input === 'string'
        ? [{ role: 'user', content: input }]
        : [ { role: 'system', content: input.system }, { role: 'user', content: input.user } ]
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: messages as any,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 4000,
        stream: options?.stream || false,
      })

      if ('choices' in completion) {
        const content = completion.choices[0]?.message?.content || ''
        return {
          id: completion.id,
          content,
          type: 'text',
          metadata: {
            model: this.name,
            provider: this.provider,
            tokens: completion.usage?.total_tokens,
            duration: Date.now()
          }
        }
      }

      throw new Error('Invalid response from OpenAI')
    } catch (error) {
      console.error('GPT-4 generation error:', error)
      throw error
    }
  }

  async generateStream(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<ReadableStream> {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const messages = typeof input === 'string'
      ? [{ role: 'user', content: input }]
      : [ { role: 'system', content: input.system }, { role: 'user', content: input.user } ]
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: messages as any,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 4000,
      stream: true,
    })

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
                type: 'content',
                content 
              })}\n\n`))
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }
}

// Anthropic Claude Models
export class ClaudeModel implements AIModel {
  name = 'Claude-3-Sonnet'
  provider = 'Anthropic'
  type = 'text' as const
  private client: Anthropic

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    })
  }

  async generate(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<AIResponse> {
    try {
      if (!config.anthropic.apiKey) {
        throw new Error('Anthropic API key not configured')
      }

      const useInput = typeof input === 'string' ? { system: '', user: input } : input
      const combinedUser = useInput.system ? `${useInput.system}\n\nUSER: ${useInput.user}` : useInput.user
      const message = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: options?.maxTokens || 4000,
        temperature: options?.temperature || 0.7,
        messages: [{ role: 'user', content: combinedUser }],
      })

      const content = message.content[0]?.type === 'text' ? message.content[0].text : ''

      return {
        id: message.id,
        content,
        type: 'text',
        metadata: {
          model: this.name,
          provider: this.provider,
          tokens: message.usage.input_tokens + message.usage.output_tokens,
          duration: Date.now()
        }
      }
    } catch (error) {
      console.error('Claude generation error:', error)
      throw error
    }
  }

  async generateStream(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<ReadableStream> {
    if (!config.anthropic.apiKey) {
      throw new Error('Anthropic API key not configured')
    }

    const useInput = typeof input === 'string' ? { system: '', user: input } : input
    const combinedUser = useInput.system ? `${useInput.system}\n\nUSER: ${useInput.user}` : useInput.user
    const stream = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: options?.maxTokens || 4000,
      temperature: options?.temperature || 0.7,
      messages: [{ role: 'user', content: combinedUser }],
      stream: true,
    })

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const content = chunk.delta.text
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
                type: 'content',
                content 
              })}\n\n`))
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }
}

// Google Gemini Models
export class GeminiModel implements AIModel {
  name = 'Gemini-Pro'
  provider = 'Google'
  type = 'text' as const
  private client: GoogleGenAI

  constructor() {
    this.client = new GoogleGenAI({
      apiKey: config.google.apiKey
    })
  }

  async generate(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<AIResponse> {
    try {
      if (!config.google.apiKey) {
        throw new Error('Google AI API key not configured')
      }

      let contents: any
      if (typeof input === 'string') {
        contents = [{ role: 'user', parts: [{ text: input }] }]
      } else {
        // Gemini supports systemInstruction in newer API, but fallback by prepending system text
        const merged = `${input.system}\n\n${input.user}`.trim()
        contents = [{ role: 'user', parts: [{ text: merged }] }]
      }
      const response = await this.client.models.generateContent({ model: 'gemini-2.5-flash', contents })

      const content = response.text || ''

      return {
        id: `gemini-${Date.now()}`,
        content,
        type: 'text',
        metadata: {
          model: this.name,
          provider: this.provider,
          tokens: response.usageMetadata?.totalTokenCount || 0,
          duration: Date.now()
        }
      }
    } catch (error) {
      console.error('Gemini generation error:', error)
      throw error
    }
  }

  async generateStream(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<ReadableStream> {
    if (!config.google.apiKey) {
      throw new Error('Google AI API key not configured')
    }

    const client = this.client

    return new ReadableStream({
      async start(controller) {
        try {
          // Get the full response first
          let contents: any
          if (typeof input === 'string') contents = [{ role: 'user', parts: [{ text: input }] }]
          else contents = [{ role: 'user', parts: [{ text: `${input.system}\n\n${input.user}`.trim() }] }]
          const response = await client.models.generateContent({ model: 'gemini-2.5-flash', contents })
          
          const content = response.text || ''
          
          // Simulate streaming by sending content in chunks
          const words = content.split(' ')
          
          for (let i = 0; i < words.length; i++) {
            const chunk = (i > 0 ? ' ' : '') + words[i]
            
            // Send only the new chunk as SSE data
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
              type: 'content',
              content: chunk
            })}\n\n`))
            
            // Add small delay to simulate streaming (adjust as needed)
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }
}

// Dynamic Google Model - can handle any Google model ID
export class DynamicGoogleModel implements AIModel {
  name: string
  provider = 'Google'
  type = 'text' as const
  private client: GoogleGenAI
  private modelId: string

  constructor(modelId: string) {
    this.modelId = modelId
    this.name = modelId
    this.client = new GoogleGenAI({
      apiKey: config.google.apiKey
    })
  }

  async generate(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<AIResponse> {
    try {
      if (!config.google.apiKey) {
        throw new Error('Google AI API key not configured')
      }

  let contents: any
  if (typeof input === 'string') contents = [{ role: 'user', parts: [{ text: input }] }]
  else contents = [{ role: 'user', parts: [{ text: `${input.system}\n\n${input.user}`.trim() }] }]
  const response = await this.client.models.generateContent({ model: this.modelId, contents })

      const content = response.text || ''

      return {
        id: `google-${Date.now()}`,
        content,
        type: 'text',
        metadata: {
          model: this.name,
          provider: this.provider,
          tokens: response.usageMetadata?.totalTokenCount || 0,
          duration: Date.now()
        }
      }
    } catch (error) {
      console.error('Google generation error:', error)
      throw error
    }
  }

  async generateStream(input: string | { system: string; user: string }, options?: { temperature?: number; maxTokens?: number }): Promise<ReadableStream> {
    if (!config.google.apiKey) {
      throw new Error('Google AI API key not configured')
    }

    const client = this.client
    const modelId = this.modelId

    return new ReadableStream({
      async start(controller) {
        try {
          // Get the full response first
          let contents: any
          if (typeof input === 'string') contents = [{ role: 'user', parts: [{ text: input }] }]
          else contents = [{ role: 'user', parts: [{ text: `${input.system}\n\n${input.user}`.trim() }] }]
          const response = await client.models.generateContent({ model: modelId, contents })
          
          const content = response.text || ''
          
          // Simulate streaming by sending content in chunks
          const words = content.split(' ')
          
          for (let i = 0; i < words.length; i++) {
            const chunk = (i > 0 ? ' ' : '') + words[i]
            
            // Send only the new chunk as SSE data
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
              type: 'content',
              content: chunk
            })}\n\n`))
            
            // Add small delay to simulate streaming (adjust as needed)
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }
}

// OpenAI DALL-E Image Model
export class DallE3Model implements AIModel {
  name = 'DALL-E 3'
  provider = 'OpenAI'
  type = 'image' as const
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    })
  }

  async generate(input: string, options?: { size?: '1024x1024' | '1792x1024' | '1024x1792'; quality?: 'standard' | 'hd' }): Promise<AIResponse> {
    try {
      if (!config.openai.apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: input,
        n: 1,
        size: options?.size || '1024x1024',
        quality: options?.quality || 'standard',
      })

      const imageUrl = response.data?.[0]?.url
      if (!response.data || !imageUrl) {
        throw new Error('No image generated')
      }

      return {
        id: `dalle-${Date.now()}`,
        content: imageUrl,
        type: 'image',
        metadata: {
          model: this.name,
          provider: this.provider,
          prompt: input,
          size: options?.size || '1024x1024',
          quality: options?.quality || 'standard',
          duration: Date.now()
        }
      }
    } catch (error) {
      console.error('DALL-E 3 generation error:', error)
      throw error
    }
  }
}
