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
  createNewSession: () => void
  deleteSession: (id: string) => void
  setLoading: (loading: boolean) => void
  setSelectedModel: (model: string) => void
  setSelectedProvider: (provider: string) => void
  setSidebarOpen: (open: boolean) => void
  updateSettings: (settings: Partial<ChatState['settings']>) => void
  clearMessages: () => void
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
      
      createNewSession: () => {
        const newSession: ChatSession = {
          id: `session-${Date.now()}`,
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
