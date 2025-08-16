import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage, ChatSession } from '@/types'
import { getModelsByProvider } from '@/lib/models-config'
import { nanoid } from 'nanoid'

interface ChatState {
  // Current state
  currentSession: ChatSession | null
  messages: ChatMessage[]
  sessions: ChatSession[]
  isLoading: boolean
  sidebarOpen: boolean
  selectedModel: string
  selectedProvider: string
  settings: {
    temperature: number
    maxTokens: number
    systemPrompt: string
    enableAutoAgents: boolean
    governance: {
      mode: string
      enabled: boolean
    }
    streamResponses: boolean
  }

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id'>) => Promise<string>
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  appendToMessage: (id: string, content: string) => void
  markMessageComplete: (id: string) => Promise<void>
  createNewSession: () => Promise<string | null>
  saveCurrentConversationToMongoDB: () => Promise<string | null> // NEW: Save current local conversation to MongoDB
  setCurrentSession: (session: ChatSession | null) => void
  deleteSession: (id: string) => void
  resetToNewChat: () => void
  setLoading: (loading: boolean) => void
  setSelectedModel: (model: string) => void
  setSelectedProvider: (provider: string) => void
  setSidebarOpen: (open: boolean) => void
  updateSettings: (newSettings: Partial<ChatState['settings']>) => void
  clearMessages: () => void
  loadChatFromMongoDB: (chatId: string) => Promise<void>
  loadChatsFromMongoDB: () => Promise<void>
  deleteMessage: (messageId: string, chatId?: string, hardDelete?: boolean) => Promise<void>
  retryPendingMessages: () => Promise<void>
  clearPersistedState: () => void
}

