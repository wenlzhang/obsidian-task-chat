# Vague Query Keyword Extraction - Complete Clarification
## January 23, 2025

## **Your Questions - All Answered**

You asked excellent clarifying questions about:
1. Keyword extraction in generic queries
2. Time context ranges for all time references
3. Pure vague query identification
4. Extraction order (properties before keywords)

Let me address each comprehensively.

---

## **1. Keyword Extraction in Generic Queries**

### **CRITICAL: Two Different Concepts**

The system uses **TWO DIFFERENT word lists**:

1. **Stop Words** = Common filler words (the, a, an, is, are, etc.)
   - Removed for ALL queries (generic or not)
   - Located in `stopWords.ts` lines 161-340
   - Examples: "the", "a", "an", "is", "are", "in", "on", "at"
   - Purpose: Improve keyword matching quality

2. **Generic Words** = Vague question indicators (what, should, do, etc.)
   - Used to DETECT vague queries
   - Located in `stopWords.ts` lines 29-145
   - Examples: "what", "should", "do", "can", "how"
   - Purpose: Identify generic/open-ended questions

**They are NOT the same!**

---

### **Current Flow - Three Modes**

#### **Simple Search (Regex-Based)**

```
Query: "What tasks should I do today?"

STEP 1: Extract keywords with regex
→ Split by whitespace
→ Result: ["What", "tasks", "should", "I", "do", "today"]

STEP 2: Remove stop words ONLY
→ filterStopWords() removes: "I"
→ Result: ["What", "tasks", "should", "do", "today"]

STEP 3: Generic word check (for vague detection if in Auto mode)
→ isGenericWord() checks each: "What"=yes, "should"=yes, "do"=yes
→ Vagueness ratio: 3/5 = 60%

STEP 4: For filtering tasks
→ Uses ALL remaining keywords (including generic)
→ Problem: "what", "should", "do" won't match real tasks ❌
```

**Issue:** Simple Search doesn't filter generic words, only stop words!

---

#### **Smart Search & Task Chat (AI-Based)**

```
Query: "What tasks should I do today?"

STEP 1: AI extracts keywords
→ AI parsing (with NLU)
→ AI returns: ["tasks", "today"] (AI already filtered generic!)
→ Result: No "what", "should", "do" ✅

STEP 2: Remove stop words
→ filterStopWords() (just in case AI missed some)
→ Result: ["tasks", "today"]

STEP 3: Vague detection (uses RAW keywords from AI)
→ AI also returns isVague: true (based on query structure)
→ Heuristic backup: Check if RAW keywords contain generic words

STEP 4: If vague, filter generic words again (Priority 3 fix!)
→ meaningfulKeywords = keywords.filter(kw => !isGenericWord(kw))
→ Result: ["tasks", "today"] (but "today" might be filtered too if in generic list)

STEP 5: Semantic expansion (if enabled)
→ Expand meaningful keywords across languages
→ "tasks" → ["tasks", "task", "todo", "任务", "uppgift", ...]
```

**Better:** AI already removes most generic words during extraction!

---

### **What AI Does (Smart Search & Task Chat)**

**AI Prompt Instructions (lines 1000-1060 in aiQueryParserService.ts):**

```
EXTRACT keywords that represent SPECIFIC CONTENT:
✅ Technical terms: "API", "authentication", "database"
✅ Domain concepts: "user", "payment", "notification"
✅ Action verbs: "fix", "implement", "deploy"
✅ Specific objects: "bug", "feature", "test"

DO NOT extract generic words:
❌ Question words: "what", "how", "which"
❌ Generic verbs: "do", "make", "work"
❌ Modal verbs: "should", "could", "might"
```

**So AI naturally filters generic words during extraction!**

---

### **Current System Summary**

| Mode | Stop Word Removal | Generic Word Removal | AI Semantic Expansion |
|------|-------------------|----------------------|----------------------|
| Simple Search | ✅ Yes | ❌ No | ❌ No |
| Smart Search | ✅ Yes | ✅ Yes (by AI) | ✅ Yes |
| Task Chat | ✅ Yes | ✅ Yes (by AI) | ✅ Yes |

**Both Auto and Generic modes use the SAME extraction:**
- Auto mode: Detects if vague, then extracts
- Generic mode: Forces vague, then extracts
- Extraction process identical after detection!

---

## **2. Time Context Expansion - All Time References**

### **Your Insight is PERFECT!**

> "Should all time references (today, tomorrow, this month, next month) be treated as ranges?"

**YES! Absolutely correct!** ✅

### **Current State**

Right now, the AI prompt only mentions:
- "today" → timeContext
- "tomorrow" → timeContext
- "this week" → timeContext

But doesn't specify HOW to handle them for filtering.

