"use client";

import React, { useMemo, useEffect, useRef } from 'react';
import katex from 'katex';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import SearchStatus from '@/components/ui/SearchStatus';
import Citation from '@/components/ui/Citation';
import 'katex/dist/katex.min.css';

export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

export interface CitationData {
  url: string;
  text: string;
  id: string;
}

export interface TextRenderProps { 
  content: string; 
  className?: string;
  isStreaming?: boolean;
  useTypewriter?: boolean;
  isSearching?: boolean; // Add this to hide dot during search
  sources?: Source[]; // Kept for backward compatibility but not used
  onSourceClick?: (sourceId: string) => void; // Kept for backward compatibility but not used
}

// Auto-detect math patterns in AI responses
const MATH_PATTERNS = [
  // Common math expressions
  /\b\d+\s*[\+\-\*\/\=]\s*\d+/g,
  // Fractions
  /\b\d+\/\d+/g,
  // Percentages with calculations
  /\d+%\s*(?:of|×|x|\*)\s*\d+/gi,
  // Equations with variables
  /[a-z]\s*=\s*\d+/gi,
  // Mathematical functions
  /\b(?:sqrt|sin|cos|tan|log|ln)\s*\(/gi,
  // Powers and exponents
  /\d+\^[\d\-\+]+/g,
  // Scientific notation
  /\d+\.?\d*\s*[×x]\s*10\^[\d\-\+]+/gi,
  // Square roots
  /√\d+/g,
  // Mathematical symbols
  /[∑∏∫∆∞≤≥≠±]/g,
];

// Convert text with auto-detected math to markdown format (not HTML)
function processTextWithMath(text: string): string {
  try {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    let processed = text;
    
    // Enhanced Mistral LaTeX conversion
    
    // Step 1: Convert Mistral's block math \[ \] to standard $$ format
    processed = processed.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, content) => {
      try {
        // Clean up any potential special characters or formatting issues
        const cleanContent = content.trim()
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/\\\\/g, '\\'); // Fix double backslashes
        return `$$${cleanContent}$$`;
      } catch (err) {
        console.warn('Error processing block math:', err);
        return match; // Return original if processing fails
      }
    });
    
    // Step 2: Convert Mistral's inline math \( \) to standard $ format
    processed = processed.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (match, content) => {
      try {
        // Clean up any potential special characters or formatting issues
        const cleanContent = content.trim()
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/\\\\/g, '\\'); // Fix double backslashes
        return `$${cleanContent}$`;
      } catch (err) {
        console.warn('Error processing inline math:', err);
        return match; // Return original if processing fails
      }
    });
    
    // Step 3: Handle orphaned escaped brackets (not part of math expressions)
    // This is a more conservative approach to clean up remaining issues
    processed = processed.replace(/\\\[(?![^$]*\$\$)/g, '['); // \[ not followed by $$ 
    processed = processed.replace(/\\\](?![^$]*\$\$)/g, ']'); // \] not followed by $$
    processed = processed.replace(/\\\((?![^$]*\$)/g, '(');   // \( not followed by $
    processed = processed.replace(/\\\)(?![^$]*\$)/g, ')');   // \) not followed by $
    
    // Step 4: Only auto-detect math if no existing math delimiters are present
    if (!processed.includes('$$') && !processed.includes('$')) {
      processed = autoDetectMathToMarkdown(processed);
    }
    
    return processed;
  } catch (error) {
    console.error('Error in processTextWithMath:', error);
    return text; // Return original text if processing fails
  }
}

// Extract citations from HTML and prepare for React rendering
function extractCitations(html: string): { html: string; citations: CitationData[] } {
  const citations: CitationData[] = [];
  let citationCounter = 0;
  
  // Replace <a> tags with placeholder and collect citation data
  const processedHtml = html.replace(/<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi, (match, url, text) => {
    // Clean up URL and text
    url = url.trim();
    text = text.trim();
    
    // Skip if empty or too long (avoid processing navigation links)
    if (!url || !text || text.length > 100) {
      return match;
    }
    
    // Skip obvious non-citation links
    if (text.toLowerCase().includes('click here') || 
        text.toLowerCase().includes('read more') || 
        text.toLowerCase().includes('learn more')) {
      return match;
    }
    
    // Create unique ID for this citation
    const citationId = `citation-${citationCounter++}`;
    
    // Store citation data
    citations.push({
      url,
      text,
      id: citationId
    });
    
    // Return simple text placeholder that won't interfere with HTML structure
    return `__CITATION_PLACEHOLDER_${citationId}__`;
  });
  
  return { html: processedHtml, citations };
}

