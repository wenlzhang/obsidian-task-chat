# Query Syntax Reference

This document provides a comprehensive guide to the query syntax used in Task Chat.

## Overview

Task Chat uses a **hybrid two-phase parsing system** that intelligently combines regex-based extraction with AI-powered understanding:

1. **Phase 1: Standard Property Extraction** - Fast regex patterns extract explicit property syntax (e.g., `p1`, `s:open`, `overdue`)
2. **Phase 2: AI Processing** - Remaining keywords and natural language are processed using AI for semantic understanding

This approach provides:
- **Speed**: Instant results for simple property queries
- **Flexibility**: Natural language support in multiple languages
- **Cost-efficiency**: AI only used when needed

---

## Query Types

Task Chat supports three query types, each optimized for different use cases:

### 1. Pure Property Queries

Queries containing **only standard property syntax** with no keywords.

**Examples:**
```
p1 overdue s:open
today p2
status:completed p:1
due:tomorrow priority:1
```

**Processing:**
- Regex extraction only (no AI)
- Works in all chat modes

**Best for:** Quick, precise filtering when you know exactly what you want

---

### 2. Mixed Queries

Queries combining **keywords/natural language + property syntax**.

**Examples:**
```
Fix bug p1 overdue
urgent meeting s:open today
write documentation p2 due:this week
```

**Processing:**
1. Properties extracted via regex (instant)
2. Keywords expanded via AI (semantic matching)
3. Results filtered by both

**Best for:** Natural searching with specific constraints

---

### 3. Pure Question/Natural Language Queries

Queries that are **completely natural language** without explicit property syntax.

**Examples:**
```
What urgent tasks should I work on?
Show me overdue high-priority items
Which tasks are due this week?
```

**Processing:**
- AI parses everything (keywords + properties)
- Full natural language understanding
- Available in Task Chat mode

**Best for:** Conversational queries, analysis, and recommendations

---

## Standard Task Properties

Task Chat recognizes the following Datacore task properties (some are work in progress):

| Property | Type | Description | Example Values |
|----------|------|-------------|----------------|
| `text` | string | Task text content | "Fix bug in settings page" |
| `status` | string | Status symbol | ` ` (space), `x`, `/`, `!` |
| `statusCategory` | string | Status category | `open`, `completed`, `inProgress`, `cancelled` |
| `priority` | number | Priority level | `1` (highest), `2`, `3`, `4` (lowest), `undefined` (none) |
| `dueDate` | string | Due date | `2025-11-15` (YYYY-MM-DD format) |
| `createdDate` | string | Creation date | `2025-11-01` |
| `completedDate` | string | Completion date | `2025-11-07` |
| `tags` | string[] | Task-level tags | `["#work", "#urgent"]` |
| `noteTags` | string[] | Note-level tags | `["#project-alpha", "#project-beta"]` |
| `sourcePath` | string | File path | `Projects/Development.md` |
| `folder` | string | Folder path | `Projects` |
| `lineNumber` | number | Line number in file | `42` |

### Priority Levels

```
1 = P1 = Highest priority
2 = P2 = High priority
3 = P3 = Medium priority
4 = P4 = Low priority
undefined = No priority assigned
```

### Status Categories

```
open       = Not started, to-do
inProgress = Currently working on
completed  = Finished, done
cancelled  = Abandoned, dropped
```

> **Note:** You can customize status categories and symbols in Settings → Status categories

---

## Non-Standard Task Properties

Beyond standard properties, Task Chat supports:

### 1. Custom Status Categories

Define your own status categories in Settings with:
- **Custom symbols** (e.g., `!`, `?`, `~`, `>`)
- **Custom display names** (e.g., "Blocked", "Waiting", "Review")
- **Custom terms** for natural language queries
- **Custom sort order**

**Example custom statuses:**
```
!  = Important
?  = Question
>  = Deferred
```

### 2. Datacore Custom Fields

Access any custom fields from Datacore:

- Inline fields in task text
- Custom date field: `due`
- Custom priority field: `p`

---

## Query Syntax Details

### Status Filters

The plugin supports flexible status querying:

#### Symbol-based Status

```
s:x            → x (completed)
s:/            → / (in-progress)
s:!            → ! (custom status)
s:x,/          → Multiple: completed OR in-progress
```

Note: In all the queries above, `s` can be replaced with `status`.

#### Category-based Status

```
s:open         → Open tasks
s:completed    → Completed tasks
s:inprogress   → In-progress tasks
s:cancelled    → Cancelled tasks
status:blocked → Custom status category
```

#### Natural Language Status

```
open tasks
completed items
tasks in progress
```

> **Multilingual Support:** Status terms are recognized in English and other configured languages.

---

### Priority Filters

#### Shorthand Syntax

```
p1             → Priority 1 (highest)
p2             → Priority 2 (high)
p3             → Priority 3 (medium)
p4             → Priority 4 (low)
p1,p2,p3       → Priority 1 OR 2 OR 3
```

#### Full Syntax

```
priority:1     → Priority 1
priority:2,3   → Priority 2 OR 3
p:1            → Short form
p:all          → All priorities
p:any          → Any priority, same as p:all
p:none         → No priority
```

#### Natural Language Priority

```
urgent tasks
high priority items
top priority
```

---

### Due Date Filters

Task Chat supports flexible date filtering:

#### Keyword-based Dates

```
due            → Tasks with any due date
overdue        → Past due tasks
today          → Due today
tomorrow       → Due tomorrow
```

#### Relative Date Ranges

