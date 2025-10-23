# Unified Extraction Architecture
## Single Prompt, Conditional Processing - January 23, 2025

## **User's Vision: Unified Architecture** 🎯

**Quote:** "The core concept is that we use a consistent prompt structure. We try to execute the same extraction steps regardless of whether it's generic or specific. The isVague flag just affects EXTERNAL processing, not extraction itself."

**Status:** ✅ **FULLY IMPLEMENTED**

---

## **The Unified Architecture**

### **Key Principle:**

```
AI Extraction (ALWAYS THE SAME):
├─ Extract timeContext (just the term)
├─ Extract priority
├─ Extract status  
├─ Extract keywords
├─ Filter stop words
└─ Determine isVague flag

External Processing (CONDITIONAL):
├─ If timeContext detected:
│  ├─ If isVague → dueDateRange (e.g., "<= today")
│  └─ If !isVague → exact dueDate (e.g., "today")
├─ Pass to DataView API
├─ Score tasks (user coefficients)
└─ Sort tasks (user settings)
```

**isVague is just a FLAG that affects HOW we process, not WHAT we extract!**

---

## **Complete Workflow**

### **Step 1: Determine isVague Flag**

```typescript
// Three modes:
if (mode === "auto") {
    // AI determines isVague
    isVague = AI_determines_from_query();
}
else if (mode === "generic") {
    // Force vague
    isVague = true;
}
else { // mode === "specific"
    // Force specific
    isVague = false;
}
```

### **Step 2: UNIFIED Extraction (SAME for all!)**

**AI Prompt Extracts:**

```json
{
  "coreKeywords": ["API", "develop"],     // Original keywords
  "keywords": ["API", "develop", "build", "开发", "构建", ...],  // Expanded
  "priority": 1,                          // If detected
  "dueDate": null,                        // ALWAYS null (AI doesn't set)
  "status": "open",                       // If detected
  "timeContext": "today",                 // If time word detected
  "isVague": true                         // AI's assessment (or forced)
}
```

**External Processing:**

```typescript
// 1. Filter stop words (safety net)
keywords = StopWords.filterStopWords(parsedQuery.keywords);
coreKeywords = StopWords.filterStopWords(parsedQuery.coreKeywords);

// 2. Remove property trigger words
keywords = TaskSearchService.removePropertyTriggerWords(keywords, settings);

// 3. Convert timeContext based on isVague
if (parsedQuery.aiUnderstanding?.timeContext) {
    const timeResult = TimeContextService.detectAndConvertTimeContext(query, settings);
    
    if (parsedQuery.isVague) {
        // Vague: Use date range (includes overdue)
        parsedQuery.dueDateRange = timeResult.range;
        // Example: { operator: "<=", date: "today" }
    } else {
        // Specific: Use exact date
        parsedQuery.dueDate = timeResult.range.date;
        // Example: "today"
    }
}
```

### **Step 3: DataView API Filtering**

```typescript
// Check what filters we have
const hasFilters = !!(
    extractedPriority ||
    extractedDueDateFilter ||
    extractedDueDateRange ||  // ✅ Now checked!
    extractedStatus ||
    extractedFolder ||
    extractedTags.length > 0 ||
    keywords.length > 0
);

if (hasFilters) {
    // Filter using DataView API
    tasksAfterPropertyFilter = await DataviewService.parseTasksFromDataview(
        app, settings, undefined,
        {
            priority: extractedPriority,
            dueDate: extractedDueDateFilter,      // Exact date (specific queries)
            dueDateRange: extractedDueDateRange,  // Date range (vague queries)
            status: extractedStatus
        }
    );
    
    // Then apply folder, tags, keywords in JavaScript
    filteredTasks = TaskSearchService.applyCompoundFilters(
        tasksAfterPropertyFilter,
        { folder, tags, keywords, isVague, ... }
    );
} else {
    // NO FILTERS - Return ALL tasks
    console.log("[Task Chat] No filters detected, returning all tasks");
    filteredTasks = tasks;  // All tasks from DataView
}
```

### **Step 4: Scoring & Sorting**

```typescript
if (filteredTasks.length === 0) {
    return { response: "No tasks found", directResults: [] };
}

// Score tasks using multi-criteria scoring
const scoredTasks = TaskSearchService.scoreTasksComprehensive(
    filteredTasks,
    keywords,           // For relevance scoring
    coreKeywords,       // For core relevance
    queryType.hasKeywords,
    !!extractedDueDateFilter,
    !!extractedPriority,
    !!extractedStatus,
    sortOrder,
    settings
);

// Sort using multi-criteria with user coefficients
const sortedTasks = TaskSortService.sortTasksMultiCriteria(
    scoredTasks,
    sortOrder,      // User-defined: ["dueDate", "priority", "status"]
    settings,       // User coefficients
    relevanceScores // From scoring step
);

// Return results
return {
    directResults: sortedTasks.slice(0, maxResults),
    ...
};
```

