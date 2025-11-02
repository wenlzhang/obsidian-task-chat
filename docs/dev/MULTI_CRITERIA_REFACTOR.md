# Multi-Criteria Sorting Refactoring

## Date: November 2, 2024
## Status: ✅ COMPLETE

---

## 🎯 Problem: Duplicated Sorting Code

### User Feedback
"I think you've created a lot of duplicated code, right? In several places, you had this kind of duplicated code regarding the sort order. Why didn't you use the same code for handling the sort order in multiple locations?"

**The user was absolutely correct!** The same multi-criteria sorting logic was duplicated in 5 locations:
1. datacoreService.ts (API-level sorting)
2. aiService.ts - JS scoring path
3. aiService.ts - Fast path (cached scores)
4. aiService.ts - Fallback scoring path
5. aiService.ts - Fallback fast path

Each had ~60 lines of identical switch statement code!

---

## ✅ Solution: Single Reusable Function

### Architecture

Created a **single source of truth** in TaskSortService with 3 methods:

```typescript
// 1. For Task objects (after API processing)
TaskSortService.compareTasksWithSameScore(taskA, taskB, settings)

// 2. For dcTask objects (during API-level sorting)
TaskSortService.compareDcTasksWithSameScore(dcTaskA, dcTaskB, scoreCache, getTaskId, settings)

// 3. Private generic comparison (shared by both)
TaskSortService.compareWithCriteria(...)
```

### Code Reduction

**Before**: ~300 lines of duplicated code across 5 locations
**After**: ~180 lines in one reusable service
**Savings**: 120 lines removed (40% reduction)

---

## 🔧 How It Works

### 1. Core Comparison Function

```typescript
private static compareWithCriteria<T>(
    sortOrder: SortCriterion[],
    settings: PluginSettings,
    getRelevance: (item: T) => number,
    getDueDate: (item: T) => string | undefined,
    getPriority: (item: T) => number | undefined,
    getStatusCategory: (item: T) => string | undefined,
    getCreatedDate: (item: T) => string | undefined,
    getText: (item: T) => string,
    itemA: T,
    itemB: T,
): number
```

**Key Features**:
- **Generic**: Works with any object type (Task, dcTask, etc.)
- **Flexible**: Uses getter functions to access properties
- **Complete**: Handles all sort criteria (relevance, dueDate, priority, status, created, alphabetical)

### 2. For Task Objects

```typescript
static compareTasksWithSameScore(
    taskA: Task,
    taskB: Task,
    settings: PluginSettings,
): number {
    return this.compareWithCriteria(
        settings.taskSortOrder,
        settings,
        (t) => t._cachedScores?.relevance || 0,  // Relevance from cache
        (t) => t.dueDate,                         // Due date
        (t) => t.priority,                        // Priority
        (t) => t.statusCategory,                  // Status
        (t) => t.createdDate,                     // Created date
        (t) => t.text,                            // Text for alphabetical
        taskA,
        taskB,
    );
}
```

**Used by**:
- aiService.ts (3 locations: JS scoring, fast path, fallback)

### 3. For dcTask Objects

```typescript
static compareDcTasksWithSameScore(
    dcTaskA: { dcTask: any; finalScore: number },
    dcTaskB: { dcTask: any; finalScore: number },
    scoreCache: Map<string, any>,
    getTaskId: (dcTask: any) => string,
    settings: PluginSettings,
): number {
    return this.compareWithCriteria(
        settings.taskSortOrder,
        settings,
        // Relevance from score cache
        (item) => {
            const taskId = getTaskId(item.dcTask);
            return scoreCache.get(taskId)?.relevance || 0;
        },
        (item) => item.dcTask._dueDate,           // Due date
        (item) => item.dcTask._mappedPriority,    // Priority
        (item) => item.dcTask._mappedStatus,      // Status
        (item) => undefined,                      // No created date at API level
        (item) => item.dcTask.$text,              // Text
        dcTaskA,
        dcTaskB,
    );
}
```

**Used by**:
- datacoreService.ts (API-level sorting)

---

