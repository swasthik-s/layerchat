"use client";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface StreamingTypewriterProps {
  content: string;
  isStreaming: boolean;
  className?: string;
  speed?: number; // Speed of typewriter effect (ms per character)
}

export function StreamingTypewriter({
  content,
  isStreaming,
  className = "",
  speed = 15,
}: StreamingTypewriterProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isStreaming) {
      // Split content into words while preserving whitespace
      const tokens = content.split(/(\s+)/); // Split but keep separators
      const targetTokenCount = tokens.length;
      
      // If we have new content to display
      if (targetTokenCount > 0) {
        // Clear any existing interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        // Start typewriter effect word by word
        let currentTokenIndex = 0;
        intervalRef.current = setInterval(() => {
          setDisplayedContent(prev => {
            // Get current displayed tokens
            const prevTokens = prev.split(/(\s+)/);
            const currentTokenCount = prevTokens.length;
            
            if (currentTokenCount >= targetTokenCount) {
              // We've caught up, clear interval
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              return content;
            }
            
            // Add next token (word or whitespace)
            currentTokenIndex = Math.min(currentTokenIndex + 1, targetTokenCount);
            const tokensToShow = tokens.slice(0, currentTokenIndex);
            return tokensToShow.join('');
          });
          currentTokenIndex++;
        }, speed);
      }
    } else {
      // Not streaming - show full content immediately
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayedContent(content);
    }
  }, [content, isStreaming, speed]);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Format the displayed content with line breaks
  const formattedContent = displayedContent.split('\n').map((line, index) => (
    <span key={index}>
      {line}
      {index < displayedContent.split('\n').length - 1 && <br />}
    </span>
  ));

  return (
    <div className={cn("inline-block relative", className)}>
      <span className="inline">{formattedContent}</span>
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

// Version optimized for sentence-by-sentence streaming
export function StreamingTypewriterSentences({
  content,
  isStreaming,
  className = "",
  sentenceSpeed = 150,
}: {
  content: string;
  isStreaming: boolean;
  className?: string;
  sentenceSpeed?: number;
}) {
  const [displayedSentences, setDisplayedSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevContentRef = useRef("");

  // Split content into sentences, preserving line breaks
  const sentences = content.split(/(?<=[.!?])\s+|\n/).filter(s => s.trim());

  useEffect(() => {
    if (content !== prevContentRef.current) {
      prevContentRef.current = content;
      
      if (isStreaming && sentences.length > displayedSentences.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
          setCurrentSentenceIndex((prevIndex) => {
            const nextIndex = prevIndex + 1;
            if (nextIndex <= sentences.length) {
              setDisplayedSentences(sentences.slice(0, nextIndex));
              return nextIndex;
            } else {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              return prevIndex;
            }
          });
        }, sentenceSpeed);
      } else if (!isStreaming) {
        setDisplayedSentences(sentences);
        setCurrentSentenceIndex(sentences.length);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }
  }, [content, isStreaming, sentenceSpeed, sentences.length, displayedSentences.length]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("inline-block", className)}>
      <span className="inline">
        {displayedSentences.map((sentence, index) => (
          <span key={index} className="inline">
            {sentence}
            {index < displayedSentences.length - 1 && 
             !sentence.endsWith('\n') && 
             !displayedSentences[index + 1].startsWith('\n') && " "}
          </span>
        ))}
      </span>
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
