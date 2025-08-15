'use client'

import { useChatStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Settings, Menu, X, Trash2 } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const router = useRouter()
  const { 
    sessions, 
    currentSession, 
    setCurrentSession, 
    createNewSession, 
    deleteSession,
    resetToNewChat,
    loadChatsFromMongoDB
  } = useChatStore()

  // Load chats from MongoDB on component mount
  useEffect(() => {
    loadChatsFromMongoDB()
  }, [loadChatsFromMongoDB])

  const handleNewChat = async () => {
    try {
      // Reset the current session and messages to get a clean slate
      resetToNewChat()
      
      // Always navigate to home page to ensure fresh start
      router.push('/')
      
      // Force a refresh if already on the home page
      if (window.location.pathname === '/') {
        router.refresh()
      }
      
      // Close sidebar on mobile after creating new chat
      if (window.innerWidth < 1024) {
        onToggle()
      }
    } catch (error) {
      console.error('Failed to create new chat:', error)
    }
  }

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      router.push(`/chat/${sessionId}`)
      // Close sidebar on mobile after selecting chat
      if (window.innerWidth < 1024) {
        onToggle()
      }
    }
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      // Delete from MongoDB
      const response = await fetch(`/api/chat/${sessionId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove from local store
        deleteSession(sessionId)
        
        // If this was the current session, navigate to home
        if (currentSession?.id === sessionId) {
          router.push('/')
        }
      } else {
        console.error('Failed to delete chat from MongoDB')
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border 
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <h1 className="text-lg font-semibold">LayerChat</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="lg:hidden"
            >
              <X size={20} />
            </Button>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <Button 
              onClick={handleNewChat}
              className="w-full justify-start" 
              variant="outline"
            >
              <MessageSquare size={16} className="mr-2" />
              New Chat
            </Button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-2">
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No chats yet</p>
                  <p className="text-xs">Start a conversation to see your chat history</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`
                      group relative p-1  rounded-lg cursor-pointer transition-colors
                      ${currentSession?.id === session.id 
                        ? 'bg-accent text-accent-foreground' 
                        : 'hover:bg-accent/50'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium truncate">
                          {session.title}
                        </div>
                        
                      </div>
                      
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="p-4 border-t border-border">
            <Button variant="ghost" className="w-full justify-start">
              <Settings size={16} className="mr-2" />
              Settings
            </Button>
            
          </div>
        </div>
      </aside>
    </>
  )
}
