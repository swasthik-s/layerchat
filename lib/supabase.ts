import { createClient } from '@supabase/supabase-js'

// Supabase configuration - Server-side client with service role for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role key for server-side operations (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Public client for client-side operations (with RLS)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Database schema types
export interface SupabaseConversation {
  id: string
  title: string
  model: string
  messages: SupabaseMessage[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Conversation list item (without messages for performance)
export interface SupabaseConversationListItem {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
}

export interface SupabaseMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'text' | 'file' | 'image'
  timestamp: number
  metadata?: Record<string, any>
  attachments?: any[]
}

// Optimized database operations
export class SupabaseChatStorage {
  // Create new conversation with initial messages
  static async createConversation(conversation: Omit<SupabaseConversation, 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('conversations')
      .insert([{
        ...conversation,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Get conversation with all messages
  static async getConversation(id: string) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  // Get conversation list (optimized - no messages)
  static async getConversationList() {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, model, updated_at, created_at')
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Append messages to existing conversation
  static async appendMessages(conversationId: string, newMessages: SupabaseMessage[]) {
    // First get current conversation
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', conversationId)
      .single()

    if (fetchError) throw fetchError

    // Append new messages
    const updatedMessages = [...(conversation.messages || []), ...newMessages]

    // Update conversation
    const { data, error } = await supabase
      .from('conversations')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Delete conversation
  static async deleteConversation(id: string) {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Update conversation metadata
  static async updateConversation(
    id: string, 
    updates: Partial<Pick<SupabaseConversation, 'title' | 'metadata'>>
  ) {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Update conversation messages (for message updates/deletes)
  static async updateConversationMessages(id: string, messages: SupabaseMessage[]) {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        messages,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Subscribe to conversation changes (real-time)
  static subscribeToConversation(conversationId: string, callback: (conversation: SupabaseConversation) => void) {
    return supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`
        },
        (payload) => callback(payload.new as SupabaseConversation)
      )
      .subscribe()
  }
}
