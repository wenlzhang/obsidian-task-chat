# Smart Positional Property Trigger Filtering
**Date:** 2025-01-22  
**Enhancement:** Centralized + Positional filtering for property trigger words

---

## 🎯 **Improvements**

### **1. Centralized Property Trigger Words**

**Before:** Hardcoded list in `taskSearchService.ts`
```typescript
const propertyTriggerWords = new Set([
    "due", "deadline", "scheduled", "overdue", ...
    // 50+ hardcoded words
]);
```

**After:** Centralized in `TaskPropertyService`
```typescript
// Single source of truth - automatically includes:
// - Base terms (English, Chinese, Swedish)
// - User-configured custom terms
// - All status categories
const propertyTriggerWords = 
    TaskPropertyService.getAllPropertyTriggerWords(settings);
```

### **2. Smart Positional Filtering**

**Before:** Removed ALL property trigger words from keywords
```typescript
// "task due chat" → ["task", "chat"]  ❌ Too aggressive!
```

**After:** Only removes if at BEGINNING or END
```typescript
// "task chat due" → ["task", "chat"]  ✅ (removed from end)
// "due task chat" → ["task", "chat"]  ✅ (removed from beginning)
// "task due chat" → ["task", "due", "chat"]  ✅ (kept in middle)
```

---

## 💡 **Rationale**

### **User Query Patterns**

Users typically type queries in two patterns:
1. **Keywords first, properties last:** `"task chat due"`, `"bug fix urgent"`
2. **Properties first, keywords last:** `"urgent bug fix"`, `"today meeting prep"`

Property trigger words **rarely appear in the middle** of keywords because:
- They're modifiers, not content descriptors
- Users think in terms of "what + when/how" or "when/how + what"
- Natural language structure places modifiers at edges

### **Why Positional Filtering?**

**Problem with aggressive removal:**
```
Query: "task due chat"
If "due" is a legitimate keyword (e.g., "payment due"), removing it loses meaning
```

**Solution with positional filtering:**
```
Query: "task due chat"
"due" is in the MIDDLE → Keep it (might be content-related)

Query: "task chat due"
"due" is at the END → Remove it (likely a property filter)
```

---

## 🔧 **Implementation**

### **File:** `src/services/taskPropertyService.ts`

#### **New Method: `getAllPropertyTriggerWords()`**

```typescript
/**
 * Get all property trigger words that should be removed from keywords
 * These words activate filters and should NOT be used for relevance scoring
 * 
 * Includes:
 * - Due date terms (general, today, tomorrow, overdue, week, future)
 * - Priority terms (general, high, medium, low)
 * - Status terms (general + all categories)
 * - User-configured custom terms
 * 
 * @param settings - Plugin settings with user-configured terms
 * @returns Set of all property trigger words (lowercase)
 */
static getAllPropertyTriggerWords(settings: PluginSettings): Set<string> {
    const triggerWords = new Set<string>();

    // Get combined terms (base + user-configured)
    const dueDateTerms = this.getCombinedDueDateTerms(settings);
    const priorityTerms = this.getCombinedPriorityTerms(settings);
    const statusTerms = this.getCombinedStatusTerms(settings);

    // Add all due date terms
    Object.values(dueDateTerms).forEach((terms) => {
        terms.forEach((term) => triggerWords.add(term.toLowerCase()));
    });

    // Add all priority terms
    Object.values(priorityTerms).forEach((terms) => {
        terms.forEach((term) => triggerWords.add(term.toLowerCase()));
    });

    // Add all status terms (including custom categories)
    Object.values(statusTerms).forEach((terms) => {
        terms.forEach((term) => triggerWords.add(term.toLowerCase()));
    });

    return triggerWords;
}
```

**Benefits:**
- ✅ Single source of truth
- ✅ Automatically includes user-configured terms
- ✅ Includes all status categories (even custom ones)
- ✅ Multilingual support (English, Chinese, Swedish)
- ✅ Easy to maintain and extend

---

### **File:** `src/services/taskSearchService.ts`

#### **New Method: `removePropertyTriggerWords()`**

```typescript
/**
 * Remove property trigger words from keywords using smart positional filtering
 * 
 * STRATEGY: Only remove property trigger words if they appear at the BEGINNING or END
 * of the query, as users typically type: "keywords + properties" or "properties + keywords"
 * 
 * Examples:
 * - "task chat due" → remove "due" (at end) → ["task", "chat"]
 * - "due task chat" → remove "due" (at beginning) → ["task", "chat"]
 * - "task due chat" → keep "due" (in middle) → ["task", "due", "chat"]
 * 
 * This prevents over-aggressive removal while handling common query patterns.
 * 
 * @param keywords - Keywords extracted from query (after stop word filtering)
 * @param settings - Plugin settings with user-configured property terms
 * @returns Keywords with property trigger words removed (if at beginning/end)
 */
private static removePropertyTriggerWords(
    keywords: string[],
    settings: PluginSettings,
): string[] {
    if (keywords.length === 0) return keywords;

    // Get all property trigger words from centralized source
    const propertyTriggerWords =
        TaskPropertyService.getAllPropertyTriggerWords(settings);

    const result = [...keywords];
    let removed: string[] = [];

    // Check and remove from beginning
    while (
        result.length > 0 &&
        propertyTriggerWords.has(result[0].toLowerCase())
    ) {
        removed.push(result[0]);
        result.shift();
    }

    // Check and remove from end
    while (
        result.length > 0 &&
        propertyTriggerWords.has(result[result.length - 1].toLowerCase())
    ) {
        removed.push(result[result.length - 1]);
        result.pop();
    }

    // Log removal if any words were removed
    if (removed.length > 0) {
        console.log(
            `[Task Chat] Removed property trigger words (positional): [${removed.join(", ")}]`,
        );
        console.log(
            `[Task Chat] Keywords after property trigger removal: ${keywords.length} → ${result.length}`,
        );
    }

    return result;
}
```

