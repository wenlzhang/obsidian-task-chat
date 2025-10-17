# User Settings Audit - Ensuring No Hard-coded Limits

**Date:** 2024-10-17  
**Purpose:** Audit entire codebase to ensure all task limits respect user settings

---

## Issue Found and Fixed

### ❌ Hard-coded Fallback Limit (FIXED)

**Location:** `src/services/aiService.ts`, line 1198

**Problem:**
```typescript
// BEFORE (WRONG)
const topTasks = scoredTasks
    .slice(0, Math.min(5, settings.maxRecommendations))  // ❌ Limited to 5!
    .map((st: { score: number; task: Task }) => st.task);
```

**Issue:**
- Even if user sets `maxRecommendations` to 10, fallback only returned 5 tasks
- Hard-coded `5` violated user's configuration
- Occurs when AI fails to format response with [TASK_X] references

**Fix:**
```typescript
// AFTER (CORRECT)
const topTasks = scoredTasks
    .slice(0, settings.maxRecommendations)  // ✅ Respects user setting!
    .map((st: { score: number; task: Task }) => st.task);
```

**Impact:** Fallback now fully respects user's configured task limit

---

## Comprehensive Audit Results

### ✅ All User Settings Properly Respected

**Settings Verified:**

1. **maxDirectResults** (Max tasks shown without AI)
   - ✅ Line 410: `sortedTasksForDisplay.slice(0, settings.maxDirectResults)`
   - ✅ Line 540: `sortedTasks.slice(0, settings.maxDirectResults)`
   - ✅ Used correctly in all locations

2. **maxTasksForAI** (Max tasks sent to AI)
   - ✅ Line 307: `Math.min(settings.maxTasksForAI, filteredTasks.length)` (correct - comparing to available)
   - ✅ Line 455: `sortedTasksForAI.slice(0, settings.maxTasksForAI)`
   - ✅ Used correctly in all locations

3. **maxRecommendations** (Max tasks AI recommends)
   - ✅ Line 1198: Now uses `settings.maxRecommendations` (FIXED!)
   - ✅ Line 1227: `Math.min(settings.maxRecommendations, tasks.length)` (correct - comparing to available)
   - ✅ Line 1258: `recommended.slice(0, settings.maxRecommendations)`
   - ✅ Used correctly in all locations

4. **relevanceThreshold** (Minimum relevance score)
   - ✅ Line 243: Checks `settings.relevanceThreshold === 0` (use defaults)
   - ✅ Line 257: Uses `settings.relevanceThreshold` when set by user
   - ✅ Properly implements adaptive threshold with user override

5. **Temperature** (AI response creativity)
   - ✅ Line 922: `temperature: settings.temperature` (OpenAI)
   - ✅ Line 997: `temperature: settings.temperature` (Anthropic)
   - ✅ Used correctly in all AI calls

6. **maxTokensChat** (Max AI response length)
   - ✅ Line 930: `max_tokens: settings.maxTokensChat || 1500` (OpenAI)
   - ✅ Line 1005: `max_tokens: settings.maxTokensChat || 1500` (Anthropic)
   - ✅ Used correctly with fallback

7. **Sort Orders** (Multi-criteria sorting)
   - ✅ taskSortOrderSimple: Used in Simple Search mode
   - ✅ taskSortOrderSmart: Used in Smart Search mode
   - ✅ taskSortOrderChat: Used for Task Chat display
   - ✅ taskSortOrderChatAI: Used for Task Chat AI context
   - ✅ All properly resolved and deduplicated

8. **DataView Settings** (Field names and mappings)
   - ✅ dataviewKeys.dueDate: Respected in field extraction
   - ✅ dataviewKeys.createdDate: Respected in field extraction
   - ✅ dataviewKeys.completedDate: Respected in field extraction
   - ✅ dataviewKeys.priority: Respected in field extraction
   - ✅ dataviewPriorityMapping: Used in mapPriority()
   - ✅ All properly integrated with DataView API

---

## Legitimate Hard-coded Values (OK)

These are internal algorithm parameters, not user-facing limits:

### **Adaptive Threshold Defaults (OK)**
**Location:** `aiService.ts`, lines 245-250

```typescript
if (settings.relevanceThreshold === 0) {
    // System defaults when user wants adaptive
    if (intent.keywords.length >= 4) {
        baseThreshold = 20;   // OK - internal heuristic
    } else if (intent.keywords.length >= 2) {
        baseThreshold = 30;   // OK - internal heuristic
    } else {
        baseThreshold = 40;   // OK - internal heuristic
    }
}
```

