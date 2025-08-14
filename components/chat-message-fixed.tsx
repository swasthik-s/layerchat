"use client"

import React, { useState } from 'react'
import { ChatMessage as ChatMessageType } from '@/types'
import { User, Bot, Search, Calculator, Youtube, Cloud, Copy, Edit, ThumbsUp, ThumbsDown, Volume2, Share, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatGPTRichRenderer } from './ChatGPTRichRenderer'

interface ChatMessageProps {
  message: ChatMessageType
}

const getAgentIcon = (agentName?: string) => {
  if (!agentName) return <Bot className="w-5 h-5" />
  
  switch (agentName.toLowerCase()) {
    case 'search':
      return <Search className="w-5 h-5" />
    case 'math':
      return <Calculator className="w-5 h-5" />
    case 'youtube':
      return <Youtube className="w-5 h-5" />
    case 'weather':
      return <Cloud className="w-5 h-5" />
    default:
      return <Bot className="w-5 h-5" />
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [expanded, setExpanded] = useState(false)
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) return null

  return (
    <div className="flex items-start gap-3 py-6">
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300">
            {getAgentIcon(message.metadata?.agent)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* User messages */}
        {isUser && (
          <div className="bg-blue-600 text-white rounded-2xl px-4 py-3 max-w-[80%] ml-auto">
            <p className="text-sm">{message.content}</p>
          </div>
        )}

        {/* Assistant messages */}
        {!isUser && (
          <div className="w-full">
            {message.type === 'text' && (
              <div className="relative w-full">
                {/* If we have a concise version and explanation available, show concise first unless expanded */}
                {message.metadata?.concise && message.metadata?.explanationAvailable && !expanded && (
                  <div className="mb-3 space-y-2">
                    <p className="text-sm text-white dark:text-gray-200 leading-relaxed">{message.metadata.concise}</p>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={()=>setExpanded(true)}>Explain ▾</Button>
                  </div>
                )}
                
                {/* Main content - either full content or explanation when expanded */}
                {(!message.metadata?.concise || expanded || !message.metadata?.explanationAvailable) && (
                  (() => {
                    // Determine if we should use rich formatting
                    return <ChatGPTRichRenderer content={message.content} />
                  })()
                )}
                
                {/* Hide explanation button when expanded */}
                {expanded && message.metadata?.concise && message.metadata?.explanationAvailable && (
                  <div className="mt-2"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={()=>setExpanded(false)}>Hide Explanation ▲</Button></div>
                )}
                
                {/* Streaming indicator */}
                {message.metadata?.streaming && (
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground/60">
                    <div className="w-1 h-1 bg-current rounded-full animate-pulse"/>
                    <span className="text-xs">streaming...</span>
                  </div>
                )}
              </div>
            )}

            {message.type === 'image' && (
              <div className="mt-2">
                <img src={message.content} alt="Generated" className="max-w-sm rounded-lg" />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Copy className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Edit className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <ThumbsUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <ThumbsDown className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Volume2 className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Share className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>

            {/* Model info */}
            {message.metadata?.model && (
              <div className="mt-2 text-xs text-muted-foreground">
                Model: {message.metadata.model}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
