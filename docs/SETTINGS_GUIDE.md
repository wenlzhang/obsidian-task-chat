# Settings Guide

Complete guide to configuring Task Chat for your workflow.

## Settings Overview

Task Chat settings are organized into 10 main sections:

1. **AI Provider** - Configure your AI service
2. **Model Configuration** - Per-purpose model selection
3. **Task Chat** - Chat interface and session settings
4. **Semantic Expansion** - Multilingual keyword expansion
5. **Datacore Integration** - Task property fields
6. **Status Categories** - Custom task states with advanced features
7. **Task Filtering** - Control which tasks appear
8. **Task Scoring** - Weight importance factors with sub-coefficients
9. **Task Sorting** - Multi-criteria task ordering
10. **Advanced** - System prompts, cost tracking, and debug settings

## 1. AI Provider

### Provider Selection

Choose from four AI providers:

- **OpenAI** - GPT-4o, GPT-5, o-series models
- **Anthropic** - Claude Sonnet 4.0, Claude Sonnet 4.5
- **OpenRouter** - Access 100+ models from one API
- **Ollama** - Run models locally (free, private)

### API Key

Required for OpenAI, Anthropic, and OpenRouter. Not needed for Ollama.

**Security:** API keys are stored locally in Obsidian's `data.json` file.

### Model Selection

**Recommended models:**
- **GPT-4o-mini** - Fast, cheap, good performance
- **Local (Ollama)** - Free, private, slower

### Connection Test

Click "Test connection" to verify:
- API key is valid
- Selected model is available
- Network connectivity works
- Real-time validation with inline feedback

### Model Availability

The plugin automatically fetches available models from your provider:
- **Auto-fetch on provider selection** - Models loaded automatically
- **Refresh button** - Update model list manually
- **Model count indicator** - Shows number of available models
- **Per-provider caching** - Remembers models for each provider

## 2. Model Configuration

Configure different models for different purposes to optimize cost and performance!

### Model Purpose System

Task Chat uses two types of AI operations, each optimized for different needs:

#### Query Parsing (Smart Search & Task Chat)

**Purpose:** Understanding user queries and extracting filters

**Recommended models:**
- Fast, cost-effective models
- GPT-4o-mini, or Qwen3:14b
- Lower temperature (0.1) for consistent output

**Settings:**
- **Provider selection** - Can differ from main AI provider
- **Model selection** - Dropdown of available models
- **Temperature** - 0.0-2.0 (0.1 recommended for reliable output)

#### Task Analysis (Task Chat responses)

**Purpose:** Analyzing tasks and generating AI recommendations

**Recommended models:**
- Quality models for better insights
- GPT-4o, Claude Sonnet 4, or Qwen3:14b
- Adjustable temperature based on needs (0.1-2.0)

**Settings:**
- **Provider selection** - Independent from parsing provider
- **Model selection** - Choose best model for analysis
- **Temperature** - Control creativity vs consistency

### Per-Provider Model Storage

**Smart model memory:**
- Models are stored per-provider
- Switch providers without losing model selections
- Each provider remembers its last selected model
- Seamless switching between cloud and local models

## 3. Task Chat

### Session Management

**Max Sessions:** Maximum number of chat sessions to keep

**Default:** 50 sessions
**Range:** 10-1000

**How it works:**
- Each chat conversation is a separate session
- When limit is reached, oldest sessions are automatically deleted
- Prevents unlimited accumulation in `data.json`
- Each session can have unlimited messages

**Note:** This controls the number of **sessions** (conversations), not messages per session.

### Chat History Context

**What it does:** Number of recent messages to send to AI as context

**Default:** 5 messages
**Range:** 1-100

**Impact:**
- **Higher values:** Better AI understanding, more token usage
- **Lower values:** Less context, lower cost
- **Dynamic tooltip:** Shows current value as you adjust

**Auto-cleanup:** Warnings and task references are automatically removed from context

### UI Settings

**Show Task Count:** Display task count in chat interface

**Auto-open Sidebar:** Open Task Chat automatically on Obsidian startup

**Streaming Responses:** Show AI responses in real-time as they're generated

## 4. Chat Mode

### Default Chat Mode

**Options:**
- **Simple Search** - Free, regex-based matching
- **Smart Search** - AI keyword expansion
- **Task Chat** - Full AI analysis

**Can override per-query** using dropdown in chat interface.

See [Chat Modes](CHAT_MODES.md) for detailed comparison.

## 5. Semantic Expansion

### Enable Semantic Expansion

**What it does:** AI expands keywords into multilingual synonyms

**Default:** Enabled

