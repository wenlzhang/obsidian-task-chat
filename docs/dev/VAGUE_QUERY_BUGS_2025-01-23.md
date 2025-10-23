# Vague Query Bugs - Two Critical Issues
## January 23, 2025

## **User's Report** 🎯

Tested query: **"What should I do today?"** / **"今天可以做什么？"**

**Simple Search (English):** Returns 880 tasks, most completed ❌
**Smart Search (Chinese):** Returns 0 tasks ❌

---

## **BUG #1: Simple Search - No Status Filter for Vague Queries**

### **Current Behavior:**

```
Query: "What should I do today?"
Keywords filtered: [What, should, I, do] → All generic ✅
DueDate range: "today" → Applied ✅
Status: null ❌ (NO FILTER!)
Results: 880 tasks (includes completed) ❌
```

### **Problem:**

For vague/general queries without specific keywords, system should default to showing OPEN tasks only!

**Current:**
- Returns ALL tasks (open + completed) for time period
- User sees hundreds of already-completed tasks
- Not useful!

**Expected:**
- For vague queries, default `status: "open"`
- Show only actionable tasks
- Much more useful!

### **Root Cause:**

No logic to default status for vague queries anywhere in codebase.

**Simple Search:** taskSearchService.ts analyzeQueryIntent()
- Detects vague query ✅
- Sets dueDate range ✅  
- **Does NOT set status** ❌

**Smart/Chat:** aiQueryParserService.ts parseWithAI()
- AI detects vague query ✅
- **Does NOT default status to "open"** ❌

### **Fix #1 Needed:**

**For ALL vague queries without explicit status:**
```typescript
if (isVague && !status && !hasSpecificKeywords) {
    status = "open";  // Default to open tasks
    console.log("[...] Vague query: Defaulting to open tasks");
}
```

---

## **BUG #2: Smart Search - Wrong Fallback for Vague Queries**

### **Current Behavior:**

```
Query: "今天可以做什么？"
AI returns: {
  coreKeywords: [],
  keywords: [],
  dueDate: null,  ← BUG!
  timeContext: "今天",  ✅
  isVague: true ✅
}
Fallback creates keyword: ["今天可以做什么？"]  ← Full query as single keyword!
Search for exact match: "今天可以做什么？"
Results: 0 tasks ❌
```

### **Problem #1: AI Not Setting dueDate**

AI correctly detects `timeContext: "今天"` but doesn't set `dueDate: "今天"`!

**From prompt (line 1016-1022):**
```
1. **Extract dueDate** - If query mentions time/deadlines in ANY of the languages
   - Examples: "tasks due today", "What can I do today?", "Fix bug tomorrow"
   - Set: dueDate = "today" (external code converts if vague)
   
2. **Set timeContext** - Same as dueDate, for metadata/logging
   - Always set when time word detected
```

**AI should set BOTH**, but only setting timeContext!

### **Problem #2: Wrong Fallback Logic**

When AI returns no keywords, fallback uses **full query text**:

**aiQueryParserService.ts lines 1465-1471:**
```typescript
console.log("[Task Chat] AI returned no filters or keywords, splitting query into words");
keywords = StopWords.filterStopWords(
    query.split(/\s+/).filter((word) => word.length > 0),
);
```

**For Chinese:** No spaces → `"今天可以做什么？"` becomes single "keyword"!

**Searches for exact phrase** → No matches!

### **Fix #2A: Make AI Set dueDate**

Need to emphasize in prompt that `dueDate` must be set when timeContext detected:

```
⚠️ CRITICAL: When you detect time context, you MUST set BOTH fields:
1. dueDate = the time term (e.g., "today", "tomorrow") 
2. timeContext = same value (for metadata)

Example: "What should I do today?"
✅ CORRECT: dueDate: "today", timeContext: "today"
❌ WRONG: dueDate: null, timeContext: "today"
```

### **Fix #2B: Better Vague Query Handling**

For vague queries with timeContext but no keywords:

**Current:**
```typescript
if (no keywords && no filters) {
    // Split query into words (BAD for Chinese!)
    keywords = query.split(/\s+/);
}
```

**Should be:**
```typescript
if (isVague && timeContext && !keywords.length) {
    // Don't create fallback keywords!
    // Use timeContext as dueDate if not already set
    if (!parsed.dueDate && parsed.aiUnderstanding?.timeContext) {
        parsed.dueDate = parsed.aiUnderstanding.timeContext;
    }
    // Will filter by time + default status
}
```

