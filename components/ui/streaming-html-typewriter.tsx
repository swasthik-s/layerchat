"use client";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface StreamingHtmlTypewriterProps {
  htmlContent: string;
  isStreaming: boolean;
  className?: string;
  speed?: number; // Speed of typewriter effect (ms per character)
}

export function StreamingHtmlTypewriter({
  htmlContent,
  isStreaming,
  className = "",
  speed = 15,
}: StreamingHtmlTypewriterProps) {
  const [displayedHtml, setDisplayedHtml] = useState("");
  const [textContent, setTextContent] = useState("");
  const [displayedTextLength, setDisplayedTextLength] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract text content from HTML for character counting
  useEffect(() => {
    if (htmlContent) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      setTextContent(tempDiv.textContent || tempDiv.innerText || '');
    }
  }, [htmlContent]);

  useEffect(() => {
    if (isStreaming && textContent) {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Start typewriter effect
      intervalRef.current = setInterval(() => {
        setDisplayedTextLength(prev => {
          const targetLength = textContent.length;
          
          if (prev >= targetLength) {
            // We've caught up, clear interval
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return targetLength;
          }
          
          // Add one more character
          return prev + 1;
        });
      }, speed);
    } else if (!isStreaming) {
      // Not streaming - show full content immediately
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayedTextLength(textContent.length);
    }
  }, [isStreaming, textContent, speed]);

  // Create partial HTML based on character count
  useEffect(() => {
    if (!htmlContent) {
      setDisplayedHtml('');
      return;
    }

    if (displayedTextLength >= textContent.length || !isStreaming) {
      // Show full HTML
      setDisplayedHtml(htmlContent);
      return;
    }

    // Create truncated version based on character count
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    let charCount = 0;
    const truncatedDiv = document.createElement('div');
    
    function truncateNode(node: Node, targetLength: number): boolean {
      if (charCount >= targetLength) return false;
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const remainingChars = targetLength - charCount;
        
        if (text.length <= remainingChars) {
          // Include entire text node
          charCount += text.length;
          return true;
        } else {
          // Truncate text node
          (node as Text).textContent = text.slice(0, remainingChars);
          charCount = targetLength;
          return false;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const clonedElement = element.cloneNode(false) as Element;
        
        for (let child of Array.from(element.childNodes)) {
          const clonedChild = child.cloneNode(true);
          if (truncateNode(clonedChild, targetLength)) {
            clonedElement.appendChild(clonedChild);
          } else {
            clonedElement.appendChild(clonedChild);
            break;
          }
        }
        
        (node as Element).parentNode?.replaceChild(clonedElement, node);
        return charCount < targetLength;
      }
      
      return charCount < targetLength;
    }
    
    // Process all child nodes
    for (let child of Array.from(tempDiv.childNodes)) {
      const clonedChild = child.cloneNode(true);
      if (truncateNode(clonedChild, displayedTextLength)) {
        truncatedDiv.appendChild(clonedChild);
      } else {
        truncatedDiv.appendChild(clonedChild);
        break;
      }
    }
    
    setDisplayedHtml(truncatedDiv.innerHTML);
  }, [htmlContent, displayedTextLength, textContent.length, isStreaming]);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative inline", className)}>
      <span dangerouslySetInnerHTML={{ __html: displayedHtml }} />
      {isStreaming && (
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
  );
}
