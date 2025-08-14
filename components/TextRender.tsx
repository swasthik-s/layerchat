"use client";

import React, { useMemo } from 'react';
import katex from 'katex';
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

// Convert text with auto-detected math to KaTeX
function processTextWithMath(text: string): string {
  let processed = text;
  
  // First, preserve existing LaTeX expressions
  const existingMath: { placeholder: string; content: string; isBlock: boolean }[] = [];
  let counter = 0;
  
  // Extract existing $$...$$ (block math)
  processed = processed.replace(/\$\$([^$]+?)\$\$/g, (match, content) => {
    const placeholder = `__EXISTING_BLOCK_${counter++}__`;
    existingMath.push({ placeholder, content: content.trim(), isBlock: true });
    return placeholder;
  });
  
  // Extract existing $...$ (inline math)
  processed = processed.replace(/\$([^$\n]+?)\$/g, (match, content) => {
    const placeholder = `__EXISTING_INLINE_${counter++}__`;
    existingMath.push({ placeholder, content: content.trim(), isBlock: false });
    return placeholder;
  });
  
  // Auto-detect and convert mathematical expressions
  processed = autoDetectMath(processed);
  
  // Restore existing math expressions
  existingMath.forEach(({ placeholder, content, isBlock }) => {
    const rendered = renderMath(content, isBlock);
    processed = processed.replace(placeholder, rendered);
  });
  
  return processed;
}

// Auto-detect mathematical expressions and wrap them in KaTeX
function autoDetectMath(text: string): string {
  let result = text;
  
  // Handle fractions like "25/100 = 1/4"
  result = result.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
    const fraction = `\\frac{${num}}{${den}}`;
    return renderMath(fraction, false);
  });
  
  // Handle percentages with calculations like "25% = 25/100"
  result = result.replace(/(\d+)%\s*=\s*(\d+)\/(\d+)/g, (match, percent, num, den) => {
    const expression = `${percent}\\% = \\frac{${num}}{${den}}`;
    return renderMath(expression, false);
  });
  
  // Handle simple equations like "1/4 × 400 = 100"
  result = result.replace(/(\d+)\/(\d+)\s*[×x*]\s*(\d+)\s*=\s*(\d+)/g, (match, num1, den1, num2, result) => {
    const expression = `\\frac{${num1}}{${den1}} \\times ${num2} = ${result}`;
    return renderMath(expression, false);
  });
  
  // Handle powers like "10^6"
  result = result.replace(/(\d+)\^([\d\-\+]+)/g, (match, base, exp) => {
    const expression = `${base}^{${exp}}`;
    return renderMath(expression, false);
  });
  
  // Handle square roots like "√400"
  result = result.replace(/√(\d+)/g, (match, num) => {
    const expression = `\\sqrt{${num}}`;
    return renderMath(expression, false);
  });
  
  // Handle simple arithmetic expressions that look mathematical
  result = result.replace(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)/g, 
    (match, num1, op, num2, result) => {
      const operators = { '+': '+', '-': '-', '*': '\\times', '/': '\\div' };
      const expression = `${num1} ${operators[op as keyof typeof operators] || op} ${num2} = ${result}`;
      return renderMath(expression, false);
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

// Simple markdown-like formatting
function formatMarkdown(text: string): string {
  return text
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Lists
    .replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/^[-•]\s+(.*$)/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
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
    
    // Process math first
    let processed = processTextWithMath(content);
    
    // Apply markdown formatting
    processed = formatMarkdown(processed);
    
    // Wrap lists properly
    processed = wrapLists(processed);
    
    return processed;
  }, [content]);
  
  return (
    <div 
      className={`prose prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}
