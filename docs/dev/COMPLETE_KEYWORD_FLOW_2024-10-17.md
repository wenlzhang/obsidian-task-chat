# Complete Keyword Flow - From Parsing to Results

**Comprehensive trace showing how keywords are used throughout the system**

## Language Settings Verification

**YES, language settings ARE passed to AI!**

```typescript
// queryParserService.ts, lines 246-291

const queryLanguages = settings.queryLanguages || ["English", "中文"];
const languageList = queryLanguages.join(", ");
const maxExpansions = settings.maxKeywordExpansions || 5;

const systemPrompt = `
SEMANTIC KEYWORD EXPANSION SETTINGS:
- Languages configured: ${languageList}           ← PASSED HERE
- Max expansions per keyword per language: ${maxExpansions}  ← PASSED HERE
- Expansion enabled: ${expansionEnabled}
- Max variations to generate PER core keyword: ${maxKeywordsPerCore}
  (Formula: ${maxExpansions} expansions/language × ${queryLanguages.length} languages)

IMPORTANT: This means EACH core keyword should be expanded to approximately ${maxKeywordsPerCore} total variations.
Example with 2 languages and max 5 expansions:
  Core keyword "develop" → ~10 variations total:
  ["develop", "build", "create", "code", "implement",  ← English variations
   "开发", "构建", "创建", "编程", "实现"]              ← Chinese variations
`;
```

**AI receives:**
- Language list: ["English", "中文"]
- Max expansions per language: 5
- Target per core: 10 (5 × 2)
- Explicit examples in both languages

---

## Complete Flow with Concrete Example

### Query: "Fix bug #urgent"

**Settings:**
- `queryLanguages`: ["English", "中文"]
- `maxKeywordExpansions`: 5
- `enableSemanticExpansion`: true

---

## PHASE 1: Query Parsing (QueryParserService)

```typescript
// File: queryParserService.ts
// Method: parseWithAI()

// INPUT
Query: "Fix bug #urgent"
Settings: {
  queryLanguages: ["English", "中文"],
  maxKeywordExpansions: 5,
  enableSemanticExpansion: true
}

// STEP 1: Calculate target
maxKeywordsPerCore = 5 × 2 = 10

// STEP 2: Send to AI with language settings
AI Prompt includes:
  - Languages: "English, 中文"
  - Max per language: 5
  - Target per core: 10

// STEP 3: AI Response
{
  "coreKeywords": ["fix", "bug"],
  "keywords": [
    "fix", "repair", "solve", "correct", "debug",      // 5 English
    "修复", "解决", "处理", "纠正", "调试",              // 5 Chinese
    "bug", "error", "issue", "defect", "fault",        // 5 English
    "错误", "问题", "缺陷", "故障", "漏洞"               // 5 Chinese
  ],
  "tags": ["urgent"]
}

// STEP 4: Filter stop words
const filteredKeywords = StopWords.filterStopWords(parsed.keywords);
// All keywords are meaningful, none removed

// STEP 5: Build result
ParsedQuery {
  coreKeywords: ["fix", "bug"],          // Metadata only
  keywords: ["fix", "repair", ..., "漏洞"], // 20 keywords - USED EVERYWHERE
  tags: ["urgent"]
}
```

**Console Output:**
```
[Task Chat] ========== SEMANTIC EXPANSION DETAILS ==========
[Task Chat] User Settings: {
  languages: ["English", "中文"],
  maxExpansionsPerLanguage: 5,
  targetPerCore: 10,
  expansionEnabled: true
}
[Task Chat] Extraction Results: {
  coreKeywords: ["fix", "bug"],
  coreCount: 2
}
[Task Chat] Expansion Results: {
  expandedKeywords: ["fix", "repair", "solve", "correct", "debug", 
                     "修复", "解决", "处理", "纠正", "调试",
                     "bug", "error", "issue", "defect", "fault",
                     "错误", "问题", "缺陷", "故障", "漏洞"],
  totalExpanded: 20,
  averagePerCore: "10.0",
  targetPerCore: 10
}
[Task Chat] Language Distribution (estimated):
  English: 10 keywords - [fix, repair, solve, correct, debug, ...]
  中文: 10 keywords - [修复, 解决, 处理, 纠正, 调试, ...]
[Task Chat] ================================================
```

---

## PHASE 2A: Smart Search Mode

### Step 1: Convert to Intent (aiService.ts, lines 117-160)

