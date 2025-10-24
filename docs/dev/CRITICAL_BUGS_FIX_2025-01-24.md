# Critical Bugs Fixed - 2025-01-24

## Summary
Fixed 2 critical bugs causing query type misdetection and unwanted completed tasks in results. These bugs affected ALL search modes (Simple, Smart, Task Chat).

## Bug #1: detectQueryType Missing extractedDueDateRange Check

### Problem
The `detectQueryType()` function in `aiService.ts` only checked `intent.extractedDueDateFilter` but NOT `intent.extractedDueDateRange`.

**Location:** `aiService.ts` line 1029-1035

**Impact:**
- Query "What should I do today?" set `dueDateRange` (for today + overdue) but NOT `dueDate`
- Function detected query as "empty" instead of "properties-only"
- Empty queries bypassed quality filtering entirely
- Result: 880 unfiltered, unscored tasks returned directly

### The Fix
```typescript
// BEFORE (WRONG)
const hasTaskProperties = !!(
    intent.extractedPriority ||
    intent.extractedDueDateFilter ||          // Only checked dueDate
    intent.extractedStatus ||
    intent.extractedFolder ||
    (intent.extractedTags && intent.extractedTags.length > 0)
);

// AFTER (CORRECT)
const hasTaskProperties = !!(
    intent.extractedPriority ||
    intent.extractedDueDateFilter ||
    intent.extractedDueDateRange ||           // FIXED: Also check for date range
    intent.extractedStatus ||
    intent.extractedFolder ||
    (intent.extractedTags && intent.extractedTags.length > 0)
);
```

### Expected Behavior After Fix
```
Query: "What should I do today?"
Before: Query type = "empty" → No filtering → 880 tasks
After: Query type = "properties-only" → Quality filtering applied → ~50 tasks
```

---

## Bug #2: No Default Status Filter for Vague Queries

### Problem
Vague queries like "What should I do today?" returned completed tasks even though users typically expect only incomplete tasks for such queries.

**Impact:**
- User asked "What should I do today?"
- System returned 880 tasks
- 29 out of 30 displayed tasks were completed ([x] status)
- Not useful for users asking "what should I do"

### Root Cause
No default status filtering was applied for vague/generic queries. The system treated all tasks equally regardless of completion status.

### The Fix
```typescript
// Added in aiService.ts after line 423

// Default status filter for vague queries
// If query is vague (e.g., "What should I do today?") and no status was explicitly specified,
// default to incomplete tasks only (users typically don't want to see completed tasks for such queries)
if (intent.isVague && !intent.extractedStatus) {
    intent.extractedStatus = ["open", "inprogress", "unknown"]; // Exclude completed and cancelled
    console.log(
        `[Task Chat] Vague query detected - defaulting to incomplete tasks only (excluding completed & cancelled)`,
    );
}
```

### Expected Behavior After Fix
```
Query: "What should I do today?"
Before: Returns completed + incomplete tasks (29/30 completed)
After: Returns only incomplete tasks (100% actionable)
```

---

## Understanding Status Coefficient vs Status Filtering

### User Confusion
User set `statusCoefficient` to 0 expecting it would **filter out** completed tasks, but it only affects **scoring**.

### How It Actually Works

**Status Coefficient (Scoring):**
- Affects how much status contributes to task ranking
- Setting to 0 = completed tasks get 0 points for status
- But they're still INCLUDED in results, just ranked lower

**Status Filtering (Actual Removal):**
- Controlled by `intent.extractedStatus` property
- Explicitly removes tasks with certain status categories
- This is what users expect when they want to "hide" completed tasks

**Example:**
```
Task A: Completed, high relevance (0.9)
Status coefficient = 0

Score = (0.9 × 20) + (0 × 4) + (0 × 1) + (0 × 0) = 18.0
                                           ^^^^^
                                      No status contribution

Task still APPEARS in results (score = 18.0)
Just ranked lower than incomplete tasks with similar relevance
```

