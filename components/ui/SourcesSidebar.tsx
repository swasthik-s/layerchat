'use client'

import React from 'react'
import { ExternalLink, Calendar, X } from 'lucide-react'

interface Source {
  id: number
  title: string
  url: string
  snippet: string
  date?: string
}

interface SourcesSidebarProps {
  sources: Source[]
  isOpen: boolean
  onClose: () => void
}

export function SourcesSidebar({ sources, isOpen, onClose }: SourcesSidebarProps) {
  if (!isOpen || !sources.length) return null

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700 shadow-lg z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Sources
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
          aria-label="Close sources"
        >
          <X size={16} className="text-neutral-500" />
        </button>
      </div>

      {/* Sources List */}
      <div className="overflow-y-auto h-full pb-4">
        {sources.map((source) => (
          <div
            key={source.id}
            className="p-4 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            {/* Source Number */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-neutral-100 dark:bg-neutral-800 text-white dark:text-neutral-300 rounded-full flex items-center justify-center text-sm font-medium">
                {source.id}
              </div>
              
              <div className="flex-1 min-w-0">
                {/* Title & Link */}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <h3 className="font-medium text-neutral-900 dark:text-white group-hover:text-neutral-700 dark:group-hover:text-neutral-400 transition-colors line-clamp-2 text-sm leading-tight">
                    {source.title}
                  </h3>
                  
                  <div className="flex items-center gap-1 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <ExternalLink size={12} />
                    <span className="truncate">
                      {new URL(source.url).hostname}
                    </span>
                  </div>
                </a>

                {/* Snippet */}
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
                  {source.snippet}
                </p>

                {/* Date */}
                {source.date && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <Calendar size={12} />
                    <span>{source.date}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface InlineSourceLinkProps {
  sourceNumber: number
  onClick: () => void
}

export function InlineSourceLink({ sourceNumber, onClick }: InlineSourceLinkProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center w-5 h-5 text-xs bg-neutral-100 dark:bg-neutral-800 text-white dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-900/50 rounded-full font-medium transition-colors ml-1 align-top"
      style={{ lineHeight: '1' }}
      title={`View source ${sourceNumber}`}
    >
      {sourceNumber}
    </button>
  )
}