```typescript
// File: aiService.ts
// Method: sendMessage()

// INPUT: ParsedQuery from Phase 1
parsedQuery {
  coreKeywords: ["fix", "bug"],           // NOT used after this
  keywords: ["fix", "repair", ..., "漏洞"], // USED HERE
  tags: ["urgent"]
}

// CONVERT to intent format
intent = {
  keywords: parsedQuery.keywords,  // ← Take EXPANDED keywords
  extractedTags: ["urgent"],
  extractedPriority: null,
  extractedDueDateFilter: null,
  extractedStatus: null,
  extractedFolder: null,
  hasMultipleFilters: true
}

console.log("[Task Chat] Extracted intent:", {
  keywords: ["fix", "repair", "solve", "correct", "debug", 
             "修复", "解决", "处理", "纠正", "调试",
             "bug", "error", "issue", "defect", "fault",
             "错误", "问题", "缺陷", "故障", "漏洞"],
  tags: ["urgent"]
});
```

### Step 2: Filter Tasks (TaskSearchService.applyCompoundFilters)

```typescript
// File: taskSearchService.ts
// Method: applyCompoundFilters()

// INPUT
tasks: 150 tasks total
filters: {
  keywords: ["fix", "repair", ..., "漏洞"],  // 20 expanded keywords
  tags: ["urgent"]
}

// FILTER BY TAGS FIRST
console.log("[Task Chat] Filtering by tags: [urgent]");
let filteredTasks = tasks.filter(task => 
  task.tags.includes("urgent")
);
// Result: 60 tasks with #urgent tag

// FILTER BY KEYWORDS (DataView API - substring matching)
console.log("[Task Chat] Filtering 60 tasks with keywords: [fix, repair, ...]");

filteredTasks = filteredTasks.filter(task => {
  const taskText = task.text.toLowerCase();
  
  // Match if ANY keyword appears in task text
  return filters.keywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    return taskText.includes(keywordLower);
  });
});

// EXAMPLES OF MATCHES:
Task 1: "Fix authentication bug" #urgent
  ✅ Contains "fix" → MATCHED
  ✅ Contains "bug" → MATCHED
  → Included

Task 2: "修复登录错误" #urgent (Chinese: Fix login error)
  ✅ Contains "修复" (repair) → MATCHED
  ✅ Contains "错误" (error) → MATCHED
  → Included

Task 3: "Update documentation" #urgent
  ❌ No keyword matches → EXCLUDED

// RESULT
console.log("[Task Chat] After keyword filtering: 45 tasks remain");
```

**Key Points:**
- Uses ALL 20 expanded keywords
- ANY keyword match includes the task
- Cross-language matching works automatically
- English query finds Chinese tasks (and vice versa)

### Step 3: Score Tasks (TaskSearchService.scoreTasksByRelevance)

```typescript
// File: taskSearchService.ts
// Method: scoreTasksByRelevance()

// INPUT
tasks: 45 filtered tasks
keywords: ["fix", "repair", ..., "漏洞"]  // 20 expanded keywords

// STEP 1: Deduplicate overlapping keywords
const deduplicatedKeywords = deduplicateOverlappingKeywords(keywords);
// Example: ["如何", "如", "何"] → ["如何"]
// Our keywords: No overlaps, so all 20 remain

console.log("[Task Chat] Deduplicated overlapping keywords: 20 → 20");

// STEP 2: Score each task
const scored = tasks.map(task => {
  const taskText = task.text.toLowerCase();
  let score = 0;
  
  // Check each deduplicated keyword
  deduplicatedKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    
    // Exact match
    if (taskText === keywordLower) {
      score += 100;
    }
    // Contains keyword
    else if (taskText.includes(keywordLower)) {
      // Bonus if at start
      if (taskText.startsWith(keywordLower)) {
        score += 20;
      } else {
        score += 15;
      }
    }
  });
  
  // Bonus for multiple keyword matches
  const matchingCount = deduplicatedKeywords.filter(kw =>
    taskText.includes(kw.toLowerCase())
  ).length;
  score += matchingCount * 8;
  
  return { task, score };
});

// EXAMPLES:
Task 1: "Fix authentication bug urgently" #urgent
  - Contains "fix" (start): +20
  - Contains "bug": +15
  - Matching count: 2
  - Bonus: 2 × 8 = +16
  - Total score: 51

Task 2: "修复登录错误" #urgent
  - Contains "修复": +15
  - Contains "错误": +15
  - Matching count: 2
  - Bonus: 2 × 8 = +16
  - Total score: 46

Task 3: "Need to repair the error in auth" #urgent
  - Contains "repair": +15
  - Contains "error": +15
  - Matching count: 2
  - Bonus: 2 × 8 = +16
  - Total score: 46
```

