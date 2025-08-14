'use client'

// Deprecated: merged into ChatGPTRichRenderer
// This file is kept for compatibility but functionality moved to ChatGPTRichRenderer.tsx

export interface MarkdownItRendererProps { 
  content: string
  className?: string 
}

export const MarkdownItRenderer: React.FC<MarkdownItRendererProps> = ({ content, className = '' }) => {
  console.warn('MarkdownItRenderer is deprecated. Use ChatGPTRichRenderer instead.')
  return <div className={className}>{content}</div>
}

