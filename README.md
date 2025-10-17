# Task Chat

An AI-powered Obsidian plugin that enables you to chat with your tasks. Filter tasks by text, folders, priority, due date, completion status, and more. Get AI recommendations and navigate directly to tasks in your notes.

## ⚡ Three Chat Modes

Choose the mode that fits your needs. Set your default in settings, override per-query in chat:

| Mode | AI Usage | Cost | Best For |
|------|----------|------|----------|
| **🚀 Simple Search** | None | $0 | Quick searches, free operation |
| **🧠 Smart Search** | Keyword expansion | ~$0.0001 | Multilingual, broader results |
| **💬 Task Chat** | Full AI assistant | ~$0.0021 | AI insights, prioritization |

**Default**: Simple Search (free). Switch anytime using the dropdown in chat interface.

## Features

### 🤖 AI-Powered Task Analysis
- **Intelligent Chat Interface**: Natural language conversations about your tasks
- **Multiple AI Providers**: Choose from OpenAI, Anthropic, OpenRouter, or Ollama (local)
- **Smart Response Generation**: Context-aware recommendations based on your actual tasks
- **Temperature Control**: Adjust AI creativity/consistency (0.0-2.0)
- **Custom System Prompts**: Tailor AI assistant behavior to your needs

### 🔍 Three Chat Modes
Choose the mode that fits your needs. Set your default in settings, override per-query:

- **Simple Search** (Default, Free): Fast regex-based keyword search
  - No AI usage, always $0
  - Perfect for quick searches and simple filters
  - Stop word removal for better accuracy
  
- **Smart Search** (AI Keyword Expansion, ~$0.0001): Enhanced semantic search
  - AI expands keywords into multilingual synonyms
  - Cross-language task matching
  - Direct results (no AI analysis)
  - Best for multilingual and broader searches
  
- **Task Chat** (Full AI Assistant, ~$0.0021): Complete AI experience
  - AI keyword expansion + Analysis + Recommendations
  - Context-aware prioritization
  - Conversational insights
  - Best for complex queries and task prioritization

### 📊 Comprehensive Task Filtering
- **Text Search**: Semantic keyword matching across task content
- **Priority Filtering**: Filter by priority levels (1-4)
  - Customizable priority mapping (Todoist-style)
  - Support for emoji indicators (⏫ 🔼 🔽) and text values
- **Due Date Filtering**: 
  - Relative dates: today, tomorrow, overdue, future
  - Date ranges: this week, next week, this month
  - Specific dates: YYYY-MM-DD format
  - "Any due date" filter for tasks with deadlines
- **Status Filtering**: 
  - Open/incomplete tasks
  - Completed tasks
  - In-progress tasks
  - Cancelled tasks