**Why OK:** These are system defaults used ONLY when user sets relevanceThreshold to 0 (meaning "use adaptive"). User can override by setting a specific value.

### **Semantic Expansion Detection (OK)**
**Location:** `aiService.ts`, line 270

```typescript
const likelySemanticExpansion = intent.keywords.length >= 20; // OK - heuristic
```

**Why OK:** Internal heuristic to detect semantic expansion. Not a user-facing limit. Doesn't restrict results, just changes filtering strategy.

### **Logging Display Limit (OK)**
**Location:** `queryParserService.ts`, line 713

```typescript
`${lang}: ${words.length} keywords - [${words.slice(0, 5).join(", ")}...]`
```

**Why OK:** Only for console logging display. Shows first 5 keywords as example. Doesn't affect functionality.

### **Disabled Code Block (OK)**
**Location:** `aiService.ts`, lines 1214-1253

```typescript
if (false) {  // Disabled code path
    const RELEVANCE_THRESHOLD = 40;  // OK - not active
    // ...
}
```

**Why OK:** Code is disabled (`if (false)`). Not executed. Left for potential future use.

### **Priority Labels (OK)**
**Location:** `aiService.ts`, lines 649-654

```typescript
const priorityLabels = {
    1: "1 (highest)",
    2: "2 (high)", 
    3: "3 (medium)",
    4: "4 (low)",
};
```

**Why OK:** Display labels for priority values. Internal representation. User's priorityMapping controls actual matching.

---

## Search Patterns Used

**Searched for:**
1. `Math.min(<number>, settings...)` - ✅ None found
2. `.slice(0, <number>)` - ✅ Only logging found
3. Hard-coded limits (3, 4, 5, 10, 20, 30) - ✅ All verified as OK
4. All user setting references - ✅ All correct

---

## Testing Recommendations

### Test Case 1: Fallback Respects User Settings
**Setup:**
- Set `maxRecommendations` to 10
- Create a query where AI fails to use [TASK_X] format

**Expected:**
- Fallback returns up to 10 tasks (not limited to 5)
- Console log: "Fallback: returning top N tasks (user limit: 10)"

### Test Case 2: All Settings Work Together
**Setup:**
- maxDirectResults: 50
- maxTasksForAI: 30
- maxRecommendations: 10
- relevanceThreshold: 40
- temperature: 0.5
- maxTokensChat: 2000

**Expected:**
- Smart Search: Returns up to 50 tasks directly
- Task Chat: Sends top 30 tasks to AI
- AI: Recommends up to 10 tasks
- All tasks have relevance score >= 40
- AI uses temperature 0.5 and generates up to 2000 tokens

### Test Case 3: Adaptive Threshold with Override
**Setup:**
- Test 1: relevanceThreshold = 0 (adaptive)
- Test 2: relevanceThreshold = 60 (user override)

**Expected:**
- Test 1: Uses adaptive thresholds (20/30/40 based on keyword count)
- Test 2: Uses 60 regardless of keyword count

---

## Code Locations by Setting

### maxDirectResults
- `aiService.ts:410` - Smart Search results
- `aiService.ts:540` - Simple Search fallback results

### maxTasksForAI
- `aiService.ts:307` - Safety threshold calculation
- `aiService.ts:455` - Tasks sent to AI

### maxRecommendations
- `aiService.ts:1198` - Fallback task limit (FIXED!)
- `aiService.ts:1227` - Automatic addition limit (disabled code)
- `aiService.ts:1258` - Final recommendation limit
- `promptBuilderService.ts:128` - AI prompt guidance

### relevanceThreshold
- `aiService.ts:243` - Check if using adaptive (0)
- `aiService.ts:257` - Use user's value

### temperature
- `aiService.ts:922` - OpenAI API call
- `aiService.ts:997` - Anthropic API call

### maxTokensChat
- `aiService.ts:930` - OpenAI API call
- `aiService.ts:1005` - Anthropic API call

---

## Summary

✅ **1 issue found and fixed** - Fallback limit now respects maxRecommendations  
✅ **All user settings properly respected** - No other hard-coded limits found  
✅ **Comprehensive audit complete** - Entire codebase verified  
✅ **Build successful** - 130.4KB, no errors  

**Status:** All user settings are now fully respected throughout the codebase! 🎉
