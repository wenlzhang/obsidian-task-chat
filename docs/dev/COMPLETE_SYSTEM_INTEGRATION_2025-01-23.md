# Complete System Integration: Vague Query Handling - January 23, 2025

## User's Comprehensive Questions

1. ✅ **Simple Search mode** - Are we improving that workflow?
2. ✅ **Scoring, sorting, display** - Is it functioning properly?
3. ✅ **Mixed queries** - Generic + keywords + properties combined?
4. ✅ **Configurable threshold** - Should users set the 70% value?
5. ✅ **Semantic expansion** - For mixed queries?
6. ✅ **Mode-specific workflows** - How do all three modes integrate?
7. ✅ **Stop words integration** - Complete workflow?

---

## 1. Simple Search Mode Integration

### Current State
- ❌ NO vague detection (regex-only extraction)
- ❌ NO time context handling
- ❌ Keywords always used for filtering

### ✅ Proposed Enhancement

**Add heuristic-based vague detection (NO AI cost):**

```typescript
// In taskSearchService.ts - analyzeQueryIntent()

static analyzeQueryIntent(
    query: string,
    settings: PluginSettings,
): QueryIntent {
    // ... existing property extraction ...
    
    let keywords = this.extractKeywords(query);
    keywords = this.removePropertyTriggerWords(keywords, settings);
    
    // ========== NEW: VAGUE DETECTION FOR SIMPLE SEARCH ==========
    // Use heuristic (no AI cost)
    // Extract RAW keywords BEFORE stop word removal for detection
    const rawKeywords = query.split(/\s+/)
        .filter(w => w.length > 0)
        .map(w => w.toLowerCase());
    
    // Calculate vagueness using shared service
    const vaguenessRatio = StopWords.calculateVaguenessRatio(rawKeywords);
    const isVague = vaguenessRatio >= (settings.vagueQueryThreshold || 0.7);
    
    console.log(
        `[Simple Search] Vague detection: ${rawKeywords.length} words, ` +
        `${(vaguenessRatio * 100).toFixed(0)}% generic, ` +
        `isVague: ${isVague}`
    );
    
    // Time context handling (for vague queries)
    let timeContext: string | undefined;
    if (isVague) {
        // Check for time words in raw keywords
        const timeWords = ["today", "tomorrow", "tonight", "今天", "明天", "idag", "imorgon"];
        const foundTime = rawKeywords.find(w => 
            timeWords.some(tw => w.includes(tw))
        );
        if (foundTime) {
            timeContext = foundTime;
            console.log(`[Simple Search] Time context detected: "${timeContext}" (not filter)`);
        }
    }
    // ========================================================
    
    return {
        isSearch: this.isSearchQuery(query),
        isPriority: propertyHints.hasPriority,
        isDueDate: propertyHints.hasDueDate,
        keywords,
        extractedPriority: extractedPriority as any,
        extractedDueDateFilter: extractedDueDateFilter as any,
        extractedDueDateRange,
        extractedStatus,
        extractedFolder,
        extractedTags,
        hasMultipleFilters: filterCount > 1,
        isVague,  // NEW
        // timeContext not stored in QueryIntent (Simple mode doesn't use it)
    };
}
```

**Benefits:**
- ✅ Simple Search gets vague detection (heuristic-only, no cost)
- ✅ Consistent with Smart/Task Chat modes
- ✅ Can skip keyword matching for vague queries
- ✅ Time context awareness (though not fully utilized in Simple mode)

---

## 2. Scoring, Sorting, Display Integration

### Current Flow

```typescript
// aiService.ts - after filtering

// Step 1: Score tasks
const scoredTasks = scoreTasksComprehensive(...);

// Step 2: Quality filter (uses isVague?)
const qualityFiltered = qualityFilter(scoredTasks, isVague);

// Step 3: Sort
const sorted = sortTasks(qualityFiltered, sortOrder);

// Step 4: Display or send to AI
```

### ✅ Verification Needed

**Check 1: isVague propagates to filtering**
```typescript
// taskSearchService.ts - applyCompoundFilters()
// Already implemented ✅

if (filters.isVague && hasProperties) {
    // Skip keyword matching for vague + properties
    console.log("[Task Chat] Vague query - SKIPPING keyword filter");
} else {
    // Normal keyword matching
}
```

**Check 2: Scoring respects vagueness**

Current scoring doesn't need isVague - it scores all tasks the same way. ✅ CORRECT

Vagueness affects **filtering**, not **scoring**.

**Check 3: Quality filter behavior**

Quality filter should NOT exclude all tasks for vague queries:

