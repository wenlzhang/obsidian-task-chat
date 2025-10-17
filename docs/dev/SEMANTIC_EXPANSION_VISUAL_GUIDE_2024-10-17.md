# Semantic Expansion Visual Guide

**Quick reference for understanding the three-part parsing system**

## Formula Visualization

```
┌─────────────────────────────────────────────────────────────┐
│  SETTINGS                                                   │
│  • maxKeywordExpansions = 5 per language                    │
│  • queryLanguages = ["English", "中文"]                      │
│  • enableSemanticExpansion = true                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PER CORE KEYWORD CALCULATION                               │
│                                                             │
│  Keywords per core = maxExpansions × languages              │
│  Keywords per core = 5 × 2 = 10                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  QUERY: "Fix bug"                                           │
│                                                             │
│  Core Keywords: ["fix", "bug"]  ← 2 core keywords          │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
┌────────────────────┐              ┌────────────────────┐
│  "fix" Expansion   │              │  "bug" Expansion   │
│                    │              │                    │
│  English (5):      │              │  English (5):      │
│  • fix             │              │  • bug             │
│  • repair          │              │  • error           │
│  • solve           │              │  • issue           │
│  • correct         │              │  • defect          │
│  • debug           │              │  • fault           │
│                    │              │                    │
│  中文 (5):          │              │  中文 (5):          │
│  • 修复             │              │  • 错误             │
│  • 解决             │              │  • 问题             │
│  • 处理             │              │  • 缺陷             │
│  • 纠正             │              │  • 故障             │
│  • 调试             │              │  • 漏洞             │
│                    │              │                    │
│  Total: ~10        │              │  Total: ~10        │
└────────────────────┘              └────────────────────┘
        └───────────────────┬───────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  COMBINED EXPANDED KEYWORDS (keywords field)                │
│                                                             │
│  ["fix", "repair", "solve", "correct", "debug",             │
│   "修复", "解决", "处理", "纠正", "调试",                      │
│   "bug", "error", "issue", "defect", "fault",               │
│   "错误", "问题", "缺陷", "故障", "漏洞"]                      │
│                                                             │
│  Total: ~20 keywords (2 core × 10 per core)                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Structure Visualization

```typescript
ParsedQuery {
    // PART 1: Task Content
    coreKeywords: ["fix", "bug"],  // ← Metadata only, NOT used for filtering
    
    keywords: [                     // ← Used for everything
        "fix", "repair", "solve", "correct", "debug",
        "修复", "解决", "处理", "纠正", "调试",
        "bug", "error", "issue", "defect", "fault",
        "错误", "问题", "缺陷", "故障", "漏洞"
    ],
    
    // PART 2: Task Attributes  
    tags: ["urgent"],
    priority: undefined,
    dueDate: undefined,
    status: undefined,
    folder: undefined,
    
    // Metadata
    expansionMetadata: {
        enabled: true,
        maxExpansionsPerKeyword: 5,
        languagesUsed: ["English", "中文"],
        coreKeywordsCount: 2,
        totalKeywords: 20
    }
}
```

## Field Usage Map

```
┌────────────────┬──────────────┬──────────────┬──────────────┐
│ Field          │ Filtering    │ Scoring      │ Sorting      │
├────────────────┼──────────────┼──────────────┼──────────────┤
│ coreKeywords   │ ❌ NOT used  │ ❌ NOT used  │ ❌ NOT used  │
│                │              │              │              │
│ keywords       │ ✅ YES       │ ✅ YES       │ ✅ YES       │
│ (expanded)     │ DataView API │ Relevance    │ Relevance    │
│                │ matching     │ scoring      │ scores       │
│                │              │ (deduped)    │              │
├────────────────┼──────────────┼──────────────┼──────────────┤
│ tags           │ ✅ YES       │ ❌ NO        │ ❌ NO        │
│ priority       │ ✅ YES       │ ❌ NO        │ ✅ YES       │
│ dueDate        │ ✅ YES       │ ❌ NO        │ ✅ YES       │
│ status         │ ✅ YES       │ ❌ NO        │ ❌ NO        │
│ folder         │ ✅ YES       │ ❌ NO        │ ❌ NO        │
└────────────────┴──────────────┴──────────────┴──────────────┘
```

## Complete Flow Diagram

```
USER QUERY: "Fix bug #urgent"
    │
    ↓