// Function to render content with React Citation components
function renderWithCitations(html: string, citations: CitationData[]): React.ReactNode {
  if (citations.length === 0) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }
  
  // Simple approach: use string replacement to inject citation HTML directly
  let processedHtml = html;
  
  citations.forEach((citation) => {
    const placeholder = `__CITATION_PLACEHOLDER_${citation.id}__`;
    // Create inline citation HTML that matches the Citation component styling
    const citationHtml = `<a href="${citation.url}" target="_blank" rel="noopener noreferrer" class="inline-block bg-neutral-700 text-neutral-400 border rounded-full px-1.5 py-0.5 text-xs font-medium no-underline mx-0.5 leading-tight hover:bg-gray-600 hover:text-gray-300 hover:border-gray-500 transition-all duration-150 cursor-pointer" title="Click to visit ${citation.text}">${citation.text}</a>`;
    processedHtml = processedHtml.replace(placeholder, citationHtml);
  });
  
  return <div dangerouslySetInnerHTML={{ __html: processedHtml }} />;
}

// Auto-detect mathematical expressions and convert to markdown math notation
function autoDetectMathToMarkdown(text: string): string {
  let result = text;
  
  // Only detect very obvious mathematical patterns to avoid false positives
  
  // 1. Handle fractions (including larger numbers like 25/100) - use block math for fractions
  result = result.replace(/\b(\d+)\/(\d+)\b/g, (match, num, den) => {
    return `$$\\frac{${num}}{${den}}$$`;
  });
  
  // 2. Handle percentage × number calculations - use block math for calculations
  result = result.replace(/\b(\d+)%\s*(?:×|x|\*)\s*(\d+)\s*=\s*(\d+)/gi, (match, percent, num, resultNum) => {
    const expression = `${percent}\\% \\times ${num} = ${resultNum}`;
    return `$$${expression}$$`;
  });
  
  // 3. Handle decimal × number calculations - use block math 
  result = result.replace(/\b(0\.\d+)\s*(?:×|x|\*)\s*(\d+)\s*=\s*(\d+)/gi, (match, decimal, num, resultNum) => {
    const expression = `${decimal} \\times ${num} = ${resultNum}`;
    return `$$${expression}$$`;
  });
  
  // 4. Handle basic arithmetic with equals (a op b = c) - use block math for equations
  result = result.replace(/\b(\d{1,3})\s*([+\-×÷*\/])\s*(\d{1,3})\s*=\s*(\d{1,3})\b/g, 
    (match, num1, op, num2, resultNum) => {
      const operators = { '+': '+', '-': '-', '×': '\\times', '÷': '\\div', '*': '\\times', '/': '\\div' };
      const expression = `${num1} ${operators[op as keyof typeof operators] || op} ${num2} = ${resultNum}`;
      return `$$${expression}$$`;
    }
  );
  
  // 5. Handle percentage conversions (25% = 25/100) - use block math 
  result = result.replace(/(\d{1,3})%\s*=\s*(\d{1,3})\/(\d{1,3})/g, (match, percent, num, den) => {
    const expression = `${percent}\\% = \\frac{${num}}{${den}}`;
    return `$$${expression}$$`;
  });
  
  // 6. Handle simple powers (single digit bases and exponents) - use inline for simple powers
  result = result.replace(/(\d)\^([1-9])/g, (match, base, exp) => {
    return `$${base}^{${exp}}$`;
  });
  
  return result;
}

// Render math expression with KaTeX
function renderMath(expression: string, isBlock: boolean = false): string {
  try {
    return katex.renderToString(expression, {
      displayMode: isBlock,
      throwOnError: false,
      strict: false,
    });
  } catch (error) {
    // If KaTeX fails, return the original expression in a code span
    return `<code class="math-error">${expression}</code>`;
  }
}