---

### **Proposed Solution: Comprehensive Range System**

**Define range semantics for ALL time references:**

| User Says | Time Context | Range Interpretation | Reasoning |
|-----------|-------------|---------------------|-----------|
| "今天" (today) | "today" | `<= today` | Include overdue + today |
| "tomorrow" | "tomorrow" | `<= tomorrow` | Include overdue + today + tomorrow |
| "this week" | "this-week" | `<= end-of-week` | Everything needing attention this week |
| "this month" | "this-month" | `<= end-of-month` | Everything needing attention this month |
| "next week" | "next-week" | `<= end-of-next-week` | Plan ahead for next week |
| "next month" | "next-month" | `<= end-of-next-month` | Long-term planning |

**Key principle:** When user asks "What should I do [TIME]?", they mean:
- "What needs my attention by [TIME]?"
- Always includes overdue items
- Range grows with time horizon

---

### **Implementation in AI Prompt**

**Add to aiQueryParserService.ts prompt (lines 1026-1050):**

```typescript
**Time Context → Range Mapping:**

For vague queries with time context, set dueDateRange (NOT dueDate):

TODAY / 今天 / idag:
→ dueDateRange: { "operator": "<=", "date": "today" }
→ Includes: Overdue + Due today

TOMORROW / 明天 / imorgon:
→ dueDateRange: { "operator": "<=", "date": "tomorrow" }
→ Includes: Overdue + Today + Tomorrow

THIS WEEK / 本周 / denna vecka:
→ dueDateRange: { "operator": "<=", "date": "end-of-week" }
→ Includes: Everything up to end of this week

THIS MONTH / 本月 / denna månad:
→ dueDateRange: { "operator": "<=", "date": "end-of-month" }
→ Includes: Everything up to end of this month

NEXT WEEK / 下周 / nästa vecka:
→ dueDateRange: { "operator": "<=", "date": "end-of-next-week" }
→ Includes: Everything up to end of next week

NEXT MONTH / 下月 / nästa månad:
→ dueDateRange: { "operator": "<=", "date": "end-of-next-month" }
→ Includes: Everything up to end of next month

**ALWAYS use "<=" operator for vague queries with time context!**
```

---

### **Why Always "<="?**

**User's mental model:**
- "What should I do today?" = "What needs my attention by today?"
- NOT "What has exact dueDate=today?"

**Benefits:**
- ✅ Includes overdue tasks (most important!)
- ✅ User sees complete picture of what needs attention
- ✅ Natural interpretation of vague time queries
- ✅ Consistent across all time horizons

**When NOT to use range:**
- Specific queries: "Complete tasks due today" → exact date filter
- isVague = false → use exact date

---

## **3. Pure Vague Query Identification**

### **Current Detection Method**

**Three-tier priority system:**

```typescript
// Priority 1: User's explicit choice (Generic mode)
if (settings.currentGenericMode === "generic") {
    isVague = true;  // Forced
}

// Priority 2: AI detection (if available)
else if (parsed.isVague !== undefined) {
    isVague = parsed.isVague;  // AI's decision
}

// Priority 3: Heuristic fallback
else {
    const genericRatio = countGenericWords(keywords) / keywords.length;
    isVague = genericRatio >= threshold;  // Default 0.7 (70%)
}
```

---

### **Pure vs Mixed Vague Queries**

**Definition:**

**Pure Vague:**
- ALL keywords are generic
- Example: "What should I do?" → ["what", "should", "do"] = 100% generic
- After filtering: 0 meaningful keywords

**Mixed Vague:**
- SOME keywords are generic, SOME are meaningful
- Example: "What API tasks?" → ["what", "API", "tasks"] = 33% meaningful
- After filtering: ["API", "tasks"]

---

### **Current Handling (After Priority 3 Fix)**

```typescript
// In taskSearchService.ts lines 780-829

if (filters.isVague) {
    // Filter generic words, keep meaningful
    const meaningfulKeywords = keywords.filter(
        kw => !StopWords.isGenericWord(kw)
    );
    
    if (meaningfulKeywords.length > 0) {
        // MIXED VAGUE: Has meaningful keywords
        console.log(`Vague query with ${meaningfulKeywords.length} meaningful keywords`);
        // Apply keyword filtering with meaningful keywords
    } else {
        // PURE VAGUE: No meaningful keywords
        console.log("Pure vague query - NO meaningful keywords");
        // Return tasks based on properties only
        // Let AI recommend from available tasks
    }
}
```

**This naturally handles both cases!**

---

### **AI's Role in Keyword Extraction**

**For vague queries, AI still extracts meaningful keywords:**

