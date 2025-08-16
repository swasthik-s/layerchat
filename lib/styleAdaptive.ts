// Adaptive style utilities: classify prompt category and generate intelligent conversation starters.

const GREETING_REGEX = /^(hi|hey|hello|yo|sup|hiya|hi there|hey there|good (morning|afternoon|evening))[!. ]*$/i;

export type PromptCategory = 'greeting' | 'simple' | 'complex' | 'math' | 'code' | 'creative' | 'other';

export function classifyPrompt(prompt: string): PromptCategory {
  const p = prompt.trim();
  if (!p) return 'other';
  if (GREETING_REGEX.test(p)) return 'greeting';
  if (/\b(calculate|convert|percent|sum|solve|derivative|integral|=)\b/i.test(p) && p.length < 120) return 'math';
  if (/\b(function|class|react|typescript|code|bug|error|stack trace|compile)\b/i.test(p)) return 'code';
  if (/\b(story|poem|brainstorm|ideas|creative|metaphor)\b/i.test(p)) return 'creative';
  // Simple factual if short and a single sentence
  if (p.length < 60 && !/[?].*[?]/.test(p) && /\b(what|who|when|where|why|how)\b/i.test(p)) return 'simple';
  // Complex if long or multi-question
  if (p.length > 180 || /\?+.*\?+/.test(p)) return 'complex';
  return 'other';
}

// Context-aware conversation starters based on time, session, and user patterns
function getTimeContext(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'late-night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getSessionContext(): string {
  // Check if this might be a returning user (simplified heuristic)
  const hasHistory = typeof window !== 'undefined' && 
    (localStorage.getItem('layerchat-storage') || sessionStorage.length > 0);
  return hasHistory ? 'returning' : 'new';
}

export function generateGreetingVariant(): { hint: string; opener: string; follow: string } {
  const timeContext = getTimeContext();
  const sessionContext = getSessionContext();
  
  // Instead of hardcoded responses, provide intelligent context for the AI
  const contextualHints = [
    `Time: ${timeContext}, User: ${sessionContext} session`,
    'Generate a warm, contextual greeting that feels natural and personal',
    'Consider the time of day and whether this seems like a new or returning conversation',
    'Keep it concise (under 15 words) and end with an open question that invites engagement',
    'Avoid generic phrases like "How can I help?" - be more conversational and specific'
  ].join('. ');

  const hint = `SMART_GREETING_CONTEXT: ${contextualHints}. Respond with ONE natural sentence that acknowledges the context and opens the conversation thoughtfully.`;
  
  // For backward compatibility, still return opener/follow but they're now contextual guides
  const opener = `Context-aware greeting (${timeContext}, ${sessionContext})`;
  const follow = 'AI should generate appropriate follow-up based on context';
  
  return { hint, opener, follow };
}

// Enhanced context detection for better conversation flow
export function getConversationContext(recentMessages?: string[]): string {
  if (!recentMessages || recentMessages.length === 0) {
    return 'fresh-start';
  }
  
  const lastMessage = recentMessages[recentMessages.length - 1]?.toLowerCase() || '';
  
  // Detect continuation patterns
  if (lastMessage.includes('tell me more') || lastMessage.includes('continue')) {
    return 'seeking-depth';
  }
  if (lastMessage.includes('but') || lastMessage.includes('however') || lastMessage.includes('what about')) {
    return 'exploring-alternatives';
  }
  if (lastMessage.includes('example') || lastMessage.includes('show me')) {
    return 'needs-examples';
  }
  if (lastMessage.includes('why') || lastMessage.includes('how does')) {
    return 'seeking-understanding';
  }
  
  return 'ongoing';
}

// Smart response hints based on conversation flow
export function generateResponseHints(category: PromptCategory, context: string): string {
  const baseHints: Record<PromptCategory, string> = {
    'greeting': 'Be warm and welcoming, set a positive tone for the conversation',
    'simple': 'Provide a clear, direct answer with just enough context to be helpful',
    'complex': 'Break down into digestible parts, use structure to organize thoughts',
    'math': 'Show your work clearly, use step-by-step reasoning',
    'code': 'Provide working examples, explain the logic, suggest best practices',
    'creative': 'Be imaginative while staying helpful, offer multiple perspectives',
    'other': 'Be adaptive to the user\'s specific needs and communication style'
  };

  const contextualModifiers: Record<string, string> = {
    'seeking-depth': ' Go deeper into the topic, provide additional layers of detail.',
    'exploring-alternatives': ' Present different approaches or viewpoints to consider.',
    'needs-examples': ' Include concrete, practical examples to illustrate your points.',
    'seeking-understanding': ' Focus on the underlying principles and reasoning.',
    'fresh-start': ' Set a welcoming tone and establish clear communication.',
    'ongoing': ' Build naturally on the previous conversation context.'
  };

  return baseHints[category] + (contextualModifiers[context] || '');
}
