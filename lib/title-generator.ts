// Smart title generation service using Mistral AI for contextual chat titles
import { Mistral } from '@mistralai/mistralai'

// Initialize Mistral client
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || ''
})

export interface TitleGenerationResult {
  title: string
  confidence: number
  method: 'ai' | 'local'
}

interface TitleGenerationContext {
  userMessage: string
  assistantResponse?: string
  conversationLength: number
  category?: string
}

// Lightweight title generation using GPT-3.5 or similar lower-cost models
class TitleGenerator {
  
  // Generate a smart title based on conversation context
  static async generateTitle(context: TitleGenerationContext): Promise<string> {
    try {
      // Use a simple, focused prompt for title generation
      const titlePrompt = this.buildTitlePrompt(context)
      
      // Use a lower-cost model for title generation
      const response = await this.callTitleModel(titlePrompt)
      
      // Clean and validate the generated title
      return this.cleanTitle(response)
    } catch (error) {
      console.error('Failed to generate title:', error)
      // Fallback to extracting key terms from user message
      return this.fallbackTitle(context.userMessage)
    }
  }

  // Build an optimized prompt for title generation
  private static buildTitlePrompt(context: TitleGenerationContext): string {
    const { userMessage, assistantResponse, conversationLength, category } = context
    
    // Include assistant response for better context if available
    const conversationContext = assistantResponse 
      ? `User: ${userMessage}\nAssistant: ${assistantResponse.slice(0, 200)}...`
      : `User: ${userMessage}`

    return `Generate a concise, descriptive title (2-6 words) for this conversation:

${conversationContext}

Requirements:
- Focus on the main topic/concept being discussed
- Use proper nouns when relevant (e.g., "MongoDB", "React", "Python")
- Avoid generic words like "help", "question", "how to" 
- Make it specific and searchable
- No quotes, colons, or special characters
- Title only, no explanation

Examples:
User asks about MongoDB vs PostgreSQL → "MongoDB vs PostgreSQL"
User asks about React state management → "React State Management" 
User asks about Python data analysis → "Python Data Analysis"

Title:`
  }

