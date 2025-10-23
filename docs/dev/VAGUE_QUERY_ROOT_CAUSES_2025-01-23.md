# Vague Query Root Causes - Comprehensive Analysis
## January 23, 2025

## **User's Critical Insights** 🎯

> 1. "Why is timeContext set but not dueDate? That's strange since prompt says they're equal!"
> 2. "DueDate should always be in English ('today' not '今天') for easier downstream processing"
> 3. "timeContext should equal dueDate - add validation!"
> 4. "Status='open' default is NOT appropriate - sometimes I want completed tasks"
> 5. "I set overdue coefficient to 0, still get completed tasks - something else is wrong"

**ALL EXCELLENT POINTS!** User is correct on ALL counts!

---

## **ROOT CAUSE #1: Prompt Structure Confusion**

### **The Problem:**

AI prompt has `dueDate` and `timeContext` in DIFFERENT structures:

**Line 1034:** `dueDate`: Top-level field
```json
{
  "dueDate": <string or null>,
  ...
  "aiUnderstanding": {
    ...
  }
}
```

**Line 1047:** `timeContext`: Inside `aiUnderstanding` object
```json
{
  ...
  "aiUnderstanding": {
    "timeContext": <string or null>,
    ...
  }
}
```

**WHY THIS CONFUSES AI:**
- Different nesting levels suggest different purposes
- Line 1020 says "Same as dueDate" but structure says otherwise
- Line 1022 says "for debugging, not filtering" → AI thinks it's optional

### **Fix #1: Restructure Prompt**

Make them SIBLING fields and EMPHASIZE they must match:

```
⚠️ CRITICAL TIME EXTRACTION RULES:

When query mentions time (today/明天/idag/tomorrow/etc.):

1. **Extract to ENGLISH** - ALWAYS use English terms
   ✅ CORRECT: "今天" → dueDate: "today"
   ❌ WRONG: "今天" → dueDate: "今天"
   
2. **Set BOTH fields to SAME English value:**
   - dueDate: "today" (for filtering)
   - timeContext: "today" (for metadata)
   ✅ BOTH must match EXACTLY
   ❌ NEVER set only one

3. **Supported English terms:**
   - "today", "tomorrow", "overdue"
   - "this week", "next week"
   - "this month", "next month"
   - Relative: "+3d", "+1w", "+2m"

Extract ALL filters from the query and return ONLY a JSON object:
{
  "coreKeywords": [...],
  "keywords": [...],
  "priority": <number or null>,
  "dueDate": <ENGLISH string or null>,  ⚠️ MUST be English!
  "status": <string or null>,
  "folder": <string or null>,
  "tags": [...],
  "isVague": <boolean>,
  "aiUnderstanding": {
    "detectedLanguage": <string>,
    "correctedTypos": [...],
    "semanticMappings": {...},
    "timeContext": <ENGLISH string or null>,  ⚠️ MUST match dueDate!
    "confidence": <number>,
    "naturalLanguageUsed": <boolean>,
    "isVagueReasoning": <string>
  }
}
```

### **Fix #2: Add Validation Logic**

In aiQueryParserService.ts (after parsing):

```typescript
// Validate and sync dueDate ↔ timeContext
if (parsed.dueDate && parsed.aiUnderstanding?.timeContext) {
    // Both set - ensure they match
    if (parsed.dueDate !== parsed.aiUnderstanding.timeContext) {
        console.warn(`[Task Chat] ⚠️ Mismatch: dueDate="${parsed.dueDate}" vs timeContext="${parsed.aiUnderstanding.timeContext}"`);
        console.warn(`[Task Chat] Using dueDate value for both`);
        parsed.aiUnderstanding.timeContext = parsed.dueDate;
    }
} else if (parsed.dueDate && !parsed.aiUnderstanding?.timeContext) {
    // Only dueDate set - copy to timeContext
    console.log(`[Task Chat] Syncing timeContext from dueDate: "${parsed.dueDate}"`);
    if (!parsed.aiUnderstanding) parsed.aiUnderstanding = {};
    parsed.aiUnderstanding.timeContext = parsed.dueDate;
} else if (!parsed.dueDate && parsed.aiUnderstanding?.timeContext) {
    // Only timeContext set - copy to dueDate
    console.log(`[Task Chat] Syncing dueDate from timeContext: "${parsed.aiUnderstanding.timeContext}"`);
    parsed.dueDate = parsed.aiUnderstanding.timeContext;
}
```

---

## **ROOT CAUSE #2: Not a Status Filter Issue!**

### **User's Insight: "Status='open' default is wrong!"**

**User is 100% CORRECT!**

The REAL problem is NOT missing status filter. It's:

1. **Scoring problem** - Completed tasks score too high
2. **Sort order problem** - Not prioritizing open tasks
3. **DataView filtering issue** - Many old completed tasks exist

