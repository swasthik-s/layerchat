import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'
import { TitleGenerator } from './title-generator'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const redisUrl = process.env.UPSTASH_REDIS_REST_URL!
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!

// Supabase client (server-side with service role)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Redis client
const redis = new Redis({
  url: redisUrl,
  token: redisToken,
})

// Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'text' | 'file' | 'image'
  timestamp: string
  metadata?: Record<string, any>
}

export interface ChatConversation {
  id: string
  title: string
  model: string
  messages: ChatMessage[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Unified Chat Service
export class ChatService {
  
  // Create new conversation with smart title
  static async createConversation(
    title: string, 
    model: string, 
    initialMessages: ChatMessage[] = []
  ): Promise<ChatConversation> {
    const conversationId = nanoid()
    
    // Generate smart title if we have initial messages
    let smartTitle = title
    if (initialMessages.length > 0 && title === 'New Chat') {
      smartTitle = TitleGenerator.quickTitle(
        initialMessages.find(m => m.role === 'user')?.content || title
      )
    }
    
    const conversation = {
      id: conversationId,
      title: smartTitle,
      model,
      messages: initialMessages,
      metadata: {}
    }

    try {
      // Save to Supabase
      const { data, error } = await supabase
        .from('conversations')
        .insert([conversation])
        .select()
        .single()

      if (error) throw error

      const savedConversation = data as ChatConversation

      // Cache in Redis (5 minute TTL)
      await redis.setex(`conversation:${conversationId}`, 300, savedConversation)
      
      // Invalidate conversation list cache
      await redis.del('conversations:list')
      
      console.log(`💬 Created conversation with smart title: "${smartTitle}"`)
      return savedConversation
    } catch (error) {
      console.error('Failed to create conversation:', error)
      throw error
    }
  }

  // Get conversation (Redis first, fallback to Supabase)
  static async getConversation(conversationId: string): Promise<ChatConversation | null> {
    try {
      // Try Redis first
      const cached = await redis.get(`conversation:${conversationId}`) as ChatConversation | null
      
      if (cached) {
        console.log('📦 Conversation loaded from Redis cache')
        return cached
      }

      // Fallback to Supabase
      console.log('🗄️ Loading conversation from Supabase')
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (error || !data) return null

      const conversation = data as ChatConversation
      
      // Cache for next time
      await redis.setex(`conversation:${conversationId}`, 300, conversation)
      
      return conversation
    } catch (error) {
      console.error('Failed to get conversation:', error)
      return null
    }
  }

  // Get conversation list
  static async getConversationList(): Promise<ChatConversation[]> {
    try {
      // Try Redis cache first
      const cached = await redis.get('conversations:list') as ChatConversation[] | null
      
      if (cached && cached.length >= 0) {
        console.log('📦 Conversation list loaded from Redis cache')
        return cached
      }

      // Load from Supabase
      console.log('🗄️ Loading conversation list from Supabase')
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, model, created_at, updated_at')
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Convert to full conversation objects with empty messages
      const conversations: ChatConversation[] = (data || []).map(conv => ({
        ...conv,
        messages: [],
        metadata: {}
      }))
      
      // Cache for 1 minute
      await redis.setex('conversations:list', 60, conversations)
      
      return conversations
    } catch (error) {
      console.error('Failed to get conversation list:', error)
      return []
    }
  }

  // Add messages to conversation with smart title generation
  static async addMessages(
    conversationId: string, 
    messages: ChatMessage[]
  ): Promise<ChatConversation | null> {
    try {
      // Get current conversation
      const conversation = await this.getConversation(conversationId)
      if (!conversation) return null

      // Append new messages
      const updatedMessages = [...conversation.messages, ...messages]

      // Generate smart title after first user-assistant exchange
      let updatedTitle = conversation.title
      const hasUserAssistantPair = updatedMessages.length >= 2 && 
        updatedMessages.some(m => m.role === 'user') && 
        updatedMessages.some(m => m.role === 'assistant')
      
      if (hasUserAssistantPair && updatedMessages.length <= 4) {
        const smartTitle = await this.generateSmartTitle(updatedMessages)
        if (smartTitle && smartTitle !== 'New Chat') {
          updatedTitle = smartTitle
        }
      }

      // Update in Supabase
      const { data, error } = await supabase
        .from('conversations')
        .update({ 
          messages: updatedMessages,
          title: updatedTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .select()
        .single()

      if (error) throw error

      const updatedConversation = data as ChatConversation

      // Update cache
      await redis.setex(`conversation:${conversationId}`, 300, updatedConversation)
      
      // Invalidate list cache
      await redis.del('conversations:list')
      
      return updatedConversation
    } catch (error) {
      console.error('Failed to add messages:', error)
      return null
    }
  }

  // Generate smart title based on conversation context
  private static async generateSmartTitle(messages: ChatMessage[]): Promise<string> {
    try {
      if (messages.length < 2) return 'New Chat'
      
      const userMessage = messages.find(m => m.role === 'user')?.content || ''
      const assistantMessage = messages.find(m => m.role === 'assistant')?.content || ''
      
      // Try AI generation first (if API key available), fallback to local
      try {
        if (process.env.MISTRAL_API_KEY) {
          const result = await TitleGenerator.generateSmartTitle(userMessage, assistantMessage, true)
          console.log(`🤖 Generated AI title: "${result.title}" (method: ${result.method})`)
          return result.title
        }
      } catch (error) {
        console.error('AI title generation failed, using local fallback:', error)
      }
      
      // Fallback to local generation
      const result = await TitleGenerator.generateSmartTitle(userMessage, assistantMessage, false)
      console.log(`🎯 Generated local title: "${result.title}" (method: ${result.method})`)
      return result.title
      
    } catch (error) {
      console.error('Title generation failed:', error)
      return 'New Chat'
    }
  }

  // Delete conversation
  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (error) throw error

      // Remove from cache
      await redis.del(`conversation:${conversationId}`)
      await redis.del('conversations:list')
      
      return true
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      return false
    }
  }

  // Update conversation (title, metadata)
  static async updateConversation(
    conversationId: string, 
    updates: Partial<Pick<ChatConversation, 'title' | 'metadata'>>
  ): Promise<boolean> {
    try {
      // Update in Supabase
      const { error } = await supabase
        .from('conversations')
        .update({ 
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (error) throw error

      // Invalidate cache
      await redis.del(`conversation:${conversationId}`)
      await redis.del('conversations:list')
      
      return true
    } catch (error) {
      console.error('Failed to update conversation:', error)
      return false
    }
  }

  // Temporary message storage for streaming
  static async storeTempMessage(messageId: string, message: ChatMessage): Promise<void> {
    await redis.setex(`temp:message:${messageId}`, 300, message)
  }

  static async getTempMessage(messageId: string): Promise<ChatMessage | null> {
    return await redis.get(`temp:message:${messageId}`) as ChatMessage | null
  }

  static async deleteTempMessage(messageId: string): Promise<void> {
    await redis.del(`temp:message:${messageId}`)
  }

  // Health check
  static async healthCheck(): Promise<{ supabase: boolean; redis: boolean }> {
    const health = { supabase: false, redis: false }
    
    try {
      await supabase.from('conversations').select('count').limit(1)
      health.supabase = true
    } catch (error) {
      console.error('Supabase health check failed:', error)
    }
    
    try {
      await redis.ping()
      health.redis = true
    } catch (error) {
      console.error('Redis health check failed:', error)
    }
    
    return health
  }

  // Manually regenerate title for existing conversation
  static async regenerateTitle(conversationId: string): Promise<string | null> {
    try {
      const conversation = await this.getConversation(conversationId)
      if (!conversation || conversation.messages.length < 1) return null
      
      const newTitle = await this.generateSmartTitle(conversation.messages)
      
      // Update the conversation with new title
      await this.updateConversation(conversationId, { title: newTitle })
      
      console.log(`🔄 Regenerated title for ${conversationId}: "${newTitle}"`)
      return newTitle
    } catch (error) {
      console.error('Failed to regenerate title:', error)
      return null
    }
  }

  // Clear all cache (for debugging)
  static async clearCache(): Promise<void> {
    try {
      // Get all conversation keys
      const conversationKeys = await redis.keys('conversation:*')
      const tempKeys = await redis.keys('temp:*')
      const listKeys = ['conversations:list']
      
      const allKeys = [...conversationKeys, ...tempKeys, ...listKeys]
      
      if (allKeys.length > 0) {
        await redis.del(...allKeys)
        console.log(`🗑️ Cleared ${allKeys.length} cache keys`)
      }
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }
}

// Export types for convenience
export type { ChatMessage as SupabaseMessage, ChatConversation as SupabaseConversation }
