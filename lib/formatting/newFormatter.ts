import katex from 'katex'
import DOMPurify from 'dompurify'
// Hardened sanitizer using DOMPurify; configurable allowlists.

export type SegmentType = 'math' | 'code' | 'text' | 'markdown'
export interface Segment { type: SegmentType; raw: string; rendered?: string; valid?: boolean }
export interface FormatOptions { postProcessors?: ((s: string) => string)[]; allowedTags?: string[]; allowedAttrs?: string[] }
export interface FormattingResult { content: string; segments: Segment[]; type: SegmentType | 'mixed'; confidence: number }

const DEFAULT_ALLOWED_TAGS = ['b','i','em','strong','u','ul','ol','li','p','br','code','pre','blockquote']
const DEFAULT_ALLOWED_ATTRS: string[] = []

// NEW UNIFIED APPROACH: Post-process first, then let ReactMarkdown handle everything
export function formatMessage(content: string, options: FormatOptions = {}): FormattingResult {
  if (!content) return { content: '', segments: [], type: 'text', confidence: 0 }
  
  // Apply all post-processors to clean and normalize the raw content
  if (options.postProcessors) { 
    for (const fn of options.postProcessors) { 
      try { content = fn(content) } catch {} 
    } 
  }
  
  // Instead of complex segmentation, just normalize math delimiters for ReactMarkdown
  content = unifyMathDelimiters(content)
  
  // Return the cleaned markdown content - let ReactMarkdown handle the rendering
  return { 
    content, 
    segments: [{ type: 'markdown', raw: content, rendered: content, valid: true }], 
    type: 'markdown', 
    confidence: 1.0 
  }
}

// Unified math delimiter normalizer - converts all math formats to standard $...$ and $$...$$
function unifyMathDelimiters(content: string): string {
  // Convert \\[...\\] to $$...$$
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')
  
  // Convert [LaTeX] to $$LaTeX$$ (only if contains LaTeX commands)
  content = content.replace(/\[([\s\S]*?)\]/g, (match, inner) => {
    if (/\\(frac|sqrt|sum|int|cdot|alpha|beta|gamma|theta|times|pi|Delta|left|right)|[=^_]/.test(inner)) {
      return `$$${inner}$$`
    }
    return match // Keep as regular text if no LaTeX
  })
  
  // Ensure display math $$....$$ has proper line breaks
  content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    const trimmed = inner.trim()
    if (trimmed.includes('\n') || trimmed.length > 50) {
      return `\n$$${trimmed}$$\n`
    }
    return match
  })
  
  return content
}

function sanitizeHTML(input: string, opts: { allowedTags?: string[]; allowedAttrs?: string[] } = {}): string {
  // If DOMPurify unavailable (SSR without window), return raw input (caller must trust source or run server-side sanitization).
  try {
    if (typeof window === 'undefined') return input
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: opts.allowedTags ?? DEFAULT_ALLOWED_TAGS, ALLOWED_ATTR: opts.allowedAttrs ?? DEFAULT_ALLOWED_ATTRS })
  } catch {
    // Fallback minimal stripping of scripts/styles & event handlers
    return input
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, '')
  }
}
function escapeHTML(input: string): string { return input.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)) }

