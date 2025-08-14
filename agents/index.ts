// Modular Agent System - Clean imports from separate files
export { SearchAgent } from '@/agents/modules/search'
export { TimeAgent } from '@/agents/modules/time'
export { WeatherAgent } from '@/agents/modules/weather'
export { YouTubeAgent } from '@/agents/modules/youtube'
export { MathAgent } from '@/agents/modules/math'

// Re-export types for convenience
export type { Agent, AgentResponse } from '@/types'
