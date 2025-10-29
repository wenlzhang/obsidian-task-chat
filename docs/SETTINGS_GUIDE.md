# Settings Guide

Complete guide to configuring Task Chat for your workflow.

## Settings Overview

Task Chat settings are organized into 10 main sections:

1. **AI Provider** - Configure your AI service
2. **Task Chat** - Chat interface settings
3. **Chat Mode** - Choose default mode
4. **Semantic Expansion** - Multilingual keyword expansion
5. **DataView Integration** - Task property fields
6. **Status Category** - Custom task status
7. **Task Filtering** - Control which tasks appear
8. **Task Scoring** - Weight importance factors
9. **Task Display** - Result limits and sorting
10. **Advanced** - System prompts and expert settings

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

### Refresh Models

Click "Refresh" to fetch latest models from your provider's API.

## 2. Task Chat

### Max Chat History

**What it does:** Max number of chat sessions to keep in history

**Default:** 50 sessions

### Max Response Length (Max Tokens)

**What it does:** Maximum length of AI responses

**Default:** 2000 tokens

### Temperature

**What it does:** Controls AI creativity vs consistency

**Range:** 0.0-2.0  
**Default:** 0.1

**Guide:**
- **0.0-0.3** - Precise, factual, consistent
- **0.4-0.7** - Balanced creativity (recommended)
- **0.8-1.2** - Creative, varied responses
- **1.3-2.0** - Very creative, less predictable

## 3. Chat Mode

### Default Chat Mode

**Options:**
- **Simple Search** - Free, regex-based matching
- **Smart Search** - AI keyword expansion
- **Task Chat** - Full AI analysis

**Can override per-query** using dropdown in chat interface.

See [Chat Modes](CHAT_MODES.md) for detailed comparison.

## 4. Semantic Expansion

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

## 5. Dataview Integration

### Dataview Task Properties

Configure field names that Dataview uses for task properties.

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

## 6. Status Category

Customize task status categories to match your workflow.

See [Status Categories](STATUS_CATEGORIES.md) for complete guide.

### Built-in Categories

- **Open** - Not started (symbol: space)
- **In Progress** - Currently working (symbol: `/`)
- **Completed** - Finished (symbols: `x`, `X`)
- **Cancelled** - Abandoned (symbol: `-`)
- **Other** - Catches unassigned symbols

### Custom Categories

Add your own categories:

**Examples:**
- **Question** - Waiting on dependencies (symbol: `?`)
- **Review** - Under review (symbol: `R`)
- **Important** - High priority (symbol: `!`)

### Category Fields

For each category, configure:

- **Display name** - Shown in UI
- **Symbols** - Checkbox characters (comma-separated)
- **Score** - Relevance weight (0.0-1.0)
- **Order** - Display position (1, 2, 3...)
- **Aliases** - Query alternatives (comma-separated)
- **Description** - For AI understanding (optional)
- **Terms** - Semantic keywords (optional)

## 7. Task Filtering

Control which tasks appear in results.

**See also:** [Task Filtering Guide](FILTERING.md) for detailed information on inclusions (filter interface) and exclusions (settings).

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

## 8. Task Scoring

Control how much each factor affects task ranking.

See [Scoring System](SCORING_SYSTEM.md) for complete details.

### Main Weights

**Formula:**
```
Final Score = (Relevance × R) + (Due Date × D) + (Priority × P) + (Status × S)
```

**Defaults:** R:20, D:4, P:1, S:1 (Max: 32 points)

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

Managed per category in Status Category section.

### Reset Options

Five reset buttons for easy restoration:

- **Reset all main weights** - R:20, D:4, P:1, S:1
- **Reset all sub-coefficients** - All advanced settings
- **Reset relevance core keyword match bonus** - 0.2
- **Reset due date sub-coefficients** - All time ranges
- **Reset priority sub-coefficients** - All priority levels

## 9. Task Display

Control result limits and sorting behavior.

### Result Limits

**Max direct results (default: 20):**
- Simple Search display limit
- Increase for more comprehensive results
- Decrease for more relevant results

**Max tasks for AI (default: 100):**
- Context sent to AI in Task Chat mode
- Higher = Better AI understanding, more expensive
- Lower = Faster, cheaper, less context

**Max AI recommendations (default: 20):**
- AI's recommended task limit
- Final curated list after analysis

### Task Sort Order

**What it does:** Multi-criteria sorting

**Default:** [Relevance, Due date, Priority, Status]

**How it works:**
1. Tasks scored by weighted formula
2. Sorted by score (primary)
3. Tiebreaking by sort order (secondary)

**Important:** Coefficients control importance, not sort order!

**Example:**
```
Coefficients: R:20, D:4, P:1
Task A: (0.8 × 20) + (1.5 × 4) + (1.0 × 1) = 23 points
Task B: (0.9 × 20) + (0.5 × 4) + (0.75 × 1) = 20.75 points

Task A ranks higher (23 > 20.75)
Sort order only matters if scores are exactly equal
```

**Customization:**
- Click ✕ to remove criteria
- Use dropdown to add criteria
- Relevance always first (locked)

### Show Token Usage

Toggle display of token usage statistics in chat interface.

## 10. Advanced

### System Prompt

**What it does:** Instructions that shape AI assistant behavior

**Default:** Pre-configured for task analysis

**Customize when:**
- Specific tone needed (formal/casual)
- Domain expertise required
- Custom output format desired

### Pricing Data

View and manage token usage costs.

**Shows:**
- Total tokens used
- Total cost (USD)

**Reset:** Clear statistics to start fresh

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
