import { formatMessage } from '@/lib/formatting/newFormatter'

/**
 * Converts markdown content to rich HTML for Tiptap rendering
 * Handles math expressions, code blocks, and enhanced formatting
 * PRESERVES LaTeX expressions for KaTeX rendering
 */
export function convertMarkdownToRichHTML(content: string): string {
  if (!content) return ''
  
  // First apply our existing formatting pipeline
  const formatted = formatMessage(content)
  let html = formatted.content
  
  // IMPORTANT: Preserve LaTeX expressions by temporarily replacing them
  const mathExpressions: string[] = []
  
  // Extract and preserve display math ($$...$$)
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, expr) => {
    const placeholder = `__MATH_DISPLAY_${mathExpressions.length}__`
    mathExpressions.push(`$$${expr}$$`)
    return placeholder
  })
  
  // Extract and preserve inline math ($...$)
  html = html.replace(/\$([^$\n]+?)\$/g, (match, expr) => {
    const placeholder = `__MATH_INLINE_${mathExpressions.length}__`
    mathExpressions.push(`$${expr}$`)
    return placeholder
  })
  
  // Convert markdown headers to HTML
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')
  
  // Convert markdown bold/italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  
  // Convert markdown lists to HTML (preserve nested structure)
  html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<li>$2</li>')
  html = html.replace(/^-\s+(.*)$/gm, '<li>$1</li>')
  
  // Wrap consecutive list items in proper list tags
  const listItemRegex = /(<li>.*?<\/li>\s*)+/g
  html = html.replace(listItemRegex, (match) => {
    // Check if it's numbered or bulleted
    const hasNumbers = /^\d+\./.test(content)
    const tag = hasNumbers ? 'ol' : 'ul'
    return `<${tag}>${match}</${tag}>`
  })
  
  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Convert code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
  
  // Convert blockquotes
  html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
  
  // Convert line breaks to paragraphs
  html = html.split('\n\n').map(para => {
    if (para.trim() && !para.startsWith('<') && !para.includes('<')) {
      return `<p>${para.trim()}</p>`
    }
    return para
  }).join('\n')
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '')
  
  // RESTORE LaTeX expressions for KaTeX rendering
  mathExpressions.forEach((mathExpr, index) => {
    if (mathExpr.startsWith('$$')) {
      html = html.replace(`__MATH_DISPLAY_${index}__`, mathExpr)
    } else {
      html = html.replace(`__MATH_INLINE_${index}__`, mathExpr)
    }
  })
  
  console.log('Converted to HTML with preserved LaTeX:', html.substring(0, 200) + '...')
  return html.trim()
}

/**
 * Enhanced post-processor for mathematical content to make it more readable
 */
export function enhanceMathematicalContent(content: string): string {
  // Add visual separators for steps
  content = content.replace(/^(Step \d+:)/gm, '\n## $1')
  
  // Enhance final answer formatting with special class
  content = content.replace(/Final Answer:\s*(.+)$/gm, '\n<div class="final-answer">**🎯 Final Answer: $1**</div>\n')
  
  // Add checkmarks to completed calculations
  content = content.replace(/=\s*(\d+(?:\.\d+)?)\s*$/gm, '= $1 ✅')
  
  // Format percentage calculations nicely
  content = content.replace(/(\d+)%\s*=\s*(0\.\d+)/g, '**$1%** = $2')
  
  // Wrap calculation steps in special divs
  content = content.replace(/^(\d+\.\s*.+?:.*?)$/gm, '<div class="math-step">$1</div>')
  
  return content
}

// Deprecated: merged into ChatGPTRichRenderer unified pipeline
  
