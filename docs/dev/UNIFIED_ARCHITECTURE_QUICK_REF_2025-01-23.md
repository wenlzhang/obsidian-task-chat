# Unified Architecture - Quick Reference
## January 23, 2025

## **The Big Picture**

```
┌─────────────────────────────────────────────────────────┐
│                  USER QUERY                             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              DETERMINE isVague FLAG                      │
│  Auto: AI decides  │  Generic: true  │  Specific: false │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│           UNIFIED EXTRACTION (ALWAYS SAME)              │
│  • Extract timeContext (just the term)                  │
│  • Extract priority                                     │
│  • Extract status                                       │
│  • Extract keywords                                     │
│  • Filter stop words                                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│       EXTERNAL PROCESSING (CONDITIONAL)                  │
│  If timeContext:                                        │
│    • isVague? → dueDateRange ("<= today")              │
│    • !isVague? → exact dueDate ("today")               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│               DATAVIEW API FILTERING                     │
│  If has filters → Filter by properties                  │
│  If no filters → Return ALL tasks                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│          SCORE & SORT (USER COEFFICIENTS)               │
│  • Multi-criteria scoring                               │
│  • User-defined weights                                 │
│  • User-defined sort order                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  RETURN RESULTS                          │
└─────────────────────────────────────────────────────────┘
```

---

## **Key Principles**

### **1. Unified Extraction**
- AI **ALWAYS** extracts the same way
- No different logic for vague vs specific
- `isVague` is just a **flag**, not a mode

### **2. External Conversion**
- AI detects time term: "today"
- Fixed code converts:
  - Vague → `dueDateRange: { operator: "<=", date: "today" }`
  - Specific → `dueDate: "today"`
- Deterministic, reliable

### **3. Keyword Extraction**

**Simple Search:**
```
Split words → Filter stop words → Remove property triggers
```

**Smart/Chat:**
```
AI extracts → AI expands → Filter stop words → Remove property triggers
```

**Both use same `StopWords` service!**

### **4. No Filters Case**
```
Query: "What should I work on?"
→ No keywords, no properties
→ DataView returns: ALL tasks
→ Score by: User coefficients (dueDate, priority, status)
→ Sort by: User settings
→ Result: Top N tasks by urgency
```

**You were RIGHT!** ✅

---

## **Query Type Examples**

### **Pure Vague (No Properties)**
```
Query: "What should I work on?"
├─ isVague: true
├─ keywords: []
├─ timeContext: null
├─ priority: null
└─ status: null

Result: ALL tasks, sorted by user coefficients
```

### **Vague + Time Context**
```
Query: "What should I do today?"
├─ isVague: true
├─ keywords: []
├─ timeContext: "today"
└─ External: dueDateRange = { operator: "<=", date: "today" }

Result: Tasks due today + overdue, sorted by urgency
```

### **Vague + Priority**
```
Query: "What high priority tasks should I work on?"
├─ isVague: true
├─ keywords: []
├─ priority: 1
└─ External: No date conversion

Result: P1 tasks, sorted by dueDate
```

### **Vague + Keywords + Time**
```
Query: "今天 API 项目应该做什么？"
├─ isVague: true
├─ keywords: ["API", "项目", "project", ...]
├─ timeContext: "today"
└─ External: dueDateRange = { operator: "<=", date: "today" }

Result: API project tasks due today/overdue
```

### **Specific + Time**
```
Query: "Tasks due today"
├─ isVague: false
├─ keywords: []
├─ timeContext: "today"
└─ External: dueDate = "today" (EXACT)

Result: Tasks due exactly today (NO overdue)
```

---

## **DataView API Usage**

### **With Properties:**
```typescript
// Step 1: DataView filters by properties
tasksAfterPropertyFilter = await DataviewService.parseTasksFromDataview(
    app, settings, undefined, {
        priority: 1,
        dueDateRange: { operator: "<=", date: "today" }
    }
);

// Step 2: JavaScript filters by folder, tags, keywords
filteredTasks = TaskSearchService.applyCompoundFilters(
    tasksAfterPropertyFilter,
    { folder, tags, keywords }
);
```

### **No Properties:**
```typescript
// All tasks already loaded
filteredTasks = tasks;  // ALL tasks from DataView

// Score and sort by user settings
sortedTasks = TaskSortService.sortTasksMultiCriteria(
    filteredTasks,
    sortOrder,      // User's sort order
    settings,       // User's coefficients
    undefined       // No keyword relevance
);
```

---

## **What's Different?**

| Aspect | Before | After |
|--------|--------|-------|
| **AI sets dueDate** | Sometimes ❌ | Never (always null) ✅ |
| **AI sets timeContext** | Sometimes ❌ | Always (if time word) ✅ |
| **External conversion** | Only vague ❌ | Both vague & specific ✅ |
| **Extraction logic** | Different ❌ | Unified ✅ |
| **isVague role** | Changes extraction ❌ | Just a flag ✅ |

---

## **Code Locations**

### **Extraction:**
- **AI Prompt:** `aiQueryParserService.ts` lines 1010-1075
- **External Conversion:** `aiService.ts` lines 233-265

### **Filtering:**
- **Filter Check:** `aiService.ts` lines 287-294
- **DataView API:** `dataviewService.ts`
- **Keyword Filter:** `taskSearchService.ts`

### **Scoring & Sorting:**
- **Scoring:** `taskSearchService.ts` - `scoreTasksComprehensive()`
- **Sorting:** `taskSortService.ts` - `sortTasksMultiCriteria()`

---

## **Testing Checklist**

### **Vague Queries:**
- [ ] "What should I work on?" → All tasks by urgency
- [ ] "What should I do today?" → Today + overdue tasks
- [ ] "What high priority tasks?" → P1 tasks sorted
- [ ] "今天 API 项目应该做什么？" → API tasks today/overdue

### **Specific Queries:**
- [ ] "Tasks due today" → Only today (no overdue)
- [ ] "Priority 1 tasks" → P1 tasks
- [ ] "Fix authentication bug" → Keyword matches

### **Edge Cases:**
- [ ] Empty keywords after filtering → Still works
- [ ] No time context → Still works
- [ ] No properties → All tasks returned
- [ ] Mixed language → Detects time term correctly

---

## **Key Takeaways**

1. ✅ **Same extraction always** - Unified, consistent
2. ✅ **isVague is a flag** - Not a mode
3. ✅ **External conversion** - Deterministic, reliable
4. ✅ **DataView handles all** - With or without filters
5. ✅ **User coefficients rule** - Scoring respects settings

**Your vision is now reality!** 🎉
