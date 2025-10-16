# Task Chat

An AI-powered Obsidian plugin that enables you to chat with your tasks. Filter tasks by text, folders, priority, due date, completion status, and more. Get AI recommendations and navigate directly to tasks in your notes.

## Features

### 🤖 AI-Powered Task Analysis
- **Intelligent Chat Interface**: Natural language conversations about your tasks
- **Multiple AI Providers**: Choose from OpenAI, Anthropic, OpenRouter, or Ollama (local)
- **Smart Response Generation**: Context-aware recommendations based on your actual tasks
- **Temperature Control**: Adjust AI creativity/consistency (0.0-2.0)
- **Custom System Prompts**: Tailor AI assistant behavior to your needs

### 🔍 Advanced Query System
- **AI Query Parsing** (Optional): Intelligent natural language understanding
  - Multilingual support (English, Chinese, and more)
  - Semantic keyword extraction and expansion
  - Cross-language task matching
- **Regex-Based Parsing** (Default): Fast pattern-based query processing
- **Intelligent Search System**: Three-tier automatic cost optimization
  - Direct search for simple queries (no cost)
  - AI analysis for complex queries (optimized)
  - Automatic decision based on query complexity

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
- **Flexible Sorting Options**:
  - AI Relevance, Due Date, Priority, Created Date, Alphabetical
  - Ascending or Descending order
  - Pre-configured defaults optimized for task management
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

**Three ways to open:**
1. **Ribbon Icon**: Click the chat icon (💬) in the left sidebar
2. **Command Palette**: Open command palette and search "Task Chat: Open Task Chat"
3. **Auto-open**: Enable "Auto-open sidebar" in settings to open on startup

### Basic Usage

**1. Start a Conversation**
```
You: "Show me high priority tasks"
AI: Analyzes and recommends relevant tasks
```

**2. Filter Your Tasks**
- Click "Filter tasks" button to open advanced filter modal
- Select folders, priorities, due dates, completion status
- Use quick filters: Today, This week, This month
- Click Apply to filter tasks

**3. Navigate to Tasks**
- Click the → arrow next to any recommended task
- Plugin automatically opens the file and jumps to the task line
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

**Simple Queries** (Direct Search - No Cost)
- `"priority 1"` → Shows all high priority tasks
- `"due today"` → Shows tasks due today
- `"overdue"` → Shows past-due tasks
- `"#work"` → Shows tasks with #work tag

**Complex Queries** (AI Analysis)
- `"What should I focus on today?"` → AI recommends based on priority and deadlines
- `"high priority overdue tasks in project folder"` → Multi-filter with AI prioritization
- `"如何开发 Task Chat"` → Multilingual semantic search
- `"Which tasks are blocking my progress?"` → Contextual analysis

**Advanced Filtering**
- `"priority 1 due this week #urgent"` → Compound filters
- `"completed tasks in folder projects"` → Status + folder filtering
- `"tasks with no due date"` → Find unscheduled tasks
- `"in progress tasks tagged work"` → Status + tag filtering

## How the Intelligent Search System Works

Task Chat uses a sophisticated three-tier search system that automatically optimizes for cost and performance:

### 🔍 Three-Tier Search Strategy

```
Your Query → Query Parsing → Task Filtering → Result Handling
```

#### **Tier 1: Query Parsing** (Understanding Your Request)

You can choose between two parsing methods:

**AI Query Parsing** (Optional, Toggle in Settings)
- **What it does**: Uses AI to understand natural language queries and extract filters
- **Best for**: Complex queries, multilingual queries, semantic understanding
- **Cost**: ~200 tokens (~$0.0001 per query with GPT-4o-mini)
- **Examples**: 
  - ✅ "如何开发 Task Chat" → Extracts keywords: ["开发", "Task", "Chat"]
  - ✅ "high priority tasks due this week" → priority=1, dueDate=week
  - ✅ "show me overdue items in project folder" → dueDate=overdue, folder=project

**Regex-Based Parsing** (Default, Always Available)
- **What it does**: Uses pattern matching to extract filters from queries
- **Best for**: Simple queries with clear keywords
- **Cost**: $0 (no AI used)
- **Examples**:
  - ✅ "priority 1" → priority=1
  - ✅ "due today" → dueDate=today
  - ✅ "#work tasks" → tags=["work"]

**When to use AI Query Parsing?**
- ✅ Turn ON: Complex multilingual queries, semantic understanding needed
- ❌ Turn OFF: Simple direct queries, cost savings more important

---

#### **Tier 2: Task Filtering** (Finding Matches)

After parsing, tasks are filtered using the extracted criteria:
- Keywords: Semantic matching across task content
- Priority: Exact priority level matching (1-4)
- Due Date: Date range filtering (overdue, today, tomorrow, week, etc.)
- Status: Task completion status (open, completed, in progress)
- Folder: Path-based filtering
- Tags: Hashtag matching