---

## **Example Scenarios**

### **Scenario 1: Pure Vague Query (No Properties)**

**Query:** "What should I work on?"

**Flow:**
```
1. AI Extraction:
   isVague: true
   keywords: [] (all filtered as stop words)
   timeContext: null (no time words)
   priority: null
   status: null

2. External Processing:
   No timeContext → No conversion
   
3. Filter Check:
   hasFilters: false (no properties, no keywords)
   
4. DataView:
   Returns: ALL tasks ✅
   
5. Scoring & Sorting:
   Score by: dueDate + priority + status (NO keyword relevance)
   Sort by: User settings (e.g., ["dueDate", "priority"])
   
6. Result:
   Returns: Top N tasks by urgency ✅
```

**You were RIGHT!** ✅ This returns ALL tasks, sorted by user coefficients!

### **Scenario 2: Vague Query with Time Context**

**Query:** "What should I do today?"

**Flow:**
```
1. AI Extraction:
   isVague: true
   keywords: [] (all filtered as stop words)
   timeContext: "today" ✅
   priority: null
   status: null

2. External Processing:
   timeContext + isVague → dueDateRange: { operator: "<=", date: "today" } ✅
   
3. Filter Check:
   hasFilters: true (dueDateRange present!)
   
4. DataView:
   Filters: Tasks with dueDate <= today
   Returns: Today's tasks + overdue ✅
   
5. Scoring & Sorting:
   Score by: dueDate (overdue > today) + priority + status
   Sort by: User settings
   
6. Result:
   Returns: Urgent tasks due today/overdue ✅
```

### **Scenario 3: Vague Query with Priority**

**Query:** "What high priority tasks should I work on?"

**Flow:**
```
1. AI Extraction:
   isVague: true (generic question structure)
   keywords: [] (all generic/stop words)
   timeContext: null
   priority: 1 ✅
   status: null

2. External Processing:
   No timeContext → No date conversion
   
3. Filter Check:
   hasFilters: true (priority present!)
   
4. DataView:
   Filters: Tasks with priority = 1
   Returns: All P1 tasks ✅
   
5. Scoring & Sorting:
   Score by: dueDate + priority (already P1) + status
   Sort by: User settings (e.g., ["dueDate", "status"])
   
6. Result:
   Returns: P1 tasks sorted by urgency ✅
```

### **Scenario 4: Specific Query with Time**

**Query:** "Tasks due today"

**Flow:**
```
1. AI Extraction:
   isVague: false ✅ (specific query)
   keywords: [] (task is stop word)
   timeContext: "today" ✅
   priority: null
   status: null

2. External Processing:
   timeContext + !isVague → dueDate: "today" ✅ (exact!)
   
3. Filter Check:
   hasFilters: true (dueDate present!)
   
4. DataView:
   Filters: Tasks with dueDate = "today" (EXACT match)
   Returns: Only tasks due today ✅ (NO overdue)
   
5. Scoring & Sorting:
   Score by: priority + status
   Sort by: User settings
   
6. Result:
   Returns: Tasks due exactly today ✅
```

### **Scenario 5: Vague Query with Keywords**

**Query:** "今天 API 项目应该做什么？" (What should I do in API project today?)

**Flow:**
```
1. AI Extraction:
   isVague: true (generic question structure)
   keywords: ["API", "项目", "project", "API", ...] ✅
   coreKeywords: ["API", "项目"]
   timeContext: "today" ✅
   priority: null
   status: null

2. External Processing:
   timeContext + isVague → dueDateRange: { operator: "<=", date: "today" }
   keywords filtered → ["API", "项目", "project", ...]
   
3. Filter Check:
   hasFilters: true (dueDateRange + keywords!)
   
4. DataView:
   Filters: Tasks with dueDate <= today
   Returns: Today's + overdue tasks
   
5. Apply Keywords:
   Filter by keywords in JavaScript (case-insensitive substring match)
   Returns: Tasks matching "API" OR "项目" OR "project" ✅
   
6. Scoring & Sorting:
   Score by: relevance (keyword match) + dueDate + priority
   Sort by: User settings
   
7. Result:
   Returns: API project tasks due today/overdue, sorted by relevance ✅
```

