'use client'

import { useEffect } from 'react'
import { useChatStore } from '@/lib/store'
import Sidebar from '@/components/sidebar'
import Header from '@/components/header'
import Chat from '@/components/chat/chat'
import { Toaster } from 'react-hot-toast'

export default function Home() {
  const { 
    sidebarOpen, 
    setSidebarOpen, 
    selectedModel,
    currentSession,
    createNewSession,
    sessions 
  } = useChatStore()

  // Initialize first session if none exists
  useEffect(() => {
    if (!currentSession && sessions.length === 0) {
      createNewSession()
    }
  }, [currentSession, sessions.length, createNewSession])

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
