# Complete Workflow - Verified & Updated
## All Three Modes - January 23, 2025

## **User's Corrected Workflow** ✅

```
Step 1: Determine isVague
├─ Auto mode: AI decides
├─ Generic mode: Force true
└─ Specific mode: Force false

Step 2: UNIFIED Extraction (SAME for all!)
├─ Extract dueDate (if time words present) ✅
├─ Extract timeContext (for metadata)
├─ Extract priority
├─ Extract status
└─ Extract keywords

Step 2.1: AI Expansion (Smart/Chat only)
├─ AI extracts coreKeywords
└─ AI expands to semantic equivalents

Step 3: External Processing
├─ Filter stop words (safety net)
├─ Remove property trigger words
└─ If isVague AND dueDate:
    ├─ Convert dueDate to dueDateRange ("<= today")
    └─ Clear dueDate (using range now)
    
Step 4: DataView API
├─ If has filters → Filter tasks
└─ If no filters → Return ALL tasks

Step 5: Score & Sort
└─ Multi-criteria with user coefficients
```

---

## **Complete Data Flow**

### **Smart Search & Task Chat Mode (AI-Based)**

```
User Query: "What should I do today?"
      ↓
┌─────────────────────────────────────┐
│ Step 1: Determine isVague           │
│ - Mode: Auto                        │
│ - AI analyzes: "What should I do"  │
│ Result: isVague = true              │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 2: UNIFIED Extraction (AI)     │
│ - coreKeywords: [] (all stop words) │
│ - dueDate: "today" ✅               │
│ - timeContext: "today" (metadata)   │
│ - priority: null                    │
│ - status: null                      │
│ - isVague: true                     │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 2.1: AI Expansion              │
│ - Expands coreKeywords (if any)     │
│ - Filters stop words                │
│ Result: keywords: []                │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 3: External Processing         │
│ - Filter stop words (safety net)    │
│ - Remove property triggers          │
│ - Check: isVague && dueDate? ✅     │
│   → Convert "today" to:             │
│     dueDateRange: {                 │
│       operator: "<=",               │
│       date: "today"                 │
│     }                               │
│   → Clear dueDate (undefined)       │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 4: Filter Check                │
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
│ - Smart: Direct display             │
│ - Chat: Send to AI for analysis     │
└─────────────────────────────────────┘
```

---

### **Simple Search Mode (Regex-Based)**

```
User Query: "today tasks"
      ↓
┌─────────────────────────────────────┐
│ Step 1: Determine isVague           │
│ - Mode: Auto                        │
│ - Analyze: 50% generic words        │
│ Result: isVague = false             │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 2: Extraction (Regex)          │
│ - Regex extracts: dueDate="today" ✅│
│ - Split words: ["today", "tasks"]   │
│ - Remove stop words: ["tasks"]      │
│ - Remove property triggers: []      │
│ Result: keywords=[], dueDate="today"│
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 3: External Processing         │
│ - Check: isVague && dueDate? ❌     │
│   (Not vague, no conversion)        │
│ Result: dueDate stays "today" ✅    │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 4: DataView API                │
│ - Query: dueDate = "today" (exact)  │
│ - Returns: 15 tasks due today       │
│   (NO overdue tasks)                │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│ Step 5: Score & Sort                │
│ - Sorted by user settings           │
│ - Returns: Top N results            │
└─────────────────────────────────────┘
```

---

## **Key Scenarios**

### **Scenario 1: Pure Vague Query**

**Query:** "What should I work on?"

**Flow:**
```
AI Extraction:
├─ isVague: true
├─ keywords: [] (all stop words)
├─ dueDate: null (no time words)
├─ priority: null
└─ status: null

External:
└─ No conversion (no dueDate)

Filter Check:
└─ hasFilters: false (no properties, no keywords)

DataView:
└─ Returns: ALL tasks ✅

Score & Sort:
├─ Score by: dueDate + priority + status (NO relevance)
├─ Sort by: User settings
└─ Returns: Top N tasks by urgency ✅
```

### **Scenario 2: Vague + Time**

**Query:** "What should I do today?"

**Flow:**
```
AI Extraction:
├─ isVague: true
├─ keywords: []
├─ dueDate: "today" ✅
└─ timeContext: "today"

External:
├─ isVague && dueDate → Convert! ✅
└─ dueDateRange: { operator: "<=", date: "today" }

DataView:
└─ Returns: Today + overdue tasks ✅

Result: Urgent tasks for today
```

### **Scenario 3: Specific + Time**

**Query:** "Tasks due today"

**Flow:**
```
AI Extraction:
├─ isVague: false ✅
├─ keywords: []
├─ dueDate: "today" ✅
└─ timeContext: "today"

External:
├─ !isVague → No conversion ✅
└─ dueDate stays: "today"

DataView:
└─ Returns: Only tasks due today (NO overdue) ✅

Result: Exact matches
```

### **Scenario 4: Vague + Keywords + Time**

**Query:** "今天 API 项目应该做什么？"

