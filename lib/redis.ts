    import { Redis } from '@upstash/redis'

// Redis configuration for Upstash (serverless Redis)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Redis-based caching and session management
export class RedisChatCache {
  // Cache conversation for quick access (reduced TTL for better real-time sync)
  static async cacheConversation(conversationId: string, conversation: any, ttl = 300) {
    await redis.setex(`conversation:${conversationId}`, ttl, JSON.stringify(conversation))
  }

  // Get cached conversation
  static async getCachedConversation(conversationId: string) {
    const cached = await redis.get(`conversation:${conversationId}`)
    // Upstash Redis automatically deserializes JSON, so we don't need JSON.parse
    return cached
  }

  // Cache conversation list (reduced TTL for better real-time sync)
  static async cacheConversationList(userId: string, conversations: any[], ttl = 60) {
    await redis.setex(`conversations:${userId}`, ttl, JSON.stringify(conversations))
  }

  // Get cached conversation list
  static async getCachedConversationList(userId: string) {
    const cached = await redis.get(`conversations:${userId}`)
    // Upstash Redis automatically deserializes JSON, so we don't need JSON.parse
    return cached
  }

  // Store active streaming session
  static async setStreamingSession(sessionId: string, data: any, ttl = 1800) {
    await redis.setex(`streaming:${sessionId}`, ttl, JSON.stringify(data))
  }

  // Get streaming session
  static async getStreamingSession(sessionId: string) {
    const cached = await redis.get(`streaming:${sessionId}`)
    // Upstash Redis automatically deserializes JSON
    return cached
  }

  // Delete streaming session
  static async deleteStreamingSession(sessionId: string) {
    await redis.del(`streaming:${sessionId}`)
  }

  // Invalidate conversation cache
  static async invalidateConversation(conversationId: string) {
    await redis.del(`conversation:${conversationId}`)
  }

  // Invalidate conversation list cache
  static async invalidateConversationList(userId: string) {
    await redis.del(`conversations:${userId}`)
  }

  // Store temporary message during streaming
  static async setTempMessage(messageId: string, message: any, ttl = 300) {
    await redis.setex(`temp:message:${messageId}`, ttl, JSON.stringify(message))
  }

  // Get temporary message
  static async getTempMessage(messageId: string) {
    const cached = await redis.get(`temp:message:${messageId}`)
    // Upstash Redis automatically deserializes JSON
    return cached
  }

  // Pub/Sub for real-time updates
  static async publishMessageUpdate(conversationId: string, message: any) {
    await redis.publish(`conversation:${conversationId}:messages`, JSON.stringify(message))
  }

  // Subscribe to message updates
  static async subscribeToMessages(conversationId: string, callback: (message: any) => void) {
    // Note: In a real implementation, you'd use a separate Redis connection for pub/sub
    // This is a simplified version for demonstration
    console.log(`Subscribed to conversation:${conversationId}:messages`)
  }
}

export { redis }
