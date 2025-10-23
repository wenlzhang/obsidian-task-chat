# Vague Query Handling - Comprehensive Improvements
## January 23, 2025

## **User's Excellent Insights**

1. **Time context vs filter**: "Today" in vague queries should be context, not strict filter
2. **Broader interpretation**: "Today" should include overdue tasks (need attention today!)
3. **Mixed queries**: Even if vague, still extract meaningful keywords

---

## **Current Issues**

### **Issue #1: Regex Overrides AI Decision**

**Location:** `aiService.ts` lines 155-158

**Problem:**
```typescript
// AI correctly determines vague query → dueDate: null
parsedQuery.dueDate = null;  // ✅

// But regex pre-extraction overwrites it!
if (preExtractedIntent.extractedDueDateFilter) {
    parsedQuery.dueDate = preExtractedIntent.extractedDueDateFilter;  // ❌
}
```

**Result:** AI's intelligent vague query handling is ignored!

---

### **Issue #2: "Today" is Too Restrictive**

**Query:** "今天可以做什么？" (What can I do today?)

**Current behavior:**
- Filters to: `dueDate === 'today'`
- Shows: Only tasks due today (maybe 5 tasks)
- Misses: ALL overdue tasks (maybe 20 tasks that need attention!)

**Better behavior:**
- Interpret "today" as: "What needs my attention today?"
- Include:
  - Tasks due today
  - ALL overdue tasks
  - Urgent tasks without due dates
  - Maybe upcoming tasks in next 1-2 days

**User's logic:**
> "Users may need to process and reassign tasks that are past due. Therefore, it should include both tasks due today and those that are past due."

**This is 100% correct!** ✅

---

### **Issue #3: Losing Meaningful Keywords**

**Query:** "What API tasks should I do today?"

**Breakdown:**
- Generic: "what", "should", "do", "today" (67%)
- Meaningful: "API", "tasks" (33%)

**Current:**
- Detected as vague (if threshold <= 67%)
- ALL keywords ignored (including "API"!)

**Better:**
- Detect as vague ✅
- But STILL extract "API" as keyword ✅
- Skip ONLY generic keywords ✅

---

## **Proposed Solutions**

### **Solution #1: Respect AI's Vague Query Decision**

**Change:** Only use pre-extracted properties for NON-vague queries

**Code change (aiService.ts lines 150-170):**

```typescript
// BEFORE (WRONG)
// Merge pre-extracted properties with AI-parsed properties
// Pre-extracted properties take precedence (more reliable)
if (preExtractedIntent.extractedPriority) {
    parsedQuery.priority = preExtractedIntent.extractedPriority;
}
if (preExtractedIntent.extractedDueDateFilter) {
    parsedQuery.dueDate = preExtractedIntent.extractedDueDateFilter;  // ❌ Overwrites AI!
}

// AFTER (CORRECT)
// For vague queries, trust AI's decision
// For specific queries, use pre-extracted properties (more reliable for syntax like p:1, d:today)
if (!parsedQuery.isVague) {
    // Specific query - use pre-extracted properties (syntax-based)
    if (preExtractedIntent.extractedPriority) {
        parsedQuery.priority = preExtractedIntent.extractedPriority;
    }
    if (preExtractedIntent.extractedDueDateFilter) {
        parsedQuery.dueDate = preExtractedIntent.extractedDueDateFilter;
    }
    if (preExtractedIntent.extractedStatus) {
        parsedQuery.status = preExtractedIntent.extractedStatus;
    }
} else {
    // Vague query - trust AI's semantic understanding
    // AI knows "今天" is context, not filter
    console.log("[Task Chat] Vague query detected - using AI's property interpretation");
}
```

**Impact:**
- Vague queries: AI's decision respected
- Specific queries: Regex syntax still works (`p:1`, `d:today`)

---

### **Solution #2: Expand Time Context to Include Overdue**

**New logic for vague queries with time context:**

**Option A: Use `dueDateRange` instead of `dueDate`**

```typescript
// For vague query "今天可以做什么？"
if (isVague && timeContext === "today") {
    // Don't filter by exact date
    // Use range: everything up to and including today
    dueDate: null,
    dueDateRange: {
        operator: "<=",
        date: "today"
    }
}

// Results:
// - Tasks due today ✅
// - Tasks overdue ✅
// - Tasks due tomorrow ❌ (not included)
```

**Option B: Special "needs-attention-today" filter**

```typescript
// For vague query "今天可以做什么？"
if (isVague && timeContext === "today") {
    specialFilter: "needs-attention-today"
}

// In DataView filtering:
if (specialFilter === "needs-attention-today") {
    return (
        task.dueDate === today ||
        task.dueDate < today ||  // Overdue
        (task.priority >= 1 && !task.dueDate)  // Urgent without date
    );
}
```

**Option C: Don't filter by date at all, let AI prioritize**

```typescript
// For vague query "今天可以做什么？"
if (isVague && timeContext) {
    dueDate: null,  // No filtering!
    aiContext: {
        timeContext: "today",
        instruction: "Prioritize tasks for today's workload"
    }
}

// Results: ALL tasks returned
// AI analyzes and recommends based on:
// - Due today
// - Overdue
// - Urgent
// - User's "today" context
```

