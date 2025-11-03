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

**Security:** API keys are stored locally in Obsidian's data folder.

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
- Lower temperature (0.1) for consistent JSON output

**Settings:**
- **Provider selection** - Can differ from main AI provider
- **Model selection** - Dropdown of available models
- **Temperature** - 0.0-2.0 (0.1 recommended for reliable JSON)
- **Auto-refresh** - Fetch latest models from provider

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
- **Auto-refresh** - Update model list

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
- Prevents unlimited accumulation in data.json
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
中文: 修复, 修理, 解决, 修正, 纠正
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
Languages: English + 中文 (2 languages)
Total: 2 × 5 × 2 = 20 keywords
```

### Query Languages

**What it does:** Languages to generate synonyms in

**Default:** English, 中文

**Format:** Comma-separated language names

**Examples:**
```
English, 中文
English, 中文, Japanese
English, Spanish, French
```

## 6. Datacore Integration

### Datacore Task Properties

Configure field names for task properties. Task Chat uses **Datacore** as the primary task indexing API (2-10x faster than Dataview).

**Note:** Datacore must be installed and enabled for Task Chat to work. See [Task Indexing](TASK_INDEXING.md) for setup details.

### Due Date Field

**Default:** `due`

**What it does:** Field names for due dates in Dataview

**Format:** Comma-separated

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

#### Validation System
**Duplicate order detection:**
- Warning appears if multiple categories share same order
- Shows which categories have conflicts
- One-click auto-fix available

**Visual indicators:**
- Lock icons (🔒) for protected fields
- Warning boxes for validation issues
- Status indicators for current state

#### Grid Layout
**Enhanced UI:**
- Horizontal grid with column headers
- Category key, Display name, Aliases, Symbols, Score
- Collapsible advanced fields section
- Remove buttons (custom categories only)

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

**Refresh interval:** 10 seconds to 24 hours (default: 30 seconds)

**Recommended values:**
- Small vaults (<500 tasks): 10-30 seconds
- Medium vaults (500-2000 tasks): 30-60 seconds
- Large vaults (2000+ tasks): 60-300 seconds

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

### Quality Filter

**What it does:** Filters tasks by comprehensive score

**Formula:**
```
Score = (Relevance × R) + (Due Date × D) + (Priority × P) + (Status × S)
Threshold = Max Score × Quality Filter %
```

**Default:** 0% (adaptive)

**Levels:**
- **0%** - Adaptive (auto-adjusts)
- **1-25%** - Permissive (broad results)
- **26-50%** - Balanced
- **51-75%** - Strict (focused results)
- **76-100%** - Very strict (near-perfect matches)

**When to adjust:**
- Too many results? Increase value
- Too few results? Decrease value

### Minimum Relevance Score

**What it does:** Requires minimum keyword match quality

**Default:** 0% (disabled)  
**Range:** 0-120% (dynamic based on core keyword bonus)

**Use when:** Urgent tasks with weak keyword matches pass quality filter

**Examples:**
- **0%** - Disabled (default)
- **20-30%** - Moderate filter
- **40-60%** - Strict filter
- **70%+** - Very strict

**Note:** Only applies to keyword queries (skipped for properties-only)

## 9. Task Scoring

Control how much each factor affects task ranking with fine-grained sub-coefficients.

See [Scoring System](SCORING_SYSTEM.md) for complete details.

### Main Weights

**Formula:**
```
Final Score = (Relevance × R) + (Due Date × D) + (Priority × P) + (Status × S)
```

**Defaults:** R:20, D:4, P:1, S:1 (Max: 26 points)

**Dynamic max score display:** Shows real-time calculation
```
Max possible score: R:20 + D:6 + P:1 + S:1 = 28 points
```
Based on your current sub-coefficient settings

**Common configurations:**

**Keyword-focused (R:30, D:2, P:1, S:1):**
- Emphasizes keyword matching

**Urgency-focused (R:20, D:10, P:5, S:1):**
- Emphasizes deadlines

**Importance-focused (R:15, D:3, P:10, S:1):**
- Emphasizes priority

**Balanced (R:10, D:10, P:10, S:1):**
- Equal weight to all factors

### Relevance Sub-Coefficients

**Core keyword match bonus (0.0-1.0, default: 0.2):**
- Bonus for exact query matches vs semantic expansions
- 0.0 = Pure semantic (all keywords equal)
- 0.5-1.0 = Strong preference for exact matches

### Due Date Sub-Coefficients

Control urgency curve:

- **Overdue:** 1.2 (most urgent)
- **Within 7 days:** 1.0
- **Within 1 month:** 0.5
- **Later:** 0.2
- **No due date:** 0.1

### Priority Sub-Coefficients

Control importance levels:

- **P1:** 1.0 (highest)
- **P2:** 0.75
- **P3:** 0.5
- **P4:** 0.2
- **None:** 0.1

### Status Sub-Coefficients

Managed per category in Status Categories section (Section 7).

**Default scores:**
- Open: 1.0
- In Progress: 0.8
- Completed: 0.3
- Cancelled: 0.1
- Other: 0.5

### Reset Options

Multiple reset buttons for easy restoration:

- **Reset all main weights** - R:20, D:4, P:1, S:1
- **Reset relevance sub-coefficients** - Core keyword match bonus
- **Reset due date sub-coefficients** - All time ranges
- **Reset priority sub-coefficients** - All priority levels

**Note:** Resetting refreshes the dynamic max score display

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

### Managing Criteria

**Tag-based UI:** Visual badges show active criteria

**Drag-and-drop:** Reorder criteria (coming soon)

**Remove button:** Click ✕ to remove non-locked criteria

**Add dropdown:** Select from available criteria to add

**Relevance locked:** Always first criterion (indicated by lock icon)

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

**Reset to default:** Restore recommended optimized prompt

### Pricing & Cost Tracking

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

## Common Scenarios

### Scenario 1: Too Many Irrelevant Results

**Problem:** Query "fix bug" returns 500 tasks including "task manager"

**Solutions:**
1. Add custom stop words: `task, work, item`
2. Increase quality filter
3. Add minimum relevance

### Scenario 2: Urgent Tasks Overwhelming Keywords

**Problem:** Query "implement feature" shows overdue docs/meetings

**Solution:** Add minimum relevance score

### Scenario 3: Keywords Dominate Too Much

**Problem:** Overdue P1 tasks buried in keyword matches

**Solution:** Adjust coefficients
- Relevance: 20 → 15 (decrease)
- Due Date: 4 → 8 (increase)
- Priority: 1 → 3 (increase)

### Scenario 4: Multilingual Tasks Not Matching

**Problem:** English query doesn't find Chinese tasks

**Solutions:**
1. Enable semantic expansion
2. Add Chinese to query languages
3. Increase max keyword expansions

### Scenario 5: Domain-Specific Generic Terms

**Problem:** In software development, "plugin" matches everything

**Solution:** Add to stop words: `plugin, feature, module, component`

## Best Practices

### Getting Started

1. **Start with defaults** - Try queries first
2. **Use Simple Search** - Free and fast for exact keywords
3. **Try Smart Search** - When you need multilingual/semantic matching
4. **Use Task Chat** - When you need AI analysis

### Optimizing Performance

1. **Quality filter** - Reduces tasks sent to AI
2. **Max tasks for AI** - Balance context vs cost
3. **Max keyword expansions** - 3-5 for speed, 7-10 for comprehensiveness

### Cost Management

1. **Use Simple Search** - Free (no AI)
2. **Smart Search** - ~$0.0001/query (depending on query length and model selection)
3. **Task Chat** - ~$0.0021/query (depending on query length, task count, and model selection)
4. **Monitor pricing data** - Track usage over time

### Troubleshooting

**No/Few Results:**
- Quality filter too strict → Decrease value
- Minimum relevance too high → Decrease or disable
- Stop words too aggressive → Remove domain terms

**Wrong Tasks Appearing:**
- Generic keywords → Add custom stop words
- Urgent tasks overwhelming → Add minimum relevance
- Quality filter too permissive → Increase value

**Wrong Task Order:**
- Check scoring coefficients (R, D, P, S)
- Remember: Coefficients control importance, not sort order
- Use reset buttons to restore defaults

### Advanced Tuning

1. **Adjust incrementally** - Change one setting at a time
2. **Test with queries** - See how results change
3. **Check console logs** - See detailed score breakdowns
4. **Use reset buttons** - Quick recovery from experiments
5. **Document your config** - Note why you chose specific values

## See Also

- [Chat Modes](CHAT_MODES.md) - Choose the right mode
- [Scoring System](SCORING_SYSTEM.md) - Understand task ranking
- [Status Categories](STATUS_CATEGORIES.md) - Customize task states
- [Semantic Expansion](SEMANTIC_EXPANSION.md) - Multilingual keyword expansion
- [Sorting System](SORTING_SYSTEM.md) - Multi-criteria sorting
