import { AIModel, Agent, ChatMessage, OrchestratorConfig } from '@/types'
import { GPT4Model, ClaudeModel, DallE3Model, GeminiModel, DynamicOpenAIModel, DynamicMistralModel, DynamicGoogleModel } from '@/models'
import { SearchAgent, TimeAgent, YouTubeAgent, MathAgent, WeatherAgent } from '@/agents'
import { AIGovernance, defaultGovernance } from '@/lib/governance'
import { buildPersonaSystemPrompt, GLOBAL_FORMATTING_RULES, NATURAL_EXAMPLES } from '@/lib/systemPrompt'
import { analyzeInteractionContext, generateNaturalGuidance } from '@/lib/styleAdaptive'

export class Orchestrator {
  private models: Map<string, AIModel> = new Map()
  private agents: Agent[] = []
  private config: OrchestratorConfig
  private governance: AIGovernance

  constructor(config: OrchestratorConfig, governance?: AIGovernance) {
    this.config = config
    this.governance = governance || defaultGovernance
    this.initializeModels()
    this.initializeAgents()
  }

  private initializeModels() {
    const gpt4 = new GPT4Model()
    const claude = new ClaudeModel()
    const dalle = new DallE3Model()
    const gemini = new GeminiModel()

    this.models.set(gpt4.name, gpt4)
    this.models.set(claude.name, claude)
    this.models.set(dalle.name, dalle)
    this.models.set(gemini.name, gemini)

    // Add legacy mappings for backward compatibility
    this.models.set('GPT-4', gpt4)
    this.models.set('Claude-3-Sonnet', claude)
    this.models.set('DALL-E-3', dalle)
    this.models.set('Gemini-Pro', gemini)
  }

  // Method to dynamically add OpenAI models
  public addOpenAIModel(modelId: string) {
    if (!this.models.has(modelId)) {
      const dynamicModel = new DynamicOpenAIModel(modelId)
      this.models.set(modelId, dynamicModel)
    }
    return this.models.get(modelId)
  }

  // Method to dynamically add Mistral models  
  public addMistralModel(modelId: string) {
    if (!this.models.has(modelId)) {
      const dynamicModel = new DynamicMistralModel(modelId)
      this.models.set(modelId, dynamicModel)
    }
    return this.models.get(modelId)
  }

  // Method to dynamically add Google models
  public addGoogleModel(modelId: string) {
    if (!this.models.has(modelId)) {
      const dynamicModel = new DynamicGoogleModel(modelId)
      this.models.set(modelId, dynamicModel)
    }
    return this.models.get(modelId)
  }

  private initializeAgents() {
    this.agents = [
      new SearchAgent(),
      new TimeAgent(),
      new YouTubeAgent(),
      new MathAgent(),
      new WeatherAgent()
    ]
  }