┌───────────────────────────────────────────────────────────────┐
│ PHASE 1: AI PARSING (QueryParserService)                     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Extract Core Keywords                                     │
│    Raw: ["how", "to", "fix", "the", "bug"]                   │
│    → Remove stop words: ["fix", "bug"]                        │
│    → coreKeywords: ["fix", "bug"]                             │
│                                                               │
│ 2. Expand Each Core Keyword                                  │
│    "fix" → 10 variations                                      │
│    "bug" → 10 variations                                      │
│    → keywords: [...20 variations...]                          │
│                                                               │
│ 3. Extract Attributes                                         │
│    → tags: ["urgent"]                                         │
│    → priority: undefined                                      │
│    → dueDate: undefined                                       │
│                                                               │
│ 4. Filter Stop Words (double-check)                          │
│    → Remove any remaining stop words from keywords            │
│                                                               │
│ 5. Return ParsedQuery                                         │
│    {coreKeywords, keywords, tags, ...}                        │
└───────────────────────────────────────────────────────────────┘
    │
    ↓
┌───────────────────────────────────────────────────────────────┐
│ PHASE 2: TASK FILTERING (TaskSearchService)                  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Input: 150 tasks                                              │
│                                                               │
│ 1. Filter by Tags                                             │
│    Keep if: task.tags includes "urgent"                      │
│    → 60 tasks                                                 │
│                                                               │
│ 2. Filter by Keywords (DataView API)                         │
│    Keep if: task.text contains ANY of 20 keywords            │
│    Examples:                                                  │
│    • "修复登录错误" ✅ matches ("修复", "错误")                 │
│    • "Fix the authentication bug" ✅ matches ("fix", "bug")  │
│    • "Update documentation" ❌ no matches                     │
│    → 45 tasks                                                 │
│                                                               │
│ Output: 45 filtered tasks                                     │
└───────────────────────────────────────────────────────────────┘
    │
    ↓
┌───────────────────────────────────────────────────────────────┐
│ PHASE 3: RELEVANCE SCORING (TaskSearchService)               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Input: 45 filtered tasks + 20 keywords                        │
│                                                               │
│ 1. Deduplicate Overlapping Keywords                          │
│    ["如何", "如", "何"] → ["如何"]                              │
│    → 18 deduplicated keywords                                 │
│                                                               │
│ 2. Score Each Task                                            │
│    For task "Fix authentication bug urgently":                │
│    • Contains "fix" (start): +20                              │
│    • Contains "bug": +15                                      │
│    • Matching count (2): +16                                  │
│    • Total score: 51                                          │
│                                                               │
│ Output: 45 scored tasks                                       │
└───────────────────────────────────────────────────────────────┘
    │
    ↓
┌───────────────────────────────────────────────────────────────┐
│ PHASE 4: QUALITY FILTERING                                   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Threshold calculation:                                        │
│ • Base: 30 (user setting)                                     │
│ • Keywords: 20 (high count)                                   │
│ • Adjustment: +20 (many keywords from expansion)              │
│ • Final threshold: 50                                         │
│                                                               │
│ Keep tasks with score ≥ 50                                    │
│ → 32 high-quality tasks                                       │
└───────────────────────────────────────────────────────────────┘
    │
    ↓
┌───────────────────────────────────────────────────────────────┐
│ PHASE 5: SORTING (TaskSortService)                           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Multi-criteria sorting:                                       │
│                                                               │
│ 1. Primary: Relevance (descending)                           │
│    Groups: score=75 (5 tasks), score=51 (8 tasks), ...       │
│                                                               │
│ 2. Secondary: Due Date (ascending)                           │
│    Within score=51 group:                                     │
│    • 2025-10-16 (overdue)                                     │
│    • 2025-10-18 (tomorrow)                                    │
│    • 2025-10-25 (next week)                                   │
│    • undefined (no date)                                      │
│                                                               │
│ 3. Tertiary: Priority (ascending, 1=highest)                 │
│    Within score=51, due=undefined:                            │
│    • priority=1 (highest)                                     │
│    • priority=2 (high)                                        │
│    • undefined (no priority)                                  │
│                                                               │
│ Output: 32 sorted tasks                                       │
└───────────────────────────────────────────────────────────────┘
    │
    ├────────────────────┬────────────────────┐
    ↓                    ↓                    ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ SIMPLE       │  │ SMART        │  │ TASK CHAT    │
