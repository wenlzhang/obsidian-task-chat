# Word Categorization and Processing Workflow - January 23, 2025

## Problem: Word Overlap and Conflicts

**User's critical insight:** Words can belong to multiple categories, causing conflicts:

1. **Time words** like "today":
   - Can be stop words (common, low semantic value)
   - Can be generic words (in vague queries)
   - Can be time context (for AI prioritization)
   - Can be date filters (in specific queries)

2. **Property words** like "urgent", "priority":
   - Can be generic adjectives (in vague queries)
   - Can be property indicators (in specific queries)
   - Can be keywords for matching

3. **Action words** like "do", "make":
   - Can be stop words (common verbs)
   - Can be generic words (vague indicators)
   - Can be specific actions (in technical contexts)

**Result:** Conflicts in how we process, categorize, and filter words!

---

## Solution: Clear Word Categories with Priority

### Word Category Hierarchy

```
WORD PROCESSING CATEGORIES (in priority order):

1. PROPERTY INDICATORS (highest priority)
   - Purpose: Extract structured filters
   - Examples: "priority", "urgent", "due", "deadline", "status"
   - Action: Extract as property, REMOVE from keyword pool
   - Applied: FIRST (before any other processing)

2. TIME REFERENCES (second priority)
   - Purpose: Distinguish context from filters
   - Examples: "today", "tomorrow", "this week", "今天", "明天"
   - Action: 
     * If vague query → timeContext (not filter)
     * If specific query → dueDate (filter)
   - Applied: SECOND (after properties extracted)

3. GENERIC/VAGUE INDICATORS (detection only)
   - Purpose: Detect vague vs specific queries
   - Examples: "what", "how", "do", "should", "task", "什么", "做"
   - Action: Used for DETECTION, not removed initially
   - Applied: BEFORE stop word removal

4. STOP WORDS (filter for matching)
   - Purpose: Remove low-value words from matching
   - Examples: "the", "a", "is", "to", "of", "的"
   - Action: Remove AFTER detection, keep for vague detection
   - Applied: LAST (after detection complete)

5. CONTENT KEYWORDS (what remains)
   - Purpose: Actual task matching and semantic expansion
   - Examples: "fix", "deploy", "authentication", "bug"
   - Action: Expand semantically, use for filtering
   - Applied: After all above processing
```

---

## Correct Processing Workflow

### Phase 1: Property Extraction (AI does this)

```typescript
Query: "urgent tasks due today #work"

AI extracts:
- Properties: priority=1 (from "urgent"), dueDate="today" (explicit due), tags=["work"]
- Remaining text: "tasks"
- isVague: false (has explicit "due" → not vague)
```

**Key:** Property words are **consumed** - removed from keyword pool after extraction.

---

### Phase 2: Vague Detection (BEFORE stop word removal)

```typescript
// Use RAW keywords (including stop words and generic words)
const rawCoreKeywords = ["tasks"]; // After property extraction
const isVague = detectVague(rawCoreKeywords); // Check if generic

// Example 1: Vague
Query: "What should I do today?"
Raw after properties: ["what", "should", "do", "today"]
→ 75% generic → isVague: true
→ timeContext: "today" (not dueDate!)

// Example 2: Specific
Query: "Deploy API today"
Raw after properties: ["deploy", "API", "today"]
→ 33% generic → isVague: false
→ dueDate: "today" (specific with explicit action)
```

**Key:** Generic words (even if stop words) must be present for detection!

---

### Phase 3: Time Context vs Filter Distinction

```typescript
if (isVague && hasTimeWord) {
    // Time word is CONTEXT, not filter
    timeContext = extractTimeWord(keywords);
    // Don't set dueDate!
} else if (!isVague && hasTimeWord) {
    // Time word is FILTER (or was already extracted as dueDate in Phase 1)
    // Use as is
}
```

**Examples:**

| Query | isVague | Time Word | Handling |
|-------|---------|-----------|----------|
| "今天可以做什么？" | true | 今天 | timeContext: "today", dueDate: null |
| "完成今天到期的任务" | false | 今天到期 | dueDate: "today" (explicit "due") |
| "Deploy API today" | false | today | dueDate: "today" (specific action) |
| "What should I do?" | true | none | No time handling |

---

### Phase 4: Stop Word Removal (for matching only)

```typescript
// TWO separate keyword sets:

// 1. RAW keywords - used for detection (already done)
const rawKeywords = ["what", "should", "do", "today"];

// 2. FILTERED keywords - used for task matching
const filteredKeywords = removeStopWords(rawKeywords);
// Result: ["today"] (or empty if "today" is stop word)

// Use filtered keywords for:
// - Task filtering (keyword matching)
// - Semantic expansion
// - Relevance scoring
```

**Key:** Stop words removed AFTER detection, so vague indicators aren't lost!

---

### Phase 5: Content Keyword Processing

```typescript
// Expand and use filtered keywords
const expandedKeywords = semanticExpansion(filteredKeywords);

// Use for task matching (if not vague query)
if (!isVague || !hasProperties) {
    tasks = filterByKeywords(tasks, expandedKeywords);
}
```