---

## **The Complete Fix**

### **Location 1: aiQueryParserService.ts (lines 1838-1863)**

Add status defaulting for vague queries:

```typescript
const result: ParsedQuery = {
    // PART 1: Task Content
    coreKeywords: coreKeywords,
    keywords: expandedKeywords,

    // PART 2: Task Attributes
    priority: parsed.priority || undefined,
    dueDate: parsed.dueDate || 
        (isVague && parsed.aiUnderstanding?.timeContext 
            ? parsed.aiUnderstanding.timeContext 
            : undefined),  // Use timeContext if dueDate missing
    status: parsed.status || 
        (isVague && !parsed.status && coreKeywords.length === 0 
            ? "open"  // Default vague queries to open tasks
            : undefined),
    folder: parsed.folder || undefined,
    tags: parsed.tags || [],
    
    // ... rest
};

if (isVague) {
    if (!parsed.status && coreKeywords.length === 0) {
        console.log("[Task Chat] Vague query: Defaulting to open tasks");
    }
    if (!parsed.dueDate && parsed.aiUnderstanding?.timeContext) {
        console.log(`[Task Chat] Vague query: Using timeContext "${parsed.aiUnderstanding.timeContext}" as dueDate`);
    }
}
```

### **Location 2: taskSearchService.ts analyzeQueryIntent()**

Add status defaulting for Simple Search vague queries:

```typescript
// After vague query detection (around line 1020)
if (isVague && !extractedStatus && keywords.length === 0) {
    extractedStatus = "open";
    console.log("[Simple Search] Vague query: Defaulting to open tasks");
}
```

### **Location 3: AI Prompt Enhancement**

Emphasize dueDate + timeContext pairing (around line 1016):

```
1. **Extract dueDate** - If query mentions time/deadlines in ANY of the languages
   - Recognize: today/今天/idag, tomorrow/明天/imorgon, this week/本周/denna vecka
   - Examples: "tasks due today", "What can I do today?", "Fix bug tomorrow"
   - Set: dueDate = "today" (external code converts if vague)
   
2. **Set timeContext** - MUST match dueDate value
   - ⚠️ CRITICAL: Always set this to SAME value as dueDate
   - Used for metadata/logging and fallback
   - Example: If dueDate="today" → timeContext="today"

⚠️ BOTH MUST BE SET TOGETHER! Never set only one.
```

---

## **Expected Behavior After Fix**

### **Simple Search - "What should I do today?"**

```
Keywords: [] (all generic) ✅
DueDate: "today" ✅
DueDateRange: {operator: "<=", date: "today"} ✅ (converted)
Status: "open" ✅ (DEFAULTED!)
Results: Open tasks due today + overdue ✅
```

### **Smart Search - "今天可以做什么？"**

```
AI returns: {
  coreKeywords: [],
  keywords: [],
  dueDate: "今天", ✅ (NOW SET!)
  timeContext: "今天", ✅
  isVague: true ✅
}
No fallback keywords needed ✅
Status: "open" ✅ (DEFAULTED!)
DueDateRange: {operator: "<=", date: "今天"} ✅ (converted)
Results: Open tasks due today + overdue ✅
```

---

## **Summary**

### **Bug #1: No Status Filter**

**Problem:** Vague queries return all tasks (including completed)
**Fix:** Default `status: "open"` for vague queries without keywords
**Locations:** aiQueryParserService.ts + taskSearchService.ts

### **Bug #2: Wrong Vague Handling**

**Problem #1:** AI not setting `dueDate` when it sets `timeContext`
**Fix:** Emphasize in prompt, fallback to timeContext if missing
**Location:** AI prompt + aiQueryParserService.ts

**Problem #2:** Fallback creates unusable keyword from full query
**Fix:** Don't create fallback keywords for vague queries with timeContext
**Location:** aiQueryParserService.ts (lines 1457-1471)

---

## **Implementation Priority**

1. ✅ **HIGH:** Add status="open" defaulting (simple, big impact)
2. ✅ **HIGH:** Use timeContext as dueDate fallback (fixes Chinese query)
3. ✅ **MEDIUM:** Update AI prompt (improves future queries)
4. ✅ **LOW:** Remove fallback keyword creation for vague+timeContext (cleaner)

---

**Status:** Ready to implement - All issues identified and solutions designed! 🎯
