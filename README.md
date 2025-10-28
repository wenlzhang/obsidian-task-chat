# Task Chat

An AI-powered Obsidian plugin for intelligent task management. Chat with your tasks naturally, get AI insights, and manage your work with powerful filters and smart search.

## ✨ Key Features

- **🤖 Three Chat Modes** - Free simple search, smart semantic matching, or full AI analysis
- **🌐 Multilingual Support** - Search in English, 中文, and other languages
- **🎯 Smart Filtering** - Priority, due date, status, tags, folders
- **📊 Intelligent Scoring** - Customizable relevance, due date, priority, and status weights
- **💬 Natural Language** - Ask questions in plain language
- **🔄 Dataview Integration** - Works seamlessly with Dataview syntax

## 🎯 Three Chat Modes

| Mode | AI Usage | Cost | Best For |
|------|----------|------|----------|
| **🚀 Simple Search** | None | None | Quick searches, free operation |
| **🧠 Smart Search** | Keyword expansion | Very low | Multilingual, broader results |
| **💬 Task Chat** | Full AI assistant | Higher | AI insights, prioritization |

**Default**: Simple Search (free). Switch anytime using the dropdown in chat interface.

→ [Learn more about chat modes](docs/CHAT_MODES.md)

## 🔍 Search Examples

### Simple Search (Free)

```
# Priority and status
s:open priority:1
status:done p:1,2,3
p1 p2 & overdue

# Due dates
due:today
next week
overdue

# Combined filters
s:open p1 due:today
```

### Smart Search (AI Expansion)

```
# English
fix → finds "repair", "solve", "correct", "resolve"
urgent → finds "critical", "important", "high-priority"

# 中文
修复 → finds "修理", "解决", "修正", "纠正"
紧急 → finds "关键", "重要", "高优先级"

# Natural language
tasks I need to finish today
show me incomplete high priority items
fix bug p1 due:today s:open,?
```

### Task Chat (AI Analysis)

```
# English
What should I work on next?
Show me urgent tasks that are overdue
Analyze my high-priority tasks
fix bug p:1 p:2 due s:open,?

# 中文
我接下来应该做什么？
显示过期的紧急任务
分析我的高优先级任务
```

## 📊 Query Syntax

### Status Filters

```
s:open          → Open tasks
s:completed     → Completed tasks
s:inprogress    → In-progress tasks
s:open,wip      → Open OR in-progress
s:x             → Completed (by symbol)
s:/             → In-progress (by symbol)
```

### Priority Filters

```
p1, p2, p3, p4            → Priority levels
priority:1                → High priority
urgent, critical          → Natural language (Smart Search/Task Chat)
```

### Due Date Filters

```
due:today, due:tomorrow   → Specific days
overdue                   → Past due
next week, this month     → Relative dates
7d, -2w, 3m               → Relative dates
due before: Friday        → Before specific date
```

### Combined Filters

```
s:open p1 overdue
fix bug s:inprogress due:today
s:blocked priority:1
urgent s:open
```

## Quick Start

### Installation

1. Open Obsidian Settings → Community Plugins
2. Search for "Task Chat"
3. Install and enable the plugin
4. Configure your AI provider (OpenAI, Anthropic, OpenRouter, or Ollama)

### Basic Usage

1. **Open Task Chat** - Click the chat icon in the left sidebar or use command palette
2. **Choose a Mode** - Select your preferred chat mode from the dropdown
3. **Start Chatting** - Type your query and press Enter

**Example queries:**
```
# Simple Search
s:open priority:1 due:today
fix bug

# Smart Search (with AI expansion)
fix bug (finds "fix", "repair", "solve" in multiple languages)
urgent open tasks

# Task Chat (with AI analysis)
What should I work on today?
Show me overdue high-priority tasks
Analyze my tasks for this week
```

## 🔒 Privacy & Network Use

This plugin connects to external AI services for Smart Search and Task Chat modes. Network usage details:

### Network Services Used

**Required for Smart Search & Task Chat modes:**
- **OpenAI API** (gpt-4o, gpt-4o-mini, etc.) - Task analysis and natural language processing
- **Anthropic API** (Claude models) - Alternative AI provider
- **OpenRouter** - Multi-model AI gateway
- **Ollama** (Optional) - Local AI models (no network required)

### Data Transmitted

**What is sent to AI services:**
- Task titles and metadata (priority, status, due date)
- Your search queries
- Previous chat messages (for context, configurable)

**What is NOT sent:**
- Note content outside of tasks
- Vault names or file paths
- Obsidian settings
- Personal identifiers

### Privacy Options

- **Simple Search mode** - 100% local, no network calls, completely free
- **Ollama** - 100% local AI, no data leaves your device
- **Chat history context** - Configurable (1-100 messages, default: 5)
- **API keys** - Stored locally in Obsidian, never sent to our servers

### Data Security

- All API communications use HTTPS encryption
- Your API keys are stored securely in Obsidian's local settings
- No telemetry or analytics collected by this plugin
- You control which tasks are processed via filters

