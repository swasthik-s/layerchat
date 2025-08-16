'use client'

import { useChatStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  MessageSquare, 
  Settings, 
  Menu, 
  X, 
  Trash2, 
  Search, 
  BookOpen, 
  Zap, 
  Users,
  Edit,
  User,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react'

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
    loadChatsFromMongoDB,
    clearPersistedState
  } = useChatStore()

  // Load chats from MongoDB on component mount
  useEffect(() => {
    console.log('🔍 Sidebar mounting - current sessions:', sessions.length)
    console.log('🔍 Current session:', currentSession?.id || 'none')
    
    loadChatsFromMongoDB().then(() => {
      console.log('🔍 After loading from MongoDB - sessions:', sessions.length)
    })
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

  const handleSelectSession = async (sessionId: string) => {
    try {
      // If we're already viewing this session, no need to reload
      if (currentSession?.id === sessionId) {
        // Close sidebar on mobile after selecting chat
        if (window.innerWidth < 1024) {
          onToggle()
        }
        return
      }

      // Navigate to the chat URL - this will trigger the chat page to load the data
      router.push(`/chat/${sessionId}`)
      
      // Close sidebar on mobile after selecting chat
      if (window.innerWidth < 1024) {
        onToggle()
      }
    } catch (error) {
      console.error('Failed to navigate to chat:', error)
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

  const navigationItems = [
    { icon: Edit, label: 'New chat', action: handleNewChat },
    { icon: Search, label: 'Search chats', action: () => {} },
    { icon: BookOpen, label: 'Library', action: () => {} },
    // { icon: Zap, label: 'Sora', action: () => {} },
    // { icon: Users, label: 'GPTs', action: () => {} },
  ]

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-neutral-900 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full border-r border-neutral-800
        transform transition-all duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen 
          ? 'w-64 translate-x-0 bg-neutral-950' 
          : 'w-14 -translate-x-full lg:translate-x-0 bg-background'
        }
      `}>
        <div className="flex flex-col h-full">
          {/* Header with toggle */}
          <div className={`flex items-center ${isOpen ? 'justify-between px-3 py-3' : 'justify-center px-0 py-2'}`}>
            {isOpen && (
              <h1 className="text-lg font-semibold text-white">LayerChat</h1>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className={`
                text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg
                w-10 h-10 items-center justify-center hidden lg:flex
              `}
            >
              {isOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </Button>
            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="lg:hidden text-neutral-400 hover:text-white"
            >
              <X size={20} />
            </Button>
          </div>

          {/* Navigation Items */}
          <div className={`space-y-1 ${isOpen ? 'px-2' : 'px-2'}`}>
            {navigationItems.map((item, index) => (
              <Button
                key={index}
                onClick={item.action}
                variant="ghost"
                size={isOpen ? "default" : "icon"}
                className={`
                  text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg
                  ${isOpen 
                    ? 'w-full justify-start px-3 h-10' 
                    : 'w-10 h-10 mx-auto flex items-center justify-center'
                  }
                `}
                title={!isOpen ? item.label : undefined}
              >
                <item.icon size={18} className={isOpen ? "mr-3" : ""} />
                {isOpen && <span className="text-sm">{item.label}</span>}
              </Button>
            ))}
          </div>

          {/* Divider */}
          {isOpen && (
            <div className="mx-4 my-4 border-t border-neutral-800" />
          )}

          {/* Chats Section */}
          {isOpen && (
            <div className="px-4">
              <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Chats
              </h2>
            </div>
          )}

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-2">
            {isOpen ? (
              <div className="space-y-1">
                {sessions.length === 0 ? (
                  <div className="text-center text-neutral-500 py-8 px-4">
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
                        group relative px-3 py-2 rounded-lg cursor-pointer transition-colors
                        ${currentSession?.id === session.id 
                          ? 'bg-neutral-800 text-white' 
                          : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {session.title}
                          </div>
                        </div>
                        
                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 text-neutral-500 hover:text-red-400 ml-2"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {/* User Profile Section */}
          <div className={`border-t border-neutral-800 ${isOpen ? 'p-3' : 'p-2'}`}>
            <Button
              variant="ghost"
              size={isOpen ? "default" : "icon"}
              className={`
                text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg
                ${isOpen 
                  ? 'w-full justify-start px-3 h-10' 
                  : 'w-10 h-10 mx-auto flex items-center justify-center'
                }
              `}
              title={!isOpen ? "Swasthik - Free" : undefined}
            >
              <div className={`
                w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center
                ${isOpen ? 'mr-3' : ''}
              `}>
                <span className="text-xs font-medium text-white">S</span>
              </div>
              {isOpen && (
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Swasthik</span>
                  <span className="text-xs text-neutral-500">Free</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
