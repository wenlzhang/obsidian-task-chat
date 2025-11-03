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
        symbols: ["r"],
        score: 0.7,  // Moderate relevance
        order: 4,    // After blocked
        displayName: "Review",
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
- `review`
- `tendency`

**Editable:** Yes (for custom categories)

### Display Name

**What it is:** Human-readable name shown in UI

**Format:** Sentence case recommended

**Examples:**
- "Important"
- "Blocked"
- "Review"

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

**Effect:** Controls how tasks appear in search results

### Order

**What it is:** Display position when sorting by status

**Range:** 1, 2, 3... (positive integers)

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

**Datacore:**
- Status categories work with Datacore queries
- Can filter by status in queries

## See Also

- [Scoring System](SCORING_SYSTEM.md) - How status score affects ranking
- [Sorting System](SORTING_SYSTEM.md) - How status order affects display
- [Chat Modes](CHAT_MODES.md) - How status filters work in each mode
