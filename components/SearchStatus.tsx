'use client'

interface SearchStatusProps {
  phase: 'searching' | 'complete'
  searchQuery?: string
}

export default function SearchStatus({ phase, searchQuery }: SearchStatusProps) {
  if (phase === 'complete') return null

  return (
    <span className="search-gradient-text text-lg whitespace-nowrap my-2">
      Searching the Web
    </span>
  )
}