// Enhanced markdown formatting using remark.js with better error handling and timeout
function formatMarkdown(text: string): string {
  try {
    // Validate input
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Timeout mechanism to prevent hanging
    const timeoutMs = 2000; // 2 seconds timeout
    let isTimedOut = false;
    
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      console.warn('Markdown processing timed out, falling back');
    }, timeoutMs);
    
    try {
      // Create unified processor for markdown parsing
      const processor = unified()
        .use(remarkParse)
        .use(remarkGfm) // GitHub Flavored Markdown (tables, strikethrough, etc.)
        .use(remarkMath) // Math support ($$ and $ syntax)
        .use(remarkRehype, { 
          allowDangerousHtml: true // Allow HTML in markdown
        })
        .use(rehypeKatex, {
          throwOnError: false,
          strict: false,
          displayMode: false, // Let remark-math handle display mode detection
          trust: true,
          errorColor: '#ff0000'
        }) // Render math with KaTeX
        .use(rehypeStringify);

      // Check timeout before processing
      if (isTimedOut) {
        return fallbackFormatting(text);
      }

      // Process the markdown and return HTML
      const result = processor.processSync(text);
      clearTimeout(timeoutId);
      
      // Check timeout after processing
      if (isTimedOut) {
        return fallbackFormatting(text);
      }
      
      let html = String(result);
      
      // Validate result
      if (!html || html.trim() === '') {
        console.warn('Remark.js produced empty result, falling back');
        return fallbackFormatting(text);
      }
      
      // More robust post-processing for block math
      // Look for KaTeX display elements and ensure they're properly wrapped
      html = html.replace(
        /<span class="katex-display">([\s\S]*?)<\/span>/g,
        '<div class="katex-display-wrapper"><span class="katex-display">$1</span></div>'
      );
      
      // Also handle cases where KaTeX generates different markup
      html = html.replace(
        /<span class="katex"><span class="katex-mathml">[\s\S]*?<\/span><span class="katex-html"[^>]*?data-display="true"[^>]*?>([\s\S]*?)<\/span><\/span>/g,
        '<div class="katex-display-wrapper"><span class="katex katex-display"><span class="katex-html" data-display="true">$1</span></span></div>'
      );
      
      return html;
    } catch (processingError) {
      clearTimeout(timeoutId);
      console.error('Remark.js processing error:', processingError);
      return fallbackFormatting(text);
    }
  } catch (error) {
    console.error('Remark.js wrapper error:', error);
    // Fallback: use custom KaTeX rendering if remark fails
    return fallbackFormatting(text);
  }
}

