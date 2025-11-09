# Task Chat

[![GitHub release (Latest by date)](https://img.shields.io/github/v/release/wenlzhang/obsidian-task-chat)](https://github.com/wenlzhang/obsidian-task-chat/releases) ![GitHub all releases](https://img.shields.io/github/downloads/wenlzhang/obsidian-task-chat/total?color=success)

An AI-powered task management assistant for [Obsidian](https://obsidian.md/) that lets you chat with your tasks naturally. Search with simple filters, expand queries across languages, or get full AI analysis.

## ✨ Key Features

- **🤖 Three Chat Modes** - Full AI analysis, smart semantic matching, or free simple search
- **💬 Natural Language** - Ask questions in plain languages
- **🎯 Smart Filtering** - Due date, priority, status, folders, tags
- **📊 Intelligent Scoring** - Customizable relevance, due date, priority, and status weights
- **🔄 Task Indexing** - Uses Datacore for fast performance

## 🌐 Web Version Available

Chat with your Todoist tasks directly in your browser at **[task-chat-web.vercel.app](https://task-chat-web.vercel.app/)**. Configure your Todoist API token and AI provider keys to get started. All data is stored locally in your browser for privacy.

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

Task Chat supports flexible queries from simple filters to natural language:

### Quick Reference

- **Status:** `s:open`, `s:completed`, `s:inprogress`, `s:x` (by symbol)
- **Priority:** `p1`, `p2`, `p3`, `p4`, `p:1,2,3`, `priority:1`
- **Due Date:** `due`, `due:today`, `due:tomorrow`, `overdue`, `this week`
- **Combined:** `s:open,inprogress p1 overdue`, `fix bug s:inprogress due:today`

### Query Types

- **Pure Property Queries** - Fast, free filtering: `p1 overdue s:open`
- **Mixed Queries** - Keywords + properties: `fix bug p1 overdue`

→ **[Complete Query Syntax Guide](docs/QUERY_SYNTAX.md)** - Detailed documentation covering:
- Standard and non-standard task properties
- Semantic expansion and keywords

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

This plugin connects to external AI services for Smart Search and Task Chat modes.

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
- **Chat history context** - Configurable
- **API keys** - Stored locally in Obsidian

### Data Security

- Your API keys are stored securely in Obsidian's local settings
- You control which tasks are processed via filters

> **Note**: When using cloud AI providers (OpenAI, Anthropic, OpenRouter), data is sent to their servers. Review their privacy policies for details. For complete privacy, use Simple Search mode or Ollama.

## 📖 Documentation

### Core Concepts

- **[Chat Modes](docs/CHAT_MODES.md)** - Choose the right mode for your needs
- **[Query Syntax](docs/QUERY_SYNTAX.md)** - Complete query syntax reference
- **[Semantic Expansion](docs/SEMANTIC_EXPANSION.md)** - Multilingual keyword matching
- **[Status Categories](docs/STATUS_CATEGORIES.md)** - Customize task states
- **[Settings Guide](docs/SETTINGS_GUIDE.md)** - Complete configuration reference

### Advanced Features

- **[Task Filtering](docs/FILTERING.md)** - Control which tasks appear
    - **[Task Exclusions](docs/EXCLUSIONS.md)** - Exclude tasks from searches
- **[Scoring System](docs/SCORING_SYSTEM.md)** - How tasks are ranked
    - **[Sorting System](docs/SORTING_SYSTEM.md)** - Multi-criteria task ordering
- **[Chat History Context](docs/CHAT_HISTORY_CONTEXT.md)** - Control conversation context
- **[AI Provider Configuration](docs/AI_PROVIDER_CONFIGURATION.md)** - Configure AI behavior
    - **[Model Selection Guide](docs/MODEL_SELECTION_GUIDE.md)** - Choose the right model
    - **[Ollama Setup](docs/OLLAMA_SETUP.md)** - Complete Ollama guide
    - **[Streaming Responses](docs/STREAMING.md)** - Streaming vs non-streaming modes
- **[Troubleshooting](docs/SETTINGS_GUIDE.md#troubleshooting)**

## 📜 License

See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built for [Obsidian](https://obsidian.md/)
- Powered by [Datacore](https://github.com/blacksmithgu/datacore) for vault-wide task indexing
- Works great with [Task Marker](https://github.com/wenlzhang/obsidian-task-marker)
- Recommended theme: [Minimal](https://github.com/kepano/obsidian-minimal)
- Exclusions UI pattern inspired by [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot) by Logan Yang
- Developed using **Vibe Coding** with [WindSurf](https://windsurf.com), [Claude Code](https://www.claude.com/product/claude-code), and [Claude Sonnet 4.5](https://www.anthropic.com/claude)

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
