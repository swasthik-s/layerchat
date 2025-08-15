import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatSession, ChatMessage } from '@/types'
import { getModelsByProvider } from './models-config'

interface ChatState {
  // Current session
  currentSession: ChatSession | null
  messages: ChatMessage[]
  
  // All sessions
  sessions: ChatSession[]
  
  // UI State
  isLoading: boolean
  selectedModel: string
  selectedProvider: string
  sidebarOpen: boolean
  
  // Settings
  settings: {
    theme: 'dark' | 'light'
    temperature: number
    maxTokens: number
    enableAutoAgents: boolean
    streamResponses: boolean
    governance: {
      mode: 'smart' | 'internal' | 'internet'
      enabled: boolean
    }
  }
  
  // Actions
  setCurrentSession: (session: ChatSession | null) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  createNewSession: () => Promise<string> // Return the chat ID
  deleteSession: (id: string) => void
  resetToNewChat: () => void // Reset to initial state for new chat
  setLoading: (loading: boolean) => void
  setSelectedModel: (model: string) => void
  setSelectedProvider: (provider: string) => void
  setSidebarOpen: (open: boolean) => void
  updateSettings: (settings: Partial<ChatState['settings']>) => void
  clearMessages: () => void
  loadChatFromMongoDB: (chatId: string) => Promise<void>
  loadChatsFromMongoDB: () => Promise<void>
  deleteMessage: (messageId: string, chatId?: string) => Promise<void>
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      messages: [],
      sessions: [],
      isLoading: false,
      selectedModel: 'GPT-4',
      selectedProvider: 'OpenAI',
      sidebarOpen: false,
      
      settings: {
        theme: 'dark',
        temperature: 0.7,
        maxTokens: 4000,
        enableAutoAgents: true,
        streamResponses: true,
        governance: {
          mode: 'smart',
          enabled: true
        }
      },
      
      // Actions
      setCurrentSession: (session) => {
        set({ 
          currentSession: session,
          messages: session?.messages || []
        })
      },
      
      addMessage: (message) => {
        const { currentSession, sessions } = get()
        const newMessages = [...get().messages, message]
        
        set({ messages: newMessages })
        
        // Update current session
        if (currentSession) {
          const updatedSession = {
            ...currentSession,
            messages: newMessages,
            updatedAt: Date.now(),
            // Update title based on first user message
            title: newMessages.find(m => m.role === 'user')?.content.slice(0, 50) + '...' || currentSession.title
          }
          
          // Update sessions array
          const updatedSessions = sessions.map(s => 
            s.id === currentSession.id ? updatedSession : s
          )
          
          set({ 
            currentSession: updatedSession,
            sessions: updatedSessions
          })
        }
      },
      
      updateMessage: (id, updates) => {
        const newMessages = get().messages.map(msg =>
          msg.id === id ? { ...msg, ...updates } : msg
        )
        set({ messages: newMessages })
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

          const sessions = [newSession, ...get().sessions]

          set({
            currentSession: newSession,
            messages: [],
            sessions
          })

          return chatId
        } catch (error) {
          console.error('Error creating new session:', error)
          // Fallback to local session
          const localId = `session-${Date.now()}`
          const newSession: ChatSession = {
            id: localId,
            title: 'New Chat',
            messages: [],
            model: get().selectedModel,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          const sessions = [newSession, ...get().sessions]

          set({
            currentSession: newSession,
            messages: [],
            sessions
          })

          return localId
        }
      },
      
      deleteSession: (id) => {
        const { sessions, currentSession } = get()
        const newSessions = sessions.filter(s => s.id !== id)
        
        set({ sessions: newSessions })
        
        // If deleted session was current, switch to most recent or create new
        if (currentSession?.id === id) {
          if (newSessions.length > 0) {
            get().setCurrentSession(newSessions[0])
          } else {
            get().createNewSession()
          }
        }
      },
      
      resetToNewChat: () => {
        set({
          currentSession: null,
          messages: [],
          isLoading: false
        })
      },
      
      setLoading: (loading) => set({ isLoading: loading }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSelectedProvider: (provider) => {
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
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      updateSettings: (newSettings) => {
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
          const response = await fetch('/api/chats')
          
          if (!response.ok) {
            throw new Error('Failed to load chats')
          }

          const data = await response.json()
          const chats = data.chats

          const sessions: ChatSession[] = chats.map((chat: any) => ({
            id: chat.id,
            title: chat.title,
            model: chat.model,
            messages: [], // Don't load messages for list view
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            metadata: chat.metadata
          }))

          set({ sessions })
        } catch (error) {
          console.error('Error loading chats from MongoDB:', error)
          // Keep existing sessions on error
        }
      },

      deleteMessage: async (messageId: string, chatId?: string) => {
        try {
          const { currentSession } = get()
          const targetChatId = chatId || currentSession?.id
          
          if (!targetChatId) {
            throw new Error('No chat ID available for message deletion')
          }

          // Delete from MongoDB if it's a persisted chat
          if (targetChatId.length > 20) { // UUID format, so it's in MongoDB
            const response = await fetch(`/api/chat/${targetChatId}/messages/${messageId}`, {
              method: 'DELETE'
            })
            
            if (!response.ok) {
              throw new Error('Failed to delete message from MongoDB')
            }
          }

          // Remove from local store
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
        } catch (error) {
          console.error('Error deleting message:', error)
          throw error
        }
      },
    }),
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