**Recommended: Option A (dueDateRange)**
- Clear semantics
- DataView can filter efficiently
- Includes overdue (most important!)
- Doesn't overwhelm with ALL tasks

---

### **Solution #3: Extract Meaningful Keywords from Vague Queries**

**Current:**
```typescript
if (isVague) {
    // Skip ALL keyword filtering
}
```

**Better:**
```typescript
if (isVague) {
    // Filter OUT generic keywords, KEEP meaningful ones
    const meaningfulKeywords = keywords.filter(kw => 
        !StopWords.isGenericWord(kw)
    );
    
    if (meaningfulKeywords.length > 0) {
        console.log(`[Task Chat] Vague query but found ${meaningfulKeywords.length} meaningful keywords`);
        // Use meaningful keywords for loose matching
        keywords = meaningfulKeywords;
    } else {
        console.log(`[Task Chat] Vague query with no meaningful keywords - skip keyword filter`);
        keywords = [];
    }
}
```

**Example:**

```
Query: "What API tasks should I do today?"

Step 1: Detect as vague (67% generic)
Step 2: Extract keywords: ["what", "API", "tasks", "should", "do", "today"]
Step 3: Filter generic: ["API", "tasks"] (keep!)
Step 4: Use for loose matching

Result: Tasks mentioning "API" or "tasks", filtered by time context
```

**Benefits:**
- Vague queries can still be targeted (if user mentions specific terms)
- Pure vague queries ("What should I do?") still work (no keywords)
- Best of both worlds!

---

## **Implementation Priority**

### **Priority 1: Fix Regex Override (Critical Bug)**

**File:** `aiService.ts` lines 150-170  
**Impact:** HIGH - Breaks all vague query handling  
**Effort:** LOW - Simple conditional change  

**Fix:**
```typescript
if (!parsedQuery.isVague) {
    // Only merge pre-extracted for specific queries
}
```

---

### **Priority 2: Expand Time Context (User Experience)**

**Files:** 
- `aiService.ts` - Interpret timeContext as dueDateRange
- `dataviewService.ts` - Support range filtering
- `aiQueryParserService.ts` - Update AI prompt

**Impact:** HIGH - Makes "today" queries much more useful  
**Effort:** MEDIUM - Need to handle date ranges  

**Options:**
1. Use `dueDateRange: { operator: "<=", date: "today" }`
2. Or don't filter at all, let AI prioritize

---

### **Priority 3: Extract Meaningful Keywords (Enhancement)**

**File:** `taskSearchService.ts` lines 781-793  
**Impact:** MEDIUM - Improves mixed vague queries  
**Effort:** LOW - Filter keywords by generic check  

**Fix:**
```typescript
if (isVague) {
    const meaningful = keywords.filter(kw => !StopWords.isGenericWord(kw));
    keywords = meaningful.length > 0 ? meaningful : [];
}
```

---

## **Testing Scenarios**

### **Test 1: Pure Vague Query**

**Query:** "What should I do?"

**Expected:**
- isVague: true
- keywords: [] (all generic)
- dueDate: null
- Result: ALL tasks, AI recommends based on priority/urgency

---

### **Test 2: Vague Query with Time Context**

**Query:** "今天可以做什么？" (What can I do today?)

**Expected:**
- isVague: true
- keywords: [] (all generic)
- timeContext: "today"
- dueDateRange: { operator: "<=", date: "today" }
- Result: Tasks due today + overdue tasks

---

### **Test 3: Mixed Vague Query**

**Query:** "What API tasks should I do today?"

**Expected:**
- isVague: true (67% generic)
- keywords: ["API", "tasks"] (meaningful only!)
- timeContext: "today"
- dueDateRange: { operator: "<=", date: "today" }
- Result: API-related tasks that are due/overdue

---

### **Test 4: Specific Query (Should Not Change)**

**Query:** "Fix authentication bug priority 1"

**Expected:**
- isVague: false
- keywords: ["fix", "authentication", "bug", "priority"]
- priority: 1 (from syntax)
- Result: Normal keyword + property filtering

---

## **Benefits Summary**

### **For Users:**

**Before:**
- "今天可以做什么？" → Only tasks due today (maybe 2 tasks)
- "What API tasks?" → If detected as vague, 0 tasks

**After:**
- "今天可以做什么？" → Due + overdue tasks (maybe 20 tasks) ✅
- "What API tasks?" → All API tasks, even if query is vague ✅

### **For System:**

- ✅ AI's vague query detection respected
- ✅ Time context interpreted intelligently
- ✅ Mixed queries handled better
- ✅ More useful results for users

---

## **Recommendation**

**Implement all three solutions:**

1. **Priority 1 (Critical):** Fix regex override
   - Small change, huge impact
   - Enables AI's vague query intelligence

2. **Priority 2 (High Value):** Expand time context
   - User's insight is perfect
   - "Today" = today + overdue (what needs attention)

3. **Priority 3 (Enhancement):** Extract meaningful keywords
   - Handles mixed vague queries better
   - Doesn't hurt pure vague queries

**Status:** Ready for implementation!

---

## **User's Original Insights**

All excellent and now addressed:

1. ✅ Time as context, not strict filter
2. ✅ "Today" includes overdue tasks
3. ✅ Still extract meaningful keywords from vague queries
4. ✅ Respect AI's semantic understanding

**Thank you for these insights!** They reveal fundamental design issues that significantly impact user experience.
