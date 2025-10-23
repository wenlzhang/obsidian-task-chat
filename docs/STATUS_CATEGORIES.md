# Status Categories

Status categories allow you to organize tasks by their state (open, in-progress, completed, etc.) with flexible customization.

## Overview

Each status category has:
- **Symbols:** Checkbox characters (e.g., `x`, `/`, `!`)
- **Score:** Relevance weight for search ranking (0.0-1.0)
- **Order:** Display position when sorting by status (1, 2, 3...)
- **Display name:** Human-readable name
- **Aliases:** Alternative names for querying

## Score vs Order

**This is important!** Score and Order are completely independent.

### Score (0.0-1.0)

**Purpose:** Relevance weight in search ranking

**Used in:** Scoring formula
```
finalScore = (Relevance × 20) + (Due Date × 4) + (Priority × 1) + (Status × 1)
                                                                      ↑
                                                              Uses config.score
```

**Effect:** Higher score = more relevant in searches

**Example:**
```typescript
{
    open: { score: 1.0 },      // Open tasks are HIGHLY relevant
    completed: { score: 0.3 }  // Completed tasks are LESS relevant
}
```

**Use case:** Control which status categories appear in search results

### Order (1, 2, 3...)

**Purpose:** Display position when sorting by status

**Used in:** Sorting algorithm
```typescript
comparison = aOrder - bOrder;  // Lower order appears first
```

**Effect:** Lower order = appears first in list

**Example:**
```typescript
{
    open: { order: 1 },        // Appears FIRST
    inProgress: { order: 2 },  // Appears SECOND
    completed: { order: 6 }    // Appears LAST
}
```

**Use case:** Control task order when sorting by status criterion

### They Are Independent!

**Changing score doesn't affect order:**
```typescript
// Increase relevance of completed tasks
completed: { score: 0.8, order: 6 }
// Result: Completed tasks rank higher in searches
//         BUT still appear last when sorting by status
```

**Changing order doesn't affect score:**
```typescript
// Move completed tasks to appear first
completed: { score: 0.3, order: 1 }
// Result: Completed tasks appear first when sorting
//         BUT still have low relevance in searches
```

## Built-in Categories

### Open

**Default symbols:** ` ` (space)
**Default score:** 1.0
**Default order:** 1
**Description:** Tasks not yet started or awaiting action

**Locked:** Cannot be deleted, symbols cannot be changed

**Use case:** Default Markdown open task

### In Progress

**Default symbols:** `/`
**Default score:** 0.8
**Default order:** 2
**Description:** Tasks currently being worked on

**Partially locked:** Can modify symbols and display name

**Use case:** Active work

### Completed

**Default symbols:** `x`, `X`
**Default score:** 0.3
**Default order:** 6
**Description:** Tasks that have been finished

**Partially locked:** Can modify symbols and display name

**Use case:** Finished tasks

### Cancelled

**Default symbols:** `-`
**Default score:** 0.1
**Default order:** 7
**Description:** Tasks that were abandoned or cancelled

**Partially locked:** Can modify symbols and display name

**Use case:** Abandoned work

### Other

**Default symbols:** All unassigned symbols
**Default score:** 0.5
**Default order:** 999
**Description:** Catches all unassigned symbols automatically

**Locked:** Cannot be deleted

**Use case:** Fallback for unrecognized symbols

## Custom Categories

You can add custom categories for your workflow!

### Examples

**Blocked:**
```typescript
{
    blocked: {
        symbols: ["?"],
        score: 0.9,  // High relevance (needs attention)
        order: 3,    // After in-progress
        displayName: "Blocked",
        aliases: "blocked,waiting,stuck"
    }
}
```

**Review:**
```typescript
{
    review: {
        symbols: ["R", "r"],
        score: 0.7,  // Moderate relevance
        order: 4,    // After blocked
        displayName: "In review",
        aliases: "review,reviewing,qa"
    }
}
```

**Important:**
```typescript
{
    important: {
        symbols: ["!", "I"],
        score: 1.0,  // High relevance
        order: 2,    // After open, with in-progress
        displayName: "Important",
        aliases: "important,critical,urgent"
    }
}
```

## Field Descriptions

### Category Key