**Key Points:**
- Uses expanded keywords (deduplicated)
- Both English and Chinese tasks scored equally
- Multiple matches increase score
- Position matters (start = higher score)

### Step 4: Quality Filter (aiService.ts, lines 230-312)

```typescript
// File: aiService.ts
// Method: sendMessage()

// ADAPTIVE THRESHOLD CALCULATION
const keywordCount = intent.keywords.length; // 20 keywords

let baseThreshold = settings.relevanceThreshold; // 30 (user setting)
if (baseThreshold === 0) {
  // Adaptive based on keyword count
  if (keywordCount >= 4) baseThreshold = 20;
}

// ADJUSTMENT for semantic expansion
let finalThreshold;
if (keywordCount >= 6) {
  // Many keywords (from expansion) - increase threshold
  finalThreshold = Math.min(100, baseThreshold + 20); // 30 + 20 = 50
  console.log("[Task Chat] Semantic expansion detected (20 keywords), increasing threshold");
}

console.log("[Task Chat] Quality filter threshold: 50 (base: 30, keywords: 20)");

// FILTER tasks
const qualityFilteredTasks = scoredTasks
  .filter(st => st.score >= 50)
  .map(st => st.task);

console.log("[Task Chat] Quality filter applied: 45 → 32 tasks (threshold: 50)");

// Tasks with score < 50 are removed
```

### Step 5: Sort Tasks (TaskSortService.sortTasksMultiCriteria)

```typescript
// File: aiService.ts → TaskSortService.sortTasksMultiCriteria()

// BUILD RELEVANCE SCORES MAP
const relevanceScores = new Map(
  scoredTasks.map(st => [st.task.id, st.score])
);

// SORT ORDER for Smart Search
displaySortOrder = ["relevance", "dueDate", "priority"]

console.log("[Task Chat] Display sort order: [relevance, dueDate, priority]");

// SORT using multi-criteria
const sortedTasks = TaskSortService.sortTasksMultiCriteria(
  qualityFilteredTasks,    // 32 tasks
  displaySortOrder,        // [relevance, dueDate, priority]
  relevanceScores          // Map of task.id → score
);

// SORTING EXAMPLE:
Group 1 (score = 75):
  - Task A (score=75, due=2025-10-16, p=1)
  - Task B (score=75, due=2025-10-18, p=1)
  - Task C (score=75, due=2025-10-18, p=2)
  → Sorted by due date first, then priority

Group 2 (score = 51):
  - Task D (score=51, due=2025-10-16, p=1)
  - Task E (score=51, due=undefined, p=1)
  - Task F (score=51, due=undefined, p=2)
  → Sorted by due date first, then priority
```

### Step 6: Return Direct Results (Smart Search)

```typescript
// File: aiService.ts

// Smart Search mode returns direct results
return {
  response: "",
  directResults: sortedTasks.slice(0, settings.maxDirectResults), // Top 20
  tokenUsage: {
    promptTokens: 200,     // AI used for parsing only
    completionTokens: 50,
    totalTokens: 250,
    estimatedCost: 0.0001,
    model: settings.model,
    provider: settings.aiProvider,
    directSearchReason: "32 results"
  }
};
```

---

## PHASE 2B: Task Chat Mode

### Steps 1-5: Same as Smart Search

(Parsing → Filtering → Scoring → Quality Filter)

### Step 6: Different Sorting for AI Context

```typescript
// File: aiService.ts

// SMART SEARCH uses: ["relevance", "dueDate", "priority"]
// TASK CHAT uses different order for AI context:
aiContextSortOrder = ["relevance", "priority", "dueDate"]

console.log("[Task Chat] AI context sort order: [relevance, priority, dueDate]");

// Sort specifically for AI understanding
const sortedTasksForAI = TaskSortService.sortTasksMultiCriteria(
  qualityFilteredTasks,
  aiContextSortOrder,  // Different order!
  relevanceScores
);

// Why different?
// - AI sees most RELEVANT tasks first (relevance)
// - Then IMPORTANT tasks (priority)
// - Then URGENT tasks (dueDate)
// This order helps AI understand what matters most
```

### Step 7: Send to AI for Analysis

```typescript
// File: aiService.ts

// Select top tasks for AI
const tasksToAnalyze = sortedTasksForAI.slice(0, settings.maxTasksForAI); // Top 30

console.log("[Task Chat] Sending top 30 tasks to AI (max: 30)");

// BUILD TASK CONTEXT for AI
const taskContext = buildTaskContext(tasksToAnalyze, intent);

// Example output:
`
Found 30 relevant task(s):

