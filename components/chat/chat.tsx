'use client'

import React, { useEffect, useRef } from 'react'
import { useChatStore } from '@/lib/store'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import ChatMessage from './chat-message'
import ChatInput from './chat-input'
import { Button } from '@/components/ui/button'

export default function Chat() {
  const { messages, isLoading, currentSession } = useChatStore()
  const { sendMessage, stopGeneration, isStreaming, streamingMessageId, searchPhase } = useStreamingChat({
    chatId: currentSession?.id
  })
  
  // Debug logging
  React.useEffect(() => {
    console.log('🎨 CHAT COMPONENT UPDATE:', {
      currentSession: currentSession?.id,
      messagesCount: messages.length,
      messages: messages
    })
  }, [currentSession, messages])
  
  // Debug search phase
  React.useEffect(() => {
    if (searchPhase) {
      console.log('🔍 CHAT: searchPhase detected!', { 
        searchPhase, 
        streamingMessageId,
        isStreaming 
      })
    }
  }, [searchPhase, streamingMessageId, isStreaming])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Show welcome message only when there are no messages at all
  const shouldShowWelcome = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto pb-4">
  {/* Centered bounded container: adjust max-w-* as needed to match red box width */}
  <div className="w-full px-4 lg:px-8 max-w-4xl mx-auto">
          {shouldShowWelcome && (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
              <div className="text-center space-y-4 p-8">
                <h1 className="text-3xl font-bold">Welcome to LayerChat</h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium">Try asking:</div>
                    <div className="text-muted-foreground">Search for latest AI news</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium">Or use agents:</div>
                    <div className="text-muted-foreground">@youtube AI tutorials</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium">Math problems:</div>
                    <div className="text-muted-foreground">Calculate 25% of 400</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium">Create images:</div>
                    <div className="text-muted-foreground">Generate a sunset landscape</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => {
            const isActive = message.id === streamingMessageId
            return (
              <ChatMessage 
                key={message.id} 
                message={message} 
                searchPhase={isActive ? searchPhase : null}
                isStreamingMessage={isActive}
              />
            )
          })}
          
          {/* Extra padding at bottom to ensure messages don't go behind input */}
          <div className="h-32" />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Input - now handled separately */}
      <ChatInput 
        onSendMessage={sendMessage} 
        disabled={isLoading} 
        isStreaming={isStreaming}
        onStopGeneration={stopGeneration}
      />

      {/* Footer area with background to prevent scroll-through */}
      <div className="bg-background flex items-end justify-center p-2">
        <p className="text-xs text-muted-foreground text-center max-w-4xl mx-auto px-4">
          AI's can make mistakes. Check important info.
        </p>
      </div>
    </div>
  )
}