**What it is:** Internal identifier

**Format:** camelCase, no spaces or special characters

**Examples:**
- `important`
- `blocked`
- `inReview`
- `tendency`

**Editable:** Yes (for custom categories)

### Display Name

**What it is:** Human-readable name shown in UI

**Format:** Sentence case recommended

**Examples:**
- "Important"
- "Blocked"
- "In review"
- "Tendency"

**Editable:** Yes (even for built-in categories except Open/Other)

### Query Aliases

**What it is:** Alternative names for querying

**Format:** Comma-separated, NO SPACES

**Examples:**
```
completed,done,finished
inprogress,wip,doing,active
blocked,waiting,stuck,on-hold
```

**How it works:**
- Case-insensitive
- Hyphen-tolerant (`in-progress` = `inprogress`)
- All aliases work in queries

**Query examples:**
```
s:done          → Finds completed tasks
s:wip           → Finds in-progress tasks
s:blocked       → Finds blocked tasks
s:done,wip      → Finds completed OR in-progress tasks
```

### Symbols

**What it is:** Checkbox characters that map to this category

**Format:** Comma-separated

**Examples:**
```
x,X             → Both x and X map to completed
/               → Forward slash maps to in-progress
!,I,b           → Multiple symbols map to important
```

**How it works:**
- Each symbol can only belong to one category
- Tasks with these symbols are categorized accordingly
- Compatible with Task Marker and similar plugins

### Score

**What it is:** Relevance weight for search ranking

**Range:** 0.0-1.0

**Guidelines:**
- **1.0:** High relevance (open, important, blocked)
- **0.7-0.9:** Moderate relevance (in-progress, review)
- **0.3-0.5:** Low relevance (completed, archived)
- **0.1:** Very low relevance (cancelled, deleted)

**Effect:** Controls how tasks appear in search results

### Order

**What it is:** Display position when sorting by status

**Range:** 1, 2, 3... (positive integers)

**Guidelines:**
- **1-2:** Active work (open, in-progress)
- **3-5:** Blocked/waiting states
- **6-7:** Finished work (completed, cancelled)
- **8+:** Custom categories

**Effect:** Controls task order when sorting by status criterion

**Auto-numbering:** If not set, system auto-assigns based on position (10, 20, 30...)

### Description (Optional)

**What it is:** Category meaning for AI prompts

**Purpose:** Helps AI understand your custom categories

**Examples:**
```
"High-priority urgent tasks requiring immediate attention"
"Tasks waiting for external dependencies"
"Tasks under review or testing"
```

**When to set:** For custom categories to help AI understand them

### Terms (Optional)

**What it is:** Semantic terms for recognition

**Format:** Comma-separated

**Purpose:** Helps AI recognize this category in natural language queries

**Examples:**
```
"urgent, critical, important, high-priority, asap, now"
"blocked, waiting, stuck, on-hold, paused, pending"
"review, reviewing, testing, qa, checking, validating"
```

**Multilingual support:** Add terms in multiple languages!

## Query Syntax

### Basic Queries

**Single status:**
```
s:open          → Open tasks
s:completed     → Completed tasks
s:inprogress    → In-progress tasks
```

**Multiple statuses:**
```
s:open,inprogress       → Open OR in-progress
s:done,cancelled        → Completed OR cancelled
```

**Using aliases:**
```
s:done          → Same as s:completed
s:wip           → Same as s:inprogress
s:finished      → Same as s:completed
```

**Using symbols:**
```
s:x             → Completed tasks (symbol x)
s:/             → In-progress tasks (symbol /)
s:!             → Important tasks (symbol !)
```

**Mix freely:**
```
s:open,/,?      → Open OR in-progress OR blocked
s:done,x,X      → Completed tasks (multiple ways)
```

### Advanced Queries

**Combine with other filters:**
```
urgent s:open priority:1        → Urgent open high-priority tasks
fix bug s:inprogress due:today  → In-progress bug fixes due today
s:blocked priority:1            → Blocked high-priority tasks
```

**Natural language (Smart Search/Task Chat):**
```
"show me blocked tasks"         → AI converts to s:blocked
"what's in progress?"           → AI converts to s:inprogress
"completed items"               → AI converts to s:completed
```