```
Query: "What API tasks should I do today?"

AI Analysis:
- Recognizes as vague (generic question structure)
- BUT still extracts meaningful content: ["API", "tasks"]
- Sets isVague: true
- Sets timeContext: "today"
- Returns: {
    isVague: true,
    keywords: ["API", "tasks"],  // Meaningful only!
    aiUnderstanding: { timeContext: "today" }
  }
```

**AI is smart:** It removes generic words but keeps meaningful ones automatically!

---

## **4. Extraction Order - Properties Before Keywords**

### **Your Insight is CORRECT!**

> "You should extract task properties before extracting keywords in case certain task properties are removed or filtered out from generic terms."

**This is EXACTLY what the system does!**

---

### **Current Order (aiService.ts lines 125-240)**

```typescript
// STEP 1: Pre-extract properties with regex (lines 125-132)
const preExtractedIntent = TaskSearchService.analyzeQueryIntent(message, settings);
// Extracts: priority (p:1), dueDate (d:today), status (s:open), etc.

// STEP 2: Remove property SYNTAX from query (lines 137-138)
const cleanedQuery = TaskSearchService.removePropertySyntax(message);
// "p1 API tasks d:today" → "API tasks" (removes syntax only)

// STEP 3: Send cleaned query to AI (line 145)
parsedQuery = await QueryParserService.parseQuery(cleanedQuery, settings);
// AI extracts keywords from "API tasks" (no property syntax to confuse it)

// STEP 4: Merge properties (lines 150-182)
// For NON-vague: Use pre-extracted (more reliable for syntax)
// For vague: Use AI's interpretation (semantic understanding)
```

**So properties ARE extracted before keywords!**

---

### **Why This Order Matters**

**Example:**

```
Query: "p1 priority tasks due today"

Without pre-extraction:
- AI sees: "p1", "priority", "tasks", "due", "today"
- Might extract "priority" as keyword (confusing!)
- Result: Keywords = ["p1", "priority", "tasks"] ❌

With pre-extraction (current):
STEP 1: Extract priority=1 from "p1"
STEP 2: Remove "p1" syntax → "priority tasks due today"
STEP 3: AI extracts: ["priority", "tasks"]
STEP 4: Remove property trigger words: ["tasks"]
Result: Keywords = ["tasks"] ✅
```

**The system already does this correctly!**

---

### **Special Case for Vague Queries**

**After Priority 1 fix:**

```typescript
// lines 153-182
if (!parsedQuery.isVague) {
    // Specific query: Use pre-extracted properties (syntax-based)
    if (preExtractedIntent.extractedPriority) {
        parsedQuery.priority = preExtractedIntent.extractedPriority;
    }
    // ... (merge all properties)
} else {
    // Vague query: Trust AI's semantic understanding
    console.log("Vague query - using AI's property interpretation");
    // AI knows "today" is context, not filter
    // AI knows "urgent" is concept, not exact syntax
}
```

**For vague queries:**
- Properties extracted by AI semantically
- "urgent" → priority: 1 (concept recognition)
- "今天" → timeContext: "today" (not exact filter)

---

## **Complete Flow Diagram**

### **Smart Search & Task Chat with Vague Query**

```
User Query: "What urgent API tasks should I do today?"
                    ↓
         [STEP 1: Property Pre-extraction]
                    ↓
    Regex extracts: (nothing, no syntax)
                    ↓
         [STEP 2: Clean Query Syntax]
                    ↓
           Query unchanged
                    ↓
         [STEP 3: AI Parsing]
                    ↓
    AI Analysis:
    - isVague: true (generic question)
    - priority: 1 (semantic: "urgent" → concept)
    - keywords: ["API", "tasks"] (meaningful only!)
    - timeContext: "today" (context, not filter)
    - dueDateRange: { operator: "<=", date: "today" }
                    ↓
         [STEP 4: Stop Word Filtering]
                    ↓
    keywords: ["API", "tasks"] (already clean)
                    ↓
         [STEP 5: Semantic Expansion]
                    ↓
    Expand "API": ["API", "application", "interface", "接口", "API"]
    Expand "tasks": ["tasks", "task", "todo", "任务", "uppgift"]
    Result: ~20 keywords across languages
                    ↓
         [STEP 6: Property Merge Decision]
                    ↓
    isVague = true → Use AI's properties ✅
    (Don't override with regex pre-extraction)
                    ↓
         [STEP 7: DataView Filtering]
                    ↓
    Filter by:
    - priority: 1
    - dueDateRange: { operator: "<=", date: "today" }
    Result: Urgent tasks due today + overdue
                    ↓
         [STEP 8: Keyword Filtering]
                    ↓
    Filter generic words: ["API", "tasks"] (already clean)
    Apply to tasks: Match "API" OR "tasks"
    Result: Urgent API-related tasks needing attention today
                    ↓
         [STEP 9: Scoring & Sorting]
                    ↓
    Score with all coefficients
    Sort by priority (urgent first)
                    ↓
         [STEP 10: AI Analysis (Task Chat only)]
                    ↓
    AI analyzes and recommends top tasks
```

