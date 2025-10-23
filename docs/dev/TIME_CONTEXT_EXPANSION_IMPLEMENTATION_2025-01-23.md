# Time Context Expansion for Vague Queries
## Implementation Guide - January 23, 2025

## **User's Insight**

> "If it's a generic query and it detects a date like today, tomorrow, this week, this month, or something like that—it should be interpreted as a range, right? It should include tasks due until today, encompassing both past due and today's tasks."

**This is PERFECT logic!** ✅

---

## **The Problem**

**Query:** "今天可以做什么？" (What can I do today?)

**User's mental model:**
- "What needs my attention today?"
- Includes: Tasks due today + ALL overdue tasks
- Reasoning: Overdue tasks need to be handled, reassigned, or completed today

**Current system:**
- AI correctly identifies `timeContext: "today"` (not a filter)
- But doesn't use this information effectively
- Result: All tasks returned (too broad) OR no tasks (if filtering)

**Better system:**
- Interpret `timeContext: "today"` → Filter to relevant tasks
- Include tasks that need attention today:
  - Tasks due today
  - ALL overdue tasks
  - Maybe: Urgent tasks without due dates

---

## **Design Options**

### **Option A: Date Range Filter (RECOMMENDED)**

**Concept:** Convert time context to date range

**Implementation:**
```typescript
// In aiQueryParserService.ts
if (isVague && aiUnderstanding.timeContext) {
    const timeContext = aiUnderstanding.timeContext;
    
    if (timeContext === "today") {
        // Everything up to and including today
        dueDateRange = {
            operator: "<=",
            date: "today"
        };
    } else if (timeContext === "tomorrow") {
        // Everything up to tomorrow
        dueDateRange = {
            operator: "<=",
            date: "tomorrow"
        };
    } else if (timeContext === "this week") {
        // Everything up to end of this week
        dueDateRange = {
            operator: "<=",
            date: "end-of-week"
        };
    }
}
```

**Pros:**
- Clear semantics
- DataView can filter efficiently
- Includes overdue (most important!)
- Not too broad (still focused)

**Cons:**
- Need to support date range filtering in DataView API
- Slightly more complex than simple date filter

---

### **Option B: Custom Filter Type**

**Concept:** Special filter type for "needs attention"

**Implementation:**
```typescript
// In aiQueryParserService.ts
if (isVague && aiUnderstanding.timeContext === "today") {
    specialFilter: "needs-attention-today"
}

// In DataviewService.ts
if (filters.specialFilter === "needs-attention-today") {
    const today = moment().format("YYYY-MM-DD");
    
    dvQuery += ` WHERE (
        dueDate = "${today}" OR
        dueDate < "${today}" OR
        (priority >= 1 AND !dueDate)
    )`;
}
```

**Pros:**
- Very explicit about intent
- Can include additional logic (urgent without dates)
- Easy to understand

**Cons:**
- Special case logic
- Less generalizable to other time contexts
- Harder to extend

---

### **Option C: No Filtering, AI Prioritization**

**Concept:** Return ALL tasks, let AI prioritize based on context

**Implementation:**
```typescript
// In aiQueryParserService.ts
if (isVague && aiUnderstanding.timeContext) {
    // Don't filter by date at all
    dueDate: null,
    dueDateRange: null,
    
    // Pass to AI for prioritization
    aiContext: {
        timeContext: "today",
        instruction: "Prioritize tasks that need attention today"
    }
}

// AI prompt includes:
"User's time context: {timeContext}
Consider prioritizing:
- Tasks due {timeContext}
- Overdue tasks
- Urgent tasks without due dates"
```

**Pros:**
- Maximum flexibility
- AI can make intelligent decisions
- No DataView complexity

**Cons:**
- Returns ALL tasks (could be hundreds)
- More expensive (AI analyzes more tasks)
- Slower performance

---

## **Recommended Implementation: Option A (Date Range)**

