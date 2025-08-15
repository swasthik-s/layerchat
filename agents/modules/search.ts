import axios from 'axios'
import { Agent, AgentResponse } from '@/types'
import config from '@/lib/config'

// Smart search type detection
function determineSearchType(input: string, query: string): 'news' | 'general' {
  const lowerInput = input.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Explicit news keywords
  const newsKeywords = [
    'news', 'latest', 'recent', 'breaking', 'update', 'updates', 'announcement', 
    'announced', 'report', 'reports', 'today', 'yesterday', 'this week', 
    'happening', 'development', 'developments', 'current events', 'story',
    'coverage', 'press release', 'statement', 'unveil', 'launch', 'launched',
    'partnership', 'funding', 'investment', 'merger', 'acquisition'
  ];
  
  // Time-sensitive words that suggest news
  const timeKeywords = [
    'now', 'currently', 'just', 'recently', 'today', 'this month', 'this year',
    '2025', 'new', 'fresh', 'hot', 'trending', 'viral', 'popular'
  ];
  
  // Check for explicit news requests
  for (const keyword of newsKeywords) {
    if (lowerInput.includes(keyword) || lowerQuery.includes(keyword)) {
      return 'news';
    }
  }
  
  // Check for time-sensitive requests combined with topics
  const hasTimeKeyword = timeKeywords.some(keyword => 
    lowerInput.includes(keyword) || lowerQuery.includes(keyword)
  );
  
  // Topics that are often searched as news
  const newsTopics = [
    'ai', 'artificial intelligence', 'technology', 'tech', 'startup', 'company',
    'market', 'stock', 'crypto', 'bitcoin', 'politics', 'election', 'economy',
    'research', 'study', 'breakthrough', 'discovery', 'innovation', 'release'
  ];
  
  if (hasTimeKeyword) {
    for (const topic of newsTopics) {
      if (lowerInput.includes(topic) || lowerQuery.includes(topic)) {
        return 'news';
      }
    }
  }
  
  // Default to general search for definitions, explanations, etc.
  if (lowerInput.startsWith('what is') || 
      lowerInput.startsWith('how to') || 
      lowerInput.startsWith('explain') ||
      lowerInput.includes('definition') ||
      lowerInput.includes('meaning')) {
    return 'general';
  }
  
  return 'general';
}

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

      // Smart detection of search type
      const searchType = determineSearchType(lowerInput, query);
      console.log(`🔍 Search type determined: ${searchType} for query: "${query}"`);

      const searchPayload: any = {
        q: query,
        num: searchType === 'news' ? 10 : 6, // More results for news
      };

      // Add type parameter for news searches
      if (searchType === 'news') {
        searchPayload.type = 'news';
        searchPayload.tbs = 'qdr:w'; // Past week for fresh news
      }

      const response = await axios.post(
        config.serper.baseURL,
        searchPayload,
        {
          headers: {
            'X-API-KEY': config.serper.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      )

      // Handle different response structures based on search type
      const results = searchType === 'news' ? (response.data.news || []) : (response.data.organic || []);
      const answerBox = response.data.answerBox
      const knowledgeGraph = response.data.knowledgeGraph
      const sitelinks = response.data.sitelinks || []
      
      const formattedResults = results.map((result: any) => ({
        title: result.title,
        url: result.link || result.url, // News results use 'link', organic results might use 'url'
        snippet: result.snippet,
        date: result.date,
        position: result.position,
        source: result.source // News results include source field
      }))

      // Debug: Log the URLs we're getting from Serper
      console.log('🔍 Serper URLs received:');
      formattedResults.forEach((result: any, index: number) => {
        console.log(`  ${index + 1}. ${result.url}`);
      });

      // Enhanced response data
      const searchData = {
        query,
        originalQuery: input,
        results: formattedResults,
        searchType, // Add search type information
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
        searchEndpoint: searchType === 'news' ? 'News' : 'Web', // Indicate which endpoint was used
        totalResults: response.data.searchInformation?.totalResults || formattedResults.length,
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
      
      // More natural fallback response with helpful context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isApiKeyError = errorMessage.includes('API key') || errorMessage.includes('apiKey')
      
      return {
        id: `search-${Date.now()}`,
        data: {
          query: input,
          fallbackResponse: isApiKeyError 
            ? "I need a Serper API key to search the internet. Without it, I can only work with information from my training data."
            : "I'm having trouble accessing current web information right now. I'll do my best to help with what I know from my training data.",
          canUseTrainingData: true,
          error: 'search_unavailable'
        },
        type: 'json',
        metadata: {
          source: 'search_fallback',
          timestamp: Date.now(),
          error: true,
          fallback: true
        }
      }
    }
  }
}
