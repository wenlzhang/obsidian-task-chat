# Semantic Expansion

Semantic expansion uses AI to understand your queries better and find more relevant tasks.

## What is Semantic Expansion?

When you search for "fix", semantic expansion automatically includes related terms like:
- "repair"
- "solve"
- "correct"
- "resolve"
- "debug"

This happens in **multiple languages** based on your configured query languages.

## How It Works

### 1. Keyword Semantic Expansion

**Purpose:** Better recall - find tasks even if they use different words

**Example:**
```
Your query: "fix bug"

AI expands to:
- English: fix, repair, solve, correct, resolve, debug, patch
- 中文: 修复, 解决, 修正, 纠正, 修理

Result: Finds tasks with any of these terms!
```

**Configuration:**
- `Query languages`: Languages for expansion (e.g., "English, 中文, Svenska")
- `Max keyword expansions`: Maximum variations per keyword per language (default: 5)
- `Enable semantic expansion`: Toggle on/off

### 2. Property Concept Recognition

**Purpose:** Convert natural language to DataView format

**Examples:**

**Priority:**
```
You type: "urgent tasks"
AI understands: priority:1

You type: "low priority items"  
AI understands: priority:4
```

**Status:**
```
You type: "working on"
AI understands: status:inprogress

You type: "completed items"
AI understands: status:completed
```

**Due Date:**
```
You type: "overdue tasks"
AI understands: dueDate:overdue

You type: "tasks due this week"
AI understands: dueDate:week
```

**Multilingual:**
```
You type: "紧急未完成任务" (Chinese: urgent incomplete tasks)
AI understands: priority:1, status:open

You type: "过期任务" (Chinese: overdue tasks)
AI understands: dueDate:overdue
```

**How it works:**
- AI recognizes **concepts**, not phrases
- Works in **any language** (not limited to configured languages!)
- Converts to standard DataView format
- No pre-programmed translations needed

### 3. Automatic Typo Correction

**Purpose:** Fix common typing mistakes

**Examples:**
```
You type: "urgnt taks"
AI corrects: "urgent tasks"

You type: "complted itmes"
AI corrects: "completed items"
```

## Configuration

### Query Languages

**What it is:** Languages for keyword expansion

**Format:** Comma-separated list
```
English, 中文
```

**How it works:**
- AI generates synonyms in each language
- Each keyword expanded in all languages
- Example: "fix" → 5 English + 5 中文 = 10 variations

**Tip:** Add languages you use in your tasks

### Max Keyword Expansions

**What it is:** Maximum variations per keyword per language

**Default:** 5

**How it works:**
```
maxExpansions = 5
languages = 2 (English, 中文)

"fix" expands to:
- 5 English variations
- 5 中文 variations
= 10 total variations per keyword
```

**Tip:** 
- Higher = Better recall but more tokens
- Lower = Faster but might miss some tasks
- 5 is a good balance

### Enable Semantic Expansion

**What it is:** Master toggle for keyword expansion

**When disabled:**
- Keywords used as-is (no expansion)
- Property recognition still works
- Typo correction still works

**When enabled:**
- Keywords expanded to synonyms
- Better recall, more comprehensive results

### Enable Natural Language Queries

**What it is:** Allow conversational queries

**Examples when enabled:**
```
"What should I work on today?"
"Show me urgent tasks that are overdue"
"Find tasks I need to finish this week"
```

**When disabled:**
- Only standard syntax works (priority:1, s:open)
- More predictable behavior

### Enable Typo Correction

**What it is:** Automatically fix typing mistakes

**When enabled:**
- "urgnt" → "urgent"
- "complted" → "completed"
- "taks" → "tasks"

**When disabled:**
- Exact spelling required
- Faster processing

## Custom Property Terms

Teach AI to recognize your custom terminology for task properties.

### Priority Terms

**Default terms:**
```
urgent, critical, important, high-priority, asap, now
low, minor, trivial, someday, backlog
```

**Add your own:**
```
must-do, top-priority, emergency
nice-to-have, optional, future
```

**How it works:**
- AI learns your terminology
- Maps to priority levels (1-4)
- Works in any language

### Status Terms

**Default terms:**
```
open, todo, new, unstarted, incomplete
inprogress, working, ongoing, current
completed, done, finished, closed
cancelled, abandoned, dropped
```

**Add your own:**
```
blocked, waiting, on-hold
in-review, testing, qa
archived, obsolete
```

### Due Date Terms

**Default terms:**
```
overdue, late, past-due
today, now, immediate
tomorrow, next, upcoming
week, month, year
```

**Add your own:**
```
asap, urgent-deadline
this-sprint, next-sprint
q1, q2, q3, q4
```

## Performance Considerations

### Token Usage

**Per query (Smart Search):**
- Base prompt: ~100 tokens
- Keyword expansion: ~50-100 tokens per keyword
- Property recognition: ~50 tokens
- Total: ~200-500 tokens per query

**Example cost (GPT-4o-mini):**
- Input: $0.00015 per 1K tokens
- 500 tokens = $0.000075 per query
- Very affordable!

### Speed

**Typical response time:**
- Simple Search: Instant (no AI)
- Smart Search: 0.5-2 seconds (keyword expansion)
- Task Chat: 2-10 seconds (expansion + analysis)

### Optimization Tips

1. **Use Simple Search for exact matches**
   - No AI needed
   - Instant results

2. **Limit max expansions for speed**
   - 3-5 is usually sufficient
   - Higher values = more tokens

3. **Configure only needed languages**
   - Each language adds tokens
   - Only add languages you actually use

4. **Disable features you don't need**
   - Turn off typo correction if not needed
   - Disable natural language for predictable queries

## Troubleshooting

### Expansion not working

**Check:**
- ✅ Semantic expansion enabled
- ✅ Query languages configured
- ✅ Max expansions > 0
- ✅ Valid API key

### Too many/few results

**Adjust:**
- Max keyword expansions (higher = more results)
- Quality filter percentage (lower = more results)
- Minimum relevance score (lower = more results)

### Wrong property recognition

**Fix:**
- Add custom property terms
- Use explicit syntax (priority:1 instead of "urgent")
- Check query language configuration

### High token usage

**Reduce:**
- Lower max keyword expansions
- Reduce number of query languages
- Use Simple Search for exact matches
- Disable typo correction if not needed

## Examples

### Basic Expansion

**Query:** `fix`

**Without expansion:**
- Finds only tasks with "fix"

**With expansion:**
- Finds: fix, repair, solve, correct, resolve, debug, patch
- In multiple languages!

### Natural Language

**Query:** `urgent tasks I need to finish today`

**AI understands:**
- Keywords: urgent, finish
- Property: priority:1 (from "urgent")
- Property: dueDate:today (from "today")
- Expands: urgent → critical, important, high-priority
- Expands: finish → complete, done, finalize

### Multilingual

**Query:** `修复错误` (Chinese: fix bug)

**AI expands:**
- 修复 → 修复, 解决, 修正, 纠正, 修理
- 错误 → 错误, bug, 问题, 故障, 缺陷
- Also adds English: fix, repair, solve, bug, error, issue

### Custom Terms

**Your custom priority terms:** `must-do, top-priority`

**Query:** `must-do tasks`

**AI understands:**
- "must-do" → priority:1 (from your custom terms)
- Expands keywords normally
- Finds high-priority tasks!

## See Also

- [Chat Modes](CHAT_MODES.md) - When to use each mode
- [Scoring System](SCORING_SYSTEM.md) - How relevance is calculated
- [Sorting System](SORTING_SYSTEM.md) - How tasks are ordered
