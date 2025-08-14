import axios from 'axios'
import { Agent, AgentResponse } from '@/types'
import config from '@/lib/config'

export class YouTubeAgent implements Agent {
  name = 'YouTube'
  description = 'Search and get information from YouTube videos'
  trigger = /@youtube|youtube|video about|find videos|watch.*video/i

  async run(input: string): Promise<AgentResponse> {
    try {
      if (!config.youtube.apiKey) {
        throw new Error('YouTube API key not configured')
      }

      // Extract search query
      const query = input.replace(/@youtube\s*/i, '').trim() || input

      const response = await axios.get(`${config.youtube.baseURL}/search`, {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: 5,
          key: config.youtube.apiKey,
        },
        timeout: 10000,
      })

      const videos = response.data.items || []
      const formattedVideos = videos.map((video: any) => ({
        id: video.id.videoId,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.medium.url,
        channelTitle: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      }))

      return {
        id: `youtube-${Date.now()}`,
        data: {
          query,
          videos: formattedVideos,
          totalResults: response.data.pageInfo?.totalResults || 0,
        },
        type: 'json',
        metadata: {
          source: 'youtube_api',
          timestamp: Date.now(),
          apiCost: 'low',
        }
      }
    } catch (error) {
      console.error('YouTube agent error:', error)
      
      // Fallback response
      return {
        id: `youtube-${Date.now()}`,
        data: {
          query: input,
          error: 'YouTube API unavailable',
          message: 'Unable to search YouTube videos. Please check your YouTube API configuration.',
          suggestion: `You can search for "${input}" directly on YouTube: https://www.youtube.com/results?search_query=${encodeURIComponent(input)}`
        },
        type: 'json',
        metadata: {
          source: 'youtube_fallback',
          timestamp: Date.now(),
          error: true,
        }
      }
    }
  }
}
