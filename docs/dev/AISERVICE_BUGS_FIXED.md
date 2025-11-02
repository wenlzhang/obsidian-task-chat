# AIService Bugs Fixed

## Date: November 2, 2025
## Status: ✅ COMPLETE

---

## 🐛 Bugs Found and Fixed (Total: 4)

### Bug #1: Unused Variable `taskLimit`
**Location**: [aiService.ts:805-808](src/services/ai/aiService.ts#L805-L808)

**Problem**:
```typescript
const taskLimit =
    chatMode === "chat"
        ? settings.maxTasksForAI
        : settings.maxDirectResults;
```
- Variable `taskLimit` was defined but only used in logging
- Redundant with `maxResults` defined earlier (line 655)
- However, `maxResults` was scoped inside an `if` block, not available in outer scope

**Fix**:
- Renamed to `resultLimit` and moved to correct scope
- Now properly used for both logging AND limiting sorted results
```typescript
const resultLimit =
    chatMode === "chat"
        ? settings.maxTasksForAI
        : settings.maxDirectResults;
```

---

### Bug #2: Wrong Task in Sample Score Logging
**Location**: [aiService.ts:920-948](src/services/ai/aiService.ts#L920-L948)

**Problem**:
```typescript
if (filteredTasks.length > 0 && filteredTasks[0]._cachedScores) {
    const sample = filteredTasks[0]; // ❌ WRONG - unsorted task!
    // ... logging
}
```
- Used `filteredTasks[0]` instead of `sortedTasksForDisplay[0]`
- Showed score breakdown of a RANDOM task, not the highest-scoring task
- Misleading debug output - "top task" wasn't actually the top task

**Impact**: Debug logs showed incorrect scores, making it hard to verify scoring was working

**Fix**:
```typescript
if (sortedTasksForDisplay.length > 0 && sortedTasksForDisplay[0]._cachedScores) {
    const sample = sortedTasksForDisplay[0]; // ✅ CORRECT - highest scoring task!
    // ... logging
}
```
- Now correctly shows the #1 ranked task's score breakdown
- Debug output accurately reflects what user sees

---

### Bug #3: Missing Result Limiting After Sorting
**Location**: After [aiService.ts:919](src/services/ai/aiService.ts#L919) (was missing)

**Problem**:
- Tasks were scored and sorted correctly
- BUT never limited to user's `maxDirectResults` or `maxTasksForAI` setting
- Could return 100+ tasks when user only wanted 50
- Earlier fix in datacoreService only handled API-level limiting
- JS-level scoring path had no limiting step

**Impact**:
- Users got more results than their settings specified
- Wasted processing and display time
- Inconsistent behavior between Datacore (limited) and Dataview (unlimited)

**Fix**:
Added limiting right after sorting:
```typescript
// Limit sorted tasks to resultLimit
if (sortedTasksForDisplay.length > resultLimit) {
    Logger.debug(
        `[JS-Level Limiting] ${sortedTasksForDisplay.length} → ${resultLimit} tasks`,
    );
    sortedTasksForDisplay = sortedTasksForDisplay.slice(0, resultLimit);
}
```

**Flow Now**:
1. Filter tasks (API level or JS level)
2. Score tasks (API level or JS fallback)
3. Sort tasks by finalScore DESC
4. **Limit tasks to user setting** ← NEW
5. Log top task's scores
6. Return to user

---

### Bug #4: Missing Coefficient Activation in Debug Logging
**Location**: [aiService.ts:939-961](src/services/ai/aiService.ts#L939-L961)

**Problem**:
```typescript
if (cached.relevance !== undefined) {
    Logger.debug(
        `  Relevance: ${cached.relevance.toFixed(2)} (× ${settings.relevanceCoefficient} = ${(cached.relevance * settings.relevanceCoefficient).toFixed(2)})`,
    );
}
```
- Debug logging showed coefficient multiplication but NOT the activation multiplier
- Misleading output: Showed "Relevance: 0.80 × 20 = 16.00" even when relevance was INACTIVE (property-only query)
- Users couldn't tell which scoring components were actually contributing to finalScore

**Example of Misleading Output**:
```
Query: "p1 overdue" (no keywords)
Logged: Relevance: 0.80 × 20 = 16.00  ❌ WRONG - relevance is inactive!
Actual:  Relevance: 0.80 × 20 × 0.0 = 0.00  ✅ CORRECT - not contributing
```

**Impact**:
- Debug logs showed incorrect score calculations
- Made it impossible to verify activation logic was working
- Users couldn't understand why property queries gave unexpected results

**Fix**:
Added activation multiplier and status to logging:
```typescript
// Calculate activation based on query (same logic as scoring)
const relevanceActive = queryType.hasKeywords ? 1.0 : 0.0;
const dueDateActive = !!intent.extractedDueDateFilter ? 1.0 : 0.0;
const priorityActive = !!intent.extractedPriority ? 1.0 : 0.0;
const statusActive = !!intent.extractedStatus ? 1.0 : 0.0;

if (cached.relevance !== undefined) {
    const contribution =
        cached.relevance * settings.relevanceCoefficient * relevanceActive;
    const status = relevanceActive > 0 ? "active" : "inactive";
    Logger.debug(
        `  Relevance: ${cached.relevance.toFixed(2)} × ${settings.relevanceCoefficient} × ${relevanceActive.toFixed(1)} = ${contribution.toFixed(2)} (${status})`,
    );
}
```

**Debug Output Examples**:

**Keyword Query** ("payment p1"):
```
Sample score breakdown (top task):
  Task: "Process payment for invoice #1234..."
  Relevance: 0.85 × 20 × 1.0 = 17.00 (active)    ✅ Contributing
  Due Date: 1.50 × 4 × 0.0 = 0.00 (inactive)     ✅ Not in query
  Priority: 1.00 × 1 × 1.0 = 1.00 (active)       ✅ Contributing
  Status: 0.00 × 1 × 0.0 = 0.00 (inactive)       ✅ Not in query
  Final Score: 18.00
```

**Property Query** ("p1 overdue"):
```
Sample score breakdown (top task):
  Task: "Fix critical database bug..."
  Relevance: 0.00 × 20 × 0.0 = 0.00 (inactive)   ✅ No keywords
  Due Date: 1.50 × 4 × 1.0 = 6.00 (active)       ✅ Contributing
  Priority: 1.00 × 1 × 1.0 = 1.00 (active)       ✅ Contributing
  Status: 0.00 × 1 × 0.0 = 0.00 (inactive)       ✅ Not in query
  Final Score: 7.00
```

Now the debug output clearly shows:
- ✅ Which components are active vs inactive
- ✅ The actual contribution to finalScore (with activation multiplier)
- ✅ Whether activation logic is working correctly

---

## ✅ Verification

### Build Status
```
✅ TypeScript: SUCCESS
✅ Bundle: 410.7kb
✅ No errors or warnings
✅ Prettier: aiService.ts formatted correctly
```

### Expected Behavior Now

#### Simple Search Mode
```
1. User searches: "payment p1"
2. Filtered: 150 tasks match
3. Scored & sorted: By finalScore DESC
4. Limited: 150 → 50 tasks (maxDirectResults)
5. Displayed: Top 50 tasks shown
6. Debug log: Shows score of task #1 (highest score)
```

#### Task Chat Mode
```
1. User searches: "payment p1"
2. Filtered: 150 tasks match
3. Scored & sorted: By finalScore DESC
4. Limited: 150 → 100 tasks (maxTasksForAI)
5. Sent to AI: 100 tasks for analysis
6. Debug log: Shows score of task #1 (highest score)
```

---

## 🎯 Files Modified

### [src/services/ai/aiService.ts](src/services/ai/aiService.ts)

**Changes**:
1. Lines 802-812: Renamed `taskLimit` to `resultLimit`, moved to outer scope
2. Lines 919-928: Added limiting step after sorting
3. Lines 930-1000: Fixed sample logging to use `sortedTasksForDisplay[0]` and added activation multipliers

**Before**:
```typescript
// Define taskLimit (only used in logging)
const taskLimit = ...;

// Sort tasks
if (needsScoring) {
    // Score and sort
} else {
    // Sort by cached scores
}

// Log WRONG task (filteredTasks[0])
if (filteredTasks.length > 0) {
    const sample = filteredTasks[0]; // ❌ Random task
}

// NO LIMITING! ❌
// Continue with all tasks...
```

**After**:
```typescript
// Define resultLimit (used for limiting)
const resultLimit = ...;

// Sort tasks
if (needsScoring) {
    // Score and sort
} else {
    // Sort by cached scores
}

// LIMIT TO USER SETTING ✅
if (sortedTasksForDisplay.length > resultLimit) {
    sortedTasksForDisplay = sortedTasksForDisplay.slice(0, resultLimit);
}

// Log CORRECT task (sortedTasksForDisplay[0])
if (sortedTasksForDisplay.length > 0) {
    const sample = sortedTasksForDisplay[0]; // ✅ Top-ranked task
}
```

---

## 📊 Testing Scenarios

### Scenario 1: Keyword Search (Simple Mode)
**Query**: "payment urgent"
**Settings**: maxDirectResults = 50

**Expected**:
- ✅ Filters by keywords
- ✅ Scores and sorts
- ✅ Limits to 50 tasks
- ✅ Shows score of highest-ranked task

---

### Scenario 2: Property Search (Simple Mode)
**Query**: "p1 overdue"
**Settings**: maxDirectResults = 50

**Expected**:
- ✅ Filters by priority and due date
- ✅ Scores and sorts by finalScore
- ✅ Limits to 50 tasks (even if 200 match)
- ✅ Shows score of task with highest urgency

---

### Scenario 3: Task Chat Mode
**Query**: "show me critical bugs"
**Settings**: maxTasksForAI = 100

**Expected**:
- ✅ Filters and scores
- ✅ Limits to 100 tasks (not all matches)
- ✅ Sends only top 100 to AI
- ✅ Debug shows correct top task

---

## 🔧 Technical Details

### Limiting Logic
```typescript
// Respects mode-specific settings
const resultLimit = chatMode === "chat"
    ? settings.maxTasksForAI      // Task Chat: 100 (default)
    : settings.maxDirectResults;  // Simple/Smart: 50 (default)

// Applied after sorting (so we keep the BEST tasks)
if (sortedTasksForDisplay.length > resultLimit) {
    sortedTasksForDisplay = sortedTasksForDisplay.slice(0, resultLimit);
}
```

### Why After Sorting?
- We want the TOP N tasks by score
- Limiting before sorting would give us random N tasks
- Limiting after sorting ensures we keep the highest-quality results

### Variable Scope
- `maxResults`: Defined in `if (shouldReloadWithFilters)` block (line 655)
- `resultLimit`: Defined in outer scope (line 803) - available everywhere
- Same values, but `resultLimit` has correct scope for JS-level limiting

---

## 🎉 Summary

**All four bugs fixed!**

✅ **Bug #1 - No unused variables**: `resultLimit` now properly used for limiting
✅ **Bug #2 - Correct debug output**: Shows actual top task's scores (not random task)
✅ **Bug #3 - Proper limiting**: Respects user settings in all code paths
✅ **Bug #4 - Activation visibility**: Debug logs show which components are active/inactive with correct contributions

**Result**: Users now get exactly the number of tasks they requested, sorted correctly, with accurate and transparent debug logging that shows:
- Which scoring components are active based on query type
- The actual contribution of each component to the final score
- Whether coefficient activation logic is working as expected
