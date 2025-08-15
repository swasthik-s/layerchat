'use client'


import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, Bot, ChevronDown, User, Shield, ShieldCheck, ShieldX } from 'lucide-react'
import { getProviders } from '@/lib/models-config'
import { useChatStore } from '@/lib/store'
import { AIGovernance } from '@/lib/governance'


interface HeaderProps {
  onToggleSidebar: () => void
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const [providers, setProviders] = useState<string[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isGovernanceDropdownOpen, setIsGovernanceDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const governanceDropdownRef = useRef<HTMLDivElement>(null)
  const selectedProvider = useChatStore((s) => s.selectedProvider)
  const setSelectedProvider = useChatStore((s) => s.setSelectedProvider)
  const settings = useChatStore((s) => s.settings)
  const updateSettings = useChatStore((s) => s.updateSettings)

  useEffect(() => {
    const loadedProviders = getProviders()
    console.log('Loaded providers:', loadedProviders)
    console.log('Current selectedProvider:', selectedProvider)
    console.log('Dropdown open state:', isDropdownOpen)
    setProviders(loadedProviders)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (governanceDropdownRef.current && !governanceDropdownRef.current.contains(event.target as Node)) {
        setIsGovernanceDropdownOpen(false)
      }
    }

    if (isDropdownOpen || isGovernanceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, isGovernanceDropdownOpen])

  const handleProviderSelect = (providerName: string) => {
    console.log('Provider selected:', providerName)
    console.log('Previous provider:', selectedProvider)
    setSelectedProvider(providerName)
    setIsDropdownOpen(false)
    console.log('Provider selection complete')
  }

  const handleDropdownToggle = () => {
    console.log('Dropdown toggle clicked, current state:', isDropdownOpen)
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleGovernanceToggle = () => {
    setIsGovernanceDropdownOpen(!isGovernanceDropdownOpen)
  }

  const handleGovernanceModeChange = (mode: 'smart' | 'internal' | 'internet') => {
    updateSettings({
      governance: {
        ...(settings.governance || { mode: 'smart', enabled: true }),
        mode
      }
    })
    setIsGovernanceDropdownOpen(false)
  }

  const governanceModes = AIGovernance.getAvailableModes()

  return (
    <header className="flex items-center justify-between p-4 bg-transparent">
      {/* Left section */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="lg:hidden mr-2"
        >
          <Menu size={20} />
        </Button>
        
        {/* Provider selector dropdown (Box 1) */}
        <div className="relative" ref={dropdownRef}>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2"
            onClick={handleDropdownToggle}
          >
            <Bot size={16} />
            <span className="font-medium">{selectedProvider}</span>
            <ChevronDown size={14} />
          </Button>
          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-48 bg-card border rounded shadow-lg z-[100]">
              {providers.map((provider) => (
                <button
                  key={provider}
                  className={`w-full text-left px-4 py-2 hover:bg-muted ${selectedProvider === provider ? 'bg-muted' : ''}`}
                  onClick={() => handleProviderSelect(provider)}
                >
                  {provider}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <div className="text-sm text-muted-foreground hidden sm:block">
          <button className="text-primary hover:underlin p-2.5 rounded-full hover:bg-neutral-800">
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
