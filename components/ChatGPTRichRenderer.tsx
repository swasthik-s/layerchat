"use client";

// Unified Markdown renderer (markdown-it + custom KaTeX + highlight.js)
import React, { useMemo, useEffect } from 'react';
import markdownit from 'markdown-it';
import katex from 'katex';
import hljs from 'highlight.js';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

export interface ChatGPTRichRendererProps { content: string; className?: string }

function preprocess(raw: string) {
  let txt = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<div[^>]*class=["']math-step["'][^>]*>/gi, '')
    .replace(/<div[^>]*class=["']final-answer["'][^>]*>/gi, '\nFinal Answer: ')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\\\(/g, '$').replace(/\\\)/g, '$')
    .replace(/\\\[/g, '$$').replace(/\\\]/g, '$$')
    .replace(/(^|[^$])(\d)\$(?=[^$]+?\$)/g, '$1$2 $') // space before inline math
    .replace(/^(\s*)(\d+)\)\s+/gm, '$1$2. ') // list marker normalization
    .replace(/^(\s*)([•·])\s+/gm, '$1- ')
    .replace(/([^\n])\n(\d+\.\s)/g, '$1\n\n$2')
    .replace(/([^\n])\n(-\s)/g, '$1\n\n$2');

  txt = txt.replace(/\n{3,}/g, '\n\n');
  txt = txt.replace(/\n?(Final Answer:\s*)/i, '\n\n$1');
  txt = txt.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');

  // Steps -> ordered list
  const stepLines = txt.split('\n');
  let s = 0; let mutated = false;
  while (s < stepLines.length) {
    if (/^Step\s*\d+:/.test(stepLines[s])) {
      let e = s; while (e < stepLines.length && /^Step\s*\d+:/.test(stepLines[e])) e++;
      if (e - s >= 1) {
        let counter = 1;
        for (let k = s; k < e; k++) {
          const m = stepLines[k].match(/^Step\s*\d+:\s*(.*)/i);
          stepLines[k] = `${counter}. ${m ? m[1].trim() : ''}`; counter++;
        }
        if (s > 0 && stepLines[s - 1].trim() !== '') stepLines.splice(s, 0, ''); e++;
        if (e < stepLines.length && stepLines[e].trim() !== '') { stepLines.splice(e, 0, ''); }
        mutated = true; s = e; continue;
      }
    }
    s++;
  }
  if (mutated) txt = stepLines.join('\n');

  // Bold-leading line runs -> list
  const lines = txt.split('\n');
  let i = 0; let changed = false;
  while (i < lines.length) {
    if (/^\*\*[^*]+\*\*/.test(lines[i]) && !/^[-*]\s/.test(lines[i])) {
      let j = i; while (j < lines.length && /^\*\*[^*]+\*\*/.test(lines[j]) && !/^[-*]\s/.test(lines[j])) j++;
      if (j - i >= 2) {
        for (let k = i; k < j; k++) lines[k] = '- ' + lines[k];
        if (i > 0 && lines[i - 1].trim() !== '') lines.splice(i, 0, ''); j++;
        if (j < lines.length && lines[j].trim() !== '') lines.splice(j, 0, '');
        changed = true; i = j; continue;
      }
    }
    i++;
  }
  if (changed) txt = lines.join('\n');
  txt = txt.replace(/\n?Step[- ]by[- ]Step:?/i, '\n\n### Steps');
  return txt.trim();
}

// Math extraction to avoid plugin issues (isSpace error) and keep control
interface MathMap { token: string; html: string }
function extractMath(raw: string): { text: string; maps: MathMap[] } {
  const maps: MathMap[] = []
  let out = ''
  let i = 0; let counter = 0
  while (i < raw.length) {
    if (raw[i] === '\\' && raw[i + 1] === '$') { out += '$'; i += 2; continue }
    if (raw[i] === '$') {
      const block = raw[i + 1] === '$'
      const start = i + (block ? 2 : 1)
      let j = start
      while (j < raw.length) {
        if (!block && raw[j] === '$') break
        if (block && raw[j] === '$' && raw[j + 1] === '$') break
        if (raw[j] === '\\' && raw[j + 1] === '$') { j += 2; continue }
        j++
      }
      if (j >= raw.length || raw[j] !== '$') { out += raw[i]; i++; continue }
      const inner = raw.slice(start, j).trim()
      i = j + (block ? 2 : 1)
      const token = `__MATH_${counter++}__`
      let html: string
      try { html = katex.renderToString(inner, { displayMode: block, throwOnError: false }) }
      catch { html = `<code class="katex-error">${inner.replace(/</g, '&lt;')}</code>` }
      maps.push({ token, html }); out += token; continue
    }
    out += raw[i]; i++
  }
  return { text: out, maps }
}

// Markdown-it instance with syntax highlighting
const md = markdownit({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code: string, lang: string) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang }).value}</code></pre>`
      }
      return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`
    } catch {
      return `<pre class="hljs"><code>${code.replace(/</g,'&lt;')}</code></pre>`
    }
  }
}).enable(['table'])