## 📊 Respecting User Settings

### taskSortOrder Setting

Users configure their preferred tiebreaker order:
```typescript
taskSortOrder: ["relevance", "dueDate", "priority", "status"]
```

**How it works**:
1. If finalScores equal, check **relevance component scores**
2. If relevance equal, check **due date** (earlier first)
3. If due date equal, check **priority** (P1 first)
4. If priority equal, check **status** (per user's status order)

### Key Point: Relevance Comparison

**Your question**: "If there is a keyword, and if two items have the same score, you check which one has the higher relevance score and place it first."

**Answer**: ✅ YES! We now compare **relevance component scores** when finalScore is equal.

```typescript
case "relevance":
    // Compare relevance component scores
    // finalScore might be same, but relevance components differ
    const relA = getRelevance(itemA);
    const relB = getRelevance(itemB);
    comparison = relB - relA; // DESC (higher first)
    break;
```

### Example: Same finalScore, Different Relevance

```
Task A: "payment processing system"
  relevance: 0.9 (exact match: "payment")
  dueDate: 0.3 (2 months away)
  priority: 0.2 (P4)
  finalScore = 0.9*20 + 0.3*4 + 0.2*1 = 18 + 1.2 + 0.2 = 19.4

Task B: "payment gateway integration"
  relevance: 0.7 (partial match: "payment")
  dueDate: 0.5 (3 weeks away)
  priority: 0.5 (P3)
  finalScore = 0.7*20 + 0.5*4 + 0.5*1 = 14 + 2.0 + 0.5 = 16.5

Task C: "payment API refactor"
  relevance: 0.9 (exact match: "payment")
  dueDate: 0.3 (2 months away)
  priority: 0.2 (P4)
  finalScore = 0.9*20 + 0.3*4 + 0.2*1 = 18 + 1.2 + 0.2 = 19.4

Sorting:
1. B (16.5) < A (19.4) = C (19.4) → B last
2. A vs C: Same finalScore (19.4)
   → Check relevance: A (0.9) = C (0.9) → Still tied
   → Check dueDate: A (0.3) = C (0.3) → Still tied
   → Check priority: A (0.2) = C (0.2) → Still tied
   → Original order preserved

Result: [A, C, B] or [C, A, B] (depending on input order)
```

---

## 🎯 Handling All Criteria

### 1. Relevance (NEW!)
```typescript
case "relevance":
    // Compare component scores from cache
    const relA = taskA._cachedScores?.relevance || 0;
    const relB = taskB._cachedScores?.relevance || 0;
    comparison = relB - relA; // DESC (higher first)
```

**Why this matters**: Two tasks can have the same finalScore but different relevance scores if they compensate with other components (due date, priority, etc.).

### 2. Due Date
```typescript
case "dueDate":
    // Earlier dates = more urgent
    comparison = TaskPropertyService.compareDates(
        getDueDate(itemA),
        getDueDate(itemB),
    );
    // Returns: < 0 if A earlier, > 0 if B earlier
```

**Order**: Overdue → Today → This week → This month → Future → No date

### 3. Priority
```typescript
case "priority":
    // Lower numbers = higher priority
    comparison = TaskPropertyService.comparePriority(
        getPriority(itemA),
        getPriority(itemB),
    );
    // Returns: < 0 if A higher priority, > 0 if B higher
```

**Order**: P1 → P2 → P3 → P4 → No priority

### 4. Status
```typescript
case "status":
    // Respects user's configured display order
    const aOrder = TaskPropertyService.getStatusOrder(
        getStatusCategory(itemA),
        settings,
    );
    const bOrder = TaskPropertyService.getStatusOrder(
        getStatusCategory(itemB),
        settings,
    );
    comparison = aOrder - bOrder;
```

**Order**: Based on user's `taskStatusMapping` display order
- Default: open (0) → inProgress (1) → completed (2) → cancelled (3)
- User can customize categories and order

### 5. Created Date
```typescript
case "created":
    // Newer tasks first (DESC)
    comparison = TaskPropertyService.compareDates(
        getCreatedDate(itemA),
        getCreatedDate(itemB),
    );
    comparison = -comparison; // Reverse for DESC
```

**Order**: Newest → Oldest

### 6. Alphabetical
```typescript
case "alphabetical":
    // Natural A-Z order
    comparison = getText(itemA).localeCompare(getText(itemB));
```

**Order**: A → Z

---

## 📝 Files Modified

### 1. [taskSortService.ts](src/services/tasks/taskSortService.ts) - Lines 125-298
**Added**:
- `compareTasksWithSameScore()` - For Task objects
- `compareDcTasksWithSameScore()` - For dcTask objects
- `compareWithCriteria()` - Private generic comparison

### 2. [datacoreService.ts](src/services/tasks/datacoreService.ts) - Lines 907-928
**Before** (~70 lines):
```typescript
scoredTasks.sort((a, b) => {
    const scoreDiff = b.finalScore - a.finalScore;
    if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;

    // 60+ lines of switch statement...
});
```

**After** (~20 lines):
```typescript
scoredTasks.sort((a, b) => {
    const scoreDiff = b.finalScore - a.finalScore;
    if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;

    return TaskSortService.compareDcTasksWithSameScore(
        a, b, scoreCache, this.getTaskId.bind(this), settings
    );
});
```

### 3. [aiService.ts](src/services/ai/aiService.ts) - 4 Locations

**Location 1**: Lines 901-914 (JS scoring path)
**Location 2**: Lines 926-941 (Fast path)
**Location 3**: Lines 3370-3382 (Fallback scoring)
**Location 4**: Lines 3390-3404 (Fallback fast)

All replaced ~50 lines with ~12 lines using `TaskSortService.compareTasksWithSameScore()`

**Also removed**: Unused `TaskPropertyService` import (line 12)

---

## ✅ Verification

### Build Status
```
✅ TypeScript: SUCCESS
✅ Bundle: 412.0kb (-0.7kb from deduplication)
✅ No errors or warnings
✅ All files unchanged (proper formatting)
```

### Test Scenarios

#### Scenario 1: Same finalScore, Different Relevance
```
Settings: taskSortOrder: ["relevance", "dueDate", "priority"]

Task A: finalScore=15.0, relevance=0.8, due=2025-01-15
Task B: finalScore=15.0, relevance=0.6, due=2025-01-10

Sort:
1. finalScore: 15.0 = 15.0 (tied)
2. Relevance: 0.8 > 0.6
→ Task A appears FIRST ✅
```

#### Scenario 2: Same finalScore, Same Relevance, Different Due Date
```
Settings: taskSortOrder: ["relevance", "dueDate", "priority"]

Task A: finalScore=15.0, relevance=0.8, due=2025-01-15, p2
Task B: finalScore=15.0, relevance=0.8, due=2025-01-10, p3

Sort:
1. finalScore: 15.0 = 15.0 (tied)
2. Relevance: 0.8 = 0.8 (tied)
3. DueDate: 2025-01-10 < 2025-01-15 (earlier first)
→ Task B appears FIRST ✅
```

#### Scenario 3: User Reorders Criteria
```
Settings: taskSortOrder: ["priority", "dueDate", "relevance"]

Task A: finalScore=15.0, p2, due=2025-01-10, relevance=0.8
Task B: finalScore=15.0, p3, due=2025-01-15, relevance=0.9

Sort:
1. finalScore: 15.0 = 15.0 (tied)
2. Priority: P2 < P3 (higher priority first)
→ Task A appears FIRST ✅
(Due date and relevance NOT checked because priority differs)
```

#### Scenario 4: User Adds Alphabetical
```
Settings: taskSortOrder: ["relevance", "dueDate", "alphabetical"]

Task A: finalScore=15.0, relevance=0.8, due=2025-01-15, text="Payment system"
Task B: finalScore=15.0, relevance=0.8, due=2025-01-15, text="API integration"

Sort:
1. finalScore: 15.0 = 15.0 (tied)
2. Relevance: 0.8 = 0.8 (tied)
3. DueDate: 2025-01-15 = 2025-01-15 (tied)
4. Alphabetical: "API" < "Payment"
→ Task B appears FIRST ✅
```

---

## 🎯 Benefits

### 1. No Code Duplication ✅
- Single source of truth for multi-criteria comparison
- Easy to maintain and update
- Changes in one place affect all sorting locations

### 2. Respects All User Settings ✅
- `taskSortOrder`: Order of tiebreaker criteria
- `taskStatusMapping`: Custom status categories and order
- Coefficients: Already handled by finalScore

### 3. Handles All Criteria ✅
- Relevance: Component scores compared
- Due Date: Earlier dates first
- Priority: P1 before P4
- Status: User's custom order
- Created: Newer first
- Alphabetical: A-Z

### 4. Works Everywhere ✅
- Datacore API-level sorting
- Dataview API (when needed)
- JS-level fallback sorting
- AI response fallback

### 5. Flexible & Extensible ✅
- Easy to add new criteria
- Generic design works with any object type
- Getter functions provide abstraction

---

## 🔍 Technical Details

### Why Two Public Methods?

**`compareTasksWithSameScore()`** - For Task objects:
- Used after API processing
- Direct property access (task.dueDate, task.priority)
- Cached scores available (task._cachedScores)

**`compareDcTasksWithSameScore()`** - For dcTask objects:
- Used during API-level sorting (before Task creation)
- Properties in different locations (dcTask._dueDate, dcTask._mappedPriority)
- Need scoreCache and getTaskId for relevance

### Why Private Generic Method?

**`compareWithCriteria()`** - Shared implementation:
- Eliminates duplication between the two public methods
- Generic design with getter functions
- Single place to maintain sorting logic

### Relevance Comparison

**Key Insight**: Relevance is included in finalScore, BUT we still compare relevance component scores as a tiebreaker.

**Why?**
```
Task A: relevance=0.8, dueDate=0.5, priority=0.2
  finalScore = 0.8*20 + 0.5*4 + 0.2*1 = 16 + 2 + 0.2 = 18.2

Task B: relevance=0.6, dueDate=0.8, priority=0.5
  finalScore = 0.6*20 + 0.8*4 + 0.5*1 = 12 + 3.2 + 0.5 = 15.7

Task C: relevance=0.7, dueDate=0.7, priority=0.4
  finalScore = 0.7*20 + 0.7*4 + 0.4*1 = 14 + 2.8 + 0.4 = 17.2

All different finalScores → Primary sort works
```

BUT if coefficients are adjusted:
```
Coefficients: relevance=10, dueDate=10, priority=1

Task A: 0.8*10 + 0.5*10 + 0.2*1 = 8 + 5 + 0.2 = 13.2
Task B: 0.6*10 + 0.8*10 + 0.5*1 = 6 + 8 + 0.5 = 14.5
Task C: 0.7*10 + 0.7*10 + 0.4*1 = 7 + 7 + 0.4 = 14.4

Different finalScores still
```

BUT with equal weights:
```
Coefficients: relevance=1, dueDate=1, priority=1, status=1

Task A: 0.5 + 0.5 + 0.2 + 0.5 = 1.7
Task B: 0.4 + 0.6 + 0.2 + 0.5 = 1.7  ← SAME!
Task C: 0.5 + 0.4 + 0.3 + 0.5 = 1.7  ← SAME!

Now relevance tiebreaker matters:
- Task A: relevance=0.5
- Task B: relevance=0.4
- Task C: relevance=0.5

Order: A/C (tie), B (lower)
```

---

## 🎉 Summary

**Problem**: 300 lines of duplicated sorting code across 5 locations

**Solution**: Single reusable function in TaskSortService (180 lines)

**Result**:
- ✅ 40% code reduction
- ✅ Single source of truth
- ✅ Respects all user settings (taskSortOrder, status categories)
- ✅ Handles all criteria (relevance, dueDate, priority, status, created, alphabetical)
- ✅ Works for Task objects and dcTask objects
- ✅ Easy to maintain and extend

Your tasks will now sort correctly with NO code duplication! 🎯
