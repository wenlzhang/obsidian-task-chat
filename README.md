# Task Chat

An AI-powered Obsidian plugin for intelligent task management. Chat with your tasks naturally, and get AI insights.

## ✨ Key Features

- **🤖 Three Chat Modes** - Full AI analysis, smart semantic matching, or free simple search
- **💬 Natural Language** - Ask questions in plain languages
- **🎯 Smart Filtering** - Due date, priority, status, folders, tags
- **📊 Intelligent Scoring** - Customizable relevance, due date, priority, and status weights
- **🔄 Task Indexing** - Uses Datacore for fast performance

## 🎯 Three Chat Modes

| Mode | AI Usage | Cost | Best For |
|------|----------|------|----------|
| **🚀 Simple Search** | None | None | Quick searches, free operation |
| **🧠 Smart Search** | Keyword expansion | Low | Multilingual, broader results |
| **💬 Task Chat** | Full AI assistant | Higher | AI insights, prioritization |

→ [Learn more about chat modes](docs/CHAT_MODES.md)

## 🔍 Search Examples

### Simple Search (Free)

```
# Priority and status
s:open p:1,2,3
status:done p1 p2
p1 p2 & overdue

# Due dates
due
due:today
overdue
```

### Smart Search (AI Expansion)

```
fix → finds "repair", "solve", "correct", "resolve"

# Natural language
fix bug p1 due:today s:open,?
```

### Task Chat (AI Analysis)

```
Show me urgent tasks that are overdue
Analyze my high-priority tasks
fix bug p:1 p:2 due s:open,?
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
```

### Due Date Filters

```
due:today, due:tomorrow   → Specific days
overdue                   → Past due
```

### Combined Filters

```
s:open p1 overdue
fix bug s:inprogress due:today
s:blocked priority:1
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

## 🔒 Privacy & Network Use

This plugin connects to external AI services for Smart Search and Task Chat modes. Network usage details:

### Network Services Used

**Required for Smart Search & Task Chat modes:**
- **OpenAI API** - Task analysis and natural language processing
- **Anthropic API** - Alternative AI provider
- **OpenRouter** - Multi-model AI gateway
- **Ollama** - Local AI models (no network required)

### Data Transmitted

**What is sent to AI services:**
- Task titles and metadata (priority, status, due date)
- Your search queries
- Previous chat messages (for context, configurable)

**What is NOT sent:**
- Obsidian settings
- Personal identifiers

### Privacy Options

- **Simple Search mode** - 100% local, no network calls, completely free
- **Ollama** - 100% local AI, no data leaves your device
- **Chat history context** - Configurable (1-100 messages, default: 5)
- **API keys** - Stored locally in Obsidian, never sent to our servers

### Data Security

- Your API keys are stored securely in Obsidian's local settings
- No telemetry or analytics collected by this plugin
- You control which tasks are processed via filters

> **Note**: When using cloud AI providers (OpenAI, Anthropic, OpenRouter), data is sent to their servers. Review their privacy policies for details. For complete privacy, use Simple Search mode or Ollama.

## ⚙️ Configuration

→ [Model selection guide](docs/MODEL_SELECTION_GUIDE.md) - Choose the right model
→ [Model purpose configuration](docs/MODEL_CONFIGURATION.md) - Optimize cost/performance
→ [Complete settings guide](docs/SETTINGS_GUIDE.md) - Every setting explained

### Common Adjustments

**Too many results?**
- Raise minimum relevance score (Settings → Task Filtering)
- Increase quality filter
- Adjust max results limit

**Too few results?**
- Lower minimum relevance score (Settings → Task Filtering)
- Lower quality filter

**Results not relevant?**
- Adjust scoring coefficients (Settings → Task Scoring)
- Customize task property weights

**AI responses not using context?**
- Adjust chat history context length (Settings → Task Chat)
- Default: 5 messages, increase for longer conversations

**Seeing unwanted tasks?**
- Use exclusions to hide tasks by tags, folders, or notes (Settings → Task Filtering → Manage exclusions)
- Exclude archived content with tags like `#archive` or `#completed`
- Hide template folders or specific template files
- Click "Refresh" in chat after adding exclusions