```
this week      → Due this week
next week      → Due next week
this month     → Due this month
next month     → Due next month
```

#### Specific Dates

```
due:today      → Due today
due:tomorrow   → Due tomorrow
due:2025-11-15 → Specific date (YYYY-MM-DD)
```

#### Natural Language Dates

The plugin uses `chrono-node` for natural language date parsing:

```
due next Friday
due in 3 days
due next month
due by end of week
```

#### Special Cases

```
due:none        → Tasks without due dates
due:all         → Tasks with any due date
due:any         → Tasks with any due date, same as due:all
```

---

### Folder and Tag Filters

Filter tasks by their location or tags:

- Include/exclude tasks from specific folders, notes, or with specific tags
- Learn more in [Filtering](./FILTERING.md) and [Exclusions](./EXCLUSIONS.md)

#### Folder Filtering

```
folder:Projects
folder:"Work/Active Projects"
```

#### Task-level Tag Filtering

Tags directly on the task line:

```
tags with #project-alpha
tasks tagged #development
```

#### Note-level Tag Filtering

Tags from note frontmatter or content:

```
from notes tagged project-alpha
in notes with tag development
note tags: work, urgent
```

---

## Keywords and Semantic Expansion

Keywords are the **content words** in your query that remain after extracting standard property syntax.

### How It Works

1. **Standard properties are extracted** (e.g., `p1`, `overdue`, `s:open`)
2. **Remaining words become keywords** (e.g., `fix`, `bug`, `meeting`)
3. **Keywords are semantically expanded** across configured languages

### Expansion Example

Query: `fix bug p1 overdue`

**Standard Properties (extracted):**
- Priority: 1
- Due date: overdue

**Keywords (expanded, Smart Search and Task Chat modes):**
- `fix` → `["fix", "repair", "solve", "correct", "resolve", ...]`
- `bug` → `["bug", "error", "issue", "defect", "problem", ...]`

### Configuration

Control semantic expansion in Settings:

- **Expansions per keyword:** 1-25 (default: 5)
- **Languages for expansion:** English, Spanish, etc.
- **Total expansions = Per keyword × Languages**

Example: 5 × 2 languages = 10 total expansions per keyword

### Property Terms vs Content Keywords

**Important distinction:**

| Property Terms | Content Keywords |
|----------------|------------------|
| **NOT expanded** | **Expanded** |
| Direct concept recognition | Semantic matching |
| Examples: `urgent`, `high priority`, `overdue`, `open` | Examples: `fix`, `bug`, `meeting`, `review` |
| Converted to Datacore format | Matched against task text |
| Recognized in any language | Expanded across configured languages |

**Example:**

Query: `urgent bug fix overdue`

- `urgent` → Property term → Mapped to `priority: 1` (NOT expanded)
- `overdue` → Property term → Mapped to `dueDate: "overdue"` (NOT expanded)
- `bug` → Content keyword → Expanded to `["bug", "error", "issue", ...]`
- `fix` → Content keyword → Expanded to `["fix", "repair", "solve", ...]`

---

## Mixed Queries

Mixed queries combine property syntax with natural language keywords, offering the best of both worlds:

```
fix bug p1 overdue
→ Properties: p1, overdue
→ Keywords: fix, bug

urgent meeting s:open today
→ Properties: open, today
→ Keywords: meeting

write documentation p2 due:this week
→ Properties: p2, this week
→ Keywords: write, documentation
```

### Benefits of Mixed Queries

1. **Precision + Flexibility** - Exact filtering with semantic search
2. **Speed** - Properties extracted instantly, keywords expanded efficiently
3. **Multilingual** - Mix languages naturally

---

## Query Examples

### Complex Filtering Examples

**Multiple Filters:**
```
p1 overdue s:open
→ P1, overdue, open tasks

p2 due:this week s:inprogress
→ P2, due this week, in progress

today urgent !#cancelled
→ Due today, urgent, not cancelled
```

---

## Advanced Tips

### 1. Combining Search Modes

Switch between modes based on your needs:
- Start with **Simple Search** for quick filtering
- Use **Smart Search** when you need semantic matching
- Switch to **Task Chat** for analysis and recommendations

### 2. Building Complex Queries Incrementally

Start simple, add filters:
```
Step 1: p1              → See all P1 tasks
Step 2: p1 overdue      → Add overdue filter
Step 3: p1 overdue fix  → Add keyword
Step 4: p1 overdue fix bug #work → Add more keywords/tags
```

### 3. Custom Status Categories

Define task states that match your workflow:
```
! = Important
? = Question/Clarification needed
> = Deferred
```

---

## Summary

Task Chat's query syntax provides:

✅ **Flexible** - From simple filters to natural language
✅ **Fast** - Instant regex extraction for properties
✅ **Smart** - AI-powered semantic understanding
✅ **Multilingual** - English, Spanish, and more
✅ **Cost-effective** - Pay only for AI features you use

**Key Takeaways:**

1. **Property syntax** (`p1`, `overdue`, `s:open`) = Fast, free, precise
2. **Keywords** = Semantically expanded, multilingual matching
3. **Mixed queries** = Best of both worlds
4. **Natural language** = Full AI understanding and analysis

Start with simple property queries, add keywords for flexibility, and use natural language for complex analysis. The syntax grows with your needs!

---

## See Also

- [Chat Modes](CHAT_MODES.md) - Understanding Simple, Smart, and Task Chat modes
- [Semantic Expansion](SEMANTIC_EXPANSION.md) - How keywords are expanded
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked
- [Settings Guide](SETTINGS_GUIDE.md) - Configure your query behavior
