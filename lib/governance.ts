// AI Governance Module - Controls when to use internet vs internal knowledge

export interface GovernanceRule {
  name: string
  description: string
  shouldUseInternet: (query: string) => boolean | undefined // undefined means no decision, check next rule
  priority: number // Higher priority rules are checked first
}

export interface GovernanceConfig {
  defaultMode: 'internet' | 'internal' | 'smart'
  enableGovernance: boolean
  rules: GovernanceRule[]
}

export class AIGovernance {
  private config: GovernanceConfig

  constructor(config?: Partial<GovernanceConfig>) {
    this.config = {
      defaultMode: 'smart',
      enableGovernance: true,
      rules: this.getDefaultRules(),
      ...config
    }
  }

  /**
   * Determines whether to use internet search or internal knowledge
   */
  shouldUseInternet(query: string): boolean {
    if (!this.config.enableGovernance) {
      return this.config.defaultMode === 'internet'
    }

    // Check rules in priority order
    const sortedRules = this.config.rules.sort((a, b) => b.priority - a.priority)
    
    for (const rule of sortedRules) {
      const result = rule.shouldUseInternet(query)
      if (result !== undefined) {
        console.log(`🏛️ Governance: Rule "${rule.name}" determined ${result ? 'INTERNET' : 'INTERNAL'} for query: "${query.slice(0, 50)}..."`)
        return result
      }
    }

    // Fallback to default mode
    return this.config.defaultMode === 'internet'
  }

  /**
   * Get explanation for why internet was or wasn't used
   */
  getDecisionReason(query: string): string {
    if (!this.config.enableGovernance) {
      return `Governance disabled, using ${this.config.defaultMode} mode`
    }

    const sortedRules = this.config.rules.sort((a, b) => b.priority - a.priority)
    
    for (const rule of sortedRules) {
      const result = rule.shouldUseInternet(query)
      if (result !== undefined) {
        return `Rule: ${rule.name} - ${rule.description}`
      }
    }

    return `No specific rule matched, using default ${this.config.defaultMode} mode`
  }

  private getDefaultRules(): GovernanceRule[] {
    return [
      // INTERNAL KNOWLEDGE RULES (Higher Priority)
      {
        name: 'Identity Questions',
        description: 'Questions about AI identity, capabilities, or general knowledge should use internal knowledge',
        priority: 100,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          const identityPatterns = [
            /who are you/i,
            /what are you/i,
            /tell me about yourself/i,
            /your name/i,
            /your capabilities/i,
            /what can you do/i,
            /how do you work/i,
            /what is ai/i,
            /what is artificial intelligence/i,
            /define /i,
            /explain /i,
            /how does .* work/i,
          ]
          
          if (identityPatterns.some(pattern => pattern.test(lower))) {
            return false // Use internal knowledge
          }
          return undefined // No decision, check next rule
        }
      },

      {
        name: 'Mathematical Calculations',
        description: 'All math calculations, percentage calculations, and basic arithmetic use internal knowledge',
        priority: 100,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          const mathPatterns = [
            /calculate/i,
            /^solve/i,
            /math/i,
            /mathematical/i,
            /percentage/i,
            /percent/i,
            /\d+%/,
            /multiply/i,
            /divide/i,
            /addition/i,
            /subtraction/i,
            /equation/i,
            /formula/i,
            /\d+\s*[\+\-\*\/]\s*\d+/,
            /^\d+.*of.*\d+/i,
            /what is \d/i,
            /how much is/i,
          ]
          
          if (mathPatterns.some(pattern => pattern.test(lower))) {
            return false // Always use internal knowledge for math
          }
          return undefined
        }
      },

