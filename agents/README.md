# Agent Architecture Documentation

## Overview
LayerChat uses a modular agent system where each agent is responsible for a specific type of functionality. This architecture provides better maintainability, easier testing, and cleaner code organization.

## Agent Structure

### Core Files
- `agents/index.ts` - Main export file that re-exports all agents
- `agents/modules/search.ts` - SearchAgent for web search functionality
- `agents/modules/time.ts` - TimeAgent for time and date queries
- `agents/modules/weather.ts` - WeatherAgent for weather information
- `agents/modules/youtube.ts` - YouTubeAgent for YouTube video search
- `agents/modules/math.ts` - MathAgent for mathematical calculations

### Agent Interface
Each agent implements the `Agent` interface from `@/types`:
```typescript
interface Agent {
  name: string
  description: string
  trigger: RegExp
  run(input: string): Promise<AgentResponse>
}
```

## Individual Agents

### SearchAgent (`agents/modules/search.ts`)
- **Purpose**: Web search using Serper API
- **Triggers**: Search queries, current events, prices, company info
- **Features**: Smart query enhancement, crypto prices, company news
- **API**: Serper Google Search API

### TimeAgent (`agents/modules/time.ts`)
- **Purpose**: Time and date information for any location
- **Triggers**: Time queries, timezone requests
- **Features**: WorldTimeAPI integration, timezone mapping, fallback
- **API**: WorldTimeAPI (free service)

### WeatherAgent (`agents/modules/weather.ts`)
- **Purpose**: Weather conditions and forecasts
- **Triggers**: Weather queries, temperature requests
- **Features**: Current conditions, 3-day forecast, location parsing
- **API**: wttr.in (free weather service)

### YouTubeAgent (`agents/modules/youtube.ts`)
- **Purpose**: YouTube video search and information
- **Triggers**: YouTube queries, video searches
- **Features**: Video metadata, thumbnails, channel information
- **API**: YouTube Data API v3

### MathAgent (`agents/modules/math.ts`)
- **Purpose**: Mathematical calculations and equations
- **Triggers**: Math expressions, calculations
- **Features**: Safe evaluation, percentages, basic functions
- **API**: None (pure JavaScript calculations)

## Benefits of Modular Architecture

### Maintainability
- Each agent is in its own file (100-200 lines vs 600+ line monolith)
- Easier to locate and fix bugs in specific functionality
- Clear separation of concerns

### Scalability
- Easy to add new agents without affecting existing ones
- Simple to modify individual agent behavior
- Clean import/export structure

### Testing
- Each agent can be tested independently
- Easier to mock dependencies for unit tests
- Isolated error handling per agent

### Team Collaboration
- Multiple developers can work on different agents simultaneously
- Reduced merge conflicts
- Clear ownership of functionality

## Usage
The orchestrator in `lib/orchestrator.ts` imports all agents from the main index file:
```typescript
import { SearchAgent, TimeAgent, WeatherAgent, YouTubeAgent, MathAgent } from '@/agents'
```

All agents are instantiated and managed centrally, maintaining the same external API while benefiting from the modular internal structure.

## Production Benefits
- **Smaller bundles**: Only used agents can be tree-shaken
- **Better error isolation**: Agent failures don't affect others
- **Easier monitoring**: Individual agent performance tracking
- **Simpler deployment**: Individual agents can be updated independently