### **Evidence:**

**From user's test:**
```
Set overdue coefficient to 0
Simple Search still returns many completed tasks
→ It's NOT about due date scoring!
```

**From console logs:**
```
After filtering: 880 tasks found
→ No status filter applied anywhere!
```

**Status scores:**
```typescript
// settings.ts defaults
open: score 1.0 ✅
inProgress: score 0.75
completed: score 0.2  ← Still gets points!
cancelled: score 0.1
```

### **Why Completed Tasks Show Up:**

**For vague query "What should I do today?":**

**Completed task** (finished yesterday):
```
Relevance: 0 (no keywords)
DueDate: 1.5 (was yesterday - overdue)
Priority: 1.0 (P1)
Status: 0.2 (completed)
TOTAL: (0 × 20) + (1.5 × 4) + (1.0 × 1) + (0.2 × 1) = 7.2
```

**Open task** (no due date):
```
Relevance: 0 (no keywords)
DueDate: 0.1 (no date)
Priority: 0.1 (no priority)
Status: 1.0 (open)
TOTAL: (0 × 20) + (0.1 × 4) + (0.1 × 1) + (1.0 × 1) = 1.5
```

**Result:** Completed task scores 7.2 > Open task 1.5! ❌

### **The REAL Fix: Status Coefficient Activation**

The issue is that **status coefficient is ALWAYS active (1.0)** even for vague queries!

**Current logic (taskSearchService.ts line 1506-1515):**
```typescript
const relevanceCoefficient = queryHasKeywords || relevanceInSort ? 1.0 : 0.0;
const dueDateCoefficient = queryHasDueDate || dueDateInSort ? 1.0 : 0.0;
const priorityCoefficient = queryHasPriority || priorityInSort ? 1.0 : 0.0;
const statusCoefficient = queryHasStatus || statusInSort ? 1.0 : 0.0;
```

**Problem:** For vague queries:
- No status in query → `queryHasStatus = false`
- Status in sort order → `statusInSort = true`
- Result: `statusCoefficient = 1.0` ✅

**This is CORRECT behavior!** Status IS in sort order, so it SHOULD be active.

The issue is the **status scores themselves are TOO HIGH for completed tasks** in vague query context!

### **Better Fix: Status Boost for Open Tasks in Vague Queries**

Instead of filtering, BOOST open task scores for vague queries:

```typescript
// In scoreTasksComprehensive, after calculating statusScore:
if (isVagueQuery && statusCategory === 'open') {
    // Boost open tasks for vague queries
    statusScore *= 2.0;  // Open tasks get double status weight
    console.log(`[Task Chat] Vague query boost: Open task status ${statusScore} (boosted)`);
}
```

Or even better: **Use sort order to prioritize open tasks:**

**Current sort:** `["relevance", "dueDate", "priority"]`
**Better for vague:** `["status", "dueDate", "priority"]` (status first!)

This way:
- Open tasks (status=1.0) sort first
- Then by due date (overdue first)
- Completed tasks naturally sink to bottom

---

## **ROOT CAUSE #3: DataView Not Filtering Status**

### **From logs:**

```
[Simple Search] Extracted properties: {status: 'none', ...}
[Task Chat] Task-level filtering complete: 880 tasks matched
```

No status filter is applied! DataView returns ALL tasks regardless of status.

### **Why?**

**Simple Search** doesn't extract status from vague queries:
```
"What should I do today?"
→ Keywords: [] (all generic)
→ Status: null (not extracted)
→ DataView: No status filter
→ Result: All 880 tasks returned
```

### **Fix Options:**

**Option A: Don't add status filter** (User is right!)
- Let scoring handle it
- Use sort order to prioritize open
- Keep flexibility

**Option B: Add UI toggle** (Better!)
```
[x] Show completed tasks in vague queries
```
- Default: OFF (hide completed)
- User can enable if wanted

**Option C: Smarter vague handling** (Best!)
- Check if query implies "actionable" (today, should, do)
- If yes: Exclude completed
- If no (e.g., "tasks finished yesterday"): Include all

---

## **RECOMMENDED FIXES**

### **Priority 1: Fix dueDate/timeContext Sync** ✅

1. Update prompt - make BOTH fields siblings, emphasize ENGLISH + MATCH
2. Add validation logic - sync missing/mismatched values
3. Add logging for debugging

### **Priority 2: Improve Vague Query Scoring** ✅

**Don't add status filter!** User is right.

Instead:
1. Change default sort for vague queries: `["status", "dueDate", "priority"]`
2. Or boost open task scores: `statusScore *= 2.0` for vague + open
3. This preserves flexibility while improving UX

### **Priority 3: Add Status Filter UI Toggle** (Optional)