  async processMessage(message: ChatMessage, selectedModel?: string, settings?: any): Promise<ChatMessage> {
    let model = this.models.get(selectedModel || this.config.defaultModel)
    
    // If model not found and it looks like an OpenAI model, create it dynamically
    if (!model && selectedModel) {
      // Check if it's an OpenAI model (common OpenAI model patterns)
      if (selectedModel.includes('gpt') || selectedModel.includes('chatgpt') || selectedModel.includes('o1')) {
        model = this.addOpenAIModel(selectedModel)
      }
      // Check if it's a Mistral model
      else if (selectedModel.includes('mistral') || selectedModel.includes('mixtral') || selectedModel.includes('codestral') ||
               selectedModel.includes('magistral') || selectedModel.includes('devstral') || selectedModel.includes('pixtral') ||
               selectedModel.includes('voxtral') || selectedModel.includes('ministral')) {
        model = this.addMistralModel(selectedModel)
      }
      // Check if it's a Google model
      else if (selectedModel.includes('gemini') || selectedModel.includes('palm') || selectedModel.includes('bard')) {
        model = this.addGoogleModel(selectedModel)
      }
    }
    
    if (!model) {
      throw new Error(`Model ${selectedModel || this.config.defaultModel} not found`)
    }

    // Check for explicit agent mentions (e.g., @search, @youtube)
    const explicitAgent = this.detectExplicitAgent(message.content)
    
    // Check if governance allows internet access and if any agents should be triggered automatically
    let autoAgent = null
    if (this.config.enableAutoAgents) {
      // Use governance to determine if we should search the internet
      const shouldUseInternet = this.governance.shouldUseInternet(message.content)
      
      if (shouldUseInternet) {
        // Only detect auto agents if governance permits internet access
        autoAgent = this.detectAutoAgent(message.content)
        console.log(`🏛️ Governance: ALLOWING internet access - ${this.governance.getDecisionReason(message.content)}`)
      } else {
        console.log(`🏛️ Governance: BLOCKING internet access - ${this.governance.getDecisionReason(message.content)}`)
      }
    }

    const agentToUse = explicitAgent || autoAgent

    if (agentToUse) {
      // Run agent then build enriched dual-output prompt
      const agentResponse = await agentToUse.run(message.content)
      const enrichedPrompt = this.buildEnrichedPrompt(message.content, agentResponse)
      const options = {
        temperature: settings?.temperature || 0.7,
        maxTokens: settings?.maxTokens || 4000,
      }
      // Build dual system+user prompts and substitute enriched content as user body
      const promptBundle = this.buildSystemUserPrompts(message.content, { dual: true, skipConciseForSearch: true })
      promptBundle.user = enrichedPrompt
      const modelResponse = await model.generate(promptBundle, options)
      const split = this.splitDualResponse(modelResponse.content as string)
      const enhanced = this.autoMathifyOutput(split.full)
      
      return {
        id: `response-${Date.now()}`,
        role: 'assistant',
        content: enhanced,
        type: modelResponse.type,
        timestamp: Date.now(),
        metadata: {
          model: model.name,
          agent: agentToUse.name,
          tokens: modelResponse.metadata?.tokens,
          agentData: agentResponse.data,
          sources: this.extractSources(agentResponse.data),
          concise: split.concise,
          full: enhanced,
        explanationAvailable: !!split.concise && split.full !== split.concise && promptBundle.mode === 'DUAL',
        outputMode: promptBundle.mode
        }
      }
    } else {
      // Direct model response without agent
      const options = {
        temperature: settings?.temperature || 0.7,
        maxTokens: settings?.maxTokens || 4000,
      }
      
  const dualPrompts = this.buildSystemUserPrompts(message.content, { dual: true })
      const promptBundle = this.buildSystemUserPrompts(message.content, { dual: true })
      const modelResponse = await model.generate(promptBundle, options)
  const split = this.splitDualResponse(modelResponse.content as string)
  const enhanced = this.autoMathifyOutput(split.full)

      return {
        id: `response-${Date.now()}`,
        role: 'assistant',
        content: enhanced,
        type: modelResponse.type,
        timestamp: Date.now(),
        metadata: {
          model: model.name,
          tokens: modelResponse.metadata?.tokens,
          concise: split.concise,
          full: enhanced,
        explanationAvailable: !!split.concise && split.full !== split.concise && promptBundle.mode === 'DUAL',
        outputMode: promptBundle.mode
        }
      }
    }
  }

