'use client'

import { useState, useRef, KeyboardEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { 
  Send, 
  Paperclip, 
  X, 
  ChevronDown, 
  Bot, 
  Search, 
  Clock, 
  Youtube, 
  Calculator, 
  Cloud, 
  HardDrive,
  Settings,
  Square,
  Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getModelsByProvider, ModelInfo } from '@/lib/models-config'
import { useChatStore } from '@/lib/store'

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void
  disabled?: boolean
  isStreaming?: boolean
  onStopGeneration?: () => void
}

export default function ChatInput({ onSendMessage, disabled = false, isStreaming = false, onStopGeneration }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isToolsExpanded, setIsToolsExpanded] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const selectedModel = useChatStore((s) => s.selectedModel)
  const selectedProvider = useChatStore((s) => s.selectedProvider)
  const setSelectedModel = useChatStore((s) => s.setSelectedModel)

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const fetchedModels = await getModelsByProvider(selectedProvider)
        setModels(fetchedModels)
      } catch (error) {
        console.error('Error fetching models:', error)
      }
    }
    fetchModels()
  }, [selectedProvider])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }

    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isModelDropdownOpen])

  // Effect to handle initial textarea sizing and reset on message clear
  useEffect(() => {
    if (textareaRef.current) {
      if (message === '') {
        // Reset to minimum height when empty
        textareaRef.current.style.height = '40px'
        textareaRef.current.style.overflowY = 'hidden'
      }
    }
  }, [message])

  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName)
    setIsModelDropdownOpen(false)
  }

  const handleSubmit = () => {
    if ((message.trim() || attachments.length > 0) && !disabled) {
      onSendMessage(message.trim(), attachments)
      setMessage('')
      setAttachments([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    
    if (textareaRef.current) {
      // Reset height to auto to get accurate scrollHeight
      textareaRef.current.style.height = 'auto'
      
      // Calculate new height with constraints
      const scrollHeight = textareaRef.current.scrollHeight
      const minHeight = 40 // min-h-[40px]
      const maxHeight = 200 // max-h-[200px]
      
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      textareaRef.current.style.height = `${newHeight}px`
      
      // Handle overflow for max height
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.overflowY = 'auto'
      } else {
        textareaRef.current.style.overflowY = 'hidden'
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File "${file.name}" is too large. Maximum size is 10MB.`)
        return false
      }
      return true
    })
    
    setAttachments(prev => [...prev, ...validFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleAgentCall = (agentType: string) => {
    const prefix = `@${agentType} `
    setMessage(prev => prefix + prev)
    setActiveTool(agentType)
    textareaRef.current?.focus()
    
    // Clear active tool after a short delay
    setTimeout(() => setActiveTool(null), 2000)
  }

  // Group models by category
  const groupedModels = models.reduce((acc, model) => {
    const category = model.category || 'text'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(model)
    return acc
  }, {} as Record<string, ModelInfo[]>)

  const categoryLabels = {
    text: 'Text Generation',
    image: 'Image Generation', 
    voice: 'Voice & Audio'
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="ml-0 lg:ml-64">
        <div className="max-w-[768px] mx-auto px-4 pb-4">
          {/* ChatGPT-style Input Container */}
          <div className="mb-4 bg-white dark:bg-neutral-800 rounded-md shadow-black dark:border-neutral-600">
            
            {/* Attachments Display */}
            {attachments.length > 0 && (
              <div className="px-2 sm:px-4 pt-2 sm:pt-3 flex flex-wrap gap-1 sm:gap-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 sm:gap-2 bg-neutral-100 dark:bg-neutral-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md">
                    <Plus size={10} className="sm:w-3 sm:h-3" />
                    <span className="text-xs truncate max-w-16 sm:max-w-24">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                      onClick={() => removeAttachment(index)}
                    >
                      <X size={8} className="sm:w-[10px] sm:h-[10px]" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Main Input Row - ChatGPT Style Expandable */}
            <div className="flex items-end gap-2 px-2 py-2 min-h-[56px]">
              {/* Left - File Upload Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 flex-shrink-0"
              >
                <Plus size={18} />
              </Button>
              
              {/* Center - Text Input */}
              
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message LayerChat..."
                  disabled={disabled}
                  className="border-0 bg-transparent text-sm sm:text-base focus:ring-0 focus:outline-none w-full resize-none overflow-hidden min-h-[40px] max-h-[200px] transition-all duration-150 ease-out"
                  rows={1}
                />
              
              
              {/* Right Side - Gear Icon for Tools & Send Button */}
              <div className="flex items-end gap-2 flex-shrink-0">
                {/* Gear Icon for All Tools */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                    className="h-10 w-10 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700"
                  >
                    <Settings size={18} />
                  </Button>
                  
                  {/* All Tools in Gear Dropdown */}
                  {isToolsExpanded && (
                    <div className="absolute bottom-full right-0 mb-2 w-56 sm:w-64 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-lg shadow-xl z-50 max-h-[70vh] overflow-y-auto">
                      <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
                        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Quick Actions</div>
                        
                        {/* Agent Shortcuts - Icon Only */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { key: 'search', icon: Search, label: 'Web Search', color: 'blue' },
                            { key: 'youtube', icon: Youtube, label: 'YouTube', color: 'red' },
                            { key: 'time', icon: Clock, label: 'Time', color: 'green' },
                            { key: 'math', icon: Calculator, label: 'Math', color: 'purple' }
                          ].map(({ key, icon: Icon, label, color }) => {
                            const isActive = activeTool === key
                            const getColorClasses = () => {
                              if (isActive) {
                                switch (color) {
                                  case 'blue': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                  case 'red': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                  case 'green': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                  case 'purple': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                  default: return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                                }
                              }
                              return 'bg-neutral-50 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-600'
                            }
                            
                            return (
                              <button
                                key={key}
                                onClick={() => {
                                  handleAgentCall(key)
                                  setIsToolsExpanded(false)
                                }}
                                className={`flex items-center justify-center p-3 rounded-lg transition-all duration-200 ${getColorClasses()}`}
                                title={label}
                              >
                                <Icon size={20} />
                              </button>
                            )
                          })}
                        </div>

                        <hr className="dark:border-neutral-600" />

                        {/* Model Selector */}
                        <div>
                          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Change Model</div>
                          <div className="relative" ref={modelDropdownRef}>
                            <button
                              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Bot size={16} />
                                <span className="font-medium">{selectedProvider}</span>
                                <span>•</span>
                                <span className="font-mono text-xs">{selectedModel}</span>
                              </div>
                              <ChevronDown size={14} className={`transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {/* Model Dropdown */}
                            {isModelDropdownOpen && (
                              <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                <div className="p-2">
                                  {Object.entries(groupedModels).map(([category, categoryModels]) => (
                                    <div key={category} className="mb-3 last:mb-0">
                                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-2 py-1 uppercase tracking-wide">
                                        {categoryLabels[category as keyof typeof categoryLabels] || category}
                                      </div>
                                      <div className="space-y-1">
                                        {categoryModels.map((model) => (
                                          <button
                                            key={model.name}
                                            onClick={() => {
                                              handleModelSelect(model.name)
                                              setIsModelDropdownOpen(false)
                                              setIsToolsExpanded(false)
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${
                                              selectedModel === model.name ? 'bg-neutral-100 dark:bg-neutral-700 font-medium' : ''
                                            }`}
                                          >
                                            <div className="font-mono text-xs">{model.name}</div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <hr className="border-neutral-200 dark:border-neutral-600" />
                        
                        {/* Cloud Storage (Coming Soon) */}
                        <div>
                          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Cloud Storage</div>
                          <div className="space-y-1">
                            {[
                              { icon: Cloud, label: 'Google Drive' },
                              { icon: HardDrive, label: 'OneDrive' }
                            ].map(({ icon: Icon, label }) => (
                              <button
                                key={label}
                                disabled
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 rounded-lg opacity-50"
                              >
                                <Icon size={16} />
                                <span>{label}</span>
                                <span className="ml-auto text-xs">Soon</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Send/Stop Button */}
                {isStreaming ? (
                  <Button
                    onClick={onStopGeneration}
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0"
                    size="icon"
                  >
                    <Square size={14} className="sm:w-[18px] sm:h-[18px] text-white" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={disabled || (!message.trim() && attachments.length === 0)}
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-600 dark:hover:bg-neutral-500 flex-shrink-0"
                    size="icon"
                  >
                    <Send size={14} className="sm:w-[18px] sm:h-[18px] text-white" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,video/*,audio/*,application/pdf,text/*"
            />
          </div>
        </div>
      </div>
    </div>
  )
}