---

## **Recommendations for Improvement**

### **1. Expand Time Context System**

**Status:** Documented in Priority 2 implementation guide

**Action Items:**
- [ ] Update AI prompt with comprehensive time → range mapping
- [ ] Add support for "this month", "next week", "next month"
- [ ] Always use "<=" operator for vague time queries
- [ ] Implement in dataviewService.ts

---

### **2. Clarify Generic vs Stop Words**

**Current:** System uses both correctly but not well documented

**Action Items:**
- [ ] Add comments distinguishing the two concepts
- [ ] Document in README what each list does
- [ ] Consider renaming for clarity:
  - `STOP_WORDS` → Common filler words (removed always)
  - `VAGUE_INDICATOR_WORDS` → Generic question words (for detection)

---

### **3. Simple Search Generic Word Filtering**

**Issue:** Simple Search doesn't filter generic words, only stop words

**Current behavior:**
```
Query: "What tasks today?"
Keywords: ["What", "tasks", "today"]  // "What" NOT filtered ❌
Matches: 0 tasks (because tasks don't contain "What")
```

**Proposed fix:**
```typescript
// In taskSearchService.ts analyzeQueryIntent
const keywords = this.extractKeywords(query, settings);

// NEW: If detected as vague, filter generic words
if (isVagueQuery) {
    keywords = keywords.filter(kw => !StopWords.isGenericWord(kw));
}
```

**Benefit:** Consistency across all three modes

---

### **4. Document Extraction Order**

**Current:** Extraction order is correct but not documented

**Action Items:**
- [ ] Add flowchart to README showing extraction order
- [ ] Document why properties come before keywords
- [ ] Show vague query special handling

---

## **Summary: Answers to Your Questions**

### **Q1: How are keywords extracted in generic queries?**

**Answer:**
- **Stop words** removed in ALL queries (the, a, an, etc.)
- **Generic words** removed by AI during extraction (Smart/Task Chat)
- **Simple Search** doesn't filter generic words (only stop words)
- **Auto and Generic modes** use same extraction after detection

**AI-based modes (Smart Search & Task Chat):**
- AI naturally filters generic words during extraction ✅
- Semantic expansion applied to meaningful keywords only ✅
- Works the same in Auto and Generic modes ✅

---

### **Q2: Should all time references use ranges?**

**Answer:** **YES! Absolutely!** ✅

**For vague queries:**
- "today" → `<= today` (includes overdue)
- "tomorrow" → `<= tomorrow`
- "this week" → `<= end-of-week`
- "this month" → `<= end-of-month`
- "next week" → `<= end-of-next-week`
- "next month" → `<= end-of-next-month`

**Always use "<=" for vague time queries** to include everything needing attention!

---

### **Q3: How do you identify pure vague queries?**

**Answer:**

**Detection:** Three-tier priority
1. Generic mode (forced)
2. AI detection (isVague field)
3. Heuristic (70% generic word ratio)

**Handling:**
- Filter generic words: `meaningfulKeywords = keywords.filter(kw => !isGenericWord(kw))`
- If meaningful keywords remain → Mixed vague (use them)
- If no meaningful keywords → Pure vague (skip keyword filtering)

**AI's role:** Extracts meaningful keywords even for vague queries!

---

### **Q4: Should properties be extracted before keywords?**

**Answer:** **YES, and the system already does this!** ✅

**Current order:**
1. Pre-extract properties with regex (p:1, d:today, etc.)
2. Remove property syntax from query
3. AI extracts keywords from cleaned query
4. Merge properties (respect vague query flag)

**For vague queries:** AI's property interpretation used (semantic)  
**For specific queries:** Regex pre-extraction used (syntax-based)

**DueDate special case:** For vague queries, use range (not exact date)

---

## **Status**

**Implemented:**
- ✅ Keyword extraction with stop word filtering
- ✅ AI-based generic word removal
- ✅ Property extraction before keywords
- ✅ Vague query detection (three-tier)
- ✅ Mixed vague query handling (Priority 3)

**Documented (Ready to Implement):**
- 📋 Time context → range mapping (Priority 2)
- 📋 Comprehensive time reference support

**Recommended (Future Enhancement):**
- 📋 Simple Search generic word filtering
- 📋 Documentation improvements

---

**Your questions revealed important clarifications needed!** The system works correctly but wasn't clearly documented. Thank you for pushing for these clarifications! 🙏
