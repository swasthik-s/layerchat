'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChatStore } from '@/lib/store'
import Sidebar from '@/components/sidebar'
import Header from '@/components/header'
import Chat from '@/components/chat/chat'
import { Toaster } from 'react-hot-toast'
import { ChatSession, ChatMessage } from '@/types'

interface ChatPageProps {
  params: {
    id: string
  }
}

export default function ChatPage({ params }: ChatPageProps) {
  return <ChatPageContent params={params} />
}

function ChatPageContent({ params }: { params: ChatPageProps['params'] }) {
  const [chatId, setChatId] = useState<string | undefined>(undefined)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  
  const { 
    sidebarOpen, 
    setSidebarOpen, 
    setCurrentSession,
    currentSession,
    messages,
    setLoading: setChatLoading
  } = useChatStore()

  // Handle async params
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setChatId(resolvedParams.id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    const loadChat = async () => {
      try {
        // Check if we already have this chat in the current session
        if (currentSession && currentSession.id === chatId) {
          setError(null)
          return
        }
        
        // Only fetch from MongoDB if we don't already have the chat
        const response = await fetch(`/api/chat/${chatId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Chat not found')
            return
          }
          throw new Error('Failed to load chat')
        }

        const data = await response.json()
        const chatData = data.chat

        // Convert to ChatSession format
        const session: ChatSession = {
          id: chatData.id,
          title: chatData.title,
          model: chatData.model,
          messages: chatData.messages || [],
          createdAt: chatData.createdAt,
          updatedAt: chatData.updatedAt,
          metadata: chatData.metadata
        }

        setCurrentSession(session)
        setError(null)
        
      } catch (err) {
        console.error('Error loading chat:', err)
        setError('Failed to load chat')
      }
    }

    if (chatId) {
      loadChat()
    }
  }, [chatId, setCurrentSession])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background text-foreground items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
        
        {/* Main content */}
        <div className="flex-1 flex flex-col lg:ml-0 min-w-0">
          {/* Header */}
          <Header 
            onToggleSidebar={toggleSidebar}
          />
          
          {/* Chat area */}
          <div className="flex-1 overflow-hidden">
            <Chat />
          </div>
        </div>
      </div>
      
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
    </>
  )
}