> **Note**: When using cloud AI providers (OpenAI, Anthropic, OpenRouter), data is sent to their servers. Review their privacy policies for details. For complete privacy, use Simple Search mode or Ollama.

## ⚙️ Configuration

### Quick Setup

1. **AI Provider** - Choose OpenAI, Anthropic, OpenRouter, or Ollama
2. **API Key** - Enter your API key (not needed for Ollama)
3. **Test Connection** - Verify setup works

### Model Purpose Configuration

**NEW**: Use different models for different purposes to optimize cost and performance!

**Query Parsing** (Smart Search & Task Chat query understanding):
- **Recommended**: Fast, cost-effective models
- GPT-4o-mini, Claude Sonnet 4, or Qwen3:14b
- Lower temperature (0.1) for consistent results

**Task Analysis** (Task Chat AI responses):
- **Recommended**: Quality models for better insights
- GPT-4o-mini, Claude Sonnet 4, or Qwen3:14b
- Adjustable temperature (0.1-2.0) based on needs

**Example configurations:**
```
Cost-Optimized:
  Parsing: OpenAI gpt-4o-mini
  Analysis: OpenAI gpt-4o-mini

Quality-Focused:
  Parsing: OpenAI gpt-4o-mini (fast)
  Analysis: Anthropic claude-sonnet-4 (quality)

Privacy-First:
  Parsing: OpenAI gpt-4o-mini (cloud)
  Analysis: Ollama qwen3:14b (local)
  Analysis stays local, only queries sent to cloud
```

> **⚠️ Note:** Model performance varies between users based on hardware, query complexity, and use cases. Test different models to find what works best for you.

→ [Model selection guide](docs/MODEL_SELECTION_GUIDE.md)
→ [Model purpose configuration](docs/MODEL_CONFIGURATION.md)
→ [Complete settings guide](docs/SETTINGS_GUIDE.md)

### Common Adjustments

**Too many results?**
- Increase quality filter (Settings → Task Filtering)
- Raise minimum relevance score
- Adjust max results limit

**Too few results?**
- Lower quality filter (Settings → Task Filtering)
- Disable minimum relevance score
- Check if DataView is enabled

**Results not relevant?**
- Adjust scoring coefficients (Settings → Task Scoring)
- Customize priority/due date weights

**AI responses not using context?**
- Adjust chat history context length (Settings → Task Chat)
- Default: 5 messages, increase for longer conversations
- Warnings and task references automatically cleaned