// External link security
const defaultLink = md.renderer.rules.link_open || function(tokens: any, idx: any, options: any, env: any, self: any){ return self.renderToken(tokens, idx, options) }
md.renderer.rules.link_open = (tokens: any, idx: any, options: any, env: any, self: any) => {
  if (tokens[idx].attrIndex('target') < 0) tokens[idx].attrPush(['target','_blank'])
  if (tokens[idx].attrIndex('rel') < 0) tokens[idx].attrPush(['rel','noopener noreferrer'])
  return defaultLink(tokens, idx, options, env, self)
}

export function ChatGPTRichRenderer({ content, className='' }: ChatGPTRichRendererProps) {
  const cleaned = useMemo(()=> preprocess(content), [content])
  const { text: mathProtected, maps } = useMemo(()=> extractMath(cleaned), [cleaned])
  const html = useMemo(()=> {
    let rendered = ''
    try { rendered = md.render(mathProtected) } catch (e) { console.error('markdown-it render error', e); return `<pre class="render-error">${cleaned.replace(/</g,'&lt;')}</pre>` }
    for (const m of maps) rendered = rendered.split(m.token).join(m.html)

    // Transform Final Answer paragraphs & callouts
    rendered = rendered.replace(/<p>\s*Final Answer:(.*?)<\/p>/i, (_m, rest) => `<div class="final-answer"><strong>Final Answer:</strong>${rest}</div>`)
    rendered = rendered.replace(/<p>(👉|✅|💡|⚠️|📌|ℹ️|🔍|📝|🚀)\s+([^<]+)<\/p>/g, '<div class="callout" data-emoji="$1">$2</div>')
    return rendered
  }, [mathProtected, maps, cleaned])

  // Enhance code blocks with copy buttons after mount
  useEffect(()=>{
    const blocks = document.querySelectorAll('.markdown-body pre.hljs')
    blocks.forEach(pre => {
      const wrapper = pre.parentElement
      if (wrapper && wrapper.classList.contains('code-block-wrapper')) return
      const lang = pre.querySelector('code')?.className.replace(/.*language-/, '') || 'text'
      const div = document.createElement('div')
      div.className = 'code-block-wrapper'
      const toolbar = document.createElement('div')
      toolbar.className = 'code-block-toolbar'
      const span = document.createElement('span')
      span.className = 'lang'; span.textContent = lang
      const btn = document.createElement('button')
      btn.className = 'copy-btn'; btn.textContent = 'Copy'
      btn.onclick = () => { navigator.clipboard.writeText(pre.textContent || ''); btn.textContent = 'Copied'; setTimeout(()=> btn.textContent = 'Copy', 1400) }
      toolbar.appendChild(span); toolbar.appendChild(btn)
      pre.replaceWith(pre.cloneNode(true)) // detach listeners
      div.appendChild(toolbar); div.appendChild(pre)
      // insert wrapper
      ;(pre.parentElement || wrapper)?.appendChild(div)
    })
  }, [html])

  return (
    <>
      <div className={`markdown-body md-it ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
      <style jsx>{`
        .markdown-body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif !important;line-height:1.6;color:#e5e7eb;max-width:760px;font-size:15px;}
        .markdown-body *{font-family:inherit !important;}
        .markdown-body h1{font-size:2.05rem;font-weight:600;margin:1.6em 0 .7em;letter-spacing:-.5px;color:#f8fafc;}
        .markdown-body h2{font-size:1.55rem;font-weight:600;margin:1.35em 0 .65em;letter-spacing:-.3px;color:#f1f5f9;}
        .markdown-body h3{font-size:1.25rem;font-weight:600;margin:1.1em 0 .55em;color:#e2e8f0;}
        .markdown-body h4{font-size:1.05rem;font-weight:600;margin:1em 0 .45em;color:#cbd5e1;}
        .markdown-body p{margin:.85em 0;line-height:1.65;font-family:inherit !important;}
        .markdown-body a{color:#60a5fa;text-decoration:none;border-bottom:1px solid transparent;font-family:inherit !important;}
        .markdown-body a:hover{color:#93c5fd;border-bottom-color:#60a5fa;}
        .markdown-body code{background:rgba(255,255,255,.07);padding:2px 6px;border-radius:4px;font-size:13px;font-family:'SF Mono',Monaco,'Cascadia Code','Roboto Mono',monospace !important;color:#f1f5f9;}
        .markdown-body strong{color:#f8fafc;font-weight:600;font-family:inherit !important;}
        .markdown-body em{color:#d1d5db;font-style:italic;font-family:inherit !important;}
        
        /* Lists - targeting actual markdown-it output */
        .markdown-body ul,.markdown-body ol{margin:1em 0 1.15em 0;padding-left:1.5em;font-family:inherit !important;}
        .markdown-body ul{list-style:none;}
        .markdown-body ul li{position:relative;margin:.5em 0;line-height:1.6;font-family:inherit !important;}
        .markdown-body ul li:before{content:'';position:absolute;left:-1.2em;top:.7em;width:6px;height:6px;border-radius:50%;background:#6366f1;box-shadow:0 0 0 2px rgba(99,102,241,.2);}
        .markdown-body ol{counter-reset:item;list-style:none;}
        .markdown-body ol li{counter-increment:item;position:relative;margin:.5em 0;line-height:1.6;font-family:inherit !important;}
        .markdown-body ol li:before{content:counter(item);position:absolute;left:-1.4em;top:.1em;background:#4f46e5;color:#fff;font-size:11px;font-weight:600;border-radius:50%;width:18px;height:18px;line-height:18px;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.2);}
        .markdown-body li p{margin:.3em 0;font-family:inherit !important;}
        
        /* Code blocks */
        .code-block-wrapper{position:relative;margin:1.3em 0;background:#111827;border:1px solid #1f2937;border-radius:10px;}
        .code-block-toolbar{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid #1f2937;font-size:12px;font-family:'SF Mono',monospace;background:#1a2332;border-top-left-radius:10px;border-top-right-radius:10px;}
        .code-block-wrapper pre{margin:0;padding:14px 16px;font-size:13px;overflow:auto;background:transparent;}
        .markdown-body pre{background:#111827;border:1px solid #1f2937;border-radius:8px;padding:12px 16px;margin:1.2em 0;overflow:auto;font-size:13px;}
        .copy-btn{background:#374151;color:#cbd5e1;font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid #475569;cursor:pointer;}
        .copy-btn:hover{background:#4b5563;color:#fff;}
        .lang{text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;font-weight:600;}
        
        /* Other elements */
        .markdown-body blockquote{margin:1.25em 0;padding:.75em 1em;border-left:4px solid #6366f1;background:rgba(99,102,241,.08);border-radius:4px;color:#d1d5db;}
        .markdown-body table{width:100%;border-collapse:collapse;margin:1.1em 0;font-size:13.5px;}
        .markdown-body th,.markdown-body td{border:1px solid #1f2937;padding:8px 12px;text-align:left;}
        .markdown-body th{background:#1e293b;font-weight:600;color:#f1f5f9;}
        .markdown-body tr:nth-child(even) td{background:#111827;}
        .markdown-body td{color:#e2e8f0;}
        
        /* Custom components */
        .callout{position:relative;display:flex;gap:12px;padding:12px 14px;background:#1e293b;border:1px solid #334155;border-radius:10px;margin:1.1em 0;line-height:1.5;}
        .callout:before{content:attr(data-emoji);font-size:20px;line-height:1;margin-top:2px;}
        .final-answer{background:linear-gradient(135deg,#064e3b,#065f46);border:1px solid #0d9488;padding:15px 18px;border-radius:12px;font-weight:600;letter-spacing:.25px;box-shadow:0 0 0 1px rgba(16,185,129,.2),0 4px 14px -6px rgba(0,0,0,.5);color:#f0fdf4;}
        .katex-display{margin:1.1em 0!important;}
        .markdown-body hr{border:none;height:1px;background:linear-gradient(90deg,transparent,#334155,transparent);margin:2.2em 0;}
      `}</style>
    </>
  );
}