## Tips

### Designing Your Categories

**Keep it simple:**
- 5-7 categories is usually enough
- Too many categories = harder to manage

**Use meaningful symbols:**
- `/` for in-progress (half-done)
- `?` for blocked (questioning)
- `!` for important (emphasis)
- `R` for review (first letter)

**Set appropriate scores:**
- Active work: 0.8-1.0
- Waiting states: 0.6-0.8
- Finished work: 0.1-0.3

**Set logical order:**
- Active work first (1-2)
- Waiting states middle (3-5)
- Finished work last (6-7)

### For Better Searches

**Use status filters:**
```
s:open          → Only active tasks
s:open,blocked  → Active or blocked
s:!completed    → Everything except completed
```

**Combine with keywords:**
```
urgent s:open           → Urgent open tasks
fix s:inprogress        → In-progress fixes
review s:blocked        → Blocked reviews
```

**Use aliases:**
- Add common terms you use
- Makes queries more intuitive
- Example: `wip,doing,active` for in-progress

### For Better Organization

**Use custom categories for your workflow:**
- Development: `open`, `inProgress`, `review`, `testing`, `done`
- Research: `open`, `researching`, `analyzing`, `writing`, `done`
- Personal: `open`, `doing`, `waiting`, `done`, `someday`

**Set scores based on priority:**
- High-priority categories: 0.9-1.0
- Normal categories: 0.7-0.8
- Low-priority categories: 0.3-0.5

**Set order based on workflow:**
- Current work: 1-3
- Waiting/blocked: 4-5
- Finished: 6-7
- Archive/someday: 8+

## Validation & Auto-Fix

### Duplicate Order Detection

**What it checks:** Multiple categories with same order number

**Warning shown:**
```
⚠️ Duplicate Sort Orders Detected

Order 2 is used by multiple categories: Blocked, In Progress, Review.
This may cause unpredictable sorting behavior.

[Auto-Fix Now]
```

**Auto-fix:**
- Renumbers all categories
- Assigns gaps: 10, 20, 30...
- Preserves relative order
- One-click solution!

### Effective Order Display

**Shows current order:**
```
Sort order: Currently using default: 1
```

**Or:**
```
Sort order: Current effective order: 2
```

**Helps you understand:**
- What order is actually being used
- Whether it's explicit or default
- Where category appears in sorting

## Compatibility

**Task Marker:**
- Compatible with Task Marker symbols
- Use same symbols for consistency
- Both plugins can coexist

**Minimal Theme:**
- Proper status symbol display
- Recommended for best appearance

**DataView:**
- Status categories work with DataView queries
- Can filter by status in DataView

## Examples

### Development Workflow

```typescript
{
    open: { symbols: [" "], score: 1.0, order: 1 },
    inProgress: { symbols: ["/"], score: 0.9, order: 2 },
    review: { symbols: ["R"], score: 0.8, order: 3 },
    testing: { symbols: ["T"], score: 0.7, order: 4 },
    completed: { symbols: ["x"], score: 0.3, order: 5 },
    cancelled: { symbols: ["-"], score: 0.1, order: 6 }
}
```

### Personal Tasks

```typescript
{
    open: { symbols: [" "], score: 1.0, order: 1 },
    doing: { symbols: ["/"], score: 0.9, order: 2 },
    waiting: { symbols: ["?"], score: 0.7, order: 3 },
    done: { symbols: ["x"], score: 0.3, order: 4 },
    someday: { symbols: ["~"], score: 0.2, order: 5 }
}
```

### Priority-Based

```typescript
{
    urgent: { symbols: ["!"], score: 1.0, order: 1 },
    important: { symbols: ["I"], score: 0.9, order: 2 },
    open: { symbols: [" "], score: 0.8, order: 3 },
    inProgress: { symbols: ["/"], score: 0.7, order: 4 },
    completed: { symbols: ["x"], score: 0.3, order: 5 }
}
```

## See Also

- [Scoring System](SCORING_SYSTEM.md) - How status score affects ranking
- [Sorting System](SORTING_SYSTEM.md) - How status order affects display
- [Chat Modes](CHAT_MODES.md) - How status filters work in each mode