---

#### **Tier 3: Result Handling** (Direct Search vs AI Analysis)

The system automatically decides whether to use **Direct Search** or **AI Task Analysis** based on query complexity:

**Direct Search** (Automatic, No Additional Cost)
- **When used**:
  - ✅ Simple query (0-1 filter type) + Few results (≤10 by default)
  - ✅ Example: "priority 1" with 5 results
- **What happens**: Returns results immediately without AI analysis
- **Cost**: $0 for analysis (may have $0.0001 for query parsing if enabled)
- **Display**: Shows explanation like "Simple query, 5 result(s) found (no AI task analysis needed)"

**AI Task Analysis** (Automatic When Needed)
- **When used**:
  - ✅ Complex query (2+ filter types), OR
  - ✅ Many results (>10), OR
  - ✅ User asks for recommendations/prioritization
  - ✅ Example: "priority 1 due today" or "priority 1" with 25 results
- **What happens**: AI analyzes tasks and provides smart recommendations
- **Cost**: ~1000-2000 tokens (~$0.002-0.004 per query with GPT-4o-mini)
- **Display**: AI provides context-aware analysis and task prioritization

---

### 💡 Query Complexity Examples

| Query | Filter Count | Classification | Direct Search? | AI Analysis? |
|-------|--------------|----------------|----------------|--------------|
| `"priority 1"` | 1 (priority) | Simple ✅ | Yes (if ≤10 results) | No |
| `"due today"` | 1 (due date) | Simple ✅ | Yes (if ≤10 results) | No |
| `"obsidian plugin"` | 1 (keywords) | Simple ✅ | Yes (if ≤10 results) | No |
| `"priority 1 due today"` | 2 (priority + date) | Complex ❌ | No | Yes |
| `"high priority #work tasks"` | 2 (priority + tag) | Complex ❌ | No | Yes |
| `"priority 1"` (50 results) | 1 (priority) | Simple ✅ | No (>10 results) | Yes |

