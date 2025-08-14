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
import 'katex/dist/katex.min.css';

export interface TextRenderProps { 
  content: string; 
  className?: string;
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
  let processed = text;
  
  // Enhanced Mistral LaTeX conversion
  
  // Step 1: Convert Mistral's block math \[ \] to standard $$ format
  processed = processed.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, content) => {
    // Clean up any potential special characters or formatting issues
    const cleanContent = content.trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\\\\/g, '\\'); // Fix double backslashes
    return `$$${cleanContent}$$`;
  });
  
  // Step 2: Convert Mistral's inline math \( \) to standard $ format
  processed = processed.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (match, content) => {
    // Clean up any potential special characters or formatting issues
    const cleanContent = content.trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\\\\/g, '\\'); // Fix double backslashes
    return `$${cleanContent}$`;
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
}

// Auto-detect mathematical expressions and convert to markdown math notation
function autoDetectMathToMarkdown(text: string): string {
  let result = text;
  
  // Only detect very obvious mathematical patterns to avoid false positives
  
  // 1. Handle simple fractions (only small numbers to be conservative)
  result = result.replace(/\b([1-9])\/([1-9])\b/g, (match, num, den) => {
    return `$\\frac{${num}}{${den}}$`;
  });
  
  // 2. Handle basic arithmetic with equals (a op b = c)
  result = result.replace(/\b(\d{1,3})\s*([+\-×÷])\s*(\d{1,3})\s*=\s*(\d{1,3})\b/g, 
    (match, num1, op, num2, resultNum) => {
      const operators = { '+': '+', '-': '-', '×': '\\times', '÷': '\\div' };
      const expression = `${num1} ${operators[op as keyof typeof operators] || op} ${num2} = ${resultNum}`;
      return `$${expression}$`;
    }
  );
  
  // 3. Handle percentage conversions (conservative pattern)
  result = result.replace(/(\d{1,2})%\s*=\s*(\d{1,2})\/(\d{1,3})/g, (match, percent, num, den) => {
    const expression = `${percent}\\% = \\frac{${num}}{${den}}`;
    return `$${expression}$`;
  });
  
  // 4. Handle simple powers (single digit bases and exponents)
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

// Enhanced markdown formatting using remark.js
function formatMarkdown(text: string): string {
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
        trust: true
      }) // Render math with KaTeX
      .use(rehypeStringify);

    // Process the markdown and return HTML
    const result = processor.processSync(text);
    let html = String(result);
    
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
  } catch (error) {
    console.error('Remark.js processing error:', error);
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

export default function TextRender({ content, className = "" }: TextRenderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    try {
      // Step 1: Convert AI output to markdown format (with math detection and Mistral LaTeX conversion)
      let processed = processTextWithMath(content);
      
      // Step 2: Use remark.js to convert markdown to HTML
      processed = formatMarkdown(processed);
      
      return processed;
    } catch (error) {
      console.error('TextRender processing error:', error);
      // Ultimate fallback
      return content.replace(/\n/g, '<br/>');
    }
  }, [content]);

  // Post-render effect to ensure block math display
  useEffect(() => {
    if (!containerRef.current) return;

    // Find all KaTeX elements and ensure proper display mode
    const katexElements = containerRef.current.querySelectorAll('.katex');
    
    katexElements.forEach((element) => {
      const katexHtml = element.querySelector('.katex-html');
      const isDisplayMode = katexHtml?.getAttribute('aria-hidden') === 'true' && 
                           element.classList.contains('katex-display') ||
                           katexHtml?.hasAttribute('data-display') ||
                           element.textContent?.includes('\\frac') ||
                           element.textContent?.includes('\\times');
      
      if (isDisplayMode) {
        // Clean GitHub-style block display
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
        // Clean inline display
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
  
  return (
    <div 
      ref={containerRef}
      className={`prose prose-invert max-w-none text-render-custom ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}