[TASK_1] Fix authentication bug urgently
  Status: open | Priority: 1 (highest) | Due: 2025-10-16 | Tags: urgent

[TASK_2] 修复登录错误
  Status: open | Priority: 1 (highest) | Due: 2025-10-16 | Tags: urgent

[TASK_3] Repair error in payment processing
  Status: open | Priority: 2 (high) | Due: 2025-10-18 | Tags: urgent

...
`

// SEND TO AI
const messages = buildMessages(
  userMessage: "Fix bug #urgent",
  taskContext: taskContext,
  chatHistory: [],
  settings: settings,
  intent: intent,
  sortOrder: aiContextSortOrder
);

const { response, tokenUsage } = await callAI(messages, settings);
```

### Step 8: AI Analysis

```typescript
// AI receives:
// 1. User query: "Fix bug #urgent"
// 2. Task context: 30 tasks with [TASK_X] IDs
// 3. System prompt with instructions
// 4. Language preference from settings

// AI returns something like:
response = `
Based on your query about fixing urgent bugs, I recommend focusing on these critical issues:

Start with [TASK_1] - the authentication bug is blocking users from logging in and should be addressed immediately.

Next, handle [TASK_2] - the login error in Chinese users' workflow is related and fixing both together will be more efficient.

After those, [TASK_3] addresses payment processing which is business-critical.

I noticed [TASK_8], [TASK_12], and [TASK_15] are all related to the same error handling system, so you might want to fix them as a batch.
`
```

### Step 9: Extract Recommended Tasks

```typescript
// File: aiService.ts
// Method: extractRecommendedTasks()

// PARSE AI RESPONSE to find [TASK_X] references
const recommendedTasks = extractRecommendedTasks(
  response,
  tasksToAnalyze,
  settings,
  intent.keywords  // ← Still using expanded keywords for relevance check
);

// PROCESS:
// 1. Find all [TASK_X] mentions: [TASK_1], [TASK_2], [TASK_3], [TASK_8], [TASK_12], [TASK_15]
// 2. Map to actual tasks from tasksToAnalyze
// 3. Apply relevance threshold (still using expanded keywords)
// 4. Respect maxRecommendations setting
// 5. Return ordered list

// RESULT:
recommendedTasks = [
  Task 1: "Fix authentication bug urgently",
  Task 2: "修复登录错误", 
  Task 3: "Repair error in payment processing",
  Task 8: "Debug error handler timeout",
  Task 12: "Fix error logging system",
  Task 15: "Resolve error notification bug"
]
```

### Step 10: Replace Task References

```typescript
// File: aiService.ts
// Method: replaceTaskReferences()

// REPLACE [TASK_X] with friendly references
originalResponse = `
Start with [TASK_1] - the authentication bug...
Next, handle [TASK_2] - the login error...
After those, [TASK_3] addresses payment...
I noticed [TASK_8], [TASK_12], and [TASK_15]...
`

processedResponse = `
Start with Task 1 - the authentication bug...
Next, handle Task 2 - the login error...
After those, Task 3 addresses payment...
I noticed Task 4, Task 5, and Task 6...
`
// Note: Task IDs renumbered based on recommendation order
```

### Step 11: Return Results

```typescript
// File: aiService.ts

return {
  response: processedResponse,
  recommendedTasks: recommendedTasks,  // 6 tasks
  tokenUsage: {
    promptTokens: 2500,      // Higher - includes task context
    completionTokens: 300,   // AI analysis
    totalTokens: 2800,
    estimatedCost: 0.0056,
    model: settings.model,
    provider: settings.aiProvider
  }
};
```

---

## Summary: Keyword Usage Throughout System