// Enhanced segmentation: detect code fences, math, inline code, then remaining text lines; also split mixed math within lines.
function segmentContent(content: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  // Unified pattern: code fences, $$...$$, inline $, \\[...] display math, bare [...] blocks (possibly math), inline code.
  // Note: We purposefully match \\[ ... \\] (single backslash LaTeX display math) and also bare [ ... ] so we can heuristically
  // classify the latter as math only if LaTeX commands appear; otherwise we leave it as normal text.
  const pattern = /```([\w+-]*)\n([\s\S]*?)```|\$\$([\s\S]*?)\$\$|\$([^\$]+)\$|\\\[((?:.|\n)*?)\\\]|\[((?:.|\n)*?)\]|`([^`]+)`/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...segmentMarkdownAndInline(content.slice(lastIndex, match.index)))
    }

    if (match[1] !== undefined) {
      // Fenced code block
      segments.push({ type: 'code', raw: match[2] })
    } else if (match[3] !== undefined) {
      // $$ block math
      segments.push({ type: 'math', raw: match[3] })
    } else if (match[4] !== undefined) {
      // Inline math $ ... $
      segments.push({ type: 'math', raw: match[4] })
    } else if (match[5] !== undefined) {
      // \\[ ... \\] display math (standard LaTeX)
      segments.push({ type: 'math', raw: match[5] })
    } else if (match[6] !== undefined) {
      // Bare [ ... ] - treat as math only if it contains LaTeX command sequences; else keep as text (including brackets)
      const inner = match[6]
      if (/\\[a-zA-Z]+/.test(inner)) {
        segments.push({ type: 'math', raw: inner })
      } else {
        segments.push({ type: 'text', raw: `[${inner}]` })
      }
    } else if (match[7] !== undefined) {
      // Inline code
      segments.push({ type: 'code', raw: match[7] })
    }
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < content.length) {
    segments.push(...segmentMarkdownAndInline(content.slice(lastIndex)))
  }
  return segments
}

function segmentMarkdownAndInline(text: string): Segment[] {
  const out: Segment[] = []
  const lines = text.split(/\n/)
  for (const rawLine of lines) {
    const line = rawLine
    if (!line.trim()) continue
    if (/^#{1,6}\s/.test(line) || /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) { out.push({ type: 'markdown', raw: line }); continue }
    // Inline math patterns within a normal line: split them out so KaTeX renders individually
    let cursor = 0
    const inlineMath = /\\\\\(([^\\]+?)\\\\\)|\$([^$\n]+)\$/g // match \(...\) or $...$
    let m: RegExpExecArray | null
    const fragments: Segment[] = []
    while ((m = inlineMath.exec(line)) !== null) {
      if (m.index > cursor) fragments.push({ type: 'text', raw: line.slice(cursor, m.index) })
      const mathContent = m[1] ?? m[2]
      fragments.push({ type: 'math', raw: mathContent })
      cursor = m.index + m[0].length
    }
    if (cursor < line.length) fragments.push({ type: 'text', raw: line.slice(cursor) })
    if (fragments.length === 1) { out.push(fragments[0]) } else { out.push(...fragments) }
  }
  return out
}

function coalesceAdjacentText(segments: Segment[]): Segment[] {
  const merged: Segment[] = []
  for (const seg of segments) {
    const prev = merged[merged.length - 1]
    if (prev && prev.type === 'text' && seg.type === 'text') { prev.raw += seg.raw; continue }
    merged.push(seg)
  }
  return merged
}

export const BasicPostProcessors = {
  trimSpaces: (s: string) => s.replace(/\s+$/gm, ''),
  collapseBlank: (s: string) => s.replace(/\n{3,}/g, '\n\n'),
  removeModelHeaders: (s: string) => s.replace(/^Model:.*$/gmi, ''),
  // Some models (e.g., Mistral variants) emit LaTeX inside bare square brackets without $ or $$ delimiters.
  // Example: [ 25% = \frac{25}{100} = 0.25 ]
  // We promote such standalone bracketed lines containing TeX commands into display math $$...$$ so segmentation picks them up.
  normalizeMistralMath: (s: string) => s.split(/\n/).map(line => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return line
    const inner = trimmed.slice(1, -1).trim()
    if (!inner) return line
    if ((/\\(frac|times|sqrt|pi|sum|int|alpha|beta|gamma|Delta|theta|left|right)|[=^_]/.test(inner)) && !/[\$]/.test(inner)) {
      const braceBalanced = (() => { let c=0; for (const ch of inner){ if(ch==='{' ) c++; else if(ch==='}') c--; if(c<0) return false } return c===0 })()
      if (braceBalanced) return `$$${inner}$$`
    }
    return line
  }).join('\n'),
  // Multi-line bracket math blocks:
  // [\n a + b = c \n]
  normalizeSquareBracketMath: (s: string) => {
    const lines = s.split(/\n/)
    const out: string[] = []
    for (let i=0; i<lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '[') {
        let j = i + 1
        const block: string[] = []
        while (j < lines.length && lines[j].trim() !== ']') { block.push(lines[j]); j++ }
        if (j < lines.length && lines[j].trim() === ']') { // found closing
          const inner = block.join('\n').trim()
            // Heuristic: treat as math if TeX-ish patterns present
          if (inner && /\\(frac|times|sqrt|pi|sum|int|cdot|alpha|beta|gamma|theta)|[=^_]/.test(inner) && !/\$\$|\$|\\\\\[|\\\\\(/.test(inner)) {
            out.push(`$$${inner}$$`)
            i = j // skip over closing bracket
            continue
          }
        }
      }
      out.push(line)
    }
    return out.join('\n')
  },
  // Fallback regex-based normalization for any remaining bracketed math blocks not caught by line-walking logic.
  // Captures patterns like: "[ ...TeX... ]" (single line) or multi-line with leading/trailing blanks.
  normalizeLooseBracketMath: (s: string) => {
  // Normalize line endings first
  s = s.replace(/\r\n?/g, '\n')
  // Multi-line blocks: allow whitespace before [ and after ]
  s = s.replace(/(^|\n)[ \t]*\[[ \t]*\n([\s\S]*?)\n[ \t]*\][ \t]*(?=\n|$)/g, (m, prefix, inner) => {
      const content = inner.trim()
      if (!content) return m
      if (/\\(frac|sqrt|sum|int|cdot|alpha|beta|gamma|theta)|[=^_\\]/.test(content) && !/\$\$|\$|\\\\\[|\\\\\(/.test(content)) {
        return `${prefix}$$${content}$$`
      }
      return m
    })
    // Single-line inline blocks
  s = s.replace(/\n?[ \t]*\[[ \t]*([^\n\]]{4,}?)\s*\][ \t]*(?=\n|$)/g, (m, inner) => {
      const content = inner.trim()
      if (/\\(frac|sqrt|sum|int|cdot|alpha|beta|gamma|theta)|[=^_\\]/.test(content) && !/\$|\\\\\[|\\\\\(/.test(content)) {
        return `$$${content}$$`
      }
      return m
    })
  // Remove any now orphan standalone bracket lines (with optional whitespace)
  s = s.replace(/^[ \t]*(\[|\])[ \t]*$/gm, '')
    return s
  },
  // Remove stray standalone backslash lines (Mistral sometimes emits a lone '\') and trailing solitary backslashes
  cleanupMistralBackslashes: (s: string) => {
    return s
      // Remove lines that are just a single backslash (optionally surrounded by spaces)
      .replace(/^[ \t]*\\[ \t]*$/gm, '')
      // Remove trailing solitary backslashes at end of lines (not escaped \\)
      .replace(/([^\\])\\[ \t]*$/gm, '$1')
  },
  // Remove trivial artifact lines (isolated periods, duplicate empty math blocks) and collapse consecutive duplicate lines
  cleanupArtifacts: (s: string) => {
    const lines = s.split(/\n/)
    const out: string[] = []
    let prev = ''
    for (let line of lines) {
      const trimmed = line.trim()
      if (trimmed === '.' || trimmed === '...' ) continue
      if (trimmed === prev) continue
      // Remove empty $$ $$ artifacts
      if (/^\$\$\s*\$\$\s*$/.test(trimmed)) continue
  // Remove orphan numeric+$ artifacts (e.g. '1$' lines) produced by partial math delimiter emissions
  if (/^\d+\$$/.test(trimmed)) continue
      out.push(line)
      prev = trimmed
    }
    return out.join('\n')
  }
  , cleanModelText: (s: string) => {
    s = s.replace(/\r\n/g, '\n').replace(/\t/g, ' ')
    s = s.replace(/[ \u00A0]+/g, ' ')
  // Avoid blindly merging any digits separated by space (was causing '25 100' -> '25100').
  // Only merge if it looks like a thousand grouping (e.g., '1 000' or '12 500').
  s = s.replace(/\b(\d{1,3})\s(\d{3})(?!\d)/g, '$1$2')
    s = s.replace(/(\d)\s+%/g, '$1%')
    s = s.replace(/(\d)\s+([×x*\/+\-=])/g, '$1$2')
    s = s.replace(/([×x*\/+\-=])\s+(\d)/g, '$1$2')
    s = s.replace(/\n{3,}/g, '\n\n')
    s = s.replace(/^- +/gm, '- ')
    return s.trim()
  },
  // Restructure "Step X:" sequences into a proper ordered Markdown list and add preamble if missing
  structureSteps: (s: string) => {
    if (!/Step\s+1:/i.test(s)) return s
    const lines = s.split(/\n/)
    const out: string[] = []
    let i = 0
    let sawIntro = false
    while (i < lines.length) {
      const line = lines[i]
      const stepMatch = /^\s*Step\s+(\d+)\s*:\s*(.*)$/i.exec(line)
      if (stepMatch) {
        const num = stepMatch[1]
        let text = stepMatch[2].trim()
        const collected: string[] = []
        if (text) collected.push(text)
        let j = i + 1
        while (j < lines.length) {
          const peek = lines[j]
          if (!peek.trim()) { j++; continue }
            if (/^\s*Step\s+\d+\s*:/i.test(peek) || /^\s*(Final Answer:|Answer:|✅ Final Answer:)/i.test(peek)) break
          // Avoid single '.' artifact lines
          if (peek.trim() !== '.') collected.push(peek.trim())
          j++
        }
        const merged = collected.join(' ').replace(/\s{2,}/g,' ').trim()
        out.push(`${num}. ${merged}`)
        i = j
        continue
      }
      // Preserve non-step lines except stray dots
      if (line.trim() && line.trim() !== '.') out.push(line)
      i++
    }
    let body = out.join('\n')
    if (!/^Let'?s /i.test(body) && !/calculate/i.test(body.slice(0,120))) {
      body = `Let's calculate it step by step:\n\n` + body
    }
    // Ensure Final Answer line stays last and not treated as list item
    body = body.replace(/^(Final Answer:.*)$/gim, '✅ $1')
      .replace(/✅ ✅/g,'✅')
    return body
  }
  , removeOrphanNumericDollar: (s: string) => {
  // Remove standalone lines like '1$' or '2$' and fix patterns like '1$ 2.' by dropping the orphan
  s = s.replace(/^\s*\d+\$\s*$/gm, '')
  // Remove leading numeric+$ tokens before a heading or step line
  s = s.replace(/^(\d+\$\s+)(#+\s+Step\s+\d+[:])/gim, '$2')
  // Remove inline isolated numeric+$ tokens
  s = s.replace(/(^|\s)\d+\$(?=\s|$)/g, '$1')
  // Collapse cases like '1$ 2.' to '2.'
  s = s.replace(/(\n|^)\s*(\d+)\$\s+(\d+\.)/g, '$1$3')
  // Remove leftover double spaces
  s = s.replace(/ {2,}/g, ' ')
  return s
  }
  , fixPercentDuplication: (s: string) => {
    // Collapse sequences like 25%25% -> 25%
    let prev: string
    do { prev = s; s = s.replace(/(\b\d{1,3})%(?:\1%)+/g, '$1%') } while (s !== prev)
    // Also collapse stray '% =' duplicates: '25%=25' -> '25% = 25'
    s = s.replace(/(\d+)%=\s*(\d)/g, '$1% = $2')
    return s
  }
  , ensureHeadingNewlines: (s: string) => {
    // Insert newline before ### if preceded by non-newline char
    s = s.replace(/([^\n])###\s+/g, '$1\n### ')
    // After 'steps:' or 'steps:' like phrases ensure newline before heading
    s = s.replace(/(steps?:)\s*(###\s+Step)/gi, '$1\n$2')
    return s
  }
  , fixLatexNumberSpacing: (s: string) => {
    // Insert a space before LaTeX command if glued to a number (25100\frac -> 25100 \frac)
    s = s.replace(/(\d)(\\(frac|sqrt|times|cdot|pi|left|right))/g, '$1 $2')
    return s
  }
  , balanceBold: (s: string) => {
    // Remove trailing unmatched bold markers
    s = s.replace(/\*\*+$/,'')
    // Fix Final Answer line trailing **
    s = s.replace(/(Final Answer:\s*[^*\n]+)\*\*/gi, '$1')
    // Collapse multi bold marker clutter '** **Word**' -> '**Word**'
    s = s.replace(/\*\*\s+\*\*/g, '**')
    return s
  }
  , dedupeCheckmarks: (s: string) => s.replace(/✅\s*✅+/g, '✅ ')
}