→ [Chat history context guide](docs/CHAT_HISTORY_CONTEXT.md)  
→ [Troubleshooting guide](docs/SETTINGS_GUIDE.md#common-scenarios)

## 📖 Documentation

### Core Concepts

- **[Chat Modes](docs/CHAT_MODES.md)** - Choose the right mode for your needs
  - Simple Search - Free, fast, regex-based
  - Smart Search - AI keyword expansion (~$0.0001/query, depending on query length and model selection)
  - Task Chat - Full AI analysis (~$0.0021/query, depending on query length and model selection)

- **[Settings Guide](docs/SETTINGS_GUIDE.md)** - Complete configuration reference
  - AI Provider setup
  - Chat mode configuration
  - Semantic expansion
  - Task filtering and scoring
  - Display and sorting

- **[Status Categories](docs/STATUS_CATEGORIES.md)** - Customize task states
  - Built-in categories (Open, In Progress, Completed, Cancelled)
  - Custom categories (Blocked, Review, Important, etc.)
  - Symbols, scores, and display order
  - Query syntax and examples

### Advanced Features

- **[Scoring System](docs/SCORING_SYSTEM.md)** - How tasks are ranked
  - Main coefficients (Relevance, Due Date, Priority, Status)
  - Sub-coefficients for fine-tuning
  - Quality filter and minimum relevance
  - Examples and best practices

- **[Semantic Expansion](docs/SEMANTIC_EXPANSION.md)** - Multilingual keyword matching
  - How AI expands keywords
  - Property concept recognition
  - Typo correction
  - Custom property terms

- **[Sorting System](docs/SORTING_SYSTEM.md)** - Multi-criteria task ordering
  - Sort criteria (relevance, due date, priority, status, created, alphabetical)
  - Performance considerations

- **[Chat History Context](docs/CHAT_HISTORY_CONTEXT.md)** - Control conversation context ⭐ NEW
  - User-configurable context length (1-100 messages, default: 5)
  - Automatic message cleaning (warnings and task references removed)
  - Token usage optimization
  - Balance between context quality and cost

- **[AI Provider Configuration](docs/AI_PROVIDER_CONFIGURATION.md)** - Configure AI behavior ⭐
  - Temperature (recommended 0.1 for JSON output)
  - Max response tokens (default 8000)
  - Context window (critical for Ollama)
  - Configuration examples and troubleshooting

- **[Model Selection Guide](docs/MODEL_SELECTION_GUIDE.md)** - Choose the right model ⭐
  - Cloud vs local comparison
  - Default models by provider
  - Hardware requirements
  - Cost analysis
  - Provider-specific differences
  - **Performance tuning & model selection**
  - When to use Ollama vs cloud providers
  - Troubleshooting guide

- **[Ollama Setup](docs/OLLAMA_SETUP.md)** - Complete Ollama guide ⭐ NEW
  - Installation and CORS configuration
  - Recommended models by use case
  - Parameter configuration for different model sizes
  - Performance comparison
  - Troubleshooting common issues

## 🎚️ Customization

### Status Categories

Create custom task states that match your workflow:

**Examples:**
- **Question** - Waiting on dependencies (symbol: `?`)
- **Review** - Under code review (symbol: `R`)
- **Important** - High-priority flag (symbol: `!`)

→ [Status categories guide](docs/STATUS_CATEGORIES.md)

### Scoring Weights

Customize how tasks are ranked:

```
Keyword-focused: R:30, D:2,  P:1  → Emphasize keyword matching
Urgency-focused: R:20, D:10, P:5  → Emphasize deadlines
Balanced:        R:10, D:10, P:10 → Equal weight to all
```

→ [Scoring system guide](docs/SCORING_SYSTEM.md)

### Task Properties

Configure DataView field names:

- Due date fields: `due, deadline`
- Priority fields: `priority, p`
- Status fields: `status`

→ [DataView integration settings](docs/SETTINGS_GUIDE.md#5-dataview-integration)

## 🌐 Multilingual Support

Search and manage tasks in multiple languages:

- English (default)
- Any language - configure in Settings → Semantic Expansion

**How it works:**
- AI generates semantic equivalents in configured languages
- Default: 5 variations per keyword
- Works in Smart Search and Task Chat modes

**Examples:**

*English:*
```
urgent tasks → finds "critical", "important", "high-priority"
fix bug → finds "repair error", "solve issue", "correct problem"
```

→ [Semantic expansion guide](docs/SEMANTIC_EXPANSION.md)

## 💰 Cost Management

### Free Options

- **Simple Search** - $0 (no AI used)
- **Ollama** - $0 (local models)

### Paid Options

- **Smart Search** - ~$0.0001 per query (depending on query length and model selection)
- **Task Chat** - ~$0.0021 per query (depending on query length and model selection)

**Cost optimization tips:**
1. Use Simple Search for exact keyword matches
2. Use Smart Search for most queries (very cheap)
3. Reserve Task Chat for complex analysis
4. Use Ollama for unlimited local processing (free, but slower)

→ [More cost details in chat modes](docs/CHAT_MODES.md#cost-considerations)

## 🔧 Troubleshooting

### No Results Found

**Check:**
- Quality filter too strict → Decrease to 0-20%
- Minimum relevance too high → Disable or decrease
- Stop words too aggressive → Remove domain terms

### Wrong Tasks Appearing

**Fix:**
- Add custom stop words for generic terms
- Increase quality filter (20-30%)
- Add minimum relevance score (30-40%)

### AI Not Working

**Verify:**
- API key is valid
- Model is selected
- Internet connection works
- Credits available (for paid providers)
- Test connection in settings

→ [Complete troubleshooting](docs/SETTINGS_GUIDE.md#troubleshooting)

## 🤝 Contributing

Contributions welcome!

## 📜 License

See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built for [Obsidian](https://obsidian.md/)
- Compatible with [Dataview](https://github.com/blacksmithgu/obsidian-dataview)
- Works great with [Task Marker](https://github.com/wenlzhang/obsidian-task-marker)
- Recommended theme: [Minimal](https://github.com/kepano/obsidian-minimal)
- Exclusions UI pattern inspired by [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot) by Logan Yang

## 📚 Additional Resources

- **[Complete Settings Guide](docs/SETTINGS_GUIDE.md)** - Every setting explained
- **[Chat Modes](docs/CHAT_MODES.md)** - Detailed mode comparison
- **[Status Categories](docs/STATUS_CATEGORIES.md)** - Customize task states
- **[Scoring System](docs/SCORING_SYSTEM.md)** - How tasks are ranked
- **[Semantic Expansion](docs/SEMANTIC_EXPANSION.md)** - Multilingual search
- **[Chat History Context](docs/CHAT_HISTORY_CONTEXT.md)** - Control conversation context
- **[Sorting System](docs/SORTING_SYSTEM.md)** - Multi-criteria ordering

## 🆘 Support

This plugin is a labor of love, developed and maintained during my free time after work and on weekends. A lot of thought, energy, and care goes into making it reliable and user-friendly.

If you find this plugin valuable in your daily workflow:

- If it helps you manage tasks more effectively
- If it saves you time and mental energy

Please consider supporting my work. Your support would mean the world to me and would help me dedicate more time and energy to:

- Developing new features
- Maintaining code quality
- Providing support and documentation
- Making the plugin even better for everyone

### Ways to Support

You can support this project in several ways:

- ⭐ Star the project on GitHub
- 💝 <a href='https://ko-fi.com/C0C66C1TB' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee' /></a>
- [Sponsor](https://github.com/sponsors/wenlzhang) my work on GitHub
- 💌 Share your success stories and feedback
- 📢 Spread the word about the plugin
- 🐛 [Report issues](https://github.com/wenlzhang/obsidian-task-chat/issues) to help improve the plugin

Thank you for being part of this journey! 🙏
