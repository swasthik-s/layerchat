# LayerChat - Multi-Model AI Assistant

LayerChat is a sophisticated ChatGPT-style AI web application that supports multiple AI models, specialized agents, and multi-modal content generation.

## 🚀 Features Implemented

### ✅ **Core Features**
- **ChatGPT-Style UI** - Dark mode, responsive design, mobile-friendly
- **Real-time Streaming** - Live token-by-token responses
- **Multi-Model Support** - GPT-4, Claude-3, Gemini Pro, DALL-E 3
- **Multi-Agent System** - Search, YouTube, Math, Weather agents
- **File Upload** - Support for images, documents, and media files
- **Chat History** - Persistent sessions with Zustand store
- **State Management** - Global state with localStorage persistence

### 🤖 **AI Models**
- **GPT-4** (OpenAI) - Advanced text generation with streaming
- **Claude-3-Sonnet** (Anthropic) - High-quality reasoning with streaming
- **Gemini Pro** (Google) - Fast and capable text generation
- **DALL-E 3** (OpenAI) - High-quality image generation

### 🔧 **Agents**
- **Internet Search** - Real-time web search using Serper API
- **YouTube** - Video search and information retrieval
- **Math Solver** - Advanced mathematical calculations
- **Weather** - Location-based weather information

### 🎯 **Agent Triggers**
- **Explicit**: Use @mentions like `@search latest AI news`
- **Automatic**: Keywords trigger agents automatically
  - "search for", "calculate", "weather in", "find videos"

### 💻 **Technical Stack**
- **Frontend**: Next.js 15.4, React 19, Tailwind CSS v3
- **UI Components**: shadcn/ui with Radix UI primitives
- **State Management**: Zustand with persistence
- **AI SDKs**: OpenAI, Anthropic, Google AI, Axios
- **File Handling**: Formidable, UUID for unique filenames
- **Notifications**: react-hot-toast
- **Package Manager**: Bun (faster than npm)

## 🛠️ **Setup Instructions**

### 1. **Environment Configuration**
Copy `.env.example` to `.env.local` and add your API keys:

```bash
# AI Provider API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# External APIs
SERPER_API_KEY=your_serper_api_key_for_search
YOUTUBE_API_KEY=your_youtube_api_key

# Database (Optional - for user accounts)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. **Get API Keys**

#### OpenAI (Required for GPT-4, DALL-E 3)
1. Go to [OpenAI API](https://platform.openai.com/api-keys)
2. Create an account and get API key
3. Add billing information for API access

#### Anthropic (Optional - for Claude)
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create account and get API key

#### Google AI (Optional - for Gemini)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Get free API key

#### Serper (Optional - for web search)
1. Go to [Serper.dev](https://serper.dev/)
2. Get free API key (2,500 searches/month)

#### YouTube API (Optional - for video search)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create API key

### 3. **Installation & Development**

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start
```

## 🎮 **Usage Examples**

### Basic Chat
```
Hello! How can you help me today?
```

### Web Search (Auto-triggered)
```
What's the latest news about AI developments?
search for recent breakthroughs in machine learning
```

### Explicit Agent Usage
```
@search latest OpenAI updates
@youtube tutorials for Next.js
@math calculate the compound interest for $1000 at 5% for 10 years
```

### Math Calculations (Auto-triggered)
```
What's 25% of 450?
Calculate 2^10
What's the square root of 144?
solve 3x + 5 = 20
```

### Image Generation
```
Generate a beautiful sunset over mountains
Create a logo for a tech startup
```

### File Upload
- Drag and drop files or click the paperclip icon
- Supports images, videos, documents, PDFs
- Files are automatically processed by compatible models

## 📁 **Project Structure**

```
├── app/
│   ├── api/
│   │   ├── chat/              # Chat API endpoints
│   │   │   ├── route.ts       # Regular chat API
│   │   │   └── stream/        # Streaming chat API
│   │   └── upload/            # File upload API
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main chat interface
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── chat.tsx               # Main chat component
│   ├── chat-input.tsx         # Input with file upload
│   ├── chat-message.tsx       # Message rendering
│   ├── header.tsx             # Top header
│   └── sidebar.tsx            # Left sidebar
├── hooks/
│   └── useStreamingChat.ts    # Custom streaming hook
├── lib/
│   ├── config.ts              # Environment configuration
│   ├── store.ts               # Zustand global state
│   └── utils.ts               # Utility functions
├── models/
│   └── index.ts               # AI model implementations
├── agents/
│   └── index.ts               # Agent implementations
├── orchestrator/
│   └── index.ts               # Central coordination logic
└── types/
    └── index.ts               # TypeScript interfaces
```

## 🔧 **Configuration**

### Model Settings
- **Temperature**: 0.0 (deterministic) to 1.0 (creative)
- **Max Tokens**: Up to 4000 tokens per response
- **Streaming**: Real-time token-by-token responses
- **Auto Agents**: Automatic agent detection and calling

### File Upload Limits
- **Max Size**: 10MB per file
- **Allowed Types**: Images, videos, documents, PDFs, text files
- **Multiple Files**: Upload multiple files per message

## 🚧 **Roadmap / Next Steps**

### Database Integration
- [ ] Supabase setup for user accounts
- [ ] Cloud chat history storage
- [ ] User authentication

### Enhanced Features
- [ ] Voice input/output
- [ ] Conversation export
- [ ] Custom agent creation
- [ ] Model fine-tuning integration
- [ ] Advanced file processing (OCR, document analysis)

### Performance
- [ ] Response caching
- [ ] Rate limiting
- [ ] Cost optimization
- [ ] Model load balancing

## 🎯 **Current Status**

✅ **Fully Functional**
- Multi-model chat with streaming
- Agent system with real APIs
- File upload and processing
- Chat history and state management
- Responsive UI with dark mode

⚠️ **Requires API Keys**
- Add your API keys to `.env.local` for full functionality
- Without API keys, the app will show placeholder responses

🔧 **Production Ready**
- Clean, typed codebase
- Error handling and fallbacks
- Mobile-responsive design
- Optimized for performance

---

**LayerChat** - Built with ❤️ using Next.js 15, React 19, and the latest AI SDKs.
"# layerchat" 