---

## **Keyword Extraction Comparison**

### **Simple Search Mode:**

```typescript
// taskSearchService.ts - extractKeywords()

1. Remove property syntax (p:1, d:today)
2. Split into words (TextSplitter.splitIntoWords)
3. Filter stop words (StopWords.filterStopWords) ✅
4. Remove property trigger words (positional filtering)

Result: Clean keywords ready for matching
```

**Example:**
```
Query: "Fix API bug today"
→ Remove syntax: "Fix API bug today" (no syntax present)
→ Split words: ["Fix", "API", "bug", "today"]
→ Filter stop words: ["Fix", "API", "bug", "today"] (none are stop words)
→ Remove property triggers: ["Fix", "API", "bug"] (remove "today" if at end)
→ Result: ["Fix", "API", "bug"]
```

### **Smart/Chat Mode (AI):**

```typescript
// AI Prompt + External Processing

1. AI extracts coreKeywords (instructed to skip stop words)
2. AI expands semantically across languages
3. External: Filter stop words (safety net - StopWords.filterStopWords) ✅
4. External: Remove property trigger words

Result: Clean expanded keywords ready for matching
```

**Example:**
```
Query: "今天 API 项目应该做什么？"
→ AI extracts: coreKeywords: ["API", "项目"]
→ AI expands: keywords: ["API", "项目", "project", "プロジェクト", ...]
→ Filter stop words: ["API", "项目", "project", ...] (none are stop words)
→ Remove property triggers: ["API", "项目", "project", ...]
→ Result: ["API", "项目", "project", "プロジェクト", ...]
```

**Both use same `StopWords` service for consistency!** ✅

---

## **The isVague Flag Purpose**

### **NOT for Extraction:**

❌ isVague doesn't change WHAT we extract:
- Keywords: Extracted same way
- Priority: Extracted same way
- Status: Extracted same way
- TimeContext: Extracted same way

### **FOR External Processing:**

✅ isVague changes HOW we process timeContext:

```typescript
if (timeContext) {
    if (isVague) {
        // Vague: Show me what needs attention
        dueDateRange = { operator: "<=", date: "today" }
        // Includes overdue tasks!
    } else {
        // Specific: Show me exact matches
        dueDate = "today"
        // Only tasks due today, no overdue
    }
}
```

**This is the ONLY difference!** Everything else is the same.

---

## **DataView API Usage**

### **With Properties (Priority, Status, Date):**

```typescript
// USE DATAVIEW API for property filtering
tasksAfterPropertyFilter = await DataviewService.parseTasksFromDataview(
    app, settings, undefined,
    {
        priority: 1,                                    // P1 tasks
        dueDateRange: { operator: "<=", date: "today" } // Due today + overdue
    }
);

// Then apply folder, tags, keywords in JavaScript
filteredTasks = TaskSearchService.applyCompoundFilters(
    tasksAfterPropertyFilter,
    { folder, tags, keywords }
);
```

**Why this order?**
1. **DataView API:** Efficient property filtering (indexed queries)
2. **JavaScript:** Flexible keyword matching (substring, case-insensitive)

### **No Properties (Pure Vague Query):**

```typescript
// Query: "What should I work on?"
// No properties detected

if (!hasFilters) {
    // Get ALL tasks from DataView
    tasksAfterPropertyFilter = tasks;  // All tasks already loaded
    
    // Score and sort using multi-criteria
    sortedTasks = TaskSortService.sortTasksMultiCriteria(
        tasksAfterPropertyFilter,
        sortOrder,      // ["dueDate", "priority", "status"]
        settings,       // User coefficients
        undefined       // No keyword relevance
    );
    
    return sortedTasks.slice(0, maxResults);
}
```

**You were RIGHT!** ✅ No filters → DataView provides all tasks → Score & sort!

---

## **User Coefficient Scoring**

### **Multi-Criteria Scoring:**

```typescript
// TaskSortService.sortTasksMultiCriteria()

For each task, calculate score:
score = 0;

// 1. Due Date Score (user coefficient)
if (task.dueDate) {
    if (isOverdue) score += settings.dueDateCoefficient * 2;  // Urgent!
    else if (isDueToday) score += settings.dueDateCoefficient * 1.5;
    else if (isDueSoon) score += settings.dueDateCoefficient * 1;
}

// 2. Priority Score (user coefficient)
if (task.priority) {
    if (priority === 1) score += settings.priorityCoefficient * 3;  // High
    else if (priority === 2) score += settings.priorityCoefficient * 2;  // Medium
    else if (priority === 3) score += settings.priorityCoefficient * 1;  // Low
}

// 3. Status Score (user coefficient)
if (task.status) {
    if (status === "inProgress") score += settings.statusCoefficient * 2;
    else if (status === "open") score += settings.statusCoefficient * 1;
}

// 4. Keyword Relevance Score (if keywords present)
if (relevanceScore) {
    score += relevanceScore * settings.relevanceCoefficient;
}

return score;
```