      {
        name: 'General Knowledge',
        description: 'Common facts, definitions, and educational content use internal knowledge',
        priority: 95,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          const generalKnowledgePatterns = [
            /what is a /i,
            /what are /i,
            /how to /i,
            /explain the concept/i,
            /what does .* mean/i,
            /difference between/i,
            /history of/i,
            /definition of/i,
            /meaning of/i,
            /examples of/i,
            /types of/i,
            /advantages of/i,
            /disadvantages of/i,
            /benefits of/i,
            /process of/i,
            /steps to/i,
            /how does.*work/i,
            /why does/i,
            /purpose of/i,
          ]
          
          // Only use internet for EXPLICITLY time-sensitive or real-time requests
          const explicitRealTimeIndicators = [
            'current price', 'latest news', 'recent events', 'live updates',
            'breaking news', 'today\'s', 'this week\'s', 'real-time',
            'as of now', 'up to date', 'most recent'
          ]
          
          const hasExplicitRealTime = explicitRealTimeIndicators.some(indicator => 
            lower.includes(indicator)
          )
          
          if (!hasExplicitRealTime && generalKnowledgePatterns.some(pattern => pattern.test(lower))) {
            return false // Use internal knowledge
          }
          return undefined
        }
      },

      {
        name: 'Programming & Technical',
        description: 'Programming questions, code examples, and technical concepts use internal knowledge unless asking for latest frameworks',
        priority: 85,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          const programmingPatterns = [
            /how to code/i,
            /write a function/i,
            /javascript/i,
            /python/i,
            /react/i,
            /algorithm/i,
            /data structure/i,
            /programming/i,
            /software development/i,
          ]
          
          const requiresLatest = [
            'latest version', 'newest', 'recent updates', 'current version',
            'just released', 'announcement', 'breaking changes'
          ]
          
          const needsLatest = requiresLatest.some(phrase => lower.includes(phrase))
          
          if (programmingPatterns.some(pattern => pattern.test(lower)) && !needsLatest) {
            return false // Use internal knowledge for general programming
          }
          return undefined
        }
      },

      // INTERNET SEARCH RULES (Only for EXPLICIT real-time requests)
      {
        name: 'Real-time Data',
        description: 'Only EXPLICITLY current, breaking, or real-time information requests',
        priority: 85,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          
          // Very specific patterns that EXPLICITLY request real-time info
          const explicitRealTimePatterns = [
            /current price of/i,
            /latest news about/i,
            /recent events/i,
            /breaking news/i,
            /real-time/i,
            /live updates/i,
            /as of (today|now)/i,
            /what's happening (now|today)/i,
            /latest developments/i,
            /most recent/i,
            /up to date/i,
            /current status of/i,
            /today's/i,
            /this week's/i,
            /trending now/i,
            /current market/i,
            /live data/i,
          ]
          
          // Patterns that seem time-sensitive but are often general knowledge
          const generalTimeWords = [
            'current', 'latest', 'now', 'today', 'recent'
          ]
          
          // Only trigger internet if there's an EXPLICIT real-time pattern
          if (explicitRealTimePatterns.some(pattern => pattern.test(lower))) {
            return true // Use internet search
          }
          
          // Don't trigger just for general time words without context
          return undefined
        }
      },

      {
        name: 'Financial Data',
        description: 'Stock prices, crypto prices, market data, and financial information',
        priority: 75,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          const financialPatterns = [
            /price/i,
            /cost/i,
            /market/i,
            /stock/i,
            /crypto/i,
            /bitcoin/i,
            /ethereum/i,
            /trading/i,
            /exchange rate/i,
            /currency/i,
          ]
          
          if (financialPatterns.some(pattern => pattern.test(lower))) {
            return true // Use internet search
          }
          return undefined
        }
      },

      {
        name: 'Weather & Time',
        description: 'Weather conditions and current time queries',
        priority: 70,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          const weatherTimePatterns = [
            /weather/i,
            /temperature/i,
            /forecast/i,
            /what time/i,
            /current time/i,
            /time in/i,
            /timezone/i,
          ]
          
          if (weatherTimePatterns.some(pattern => pattern.test(lower))) {
            return true // Use internet search
          }
          return undefined
        }
      },

      {
        name: 'Explicit Search Request',
        description: 'User explicitly asks to search or look something up',
        priority: 95,
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          const explicitSearchPatterns = [
            /@search/i,
            /search for/i,
            /look up/i,
            /find information/i,
            /google/i,
            /internet search/i,
          ]
          
          if (explicitSearchPatterns.some(pattern => pattern.test(lower))) {
            return true // Use internet search
          }
          return undefined
        }
      },

      {
        name: 'Default Internal Knowledge',
        description: 'Default to internal knowledge for most queries unless explicitly requesting real-time data',
        priority: 10, // Lowest priority - acts as fallback
        shouldUseInternet: (query: string) => {
          const lower = query.toLowerCase()
          
          // Only use internet for very specific patterns that weren't caught above
          const forceInternetPatterns = [
            /search the web/i,
            /browse the internet/i,
            /check online/i,
            /find on google/i,
            /current news/i,
            /breaking.*news/i,
            /live.*update/i,
          ]
          
          if (forceInternetPatterns.some(pattern => pattern.test(lower))) {
            return true
          }
          
          // Default to internal knowledge for everything else
          return false
        }
      }
    ]
  }

  /**
   * Update governance configuration
   */
  updateConfig(newConfig: Partial<GovernanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Add a custom rule
   */
  addRule(rule: GovernanceRule): void {
    this.config.rules.push(rule)
  }

  /**
   * Remove a rule by name
   */
  removeRule(ruleName: string): void {
    this.config.rules = this.config.rules.filter(rule => rule.name !== ruleName)
  }

  /**
   * Get current configuration
   */
  getConfig(): GovernanceConfig {
    return { ...this.config }
  }

  /**
   * Get available governance modes
   */
  static getAvailableModes(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'smart',
        label: 'Smart Mode',
        description: 'AI decides based on governance rules (recommended)'
      },
      {
        value: 'internal',
        label: 'Internal Only',
        description: 'Always use internal knowledge, never search internet'
      },
      {
        value: 'internet',
        label: 'Internet Preferred',
        description: 'Prefer internet search for most queries'
      }
    ]
  }
}

// Default governance instance
export const defaultGovernance = new AIGovernance({
  defaultMode: 'smart',
  enableGovernance: true
})

export default defaultGovernance