| Phase | File | Method | Uses | Purpose |
|-------|------|--------|------|---------|
| **1. Parsing** | queryParserService.ts | parseWithAI() | Language settings | Tell AI which languages to expand into |
| | | | maxExpansions | Tell AI how many variations per language |
| | | | Returns keywords | Expanded keywords (20) |
| | | | Returns coreKeywords | Metadata only |
| **2A. Smart Search** | | | | |
| 2.1 Intent | aiService.ts | sendMessage() | parsedQuery.keywords | Extract expanded keywords |
| 2.2 Filter | taskSearchService.ts | applyCompoundFilters() | intent.keywords | Match tasks (DataView API) |
| 2.3 Score | taskSearchService.ts | scoreTasksByRelevance() | intent.keywords | Calculate relevance scores |
| 2.4 Quality | aiService.ts | sendMessage() | intent.keywords.length | Adaptive threshold |
| 2.5 Sort | taskSortService.ts | sortTasksMultiCriteria() | relevanceScores | Sort by relevance + others |
| 2.6 Return | aiService.ts | sendMessage() | - | Direct results |
| **2B. Task Chat** | | | | |
| 2.1-2.5 | [Same as Smart Search] | | | |
| 2.6 Sort AI | taskSortService.ts | sortTasksMultiCriteria() | relevanceScores | Sort for AI context |
| 2.7 Context | aiService.ts | buildTaskContext() | - | Format tasks for AI |
| 2.8 AI Call | aiService.ts | callAI() | - | Get AI analysis |
| 2.9 Extract | aiService.ts | extractRecommendedTasks() | intent.keywords | Validate recommendations |
| 2.10 Replace | aiService.ts | replaceTaskReferences() | - | Clean up response |
| 2.11 Return | aiService.ts | sendMessage() | - | AI response + tasks |

---

## Key Insights

### 1. Language Settings ARE Passed
- ✅ `queryLanguages` passed to AI in prompt (line 287)
- ✅ AI sees: "Languages configured: English, 中文"
- ✅ AI generates variations in ALL configured languages

### 2. Expanded Keywords Used Everywhere
- ✅ Filtering: Uses ALL 20 expanded keywords
- ✅ Scoring: Uses ALL 20 (deduplicated)
- ✅ Sorting: Uses relevance scores from keywords
- ✅ AI Context: Tasks already filtered by keywords

### 3. Core Keywords: Metadata Only
- ✅ Returned in ParsedQuery
- ✅ Logged for debugging
- ❌ NOT used for filtering
- ❌ NOT used for scoring
- ❌ NOT used for sorting

### 4. Cross-Language Magic
- English query → finds Chinese tasks
- Chinese query → finds English tasks
- Automatic via semantic expansion

### 5. Adaptive Quality Control
- More keywords → higher threshold
- Prevents noise from expansion
- Keeps only relevant results

---

## Console Output Example (Complete)

```
[Task Chat] Mode: Smart Search (AI parsing)
[Task Chat] AI query parser raw response: {...}
[Task Chat] AI query parser parsed: {...}
[Task Chat] Keywords after stop word filtering: 20 → 20

[Task Chat] ========== SEMANTIC EXPANSION DETAILS ==========
[Task Chat] User Settings: {
  languages: ["English", "中文"],
  maxExpansionsPerLanguage: 5,
  targetPerCore: 10,
  expansionEnabled: true
}
[Task Chat] Extraction Results: {
  coreKeywords: ["fix", "bug"],
  coreCount: 2
}
[Task Chat] Expansion Results: {
  expandedKeywords: ["fix", "repair", "solve", "correct", "debug", 
                     "修复", "解决", "处理", "纠正", "调试",
                     "bug", "error", "issue", "defect", "fault",
                     "错误", "问题", "缺陷", "故障", "漏洞"],
  totalExpanded: 20,
  averagePerCore: "10.0",
  targetPerCore: 10
}
[Task Chat] Language Distribution (estimated):
  English: 10 keywords - [fix, repair, solve, correct, debug]
  中文: 10 keywords - [修复, 解决, 处理, 纠正, 调试]
[Task Chat] ================================================

[Task Chat] Query parser returning (three-part): {...}
[Task Chat] Extracted intent: {
  keywords: ["fix", "repair", ..., "漏洞"],
  tags: ["urgent"]
}
[Task Chat] Searching with keywords: [fix, repair, solve, ...]
[Task Chat] Filtering 150 tasks with keywords: [fix, repair, ...]
[Task Chat] After keyword filtering: 45 tasks remain
[Task Chat] Quality filter threshold: 50 (base: 30, keywords: 20)
[Task Chat] Quality filter applied: 45 → 32 tasks (threshold: 50)
[Task Chat] Display sort order: [relevance, dueDate, priority]
[Task Chat] Result delivery: Direct (Smart Search mode, 32 results)
```

---

## Verification Checklist

- [x] Language settings passed to AI prompt
- [x] AI receives queryLanguages array
- [x] AI receives maxExpansions per language
- [x] AI receives target keywords per core
- [x] Expanded keywords used for filtering (DataView API)
- [x] Expanded keywords used for scoring (deduplicated)
- [x] Expanded keywords used for sorting (via relevance scores)
- [x] Core keywords NOT used for operations (metadata only)
- [x] Detailed logging shows language distribution
- [x] Both Smart Search and Task Chat use same keywords
- [x] Cross-language matching works automatically