**Example:**
```
Query: "fix"
English: fix, repair, solve, correct, resolve
```

**Applies to:** Smart Search and Task Chat only

### Max Keyword Expansions

**What it does:** Number of variations per keyword per language

**Default:** 5  
**Range:** 1-10

**Calculation:**
```
Total keywords = Core keywords × Expansions × Languages

Example:
Query: "fix bug" (2 keywords)
Expansions: 5 per language
Languages: English (1 language)
Total: 2 × 5 × 1 = 10 keywords
```

### Query Languages

**What it does:** Languages to generate synonyms in

**Format:** Comma-separated language names

**Examples:**
```
English, Spanish
```

## 6. Datacore Integration

### Datacore Task Properties

Configure field names for task properties. Task Chat uses **Datacore** as the primary task indexing API (2-10x faster than Dataview).

**Note:** Datacore must be installed and enabled for Task Chat to work. See [Task Indexing](TASK_INDEXING.md) for setup details.

### Due Date Field

**Default:** `due`

**What it does:** Field names for due dates in Dataview

### Completed Date Field

**Default:** `completion`

### Created Date Field

**Default:** `created`

### Priority Field

**Default:** `p`

### Priority Mapping

Define which values map to each priority level:

**Priority 1 (highest):** `1, high`  
**Priority 2 (high):** `2, medium`  
**Priority 3 (medium):** `3, low`  
**Priority 4 (low):** `4, none`

## 7. Status Categories

Customize task status categories to match your workflow with advanced management features.

See [Status Categories](STATUS_CATEGORIES.md) for complete guide.

### Built-in Categories

Task Chat includes protected built-in categories:

- **Open** - Not started (symbol: space) - **Fully locked**
- **In Progress** - Currently working (symbol: `/`) - **Partially locked**
- **Completed** - Finished (symbols: `x`, `X`) - **Partially locked**
- **Cancelled** - Abandoned (symbol: `-`) - **Partially locked**
- **Other** - Catches unassigned symbols - **Fully locked**

**Protection levels:**
- **Fully locked:** Cannot modify any fields (Open, Other)
- **Partially locked:** Can modify some fields but not delete (In Progress, Completed, Cancelled)
- **Unlocked:** Can modify or delete (custom categories)

### Custom Categories

Add unlimited custom categories for your workflow:

**Examples:**
- **Blocked** - Waiting on dependencies (symbol: `?`)
- **Review** - Under review (symbol: `R`)
- **Important** - High priority (symbol: `!`)

**Add button:** Creates new category with auto-generated unique name

### Category Configuration

#### Basic Fields

- **Category key** - Internal identifier (camelCase)
- **Display name** - Shown in UI (human-readable)
- **Query aliases** - Alternative query names (comma-separated)
- **Symbols** - Checkbox characters (comma-separated)
- **Score** - Relevance weight (0.0-1.0)

#### Advanced Fields (Collapsible)

- **Display order** - Sort position (1, 2, 3...)
- **Description** - Helps AI understand category meaning
- **Semantic terms** - Keywords for AI recognition (multilingual support)

### Advanced Features

#### Auto-Organization

**What it does:** Automatically renumbers all categories with consistent gaps

**When to use:**
- Duplicate orders detected
- Want to reorganize categories
- Need clean numbering (10, 20, 30...)

**Gap calculation:** Smart gaps based on category count

### Category Management Actions

**Add Category:** Create new custom category
**Remove Category:** Delete custom categories (protected categories cannot be removed)
**Auto-Organize:** Renumber all categories with consistent gaps
**Reset to Defaults:** Restore built-in category configuration

## 8. Task Filtering

Control which tasks appear in results.

**See also:** [Task Filtering Guide](FILTERING.md) for detailed information on inclusions (filter interface) and exclusions (settings).

### Datacore Integration Status

**What it shows:** Real-time status of Datacore API availability

**Status indicators:**
- ✓ Datacore is ready
- ⚠️ Datacore is indexing...
- ❌ Datacore not installed

### Auto-Refresh Settings

**Enable auto-refresh:** Toggle automatic task count updates

**Refresh interval:** 10 seconds to 24 hours

### Exclusions

**Manage exclusions button:** Opens modal for managing excluded:
- Note-level tags
- Task-level tags
- Folders (including subfolders)
- Specific notes

**Fuzzy search:** Quick filtering in exclusions modal

See [Exclusions Guide](EXCLUSIONS.md) for detailed information.

### Completed Tasks

**Hide completed tasks:** Toggle to hide/show completed tasks

**Performance boost:** Hiding completed tasks can improve performance in large vaults

### Stop Words