---

## Word Category Reference

### Category 1: Property Indicators

**Priority:** Extract FIRST, remove from keyword pool

**Words:**
```typescript
// Priority indicators
"priority", "urgent", "critical", "important", "asap"
"优先", "紧急", "重要", "关键"
"prioritet", "brådskande" (Swedish)
"priorität", "dringend" (German)

// Status indicators
"open", "completed", "done", "progress", "working", "blocked"
"打开", "完成", "进行中", "阻塞"
"öppen", "färdig", "pågående" (Swedish)

// Due date indicators  
"due", "deadline", "overdue", "expire", "until"
"到期", "截止", "过期"
"förfaller", "deadline" (Swedish)
```

**Action:** AI extracts these → Sets priority/status/dueDate fields → Removes from keyword pool

---

### Category 2: Time References

**Priority:** Handle SECOND, distinguish context vs filter

**Words:**
```typescript
"today", "tomorrow", "yesterday", "tonight"
"今天", "明天", "昨天", "今晚"
"idag", "imorgon", "igår" (Swedish)
"heute", "morgen", "gestern" (German)

"week", "month", "year", "Monday", "Friday"
"周", "月", "年", "星期一", "星期五"
"vecka", "månad", "år", "måndag", "fredag" (Swedish)

"next", "last", "this", "current"
"下", "上", "本", "这个"
"nästa", "förra", "denna" (Swedish)
```

**Handling:**
```typescript
if (isVague && !explicitDuePhrasing) {
    // Context: "今天可以做什么？"
    timeContext = word;
    dueDate = null;
} else {
    // Filter: "tasks due today", "Deploy API today"
    dueDate = word;
    timeContext = null;
}
```

---

### Category 3: Generic/Vague Indicators

**Priority:** Use for DETECTION only, don't remove before detection

**Words:** (From StopWords.GENERIC_QUERY_WORDS - 200+ words)

**3A. Question Words:**
```typescript
"what", "when", "where", "which", "how", "why", "who"
"什么", "怎么", "哪里", "哪个", "为什么", "怎样", "谁"
"vad", "när", "var", "vilken", "hur", "varför", "vem"
```

**3B. Generic Verbs:**
```typescript
"do", "does", "did", "make", "work", "should", "can", "need"
"做", "可以", "能", "应该", "需要", "有"
"göra", "kan", "ska", "behöver", "har"
```

**3C. Generic Nouns:**
```typescript
"task", "tasks", "item", "thing", "work", "job"
"任务", "事情", "东西", "工作"
"uppgift", "sak", "arbete"
```

**Action:**
```typescript
vaguenessRatio = countGeneric(rawKeywords) / totalKeywords;
if (vaguenessRatio >= 0.7) {
    isVague = true;
}
```

---

### Category 4: Stop Words

**Priority:** Remove LAST, only for matching (not detection)

**Words:** (From StopWords.INTERNAL_STOP_WORDS)
```typescript
// English
"the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "for"

// Chinese
"的", "了", "我", "你", "他", "她", "它"

// Swedish
"och", "är", "en", "ett", "för", "till"

// Common across languages
"and", "or", "but", "not", "with", "from", "by"
```

**Action:**
```typescript
// ONLY for filtered keywords (matching)
filteredKeywords = StopWords.filterStopWords(rawKeywords);

// RAW keywords keep stop words (for detection)
rawKeywords = [...] // Keep all words
```

---

### Category 5: Content Keywords

**Priority:** What remains after all above processing

**Examples:**
```typescript
// Specific actions
"fix", "deploy", "implement", "test", "debug", "review", "update"
"修复", "部署", "实现", "测试", "调试", "审查"

// Specific objects
"authentication", "API", "database", "frontend", "backend"
"认证", "接口", "数据库", "前端", "后端"

// Project names
"payment system", "user login", "shopping cart"
"支付系统", "用户登录", "购物车"

// Technical terms
"function", "class", "method", "component", "module"
"函数", "类", "方法", "组件", "模块"
```

**Action:**
```typescript
// Semantic expansion
expandedKeywords = aiExpansion(contentKeywords);

// Task filtering
tasks = filterByKeywords(tasks, expandedKeywords);
```

---

## Word Overlap Resolution

### Conflict 1: "today" - Multiple Roles

**Context matters:**

```typescript
// Vague query - CONTEXT
"今天可以做什么？"
→ isVague: true
→ "今天" = timeContext (not filter)
→ Keep in detection, don't filter tasks by it

// Specific query - FILTER
"完成今天到期的任务"
→ isVague: false
→ "今天到期" = dueDate (explicit "due")
→ Filter tasks by due date

// Specific action - FILTER
"Deploy API today"
→ isVague: false
→ "today" = dueDate (with specific action)
→ Filter tasks by due date
```

**Resolution:** Check `isVague` + presence of explicit due phrasing

---

### Conflict 2: "urgent" - Property vs Keyword

**Property extraction takes priority:**

