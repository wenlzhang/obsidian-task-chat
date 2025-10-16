# Task Chat

An AI-powered Obsidian plugin that enables you to chat with your tasks. Filter tasks by text, folders, priority, due date, completion status, and more. Get AI recommendations and navigate directly to tasks in your notes.

## Features

- **AI Chat Interface**: Chat with an AI assistant about your tasks
- **Advanced Filtering**: Filter tasks by:
  - Text content
  - Folders
  - Priority levels
  - Due date ranges
  - Completion status
  - Task status categories
- **Task Navigation**: Click on recommended tasks to jump directly to their location in your notes
- **DataView Integration**: Leverages the DataView plugin to access task properties
- **Multiple AI Providers**: Supports OpenAI, Anthropic, OpenRouter, and Ollama (local)
- **Real-time Updates**: Automatically refreshes tasks when your notes change
- **Intelligent Search System**: Automatic cost optimization with three-tier search strategy

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

1. Install and enable the **DataView** plugin
2. Open Task Chat settings (Settings → Task Chat)
3. Configure your AI provider:
   - Select your provider (OpenAI, Anthropic, OpenRouter, or Ollama)
   - Enter your API key (not needed for Ollama)
   - Choose your preferred model
4. Optionally customize DataView field mappings to match your task setup

## Usage

### Opening Task Chat

- Click the chat icon in the left ribbon, or
- Use the command palette: "Task Chat: Open Task Chat"

### Chatting with Tasks

1. Click "Filter tasks" to select which tasks to focus on
2. Type your question or request in the chat input
3. Press Cmd/Ctrl+Enter to send
4. Click the → button next to recommended tasks to navigate to them

### Example Conversations

- "What are my highest priority tasks?"
- "Which tasks are overdue?"
- "Show me tasks due this week"
- "What should I work on next?"
- "Are there any tasks in the project folder?"

### Filtering Tasks

Click "Filter tasks" to open the filter modal where you can:

- Search by text content
- Select specific folders
- Filter by priority levels
- Set due date ranges
- Filter by completion or task status
- Use quick filters (Today, This week, This month)

## Configuration

### AI Provider Settings

- **AI Provider**: Choose between OpenAI, Anthropic, OpenRouter, or Ollama
- **API Key**: Your provider's API key
- **Model**: Model name (e.g., gpt-4o-mini, claude-3-5-sonnet-20241022, llama3.2)
- **API Endpoint**: Custom API endpoint URL

### Chat Settings

- **Max Chat History**: Number of messages to keep (default: 50)
- **Show Task Count**: Display task count in filter status
- **Show Token Usage**: Display cost and token information below responses
- **Auto-open Sidebar**: Open Task Chat automatically on startup
- **System Prompt**: Customize the AI assistant's behavior

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

- **Response Language**: AI response language preference
  - Auto: Match query language
  - English: Always respond in English
  - Chinese: Always respond in Chinese (中文)
  - Custom: Use custom language instruction

### DataView Integration

Configure field names to match your task metadata:

- **Due Date Field**: Default is `due`
- **Created Date Field**: Default is `created`
- **Completed Date Field**: Default is `completed`
- **Priority Field**: Default is `priority`

## Task Format

Task Chat works with standard Markdown tasks that include DataView metadata:

```markdown
- [ ] Buy groceries 📅 2025-01-20 ⏫
- [x] Write blog post [due::2025-01-15] [priority::high]
- [/] Review pull requests [due::2025-01-18] [priority::medium]
```

Supported task properties:
- Due dates: `📅 YYYY-MM-DD` or `[due::YYYY-MM-DD]`
- Priority: `⏫` (high), `🔼` (medium), `🔽` (low) or `[priority::high]`
- Status: `[ ]` (open), `[x]` (completed), `[/]` (in progress), `[-]` (cancelled)
- Tags: Standard Obsidian tags

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