  async processMessageStream(message: ChatMessage, selectedModel?: string, settings?: any): Promise<{ content?: string; stream?: ReadableStream; metadata?: any }> {
    let model = this.models.get(selectedModel || this.config.defaultModel)
    
    // If model not found and it looks like an OpenAI model, create it dynamically
    if (!model && selectedModel) {
      // Check if it's an OpenAI model (common OpenAI model patterns)
      if (selectedModel.includes('gpt') || selectedModel.includes('chatgpt') || selectedModel.includes('o1')) {
        model = this.addOpenAIModel(selectedModel)
      }
      // Check if it's a Mistral model
      else if (selectedModel.includes('mistral') || selectedModel.includes('mixtral') || selectedModel.includes('codestral') ||
               selectedModel.includes('magistral') || selectedModel.includes('devstral') || selectedModel.includes('pixtral') ||
               selectedModel.includes('voxtral') || selectedModel.includes('ministral')) {
        model = this.addMistralModel(selectedModel)
      }
      // Check if it's a Google model
      else if (selectedModel.includes('gemini') || selectedModel.includes('palm') || selectedModel.includes('bard')) {
        model = this.addGoogleModel(selectedModel)
      }
    }
    
    if (!model) {
      throw new Error(`Model ${selectedModel || this.config.defaultModel} not found`)
    }

    // Check for agents
    const explicitAgent = this.detectExplicitAgent(message.content)
    
    // Use governance to determine if we should allow internet access
    let autoAgent = null
    if (this.config.enableAutoAgents) {
      const shouldUseInternet = this.governance.shouldUseInternet(message.content)
      
      if (shouldUseInternet) {
        autoAgent = this.detectAutoAgent(message.content)
        console.log(`🏛️ Governance: ALLOWING internet access for streaming - ${this.governance.getDecisionReason(message.content)}`)
      } else {
        console.log(`🏛️ Governance: BLOCKING internet access for streaming - ${this.governance.getDecisionReason(message.content)}`)
      }
    }
    
    const agentToUse = explicitAgent || autoAgent

    const options = {
      temperature: settings?.temperature || 0.7,
      maxTokens: settings?.maxTokens || 4000,
    }

    if (agentToUse) {
      // Create a custom stream for search phases
      const orchestrator = this // Reference to the orchestrator instance
      const searchStream = new ReadableStream({
        async start(controller) {
          try {
            // Phase: Searching Web & Processing Data
            if (agentToUse.name === 'Internet Search') {
              console.log('🔍 ORCHESTRATOR: Sending search_phase START event')
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ 
                    type: 'search_phase',
                    phase: 'searching'
                  })}\n\n`
                )
              )
              
              // Add a delay to show the search animation
              await new Promise(resolve => setTimeout(resolve, 1500))
            }

            // Run agent
            const agentResponse = await agentToUse.run(message.content)
            
            // Mark search complete (for search agents)
            if (agentToUse.name === 'Internet Search') {
              console.log('🔍 ORCHESTRATOR: Sending search_phase COMPLETE event')
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ 
                    type: 'search_phase',
                    phase: 'complete'
                  })}\n\n`
                )
              )
            }

            const enrichedPrompt = orchestrator.buildEnrichedPrompt(message.content, agentResponse)
            
            // Check if model supports streaming
            if (typeof (model as any).generateStream === 'function') {
              const dualPrompts = orchestrator.buildSystemUserPrompts(message.content, { dual: true, skipConciseForSearch: true })
              dualPrompts.user = enrichedPrompt
              const stream = await (model as any).generateStream(dualPrompts, options)
              
              // Pipe the model stream to our custom stream
              const reader = stream.getReader()
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                controller.enqueue(value)
              }
              
              controller.close()
            } else {
              // Non-streaming model fallback
              const dualPrompts = orchestrator.buildSystemUserPrompts(message.content, { dual: true, skipConciseForSearch: true })
              dualPrompts.user = enrichedPrompt
              const modelResponse = await (model as any).generate(dualPrompts, options)
              
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ 
                    type: 'content',
                    content: modelResponse.content,
                    metadata: {
                      model: model.name,
                      agent: agentToUse.name,
                      agentData: agentResponse.data,
                      sources: orchestrator.extractSources(agentResponse.data)
                    }
                  })}\n\n`
                )
              )
              
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ type: 'done' })}\n\n`
                )
              )
              
              controller.close()
            }
            
          } catch (error) {
            controller.error(error)
          }
        }
      })

      return {
        stream: searchStream,
        metadata: {
          model: model.name,
          agent: agentToUse.name
        }
      }
    } else {
      // Direct model response
      if (typeof (model as any).generateStream === 'function') {
        // Ensure streaming path also receives style instructions like non-streaming path
  const dualPrompts = this.buildSystemUserPrompts(message.content, { dual: true })
  const stream = await (model as any).generateStream(dualPrompts, options)
        return {
          stream,
          metadata: {
            model: model.name
          }
        }
      } else {
        // Fallback to non-streaming
  const dualPrompts = this.buildSystemUserPrompts(message.content, { dual: true })
  const modelResponse = await model.generate(dualPrompts, options)
    const split = this.splitDualResponse(modelResponse.content as string)
    const enhanced = this.autoMathifyOutput(split.full)
        return {
    content: enhanced,
          metadata: {
            model: model.name,
      tokens: modelResponse.metadata?.tokens,
      concise: split.concise,
      full: enhanced,
      explanationAvailable: !!split.concise && split.full !== split.concise
          }
        }
      }
    }
  }

  // Inject style instructions if not already present
  // (Deprecated) buildStylePrompt retained for backward compatibility but not used; dual formatting now enforced via buildSystemUserPrompts.
  private buildStylePrompt(userPrompt: string): string { return userPrompt }

  // New helper: produce system + user prompts so models receive cleaner separation
  private buildSystemUserPrompts(userPrompt: string, opts: { dual?: boolean; skipConciseForSearch?: boolean } = {}) {
    const mode = this.decideOutputMode(userPrompt);
    const marker = 'STYLE_INSTRUCTIONS_V1';
    const procedural = this.isProceduralQuery(userPrompt);
  const stepLine = procedural ? 'Explain with clear numbered steps (Step 1, Step 2, ...).' : 'Provide a concise, well-structured explanation (avoid artificial step headings).';
    let outputSpec = '';
    
    // Force EXPLANATION_ONLY mode when dealing with internet search to avoid CONCISE tags
    const finalMode = opts.skipConciseForSearch ? 'EXPLANATION_ONLY' : mode;
    
    if (finalMode === 'DUAL') {
      outputSpec = `OUTPUT FORMAT (MANDATORY):\n<CONCISE>Produce a single, self-contained natural sentence (or minimal expression when strictly numeric is best) that directly answers the user. Include necessary units/context. No filler preface.</CONCISE>\n<EXPLANATION>Provide a rich expansion WITHOUT copying the concise sentence verbatim as the first line. Include steps / reasoning, math ($...$ or $$...$$), structured sections, and end with a bold **Final Answer:** line.</EXPLANATION>\nAlways output BOTH tags exactly once.`;
    } else if (finalMode === 'CONCISE_ONLY') {
      outputSpec = `OUTPUT FORMAT (MANDATORY):\n<CONCISE>Only a single natural sentence (or tight expression) with enough context to stand alone. No additional commentary. Output ONLY this tag and nothing else.</CONCISE>`;
    } else if (finalMode === 'EXPLANATION_ONLY') {
      outputSpec = `OUTPUT FORMAT (MANDATORY): A direct, full explanation. Start with a 1-line bold summary (no <CONCISE> tag). Then detailed reasoning, and a bold **Final Answer:** line if applicable. Do NOT use <CONCISE> or <EXPLANATION> tags.`;
    }
    
    // Generate natural contextual guidance instead of rigid classification
    const naturalGuidance = generateNaturalGuidance(userPrompt);
    const contextualHint = `${naturalGuidance.guidance}\n${naturalGuidance.naturalFlow}`;
    
    const persona = buildPersonaSystemPrompt(contextualHint);
    const styleSegment = `(${marker}) STYLE & OUTPUT RULES:\nOUTPUT_MODE: ${finalMode}\n${stepLine}\nUse LaTeX for ALL math expressions (inline $...$, display $$...$$). Show intermediate calculations only when helpful. Bold the final answer line beginning with 'Answer:' or 'Final Answer:' or 'Conclusion:'. Keep tone analytical yet approachable. Never output the final answer twice.\n${outputSpec}`.trim();
    const system = `${persona}\n\n${GLOBAL_FORMATTING_RULES}\n${styleSegment}\n\n${NATURAL_EXAMPLES}`;
    return { system, user: userPrompt, mode: finalMode };
  }

  // Decide output mode dynamically
  private decideOutputMode(userPrompt: string): 'CONCISE_ONLY' | 'DUAL' | 'EXPLANATION_ONLY' {
    const p = userPrompt.trim();
    const lower = p.toLowerCase();
  // Expanded simple math / direct computation patterns (allow 'calculate 25% of 400')
  const simpleMathPattern = /^(?:[\d\s+*\/×÷\-()%\.]+|calculate\s+\d+%?(?:\s*of\s*\d+)?|what\s+is\s+\d+%?(?:\s*of\s*\d+)?|\d+%\s*of\s*\d+)$/i;
    const hasWhy = /(why|reason|explain|because)/i.test(lower);
    const hasHow = /(how|steps|process|procedure|derive|prove|proof|show that)/i.test(lower);
    const wantsComparison = /(compare|difference between|versus|vs\b|advantages|disadvantages|pros|cons|trade[- ]?offs?)/i.test(lower);
    const lengthy = p.length > 120 || p.split(/\n/).length > 3;
    const multiQuestion = /\?[^\?]+\?/.test(p);
    // Explicit cues to force explanation
    const explicitExplain = /(explain|detailed|elaborate|in detail|step by step|walk me through)/i.test(lower);
    // Capability / integration / feasibility intent (user likely wants steps, not a yes/no)
    const capabilityPatterns: RegExp[] = [
      /can (i|we|you) use [\w\s-]+ (for|to) /i,
      /can [\w\s-]+ be used for /i,
      /can we use .*\?/i,
      /use \w+[\w\s-]* for \w+/i,
      /best (way|method) to /i,
      /how (do|to) (add|integrate|use|implement|setup|set up|configure|install) /i,
      /(integrate|integration) .* (with|into) /i,
      /(add|install|configure|setup|set up) .* (library|package|plugin|module)/i,
      /should i use /i,
      /is it (ok|okay|possible) to use /i
    ];
    const capabilityIntent = capabilityPatterns.some(r => r.test(lower));
    if (capabilityIntent) return 'EXPLANATION_ONLY';
    if (explicitExplain || hasWhy || hasHow || wantsComparison || lengthy || multiQuestion) {
      // If it's strongly reasoning heavy but user didn't ask for a short answer, use DUAL unless they explicitly say 'explain only'
      if (/explanation only|just explain|only explanation/i.test(lower)) return 'EXPLANATION_ONLY';
      return 'DUAL';
    }
    if (simpleMathPattern.test(p) || p.split(/\s+/).length <= 6 || /^(hi|hey|hello|thanks|thank you)/i.test(lower)) {
      return 'CONCISE_ONLY';
    }
    // Default to dual to be safe
    return 'DUAL';
  }

  private isProceduralQuery(q: string): boolean {
    return /(calculate|compute|solve|deriv(e|ation)|prove|convert|steps|how to|install|configure|set ?up|algorithm|recipe|procedure|workflow|process|integrat(e|ion))/i.test(q);
  }

  private splitDualResponse(raw: string): { concise: string; full: string } {
    if (!raw) return { concise: '', full: '' }
    const conciseMatch = raw.match(/<CONCISE>([\s\S]*?)<\/CONCISE>/i)
    const explMatch = raw.match(/<EXPLANATION>([\s\S]*?)<\/EXPLANATION>/i)
    if (conciseMatch && explMatch) {
      return { concise: conciseMatch[1].trim(), full: explMatch[1].trim() }
    }
    // Fallback: derive concise as first sentence or math expression up to ~160 chars
    const cleaned = raw.trim()
    let concise = ''
    if (cleaned.length) {
      const firstMath = cleaned.match(/\$\$[\s\S]+?\$\$|\$[^$\n]+\$/)
      if (firstMath && firstMath.index === 0) {
        concise = firstMath[0].replace(/\$/g,'').trim()
      } else {
        const sentence = cleaned.match(/[^.!?\n]{5,200}[.!?]/)
        concise = sentence ? sentence[0].trim() : cleaned.split(/\n+/)[0].slice(0,160).trim()
      }
    }
    return { concise, full: raw }
  }

  // Post-process raw model text to wrap standalone operation lines in $$ $$ for KaTeX rendering
  private autoMathifyOutput(text: string): string {
    if (!text) return text;
    const parts = text.split(/(```[\s\S]*?```)/); // keep code fences intact
    const processed = parts.map(part => {
      if (/^```/.test(part)) return part; // skip code
      const lines = part.split(/\n/).map(line => {
        if (!line.trim()) return line;
        if (/(\$|\\\[|\\\()/.test(line)) return line; // already has math
        const raw = line.trim();
        const opChars = /[+\-*/×÷=]/.test(raw);
        const mathish = /^[-+*/×÷=0-9().%\s]+$/.test(raw);
        if (opChars && mathish && raw.replace(/[0-9().%\s]/g,'').length <= 6) {
          return line.replace(raw, `$$${raw.replace(/%/g,'\\%')}$$`);
        }
        return line;
      });
      return lines.join('\n');
    });
    return processed.join('');
  }

  private detectExplicitAgent(content: string): Agent | null {
    // Check for explicit @mentions
    for (const agent of this.agents) {
      const agentMention = `@${agent.name.toLowerCase().replace(/\s+/g, '')}`
      if (content.toLowerCase().includes(agentMention)) {
        return agent
      }
    }
    return null
  }

  private detectAutoAgent(content: string): Agent | null {
    // First check explicit patterns for each agent
    for (const agent of this.agents) {
      if (typeof agent.trigger === 'string') {
        if (content.toLowerCase().includes(agent.trigger.toLowerCase())) {
          return agent
        }
      } else if (agent.trigger instanceof RegExp) {
        if (agent.trigger.test(content)) {
          return agent
        }
      }
    }

    // Enhanced intelligent detection for common real-time queries
    const lowerContent = content.toLowerCase()
    
    // Time and date related queries - prioritize TimeAgent
    if (lowerContent.match(/\b(time|clock|date|timezone|hour|minute|when is|what day|today|now|current)\b/)) {
      const timeAgent = this.agents.find(agent => agent.name === 'World Time')
      if (timeAgent) return timeAgent
    }
    
    // Weather queries
    if (lowerContent.match(/\b(weather|temperature|rain|sunny|cloudy|forecast|climate)\b/)) {
      const weatherAgent = this.agents.find(agent => agent.name === 'Weather')
      if (weatherAgent) return weatherAgent
    }
    
    // Math and calculation queries
    if (lowerContent.match(/\b(calculate|math|solve|equation|formula|compute|sum|multiply|divide|percentage)\b/)) {
      const mathAgent = this.agents.find(agent => agent.name === 'Math Calculator')
      if (mathAgent) return mathAgent
    }
    
    // Video content queries
    if (lowerContent.match(/\b(video|youtube|watch|tutorial|how to.*video|show me.*video)\b/)) {
      const youtubeAgent = this.agents.find(agent => agent.name === 'YouTube')
      if (youtubeAgent) return youtubeAgent
    }
    
    // AUTONOMOUS SEARCH TRIGGERS - Default to search for most queries that could benefit from real-time data
    const searchAgent = this.agents.find(agent => agent.name === 'Internet Search')
    
    if (searchAgent) {
      // Comprehensive search patterns for real-time information
      if (lowerContent.match(/\b(latest|recent|news|current|happening|update|search|find|look up|tell me about|what is|who is|where is|how is|why is|when did|how much|how many|price|cost|value|worth|market|stock|crypto|bitcoin|ethereum|currency|exchange rate|trending|popular|best|top|compare|vs|versus|review|status|available|open|closed|schedule|events|releases|updates|launches)\b/)) {
        return searchAgent
      }
      
      // Financial and market data
      if (lowerContent.match(/\b(price|cost|value|worth|market|stock|crypto|bitcoin|ethereum|currency|exchange|trading|invest|finance|economy|inflation|interest|rate|USD|EUR|GBP|JPY|CAD|AUD|INR)\b/)) {
        return searchAgent
      }
      
      // Company and business information
      if (lowerContent.match(/\b(company|business|startup|corporation|enterprise|revenue|profit|earnings|IPO|acquisition|merger|CEO|founder|valuation|funding|investment)\b/)) {
        return searchAgent
      }
      
      // Technology and product information
      if (lowerContent.match(/\b(technology|tech|software|hardware|app|website|platform|service|product|device|gadget|phone|computer|AI|artificial intelligence|machine learning|blockchain|cloud|cybersecurity)\b/)) {
        return searchAgent
      }
      
      // Sports and entertainment
      if (lowerContent.match(/\b(sports|football|basketball|baseball|soccer|tennis|olympics|game|match|score|winner|championship|tournament|movie|film|show|series|actor|actress|celebrity|music|album|song|artist|concert|award)\b/)) {
        return searchAgent
      }
      
      // Health and science
      if (lowerContent.match(/\b(health|medicine|disease|treatment|vaccine|drug|research|study|science|discovery|breakthrough|climate|environment|space|NASA|Mars|planet|universe|covid|virus|pandemic)\b/)) {
        return searchAgent
      }
      
      // Politics and world events
      if (lowerContent.match(/\b(politics|election|president|government|policy|law|congress|senate|parliament|minister|prime minister|democracy|vote|campaign|war|conflict|peace|treaty|agreement|summit|meeting)\b/)) {
        return searchAgent
      }
      
      // Any question that starts with common inquiry words
      if (lowerContent.match(/^(what|who|where|when|how|why|which|is|are|was|were|do|does|did|can|could|will|would|should|may|might)\b/)) {
        return searchAgent
      }
      
      // Fallback: if the query contains any specific entities that could have real-time information
      if (lowerContent.match(/\b([A-Z][a-z]+ [A-Z][a-z]+|\d{4}|\$\d+|€\d+|£\d+|¥\d+|₹\d+|#\w+|@\w+)\b/)) {
        return searchAgent
      }
    }
    
    return null
  }

  private buildEnrichedPrompt(originalPrompt: string, agentResponse: any): string {
    const agentData = agentResponse.data
    
    // Handle search fallback cases naturally
    if (agentData.error === 'search_unavailable') {
      return `User question: "${originalPrompt}"

Context: ${agentData.fallbackResponse || "Internet search is currently unavailable, but I can help with information from my training data."}

Please answer the user's question using your existing knowledge. Be honest about any limitations regarding real-time information while still being as helpful as possible.`
    }
    
    let prompt = `User question: "${originalPrompt}"

CURRENT WEB DATA (just retrieved):
`

    // Concise direct answer if available
    if (agentData.answerBox?.answer) {
      prompt += `Quick answer: ${agentData.answerBox.answer}\n\n`
    }

    // Essential knowledge graph info
    if (agentData.knowledgeGraph?.description) {
      prompt += `Background: ${agentData.knowledgeGraph.description}\n\n`
    }

    // Detailed search results with comprehensive information
    if (agentData.results?.length > 0) {
      prompt += `Detailed search findings:\n\n`
      
      // Filter and use more results - different logic for news vs general search
      const allResults = agentData.results || [];
      const isNewsSearch = agentData.searchType === 'news';
      
      console.log(`📊 Processing ${isNewsSearch ? 'NEWS' : 'GENERAL'} search results: ${allResults.length} total`);
      
      let filteredResults;
      
      if (isNewsSearch) {
        // News results are already high-quality articles, minimal filtering needed
        filteredResults = allResults
          .filter((result: any) => {
            const snippet = result.snippet || '';
            // Only filter out very low-quality results
            return snippet.length > 30; // More lenient for news
          })
          .slice(0, 10); // More results for news (10 instead of 8)
        
        console.log(`📰 News search: Using ${filteredResults.length} news articles`);
      } else {
        // General search needs aggressive filtering for category pages
        filteredResults = allResults
          .filter((result: any) => {
            const url = result.url || result.link || '';
            const title = result.title || '';
            const snippet = result.snippet || '';
            
            // Skip obvious category/tag/topic pages and low-quality sources
            if (url.includes('/category/') || 
                url.includes('/tag/') || 
                url.includes('/topic/') ||
                url.includes('/categories/') ||
                url.includes('/tags/') ||
                url.includes('/topics/') ||
                url.endsWith('/') && url.split('/').length <= 4 || // Main domain pages
                title.toLowerCase().includes('latest news') && !title.includes('|') ||
                title.toLowerCase().includes('all articles') ||
                title.toLowerCase().includes('breaking news') && snippet.length < 100 ||
                snippet.length < 50 // Skip sources with very brief snippets
            ) {
              console.log(`🚫 Filtered out low-quality source: ${title} (${url})`);
              return false;
            }
            
            return true;
          })
          // Sort by content quality - prioritize longer, more detailed snippets
          .sort((a: any, b: any) => {
            const aSnippet = a.snippet || '';
            const bSnippet = b.snippet || '';
            const aHasDate = !!a.date;
            const bHasDate = !!b.date;
            
            // Prefer sources with dates (recent articles)
            if (aHasDate && !bHasDate) return -1;
            if (!aHasDate && bHasDate) return 1;
            
            // Prefer longer, more detailed snippets
            return bSnippet.length - aSnippet.length;
          })
          .slice(0, 8); // Standard limit for general search
        
        console.log(`� General search: ${allResults.length} total → ${filteredResults.length} quality sources selected`);
      }
      
      filteredResults.forEach((result: any, index: number) => {
        const sourceType = result.source ? `[${result.source}]` : '';
        console.log(`✅ Quality source ${index + 1}: ${result.title} ${sourceType} (snippet: ${(result.snippet || '').length} chars)`);
      });
      
      filteredResults.forEach((result: any, index: number) => {
        prompt += `SOURCE ${index + 1}: ${result.title}\n`
        prompt += `URL: ${result.url || result.link}\n`
        prompt += `Content: ${result.snippet}\n`
        if (result.date) prompt += `Published: ${result.date}\n`
        if (result.position) prompt += `Search rank: #${result.position}\n`
        
        // Add additional content if available
        if (result.content && result.content !== result.snippet) {
          prompt += `Extended info: ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}\n`
        }
        
        prompt += `[Reference ID: source_${index + 1}]\n\n`
      })
    }

    prompt += `Instructions: You have real-time internet data above. Use it naturally to answer the user's question. Be conversational and helpful - no need to mention "search results" or be overly technical about the data source. 

CRITICAL: Never wrap internet search information or responses containing search data in <CONCISE> tags or any other formatting tags. Internet search data should always be presented in full detail to provide comprehensive value to the user.

IMPORTANT for source attribution - Use ChatGPT-style clean citations:
- When referencing information, use clean, short domain/source names in links, NOT full article titles
- Extract the domain name or publication name from the URL and use that as the link text
- CRITICAL: Place citations at the END of sentences, right after the period
- Examples of CORRECT citation placement:
  • "Researchers at MIT have made a breakthrough using generative AI to design compounds that can combat drug-resistant bacteria. [MIT News](URL)"
  • "New AI models are impacting European markets. [Reuters](URL)"
  • "The technology shows promising results in clinical trials. [Nature](URL)"
- Examples of good citation formats:
  • [MIT News](https://news.mit.edu/...) 
  • [TechCrunch](https://techcrunch.com/...)  
  • [Reuters](https://reuters.com/...)
  • [WSJ](https://wsj.com/...) for Wall Street Journal articles
  • [BBC](https://bbc.com/...) for BBC articles
- Keep citation text short and clean - just the publication name
- Place citations naturally at the END of sentences where you use specific information
- Don't over-cite - only cite when you're directly using information from a specific source

Examples of the EXACT style to follow:
"Researchers are making significant strides in using generative AI to design compounds that can combat drug-resistant bacteria. [MIT News](URL) This breakthrough could potentially revolutionize how we approach antibiotic-resistant infections."
"There are also new methods being developed to test how well AI systems classify text. [MIT News](URL)"

CRITICAL SOURCE SELECTION RULES:
- ONLY cite sources that contain substantial, specific content and details about the topic
- PRIORITIZE sources with detailed articles, research findings, specific data, or in-depth reporting
- IGNORE and DO NOT CITE sources that are:
  * Category pages (URLs containing /category/, /tag/, /topic/)
  * Main domain pages without specific content
  * Generic "Latest News" or "All Articles" pages
  * Landing pages or navigation pages
  * Sources with only brief snippets or generic descriptions
- PREFER sources that offer:
  * Specific research findings or data
  * Detailed explanations or analysis
  * Quotes from experts or officials
  * Concrete examples or case studies
  * Technical details or specifications
- If a source only provides general information already covered by other sources, skip it
- Only cite sources that add unique, valuable, and substantial information to your response

When in doubt, ask yourself: "Does this source provide specific, detailed content that adds real value?" If not, don't cite it.

Just incorporate the information smoothly into your response with natural, clean citations using publication names placed at the end of sentences.

Timestamp: ${new Date().toLocaleString()}`

    return prompt
  }

  /**
   * Extract source information from agent data for source attribution
   */
  private extractSources(agentData: any): Array<{id: number, title: string, url: string, snippet: string, date?: string}> {
    if (!agentData?.results) return []
    
    // Filter and prioritize results - same logic as in buildEnrichedPrompt
    const results = agentData.results
      .filter((result: any) => {
        const url = result.url || result.link || '';
        const title = result.title || '';
        const snippet = result.snippet || '';
        
        // Skip obvious category/tag/topic pages and low-quality sources
        if (url.includes('/category/') || 
            url.includes('/tag/') || 
            url.includes('/topic/') ||
            url.includes('/categories/') ||
            url.includes('/tags/') ||
            url.includes('/topics/') ||
            url.endsWith('/') && url.split('/').length <= 4 || // Main domain pages
            title.toLowerCase().includes('latest news') && !title.includes('|') ||
            title.toLowerCase().includes('all articles') ||
            title.toLowerCase().includes('breaking news') && snippet.length < 100 ||
            snippet.length < 50 // Skip sources with very brief snippets
        ) {
          return false;
        }
        
        return true;
      })
      // Sort by content quality - prioritize longer, more detailed snippets
      .sort((a: any, b: any) => {
        const aSnippet = a.snippet || '';
        const bSnippet = b.snippet || '';
        const aHasDate = !!a.date;
        const bHasDate = !!b.date;
        
        // Prefer sources with dates (recent articles)
        if (aHasDate && !bHasDate) return -1;
        if (!aHasDate && bHasDate) return 1;
        
        // Prefer longer, more detailed snippets
        return bSnippet.length - aSnippet.length;
      })
      .slice(0, 8) // Increase from 5 to 8 to get more sources
      .map((result: any, index: number) => ({
        id: index + 1,
        title: result.title || 'Untitled',
        url: result.url || result.link || '#',
        snippet: result.snippet || '',
        date: result.date
      }));
    
    return results;
  }

  getAvailableModels(): string[] {
    return Array.from(this.models.keys())
  }

  getAvailableAgents(): { name: string; description: string }[] {
    return this.agents.map(agent => ({
      name: agent.name,
      description: agent.description
    }))
  }

  /**
   * Get current governance configuration
   */
  getGovernanceConfig() {
    return this.governance.getConfig()
  }

  /**
   * Update governance configuration
   */
  updateGovernanceConfig(config: any) {
    this.governance.updateConfig(config)
  }

  /**
   * Set governance mode
   */
  setGovernanceMode(mode: 'smart' | 'internal' | 'internet') {
    this.governance.updateConfig({ defaultMode: mode })
  }

  /**
   * Enable or disable governance
   */
  setGovernanceEnabled(enabled: boolean) {
    this.governance.updateConfig({ enableGovernance: enabled })
  }
}