```typescript
// In settings
vagueQueryExcludeCompleted: boolean; // Default: true

// In vague query handling
if (isVague && settings.vagueQueryExcludeCompleted) {
    // Exclude completed from results
    tasks = tasks.filter(t => t.statusCategory !== 'completed');
}
```

User can disable if they want completed tasks.

---

## **Implementation Plan**

### **Step 1: Fix Prompt (High Priority)**

```typescript
// aiQueryParserService.ts lines 1015-1027

⚠️ CRITICAL TIME EXTRACTION RULES:

When query mentions time in ANY language (today/今天/idag, tomorrow/明天/imorgon, etc.):

1. **ALWAYS convert to English:**
   - "今天" → "today"
   - "明天" → "tomorrow" 
   - "idag" → "today"
   - Supported: "today", "tomorrow", "overdue", "this week", "next week", "+3d", etc.

2. **Set BOTH fields to SAME English value:**
   - dueDate: "today" (for filtering - REQUIRED)
   - timeContext: "today" (for metadata - MUST MATCH)
   - ⚠️ These MUST be identical! Never set only one!

Examples:
✅ "今天可以做什么？" → dueDate: "today", timeContext: "today"
✅ "What should I do tomorrow?" → dueDate: "tomorrow", timeContext: "tomorrow"
❌ "今天可以做什么？" → dueDate: null, timeContext: "今天" (WRONG - missing dueDate)
❌ "今天可以做什么？" → dueDate: "今天", timeContext: "今天" (WRONG - not English)
```

### **Step 2: Add Validation (High Priority)**

```typescript
// aiQueryParserService.ts after line 1836
// Before creating result object:

// Validate and sync dueDate ↔ timeContext
if (parsed.dueDate || parsed.aiUnderstanding?.timeContext) {
    const dueDate = parsed.dueDate;
    const timeContext = parsed.aiUnderstanding?.timeContext;
    
    if (dueDate && timeContext) {
        // Both set - ensure they match
        if (dueDate !== timeContext) {
            console.warn(`[Task Chat] ⚠️ AI returned mismatched time fields:`);
            console.warn(`[Task Chat]   dueDate: "${dueDate}"`);
            console.warn(`[Task Chat]   timeContext: "${timeContext}"`);
            console.warn(`[Task Chat]   Using dueDate for both (dueDate takes precedence)`);
            parsed.aiUnderstanding = parsed.aiUnderstanding || {};
            parsed.aiUnderstanding.timeContext = dueDate;
        }
    } else if (dueDate && !timeContext) {
        // Only dueDate set - sync to timeContext
        console.log(`[Task Chat] Syncing timeContext from dueDate: "${dueDate}"`);
        parsed.aiUnderstanding = parsed.aiUnderstanding || {};
        parsed.aiUnderstanding.timeContext = dueDate;
    } else if (!dueDate && timeContext) {
        // Only timeContext set - sync to dueDate
        console.log(`[Task Chat] Syncing dueDate from timeContext: "${timeContext}"`);
        parsed.dueDate = timeContext;
    }
}
```

### **Step 3: Improve Vague Query Handling (Medium Priority)**

**Option A: Change Sort Order (Simple)**
```typescript
// aiService.ts - for vague queries
if (isVague && !hasSpecificKeywords) {
    // Prioritize status for vague queries
    displaySortOrder = ["status", "dueDate", "priority"];
    console.log("[Task Chat] Vague query: Using status-first sort order");
}
```

**Option B: Boost Open Tasks (More control)**
```typescript
// taskSearchService.ts scoreTasksComprehensive
// After line 1522 (calculating statusScore):
if (isVagueQuery && statusCategory === 'open') {
    statusScore *= 2.0; // Boost open tasks
    console.log(`[Task Chat] Vague query: Boosted open task status to ${statusScore.toFixed(2)}`);
}
```

---

## **Summary**

### **User's Insights - ALL CORRECT:**

1. ✅ dueDate/timeContext should be equal - prompt structure confuses AI
2. ✅ Should always be English - makes processing easier
3. ✅ Need validation - add sync logic
4. ✅ Status='open' default is wrong - sometimes want completed
5. ✅ Real issue is NOT coefficient - it's scoring/sorting

### **Root Causes:**

1. **Prompt structure** - dueDate and timeContext in different levels
2. **No English requirement** - AI uses original language
3. **No validation** - Mismatch not caught
4. **Sorting issue** - Completed tasks with dates rank higher than open without
5. **Status scoring** - Completed (0.2) still gets points

### **Recommended Fixes:**

1. **HIGH:** Update prompt - emphasize English + matching
2. **HIGH:** Add validation/sync logic
3. **MEDIUM:** Improve vague query sorting (status-first or boost)
4. **LOW:** Add UI toggle for excluding completed (optional)

---

**User was right on all counts! No status filter needed - fix the root causes instead.** 🎯
