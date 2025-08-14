"use client"

import React, { useState } from 'react'
import { ChatMessage as ChatMessageType } from '@/types'
import { User, Bot, Search, Calculator, Youtube, Cloud, Copy, Edit, ThumbsUp, Volume2, Share,ThumbsDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useChatStore } from '@/lib/store'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import { ChatGPTRichRenderer } from './ChatGPTRichRenderer'

interface ChatMessageProps { message: ChatMessageType }

const ActionButtons = ({ message }: { message: ChatMessageType }) => {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(()=>setCopied(false),2000) } catch {}
  }

  // In-place regenerate (no new user bubble)
  const { regenerateMessage } = useStreamingChat()
  const handleRegenerate = (mode: 'add-details' | 'more-concise') => regenerateMessage(message.id, mode)

  return (
    <div className="flex items-center gap-1 mt-3">
      <Button variant="ghost" size="sm" onClick={copy} className="h-7 px-2 text-xs hover:bg-muted" title={copied? 'Copied!' : 'Copy response'}><Copy size={12}/></Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-muted hover:text-green-600" title="Good response"><ThumbsUp size={12}/></Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-muted hover:text-red-600" title="Poor response"><ThumbsDown size={12}/></Button>
      <Button variant="ghost" size="sm" onClick={()=>{ if('speechSynthesis' in window){ speechSynthesis.speak(new SpeechSynthesisUtterance(message.content)) } }} className="h-7 px-2 text-xs hover:bg-muted" title="Read aloud"><Volume2 size={12}/></Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-muted" title="Share response" onClick={()=>{ if(navigator.share){ navigator.share({title:'AI Response', text: message.content}) } else copy() }}><Share size={12}/></Button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-muted" title="Regenerate"><RefreshCw size={12}/></Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="top" align="start" className="z-50 min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md outline-none p-1">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Ask to change response</div>
          <div className="h-px bg-border my-1" />
          <DropdownMenu.Item className="cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground" onSelect={(e)=>{ e.preventDefault(); handleRegenerate('add-details') }}>Add details</DropdownMenu.Item>
          <DropdownMenu.Item className="cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground" onSelect={(e)=>{ e.preventDefault(); handleRegenerate('more-concise') }}>More concise</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  )
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [imageError, setImageError] = useState(false)
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const copyUser = async () => { try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(()=>setCopied(false),2000) } catch{} }
  const editUser = () => { console.log('Edit message', message.id) }

  const agentIcon = (agent?: string) => {
    if(!agent) return <Bot size={16}/>
    switch(agent.toLowerCase()){
      case 'internet search': return <Search size={16}/>
      case 'math solver': return <Calculator size={16}/>
      case 'youtube': return <Youtube size={16}/>
      case 'weather': return <Cloud size={16}/>
      default: return <Bot size={16}/>
    }
  }

  const agentBlock = (data: any, agent: string) => {
    if(!data) return null
    switch(agent.toLowerCase()){
      case 'internet search':
        return (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2"><Search size={14}/><span className="text-sm font-medium">Search Results</span></div>
            {data.results?.slice(0,3).map((r:any,i:number)=>(
              <div key={i} className="mb-2 last:mb-0">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">{r.title}</a>
                <p className="text-xs text-muted-foreground mt-1">{r.snippet}</p>
              </div>
            ))}
          </div>
        )
      case 'youtube':
        return (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2"><Youtube size={14}/><span className="text-sm font-medium">YouTube Videos</span></div>
            {data.videos?.slice(0,2).map((v:any,i:number)=>(
              <div key={i} className="mb-3 last:mb-0">
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:bg-muted/30 rounded p-2 transition-colors">
                  <img src={v.thumbnail} alt={v.title} className="w-20 h-12 object-cover rounded" onError={()=>setImageError(true)}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-2">{v.title}</div>
                    <div className="text-xs text-muted-foreground">{v.channel}</div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        )
      case 'math solver':
        return (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2"><Calculator size={14}/><span className="text-sm font-medium">Calculation</span></div>
            <div className="text-lg font-mono bg-background p-2 rounded">{data.solution}</div>
            {data.steps && <ol className="text-xs text-muted-foreground space-y-1 mt-2">{data.steps.map((s:string,i:number)=><li key={i}>{i+1}. {s}</li>)}</ol>}
          </div>
        )
      case 'weather':
        return (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2"><Cloud size={14}/><span className="text-sm font-medium">Weather</span></div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div><div className="text-lg font-semibold">{data.temperature}°C</div><div className="text-sm text-muted-foreground">{data.condition}</div><div className="text-xs text-muted-foreground">{data.location}</div></div>
              <div className="space-y-1"><div>Humidity: {data.humidity}%</div><div>Wind: {data.windSpeed} km/h</div></div>
            </div>
          </div>
        )
      default:
        return (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
            <div className="text-sm font-medium mb-2">Agent Data</div>
            <pre className="text-xs text-muted-foreground overflow-x-auto">{JSON.stringify(data,null,2)}</pre>
          </div>
        )
    }
  }

  return (
  <div className={`flex py-4 ${isUser ? 'justify-end' : 'justify-start'} group`} data-message-id={message.id}>
      {!isUser && <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground mr-2 sm:mr-3">{agentIcon(message.metadata?.agent)}</div>}
  {/* Remove artificial max-width for assistant messages; keep reasonable limit for user bubbles */}
  <div className={`${isUser ? 'max-w-[70%] order-1' : 'w-full order-2'} max-w-full`}> 
        {isUser ? (
          <div className="flex items-end gap-2">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 mb-2">
              <Button variant="ghost" size="sm" onClick={editUser} className="h-7 px-2 text-xs hover:bg-muted" title="Edit message"><Edit size={12}/></Button>
              <Button variant="ghost" size="sm" onClick={copyUser} className="h-7 px-2 text-xs hover:bg-muted" title={copied? 'Copied!' : 'Copy message'}><Copy size={12}/></Button>
            </div>
            <div className="bg-neutral-800 text-white rounded-full rounded-br-md px-3 sm:px-4 py-2 sm:py-2">
              <div className="whitespace-pre-wrap break-words text-sm sm:text-base">{message.content}</div>
            </div>
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground"><User size={14} className="sm:w-4 sm:h-4"/></div>
          </div>
        ) : (
          <div className="w-full">
            {message.type === 'text' && (
              <div className="relative w-full">
                {/* Render unified markdown output */}
                {(() => {
                  // Clean leaked dual tags before detection
                  // If explanation stored separately and showExplanation flag set, prefer that for rendering
                  const baseContent = (message.metadata?.showExplanation && (message.metadata as any)?.explanation) ? (message.metadata as any).explanation : message.content
                  const cleanedContent = baseContent.replace(/<\/?(CONCISE|EXPLANATION)>/gi,'').trim()
                  // Determine if we should use rich formatting
                  return <div data-rich-render="true"><ChatGPTRichRenderer content={cleanedContent} /></div>
                  })()
                }
                {message.metadata?.streaming && (
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground/60"><div className="w-1 h-1 bg-current rounded-full animate-pulse"/><span className="text-xs">streaming...</span></div>
                )}
              </div>
            )}
            {message.type === 'code' && (
              <div className="mt-2"><pre className="bg-card border border-border rounded-lg p-4 overflow-x-auto"><code>{message.content}</code></pre><Button variant="outline" size="sm" className="mt-2" onClick={()=>navigator.clipboard.writeText(message.content)}>Copy Code</Button></div>
            )}
            {message.type === 'image' && !imageError && (
              <div className="mt-2"><img src={message.content} alt="Generated image" className="max-w-full h-auto rounded-lg border" onError={()=>setImageError(true)} /></div>
            )}
            {message.type === 'video' && (
              <div className="mt-2"><video src={message.content} controls className="max-w-full h-auto rounded-lg border" /></div>
            )}
            {message.attachments?.length ? (
              <div className="mt-3 space-y-2">{message.attachments.map(a=> <div key={a.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded border text-sm"><span className="truncate">{a.name}</span><span className="text-xs text-muted-foreground">{(a.size/1024).toFixed(1)} KB</span></div>)}</div>
            ): null}
            {message.metadata?.agentData && message.metadata?.agent && agentBlock(message.metadata.agentData, message.metadata.agent)}
            {/* Only show action buttons when streaming is completely finished */}
            {!message.metadata?.streaming && !isCurrentlyStreaming && <ActionButtons message={message} />}
          </div>
        )}
        {!isUser && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {message.metadata?.model && <span>Model: {message.metadata.model}</span>}
            {message.metadata?.agent && <span>Agent: {message.metadata.agent}</span>}
            {message.metadata?.tokens && <span>Tokens: {message.metadata.tokens}</span>}
            {message.metadata?.streaming && <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>Streaming...</span>}
            {message.metadata?.error && <span className="text-destructive">Error occurred</span>}
          </div>
        )}
      </div>
    </div>
  )
}
