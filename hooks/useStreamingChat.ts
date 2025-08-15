import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChatMessage } from '@/types'
import { useChatStore } from '@/lib/store'
import toast from 'react-hot-toast'
// Legacy StreamingFormattingEngine removed; use new segment-based formatter
// Lightweight inline formatting helpers (newFormatter removed)
// Basic cleanup: collapse >2 blank lines, trim, fix simple math spacing
function basicFormat(content: string): { content: string; confidence: number; type: string } {
  if (!content) return { content: '', confidence: 0, type: 'text' }
  let out = content
    .replace(/\r\n?/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/(^|[^$])(\d)\$(?=[^$]+?\$)/g,'$1$2 $') // 1$ x $ -> 1 $ x $
    .replace(/ +$/gm,'')
    .trim()
  // Simple heuristic: if we have steps or final answer or math -> explanation
  const hasSteps = /Step\s+1:|^\d+\.\s/m.test(out)
  const hasMath = /\$\$|\$[^$\n]+\$/m.test(out)
  const hasFinal = /Final Answer:/i.test(out)
  const type = (hasSteps || hasMath || hasFinal) ? 'explanation' : 'text'
  const confidence = (hasMath ? 0.9 : 0.6) + (hasSteps?0.05:0) + (hasFinal?0.05:0)
  return { content: out, confidence: Math.min(confidence,1), type }
}

// Minimal math artifact cleaners formerly in BasicPostProcessors
function normalizeInlineMathArtifacts(s: string): string {
  return s
    .replace(/\$\$([ \t]*?)\$/g,'$$$1') // stray single $ near $$
    .replace(/\$(\s+)([^$\n]+?)\$/g,'$ $2$') // trim leading spaces inside inline
}

// Function to parse intelligent response modes (replaces dual-output tags)
function parseIntelligentResponse(raw: string): { 
  mode: 'explanatory' | 'formal' | 'concise'; 
  content: string; 
  hasStructuredContent: boolean;
  cleanedContent: string 
} {
  if (!raw) return { mode: 'concise', content: '', hasStructuredContent: false, cleanedContent: '' }

  // Detect mode based on content characteristics
  const lowerContent = raw.toLowerCase()
  const hasTeachingLanguage = /think of|imagine|like a|similar to|let me explain|here's how|step by step|stage \d+|at its core/.test(lowerContent)
  const hasBusinessLanguage = /executive summary|key considerations|critical success factors|strategic|stakeholder|implementation|roi|kpi/.test(lowerContent)
  const hasStructuredSections = /\*\*[^*]+\*\*|## |### |#### /.test(raw)
  const hasSteps = /\d+\.\s|\*\*Stage \d+|\*\*Step \d+/.test(raw)
  const isShortAnswer = raw.trim().split('\n').length <= 3 && raw.length < 200

  let mode: 'explanatory' | 'formal' | 'concise' = 'concise'
  
  if (hasBusinessLanguage || (hasStructuredSections && !hasTeachingLanguage)) {
    mode = 'formal'
  } else if (hasTeachingLanguage || hasSteps || raw.length > 500) {
    mode = 'explanatory'  
  } else if (isShortAnswer || lowerContent.startsWith('use ') || lowerContent.includes('quick')) {
    mode = 'concise'
  } else {
    // Default based on length and complexity
    mode = raw.length > 300 ? 'explanatory' : 'concise'
  }

  const hasStructuredContent = hasStructuredSections || hasSteps || mode !== 'concise'
  
  return { 
    mode, 
    content: raw, 
    hasStructuredContent,
    cleanedContent: raw.trim()
  }
}

interface UseStreamingChatOptions {
  apiEndpoint?: string
  enableStreaming?: boolean
  chatId?: string
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const router = useRouter()
  const {
    apiEndpoint = '/api/chat/stream',
    enableStreaming = true,
    chatId
  } = options

  const { 
    addMessage, 
    updateMessage, 
    setLoading, 
    selectedModel, 
    settings,
    currentSession 
  } = useChatStore()

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [searchPhase, setSearchPhase] = useState<{ phase: 'searching' | 'complete', searchQuery?: string } | null>(null)
  // Accumulate raw streaming text; finalize with formatMessage when done
  const rawBufferRef = useRef<string>('')
  // Track last formatted length to throttle incremental formatting
  const lastFormatLenRef = useRef<number>(0)

