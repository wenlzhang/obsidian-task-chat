# Task Sorting System

Task Chat uses multi-criteria sorting to order tasks for display.

## Overview

Tasks are sorted by multiple criteria in priority order. When tasks have equal values for the primary criterion, the secondary criterion breaks the tie, and so on.

**Key principle:** Coefficients determine importance (via scoring), sort order determines tiebreaking.

## How It Works

### Multi-Criteria Sorting

**Example sort order:** `[relevance, dueDate, priority]`

**Process:**
1. Sort by **relevance** (primary)
2. If relevance is equal → Sort by **dueDate** (secondary)
3. If dueDate is also equal → Sort by **priority** (tertiary)

**Result:** Tasks with highest relevance appear first, with ties broken by due date, then priority.

### Sort Criteria

**Available criteria:**
- **relevance** - Keyword match quality (0-100, higher = better match)
- **dueDate** - Deadline urgency (overdue → today → future)
- **priority** - Task importance (1 → 2 → 3 → 4)
- **status** - Task state (based on order setting)
- **created** - Creation date (newest → oldest)
- **alphabetical** - Task content (A → Z)

## Sort Criteria Details

### Relevance

**How it works:**
- Based on keyword similarity scores
- 100 = perfect match, 0 = no match
- Calculated from comprehensive scoring

**Direction:** Descending (best matches first)

**Example:**
```
Task A: "Fix critical bug" - relevance: 95
Task B: "Update docs" - relevance: 45
Task C: "Fix typo" - relevance: 85

Order: A (95) → C (85) → B (45)
```

### Due Date

**How it works:**
- Based on deadline proximity
- Overdue → Today → Tomorrow → Future
- Tasks without due dates appear last

**Direction:** Ascending (most urgent first)

**Order:**
1. Overdue (past due)
2. Today
3. Tomorrow
4. This week
5. This month
6. Future dates
7. No due date

**Example:**
```
Task A: Due yesterday (overdue)
Task B: Due today
Task C: Due next week
Task D: No due date

Order: A → B → C → D
```

### Priority

**How it works:**
- Based on priority level (1-4)
- 1 = highest, 4 = lowest

**Direction:** Ascending (highest priority first)

**Order:**
1. Priority 1 (Highest)
2. Priority 2 (High)
3. Priority 3 (Medium)
4. Priority 4 (Low)
5. No priority

**Example:**
```
Task A: Priority 3
Task B: Priority 1
Task C: Priority 2
Task D: No priority

Order: B (P1) → C (P2) → A (P3) → D (none)
```

### Status

**How it works:**
- Based on status order setting
- Lower order number = appears first
- See [Status Categories](STATUS_CATEGORIES.md) for details

**Direction:** Ascending (lower order first)

**Default order:**
1. Open (order: 1)
2. In Progress (order: 2)
3. Completed (order: 6)
4. Cancelled (order: 7)
5. Custom categories (order: 8 or custom)

**Example:**
```
Task A: Completed (order: 6)
Task B: Open (order: 1)
Task C: In Progress (order: 2)

Order: B (1) → C (2) → A (6)
```

**Note:** Status **order** (for sorting) is different from status **score** (for relevance). See [Status Categories](STATUS_CATEGORIES.md).

### Created Date

**How it works:**
- Based on task creation timestamp
- Newest tasks first

**Direction:** Descending (newest first)

**Example:**
```
Task A: Created 2025-01-20
Task B: Created 2025-01-23
Task C: Created 2025-01-22

Order: B (Jan 23) → C (Jan 22) → A (Jan 20)
```

### Alphabetical

**How it works:**
- Based on task content text
- Standard A → Z order
- Case-insensitive natural sorting

**Direction:** Ascending (A → Z)

**Example:**
```
Task A: "Update documentation"
Task B: "Fix bug"
Task C: "Add feature"

Order: C (Add) → B (Fix) → A (Update)
```

## Configuring Sort Order

### Tag-Based UI

**Visual interface:**
```
[Relevance 🔒] [Due date ✕] [Priority ✕]  [+ Add criterion ▼]
```

**Features:**
- Relevance is always first (locked)
- Click ✕ to remove criterion
- Click + to add criterion
- Drag to reorder (if implemented)

**Tip:** Sort order doesn't affect performance, choose what makes sense for your workflow.

## See Also

- [Scoring System](SCORING_SYSTEM.md) - How tasks are scored
- [Status Categories](STATUS_CATEGORIES.md) - Status order vs score
- [Chat Modes](CHAT_MODES.md) - When sorting is applied