**Why:**
1. ✅ Includes overdue tasks (user's main concern)
2. ✅ Focused results (not overwhelming)
3. ✅ Efficient (DataView filtering)
4. ✅ Generalizable (works for "tomorrow", "this week", etc.)

---

## **Step-by-Step Implementation**

### **Step 1: Update AI Prompt to Use Time Context**

**File:** `aiQueryParserService.ts` lines 1017-1050

**Current:**
```typescript
Query: "今天可以做什么？" (What can I do today?)
→ isVague: true
→ dueDate: null (don't filter by date!)
→ aiUnderstanding.timeContext: "today"
→ Strategy: Return ALL tasks, let AI prioritize based on "today" context
```

**New:**
```typescript
Query: "今天可以做什么？" (What can I do today?)
→ isVague: true
→ dueDate: null (don't use exact date)
→ dueDateRange: { operator: "<=", date: "today" } (NEW!)
→ aiUnderstanding.timeContext: "today" (for AI context)
→ Strategy: Return tasks needing attention today (due + overdue)
```

**Prompt change:**
```typescript
**How to handle time in vague queries:**
- Recognize time words: today, tomorrow, this week (今天, 明天, 本周, idag, imorgon)
- **Set dueDateRange to include everything up to that time** (NEW!)
- **Record in aiUnderstanding.timeContext** for AI prioritization
- Don't set exact dueDate (use range instead)

**EXAMPLES:**

Query: "今天可以做什么？" (What can I do today?)
→ isVague: true
→ dueDate: null
→ dueDateRange: { "operator": "<=", "date": "today" }  (NEW!)
→ aiUnderstanding.timeContext: "today"
→ Strategy: Return tasks due today + overdue

Query: "What should I do this week?"
→ isVague: true
→ dueDate: null
→ dueDateRange: { "operator": "<=", "date": "end-of-week" }
→ aiUnderstanding.timeContext: "this week"
```

---

### **Step 2: Update ParsedQuery Interface**

**File:** `aiQueryParserService.ts` lines 20-45

**Add dueDateRange support:**
```typescript
export interface ParsedQuery {
    coreKeywords?: string[];
    keywords?: string[];
    priority?: number | null;
    dueDate?: string | null;
    dueDateRange?: {  // NEW!
        operator: "<" | "<=" | ">" | ">=" | "=";
        date: string; // "today", "tomorrow", "2025-01-23", etc.
    } | null;
    status?: string | null;
    folder?: string | null;
    tags?: string[];
    isVague?: boolean;
    aiUnderstanding?: {
        // ... existing fields
        timeContext?: string; // Keep for AI context
    };
}
```

---

### **Step 3: Support Date Range in DataView Filtering**

**File:** `dataviewService.ts`

**Add range filtering:**
```typescript
// Current: Only supports exact date
if (filters.dueDate) {
    dvQuery += ` WHERE dueDate = "${filters.dueDate}"`;
}

// New: Support range
if (filters.dueDateRange) {
    const { operator, date } = filters.dueDateRange;
    
    // Convert relative dates to actual dates
    let actualDate: string;
    if (date === "today") {
        actualDate = moment().format("YYYY-MM-DD");
    } else if (date === "tomorrow") {
        actualDate = moment().add(1, 'day').format("YYYY-MM-DD");
    } else if (date === "end-of-week") {
        actualDate = moment().endOf('week').format("YYYY-MM-DD");
    } else {
        actualDate = date; // Already a date string
    }
    
    // Apply range filter
    if (operator === "<=") {
        dvQuery += ` WHERE (!dueDate OR dueDate <= "${actualDate}")`;
        // !dueDate included to catch tasks without dates (might be urgent)
    } else if (operator === ">=") {
        dvQuery += ` WHERE dueDate >= "${actualDate}"`;
    }
    // ... other operators
}
```

---

### **Step 4: Update Intent Extraction**

**File:** `aiService.ts` lines 221-241

**Add dueDateRange to intent:**
```typescript
intent = {
    isSearch: keywords.length > 0,
    isPriority: !!parsedQuery.priority,
    isDueDate: !!parsedQuery.dueDate,
    keywords: keywords,
    extractedPriority: parsedQuery.priority || null,
    extractedDueDateFilter: parsedQuery.dueDate || null,
    extractedDueDateRange: parsedQuery.dueDateRange || null,  // NEW!
    extractedStatus: parsedQuery.status || null,
    extractedFolder: parsedQuery.folder || null,
    extractedTags: parsedQuery.tags || [],
    isVague: parsedQuery.isVague || false,
    // ...
};
```

---

### **Step 5: Pass Range to DataView**

**File:** `aiService.ts` lines 312-320

**Add dueDateRange parameter:**
```typescript
tasksAfterPropertyFilter = await DataviewService.parseTasksFromDataview(
    app,
    settings,
    undefined, // No legacy date filter
    {
        priority: intent.extractedPriority,
        dueDate: intent.extractedDueDateFilter,
        dueDateRange: intent.extractedDueDateRange,  // NEW!
        status: intent.extractedStatus,
    },
);
```

---

## **Testing Scenarios**

### **Test 1: Pure Vague Query with Today**

**Query:** "今天可以做什么？"

**Expected Flow:**
```
1. AI Parser:
   - isVague: true
   - dueDateRange: { operator: "<=", date: "today" }
   - timeContext: "today"

2. DataView Filter:
   - WHERE (!dueDate OR dueDate <= "2025-01-23")
   - Returns: All overdue + today's tasks

3. Result:
   - Tasks without dates (urgent)
   - Tasks overdue (need attention!)
   - Tasks due today
```

**Example Output:**
```
Found 15 tasks needing attention today:

Overdue (need to handle today):
1. Fix authentication bug (overdue 3 days)
2. Deploy API to production (overdue 1 day)
3. Review PR #123 (overdue 2 days)

Due Today:
4. Write documentation
5. Update dependencies
...
```

---

### **Test 2: Vague Query with This Week**

**Query:** "What should I work on this week?"

**Expected:**
```
1. AI Parser:
   - isVague: true
   - dueDateRange: { operator: "<=", date: "end-of-week" }
   - timeContext: "this week"

2. DataView Filter:
   - WHERE (!dueDate OR dueDate <= "2025-01-26")
   - Returns: All overdue + this week's tasks

3. Result: ~30 tasks for the week
```

---

### **Test 3: Specific Query (Should Not Change)**

**Query:** "Fix authentication bug due today"

**Expected:**
```
1. AI Parser:
   - isVague: false
   - dueDate: "today" (exact filter)
   - dueDateRange: null

2. DataView Filter:
   - WHERE dueDate = "2025-01-23"
   - Returns: Only tasks due today

3. Result: Normal specific query behavior
```

---

## **Benefits**

### **Before:**

**Query:** "今天可以做什么？"
- Result: 2 tasks due today
- Missed: 10 overdue tasks needing attention!

### **After:**

**Query:** "今天可以做什么？"
- Result: 12 tasks (2 due today + 10 overdue)
- User sees everything needing attention today ✅

---

## **Implementation Checklist**

- [ ] Update AI prompt with dueDateRange logic
- [ ] Add dueDateRange to ParsedQuery interface
- [ ] Implement date range filtering in DataviewService
- [ ] Update intent extraction to include dueDateRange
- [ ] Pass dueDateRange to DataView API
- [ ] Test with various time contexts (today, tomorrow, this week)
- [ ] Update documentation

**Estimated Effort:** 2-3 hours  
**Impact:** HIGH - Makes vague queries much more useful  
**Priority:** HIGH - User's main concern

---

## **Summary**

User's insight was **perfect**:
- "Today" in vague queries should mean "what needs attention today"
- This includes overdue tasks (need to be handled/reassigned)
- Not just tasks with exact dueDate="today"

**Implementation approach:**
- Convert time context to date range
- Use `dueDateRange: { operator: "<=", date: "today" }`
- Includes all overdue + today's tasks
- Generalizes to other time contexts (tomorrow, this week, etc.)

**Status:** Ready for implementation after Priority 1 fix is verified.