**What it does:** Generic words filtered out during search

**Built-in:** the, a, that, etc.

**Custom stop words:** Add domain-specific terms

**Impact:** Filtering, Scoring, AI Prompts

### Minimum Relevance Score

**What it does:** Requires minimum keyword match quality

**Default:** 0% (disabled)  
**Range:** 0-120% (dynamic based on core keyword bonus)

**Use when:** Urgent tasks with weak keyword matches pass quality filter

**Note:** Only applies to keyword queries (skipped for properties-only)

### Quality Filter

**What it does:** Filters tasks by comprehensive score

**Formula:**
```
Score = (Due Date × D) + (Priority × P) + (Status × S)
Threshold = Max Score × Quality Filter %
```

**When to adjust:**
- Too many results? Increase value
- Too few results? Decrease value

## 9. Task Scoring

Control how much each factor affects task ranking with fine-grained sub-coefficients.

See [Scoring System](SCORING_SYSTEM.md) for complete details.

## 10. Task Sorting

Multi-criteria task ordering system with drag-and-drop interface.

See [Sorting System](SORTING_SYSTEM.md) for complete details.

### Sort Criteria

**Available criteria:**
- **Relevance** - Keyword match quality (locked, always first)
- **Due Date** - Task urgency
- **Priority** - Task importance
- **Status** - Task state
- **Created Date** - When task was created
- **Alphabetical** - Task text A-Z

**Default order:** [Relevance, Due date, Priority, Status]

### How Sorting Works

**Primary:** Tasks sorted by weighted score (coefficients)

**Secondary:** Tiebreaking by sort criteria order

**Example:**
```
Task A: Score 23.5 → Ranks higher
Task B: Score 23.5 → Same score, uses sort criteria
  If Due Date is first: Task B (earlier due date) appears first
  If Priority is first: Task A (higher priority) appears first
```

**Important:** Coefficients control importance, sort order is only for tiebreaking!

## 11. Task Display Limits

Control result limits for different search modes.

### Result Limits

**Max direct results (default: 20, range: 5-100):**
- Simple Search and Smart Search display limit
- Results shown without AI analysis
- No token cost
- Increase for more comprehensive results
- Decrease for more focused results

**Max tasks for AI (default: 100, range: 10-500):**
- Task Chat mode: Context sent to AI
- Higher = Better AI understanding, more expensive
- Lower = Faster, cheaper, less context
- Only applies to Task Chat mode

**Max AI recommendations (default: 20, range: 5-100):**
- Task Chat mode: AI's recommended task limit
- Final curated list after AI analysis
- AI selects most relevant from analyzed tasks

### Search & AI Settings

**Response Language:**
- Auto (match user input)
- English
- Custom instruction field

**Show AI Understanding:** Display detected language and property recognition

**Show Token Usage:** Display token counts and costs

**Streaming Responses:** Real-time AI response display

## 12. Advanced Settings

System prompts, cost tracking, and debug settings.

### System Prompt

**What it does:** Instructions that shape AI assistant behavior

**Default:** Pre-configured optimized prompt for task analysis

**Technical instructions:** Automatically appended internally (not shown)

**Customize when:**
- Specific tone needed (formal/casual)
- Domain expertise required
- Custom output format desired
- Industry-specific terminology

### Cost Tracking

View and manage AI usage statistics and costs.

**Pricing data:**
- Model count (number of models cached)
- Last pricing update (time since last refresh)
- Refresh button (update OpenRouter pricing data)

**Usage statistics:**
- Total tokens used (all-time)
- Total cost in USD (all-time)
- Per-message token and cost tracking

**Reset statistics:** Clear all accumulated usage data

**Cost tracking documentation:** Link to [Cost Tracking Guide](COST_TRACKING.md)

### Debug Logging

**Enable debug logging:** Toggle detailed console output

**What it logs:**
- API requests and responses
- Task filtering steps
- Scoring calculations
- Query parsing details
- Model provider operations

**Access console:** Press Ctrl/Cmd+Shift+I (Developer Tools)

**Performance impact:** Minimal, but generates more console output

**When to enable:**
- Troubleshooting issues
- Understanding plugin behavior
- Reporting bugs with detailed logs

## See Also

- [Chat Modes](CHAT_MODES.md) - Choose the right mode
- [Scoring System](SCORING_SYSTEM.md) - Understand task ranking
- [Status Categories](STATUS_CATEGORIES.md) - Customize task states
- [Semantic Expansion](SEMANTIC_EXPANSION.md) - Multilingual keyword expansion
- [Sorting System](SORTING_SYSTEM.md) - Multi-criteria sorting
