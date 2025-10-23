# Task Chat

An AI-powered Obsidian plugin for intelligent task management. Chat with your tasks naturally, get AI insights, and manage your work with powerful filters and smart search.

## ✨ Key Features

- **🤖 Three Chat Modes** - Free simple search, smart semantic matching, or full AI analysis
- **🌐 Multilingual Support** - Search in English, 中文, and other languages
- **🎯 Smart Filtering** - Priority, due date, status, tags, folders
- **📊 Intelligent Scoring** - Customizable relevance, urgency, and importance weights
- **💬 Natural Language** - Ask questions in plain language
- **🔄 DataView Integration** - Works seamlessly with DataView tasks

## Quick Start

### Installation

1. Open Obsidian Settings → Community Plugins
2. Search for "Task Chat"
3. Install and enable the plugin
4. Configure your AI provider (OpenAI, Anthropic, OpenRouter, or Ollama)

### Basic Usage

1. **Open Task Chat** - Click the chat icon in the left sidebar or use command palette
2. **Choose a Mode** - Select your preferred chat mode from the dropdown
3. **Start Searching** - Type your query and press Enter

**Example queries:**
```
# Simple searches
s:open priority:1 due:today
urgent tasks
fix bug

# Smart search (with AI expansion)
修复错误 (finds "fix", "repair", "solve" in multiple languages)
urgent incomplete tasks

# Task Chat (with AI analysis)
What should I work on today?
Show me overdue high-priority tasks
Analyze my tasks for this week
```

## 📖 Documentation

### Core Concepts

- **[Chat Modes](docs/CHAT_MODES.md)** - Choose the right mode for your needs
  - Simple Search - Free, fast, regex-based
  - Smart Search - AI keyword expansion (~$0.0001/query)
  - Task Chat - Full AI analysis (~$0.0021/query)

- **[Settings Guide](docs/SETTINGS_GUIDE.md)** - Complete configuration reference
  - AI Provider setup
  - Chat mode configuration
  - Semantic expansion
  - Task filtering and scoring
  - Display and sorting options

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
  - Tiebreaking logic
  - Performance considerations

## 🎯 Three Chat Modes

| Mode | AI Usage | Cost | Best For |
|------|----------|------|----------|
| **🚀 Simple Search** | None | $0 | Quick searches, free operation |
| **🧠 Smart Search** | Keyword expansion | ~$0.0001 | Multilingual, broader results |
| **💬 Task Chat** | Full AI assistant | ~$0.0021 | AI insights, prioritization |

**Default**: Simple Search (free). Switch anytime using the dropdown in chat interface.

→ [Learn more about chat modes](docs/CHAT_MODES.md)

## 🔍 Search Examples

### Simple Search (Free)

```
# Priority and status
s:open priority:1
p1 & overdue

# Due dates
due:today
next week
overdue tasks

# Combined filters
s:open & p1 & due:today
urgent tasks in ##Work folder
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
```

### Task Chat (AI Analysis)

```
# English
What should I work on next?
Show me urgent tasks that are overdue
Analyze my high-priority tasks

# 中文
我接下来应该做什么？
显示过期的紧急任务
分析我的高优先级任务
```

## ⚙️ Configuration

### Quick Setup

1. **AI Provider** - Choose OpenAI, Anthropic, OpenRouter, or Ollama
2. **API Key** - Enter your API key (not needed for Ollama)
3. **Model Selection** - Pick a model (GPT-4o-mini recommended)
4. **Test Connection** - Verify setup works

**Recommended models:**
- **GPT-4o-mini** - Fast, cheap, excellent quality (default)
- **gpt-4o** - Flagship model, balanced performance
- **Claude 3.5 Sonnet** - Best reasoning, higher cost
- **Local (Ollama)** - Free, private, slower

→ [Complete settings guide](docs/SETTINGS_GUIDE.md)

### Common Adjustments

**Too many results?**
- Increase quality filter (Settings → Task Filtering)
- Add minimum relevance score

**Missing relevant tasks?**
- Enable semantic expansion (Settings → Semantic Expansion)
- Add more query languages
- Increase max keyword expansions

**Wrong task priority?**
- Adjust scoring coefficients (Settings → Task Scoring)
- Customize priority/due date weights

→ [Troubleshooting guide](docs/SETTINGS_GUIDE.md#common-scenarios)

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
p1, p2, p3, p4           → Priority levels
priority:1                → High priority
urgent, critical          → Natural language (Smart Search/Task Chat)
```

### Due Date Filters

```
due:today, due:tomorrow   → Specific days
overdue, od               → Past due
next week, this month     → Relative dates
7d, 2w, 3mo               → Duration format
due before: Friday        → Before specific date
```

### Combined Filters

```
s:open & p1 & overdue
fix bug s:inprogress due:today
s:blocked priority:1
urgent s:open & ##ProjectName
```

→ [Complete query syntax in README sections 66-343](README.md#advanced-query-syntax)

## 🎚️ Customization

### Status Categories

Create custom task states that match your workflow:

**Examples:**
- **Blocked** - Waiting on dependencies (symbol: `?`)
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

- Due date fields: `due, due_date, deadline`
- Priority fields: `priority, p, importance`
- Status fields: `status, state`

→ [DataView integration settings](docs/SETTINGS_GUIDE.md#5-dataview-integration)

## 🌐 Multilingual Support

Search and manage tasks in multiple languages:

**Supported languages:**
- English
- 中文 (Chinese)
- Add more in Settings → Semantic Expansion → Query Languages

**How it works:**
- AI expands keywords into multiple languages
- Example: "fix" → "repair, solve, 修复, 修理, 解决"
- Works in Smart Search and Task Chat modes

**Examples:**

*English:*
```
urgent tasks → finds "critical", "important", "high-priority"
fix bug → finds "repair error", "solve issue", "correct problem"
```

*中文:*
```
紧急任务 → finds "关键", "重要", "高优先级"
修复错误 → finds "修理", "解决", "修正"
```

→ [Semantic expansion guide](docs/SEMANTIC_EXPANSION.md)

## 💰 Cost Management

### Free Options

- **Simple Search** - $0 (no AI used)
- **Ollama** - $0 (local models)

### Paid Options

- **Smart Search** - ~$0.0001 per query (keyword expansion only)
- **Task Chat** - ~$0.0021 per query (full AI analysis)

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

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built for [Obsidian](https://obsidian.md/)
- Compatible with [DataView](https://github.com/blacksmithgu/obsidian-dataview)
- Works great with [Task Marker](https://github.com/wenlzhang/obsidian-task-marker)
- Recommended theme: [Minimal](https://github.com/kepano/obsidian-minimal)

## 📚 Additional Resources

- **[Complete Settings Guide](docs/SETTINGS_GUIDE.md)** - Every setting explained
- **[Chat Modes](docs/CHAT_MODES.md)** - Detailed mode comparison
- **[Status Categories](docs/STATUS_CATEGORIES.md)** - Customize task states
- **[Scoring System](docs/SCORING_SYSTEM.md)** - How tasks are ranked
- **[Semantic Expansion](docs/SEMANTIC_EXPANSION.md)** - Multilingual search
- **[Sorting System](docs/SORTING_SYSTEM.md)** - Multi-criteria ordering

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/wenlzhang/obsidian-task-chat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/wenlzhang/obsidian-task-chat/discussions)
- **Documentation**: [docs/](docs/)

---

**Made with ❤️ for the Obsidian community**