```typescript
// Property context
"urgent tasks"
→ AI extracts: priority=1
→ "urgent" consumed (removed from keywords)
→ Remaining: "tasks"

// Keyword context (rare - if AI misses)
"urgently needed"
→ Fallback: Keep as keyword
→ Semantic expansion: ["urgent", "critical", "important", ...]
```

**Resolution:** Property extraction happens FIRST

---

### Conflict 3: "do" - Stop Word vs Generic Indicator

**Both roles coexist:**

```typescript
// For detection (BEFORE removal)
rawKeywords = ["what", "should", "do"]
→ "do" IS generic → Contributes to vague detection
→ isVague: true

// For matching (AFTER removal)
filteredKeywords = ["what", "should", "do"]
→ StopWords.filterStopWords()
→ Result: [] (all are stop words)
→ No keyword matching (which is correct for vague!)
```

**Resolution:** Use raw keywords for detection, filtered for matching

---

## Complete Workflow Example

### Example 1: Pure Vague Query

```typescript
Input: "What should I do today?"

// Phase 1: Property Extraction
AI extracts:
- No properties (generic question)
- rawCoreKeywords: ["what", "should", "do", "today"]

// Phase 2: Vague Detection (RAW keywords)
vaguenessRatio = 3/4 = 0.75 (75% generic)
→ isVague: true

// Phase 3: Time Handling
hasTimeWord = "today"
isVague = true
→ timeContext: "today"
→ dueDate: null (don't filter!)

// Phase 4: Stop Word Removal (for matching)
filteredKeywords = StopWords.filter(["what", "should", "do", "today"])
→ Result: [] or ["today"]

// Phase 5: Task Filtering
isVague + no properties
→ Skip keyword matching
→ Return all tasks
→ Send to AI with timeContext

Result: ✅ All tasks shown, AI prioritizes by "today" context
```

---

### Example 2: Specific Query with Time

```typescript
Input: "Deploy API today"

// Phase 1: Property Extraction
AI extracts:
- Specific actions: ["deploy", "API"]
- Time reference: "today" (with specific action)
- dueDate: "today" (specific context)
- rawCoreKeywords: ["deploy", "API", "today"]

// Phase 2: Vague Detection
vaguenessRatio = 0/3 = 0 (0% generic)
→ isVague: false

// Phase 3: Time Handling
hasTimeWord = "today"
isVague = false
→ dueDate: "today" (already extracted)
→ timeContext: null

// Phase 4: Stop Word Removal
filteredKeywords = ["deploy", "API", "today"]
→ Result: ["deploy", "API"] (if "today" is stop word)

// Phase 5: Task Filtering
isVague = false
→ Use keyword matching
→ Filter by keywords + dueDate

Result: ✅ Tasks matching "deploy", "API" AND due today
```

---

### Example 3: Vague with Property

```typescript
Input: "What's urgent?"

// Phase 1: Property Extraction
AI extracts:
- priority: 1 (from "urgent")
- "urgent" consumed
- rawCoreKeywords: ["what"]

// Phase 2: Vague Detection
vaguenessRatio = 1/1 = 1.0 (100% generic)
→ isVague: true

// Phase 3: Time Handling
No time words
→ No time processing

// Phase 4: Stop Word Removal
filteredKeywords = StopWords.filter(["what"])
→ Result: [] (stop word)

// Phase 5: Task Filtering
isVague + hasProperty (priority)
→ Filter by priority: 1
→ Skip keyword matching (vague)
→ Send ALL P1 tasks to AI

Result: ✅ All urgent tasks shown, no false negatives
```

---

## Benefits of Clear Categorization

### 1. No Conflicts
- Each word category has clear purpose
- Priority order prevents ambiguity
- Context determines role (vague vs specific)

### 2. Correct Detection
- Generic words not removed before detection
- RAW keywords preserve vague indicators
- Stop words stay for detection phase

### 3. Proper Filtering
- Property extraction happens first
- Time context vs filter distinction clear
- Stop words removed only for matching

### 4. Maintainable
- Clear boundaries between categories
- Easy to add words to categories
- Predictable behavior

### 5. Extensible
- New languages follow same pattern
- Category system scales
- Easy to test and verify

---

## Implementation Status

**✅ Implemented:**
- Word category system (GENERIC_QUERY_WORDS in StopWords)
- Workflow phase separation
- RAW vs FILTERED keyword sets
- Vague detection before stop word removal
- Time context vs filter distinction in AI prompt

**✅ Documented:**
- Complete workflow with examples
- Word category reference
- Conflict resolution strategies
- Processing order clarified

**📝 To Test:**
- Word overlap scenarios
- Multi-language queries
- Edge cases (all stop words, mixed categories)

---

## Key Takeaways

1. **Word categories must have clear priorities**
2. **Processing order matters: Property → Vague Detection → Stop Word Removal**
3. **Maintain two keyword sets: RAW (detection) vs FILTERED (matching)**
4. **Context determines role: isVague + explicitPhrasing**
5. **Don't remove indicators before detection!**

This system resolves all word overlap conflicts while maintaining accurate detection and filtering.
