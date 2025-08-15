"use client";

import React, { useState } from 'react';

export interface CitationProps {
  url: string;
  text: string;
  className?: string;
}

export default function Citation({ url, text, className = "" }: CitationProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Extract domain for display
  let domain = '';
  let faviconUrl = '';
  
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname.replace('www.', '');
    faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  } catch (error) {
    console.warn('Failed to parse URL:', url, error);
    domain = url;
    faviconUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  }

  const description = 'Click to visit source and read the full article';

  return (
    <span 
      className={`relative inline ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-neutral-700 text-neutral-400 border rounded-full px-1.5 py-0.5 text-xs font-medium no-underline mx-0.5 leading-tight hover:bg-gray-600 hover:text-gray-300 hover:border-gray-500 transition-all duration-150 cursor-pointer"
      >
        {text}
      </a>
      
      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 opacity-100 pointer-events-auto">
          <div className="bg-neutral-800 border rounded-lg p-3 min-w-[280px] max-w-[320px] shadow-xl">
            {/* Header with favicon and domain */}
            <div className="flex items-center gap-2 mb-2">
              <img 
                src={faviconUrl} 
                alt={domain} 
                className="w-4 h-4 flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="font-semibold text-neutral-100 text-xs leading-tight">
                {domain}
              </div>
            </div>
            
            {/* Title */}
            <div className="font-semibold text-neutral-300 text-xs leading-tight mb-1">
              {text}
            </div>
            
            {/* Description */}
            <div className="border-t border-neutral-700 pt-2">
              <div className="text-neutral-400 text-xs leading-relaxed">
                {description}
              </div>
            </div>
            
            {/* Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-neutral-800"></div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