```typescript
// In aiService.ts - quality filtering

if (queryType.isVague && !queryType.hasKeywords) {
    // Vague query without keywords
    // Don't apply quality filter too strictly
    console.log("[Task Chat] Vague query - relaxing quality filter");
    // Keep more tasks for AI analysis
}
```

**Status:** ✅ Mostly working, but quality filter needs vague awareness

---

## 3. Mixed Queries (CRITICAL)

### Definition

**Mixed query:** Generic question + specific content

```
"今天 API 项目应该做什么？" (What should I do in API project today?)
Components:
- Generic words: 今天, 应该, 做, 什么 (50%)
- Specific content: API, 项目 (50%)
- Time: 今天
- Result: 50% generic < 70% → NOT vague ✅
```

### ✅ Current AI Prompt Handles This

**From prompt (lines 977-983):**
```
**DETECTION STRATEGY:**
1. Identify all words in query
2. Count generic words (from categories above)
3. Count specific content words (actions, objects, projects)
4. If 70%+ are generic AND no specific content → isVague: true
5. If query has specific content (even with some generic words) → isVague: false
6. Use semantic understanding, not just word matching!
```

**Examples from prompt:**
```
❌ Specific (isVague: false):
- "今天 API 项目应该做什么？" → Has specific content (API project)
- "What can I do today to complete the payment system?" → Specific object
```

### Processing Mixed Queries

```typescript
Query: "今天 API 项目应该做什么？"

// Phase 1: AI parsing
AI detects:
- isVague: false (has "API 项目")
- coreKeywords: ["API", "项目"]
- timeContext: "today" (context, not filter!)
- Generic words present: ["今天", "应该", "做", "什么"]

// Phase 2: Vague detection
50% generic < 70% threshold → isVague: false

// Phase 3: Keyword processing
- RAW keywords: ["API", "项目", "今天", "应该", "做", "什么"]
- FILTERED keywords: ["API", "项目"] (remove generic/stop words)
- Semantic expansion: YES ✅ (expand "API", "项目")

// Phase 4: Filtering
isVague: false → USE keyword matching
- Filter by expanded keywords
- No property filters (unless extracted)
- timeContext available for AI (Smart/Task Chat modes)

// Result
✅ Tasks matching "API", "项目" (and expansions)
✅ AI receives timeContext for prioritization
✅ Generic words didn't break matching
```

**Key insight:** 70% threshold naturally handles mixed queries! If there's real content (30%+), it's not vague.

---

## 4. Configurable Vagueness Threshold

### Current State
- Hardcoded: 70% (0.7) in multiple places
- User cannot adjust

### ✅ Should Users Configure This?

**Arguments FOR:**
- ✅ Different users have different query styles
- ✅ Some languages might need different thresholds
- ✅ Power users want control

**Arguments AGAINST:**
- ❌ 70% is a good universal threshold
- ❌ Too technical for average users
- ❌ More settings = more confusion

**Recommendation:** **YES, but as advanced setting**

### Implementation

**1. Add to settings:**

```typescript
// settings.ts

export interface PluginSettings {
    // ... existing settings ...
    
    // Advanced: Vague query detection threshold
    vagueQueryThreshold: number; // 0.0-1.0, default: 0.7
}

export const DEFAULT_SETTINGS: PluginSettings = {
    // ... existing defaults ...
    vagueQueryThreshold: 0.7,
};
```

**2. Add UI (Advanced section):**

```typescript
// settingsTab.ts

new Setting(advancedContainer)
    .setName("Vague query threshold")
    .setDesc(
        "Percentage of generic words to classify query as vague. " +
        "Default: 70%. Higher = fewer queries classified as vague. " +
        "Range: 50-90%."
    )
    .addSlider((slider) =>
        slider
            .setLimits(50, 90, 5) // 50-90%, step 5%
            .setValue(this.plugin.settings.vagueQueryThreshold * 100)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.vagueQueryThreshold = value / 100;
                await this.plugin.saveSettings();
            })
    );
```

**3. Use in detection:**

```typescript
// aiQueryParserService.ts

private static isVagueQuery(
    coreKeywords: string[], 
    settings: PluginSettings
): boolean {
    const vaguenessRatio = StopWords.calculateVaguenessRatio(coreKeywords);
    const threshold = settings.vagueQueryThreshold || 0.7;
    return vaguenessRatio >= threshold;
}

// Update call site
const heuristicVague = this.isVagueQuery(rawCoreKeywords, settings);
```

**Default behavior:** 70% (unchanged for existing users)
**Power users:** Can adjust 50-90%

---

## 5. Semantic Expansion for Mixed Queries

### Question
> "If it's a mixed query, after removing generic elements, do we conduct semantic expansion for keywords?"