│ SEARCH       │  │ SEARCH       │  │ MODE         │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ Regex        │  │ AI parsing   │  │ AI parsing   │
│ parsing      │  │ ↓            │  │ ↓            │
│ ↓            │  │ Direct       │  │ Send to AI   │
│ Direct       │  │ results      │  │ ↓            │
│ results      │  │              │  │ AI analysis  │
│              │  │ Token cost:  │  │ ↓            │
│ Token cost:  │  │ Low          │  │ Results +    │
│ None         │  │ (parsing     │  │ insights     │
│              │  │ only)        │  │              │
│              │  │              │  │ Token cost:  │
│              │  │              │  │ High         │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Example Scenarios

### Scenario 1: English Query, Chinese Tasks

```
Query: "Fix bug"
↓
Core: ["fix", "bug"]
↓
Expanded: ["fix", "repair", "solve", "修复", "解决", "处理",
           "bug", "error", "issue", "错误", "问题", "缺陷"]
↓
Task 1: "修复登录错误" (Fix login error)
Matches: "修复" (repair) ✅, "错误" (error) ✅
Score: High → Included

Task 2: "Fix authentication bug"
Matches: "fix" ✅, "bug" ✅
Score: High → Included
```

### Scenario 2: Multi-Language Query

```
Query: "开发 Obsidian plugin"
↓
Core: ["开发", "Obsidian", "plugin"]
↓
Expanded: 
  "开发" → ["开发", "develop", "build", "创建", "create", ...]
  "Obsidian" → ["Obsidian"]  (proper noun, no expansion)
  "plugin" → ["plugin", "插件", "extension", "扩展", "addon", ...]
↓
Total: ~25 keywords

Task 1: "Build an Obsidian extension"
Matches: "build" ✅, "Obsidian" ✅, "extension" ✅
Score: Very High → Included

Task 2: "创建Obsidian插件教程" (Create Obsidian plugin tutorial)
Matches: "创建" ✅, "Obsidian" ✅, "插件" ✅
Score: Very High → Included
```

### Scenario 3: With Attribute Filters

```
Query: "Fix bug #urgent priority 1"
↓
Part 1: keywords (20 expanded)
Part 2: tags=["urgent"], priority=1
↓
Filtering:
1. Must have tag "urgent"
2. Must have priority 1
3. Must contain ANY expanded keyword

Task: "Fix login bug" #urgent [p::1]
✅ Tag matches
✅ Priority matches
✅ Keywords match ("fix", "bug")
→ Included and scored
```

## Console Output Example

```
[Task Chat] AI query parser parsed: {
  coreKeywords: ["fix", "bug"],
  keywords: ["fix", "repair", "solve", "correct", "debug", 
             "修复", "解决", "处理", "纠正", "调试",
             "bug", "error", "issue", "defect", "fault",
             "错误", "问题", "缺陷", "故障", "漏洞"],
  tags: ["urgent"]
}

[Task Chat] Keywords after stop word filtering: 20 → 20

[Task Chat] Semantic expansion: {
  core: 2,
  expanded: 20,
  perCore: "10.0",
  target: 10,
  enabled: true
}

[Task Chat] Extracted intent: {
  keywords: ["fix", "repair", "solve", ...],
  tags: ["urgent"]
}

[Task Chat] Searching with keywords: [fix, repair, solve, ...]

[Task Chat] Filtering 150 tasks with keywords: [fix, repair, ...]

[Task Chat] After keyword filtering: 45 tasks remain

[Task Chat] Quality filter threshold: 50 (base: 30, keywords: 20)

[Task Chat] Quality filter applied: 45 → 32 tasks (threshold: 50)

[Task Chat] Display sort order: [relevance, dueDate, priority]

[Task Chat] Sending top 30 tasks to AI (max: 30)
```

## Quick Reference

| Question | Answer |
|----------|--------|
| How many keywords per core? | maxExpansions × languages |
| Default per core? | 5 × 2 = 10 |
| Total for query? | Sum of all core expansions |
| Example total? | 2 cores × 10 = ~20 |
| Which field for filtering? | `keywords` (expanded) |
| Which field for scoring? | `keywords` (deduplicated) |
| coreKeywords usage? | Metadata/logging only |
| Stop words removed? | Yes, before returning |
| Both modes use expansion? | Yes, Smart Search + Task Chat |
| Simple Search? | No expansion (regex only) |