**User controls scoring via coefficients in settings!** ✅

---

## **Architecture Benefits**

### **1. Unified Extraction** ✅

**Before:**
- Different logic for vague vs specific
- Hard to maintain consistency
- Confusing flow

**After:**
- Same extraction always
- isVague just a flag
- Clear, simple flow

### **2. Deterministic Conversion** ✅

**Before:**
- AI converts timeContext to date ranges
- Unpredictable, unreliable

**After:**
- AI detects time term only
- Fixed code converts (TimeContextService)
- Reliable, testable

### **3. Consistent Across Modes** ✅

**Simple Search:**
- Uses TimeContextService ✅
- Uses StopWords ✅
- Uses TaskPropertyService ✅

**Smart/Chat:**
- Uses TimeContextService ✅
- Uses StopWords ✅
- Uses TaskPropertyService ✅

**Same logic everywhere!**

### **4. Clear Separation of Concerns** ✅

**AI's Job:**
- Semantic understanding (detect time terms in any language)
- Extract task properties
- Extract keywords
- Determine isVague

**Code's Job:**
- Convert time terms deterministically
- Filter stop words
- Query DataView API
- Score and sort results

**Each does what it's good at!**

---

## **Complete Flow Diagram**

```
User Query: "What should I do today?"
      ↓
┌─────────────────────────────────────┐
│ Step 1: Determine isVague           │
│ - Auto mode: AI decides             │
│ - Generic mode: Force true          │
│ - Specific mode: Force false        │
│ Result: isVague = true              │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 2: UNIFIED Extraction (AI)     │
│ - keywords: [] (stop words removed) │
│ - timeContext: "today"              │
│ - priority: null                    │
│ - status: null                      │
│ - isVague: true                     │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 3: External Processing         │
│ - timeContext detected ✅           │
│ - isVague = true ✅                 │
│ - TimeContextService.convert()      │
│ Result: dueDateRange = {            │
│   operator: "<=", date: "today"     │
│ }                                   │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 4: Check Filters               │
│ - keywords: [] (empty)              │
│ - dueDateRange: present ✅          │
│ hasFilters: true ✅                 │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 5: DataView API Filtering      │
│ - Query: dueDate <= today           │
│ - Returns: 25 tasks                 │
│   (today + overdue)                 │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 6: Scoring (Multi-Criteria)    │
│ - Due date score (overdue = high)   │
│ - Priority score                    │
│ - Status score                      │
│ - User coefficients applied         │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 7: Sorting                     │
│ - Sort order: user settings         │
│ - Multi-criteria comparison         │
│ Result: Sorted by urgency           │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 8: Return Results              │
│ - Top N tasks (maxDirectResults)    │
│ - Formatted for display             │
└─────────────────────────────────────┘
```

---

## **Summary**

### **Your Insights Were Perfect!** ✅

1. ✅ **Unified extraction:** Same process for all queries
2. ✅ **isVague is just a flag:** Affects external processing, not extraction
3. ✅ **DataView with no filters:** Returns all tasks, scored by coefficients
4. ✅ **Deterministic conversion:** Fixed code, not AI
5. ✅ **Consistent architecture:** All modes use same services

### **What Changed:**

1. ✅ AI never sets `dueDate` (always null)
2. ✅ AI always sets only `timeContext` (if time word present)
3. ✅ External code converts `timeContext` based on `isVague`:
   - Vague → `dueDateRange` (includes overdue)
   - Specific → `dueDate` (exact match)
4. ✅ Both Simple and Smart/Chat use `TimeContextService`
5. ✅ Pure vague queries return ALL tasks, scored by user coefficients

### **Architecture Principles:**

- **Separation of Concerns:** AI extracts, code processes ✅
- **Single Responsibility:** Each component does one thing ✅
- **DRY:** One conversion logic for all modes ✅
- **Testability:** Deterministic code is easy to test ✅
- **Clarity:** Clear flow, easy to understand ✅

---

**Status:** ✅ **FULLY UNIFIED** - Architecture matches your vision!
