# Task Scoring System

Task Chat uses a comprehensive scoring system to rank tasks by relevance and importance.

## Overview

Tasks are scored based on four main factors:
1. **Relevance** - How well keywords match
2. **Due Date** - How urgent the deadline is
3. **Priority** - Task importance level
4. **Status** - Task state (open, in-progress, etc.)

## The Formula

```
Final Score = (Relevance × R) + (Due Date × D) + (Priority × P) + (Status × S)
```

Where:
- **R** = Relevance coefficient (default: 20)
- **D** = Due date coefficient (default: 4)
- **P** = Priority coefficient (default: 1)
- **S** = Status coefficient (default: 1)

**Default weights:** Relevance (20×) > Due Date (4×) > Priority (1×) = Status (1×)

## Component Scores

### 1. Relevance Score (0.0-1.2)

**How it's calculated:**

```
Relevance = (Core Match Ratio × Core Bonus) + (All Match Ratio × 1.0)
```

**Components:**
- **Core Match Ratio:** Percentage of core keywords found (0.0-1.0)
- **All Match Ratio:** Percentage of all keywords (including expanded) found (0.0-1.0)
- **Core Bonus:** Extra weight for core keyword matches (default: 0.2)

**Maximum:** Core Bonus + 1.0 = 1.2 (default)

**Example:**

```
Query: "fix bug"
Core keywords: ["fix", "bug"]
Expanded keywords: ["fix", "repair", "solve", "bug", "error", "issue"]

Task: "Need to repair the login error"
- Core matches: 0/2 = 0.0 (no exact "fix" or "bug")
- All matches: 2/6 = 0.33 ("repair", "error")
- Relevance = (0.0 × 0.2) + (0.33 × 1.0) = 0.33

Task: "Fix the critical bug in payment"
- Core matches: 2/2 = 1.0 (both "fix" and "bug")
- All matches: 2/6 = 0.33
- Relevance = (1.0 × 0.2) + (0.33 × 1.0) = 0.53
```

**Sub-coefficients:**

**Core Keyword Match Bonus** (default: 0.2)
- Extra weight for exact core keyword matches
- Higher = Prioritize exact matches
- Lower = Treat all keywords equally

**All Keyword Weight** (fixed: 1.0)
- Weight for overall keyword coverage
- Not configurable (baseline)

### 2. Due Date Score (0.0-1.5)

**How it's calculated:**

Based on urgency and proximity to deadline.

**Sub-coefficients:**

**Overdue Weight** (default: 1.5)
- Score for overdue tasks
- Higher = Prioritize overdue tasks more

**Today Weight** (default: 1.4)
- Score for tasks due today

**This Week Weight** (default: 1.2)
- Score for tasks due this week

**This Month Weight** (default: 1.0)
- Score for tasks due this month

**Future Weight** (default: 0.8)
- Score for future tasks

**No Due Date Weight** (default: 0.5)
- Score for tasks without due dates

### 3. Priority Score (0.0-1.0)

**How it's calculated:**

Based on task priority level.

**Score mapping:**
- **Priority 1 (Highest):** 1.0
- **Priority 2 (High):** 0.75
- **Priority 3 (Medium):** 0.5
- **Priority 4 (Low):** 0.25
- **No priority:** 0.5 (default)

**Sub-coefficients:**

**P1 Weight** (default: 1.0)
**P2 Weight** (default: 0.75)
**P3 Weight** (default: 0.5)
**P4 Weight** (default: 0.25)

### 4. Status Score (0.0-1.0)

**How it's calculated:**

Based on task status category.

**Default scores:**
- **Open:** 1.0 (highest relevance)
- **In Progress:** 0.8
- **Completed:** 0.3 (low relevance)
- **Cancelled:** 0.1 (lowest relevance)
- **Custom categories:** User-defined

**Note:** Status score affects **relevance ranking**, not display order. See [Sorting System](SORTING_SYSTEM.md) for order.

## Complete Example

**Query:** `fix urgent bug`

**Task A:**
```
Content: "Fix critical bug in payment system"
Priority: 1
Due Date: Today
Status: Open

Relevance: 0.85 (good keyword match)
Due Date: 1.4 (due today)
Priority: 1.0 (P1)
Status: 1.0 (open)

Score = (0.85 × 20) + (1.4 × 4) + (1.0 × 1) + (1.0 × 1)
      = 17.0 + 5.6 + 1.0 + 1.0
      = 24.6
```

**Task B:**
```
Content: "Update documentation for API"
Priority: 3
Due Date: Next week
Status: Open

Relevance: 0.15 (weak keyword match)
Due Date: 1.2 (this week)
Priority: 0.5 (P3)
Status: 1.0 (open)

Score = (0.15 × 20) + (1.2 × 4) + (0.5 × 1) + (1.0 × 1)
      = 3.0 + 4.8 + 0.5 + 1.0
      = 9.3
```

**Result:** Task A (24.6) ranks higher than Task B (9.3)

## Coefficients Explained

### Main Coefficients

**Purpose:** Control how much each factor matters

**Relevance Coefficient (default: 20)**
- Keyword match weight
- Higher = Keyword relevance matters more
- Example: 20 means relevance is 20× more important than priority

**Due Date Coefficient (default: 4)**
- Deadline urgency weight
- Higher = Due dates matter more
- Example: 4 means due dates are 4× more important than priority

**Priority Coefficient (default: 1)**
- Task importance weight
- Baseline weight (1×)

**Status Coefficient (default: 1)**
- Task state weight
- Usually kept at 1× (same as priority)

### Customizing Coefficients

**Make due dates more important:**
```
Relevance: 20
Due Date: 8  ← Doubled
Priority: 1
Status: 1
```

**Make relevance dominant:**
```
Relevance: 40  ← Doubled
Due Date: 4
Priority: 1
Status: 1
```

**Balance all factors equally:**
```
Relevance: 10
Due Date: 10
Priority: 10
Status: 10
```

## Minimum Relevance Score

**Purpose:** Ensure keyword match quality

**How it works:**
- Filters tasks with weak keyword matches
- Even if overall score is high

**Example:**
```
Task: "Update documentation"
Relevance: 0.2 (weak match for "urgent bug")
Due Date: 1.5 (overdue)
Priority: 1.0 (P1)
Score: (0.2 × 20) + (1.5 × 4) + (1.0 × 1) + (1.0 × 1) = 12.0

With minimum relevance 0.3:
→ Filtered out (0.2 < 0.3)

Reason: High urgency but weak keyword match
```

**Use case:** Prevent urgent tasks with weak relevance from appearing

## See Also

- [Chat Modes](CHAT_MODES.md) - When scoring is applied
- [Sorting System](SORTING_SYSTEM.md) - How scored tasks are ordered
- [Semantic Expansion](SEMANTIC_EXPANSION.md) - How keywords are matched
