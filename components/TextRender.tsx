"use client";

import React, { useMemo } from 'react';
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
  
  // First, convert Mistral's LaTeX format \[ \] to standard $$ format
  processed = processed.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, content) => {
    return `$$${content.trim()}$$`;
  });
  
  // Auto-detect and convert mathematical expressions to markdown math notation
  processed = autoDetectMathToMarkdown(processed);
  
  return processed;
}

// Auto-detect mathematical expressions and convert to markdown math notation
function autoDetectMathToMarkdown(text: string): string {
  let result = text;
  
  // Handle fractions like "25/100 = 1/4" (convert to markdown math)
  result = result.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
    const fraction = `\\frac{${num}}{${den}}`;
    return `$${fraction}$`;
  });
  
  // Handle percentages with calculations like "25% = 25/100"
  result = result.replace(/(\d+)%\s*=\s*(\d+)\/(\d+)/g, (match, percent, num, den) => {
    const expression = `${percent}\\% = \\frac{${num}}{${den}}`;
    return `$${expression}$`;
  });
  
  // Handle simple equations like "1/4 × 400 = 100"
  result = result.replace(/(\d+)\/(\d+)\s*[×x*]\s*(\d+)\s*=\s*(\d+)/g, (match, num1, den1, num2, resultNum) => {
    const expression = `\\frac{${num1}}{${den1}} \\times ${num2} = ${resultNum}`;
    return `$${expression}$`;
  });
  
  // Handle powers like "10^6"
  result = result.replace(/(\d+)\^([\d\-\+]+)/g, (match, base, exp) => {
    const expression = `${base}^{${exp}}`;
    return `$${expression}$`;
  });
  
  // Handle square roots like "√400"
  result = result.replace(/√(\d+)/g, (match, num) => {
    const expression = `\\sqrt{${num}}`;
    return `$${expression}$`;
  });
  
  // Handle simple arithmetic expressions that look mathematical
  result = result.replace(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)/g, 
    (match, num1, op, num2, resultNum) => {
      const operators = { '+': '+', '-': '-', '*': '\\times', '/': '\\div' };
      const expression = `${num1} ${operators[op as keyof typeof operators] || op} ${num2} = ${resultNum}`;
      return `$${expression}$`;
    }
  );
  
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
        strict: false
      }) // Render math with KaTeX
      .use(rehypeStringify);

    // Process the markdown and return HTML
    const result = processor.processSync(text);
    return String(result);
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
  
  return (
    <div 
      className={`prose prose-invert max-w-none text-render-custom ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}