const initialSettings = {
  temperature: 0.7,
  maxTokens: 2000,
  systemPrompt: '',
  enableAutoAgents: true,
  governance: {
    mode: 'smart',
    enabled: true
  },
  streamResponses: true
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      // Debug initial localStorage state
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('layerchat-storage')
        console.log('🔍 Initial localStorage state:', stored ? JSON.parse(stored) : 'empty')
      }
      
      return {
        // Initial state
        currentSession: null,
        messages: [],
        sessions: [],
        isLoading: false,
        sidebarOpen: true,
        selectedModel: 'GPT-4',
        selectedProvider: 'openai',
        settings: initialSettings,

        // Actions
        addMessage: async (messageWithoutId: Omit<ChatMessage, 'id'>) => {
          const { currentSession, sessions } = get()
          
          // Generate unique ID for the message
          const messageId = nanoid()
          const message: ChatMessage = {
            ...messageWithoutId,
            id: messageId,
            pending: messageWithoutId.pending ?? true, // Default to pending unless explicitly set
          }
          
          console.log('📝 addMessage called:', {
            messageId,
            messageRole: message.role,
            isPending: message.pending,
            hasSession: !!currentSession
          })
          
          const newMessages = [...get().messages, message]
          set({ messages: newMessages })
          
          // Update current session
          if (currentSession) {
            const updatedSession = {
              ...currentSession,
              messages: newMessages,
              updatedAt: Date.now(),
              title: newMessages.find(m => m.role === 'user')?.content.slice(0, 50) + '...' || currentSession.title
            }
            
            const updatedSessions = sessions.map(s => 
              s.id === currentSession.id ? updatedSession : s
            )
            
            set({ 
              currentSession: updatedSession,
              sessions: updatedSessions
            })

            // ONLY save to MongoDB if message is NOT pending
            if (!message.pending) {
              try {
                console.log('💾 Saving non-pending message to MongoDB')
                
                const response = await fetch(`/api/chat/${currentSession.id}/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: messageId,
                    role: message.role,
                    content: message.content,
                    type: message.type || 'text',
                    metadata: message.metadata || {},
                    attachments: message.attachments || []
                  })
                })

                if (response.ok) {
                  console.log('✅ Message saved to MongoDB successfully')
                  get().updateMessage(messageId, { pending: false })
                } else {
                  console.error('❌ Failed to save message to MongoDB')
                }
              } catch (error) {
                console.error('❌ Error saving message to MongoDB:', error)
              }
            } else {
              console.log('⏸️ Message is pending - NOT saving to MongoDB')
            }
          }

          return messageId
        },

        updateMessage: (id: string, updates: Partial<ChatMessage>) => {
          const newMessages = get().messages.map(msg =>
            msg.id === id ? { ...msg, ...updates } : msg
          )
          set({ messages: newMessages })

          // Also update in current session if it exists
          const { currentSession } = get()
          if (currentSession) {
            const updatedSession = {
              ...currentSession,
              messages: newMessages,
              updatedAt: Date.now()
            }
            
            const updatedSessions = get().sessions.map(s => 
              s.id === currentSession.id ? updatedSession : s
            )
            
            set({ 
              currentSession: updatedSession,
              sessions: updatedSessions
            })
          }
        },

        appendToMessage: (id: string, content: string) => {
          const newMessages = get().messages.map(msg =>
            msg.id === id 
              ? { ...msg, content: msg.content + content, metadata: { ...msg.metadata, streaming: true } }
              : msg
          )
          set({ messages: newMessages })

          // Also update in current session
          const { currentSession } = get()
          if (currentSession) {
            const updatedSession = {
              ...currentSession,
              messages: newMessages,
              updatedAt: Date.now()
            }
            
            const updatedSessions = get().sessions.map(s => 
              s.id === currentSession.id ? updatedSession : s
            )
            
            set({ 
              currentSession: updatedSession,
              sessions: updatedSessions
            })
          }
        },

        markMessageComplete: async (id: string) => {
          const { currentSession } = get()
          const message = get().messages.find(msg => msg.id === id)
          
          if (!message || !currentSession) return

          // Mark as complete locally
          get().updateMessage(id, { 
            metadata: { ...message.metadata, streaming: false, completed: true },
            pending: false 
          })

          // Sync final content to MongoDB
          try {
            const response = await fetch(`/api/chat/${currentSession.id}/messages/${id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: message.content,
                metadata: { ...message.metadata, streaming: false, completed: true }
              })
            })

            if (!response.ok) {
              console.error('Failed to update message completion status')
            }
          } catch (error) {
            console.error('Error updating message completion status:', error)
          }
        },

        createNewSession: async () => {
          try {
            // Create new chat in MongoDB
            const response = await fetch('/api/chat/id', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: 'New Chat',
                model: get().selectedModel,
              }),
            })

            if (!response.ok) {
              throw new Error('Failed to create new chat')
            }

            const data = await response.json()
            const chatId = data.id

            const newSession: ChatSession = {
              id: chatId,
              title: 'New Chat',
              messages: [],
              model: get().selectedModel,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }

            const newSessions = [newSession, ...get().sessions]
            
            set({
              currentSession: newSession,
              sessions: newSessions,
              messages: []
            })

          return chatId
        } catch (error) {
          console.error('Error creating new session:', error)
          return null
        }
      },

      saveCurrentConversationToMongoDB: async () => {
        const { messages, currentSession } = get()
        
        if (currentSession) {
          console.log('⚠️ Session already exists in MongoDB, no need to save')
          return currentSession.id
        }
        
        if (messages.length === 0) {
          console.log('⚠️ No messages to save')
          return null
        }
        
        try {
          // Create new chat in MongoDB
          const userMessage = messages.find(m => m.role === 'user')
          const title = userMessage?.content 
            ? userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '') 
            : 'New Chat'
          
          const response = await fetch('/api/chat/id', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              model: get().selectedModel,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to create new chat in MongoDB')
          }

          const data = await response.json()
          const chatId = data.id

          console.log('📀 Created new MongoDB chat:', chatId)

          // Save all messages to MongoDB
          for (const message of messages) {
            const messageResponse = await fetch(`/api/chat/${chatId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: message.id,
                role: message.role,
                content: message.content,
                type: message.type || 'text',
                metadata: message.metadata || {},
                attachments: message.attachments || []
              })
            })
            
            if (!messageResponse.ok) {
              console.error('Failed to save message to MongoDB:', message.id)
            }
          }

          // Create new session and update store
          const newSession: ChatSession = {
            id: chatId,
            title,
            messages,
            model: get().selectedModel,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          const newSessions = [newSession, ...get().sessions]
          
          set({
            currentSession: newSession,
            sessions: newSessions
          })

          console.log('✅ Successfully saved local conversation to MongoDB')
          return chatId
        } catch (error) {
          console.error('❌ Error saving conversation to MongoDB:', error)
          return null
        }
      },        setCurrentSession: (session: ChatSession | null) => {
          set({ 
            currentSession: session,
            messages: session?.messages || []
          })
        },

        deleteSession: (id: string) => {
          const sessions = get().sessions.filter(s => s.id !== id)
          const { currentSession } = get()
          
          // If deleting current session, reset to new chat
          if (currentSession?.id === id) {
            get().resetToNewChat()
          } else {
            set({ sessions })
          }
          
          // Delete from MongoDB
          fetch(`/api/chat/${id}`, { method: 'DELETE' })
            .catch(error => console.error('Error deleting session from MongoDB:', error))
        },

        resetToNewChat: () => {
          set({
            currentSession: null,
            messages: [],
            isLoading: false
          })
        },
        
        setLoading: (loading: boolean) => set({ isLoading: loading }),
        setSelectedModel: (model: string) => set({ selectedModel: model }),
        setSelectedProvider: (provider: string) => {
          // Immediately update the provider
          set({ selectedProvider: provider })
          
          // Then asynchronously update the model
          getModelsByProvider(provider).then(models => {
            const firstModel = models.length > 0 ? models[0].name : 'GPT-4'
            set({ selectedModel: firstModel })
          }).catch(error => {
            console.error('Error loading models for provider:', provider, error)
            // Keep the provider change even if model loading fails
          })
        },
        setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
        
        updateSettings: (newSettings: Partial<ChatState['settings']>) => {
          set({ 
            settings: { ...get().settings, ...newSettings }
          })
        },
        
        clearMessages: () => set({ messages: [] }),

        loadChatFromMongoDB: async (chatId: string) => {
          try {
            set({ isLoading: true })
            
            const response = await fetch(`/api/chat/${chatId}`)
            
            if (!response.ok) {
              throw new Error('Failed to load chat')
            }

            const data = await response.json()
            const chatData = data.chat

            const session: ChatSession = {
              id: chatData.id,
              title: chatData.title,
              model: chatData.model,
              messages: chatData.messages || [],
              createdAt: chatData.createdAt,
              updatedAt: chatData.updatedAt,
              metadata: chatData.metadata
            }

            set({
              currentSession: session,
              messages: session.messages
            })
          } catch (error) {
            console.error('Error loading chat from MongoDB:', error)
            throw error
          } finally {
            set({ isLoading: false })
          }
        },

        loadChatsFromMongoDB: async () => {
          try {
            console.log('📡 Loading chats from MongoDB...')
            const response = await fetch('/api/chats')
            
            if (!response.ok) {
              throw new Error('Failed to load chats')
            }

            const data = await response.json()
            const chats = data.chats
            
            console.log('📡 MongoDB returned chats:', chats.length, chats)

            const sessions: ChatSession[] = chats.map((chat: any) => ({
              id: chat.id,
              title: chat.title,
              model: chat.model,
              messages: [], // Don't load messages for list view
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              metadata: chat.metadata
            }))

            console.log('📡 Setting sessions in store:', sessions.length)
            set({ sessions })
          } catch (error) {
            console.error('Error loading chats from MongoDB:', error)
            // Keep existing sessions on error
          }
        },

        deleteMessage: async (messageId: string, chatId?: string, hardDelete: boolean = false) => {
          try {
            const { currentSession } = get()
            const targetChatId = chatId || currentSession?.id
            
            if (!targetChatId) {
              throw new Error('No chat ID available for message deletion')
            }

            if (hardDelete) {
              // Hard delete from MongoDB if it's a persisted chat
              if (targetChatId.length > 20) { // UUID format, so it's in MongoDB
                const response = await fetch(`/api/chat/${targetChatId}/messages/${messageId}`, {
                  method: 'DELETE'
                })
                
                if (!response.ok) {
                  throw new Error('Failed to delete message from MongoDB')
                }
              }

              // Remove from local store completely
              const newMessages = get().messages.filter(msg => msg.id !== messageId)
              set({ messages: newMessages })

              // Update current session messages
              if (currentSession && currentSession.id === targetChatId) {
                const updatedSession = {
                  ...currentSession,
                  messages: newMessages,
                  updatedAt: Date.now()
                }
                set({ currentSession: updatedSession })
              }
            } else {
              // Soft delete - mark as deleted but keep in store
              get().updateMessage(messageId, { deleted: true })
              
              // Update in MongoDB
              if (targetChatId.length > 20) {
                const response = await fetch(`/api/chat/${targetChatId}/messages/${messageId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ deleted: true })
                })
                
                if (!response.ok) {
                  console.error('Failed to soft delete message in MongoDB')
                }
              }
            }
          } catch (error) {
            console.error('Error deleting message:', error)
            throw error
          }
        },

        retryPendingMessages: async () => {
          const { messages, currentSession } = get()
          if (!currentSession) return

          const pendingMessages = messages.filter(msg => msg.pending)
          
          console.log(`🔄 Retrying ${pendingMessages.length} pending messages`)
          
          for (const message of pendingMessages) {
            try {
              const response = await fetch(`/api/chat/${currentSession.id}/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: message.id,
                  role: message.role,
                  content: message.content,
                  type: message.type || 'text',
                  metadata: message.metadata || {},
                  attachments: message.attachments || []
                })
              })

              if (response.ok) {
                console.log(`✅ Retry successful for message ${message.id}`)
                get().updateMessage(message.id, { pending: false })
              } else {
                console.error(`❌ Retry failed for message ${message.id}:`, await response.text())
              }
            } catch (error) {
              console.error(`❌ Retry error for message ${message.id}:`, error)
            }
          }
        },

        clearPersistedState: () => {
          // Clear localStorage
          localStorage.removeItem('layerchat-storage')
          
          // Reset store to initial state
          set({
            currentSession: null,
            messages: [],
            sessions: [],
            isLoading: false
          })
          
          console.log('🧹 Cleared persisted state from localStorage')
        },
      }
    },
    {
      name: 'layerchat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        settings: state.settings,
        selectedModel: state.selectedModel,
        selectedProvider: state.selectedProvider,
      }),
    }
  )
)
