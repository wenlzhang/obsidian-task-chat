# Task Sorting Architecture

## Date: November 2, 2024
## Status: ✅ COMPLETE

---

## 🎯 Goal: Single Source of Truth for Sorting Logic

### User Requirements
1. **Use existing methods** - Don't duplicate sorting logic
2. **Sort once, not multiple times** - Datacore sorts at API level, don't re-sort in aiService
3. **Clean architecture** - One place for multi-criteria logic

---

## 📐 Final Architecture

### Single Source of Truth: `applyCriteriaComparison()`

**Location**: [taskSortService.ts:120-203](src/services/tasks/taskSortService.ts#L120-L203)

This is the **only place** where multi-criteria sorting logic exists:

```typescript
private static applyCriteriaComparison<T>(
    itemA: T,
    itemB: T,
    sortOrder: SortCriterion[],
    settings: PluginSettings,
    getRelevance: (item: T) => number,
    getDueDate: (item: T) => string | undefined,
    getPriority: (item: T) => number | undefined,
    getStatusCategory: (item: T) => string | undefined,
    getCreatedDate: (item: T) => string | undefined,
    getText: (item: T) => string,
): number
```

**Key features**:
- Generic - works with any object type (Task, dcTask, etc.)
- Uses property getters to access data
- Applies user's `taskSortOrder` setting
- Handles all 6 sort criteria: relevance, dueDate, priority, status, created, alphabetical

---

## 🔄 How Different Services Use It

### 1. Task Objects (After API Processing)

**Method**: `sortTasksMultiCriteria()` - [taskSortService.ts:25-52](src/services/tasks/taskSortService.ts#L25-L52)

**Used by**: aiService (Dataview fallback only)

**How it works**:
```typescript
TaskSortService.sortTasksMultiCriteria(
    tasks,                      // Task[]
    settings.taskSortOrder,     // ["relevance", "dueDate", "priority"]
    settings,                   // PluginSettings
    relevanceScoresMap,         // Map<taskId, score>
)
```

Internally calls `applyCriteriaComparison()` with property getters for Task objects.

---

### 2. dcTask Objects (API Level, Before Task Creation)

**Method**: `sortScoredDcTasks()` - [taskSortService.ts:65-101](src/services/tasks/taskSortService.ts#L65-L101)

**Used by**: datacoreService (API-level sorting)

**How it works**:
```typescript
TaskSortService.sortScoredDcTasks(
    scoredTasks,                // Array<{dcTask, finalScore}>
    settings.taskSortOrder,     // User's sort order
    settings,                   // PluginSettings
    this.getTaskId.bind(this),  // Extract task ID
    scoreCache,                 // Map<taskId, componentScores>
)
```

Internally:
1. Sorts by `finalScore` DESC (primary)
2. If scores equal → calls `applyCriteriaComparison()` with property getters for dcTask objects

---

## 🔍 Sorting Flow by API Type

### Datacore API (Primary, Fast)

```
┌─────────────────────────────────────────────────────────┐
│ datacoreService.ts                                      │
│                                                         │
│ 1. Get dcTask objects from API                          │
│ 2. Score all tasks → finalScore                         │
│ 3. Sort using sortScoredDcTasks() ✅                    │
│    - Primary: finalScore DESC                           │
│    - Tiebreaker: applyCriteriaComparison()              │
│ 4. Limit to top N                                       │
│ 5. Return pre-sorted dcTask objects                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ aiService.ts                                            │
│                                                         │
│ Check: needsScoring?                                    │
│ → NO (tasks already have finalScore)                    │
│                                                         │
│ Fast Path (line 921):                                   │
│ sortedTasksForDisplay = filteredTasks  ✅               │
│ (Use pre-sorted tasks as-is, NO re-sorting!)           │
└─────────────────────────────────────────────────────────┘
```

**Result**: ✅ Sorted ONCE at API level, used directly in aiService

---

### Dataview API (Fallback, Slow - To Be Removed)

```
┌─────────────────────────────────────────────────────────┐
│ dataviewService.ts                                      │
│                                                         │
│ 1. Get Task objects from API                            │
│ 2. NO scoring                                           │
│ 3. NO sorting                                           │
│ 4. Return unsorted Task objects                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ aiService.ts                                            │
│                                                         │
│ Check: needsScoring?                                    │
│ → YES (tasks don't have finalScore)                     │
│                                                         │
│ Scoring Path (lines 825-915):                          │
│ 1. Calculate component scores                           │
│ 2. Calculate finalScore                                 │
│ 3. Build relevanceScoresMap                             │
│ 4. Sort using sortTasksMultiCriteria() ✅               │
│    - Calls applyCriteriaComparison()                    │
└─────────────────────────────────────────────────────────┘
```

**Result**: ✅ Sorted ONCE at JS level (because API didn't sort)

**Note**: This path will be removed when Dataview support is removed.

---

## 📊 Code Metrics

### Before Refactoring
- **Sorting logic locations**: 3 places (duplicated)
  - taskSortService.sortTasksMultiCriteria (switch statement)
  - datacoreService inline sorting (switch statement)
  - aiService custom sorting (comparison functions)
- **Lines of sorting code**: ~240 lines (duplicated)
- **Bundle size**: 412.0kb

### After Refactoring
- **Sorting logic locations**: 1 place (single source of truth)
  - taskSortService.applyCriteriaComparison (master logic)
- **Lines of sorting code**: ~80 lines (shared)
- **Bundle size**: 411.2kb (-0.8kb)

---

## ✅ Benefits

### 1. No Code Duplication
- Multi-criteria logic exists in **ONE place** only
- Both datacoreService and aiService use the same logic
- Changes to sorting behavior only need to be made once

### 2. Optimal Performance
- **Datacore path**: Sort once at API level, no re-sorting ✅
- **Dataview path**: Sort once at JS level (temporary, will be removed)
- No redundant sorting operations

### 3. Maintainability
- Single source of truth for sorting logic
- Clear separation: API-level vs JS-level sorting
- Easy to remove Dataview support later (just delete needsScoring branch)

---

## 🗺️ API Type Comparison

| Feature | Datacore | Dataview |
|---------|----------|----------|
| **Speed** | Fast (2-10x faster) | Slow |
| **Scoring** | ✅ At API level | ❌ Must do at JS level |
| **Sorting** | ✅ At API level | ❌ Must do at JS level |
| **Method Used** | `sortScoredDcTasks()` | `sortTasksMultiCriteria()` |
| **aiService Path** | Fast path (no re-sorting) | Scoring path (calculate + sort) |
| **Future** | ✅ Keep and enhance | ❌ Remove |

---

## 🔧 Implementation Details

### sortScoredDcTasks() for Datacore

**Why it's needed**:
- Datacore has dcTask objects (raw API data)
- Haven't converted to Task objects yet
- Need to sort before creating Task objects

**How it works**:
```typescript
scoredTasks.sort((a, b) => {
    // Primary: finalScore DESC
    const scoreDiff = b.finalScore - a.finalScore;
    if (Math.abs(scoreDiff) > 0.0001) {
        return scoreDiff;
    }

    // Tiebreaker: Use applyCriteriaComparison()
    return this.applyCriteriaComparison(
        a, b,
        tiebreakOrder,  // Skip "relevance" (already in finalScore)
        settings,
        // Property getters for dcTask objects
        (item) => scoreCache.get(taskId)?.relevance || 0,
        (item) => item.dcTask._dueDate,
        (item) => item.dcTask._mappedPriority,
        (item) => item.dcTask._mappedStatus || "incomplete",
        (item) => undefined,  // createdDate not available at API level
        (item) => item.dcTask.$text || item.dcTask.text || "",
    );
});
```

---

### sortTasksMultiCriteria() for Task Objects

**Why it's needed**:
- For Task objects (after API processing)
- Used by Dataview fallback (will be removed later)

**How it works**:
```typescript
tasks.sort((a, b) => {
    return this.applyCriteriaComparison(
        a, b,
        sortOrder,
        settings,
        // Property getters for Task objects
        (task) => relevanceScores?.get(task.id) || 0,
        (task) => task.dueDate,
        (task) => task.priority,
        (task) => task.statusCategory,
        (task) => task.createdDate,
        (task) => task.text,
    );
});
```

---

## 🎯 Key Takeaways

1. **Single Source of Truth**: `applyCriteriaComparison()` contains ALL sorting logic
2. **Two Public Methods**:
   - `sortScoredDcTasks()` for API-level (Datacore)
   - `sortTasksMultiCriteria()` for JS-level (Dataview fallback)
3. **No Duplication**: Both methods use the same underlying logic
4. **Optimal Performance**: Datacore sorts once at API level, no re-sorting
5. **Clean Architecture**: Clear separation between API types and sorting strategies

---

## 📝 Next Steps (Future)

1. ✅ **DONE**: datacoreService uses existing sorting method
2. ✅ **DONE**: aiService doesn't re-sort Datacore tasks
3. ⏳ **TODO**: Remove Dataview support entirely
4. ⏳ **TODO**: Delete `sortTasksMultiCriteria` (only used by Dataview)
5. ⏳ **TODO**: Only keep `sortScoredDcTasks` for Datacore

After Dataview removal, the architecture will be even simpler:
- **One API**: Datacore only
- **One sorting method**: `sortScoredDcTasks()` at API level
- **No JS-level sorting**: aiService just uses pre-sorted tasks

🎉 **Perfect!**