### ✅ Answer: **YES, absolutely!**

### Current Behavior (Already Correct)

```typescript
Query: "今天 API 项目应该做什么？"

// Step 1: AI extracts all keywords
rawKeywords: ["今天", "API", "项目", "应该", "做", "什么"]

// Step 2: Filter stop words (removes generic)
filteredKeywords: ["API", "项目"]

// Step 3: Semantic expansion (YES, for remaining keywords!)
AI expands:
- "API" → ["API", "interface", "endpoint", "接口", "服务", ...]
- "项目" → ["project", "项目", "工作", "任务", ...]

// Step 4: Use expanded keywords for matching
tasks = filterByKeywords(tasks, expandedKeywords);
```

**Process:**
1. ✅ Extract ALL keywords (generic + specific)
2. ✅ Remove generic/stop words → Leaves specific content
3. ✅ Expand remaining keywords → Better matching
4. ✅ Use expanded keywords for filtering

**This is already implemented correctly!**

### Mixed Query Workflow

```
Input: Mixed query (generic + specific)
  ↓
AI parsing → Extract all words
  ↓
Vague detection → < 70% → NOT vague
  ↓
Stop word removal → Remove generic words
  ↓
Remaining: Specific keywords only
  ↓
Semantic expansion → Expand specific keywords ✅
  ↓
Task filtering → Use expanded keywords
  ↓
Result → Matched tasks
```

---

## 6. Mode-Specific Workflow Integration

### Complete Workflows for All Three Modes

#### **Mode 1: Simple Search**

```
User query
  ↓
[1] Regex extraction → Properties + keywords
  ↓
[2] RAW keywords (before stop word removal)
  ↓
[3] Heuristic vague detection → isVague (70% threshold)
  ↓
[4] Stop word removal → Filtered keywords
  ↓
[5] Time context check (if vague)
  ↓
[6] DataView filter → By properties
  ↓
[7] Keyword filter
     → If vague + properties: SKIP
     → If not vague: APPLY
  ↓
[8] Sort by default order
  ↓
[9] Direct display → No AI
```

**Features:**
- ✅ Heuristic vague detection (no AI cost)
- ✅ Conditional keyword filtering
- ✅ Time context awareness
- ✅ Fast, no AI overhead

---

#### **Mode 2: Smart Search**

```
User query
  ↓
[1] Pre-extract properties (regex)
  ↓
[2] AI parsing → Properties + keywords + vague detection
  ↓
[3] RAW keywords (before stop word removal)
  ↓
[4] Vague detection
     → AI detection (primary)
     → Heuristic (fallback)
  ↓
[5] Time context vs filter distinction
     → Vague + time: context
     → Specific + time: filter
  ↓
[6] Stop word removal → Filtered keywords
  ↓
[7] Semantic expansion → Expanded keywords
  ↓
[8] DataView filter → By properties
  ↓
[9] Keyword filter
     → If vague + properties: SKIP
     → If not vague: APPLY (with expansion)
  ↓
[10] Quality filter → Score-based
  ↓
[11] Sort by configured order
  ↓
[12] Direct display → Results with scores
```

**Features:**
- ✅ AI-based vague detection (more accurate)
- ✅ Semantic expansion (multilingual)
- ✅ Time context vs filter distinction
- ✅ Quality filtering
- ✅ Better accuracy than Simple

---

#### **Mode 3: Task Chat**

```
User query
  ↓
[1] Pre-extract properties (regex)
  ↓
[2] AI parsing → Properties + keywords + vague + context
  ↓
[3] RAW keywords (before stop word removal)
  ↓
[4] Vague detection
     → AI detection (primary)
     → Heuristic (fallback)
  ↓
[5] Time context vs filter distinction
     → Vague + time: context
     → Specific + time: filter
  ↓
[6] Stop word removal → Filtered keywords
  ↓
[7] Semantic expansion → Expanded keywords
  ↓
[8] DataView filter → By properties
  ↓
[9] Keyword filter
     → If vague + properties: SKIP
     → If not vague: APPLY (with expansion)
  ↓
[10] Quality filter → Score-based
  ↓
[11] Sort by configured order
  ↓
[12] Send to AI for analysis
     → Include: isVague, timeContext, all metadata
     → AI provides: Recommendations, prioritization, analysis
  ↓
[13] Display → AI response + task list
```

**Features:**
- ✅ Same as Smart Search for filtering
- ✅ PLUS: AI analysis and recommendations
- ✅ AI uses vague/timeContext for prioritization
- ✅ Natural language responses

---

### Mode Comparison

