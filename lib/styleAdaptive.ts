// Adaptive style utilities: classify prompt category and generate dynamic greeting variants.

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

// Greeting variant generator with rotation to reduce repetition
const openerPool = [
  'Hey', 'Hi', 'Hello', 'Hey there', 'Hi there', 'Yo', 'Welcome', 'Good to see you'
];
const followPool = [
  'what can I do for you today?',
  'what shall we tackle?',
  'need a quick answer or something deeper?',
  'ready to dive into something?',
  'what are you working on?',
  'how can I help right now?',
  'looking to build, fix, or explore?',
  'want to ship something faster today?'
];

interface UsedPair { o: string; f: string }
const recent: UsedPair[] = [];
const RECENT_LIMIT = 10;

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function generateGreetingVariant(): { hint: string; opener: string; follow: string } {
  let attempts = 0;
  let o = pick(openerPool), f = pick(followPool);
  while (attempts < 20 && recent.find(r => r.o === o && r.f === f)) {
    o = pick(openerPool); f = pick(followPool); attempts++;
  }
  recent.push({ o, f });
  if (recent.length > RECENT_LIMIT) recent.shift();
  const hint = `GREETING_VARIANT: opener="${o}" follow="${f}" -> Respond as ONE natural sentence combining them (<=18 words), warm & human, no repetition.`;
  return { hint, opener: o, follow: f };
}
