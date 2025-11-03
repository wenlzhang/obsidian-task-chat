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
- fix, repair, solve, correct, resolve, debug, patch

Result: Finds tasks with any of these terms!
```

**Configuration:**
- `Query languages`: Languages for expansion (e.g., "English")
- `Expansions per language`: Semantic variations per keyword per language (default: 5)
- `Enable semantic expansion`: Toggle on/off

### 2. Property Concept Recognition

**Purpose:** Convert natural language to inline format

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

**How it works:**
- AI recognizes **concepts**, not phrases
- Works in **any language** (not limited to configured languages!)
- Converts to standard inline format
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
English, Spanish
```

**How it works:**
- AI generates synonyms in each language
- Each keyword expanded in all languages
- Example with 1 language: "fix" → 3 variations (repair, solve, correct)

### Expansions Per Language

**What it is:** Number of semantic variations per keyword per language

**Default:** 5

**How it works:**
```
expansionsPerLanguage = 5
languages = 1 (English)

"fix" expands to:
- 5 English variations (repair, solve, correct)
= 5 total variations per keyword
```

### Enable Semantic Expansion

**What it is:** Master toggle for keyword expansion

**When disabled:**
- Keywords used as-is (no expansion)
- Property recognition still works
- Typo correction still works

**When enabled:**
- Keywords expanded to synonyms
- Better recall, more comprehensive results

## Custom Property Terms

Teach AI to recognize your custom terminology for task properties.

### Priority Terms

**Default terms:**
```
urgent, critical, high-priority, asap, now
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
```

## Optimization Tips

1. **Use Simple Search for exact matches**
   - No AI needed
   - Instant results
   - Best for queries with specific keywords
2. **Start with default settings (5 expansions, 1 language)**
   - Only increase if you notice missing results
   - Test before increasing permanently
3. **Add languages only if needed**
   - Default: English only
   - Add more only if your tasks use multiple languages
   - Each language multiplies token usage
4. **Adjust expansions based on vocabulary**
   - Technical tasks (code, API names)
   - General tasks (broad terminology)
   - Creative tasks (diverse vocabulary)
5. **Monitor token usage**
   - Check costs in metadata after queries
   - If costs too high, reduce expansions
   - If missing results, increase expansions

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
- Use explicit syntax (p:1 instead of "urgent")
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
