import { SupabaseChatStorage, SupabaseConversation, SupabaseMessage } from './supabase'
import { RedisChatCache } from './redis'
import { RealTimeSync } from './realtime-sync'
import { nanoid } from 'nanoid'

// Hybrid storage: Supabase for persistence + Redis for speed
export class OptimizedChatService {
  
  // Create new conversation (optimized flow)
  static async createConversation(
    title: string, 
    model: string, 
    initialMessages: SupabaseMessage[] = []
  ): Promise<SupabaseConversation> {
    const conversationId = nanoid()
    
    const conversation: Omit<SupabaseConversation, 'created_at' | 'updated_at'> = {
      id: conversationId,
      title,
      model,
      messages: initialMessages,
      metadata: {}
    }

    try {
      // Save to Supabase (source of truth)
      const savedConversation = await SupabaseChatStorage.createConversation(conversation)
      
      // Cache in Redis for fast access
      await RedisChatCache.cacheConversation(conversationId, savedConversation, 3600)
      
      // Invalidate conversation list cache
      await RedisChatCache.invalidateConversationList('default') // TODO: Use actual user ID
      
      return savedConversation
    } catch (error) {
      console.error('Failed to create conversation:', error)
      throw error
    }
  }

  // Get conversation (Redis first, fallback to Supabase)
  static async getConversation(conversationId: string): Promise<SupabaseConversation | null> {
    try {
      // Try Redis first (fast path)
      let conversation = await RedisChatCache.getCachedConversation(conversationId) as SupabaseConversation | null
      
      if (conversation) {
        console.log('📦 Conversation loaded from Redis cache')
        return conversation
      }

      // Fallback to Supabase (slow path)
      console.log('🗄️ Conversation not in cache, loading from Supabase')
      conversation = await SupabaseChatStorage.getConversation(conversationId)
      
      if (conversation) {
        // Cache for next time
        await RedisChatCache.cacheConversation(conversationId, conversation, 300)
      }
      
      return conversation
    } catch (error) {
      console.error('Failed to get conversation:', error)
      return null
    }
  }

  // Add messages to conversation (batch operation)
  static async addMessages(
    conversationId: string, 
    messages: SupabaseMessage[]
  ): Promise<SupabaseConversation | null> {
    try {
      // Update in Supabase
      const updatedConversation = await SupabaseChatStorage.appendMessages(conversationId, messages)
      
      // Update cache
      await RedisChatCache.cacheConversation(conversationId, updatedConversation, 3600)
      
      // Publish real-time update
      await RedisChatCache.publishMessageUpdate(conversationId, {
        type: 'messages_added',
        messages,
        conversationId
      })
      
      return updatedConversation
    } catch (error) {
      console.error('Failed to add messages:', error)
      return null
    }
  }

  // Get conversation list (optimized with caching)
  static async getConversationList(): Promise<SupabaseConversation[]> {
    const userId = 'default' // TODO: Use actual user ID
    
    try {
      // Try Redis first
      let conversations = await RedisChatCache.getCachedConversationList(userId) as SupabaseConversation[] | null
      
      if (conversations) {
        console.log('📦 Conversation list loaded from Redis cache')
        return conversations
      }

      // Fallback to Supabase
      console.log('🗄️ Loading conversation list from Supabase')
      const rawConversations = await SupabaseChatStorage.getConversationList()
      conversations = rawConversations.map(conv => ({
        ...conv,
        messages: 'messages' in conv ? (conv as any).messages ?? [] : [],
        metadata: 'metadata' in conv ? (conv as any).metadata ?? {} : {}
      }))
      
      // Cache for next time (shorter TTL for list)
      await RedisChatCache.cacheConversationList(userId, conversations, 60)
      
      return conversations
    } catch (error) {
      console.error('Failed to get conversation list:', error)
      return []
    }
  }

  // Delete conversation
  static async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      // Delete from Supabase
      await SupabaseChatStorage.deleteConversation(conversationId)
      
      // Remove from cache
      await RedisChatCache.invalidateConversation(conversationId)
      await RedisChatCache.invalidateConversationList('default') // TODO: Use actual user ID
      
      return true
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      return false
    }
  }

  // Update conversation metadata
  static async updateConversation(
    conversationId: string, 
    updates: Partial<Pick<SupabaseConversation, 'title' | 'metadata'>>
  ): Promise<boolean> {
    try {
      // Update in Supabase
      await SupabaseChatStorage.updateConversation(conversationId, updates)
      
      // Invalidate cache to force refresh
      await RedisChatCache.invalidateConversation(conversationId)
      await RedisChatCache.invalidateConversationList('default') // TODO: Use actual user ID
      
      return true
    } catch (error) {
      console.error('Failed to update conversation:', error)
      return false
    }
  }

  // Stream-optimized: Store temp message during streaming
  static async storeTempMessage(messageId: string, message: SupabaseMessage): Promise<void> {
    await RedisChatCache.setTempMessage(messageId, message, 300) // 5 minute TTL
  }

  // Stream-optimized: Get temp message
  static async getTempMessage(messageId: string): Promise<SupabaseMessage | null> {
    return await RedisChatCache.getTempMessage(messageId) as SupabaseMessage | null
  }

  // Update a specific message in a conversation
  static async updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<SupabaseMessage>
  ): Promise<boolean> {
    try {
      // Get current conversation
      const conversation = await this.getConversation(conversationId)
      if (!conversation) return false

      // Find and update the message
      const messageIndex = conversation.messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return false

      const updatedMessages = [...conversation.messages]
      updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], ...updates }

      // Update in Supabase
      await SupabaseChatStorage.updateConversationMessages(conversationId, updatedMessages)

      // Invalidate cache
      await RedisChatCache.invalidateConversation(conversationId)

      return true
    } catch (error) {
      console.error('Failed to update message:', error)
      return false
    }
  }

  // Delete a specific message from a conversation
  static async deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
    try {
      // Get current conversation
      const conversation = await this.getConversation(conversationId)
      if (!conversation) return false

      // Filter out the message
      const updatedMessages = conversation.messages.filter(m => m.id !== messageId)

      // Update in Supabase
      await SupabaseChatStorage.updateConversationMessages(conversationId, updatedMessages)

      // Invalidate cache
      await RedisChatCache.invalidateConversation(conversationId)

      return true
    } catch (error) {
      console.error('Failed to delete message:', error)
      return false
    }
  }

  // Batch save after streaming completes
  static async saveStreamingConversation(
    title: string,
    model: string,
    userMessage: SupabaseMessage,
    assistantMessage: SupabaseMessage
  ): Promise<SupabaseConversation | null> {
    try {
      console.log('💾 Saving complete streaming conversation to Supabase + Redis')
      
      const conversation = await this.createConversation(title, model, [userMessage, assistantMessage])
      
      return conversation
    } catch (error) {
      console.error('Failed to save streaming conversation:', error)
      return null
    }
  }

  // Health check
  static async healthCheck(): Promise<{ supabase: boolean; redis: boolean }> {
    const health = { supabase: false, redis: false }
    
    try {
      await SupabaseChatStorage.getConversationList()
      health.supabase = true
    } catch (error) {
      console.error('Supabase health check failed:', error)
    }
    
    try {
      await RedisChatCache.getCachedConversationList('health-check')
      health.redis = true
    } catch (error) {
      console.error('Redis health check failed:', error)
    }
    
    return health
  }
}

// Export for convenience
export type { SupabaseConversation, SupabaseMessage }