  // Call Mistral model for title generation
  private static async callTitleModel(prompt: string): Promise<string> {
    try {
      // Use Mistral Small (cost-effective for simple tasks)
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 20,
          temperature: 0.3,
          stop: ['\n', '.', '!', '?']
        })
      })

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content?.trim() || ''
    } catch (error) {
      console.error('Mistral title model call failed:', error)
      throw error
    }
  }

  // Alternative: Use local title generation with keyword extraction
  static generateLocalTitle(userMessage: string, assistantResponse?: string): string {
    try {
      // Combine both messages for better context
      const fullContext = assistantResponse 
        ? `${userMessage} ${assistantResponse.slice(0, 300)}`
        : userMessage

      // Extract key technical terms and concepts
      const techTerms = this.extractTechnicalTerms(fullContext)
      const keyPhrases = this.extractKeyPhrases(fullContext)
      
      // Prioritize technical terms, then key phrases
      if (techTerms.length > 0) {
        return this.formatTitle(techTerms.slice(0, 3))
      }
      
      if (keyPhrases.length > 0) {
        return this.formatTitle(keyPhrases.slice(0, 2))
      }

      // Final fallback
      return this.fallbackTitle(userMessage)
    } catch (error) {
      console.error('Local title generation failed:', error)
      return this.fallbackTitle(userMessage)
    }
  }

  // Extract technical terms (databases, frameworks, languages, etc.)
  private static extractTechnicalTerms(text: string): string[] {
    const techPatterns = [
      // Databases
      /\b(MongoDB|PostgreSQL|MySQL|Redis|Supabase|Firebase|DynamoDB|Cassandra|SQLite|Database)\b/gi,
      // Frameworks & Libraries  
      /\b(React|Vue|Angular|Next\.js|Express|FastAPI|Django|Flask|Spring|Laravel|Redux|Zustand)\b/gi,
      // Languages
      /\b(JavaScript|TypeScript|Python|Java|C\+\+|Go|Rust|PHP|Ruby|Swift|Kotlin)\b/gi,
      // Cloud & DevOps
      /\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|GitHub|GitLab|Vercel|Netlify|Deployment|Deploy)\b/gi,
      // Tools & Technologies
      /\b(API|REST|GraphQL|WebSocket|OAuth|JWT|SSL|HTTPS|JSON|XML|YAML)\b/gi,
      // Concepts
      /\b(State Management|Data Analysis|Authentication|Authorization|Caching|Optimization)\b/gi
    ]

    const matches = new Set<string>()
    
    techPatterns.forEach(pattern => {
      const found = text.match(pattern) || []
      found.forEach(match => matches.add(match))
    })

    return Array.from(matches)
  }

  // Extract key phrases using improved NLP
  private static extractKeyPhrases(text: string): string[] {
    // Remove common words and extract meaningful phrases
    const stopWords = new Set([
      'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
      'and', 'or', 'but', 'if', 'when', 'where', 'why', 'how', 'what', 'who',
      'this', 'that', 'these', 'those', 'some', 'any', 'all', 'each', 'every',
      'good', 'best', 'better', 'method', 'way', 'help', 'question', 'ask',
      'there', 'here', 'hello', 'hi', 'hey', 'please', 'thanks', 'thank'
    ])

    // First, try to extract meaningful noun phrases
    const nounPhrases = this.extractNounPhrases(text)
    if (nounPhrases.length > 0) {
      return nounPhrases
    }

    // Fallback to individual words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))

    // Find frequent meaningful words
    const wordCount = new Map<string, number>()
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1)
    })

    // Return top words sorted by frequency and relevance
    return Array.from(wordCount.entries())
      .sort((a, b) => {
        // Prioritize technical terms and longer words
        const aScore = b[1] + (a[0].length > 5 ? 2 : 0)
        const bScore = a[1] + (b[0].length > 5 ? 2 : 0)
        return bScore - aScore
      })
      .slice(0, 5)
      .map(([word]) => word)
  }

  // Extract noun phrases for better context
  private static extractNounPhrases(text: string): string[] {
    const phrases: string[] = []
    
    // Common patterns for meaningful phrases
    const patterns = [
      /\b(state management|data analysis|environment variables|rate limit|error handling|user interface|database design|api endpoint|file upload|real time|machine learning|web development|mobile app|backend service|frontend framework|cloud storage|message queue|load balancing|unit testing|code review|version control)\b/gi,
      /\b(saving messages?|robust methods?|best practices?|deployment strategies?|authentication system|authorization flow|caching strategy|performance optimization|security measures?|scalability solutions?)\b/gi
    ]
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern) || []
      phrases.push(...matches)
    })
    
    return phrases.map((phrase: string) => 
      phrase.toLowerCase()
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    )
  }

  // Format extracted terms into a proper title
  private static formatTitle(terms: string[]): string {
    if (terms.length === 0) return 'New Chat'
    
    // Capitalize each term properly
    const formatted = terms.map(term => 
      term.charAt(0).toUpperCase() + term.slice(1).toLowerCase()
    )

    // Join with appropriate connectors
    if (formatted.length === 1) return formatted[0]
    if (formatted.length === 2) return formatted.join(' ')
    
    // For 3+ terms, be selective
    return formatted.slice(0, 3).join(' ')
  }

  // Clean and validate AI-generated titles
  private static cleanTitle(title: string): string {
    if (!title) return 'New Chat'
    
    // Remove quotes, extra spaces, and unwanted characters
    let cleaned = title
      .replace(/["""'']/g, '')
      .replace(/[:;]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Ensure reasonable length
    if (cleaned.length > 50) {
      cleaned = cleaned.slice(0, 50).trim()
    }

    // Ensure it's not empty after cleaning
    if (cleaned.length < 2) {
      return 'New Chat'
    }

    // Capitalize properly
    return cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Fallback title extraction from user message
  private static fallbackTitle(userMessage: string): string {
    if (!userMessage || userMessage.length < 3) return 'New Chat'
    
    // Extract first meaningful part of the message
    const cleaned = userMessage
      .replace(/^(hi|hey|hello|can you|could you|please|help me|i need|how do i|how to)/i, '')
      .trim()

    if (cleaned.length < 3) return 'New Chat'
    
    // Take first 30 characters and cut at word boundary
    let title = cleaned.slice(0, 30)
    const lastSpace = title.lastIndexOf(' ')
    
    if (lastSpace > 10) {
      title = title.slice(0, lastSpace)
    }

    return this.cleanTitle(title)
  }

  // Quick title generation for real-time use
  static quickTitle(userMessage: string): string {
    // Use local extraction for immediate response
    return this.generateLocalTitle(userMessage)
  }

  // Smart title generation with AI/local fallback
  static async generateSmartTitle(
    userMessage: string, 
    assistantMessage: string, 
    useAI: boolean = false
  ): Promise<TitleGenerationResult> {
    if (useAI && process.env.MISTRAL_API_KEY) {
      try {
        const aiTitle = await this.callTitleModel(
          this.buildTitlePrompt({
            userMessage,
            assistantResponse: assistantMessage,
            conversationLength: 2
          })
        )
        
        if (aiTitle && aiTitle !== 'New Chat') {
          return {
            title: this.cleanTitle(aiTitle),
            confidence: 0.9,
            method: 'ai'
          }
        }
      } catch (error) {
        console.error('AI title generation failed:', error)
      }
    }
    
    // Fallback to local generation
    const localTitle = this.generateLocalTitle(userMessage, assistantMessage)
    return {
      title: localTitle,
      confidence: 0.7,
      method: 'local'
    }
  }
}

// Export for use in chat service
export { TitleGenerator }
