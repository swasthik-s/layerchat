'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useChatStore } from '@/lib/store'
import Sidebar from '@/components/sidebar'
import Header from '@/components/header'
import Chat from '@/components/chat/chat'
import { Toaster } from 'react-hot-toast'

export default function Home() {
  const router = useRouter()
  const pathname = usePathname()
  const { 
    sidebarOpen, 
    setSidebarOpen, 
    selectedModel,
    currentSession,
    createNewSession,
    sessions 
  } = useChatStore()

  // Initialize first session if none exists, but allow staying on main page for new chats
  useEffect(() => {
    const initializeChat = async () => {
      // Only auto-redirect if we have an existing current session and we're not already on the main page
      // This allows new chat flows to stay on the main page
      if (currentSession && pathname === '/') {
        // Don't redirect if we're already on the home page - let user stay for new chat experience
        return
      }
    }

    initializeChat()
  }, [currentSession, pathname])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
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
      
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'bg-card text-card-foreground border border-border',
          duration: 4000,
        }}
      />
    </>
  )
}
