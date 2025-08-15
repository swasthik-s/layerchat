// Autonomous interaction utilities - natural conversation flow without hardcoded responses

export type InteractionContext = 'greeting' | 'learning' | 'problem_solving' | 'technical' | 'creative' | 'conversational';

export function analyzeInteractionContext(prompt: string): InteractionContext {
  const p = prompt.trim().toLowerCase();
  if (!p) return 'conversational';
  
  // Natural greeting detection (but AI will respond authentically)
  if (/^(hi|hey|hello|yo|sup|hiya|hi there|hey there|good (morning|afternoon|evening))[!. ]*$/i.test(p)) {
    return 'greeting';
  }
  
  // Learning context - user wants to understand something
  if (/\b(explain|understand|learn|teach|how does|why does|what is|help me understand)\b/i.test(p)) {
    return 'learning';
  }
  
  // Problem-solving context - user has a specific challenge
  if (/\b(solve|fix|debug|error|problem|issue|stuck|calculate|build|implement)\b/i.test(p)) {
    return 'problem_solving';
  }
  
  // Technical context - code, systems, technical discussions
  if (/\b(function|class|react|typescript|code|api|database|server|deploy|docker)\b/i.test(p)) {
    return 'technical';
  }
  
  // Creative context - brainstorming, ideas, creative work
  if (/\b(story|poem|brainstorm|ideas|creative|design|metaphor|imagine)\b/i.test(p)) {
    return 'creative';
  }
  
  return 'conversational';
}

/**
 * Provides natural context guidance for autonomous AI responses
 * Instead of prescriptive templates, gives the AI situational awareness
 */
export function getContextualGuidance(context: InteractionContext): string {
  switch (context) {
    case 'greeting':
      return 'CONTEXT: User is greeting you. Respond naturally and warmly as an intelligent assistant would, then smoothly transition to being helpful. Be authentic - no forced templates.';
    
    case 'learning':
      return 'CONTEXT: User wants to learn or understand something. Use your teaching expertise to explain clearly with examples and analogies when helpful. Gauge their level and adapt accordingly.';
    
    case 'problem_solving':
      return 'CONTEXT: User has a specific problem to solve. Focus on practical solutions, break down complex problems logically, and provide actionable guidance. Think step-by-step when helpful.';
    
    case 'technical':
      return 'CONTEXT: Technical discussion. Leverage your expertise appropriately, provide working examples when relevant, and ensure accuracy. Match their technical level naturally.';
    
    case 'creative':
      return 'CONTEXT: Creative or brainstorming session. Be imaginative and engaging while staying helpful. Encourage their creativity and offer diverse perspectives.';
    
    case 'conversational':
    default:
      return 'CONTEXT: General conversation. Respond naturally based on what they need. Use your intelligence to determine the best approach for this specific interaction.';
  }
}

/**
 * Generate natural conversation guidance instead of hardcoded responses
 * Helps AI understand the interaction flow without constraining responses
 */
export function generateNaturalGuidance(prompt: string): { context: InteractionContext; guidance: string; naturalFlow: string } {
  const context = analyzeInteractionContext(prompt);
  const guidance = getContextualGuidance(context);
  
  // Natural flow guidance based on interaction type
  let naturalFlow = '';
  switch (context) {
    case 'greeting':
      naturalFlow = 'Flow: Warm acknowledgment → Express readiness to help → Optionally ask what they\'d like to work on (but only if it feels natural)';
      break;
    case 'learning':
      naturalFlow = 'Flow: Understand their current level → Explain clearly with examples → Check understanding when appropriate';
      break;
    case 'problem_solving':
      naturalFlow = 'Flow: Understand the problem → Break down approach → Provide solution with reasoning → Offer next steps if helpful';
      break;
    case 'technical':
      naturalFlow = 'Flow: Assess technical context → Provide accurate technical guidance → Include practical examples → Consider edge cases when relevant';
      break;
    case 'creative':
      naturalFlow = 'Flow: Understand creative direction → Offer diverse ideas → Build on their concepts → Encourage exploration';
      break;
    default:
      naturalFlow = 'Flow: Understand intent → Provide helpful response → Adapt naturally to conversation needs';
  }
  
  return { 
    context, 
    guidance, 
    naturalFlow: `NATURAL_FLOW: ${naturalFlow}. Remember: be authentic and use your judgment about what's most helpful.`
  };
}