**Flow:**
```
AI Extraction:
├─ isVague: true
├─ coreKeywords: ["API", "项目"]
├─ keywords: ["API", "项目", "project", ...] (expanded)
├─ dueDate: "today" ✅
└─ timeContext: "today"

External:
├─ Filter stop words
├─ Remove property triggers
└─ isVague && dueDate → Convert! ✅
    dueDateRange: { operator: "<=", date: "today" }

DataView:
└─ Filter by: dueDateRange <= today

Keyword Filter (JavaScript):
└─ Match: "API" OR "项目" OR "project"

Result: API project tasks due today/overdue ✅
```

---

## **Mode Comparison**

| Mode | Extraction | Expansion | Stop Word Filter | Conversion |
|------|------------|-----------|------------------|------------|
| **Simple Search** | Regex ✅ | No | Yes ✅ | If vague ✅ |
| **Smart Search** | AI ✅ | Yes ✅ | Yes ✅ | If vague ✅ |
| **Task Chat** | AI ✅ | Yes ✅ | Yes ✅ | If vague ✅ |

**All use same external conversion!** ✅

---

## **What Gets Extracted**

### **Always Extracted (If Present):**

1. **dueDate** ✅
   - AI: Semantic detection ("today", "tomorrow", "this week")
   - Regex: Pattern matching (`d:today`, `due:today`)
   - Result: `dueDate: "today"`

2. **priority** ✅
   - AI: Natural language ("urgent", "high priority")
   - Regex: Pattern matching (`p:1`, `priority:1`)
   - Result: `priority: 1`

3. **status** ✅
   - AI: Natural language ("working on", "completed")
   - Regex: Pattern matching (`s:open`, `status:open`)
   - Result: `status: "open"`

4. **keywords** ✅
   - AI: Extracted + expanded semantically
   - Regex: Split words + filter stop words
   - Result: `keywords: ["fix", "bug", ...]`

### **Only for Metadata:**

5. **timeContext** (AI only)
   - Same as dueDate, for logging/debugging
   - Not used for filtering directly

---

## **Conversion Rules**

### **When Conversion Happens:**

```typescript
if (isVague && dueDate) {
    // Convert exact date to range
    dueDateRange = TimeContextService.detectAndConvertTimeContext(...);
    dueDate = null; // Clear (using range now)
}
```

### **Conversion Table:**

| dueDate Input | isVague | Result | Includes |
|---------------|---------|--------|----------|
| `"today"` | true | `{ operator: "<=", date: "today" }` | Today + overdue ✅ |
| `"today"` | false | `"today"` (no change) | Only today ✅ |
| `"this week"` | true | `{ operator: "<=", date: "end-of-week" }` | This week + overdue ✅ |
| `"this week"` | false | `"this week"` (no change) | Only this week ✅ |
| `null` | true | `null` | No filter ✅ |
| `null` | false | `null` | No filter ✅ |

---

## **DataView API Usage**

### **With Properties:**

```typescript
// Properties present → Use DataView API
tasksAfterPropertyFilter = await DataviewService.parseTasksFromDataview(
    app, settings, undefined,
    {
        priority: 1,
        dueDateRange: { operator: "<=", date: "today" }  // Converted!
    }
);

// Then filter by keywords in JavaScript
filteredTasks = TaskSearchService.applyCompoundFilters(
    tasksAfterPropertyFilter,
    { keywords, folder, tags }
);
```

### **No Properties:**

```typescript
// No properties → Get all tasks
filteredTasks = tasks;  // All from DataView

// Score and sort by user settings
sortedTasks = TaskSortService.sortTasksMultiCriteria(
    filteredTasks,
    sortOrder,      // User's sort order
    settings,       // User's coefficients
    undefined       // No keyword relevance
);
```

---

## **Missing Parts? None!** ✅

### **You Asked:**
> "I'm uncertain if you missed anything in the entire workflow"

**Verified:** Nothing missing! ✅

**Complete workflow includes:**
1. ✅ isVague determination (auto/forced)
2. ✅ Unified extraction (dueDate + all properties)
3. ✅ AI expansion (Smart/Chat only)
4. ✅ Stop word filtering (all modes)
5. ✅ Property trigger removal (all modes)
6. ✅ **External dueDate→dueDateRange conversion (for vague only)**
7. ✅ DataView API filtering
8. ✅ JavaScript keyword filtering
9. ✅ Multi-criteria scoring
10. ✅ User coefficient application
11. ✅ Multi-criteria sorting
12. ✅ Result delivery

---

## **Summary**

### **User's Solution Benefits:**

1. ✅ **Simpler** - AI extracts dueDate normally
2. ✅ **Safer** - No breaking changes
3. ✅ **Consistent** - All modes use same approach
4. ✅ **Targeted** - Only converts for vague queries
5. ✅ **Reuses existing** - Leverages dueDate extraction

### **Implementation:**

- **AI Prompt:** Extract dueDate normally (as before)
- **External Code:** Convert to range if vague only
- **All Modes:** Same conversion logic

### **Result:**

**Minimal change, maximum benefit!** 🎉

**Thank you for the excellent architectural guidance!** Your simpler approach is much better than my over-complicated one. 🙏