#### **Updated: `analyzeQueryIntent()`**

```typescript
let keywords = this.extractKeywords(query);

// Apply smart positional filtering to remove property trigger words
// Only removes if at beginning or end (e.g., "task chat due" → ["task", "chat"])
keywords = this.removePropertyTriggerWords(keywords, settings);
```

---

## 📊 **Test Cases**

### **Test 1: Property at End (Most Common)**
```
Query: "task chat due"
Keywords before: ["task", "chat", "due"]
Keywords after: ["task", "chat"]  ✅ (removed "due" from end)
Filter: dueDate = "any"
```

### **Test 2: Property at Beginning**
```
Query: "urgent task chat"
Keywords before: ["urgent", "task", "chat"]
Keywords after: ["task", "chat"]  ✅ (removed "urgent" from beginning)
Filter: priority = 1
```

### **Test 3: Property in Middle (Keep It!)**
```
Query: "task due chat"
Keywords before: ["task", "due", "chat"]
Keywords after: ["task", "due", "chat"]  ✅ (kept "due" in middle)
Filter: dueDate = "any"
Note: "due" might be part of content (e.g., "payment due")
```

### **Test 4: Multiple Properties at Edges**
```
Query: "urgent task chat today"
Keywords before: ["urgent", "task", "chat", "today"]
Keywords after: ["task", "chat"]  ✅ (removed "urgent" from start, "today" from end)
Filters: priority = 1, dueDate = "today"
```

### **Test 5: Only Properties (Edge Case)**
```
Query: "urgent today"
Keywords before: ["urgent", "today"]
Keywords after: []  ✅ (removed all - no content keywords)
Filters: priority = 1, dueDate = "today"
```

### **Test 6: User-Configured Terms**
```
User configured: "asap" → priority 1
Query: "task chat asap"
Keywords before: ["task", "chat", "asap"]
Keywords after: ["task", "chat"]  ✅ (removed user's custom term)
Filter: priority = 1
```

### **Test 7: CJK Languages**
```
Query: "任务 聊天 紧急"
Keywords before: ["任务", "聊天", "紧急"]
Keywords after: ["任务", "聊天"]  ✅ (removed "紧急" from end)
Filter: priority = 1
```

---

## 🎯 **Benefits**

### **1. Centralization**
- ✅ Single source of truth in `TaskPropertyService`
- ✅ Automatically includes user-configured terms
- ✅ Easier to maintain and extend
- ✅ No duplication across modules

### **2. Smart Filtering**
- ✅ Handles common query patterns ("keywords + properties")
- ✅ Prevents over-aggressive removal
- ✅ Preserves legitimate content keywords in middle
- ✅ Works with all languages (English, Chinese, Swedish)

### **3. User Experience**
- ✅ More accurate results
- ✅ Consistent behavior across all modes
- ✅ Respects user's custom property terms
- ✅ Natural query patterns work intuitively

---

## 📈 **Impact**

### **Before:**
```
Query: "task chat due"
Keywords: ["task", "chat", "due"]  ❌ (includes property trigger)
Result: Tasks with "task", "chat", "due" in text AND due date property
Problem: Double-counting "due"
```

### **After:**
```
Query: "task chat due"
Keywords: ["task", "chat"]  ✅ (removed property trigger from end)
Result: Tasks with "task", "chat" in text AND due date property
Benefit: Clean separation between keywords and filters
```

### **Edge Case Handling:**
```
Query: "task due chat"
Keywords: ["task", "due", "chat"]  ✅ (kept "due" in middle)
Result: Tasks with "task", "due", "chat" in text AND due date property
Benefit: Preserves legitimate content keywords
```

---

## 🔗 **Related Enhancements**

1. **CJK-Aware Deduplication:** See `CJK_AWARE_DEDUPLICATION_2025-01-22.md`
2. **Property Trigger Word Fix:** See `PROPERTY_TRIGGER_WORD_FIX_2025-01-22.md`
3. **Relevance Scoring Bug:** See `RELEVANCE_SCORING_BUG_FIX_2025-01-22.md`

---

## 📝 **Summary**

### **What Changed:**
1. **Centralized** property trigger words in `TaskPropertyService.getAllPropertyTriggerWords()`
2. **Implemented** smart positional filtering (only remove from beginning/end)
3. **Applied** filtering in `analyzeQueryIntent()` after keyword extraction

### **Why It Matters:**
- **Consistency:** Single source of truth for property trigger words
- **Accuracy:** Smarter filtering based on user query patterns
- **Flexibility:** Automatically includes user-configured terms
- **Maintainability:** Easier to extend and modify

### **Result:**
- ✅ More accurate keyword matching
- ✅ Better handling of edge cases
- ✅ Consistent behavior across all modes
- ✅ Respects natural language query patterns

**Build:** ✅ 289.3kb  
**Tests:** Ready for user testing  
**Documentation:** Complete  

Thank you for the excellent suggestions! This is a much cleaner and smarter approach. 🙏