### Recommendation
For vague queries, we now **automatically filter** to incomplete tasks by default (Bug #2 fix). This matches user expectations better than relying on coefficient scoring alone.

---

## Test Scenarios & Expected Results

### Scenario 1: Generic Mode (User Override)
```
Mode: Simple Search
Setting: Generic Mode (force generic handling)
Query: "What should I do today?"

Expected:
✅ Detected as vague
✅ "today" converted to range (today + overdue)
✅ Default to incomplete tasks only
✅ Returns ~10-50 incomplete tasks due today or overdue
```

### Scenario 2: Auto Mode with Vague Detection
```
Mode: Simple Search
Setting: Auto Mode (heuristic detection)
Query: "What should I do today?"

Expected:
✅ Vagueness ratio ≥ 70% (most words are stop words)
✅ Detected as vague
✅ "today" converted to range (today + overdue)
✅ Default to incomplete tasks only
✅ Returns ~10-50 incomplete tasks due today or overdue
```

### Scenario 3: Smart Search
```
Mode: Smart Search
Query: "What should I do today?"

Expected:
✅ AI parsing enabled
✅ Detected as vague (AI understanding)
✅ "today" converted to range
✅ Default to incomplete tasks only
✅ Query type = "properties-only" (has dueDateRange)
✅ Quality filtering applied
✅ Returns ~10-50 scored, ranked incomplete tasks
```

### Scenario 4: Explicit Status Query
```
Mode: Any
Query: "Show all tasks"

Expected:
✅ Not vague (no time/action context)
✅ No default status filter (user wants ALL)
✅ Returns all tasks (completed + incomplete)
```

### Scenario 5: Explicit Status Override
```
Mode: Any
Query: "Show completed tasks today"

Expected:
✅ Explicit status = "completed"
✅ Default status filter NOT applied (user explicitly requested completed)
✅ Returns only completed tasks with due date today
```

---

## Files Modified

1. **aiService.ts**
   - Line 1032: Added `extractedDueDateRange` check to `detectQueryType()`
   - Line 425-433: Added default status filter for vague queries

---

## Technical Details

### Query Type Detection Logic
```typescript
private static detectQueryType(intent: any): {
    hasKeywords: boolean;
    hasTaskProperties: boolean;
    queryType: "keywords-only" | "properties-only" | "mixed" | "empty";
}
```

**Query Types:**
- `keywords-only`: Has keywords, no properties
- `properties-only`: Has properties (priority/dueDate/dueDateRange/status/folder/tags), no keywords
- `mixed`: Has both keywords and properties
- `empty`: Has neither (rare, usually means filtering/parsing failed)

**Why dueDateRange Matters:**
- Vague queries often convert "today" → dueDateRange (today + overdue)
- Without the range check, these queries were misclassified as "empty"
- Empty queries bypass quality filtering → uncontrolled results

### Vague Query Detection
```
Vagueness Ratio = (Generic Words / Total Words) × 100%
Threshold: 70% (default)

Query: "What should I do today?"
Words: ["What", "should", "I", "do", "today"]
Generic: ["What", "should", "I", "do"] (4/5 = 80%)
Result: Vague ✅
```

### Default Status Filter Logic
```
if (isVague && !extractedStatus) {
    → Filter to: ["open", "inprogress", "unknown"]
    → Exclude: ["completed", "cancelled"]
}
```

**Status Categories:**
- `open`: Not started (checkbox `[ ]`)
- `inprogress`: Started but not done (checkbox `[/]`, `[-]`, `[>]`)
- `unknown`: Custom status (checkbox `[?]`, `[!]`, etc.)
- `completed`: Done (checkbox `[x]`, `[X]`)
- `cancelled`: Abandoned (checkbox `[-]` in some formats)

---

## Backward Compatibility

**✅ Fully Compatible**

**For Existing Queries:**
- Explicit status queries: Unchanged (e.g., "show completed tasks")
- Non-vague queries: Unchanged (e.g., "fix bug")
- Property queries: Now work BETTER (detectQueryType fix)

**For Users:**
- No settings changes required
- No breaking changes
- Improved behavior matches expectations better

---

## Next Steps

1. **Test Thoroughly**
   - Simple Search: Generic mode, Auto mode
   - Smart Search: Various query types
   - Task Chat: AI recommendations

2. **Monitor Logs**
   - Verify query type detection
   - Verify vague query detection
   - Verify status filtering applied correctly

3. **User Feedback**
   - Confirm completed tasks no longer dominate vague queries
   - Confirm property-only queries now get quality filtering
   - Confirm all modes return useful, actionable tasks

---

## Lessons Learned

1. **Always check ALL property variants**
   - Not just `extractedDueDateFilter`, but also `extractedDueDateRange`
   - Date ranges are as important as exact dates for query type detection

2. **Default filters should match user intent**
   - "What should I do today?" = incomplete tasks (actionable)
   - Not completed tasks (already done)

3. **Coefficients ≠ Filters**
   - Coefficients affect scoring/ranking
   - Filters affect inclusion/exclusion
   - Different tools for different purposes

4. **Test edge cases**
   - Vague queries
   - Date range queries
   - Property-only queries
   - Empty queries

---

**Status:** ✅ COMPLETE - Both critical bugs fixed, ready for testing!