- **Folder Filtering**: Path-based filtering with partial matches
- **Tag Filtering**: Hashtag-based filtering (#work, #personal)
- **Compound Filtering**: Combine multiple filters simultaneously
  - Example: "high priority overdue tasks in project folder with #urgent tag"

### 🎯 Task Display & Sorting
- **Multi-Criteria Sorting**: Tasks are sorted by multiple criteria in sequence
  - Primary sort applied first, secondary for ties, tertiary for further ties
  - Separate configurations for display vs. AI context
  - Fully customizable order per mode (Simple/Smart/Chat)
  - **Smart Internal Defaults**:
    - **Relevance**: Best matches first (score 100 → 0)
    - **Priority**: Highest first (1 → 2 → 3 → 4, where 1 maps to "high", "urgent", etc.)
    - **Due Date**: Most urgent first (overdue → today → future; no date = last)
    - **Created Date**: Newest first (recent tasks → older tasks)
    - **Alphabetical**: Natural A → Z order
  - **Auto Mode**: Intelligently picks relevance or due date based on query type
  - Default for Simple/Smart: Relevance → Due Date → Priority
  - Default for Chat Display: Auto → Relevance → Due Date → Priority  
  - Default for Chat AI Context: Relevance → Due Date → Priority
- **Configurable Result Limits**:
  - Max Direct Results (default: 20): No-cost instant results
  - Max Tasks for AI (default: 30): Context for AI analysis
  - Max Recommendations (default: 20): Final curated list
- **Task Navigation**: One-click navigation to task location in notes
  - Preserves line numbers
  - Opens source file automatically
  - Works across all vault folders

### 💬 Session Management
- **Multiple Chat Sessions**: Create and switch between different conversations
- **Session History**: All messages preserved with timestamps
- **Session Switching**: Quick access to previous conversations
- **Session Deletion**: Clean up old conversations
- **Auto-save**: Sessions saved automatically

### 🌍 Multilingual Support
- **Query Languages**: Configure supported languages for semantic search
- **Response Language**: Control AI response language
  - Auto: Match user's query language
  - Fixed: Always use English or Chinese
  - Custom: Define your own language instruction
- **Cross-language Matching**: Find tasks in any configured language
  - Query in English, find Chinese tasks
  - Query in Chinese, find English tasks

### 💰 Cost Tracking & Optimization
- **Real-time Token Usage**: See token count for every AI interaction
- **Cost Estimation**: Accurate cost calculation per query
  - Different pricing for input vs output tokens
  - Provider-specific rates (OpenAI, Anthropic, OpenRouter)
  - Automatic pricing updates from OpenRouter API
- **Cumulative Tracking**: Total tokens and costs across all sessions
- **Transparent Display**: See exactly when and why AI is used
  - Direct search indicators (no cost)
  - AI analysis indicators (with cost breakdown)
  - Explanation of why each method was chosen

### 🔄 Real-time Integration
- **Auto-refresh**: Tasks update automatically when notes change
- **Debounced Updates**: Intelligent update batching to prevent performance issues
- **DataView Integration**: Seamless integration with DataView plugin
  - Supports inline fields: `[due::2025-01-20]`
  - Supports emoji indicators: `📅 2025-01-20`
  - Customizable field mapping

### ⚙️ Extensive Configuration
- **Provider-specific API Keys**: Separate keys for each AI service
- **Model Selection**: Choose from available models per provider
  - Auto-loads available models on startup
  - Caches model list for quick access
- **Custom API Endpoints**: Use custom endpoints or proxies
- **Task Status Mapping**: Customize how task statuses are recognized
  - Default: Tasks plugin compatible
  - Fully customizable status symbols
- **Priority Mapping**: Define your own priority value mappings
  - Map any text value to priority levels 1-4
  - Support for multilingual priority values
- **Date Format Configuration**: Customize date display formats

### 🎨 User Interface
- **Modern Chat UI**: Clean, intuitive chat interface
- **Copy to Clipboard**: Copy any message with one click
- **Typing Indicators**: Visual feedback during AI processing
- **Filter Status Display**: See active filters at a glance
- **Token Usage Display**: Optional cost information below responses
- **Theme Support**: Integrates with Obsidian themes
- **Responsive Design**: Works in sidebars and main panes

## Quick Start Guide

### Opening Task Chat

- Click the chat icon in the left ribbon, or
- Use the command palette: "Task Chat: Open Task Chat"

### Chat Interface Controls

The chat interface has controls grouped into sections:

**Group 1: Session Management**
- **+ New**: Create a new chat session
- **Sessions**: View and switch between sessions

**Group 2: Chat Mode**
- **Chat mode dropdown**: Override the default chat mode per-query
  - **Simple Search**: Free keyword search (no AI)
  - **Smart Search**: AI keyword expansion (~$0.0001/query)
  - **Task Chat**: Full AI assistant (~$0.0021/query)
  - Selection overrides your default for the current query only

**Group 3: Task Management**
- **Filter tasks**: Open filter modal to narrow down tasks
- **Refresh tasks**: Reload tasks from vault

**Group 4: Cleanup**
- **Clear chat**: Clear current session's messages

### Basic Usage

**1. Start a Conversation**

1. **Choose chat mode** (dropdown in controls bar):
   - Uses your default from settings, or override for this query
   - **Simple Search**: Free, instant results
   - **Smart Search**: AI-enhanced keyword matching
   - **Task Chat**: Full AI analysis and recommendations
2. Click "Filter tasks" to select which tasks to focus on (optional)
3. Type your question or request in the chat input
4. Press Cmd/Ctrl+Enter to send
5. Click the → button next to recommended tasks to navigate to them
   - Opens the file and jumps to the task line
   - Works even in nested folders

**4. Manage Sessions**
- Click "+ New" to start a fresh conversation
- Click "Sessions" to view and switch between chat histories
- Each session preserves its own conversation context

### Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| **Send Message** | `Cmd/Ctrl + Enter` | Send your query to AI |
| **Task Chat: Open Task Chat** | - | Open the chat interface |
| **Task Chat: Refresh tasks** | - | Manually refresh task list |

### Example Queries

**Simple Search Mode** ($0)
- `"priority 1"` → Shows all high priority tasks
- `"due today"` → Shows tasks due today
- `"overdue"` → Shows past-due tasks
- `"#work"` → Shows tasks with #work tag
- `"bug fix"` → Keyword search (stop words removed)

**Smart Search Mode** (~$0.0001)
- `"urgent meeting"` → AI expands to ["urgent", "紧急", "meeting", "会议"]
- `"开发任务"` → Finds tasks in any language
- `"fix bug"` → AI finds synonyms: repair, resolve, debug
- `"priority 1 due today"` → AI parsing + direct results

**Task Chat Mode** (~$0.0021)
- `"What should I focus on today?"` → AI recommends with explanations
- `"Which tasks are most urgent?"` → AI analyzes and prioritizes
- `"Help me plan my week"` → Comprehensive AI insights
- `"What's blocking my progress?"` → Contextual analysis

## How the Three Chat Modes Work

Task Chat offers three distinct chat modes, each with **predictable behavior and costs**. Set your default in settings, override per-query in chat:

### 🚀 Simple Search (Default, Free)

**No AI, always $0**

```
Your Query → Regex Parsing → Task Filtering → Direct Results
```

**How it works:**
1. **Query Parsing**: Pattern matching extracts filters and keywords
2. **Stop Word Removal**: Removes "the", "a", "how", "what", etc.
3. **Task Filtering**: Applies filters (priority, due date, tags, etc.)
4. **Direct Results**: Displays filtered and sorted tasks

**Examples:**
- `"priority 1"` → Finds all priority 1 tasks
- `"due today"` → Finds tasks due today
- `"#work"` → Finds tasks with #work tag
- `"bug fix"` → Searches for "bug" and "fix" (removes stop words)

**When to use:**
- ✅ Quick searches and simple filters
- ✅ When you want instant, free results
- ✅ When you know exactly what you're looking for

**Cost:** Always $0

---

### 🧠 Smart Search (AI Keyword Expansion, ~$0.0001)

**AI expands keywords, direct results**

```
Your Query → AI Parsing → Keyword Expansion → Task Filtering → Direct Results
```

**How it works:**
1. **AI Query Parsing**: AI extracts filters and keywords
2. **Keyword Expansion**: AI generates multilingual synonyms
   - "urgent" → ["urgent", "紧急", "critical", "high-priority"]
   - "meeting" → ["meeting", "会议", "reunion", "conference"]
3. **Task Filtering**: Matches expanded keywords across all languages
4. **Direct Results**: Displays filtered and sorted tasks (no AI analysis)

**Examples:**
- `"urgent meeting"` → Expands to multilingual synonyms, finds more results
- `"开发任务"` → Finds tasks in English and Chinese
- `"fix bug"` → Expands to "repair", "resolve", "debug"

**When to use:**
- ✅ Multilingual task searches
- ✅ When you want broader, more comprehensive results
- ✅ When simple keyword matching is too narrow

**Cost:** ~$0.0001 per query (~250 tokens)

---

### 💬 Task Chat (Full AI Assistant, ~$0.0021)

**AI keyword expansion + analysis + recommendations**

```
Your Query → AI Parsing → Keyword Expansion → Task Filtering → AI Analysis → Recommendations
```

**How it works:**
1. **AI Query Parsing**: AI extracts filters and keywords
2. **Keyword Expansion**: AI generates multilingual synonyms
3. **Task Filtering**: Matches expanded keywords
4. **AI Analysis**: AI analyzes filtered tasks for context and priority
5. **Recommendations**: AI provides ranked recommendations with explanations

**Examples:**
- `"What should I focus on today?"` → AI recommends top priorities
- `"Which tasks are most urgent?"` → AI analyzes and ranks by urgency
- `"Help me plan my week"` → AI provides strategic insights

**When to use:**
- ✅ Complex questions about your tasks
- ✅ When you want AI recommendations and prioritization
- ✅ When you need insights, not just a list

**Cost:** ~$0.0021 per query (~1,000-1,500 tokens)

---

### 📊 Mode Comparison

| Feature | Simple Search | Smart Search | Task Chat |
|---------|--------------|--------------|-----------|
| **Query Parsing** | Regex | AI | AI |
| **Keyword Expansion** | No | Yes (multilingual) | Yes (multilingual) |
| **AI Analysis** | No | No | Yes |
| **Recommendations** | No | No | Yes |
| **Cost** | $0 | ~$0.0001 | ~$0.0021 |
| **Speed** | Instant | 1-2 sec | 2-3 sec |
| **Best For** | Quick searches | Multilingual | AI insights |

---

### 💰 Cost Examples

**Daily Usage Scenarios:**

**Scenario 1: Free User (Simple Search only)**
- 50 queries/day
- Daily cost: **$0**
- Monthly cost: **$0**

**Scenario 2: Mixed User**
- 30 Simple Search (free)
- 15 Smart Search (~$0.0015)
- 5 Task Chat (~$0.0105)
- Daily cost: **~$0.012**
- Monthly cost: **~$0.36**

**Scenario 3: Power User**
- 50 Task Chat queries/day
- Daily cost: **~$0.105**
- Monthly cost: **~$3.15**

---

### 🎯 Best Practices

**Choosing the Right Mode:**
- Use **Simple Search** for: `"priority 1"`, `"due today"`, `"#work"`
- Use **Smart Search** for: `"urgent meeting"`, `"开发任务"`, `"fix bug"`
- Use **Task Chat** for: `"What's urgent?"`, `"Plan my week"`, `"Top priorities?"`

**Cost Optimization:**
1. Default to **Simple Search** for most queries
2. Switch to **Smart Search** when you need multilingual/broader results
3. Reserve **Task Chat** for when you want AI insights

**Understanding Token Usage:**
Every response shows which mode was used:
- `📊 Mode: Simple Search • $0`
- `📊 Mode: Smart Search • 250 tokens • ~$0.0001`
- `📊 Mode: Task Chat • 1,234 tokens • ~$0.0021`

## Requirements

- **Obsidian** v1.0.0 or higher
- **DataView plugin** (required for task access)
- **API Key** for your chosen AI provider (not needed for Ollama)

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Task Chat"
4. Click Install, then Enable

### Manual Installation

1. Download the latest release from the [Releases](https://github.com/wenlzhang/obsidian-task-chat/releases) page
2. Extract the files to your vault's `.obsidian/plugins/task-chat/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Setup

### Prerequisites
1. **Install DataView Plugin** (Required)
   - Go to Settings → Community Plugins
   - Search for "DataView"
   - Install and enable it

### Initial Configuration
1. Open Task Chat settings (Settings → Task Chat)
2. **Configure AI Provider**:
   - Select your provider (OpenAI, Anthropic, OpenRouter, or Ollama)
   - Enter your API key (not needed for Ollama)
   - Choose your preferred model
3. **Optional: Customize Settings**
   - DataView field mappings (match your task format)
   - Query languages (for multilingual support)
   - Response language preference
   - Max result limits (optimize cost vs. completeness)

### Getting an API Key

**OpenAI**
- Visit: https://platform.openai.com/api-keys
- Create new secret key
- Recommended model: `gpt-4o-mini` (cheap, fast)

**Anthropic**
- Visit: https://console.anthropic.com/account/keys
- Create new API key
- Recommended model: `claude-3-5-sonnet-20241022`

**OpenRouter**
- Visit: https://openrouter.ai/keys
- Create new API key
- Access to multiple models with single key
- Recommended: Various models available

**Ollama (Free, Local)**
- Install Ollama: https://ollama.com
- Run: `ollama serve`
- No API key needed, runs locally
- Recommended model: `llama3.2`

## Configuration

### AI Provider Settings

- **AI Provider**: Choose between OpenAI, Anthropic, OpenRouter, or Ollama
- **API Key**: Your provider's API key (provider-specific)
  - OpenAI Key, Anthropic Key, OpenRouter Key stored separately
  - Ollama: No key required (local)
- **Model**: Model name (auto-populated dropdown)
  - OpenAI: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
  - Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus`
  - OpenRouter: Various models from multiple providers
  - Ollama: Local models (llama3.2, etc.)
- **API Endpoint**: Custom API endpoint URL (auto-filled, customizable)
- **Temperature**: AI creativity (0.0-2.0, default: 0.1)
  - Lower = more consistent, deterministic
  - Higher = more creative, varied

### Chat Settings

- **Max Chat History**: Number of messages to keep (default: 50)
  - Controls memory usage
  - Only recent messages sent to AI for context
- **Show Task Count**: Display task count in filter status banner
- **Show Token Usage**: Display cost and token information below responses
  - Shows prompt/completion tokens
  - Estimated cost per query
  - Cumulative usage tracking
- **Auto-open Sidebar**: Open Task Chat automatically on startup
- **System Prompt**: Customize the AI assistant's behavior
  - Default: Focus on existing tasks, be concise
  - Customize for your workflow

### Query & Search Settings

**🔑 Three Chat Modes (Default + Per-Query Override)**

Task Chat offers three modes with **predictable behavior and costs**. The **default chat mode** (configured in settings) is used for all new sessions. You can override it per-query using the dropdown in the chat interface:

```
┌──────────────────────────────────────────────────┐
│ Simple Search (Default) - Free                   │
├──────────────────────────────────────────────────┤
│ • Regex parsing, no AI                           │
│ • Always $0                                      │
│ • Instant results                                │
│ • Best for: Quick searches, cost-free operation  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Smart Search - AI Keyword Expansion (~$0.0001)   │
├──────────────────────────────────────────────────┤
│ • AI expands keywords to multilingual synonyms   │
│ • Direct results (no AI analysis)                │
│ • ~250 tokens per query                          │
│ • Best for: Multilingual, broader results        │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Task Chat - Full AI Assistant (~$0.0021)         │
├──────────────────────────────────────────────────┤
│ • AI keyword expansion + analysis + insights     │
│ • Ranked recommendations with explanations       │
│ • ~1,000-1,500 tokens per query                  │
│ • Best for: Complex queries, AI prioritization   │
└──────────────────────────────────────────────────┘
```

**How to Configure:**
- **Default mode**: Settings → Task Chat → **Default chat mode**
  - Select: Simple Search (free) | Smart Search (AI keywords) | Task Chat (full AI)
  - This applies to all new sessions
- **Per-query override**: Use dropdown in chat interface (top controls)
  - Changes mode for current query only
  - Doesn't change your default setting

**Mode-Specific Features:**
- **Simple Search**: Free, instant, no AI
- **Smart Search**: Multilingual keyword expansion, direct results
- **Task Chat**: AI analysis, recommendations, "Auto" sorting mode available

---

**Search Optimization Settings**

- **Max Direct Results** (default: 20)
  - Controls how many results to show for Simple/Smart Search modes
  - Task Chat mode analyzes up to this many tasks
  - Range: 5-100 tasks

- **Max Tasks for AI** (default: 30)
  - Only affects Task Chat mode
  - Controls how many tasks AI analyzes
  - Higher = more context for AI, higher token cost
  - Lower = faster, cheaper responses

- **Max Recommendations** (default: 20)
  - Only affects Task Chat mode
  - Final curated list size after AI analysis
  - Keep manageable for user review

---

**Language Settings**

- **Query Languages** (default: English, 中文)
  - Used by Smart Search and Task Chat modes for keyword expansion
  - Simple Search mode doesn't use this (regex-based)
  - Add your languages for better multilingual matching
  - Example: English, Español, 中文, 日本語

- **Response Language** (AI response preference)
  - Only affects Task Chat mode (only mode with AI responses)
  - Auto: Match query language automatically
  - English: Always respond in English
  - Chinese: Always respond in Chinese (中文)
  - Custom: Define your own language instruction

### Task Display Settings

**Sorting Options**
- **Task Sort By**: Field to sort tasks by
  - **Auto (AI-driven)** - ⭐ Only available in Task Chat mode
    - **Availability**: Only shown when default chat mode is set to "Task Chat"
    - AI intelligently chooses sorting based on query type
      - Keyword searches → Relevance sorting
      - Other queries → Due Date sorting
    - Best for: Task Chat mode users who want smart AI-driven sorting
  - **Relevance**: Keyword match quality score (works when query has keywords)
    - Scores tasks based on how well they match your search keywords
    - Works in all three modes
    - Best for: Finding most relevant tasks in keyword searches
  - **Due Date**: Sort by deadline
    - Best for: Time-sensitive task management
  - **Priority**: Sort by priority level (1-4)
    - Best for: Importance-based workflows
  - **Created Date**: Sort by creation time
    - Best for: Chronological task tracking
  - **Alphabetical**: Sort by task text
    - Best for: Organized browsing
- **Sort Direction**: Sort order
  - Low to High (ascending): 1→4, A→Z, Early→Late
  - High to Low (descending): 4→1, Z→A, Late→Early
- **Note**: "Auto" sorting is exclusive to Task Chat mode for AI-driven prioritization

**Result Limits** (controls cost and performance)
- **Max Direct Results** (default: 20, range: 5-100)
  - Tasks shown directly without AI analysis
  - No cost, instant results
  - Higher = more results before AI triggers
- **Max Tasks for AI** (default: 30, range: 5-100)
  - Tasks sent to AI for context
  - Affects token usage and cost
  - Higher = better AI understanding, higher cost
- **Max Recommendations** (default: 20, range: 5-100)
  - Final curated task list size
  - AI selects most relevant from analyzed tasks
  - Keep manageable for user

**Relevance Threshold** (Advanced - Tune for your needs)
- **Range**: 0-100 (default: 0 = system defaults)
- **What it does**: Sets base threshold for keyword matching in BOTH direct search and AI analysis
- **When it applies**: Only when "Sort tasks by" is set to "Relevance" AND query has keywords
- **How it works**: System applies intelligent adjustments around your base value:
  - 4+ keywords → **base - 10** (more lenient for complex queries)
  - 2-3 keywords → **base** (use your setting)
  - 1 keyword → **base + 10** (more strict for simple queries)
- **Unified behavior**: Same filtering rules apply whether using direct search or AI analysis

**Examples:**
| Your Setting | 4+ Keywords | 2-3 Keywords | 1 Keyword |
|--------------|-------------|--------------|-----------|
| 0 (default) | 20 | 30 | 40 |
| 15 (lenient) | 5 | 15 | 25 |
| 25 (moderate) | 15 | 25 | 35 |
| 35 (strict) | 25 | 35 | 45 |
| 50 (very strict) | 40 | 50 | 60 |

**When to adjust**:
- **Getting too few results?** Lower the base (try 15-20)
  - Example: Setting 15 gives you (5/15/25) - more lenient across all queries
- **Getting too many irrelevant results?** Raise the base (try 40-50)
  - Example: Setting 40 gives you (30/40/50) - stricter across all queries
- **Different languages**: Multilingual queries often need lower base (15-25)
- **Keep 0 for smart defaults** - works well for most users!

**How scoring works**: Each keyword match = 15-20 points, multiple matches get bonuses
- Task matching 2 keywords = ~30-45 points
- Task matching 3 keywords = ~55-70 points
- Task matching 4+ keywords = ~70-90+ points

### DataView Integration

**Field Mapping**
Configure field names to match your task metadata format:

- **Due Date Field**: Default is `due`
  - Supports: `[due::2025-01-20]`
- **Created Date Field**: Default is `created`
- **Completed Date Field**: Default is `completed`
- **Priority Field**: Default is `priority`

**Priority Mapping** (Customizable, Todoist-style)
Map text values to numeric priority levels (1-4):
- **Level 1 (Highest)**: Default: `1, p1, high, highest`
  - Add your own: `urgent, critical`
- **Level 2 (High)**: Default: `2, p2, medium, med`
- **Level 3 (Medium/Low)**: Default: `3, p3, low`
- **Level 4 (None)**: Default: `4, p4, none`

System uses 1-4 internally for consistent filtering.

**Task Status Mapping** (Customizable)
Define which symbols represent each status:
- **Open**: Default: ` ` (space), empty
  - Standard: `- [ ] Task`
- **Completed**: Default: `x, X`
  - Standard: `- [x] Task`
- **In Progress**: Default: `/,  ~`
  - Standard: `- [/] Task`
- **Cancelled**: Default: `-`
  - Standard: `- [-] Task`

**Date Formats** (optional, for display)
- Due Date Format: `YYYY-MM-DD` (ISO standard)
- Created Date Format: `YYYY-MM-DD`
- Completed Date Format: `YYYY-MM-DD`

## Task Format

Task Chat works with standard Markdown tasks that include DataView metadata:

```markdown
- [x] Write blog post [due::2025-01-15] [p::high]
- [/] Review pull requests [due::2025-01-18] [p::medium]
```

**Supported Task Properties:**
- **Due Dates**: 
  - DataView format: `[due::YYYY-MM-DD]`
  - Example: `- [ ] Task [due::2025-01-20]`
  
- **Priority**: 
  - DataView format: `[p::high]`, `[p::1]`, `[p::p1]`
  - Custom values: Add in settings (e.g., `[p::urgent]`)
  
- **Status Indicators**: 
  - Open: `- [ ] Task`
  - Completed: `- [x] Task`
  - In Progress: `- [/] Task`
  - Cancelled: `- [-] Task`
  
- **Tags**: 
  - Standard Obsidian tags: `#work`, `#personal`, `#urgent`
  - Inline or at end of line
  
- **Folder Context**: Automatically detected from file path

**Complete Example:**
```markdown
## Projects

- [ ] Design new feature [due::2025-01-25] [p::high] #design #urgent
- [/] Write documentation [due::2025-01-20] [p::medium] #docs
- [x] Fix login bug [due::2025-01-15] [p::1] [completed::2025-01-14] #bugfix
- [ ] Review PR #123 [p::medium] #code-review
- [-] Old task [p::low]
```

## Advanced Usage Tips

### Power User Workflows

**1. Multi-Criteria Filtering**
```
"Show me high priority in-progress tasks in the projects folder due this week with #urgent tag"
```
→ Combines 5 filters: priority + status + folder + due date + tag

**2. Cross-Language Task Management**
```
Query in English: "development tasks"
Finds: "开发任务", "Task development", "Develop feature"
```
→ Semantic matching across languages

**3. Cost-Optimized Queries**
- Use simple, direct queries for routine checks
- Enable AI Query Parsing only when needed
- Adjust maxDirectResults to control AI trigger point

**4. Session Organization**
- Create separate sessions for different projects
- Use descriptive session names (auto-generated from first query)
- Switch sessions to maintain context

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send message | `Cmd/Ctrl + Enter` |
| Focus input | Click in textarea |
| Copy message | Click copy button |

### Integration with Other Plugins

**Works well with:**
- **Tasks Plugin**: Compatible status formats
- **Calendar Plugin**: Due date integration
- **Kanban Plugin**: Status-based workflows
- **Templater**: Auto-generate tasks with metadata
- **DataView**: Full integration for queries

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Acknowledgments

This plugin leverages code patterns from:
- [Task Scope](https://github.com/wenlzhang/obsidian-task-scope) - DataView task integration
- [Todoist Context Bridge](https://github.com/wenlzhang/obsidian-todoist-context-bridge) - Task property handling

## Privacy & Security

- Your API keys are stored locally in Obsidian's data folder
- Task data is only sent to your chosen AI provider when you send a message
- No data is collected or stored by this plugin
- For maximum privacy, use Ollama for local AI processing

## Troubleshooting

### Tasks not showing up

1. Ensure DataView plugin is installed and enabled
2. Check that your tasks follow the proper format
3. Click "Refresh tasks" in the chat view
4. Verify DataView field mappings in settings

### AI not responding

1. Check your API key is entered correctly
2. Verify your API endpoint is correct
3. Ensure you have internet connection (except for Ollama)
4. Check the console for error messages (Ctrl/Cmd + Shift + I)

### Cannot navigate to tasks

1. Ensure the source file still exists
2. Try refreshing tasks
3. Check that line numbers are being captured correctly

### Understanding chat modes

**Which mode should I use?**
- **Simple Search**: Quick searches, simple filters, free operation
- **Smart Search**: Multilingual searches, broader keyword matching
- **Task Chat**: Complex questions, AI recommendations, task prioritization

**How do I switch modes?**
- **Set default**: Settings → Task Chat → Default chat mode dropdown
  - This sets the default for all new sessions
- **Override per-query**: Use dropdown in chat interface (top controls)
  - Temporarily changes mode for current query only

**Understanding costs:**
- **Simple Search**: Always $0 (no AI)
- **Smart Search**: ~$0.0001 per query (AI keyword expansion only)
- **Task Chat**: ~$0.0021 per query (full AI analysis)

**How to reduce costs?**
1. Use Simple Search as your default mode
2. Switch to Smart Search only when you need multilingual/broader results
3. Reserve Task Chat for when you want AI recommendations
4. Use Ollama for free local AI processing (all modes)

**Query not understood correctly?**
- Try Smart Search or Task Chat mode for better AI understanding
- Check Settings → Query Languages to ensure your language is listed
- Use more specific keywords or filters
- Check the console for extracted filters (Ctrl/Cmd + Shift + I)

**Getting too few results in Smart Search or Task Chat?**
- The relevance base threshold may be too strict for your language
- Go to Settings → Task Display → Relevance threshold
- **Quick fix**: Try setting to 15 (gives you 5/15/25 thresholds)
- **Understanding**: System will still adapt, but around a lower base
- **Tip**: Multilingual queries often need base of 15-20

**Getting too many irrelevant results?**
- The relevance base threshold may be too lenient
- Try raising base to 40-45 for more selective results across all queries
- Check console (Ctrl/Cmd+Shift+I) to see actual scores
- **Tip**: Look for log showing "Final adaptive threshold"

**Fine-tuning relevance threshold for your language:**
1. Start with default (0) and test typical queries
2. Open console (Ctrl/Cmd+Shift+I) and look for:
   ```
   "Using default adaptive base: 20 (4 keywords)"
   "Final adaptive threshold: 20 (base: 20, keywords: 4)"
   "Filtered to 6 relevant tasks"
   ```
3. Evaluate results:
   - **Too few results?** Lower base by 10-15
     - If default gives 20, try base 15 (→ thresholds become 5/15/25)
   - **Too many irrelevant?** Raise base by 10-15
     - If default gives 20, try base 30 (→ thresholds become 20/30/40)
4. Test with different query types (1 keyword, 2-3 keywords, 4+ keywords)
5. **Remember**: System always adapts around your base - you're shifting the whole curve!

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Support

<a href='https://ko-fi.com/C0C66C1TB' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