// Fallback formatting function
function fallbackFormatting(text: string): string {
  let processed = text;
  
  // Handle existing math expressions
  const existingMath: { placeholder: string; content: string; isBlock: boolean }[] = [];
  let counter = 0;
  
  // Extract $$...$$ (block math)
  processed = processed.replace(/\$\$([^$]+?)\$\$/g, (match, content) => {
    const placeholder = `__BLOCK_${counter++}__`;
    existingMath.push({ placeholder, content: content.trim(), isBlock: true });
    return placeholder;
  });
  
  // Extract $...$ (inline math)
  processed = processed.replace(/\$([^$\n]+?)\$/g, (match, content) => {
    const placeholder = `__INLINE_${counter++}__`;
    existingMath.push({ placeholder, content: content.trim(), isBlock: false });
    return placeholder;
  });
  
  // Apply simple markdown formatting
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^[-•]\s+(.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  
  // Restore math expressions with KaTeX
  existingMath.forEach(({ placeholder, content, isBlock }) => {
    const rendered = renderMath(content, isBlock);
    processed = processed.replace(placeholder, rendered);
  });
  
  return processed;
}

// Wrap consecutive list items in proper list tags
function wrapLists(html: string): string {
  return html
    .replace(/(<li>.*?<\/li>)(\s*<br\/>)*(\s*<li>.*?<\/li>)*/gs, (match) => {
      const items = match.match(/<li>.*?<\/li>/g) || [];
      if (items.length > 1) {
        const isNumbered = html.includes('<li>') && 
          html.substring(html.indexOf('<li>') - 50, html.indexOf('<li>')).includes('1.');
        const tag = isNumbered ? 'ol' : 'ul';
        return `<${tag}>${items.join('')}</${tag}>`;
      }
      return match;
    });
}

export default function TextRender({ 
  content, 
  className = "", 
  isStreaming = false, 
  useTypewriter = false, 
  isSearching = false,
  sources,
  onSourceClick 
}: TextRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastProcessedContentRef = useRef<string>('');
  const lastProcessedResultRef = useRef<{ html: string; citations: CitationData[] } | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const processedContent = useMemo(() => {
    if (!content) return { html: '', citations: [] };
    
    // Skip reprocessing if content hasn't actually changed (optimization for streaming)
    if (content === lastProcessedContentRef.current && lastProcessedResultRef.current) {
      return lastProcessedResultRef.current;
    }
    
    // During streaming, debounce processing for performance
    if (isStreaming && content.length > 100) {
      const contentLength = content.length;
      const lastLength = lastProcessedContentRef.current.length;
      
      // Only reprocess if significant content has been added or streaming stopped
      if (contentLength - lastLength < 50 && isStreaming) {
        return lastProcessedResultRef.current || { html: content.replace(/\n/g, '<br/>'), citations: [] };
      }
    }
    
    try {
      // Step 1: Convert AI output to markdown format (with math detection and Mistral LaTeX conversion)
      let processed = processTextWithMath(content);
      console.log('📝 Step 1 - processTextWithMath result length:', processed.length);
      
      // Step 2: Use remark.js to convert markdown to HTML (this will convert [Text](URL) to <a> tags)
      processed = formatMarkdown(processed);
      console.log('📝 Step 2 - formatMarkdown result length:', processed.length);
      console.log('📝 Step 2 - formatMarkdown sample:', processed.substring(0, 300));
      
      // Step 3: Extract citations from HTML
      const result = extractCitations(processed);
      console.log('📝 Step 3 - extractCitations found:', result.citations.length, 'citations');
      
      // Cache the result
      lastProcessedContentRef.current = content;
      lastProcessedResultRef.current = result;
      
      return result;
    } catch (error) {
      console.error('TextRender processing error:', error);
      // Ultimate fallback
      const fallback = { html: content.replace(/\n/g, '<br/>'), citations: [] };
      lastProcessedContentRef.current = content;
      lastProcessedResultRef.current = fallback;
      return fallback;
    }
  }, [content, isStreaming]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // KaTeX processing effect
  useEffect(() => {
    if (!containerRef.current) return;
    
    const katexElements = containerRef.current.querySelectorAll('.katex');
    
    katexElements.forEach((element) => {
      const katexHtml = element.querySelector('.katex-html');
      
      // More robust block math detection
      const hasBlockMathClass = element.classList.contains('katex-display');
      const hasDisplayAttribute = katexHtml?.hasAttribute('data-display');
      const isInDisplayWrapper = element.closest('.katex-display-wrapper') !== null;
      
      // Check if this contains complex math that should be displayed as block
      const mathContent = element.textContent || '';
      const hasComplexMath = mathContent.includes('\\frac') || 
                           mathContent.includes('\\times') || 
                           mathContent.includes('\\div') ||
                           mathContent.includes('=') ||
                           /\d+\s*\\%/.test(mathContent); // percentage formulas
      
      // Check if the original content had $$ delimiters (block math)
      const isBlockMath = hasBlockMathClass || hasDisplayAttribute || isInDisplayWrapper;
      
      if (isBlockMath || hasComplexMath) {
        // Force block display for complex math or originally block math
        element.classList.add('katex-display');
        (element as HTMLElement).style.display = 'block';
        (element as HTMLElement).style.textAlign = 'left';
        (element as HTMLElement).style.margin = '1rem 0';
        (element as HTMLElement).style.padding = '0.5rem 0';
        (element as HTMLElement).style.background = 'transparent';
        (element as HTMLElement).style.borderRadius = '0';
        (element as HTMLElement).style.border = 'none';
        (element as HTMLElement).style.boxShadow = 'none';
        (element as HTMLElement).style.width = 'auto';
        (element as HTMLElement).style.maxWidth = '100%';
        (element as HTMLElement).style.fontSize = '1.1em';
        
        // Ensure parent paragraph uses normal text alignment
        const parent = element.parentElement;
        if (parent?.tagName === 'P') {
          (parent as HTMLElement).style.textAlign = 'left';
        }
      } else {
        // Clean inline display for simple math
        element.classList.remove('katex-display');
        (element as HTMLElement).style.display = 'inline';
        (element as HTMLElement).style.margin = '0 0.1em';
        (element as HTMLElement).style.padding = '0';
        (element as HTMLElement).style.background = 'transparent';
        (element as HTMLElement).style.border = 'none';
        (element as HTMLElement).style.boxShadow = 'none';
        (element as HTMLElement).style.fontSize = '1em';
        (element as HTMLElement).style.verticalAlign = 'baseline';
      }
    });
  }, [processedContent]);
  
  // During streaming, show raw content immediately with unified dot cursor (hide dot during search)
  if (isStreaming && useTypewriter) {
    return (
      <div 
        ref={containerRef}
        className={`prose prose-invert max-w-none text-render-custom ${className}`}
      >
        <div className="inline-block">
          <span className="whitespace-pre-wrap">{content}</span>
          {/* Show search indicator when searching, otherwise show streaming dot */}
          {isSearching ? (
            <SearchStatus phase="searching" />
          ) : (
            <span
              className="unified-dot streaming"
              style={{
                verticalAlign: "middle",
                marginLeft: "2px",
                marginBottom: "2px"
              }}
            />
          )}
        </div>
      </div>
    );
  }
  
  // When not streaming, show fully formatted content with React Citation components
  return (
    <div 
      ref={containerRef}
      className={`prose prose-invert max-w-none text-render-custom ${className}`}
    >
      {renderWithCitations(processedContent.html, processedContent.citations)}
    </div>
  );
}