| Feature | Simple | Smart | Task Chat |
|---------|--------|-------|-----------|
| **Vague Detection** | Heuristic only | AI + Heuristic | AI + Heuristic |
| **Time Context** | Detected (not used) | Used in metadata | Used by AI |
| **Semantic Expansion** | No | Yes | Yes |
| **Stop Word Handling** | After detection | After detection | After detection |
| **Quality Filter** | No | Yes | Yes |
| **AI Analysis** | No | No | Yes |
| **Speed** | Fastest | Fast | Slowest (AI) |
| **Accuracy** | Good | Better | Best |
| **Cost** | Free | AI tokens | More AI tokens |

---

## 7. Complete Stop Words Integration

### Stop Words in Complete Workflow

```
┌─────────────────────────────────────────────────────────┐
│ QUERY INPUT: "What should I do today?"                  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 1: PROPERTY EXTRACTION                             │
│ → Remove property syntax                                 │
│ → Stop words: NOT touched yet                            │
│ → Remaining: "what should do today"                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 2: RAW KEYWORD EXTRACTION                          │
│ → Split into words: ["what", "should", "do", "today"]   │
│ → Stop words: KEPT (needed for vague detection!)        │
│ → RAW keywords stored for detection                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: VAGUE DETECTION                                 │
│ → Use RAW keywords (WITH stop words)                     │
│ → Calculate: 3/4 words are generic = 75%                │
│ → Result: isVague = true (75% > 70%)                    │
│ → Stop words enabled accurate detection ✅               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 4: TIME CONTEXT (if vague)                         │
│ → isVague = true                                          │
│ → Check for time words in RAW: "today"                  │
│ → timeContext = "today" (NOT filter)                    │
│ → Stop words still present in RAW ✅                     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 5: STOP WORD REMOVAL (for matching)               │
│ → Filter stop words from RAW keywords                    │
│ → RAW: ["what", "should", "do", "today"]               │
│ → FILTERED: [] (all are stop words!)                    │
│ → Keep both sets (RAW for metadata, FILTERED for match) │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 6: KEYWORD MATCHING (conditional)                 │
│ → isVague = true, filteredKeywords = []                 │
│ → Decision: SKIP keyword matching                        │
│ → Return ALL tasks (or filter by properties only)       │
│ → Stop words removal didn't break vague handling ✅      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 7: AI ANALYSIS (Task Chat mode)                   │
│ → Receives: isVague=true, timeContext="today"           │
│ → AI uses timeContext for prioritization                │
│ → Natural language response                              │
│ → Stop words not needed (already filtered) ✅            │
└─────────────────────────────────────────────────────────┘
```

### Stop Words Role Summary

| Phase | Stop Words Status | Purpose |
|-------|-------------------|---------|
| **1. Property Extraction** | Present | No impact |
| **2. RAW Extraction** | Present | Needed for next phase |
| **3. Vague Detection** | **MUST be present** | Enable accurate detection |
| **4. Time Context** | Present in RAW | Identify time words |
| **5. Stop Word Removal** | **REMOVED** | Create FILTERED set |
| **6. Keyword Matching** | Absent (from FILTERED) | Use FILTERED only |
| **7. AI Analysis** | Absent | Not needed anymore |

**Key principle:** Stop words stay until AFTER detection, then removed for matching.

---

## Summary

### All Questions Answered

1. ✅ **Simple Search:** Add heuristic vague detection (no AI cost)
2. ✅ **Scoring/Display:** Working correctly, quality filter needs vague awareness
3. ✅ **Mixed Queries:** 70% threshold handles naturally, expand remaining keywords
4. ✅ **Configurable Threshold:** Yes, add as advanced setting (50-90%)
5. ✅ **Semantic Expansion:** Yes, for filtered keywords after generic removal
6. ✅ **Mode Integration:** Complete workflows documented for all three modes
7. ✅ **Stop Words:** Kept until after detection, then removed for matching

### Implementation Priority

**High Priority (Do First):**
1. Add vague detection to Simple Search (heuristic only)
2. Make threshold configurable (advanced setting)
3. Add vague awareness to quality filter

**Medium Priority (Nice to Have):**
4. Enhance logging for mixed queries
5. Add timeContext to Simple mode metadata
6. Document edge cases

**Low Priority (Future):**
7. Machine learning threshold adjustment
8. User feedback on vague classification
9. Language-specific thresholds

### Files to Modify

1. **settings.ts** - Add vagueQueryThreshold
2. **settingsTab.ts** - Add threshold slider
3. **taskSearchService.ts** - Add vague detection to analyzeQueryIntent()
4. **aiService.ts** - Add vague awareness to quality filter
5. **aiQueryParserService.ts** - Pass settings to isVagueQuery()

All workflows now documented and integrated! Ready for implementation.