→ [Task filtering guide](docs/FILTERING.md) - Inclusions and exclusions
→ [Task exclusions guide](docs/EXCLUSIONS.md) - Settings-based exclusions
→ [Chat history context guide](docs/CHAT_HISTORY_CONTEXT.md)
→ [Troubleshooting guide](docs/SETTINGS_GUIDE.md#common-scenarios)

## 📖 Documentation

### Core Concepts

- **[Chat Modes](docs/CHAT_MODES.md)** - Choose the right mode for your needs
- **[Settings Guide](docs/SETTINGS_GUIDE.md)** - Complete configuration reference
  - AI Provider setup
  - Semantic expansion
  - Task filtering and scoring
  - Task sorting

- **[Status Categories](docs/STATUS_CATEGORIES.md)** - Customize task states
  - Built-in categories (Open, In Progress, Completed, Cancelled)
  - Custom categories (Blocked, Review, Important, etc.)

### Advanced Features

- **[Task Filtering](docs/FILTERING.md)** - Control which tasks appear
  - Filter interface (inclusions) - Focus on specific tasks
- **[Task Exclusions](docs/EXCLUSIONS.md)** - Exclude tasks from searches
  - Exclude by tags (task-level or note-level)
  - Exclude by folders (including subfolders)
  - Exclude by specific notes
- **[Scoring System](docs/SCORING_SYSTEM.md)** - How tasks are ranked
  - Main coefficients (Relevance, Due Date, Priority, Status)
  - Sub-coefficients for fine-tuning
  - Minimum relevance and quality filters
- **[Semantic Expansion](docs/SEMANTIC_EXPANSION.md)** - Multilingual keyword matching
  - How AI expands keywords
  - Property concept recognition
  - Typo correction
- **[Sorting System](docs/SORTING_SYSTEM.md)** - Multi-criteria task ordering
  - Sort criteria (relevance, due date, priority, status, created, alphabetical)
- **[Chat History Context](docs/CHAT_HISTORY_CONTEXT.md)** - Control conversation context
  - User-configurable context length
  - Balance between context quality and cost
- **[AI Provider Configuration](docs/AI_PROVIDER_CONFIGURATION.md)** - Configure AI behavior
  - Temperature
  - Max response tokens
  - Context window
- **[Model Selection Guide](docs/MODEL_SELECTION_GUIDE.md)** - Choose the right model
  - Cloud vs local comparison
- **[Ollama Setup](docs/OLLAMA_SETUP.md)** - Complete Ollama guide
  - Installation and CORS configuration
  - Parameter configuration for different model sizes

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

Configure inline field names:

- Due date fields: `due, deadline`
- Priority fields: `priority, p`

→ [Datacore integration settings](docs/SETTINGS_GUIDE.md#5-datacore-integration)

## 🌐 Multilingual Support

Search and manage tasks in multiple languages:

- English (default)
- Any language - configure in Settings → Semantic Expansion

**How it works:**
- AI generates semantic equivalents in configured languages
- Default: 5 variations per keyword
- Works in Smart Search and Task Chat modes

→ [Semantic expansion guide](docs/SEMANTIC_EXPANSION.md)

## 💰 Cost Management

### Free Options

- **Simple Search** - $0 (no AI used)
- **Ollama** - $0 (local models)

→ [More cost details in chat modes](docs/CHAT_MODES.md#cost-considerations)
→ [Cost tracking and transparency](docs/COST_TRACKING.md)

## 🔧 Troubleshooting

→ [Complete troubleshooting](docs/SETTINGS_GUIDE.md#troubleshooting)

## 📜 License

See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built for [Obsidian](https://obsidian.md/)
- Powered by [Datacore](https://github.com/blacksmithgu/datacore) for vault-wide task indexing
- Works great with [Task Marker](https://github.com/wenlzhang/obsidian-task-marker)
- Recommended theme: [Minimal](https://github.com/kepano/obsidian-minimal)
- Exclusions UI pattern inspired by [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot) by Logan Yang

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