  const regenerateMessage = useCallback(async (assistantMessageId: string, mode: 'add-details' | 'more-concise') => {
    const { messages } = useChatStore.getState()
    const target = messages.find(m => m.id === assistantMessageId && m.role === 'assistant')
    if (!target) return
    // Find previous user prompt
    const idx = messages.findIndex(m => m.id === assistantMessageId)
    let userPrompt = ''
    for (let i = idx - 1; i >= 0; i--) { if (messages[i].role === 'user') { userPrompt = messages[i].content; break } }
    if (!userPrompt) return

    // Always regenerate via backend for add-details to ensure fresh, smooth streaming (no local toggle)

    // Variant instruction (regeneration path)
    const instruction = mode === 'add-details'
    ? 'Regenerate with a richly detailed, well-structured explanation: numbered steps when helpful, brief rationale, properly formatted LaTeX for ALL math, and a **Final Answer: ...** line. Do NOT restate the question verbatim at the start. If you previously used dual sections you may keep <CONCISE> and <EXPLANATION> tags; otherwise just produce the detailed answer.'
      : 'Answer with the most concise single sentence or expression giving ONLY the final result in bold, then optionally append: "Want a breakdown?". No steps, no extra commentary.'

    const augmentedPrompt = `${userPrompt}\n\nVARIANT_MODE: ${mode}\n${instruction}`

    // Mark existing assistant message as streaming
    updateMessage(assistantMessageId, { content: '', metadata: { ...target.metadata, streaming: true, variant: mode } })
    setLoading(true)
    setStreamingMessageId(assistantMessageId)
    rawBufferRef.current = ''
    lastFormatLenRef.current = 0

  try {
      const response = await fetch(apiEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: { id: `regen-user-${Date.now()}`, role: 'user', content: augmentedPrompt, type: 'text', timestamp: Date.now() },
      // Lock to original model if present to avoid provider switching surprise
      model: (target.metadata?.model) || selectedModel,
          settings: {
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            enableAutoAgents: settings.enableAutoAgents,
            governance: settings.governance || { mode: 'smart', enabled: true },
          },
          sessionId: currentSession?.id,
        })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const reader = response.body?.getReader(); if (!reader) throw new Error('No reader')
      let accumulatedContent = ''
      let messageMetadata = { ...target.metadata }
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'start') {
              messageMetadata = { ...messageMetadata, model: data.model, outputMode: data.metadata?.outputMode || messageMetadata.outputMode }
            } else if (data.type === 'content' && data.content) {
              rawBufferRef.current += data.content
              accumulatedContent = rawBufferRef.current
                // Streaming display logic depends on variant mode
                let displayPortion = accumulatedContent
                if (mode === 'more-concise') {
                  const conciseOpenIdx = accumulatedContent.search(/<CONCISE>/i)
                  const conciseCloseIdx = accumulatedContent.search(/<\/CONCISE>/i)
                  if (conciseOpenIdx >= 0) {
                    if (conciseCloseIdx > conciseOpenIdx) {
                      displayPortion = accumulatedContent.substring(conciseOpenIdx + 9, conciseCloseIdx)
                    } else {
                      displayPortion = accumulatedContent.substring(conciseOpenIdx + 9)
                    }
                  }
                } else if (mode === 'add-details') {
                  // Strip tagging markers so user doesn't see raw tags
                  displayPortion = displayPortion.replace(/<CONCISE>/ig, '')
                    .replace(/<\/CONCISE>/ig, '')
                    .replace(/<EXPLANATION>/ig, '')
                    .replace(/<\/EXPLANATION>/ig, '')
                }
                let formattedContent = displayPortion
              const needFormat = (accumulatedContent.length - lastFormatLenRef.current) > 80
              if (needFormat) {
                try {
                  const partial = basicFormat(accumulatedContent)
                  if (partial.content.trim()) {
                    formattedContent = partial.content
                    lastFormatLenRef.current = accumulatedContent.length
                    messageMetadata = { ...messageMetadata, confidence: partial.confidence, segmentType: partial.type }
                  }
                } catch {}
              }
              updateMessage(assistantMessageId, { content: formattedContent, metadata: { ...messageMetadata, streaming: true } })
            } else if (data.type === 'done') {
              let finalContent = accumulatedContent
              try {
                const result = basicFormat(finalContent)
                if (result.content.trim()) {
                  finalContent = result.content
                  messageMetadata = { ...messageMetadata, confidence: result.confidence, segmentType: result.type }
                }
              } catch {}
              const parsed = parseIntelligentResponse(finalContent)
              // Infer mode
              let inferredMode: string = messageMetadata.outputMode || parsed.mode.toUpperCase()
              if (parsed.mode === 'explanatory') inferredMode = 'EXPLANATORY'
              else if (parsed.mode === 'formal') inferredMode = 'FORMAL'  
              else if (parsed.mode === 'concise') inferredMode = 'CONCISE'
              else if (/Step\s+1:|Final Answer:|✅ Final Answer:/i.test(finalContent)) inferredMode = 'EXPLANATORY'
              const showContent = (mode === 'add-details'
                ? parsed.cleanedContent
                : parsed.cleanedContent
              )
              rawBufferRef.current = ''
              lastFormatLenRef.current = 0
              updateMessage(assistantMessageId, {
                content: showContent,
                metadata: {
                  ...messageMetadata,
                  streaming: false,
                  completed: true,
                  outputMode: inferredMode,
                  responseMode: parsed.mode,
                  hasStructuredContent: parsed.hasStructuredContent,
                  showExplanation: mode === 'add-details' && parsed.hasStructuredContent,
                  variant: mode
                }
              })
            } else if (data.type === 'error') {
              throw new Error(data.error)
            }
          } catch {}
        }
      }
    } catch (e) {
      updateMessage(assistantMessageId, { content: 'Regeneration failed. Please try again.', metadata: { ...target.metadata, streaming: false, error: true } })
    } finally {
      setLoading(false)
      setStreamingMessageId(null)
    }
  }, [apiEndpoint, currentSession?.id, selectedModel, settings.temperature, settings.maxTokens, settings.enableAutoAgents, settings.governance, updateMessage])

  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!content.trim()) return

    console.log('SendMessage called:', { 
      chatId, 
      currentSessionId: currentSession?.id, 
      hasExistingSession: !!currentSession 
    })

    // Step 1: Create user message and show immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      type: 'text',
      timestamp: Date.now(),
      attachments: attachments?.map(file => ({
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      }))
    }

    // Step 2: Immediately add user message to UI for instant feedback
    addMessage(userMessage)
    
    // Step 3: Immediately create AI placeholder and start streaming
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      type: 'text',
      timestamp: Date.now(),
      metadata: { streaming: true, model: selectedModel }
    }
    
    addMessage(assistantMessage)
    setStreamingMessageId(assistantMessageId)
    setLoading(true)

    try {
      let currentChatId = chatId || currentSession?.id

      // Step 4: Only create new chat ID if we don't have one AND we're not in an existing session
      if (!currentChatId && !currentSession?.id) {
        console.log('Creating new chat - no existing chatId or session')
        fetch('/api/chat/id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
            model: selectedModel,
          }),
        }).then(async (response) => {
          if (response.ok) {
            const { id: newChatId } = await response.json()
            
            // Update session and sidebar
            const newSession = {
              id: newChatId,
              title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
              messages: [userMessage, assistantMessage],
              model: selectedModel,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            
            const { setCurrentSession, sessions } = useChatStore.getState()
            setCurrentSession(newSession)
            
            if (!sessions.find(s => s.id === newChatId)) {
              useChatStore.setState({ sessions: [newSession, ...sessions] })
            }
            
            // Update URL after streaming starts
            setTimeout(() => router.replace(`/chat/${newChatId}`), 2000)
          }
        }).catch(console.warn)
      }

      // Step 5: Start streaming immediately (priority)
      if (enableStreaming && settings.streamResponses) {
        // Update the assistant message directly with streaming content
        const streamResponse = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              content: content,
              role: 'user',
              type: 'text'
            },
            model: selectedModel,
            settings: {},
          }),
        })

        if (!streamResponse.ok) {
          throw new Error(`HTTP error! status: ${streamResponse.status}`)
        }

        const reader = streamResponse.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('No reader available')
        }

        let accumulatedContent = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                switch (parsed.type) {
                  case 'search_phase': {
                    // New: capture search status for UI indicator
                    console.log('🔍 HOOK(sendMessage): search_phase event', parsed)
                    setSearchPhase({ phase: parsed.phase, searchQuery: parsed.searchQuery })
                    if (parsed.phase === 'complete') {
                      setTimeout(() => {
                        // Only clear if unchanged (avoid race with new search)
                        setSearchPhase(curr => (curr && curr.phase === 'complete') ? null : curr)
                      }, 1000)
                    }
                    break
                  }
                  case 'content': {
                    if (!parsed.content) break
                    accumulatedContent += parsed.content
                    updateMessage(assistantMessageId, {
                      ...assistantMessage,
                      content: accumulatedContent,
                      metadata: { streaming: true, model: selectedModel }
                    })
                    break
                  }
                  case 'done':
                    // Exit outer loops; let post-loop finalize
                    break
                  case 'error':
                    throw new Error(parsed.error || 'Stream error')
                  default:
                    // Ignore other event types silently
                    break
                }
              } catch (e) {
                // Ignore parse errors for malformed SSE lines
              }
            }
          }
        } finally {
          reader.releaseLock()
        }

        // Mark streaming as complete
        updateMessage(assistantMessageId, {
          ...assistantMessage,
          content: accumulatedContent,
          metadata: { model: selectedModel }
        })
      } else {
        // Non-streaming response
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              content: content,
              role: 'user',
              type: 'text'
            },
            model: selectedModel,
            settings: {},
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        updateMessage(assistantMessageId, {
          ...assistantMessage,
          content: data.response?.content || 'No response received',
          metadata: { model: selectedModel }
        })
      }
      
    } catch (error) {
      console.error('Chat error:', error)
      
      // Update user message status to error
      updateMessage(userMessage.id, { 
        ...userMessage, 
        metadata: { status: 'error' } 
      })
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        type: 'text',
        timestamp: Date.now(),
        metadata: { error: true }
      }
      
      addMessage(errorMessage)
      toast.error('Failed to send message')
    } finally {
      setLoading(false)
      setStreamingMessageId(null)
    }
  }, [addMessage, updateMessage, setLoading, selectedModel, settings, enableStreaming, chatId, router])

  const handleStreamingResponse = async (userMessage: ChatMessage, dynamicChatId?: string) => {
    const endpoint = dynamicChatId ? `/api/chat/${dynamicChatId}/stream` : apiEndpoint
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        model: selectedModel,
        settings: {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          enableAutoAgents: settings.enableAutoAgents,
          governance: settings.governance || { mode: 'smart', enabled: true },
        },
        sessionId: currentSession?.id,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No reader available')
    }

    // Create assistant message placeholder
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      type: 'text',
      timestamp: Date.now(),
      metadata: {
        model: selectedModel,
        streaming: true
      }
    }

    addMessage(assistantMessage)
    setStreamingMessageId(assistantMessageId)
    let accumulatedContent = ''
    let messageMetadata = assistantMessage.metadata
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            switch (data.type) {
              case 'start':
                messageMetadata = { ...messageMetadata, model: data.model }
                break
              case 'search_phase':
                console.log('🔍 HOOK: Search phase received:', data)
                setSearchPhase({ phase: data.phase, searchQuery: data.searchQuery })
                // Clear search phase when search is complete - keep it visible longer
                if (data.phase === 'complete') {
                  console.log('🔍 HOOK: Search complete, clearing in 1000ms')
                  setTimeout(() => {
                    console.log('🔍 HOOK: Actually clearing search phase now')
                    setSearchPhase(null)
                  }, 1000) // Longer delay to ensure smooth transition
                }
                break
              case 'content':
                if (!data.content) break
                rawBufferRef.current += data.content
                accumulatedContent = rawBufferRef.current
                const mode = data.metadata?.outputMode || messageMetadata?.outputMode || 'AUTO'
                let displayPortion = accumulatedContent
                // For new intelligent modes, show content as-is during streaming
                if (mode === 'CONCISE' || mode === 'FORMAL' || mode === 'EXPLANATORY' || mode === 'AUTO') {
                  displayPortion = accumulatedContent
                } else if (mode === 'CONCISE_ONLY' || mode === 'DUAL') {
                  // Legacy dual-tag support for backward compatibility
                  const o = accumulatedContent.search(/<CONCISE>/i)
                  const c = accumulatedContent.search(/<\/CONCISE>/i)
                  if (o >= 0) displayPortion = c > o ? accumulatedContent.substring(o + 9, c) : accumulatedContent.substring(o + 9)
                }
                displayPortion = displayPortion.replace(/<\/?(CONCISE|EXPLANATION)>/gi,'')
                displayPortion = normalizeInlineMathArtifacts(displayPortion)
                // Detect early indicators for rich formatting and persist preference
                const richIndicators = /\$\$|\$[^$\n]+\$|Step\s+1:|Final Answer:|^\d+\.\s/m.test(accumulatedContent)
                if (richIndicators && !(messageMetadata as any)?.richPreferred) {
                  messageMetadata = { ...(messageMetadata || {}), richPreferred: true }
                }
                let formattedContent = displayPortion
                const needFormat = (displayPortion.length - lastFormatLenRef.current) > 140
                if (needFormat) {
                  try {
                    const partial = basicFormat(displayPortion)
                    if (partial.content.trim()) {
                      formattedContent = partial.content
                      lastFormatLenRef.current = displayPortion.length
                      messageMetadata = { ...messageMetadata, confidence: partial.confidence, segmentType: partial.type, outputMode: mode }
                    }
                  } catch {}
                }
                updateMessage(assistantMessageId, { content: formattedContent, metadata: { ...messageMetadata, streaming: true, outputMode: mode } })
                break
              case 'done':
                // Handle MongoDB endpoint response format (only assistant message now)
                if (chatId && data.assistantMessage) {
                  // Add only the assistant message from MongoDB to the store
                  addMessage({
                    id: data.assistantMessage.id,
                    role: data.assistantMessage.role,
                    content: data.assistantMessage.content,
                    type: data.assistantMessage.type,
                    timestamp: data.assistantMessage.timestamp,
                    metadata: {
                      ...data.assistantMessage.metadata,
                      streaming: false,
                      completed: true
                    },
                    attachments: data.assistantMessage.attachments || []
                  })
                } else {
                  // Handle regular streaming endpoint
                  let finalContent = accumulatedContent
                  try {
                    const result = basicFormat(finalContent)
                    if (result.content.trim()) {
                      finalContent = result.content
                      messageMetadata = { ...messageMetadata, confidence: result.confidence, segmentType: result.type }
                    }
                  } catch {}
                  const modeFinal = messageMetadata?.outputMode || 'AUTO'
                  let responseMode: 'explanatory' | 'formal' | 'concise' = 'concise'
                  let hasStructuredContent = false
                  let initialContent = finalContent
                  const parsed = parseIntelligentResponse(finalContent)
                  responseMode = parsed.mode
                  hasStructuredContent = parsed.hasStructuredContent
                  
                  // Final rich indicators (steps, math, final answer, lists)
                  const finalRich = /\$\$|\$[^$\n]+\$|\\\(|\\\)|Step\s+1:|Final Answer:|^\d+\.\s|✅/m.test(finalContent)
                  
                  initialContent = parsed.cleanedContent
                  
                  // Ensure richPreferred is preserved for complex content
                  const shouldPreferRich = (messageMetadata as any)?.richPreferred || finalRich || 
                                         hasStructuredContent ||
                                         messageMetadata?.variant === 'add-details';
                  
                  updateMessage(assistantMessageId, { 
                    content: initialContent, 
                    metadata: { 
                      ...messageMetadata, 
                      outputMode: responseMode.toUpperCase(), 
                      responseMode,
                      streaming: false, 
                      completed: true, 
                      hasStructuredContent,
                      showExplanation: responseMode === 'explanatory' || responseMode === 'formal', 
                      richPreferred: shouldPreferRich 
                    } 
                  })
                }
                
                rawBufferRef.current = ''
                lastFormatLenRef.current = 0
                // Don't clear search phase here - let it be cleared by the search_phase event
                break
              case 'error':
                throw new Error(data.error)
            }
          } catch {
            console.warn('Failed to parse SSE data:', line)
          }
        }
      }
    } finally {
      reader.releaseLock()
      setStreamingMessageId(null)
      
      // Handle URL update for new chats after streaming is complete
      const { messages } = useChatStore.getState()
      const userMsg = messages.find((m: ChatMessage) => m.role === 'user' && m.metadata?.pendingChatId)
      if (userMsg?.metadata?.pendingChatId && !chatId) {
        // Clear the pending flag and update URL
        updateMessage(userMsg.id, { 
          ...userMsg, 
          metadata: {} 
        })
        router.replace(`/chat/${userMsg.metadata.pendingChatId}`)
      }
    }
  }

  const handleRegularResponse = async (userMessage: ChatMessage, dynamicChatId?: string) => {
    const endpoint = dynamicChatId ? `/api/chat/${dynamicChatId}` : '/api/chat'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        model: selectedModel,
        settings: {
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          enableAutoAgents: settings.enableAutoAgents,
          governance: settings.governance || { mode: 'smart', enabled: true },
        },
        sessionId: currentSession?.id,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    addMessage(data.response)
  }

  const stopGeneration = useCallback(() => {
    if (streamingMessageId) {
  updateMessage(streamingMessageId, {
        metadata: { 
          ...useChatStore.getState().messages.find(m => m.id === streamingMessageId)?.metadata,
          streaming: false,
          stopped: true 
        }
      })
  rawBufferRef.current = ''
      setStreamingMessageId(null)
      setLoading(false)
    }
  }, [streamingMessageId, updateMessage, setLoading])

  return {
    sendMessage,
  regenerateMessage,
    stopGeneration,
    isStreaming: streamingMessageId !== null,
    streamingMessageId,
    searchPhase,
  }
}
