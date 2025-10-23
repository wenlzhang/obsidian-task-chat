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

## Complete Example

**Sort order:** `[relevance, dueDate, priority]`

**Tasks:**
```
Task A: "Fix bug" - relevance: 85, due: today, priority: 1
Task B: "Update docs" - relevance: 85, due: today, priority: 2
Task C: "Add feature" - relevance: 85, due: tomorrow, priority: 1
Task D: "Fix typo" - relevance: 90, due: next week, priority: 3
```

**Sorting process:**

**Step 1: Sort by relevance**
```
D (90) → [A, B, C] (85)
```

**Step 2: For tied tasks (A, B, C), sort by dueDate**
```
D (90) → [A, B] (today) → C (tomorrow)
```

**Step 3: For tied tasks (A, B), sort by priority**
```
D (90) → A (P1) → B (P2) → C (P1 but later due)
```

**Final order:** D → A → B → C

## Coefficients vs Sort Order

**Important distinction:**

### Coefficients (in Scoring)

**Purpose:** Determine how much each factor matters in the **score**

**Example:**
```
Relevance coefficient: 20
Due date coefficient: 4
Priority coefficient: 1

Score = (relevance × 20) + (dueDate × 4) + (priority × 1)
```

**Effect:** Tasks with better relevance get much higher scores

### Sort Order (in Sorting)

**Purpose:** Determine tiebreaking order when scores are equal

**Example:**
```
Sort order: [relevance, dueDate, priority]
```

**Effect:** When two tasks have the same relevance, due date breaks the tie

### Why Both?

**Coefficients** control **importance** (via scoring)
**Sort order** controls **tiebreaking** (via sorting)

**Example:**

With coefficients R×20, D×4, P×1:
```
Task A: relevance=0.8, dueDate=1.5, priority=1.0
Score = (0.8 × 20) + (1.5 × 4) + (1.0 × 1) = 23.0

Task B: relevance=0.6, dueDate=1.5, priority=1.0
Score = (0.6 × 20) + (1.5 × 4) + (1.0 × 1) = 19.0
```

Task A wins because relevance coefficient (20×) makes it dominant.

But if scores are exactly equal:
```
Task A: score=23.0, dueDate=today
Task B: score=23.0, dueDate=tomorrow
```

Sort order `[relevance, dueDate, priority]` breaks tie → Task A first (earlier due date).

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

### Common Configurations

**Default (balanced):**
```
[Relevance] [Due date] [Priority]
```
- Best keyword matches first
- Ties broken by urgency
- Then by importance

**Deadline-focused:**
```
[Relevance] [Due date] [Status] [Priority]
```
- Keyword matches first
- Then urgency
- Then task state
- Then importance

**Priority-focused:**
```
[Relevance] [Priority] [Due date]
```
- Keyword matches first
- Then importance
- Then urgency

**Workflow-focused:**
```
[Relevance] [Status] [Priority] [Due date]
```
- Keyword matches first
- Then task state (open → in-progress → completed)
- Then importance
- Then urgency

## Tips

### For Better Results

1. **Keep relevance first**
   - You searched for specific keywords
   - Best matches should appear first

2. **Add 2-3 tiebreakers**
   - Prevents random ordering
   - Provides consistent results

3. **Order by importance**
   - Most important criterion first
   - Less important criteria break ties

### For Specific Workflows

**Deadline-driven work:**
```
[Relevance] [Due date] [Priority]
```

**Priority-driven work:**
```
[Relevance] [Priority] [Due date]
```

**Status-driven work:**
```
[Relevance] [Status] [Priority] [Due date]
```

**Recent work:**
```
[Relevance] [Created] [Priority]
```

### For Task Chat Auto Mode

**What it is:** AI-driven sorting based on query context

**How it works:**
- AI analyzes your query
- Determines best sort order
- Applies automatically

**Example:**
```
Query: "What's overdue?"
Auto mode: [Due date] [Priority] [Relevance]
Reason: Focus on urgency

Query: "Show high-priority tasks"
Auto mode: [Priority] [Due date] [Relevance]
Reason: Focus on importance
```

**When to use:**
- Task Chat mode only
- When you want AI to decide
- For exploratory queries

## Performance

**Impact:** Minimal
- Sorting is O(n log n)
- Very fast even with 1000+ tasks
- No AI calls needed

**Tip:** Sort order doesn't affect performance, choose what makes sense for your workflow.

## See Also

- [Scoring System](SCORING_SYSTEM.md) - How tasks are scored
- [Status Categories](STATUS_CATEGORIES.md) - Status order vs score
- [Chat Modes](CHAT_MODES.md) - When sorting is applied