**Filter types counted**:
1. Priority (1-4)
2. Due Date (today, overdue, week, etc.)
3. Status (open, completed, in progress)
4. Folder (path-based)
5. Tags (#work, #personal)
6. Keywords (semantic search terms)

---

### 💰 Cost Optimization Strategy

The system automatically minimizes costs while maintaining quality:

**Scenario 1: Simple Query, Few Results**
```
Query: "priority 1" (finds 5 tasks)
├─ Query Parsing: 
│  ├─ AI Parsing OFF: $0
│  └─ AI Parsing ON: ~$0.0001
└─ Result Handling: Direct Search (auto) = $0
Total Cost: $0 - $0.0001
```

**Scenario 2: Complex Query**
```
Query: "high priority overdue tasks in project folder"
├─ Query Parsing:
│  ├─ AI Parsing OFF: $0 (regex extracts: priority=1, dueDate=overdue, folder=project)
│  └─ AI Parsing ON: ~$0.0001
└─ Result Handling: AI Analysis (auto) = ~$0.002
Total Cost: $0.002 - $0.0021
```

**Scenario 3: Simple Query, Many Results**
```
Query: "priority 1" (finds 50 tasks)
├─ Query Parsing:
│  ├─ AI Parsing OFF: $0
│  └─ AI Parsing ON: ~$0.0001
└─ Result Handling: AI Analysis (auto, needs prioritization) = ~$0.002
Total Cost: $0.002 - $0.0021
```

---

### ⚡ Performance Benefits

**Reduced Latency**
- Direct search: ~50-100ms (instant results)
- AI analysis: ~1-3 seconds (only when valuable)

**Reduced Token Usage**
- Skips AI analysis for 60-70% of queries
- Saves ~1000-2000 tokens per simple query
- Cumulative savings: ~$0.50-1.00 per 1000 queries

**Smart Defaults**
- `maxDirectResults`: 10 (configurable in settings)
- Automatically adjusts based on query complexity
- Balances cost vs. quality intelligently

---

### 🎯 Best Practices

**For Cost Optimization**
- ✅ Use simple, direct queries when possible
- ✅ Keep AI Query Parsing OFF for basic filters
- ✅ Enable AI Query Parsing for complex multilingual queries
- ✅ Let the system auto-decide on AI Analysis (don't override)

**For Best Results**
- ✅ Use AI Query Parsing for semantic understanding
- ✅ Use specific filters to narrow results
- ✅ Combine multiple filters for complex queries
- ✅ Trust the automatic direct search optimization

**Understanding Your Costs**
- Check the explanation line below results: 
  - `"Simple query, 5 result(s) found (no AI task analysis needed) • No cost"`
  - `"Direct search with 8 result(s) (AI query parsing disabled) • No cost"`
  - Token usage shown for AI operations

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

**Query Parsing**
- **Use AI Query Parsing**: Enable AI-powered query understanding (optional)
  - When ON: Better semantic understanding, multilingual support (~$0.0001/query)
  - When OFF: Fast regex-based parsing ($0)
  - Recommended: ON for complex queries, OFF for cost savings

**Search Optimization**
- **Max Direct Results**: Maximum results for direct search without AI analysis (default: 10)
  - Lower values: More aggressive cost saving, fewer results shown directly
  - Higher values: More results shown directly, less frequent AI analysis
  - Recommended: 5-15 based on your typical query complexity

- **Max Tasks for AI**: Maximum tasks sent to AI for analysis (default: 20)
  - Controls token usage when AI analysis is needed
  - Higher values: More comprehensive analysis, higher token cost
  - Lower values: Faster responses, lower cost

**Language Settings**
- **Query Languages**: Languages for semantic search (default: English, 中文)
  - Used by AI Query Parsing for keyword extraction
  - Enables cross-language task matching
  - Add your languages for better search results

- **Response Language**: AI response language preference
  - Auto: Match query language
  - English: Always respond in English
  - Chinese: Always respond in Chinese (中文)
  - Custom: Use custom language instruction

### Task Display Settings

**Sorting Options**
- **Task Sort By**: Field to sort tasks by
  - Relevance: AI-determined relevance score
  - Due Date: Sort by deadline (default)
  - Priority: Sort by priority level (1-4)
  - Created Date: Sort by creation time
  - Alphabetical: Sort by task text
- **Sort Direction**: Sort order
  - Low to High (ascending): 1→4, A→Z, Early→Late
  - High to Low (descending): 4→1, Z→A, Late→Early

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

### DataView Integration

**Field Mapping**
Configure field names to match your task metadata format:

- **Due Date Field**: Default is `due`
  - Supports: `[due::2025-01-20]` or `📅 2025-01-20`
- **Created Date Field**: Default is `created`
- **Completed Date Field**: Default is `completed`
- **Priority Field**: Default is `priority`

**Priority Mapping** (Customizable, Todoist-style)
Map text values to numeric priority levels (1-4):
- **Level 1 (Highest)**: Default: `1, p1, high, highest`
  - Add your own: `高, urgent, critical`
- **Level 2 (High)**: Default: `2, p2, medium, med`
  - Add your own: `中, normal`
- **Level 3 (Medium/Low)**: Default: `3, p3, low`
  - Add your own: `低`
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
- [ ] Buy groceries 📅 2025-01-20 ⏫
- [x] Write blog post [due::2025-01-15] [priority::high]
- [/] Review pull requests [due::2025-01-18] [priority::medium]
```

**Supported Task Properties:**
- **Due Dates**: 
  - Emoji format: `📅 YYYY-MM-DD`
  - DataView format: `[due::YYYY-MM-DD]`
  - Example: `- [ ] Task 📅 2025-01-20` or `- [ ] Task [due::2025-01-20]`
  
- **Priority**: 
  - Emoji format: `⏫` (high), `🔼` (medium), `🔽` (low)
  - DataView format: `[priority::high]`, `[priority::1]`, `[priority::p1]`
  - Custom values: Add in settings (e.g., `[priority::urgent]`)
  
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

- [ ] Design new feature [due::2025-01-25] [priority::high] #design #urgent
- [/] Write documentation 📅 2025-01-20 ⏫ #docs
- [x] Fix login bug [due::2025-01-15] [priority::1] [completed::2025-01-14] #bugfix
- [ ] Review PR #123 [priority::medium] #code-review
- [-] Old task [priority::low]
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

### Understanding search behavior

**Why is my query using direct search instead of AI?**
- Your query is simple (single filter) with few results (≤10 by default)
- This is intentional to save costs - direct search is sufficient
- Check the explanation line: "Simple query, X result(s) found (no AI task analysis needed)"

**Why does AI analysis cost vary?**
- Query Parsing: ~$0.0001 (if enabled)
- Task Analysis: ~$0.002-0.004 (only for complex queries or many results)
- Token usage depends on number of tasks analyzed (max: 20 by default)

**How to reduce costs?**
1. Disable AI Query Parsing for simple queries
2. Lower `maxDirectResults` to trigger AI analysis less often
3. Use specific filters to reduce result count
4. Use Ollama for free local AI processing

**Query not understood correctly?**
- Enable AI Query Parsing in settings for better understanding
- Use more specific keywords or filters
- Check the extracted filters in the console (Ctrl/Cmd + Shift + I)

**Want more control over AI usage?**
- Adjust `maxDirectResults` (default: 10) to control when AI analysis triggers
- Lower value = more direct search, less AI cost
- Higher value = fewer AI calls, but may miss complex prioritization

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Support

<a href='https://ko-fi.com/C0C66C1TB' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
