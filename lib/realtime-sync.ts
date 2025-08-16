import { supabase } from './supabase'
import { RedisChatCache } from './redis'

export class RealTimeSync {
  private static subscriptions = new Map<string, any>()

  // Subscribe to all conversation changes
  static initializeGlobalSync() {
    console.log('🔄 Initializing global real-time sync...')

    const channel = supabase
      .channel('conversations-global')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'conversations'
        },
        async (payload) => {
          console.log('🔔 Real-time database change:', payload.eventType, (payload.new as any)?.id)
          
          switch (payload.eventType) {
            case 'INSERT':
              // New conversation created - invalidate conversation list cache
              await RedisChatCache.invalidateConversationList('default')
              break
              
            case 'UPDATE':
              // Conversation updated - invalidate both individual and list cache
              const conversationId = (payload.new as any)?.id
              if (conversationId) {
                await RedisChatCache.invalidateConversation(conversationId)
                await RedisChatCache.invalidateConversationList('default')
              }
              break
              
            case 'DELETE':
              // Conversation deleted - invalidate both individual and list cache
              const deletedId = (payload.old as any)?.id
              if (deletedId) {
                await RedisChatCache.invalidateConversation(deletedId)
                await RedisChatCache.invalidateConversationList('default')
              }
              break
          }
        }
      )
      .subscribe()

    this.subscriptions.set('global', channel)
    return channel
  }

  // Subscribe to specific conversation changes
  static subscribeToConversation(conversationId: string, callback?: (data: any) => void) {
    console.log(`🔔 Subscribing to conversation: ${conversationId}`)

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`
        },
        async (payload) => {
          console.log(`🔔 Conversation ${conversationId} updated:`, payload.new)
          
          // Invalidate cache for this conversation
          await RedisChatCache.invalidateConversation(conversationId)
          
          // Call callback if provided
          if (callback) {
            callback(payload.new)
          }
        }
      )
      .subscribe()

    this.subscriptions.set(conversationId, channel)
    return channel
  }

  // Unsubscribe from conversation
  static unsubscribeFromConversation(conversationId: string) {
    const channel = this.subscriptions.get(conversationId)
    if (channel) {
      supabase.removeChannel(channel)
      this.subscriptions.delete(conversationId)
      console.log(`🔕 Unsubscribed from conversation: ${conversationId}`)
    }
  }

  // Clean up all subscriptions
  static cleanup() {
    console.log('🧹 Cleaning up real-time subscriptions...')
    this.subscriptions.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    this.subscriptions.clear()
  }

  // Force cache refresh for a conversation
  static async forceRefresh(conversationId?: string) {
    if (conversationId) {
      console.log(`🔄 Force refreshing conversation: ${conversationId}`)
      await RedisChatCache.invalidateConversation(conversationId)
    }
    
    console.log('🔄 Force refreshing conversation list')
    await RedisChatCache.invalidateConversationList('default')
  }
}

// Auto-initialize global sync
if (typeof window !== 'undefined') {
  // Only initialize in browser environment
  RealTimeSync.initializeGlobalSync()
}
