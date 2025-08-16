import axios from 'axios'
import { Agent, AgentResponse } from '@/types'
import config from '@/lib/config'

export class SearchAgent implements Agent {
  name = 'Internet Search'
  description = 'Search the internet for current information, real-time data, news, facts, prices, and any information that benefits from up-to-date sources'
  trigger = /@search|search for|find information|what\'s happening|latest news|current events|what time|current time|time in|what\'s the time|today\'s date|current date|weather today|stock price|latest|recent|now|currently|real-time|live|what\'s new|happening now|today|price|cost|value|worth|market|bitcoin|crypto|currency|company|business|news|update|status|available|trending|popular|best|top|who is|what is|where is|when did|how much|how many/i

  async run(input: string): Promise<AgentResponse> {
    try {
      if (!config.serper.apiKey) {
        throw new Error('Serper API key not configured')
      }

      // Smart query extraction and enhancement
      let query = input.replace(/@search\s*/i, '').trim() || input
      
      // Enhance query for better search results
      const lowerInput = input.toLowerCase()
      
      // For price/value queries, add current context
      if (lowerInput.match(/\b(price|cost|value|worth)\b/)) {
        if (!query.includes('current') && !query.includes('latest') && !query.includes('today')) {
          query = `current ${query}`
        }
      }
      
      // For cryptocurrency queries, ensure we get latest prices
      if (lowerInput.match(/\b(bitcoin|btc|ethereum|eth|crypto|cryptocurrency)\b/)) {
        if (lowerInput.includes('price')) {
          query = `${query} latest price today USD`
        }
      }
      
      // For company queries, add recent context
      if (lowerInput.match(/\b(company|business|startup|stock)\b/)) {
        if (!query.includes('news') && !query.includes('latest')) {
          query = `${query} latest news`
        }
      }
      
      // For general "what is" questions, enhance with current context
      if (lowerInput.startsWith('what is') || lowerInput.startsWith('who is')) {
        query = `${query} 2025 latest information`
      }

      const response = await axios.post(
        config.serper.baseURL,
        {
          q: query,
          num: 6, // Get more results for better information
        },
        {
          headers: {
            'X-API-KEY': config.serper.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      )

      const results = response.data.organic || []
      const answerBox = response.data.answerBox
      const knowledgeGraph = response.data.knowledgeGraph
      const sitelinks = response.data.sitelinks || []
      
      const formattedResults = results.map((result: any) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        date: result.date,
        position: result.position
      }))

      // Enhanced response data
      const searchData = {
        query,
        originalQuery: input,
        results: formattedResults,
        answerBox: answerBox ? {
          answer: answerBox.answer,
          snippet: answerBox.snippet,
          title: answerBox.title,
          link: answerBox.link
        } : null,
        knowledgeGraph: knowledgeGraph ? {
          title: knowledgeGraph.title,
          type: knowledgeGraph.type,
          description: knowledgeGraph.description,
          descriptionSource: knowledgeGraph.descriptionSource,
          attributes: knowledgeGraph.attributes
        } : null,
        sitelinks: sitelinks.slice(0, 3),
        searchEngine: 'Google',
        totalResults: response.data.searchInformation?.totalResults || 0,
        searchTime: response.data.searchInformation?.searchTime || 0
      }

      return {
        id: `search-${Date.now()}`,
        data: searchData,
        type: 'json',
        metadata: {
          source: 'serper_api',
          timestamp: Date.now(),
          apiCost: 'low',
          enhanced: true
        }
      }
    } catch (error) {
      console.error('Search agent error:', error)
      
      // Fallback response
      return {
        id: `search-${Date.now()}`,
        data: {
          query: input,
          error: 'Search service unavailable',
          message: 'Unable to perform web search. Please check your Serper API configuration.',
        },
        type: 'json',
        metadata: {
          source: 'search_fallback',
          timestamp: Date.now(),
          error: true,
        }
      }
    }
  }
}
