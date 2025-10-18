# Comprehensive Weighted Scoring System

**Date:** 2024-10-18  
**Status:** ✅ Implemented  
**Applies to:** Smart Search and Task Chat modes (AI-parsed queries with core keywords)

## Overview

The comprehensive weighted scoring system combines multiple factors to calculate task relevance scores:
1. **Keyword Relevance** (coefficient: 10)
2. **Due Date Urgency** (coefficient: 2)
3. **Priority Importance** (coefficient: 1)

This system replaces the simple keyword-only scoring for Smart Search and Task Chat modes, providing more intelligent task ranking based on user intent and task properties.

## Problem Statement

Your reflection identified the need for a comprehensive scoring system that:
- Calculates keyword match percentage based on core keywords
- Adds bonus for core keyword matches
- Considers due date urgency with time-based scoring
- Weights priority appropriately
- Applies weighted coefficients based on query and sort settings
- Uses DataView API for reliable date calculations

## Architecture

### Three-Part Query System Integration

The scoring system integrates with the three-part query parsing system:

**PART 1: Task Content (Keywords)**
- `coreKeywords`: Original extracted keywords (used for match percentage calculation)
- `keywords`: Expanded semantic equivalents (used for text matching)

**PART 2: Task Attributes (Structured Filters)**
- `priority`: Used for priority scoring if present in query or sort settings
- `dueDate`: Used for due date scoring if present in query or sort settings
- `status`, `folder`, `tags`: Used for filtering but not scoring

**PART 3: Executor/Environment Context**
- Reserved for future implementation

### Scoring Components

#### 1. Keyword Relevance Score (Coefficient: 10)

**Formula:**
```
relevanceScore = 
  coreKeywordMatchPercentage +     // 20% per matched core keyword
  coreKeywordBonus +                // +20% if any core keyword matches
  keywordTextMatching +             // Points for exact/start/contains matches
  multipleKeywordBonus +            // +8 per matching keyword
  mediumLengthBonus                 // +5 for descriptive tasks
  - penalties                        // Penalties for generic/short tasks
```

**Components:**

**1.1 Core Keyword Match Percentage:**
- Count how many core keywords match the task text
- Each matched core keyword contributes 20%
- Formula: `(matchedCoreKeywords / totalCoreKeywords) × 100`
- Examples:
  - 5/5 core keywords match → 100%
  - 4/5 core keywords match → 80%
  - 3/5 core keywords match → 60%
  - 2/5 core keywords match → 40%
  - 1/5 core keywords match → 20%

**1.2 Core Keyword Bonus:**
- If ANY core keyword matches → +20%
- Ensures tasks with at least one core match get priority

**1.3 Keyword Text Matching:**
- Exact match: +100 points
- Starts with keyword: +20 points
- Contains keyword: +15 points

**1.4 Multiple Keyword Bonus:**
- +8 points per matching keyword (deduplicated)

**1.5 Medium Length Bonus:**
- Tasks with 20-100 characters: +5 points
- Favors descriptive but not verbose tasks

**1.6 Penalties:**
- Very short tasks (<5 characters): -100 points
- Generic placeholder tasks ("task", "todo", etc.): -150 points

#### 2. Due Date Score (Coefficient: 2)

**Formula:**
```
dueDateScore = 
  2.0  if past due (before today)
  1.0  if within 7 days
  0.5  if within 1 month
  0.2  if after 1 month OR no due date
```

**Implementation:**
- Uses moment (from Obsidian) for reliable date parsing and comparison
- Automatically handles date formats through moment's parsing
- Calculates difference in days using moment's diff method
- Applied only if due date exists in query OR sort settings

**Time Ranges:**
- **Past due** (diffDays < 0): Score 2.0 (highest urgency)
- **Within 7 days** (diffDays ≤ 7): Score 1.0 (urgent)
- **Within 1 month** (diffDays ≤ 30): Score 0.5 (moderate urgency)
- **After 1 month** (diffDays > 30): Score 0.2 (low urgency)
- **No due date**: Score 0.2 (same as far future - low urgency)

#### 3. Priority Score (Coefficient: 1)

**Formula:**
```
priorityScore = 
  1.0   if priority 1 (highest)
  0.75  if priority 2 (high)
  0.5   if priority 3 (medium)
  0.2   if priority 4 (low)
  0.0   if no priority
```

**Priority Levels:**
- **Priority 1** (highest): Score 1.0
- **Priority 2** (high): Score 0.75
- **Priority 3** (medium): Score 0.5
- **Priority 4** (low): Score 0.2
- **No priority**: Score 0.0

### Weighted Coefficient System

**Base Coefficients:**
- Relevance: 10 (always applied)
- Due Date: 2 (conditionally applied)
- Priority: 1 (conditionally applied)

**Conditional Application:**

Due date coefficient applied (1.0) if:
- Due date filter exists in query (`queryHasDueDate`), OR
- "dueDate" exists in sort criteria

Priority coefficient applied (1.0) if:
- Priority filter exists in query (`queryHasPriority`), OR
- "priority" exists in sort criteria

Otherwise, coefficient = 0.0 (component ignored)

**Rationale:**
- **Relevance always matters**: Keywords are the primary search intent
- **Due date conditional**: Only weight if user cares about dates (mentioned in query or sort)
- **Priority conditional**: Only weight if user cares about priority (mentioned in query or sort)

### Final Score Calculation

**Weighted Formula:**
```typescript
finalScore = 
  (relevanceScore × 10) + 
  (dueDateScore × 2 × dueDateCoefficient) + 
  (priorityScore × 1 × priorityCoefficient)
```

**Examples:**

**Example 1: Query with due date and priority**
```
Query: "Fix bug #urgent priority 1 due today"
- Core keywords: ["fix", "bug"]
- Due date: "today"
- Priority: 1

Task: "Fix login bug" (due: today, priority: 1)
- Relevance: 2/2 core = 100% + 20% bonus = 120
- Due date: today = 1.0
- Priority: 1 = 1.0
- Coefficients: dueDate=1.0, priority=1.0
- Final: (120 × 10) + (1.0 × 2 × 1.0) + (1.0 × 1 × 1.0) = 1203
```

**Example 2: Query with keywords only**
```
Query: "develop Task Chat plugin"
- Core keywords: ["develop", "Task", "Chat", "plugin"]
- No due date or priority in query
- Sort settings: ["relevance", "dueDate", "priority"]

Task: "Develop new chat feature" (due: tomorrow, priority: 2)
- Relevance: 2/4 core = 40% + 20% bonus = 60
- Due date: tomorrow = 1.0
- Priority: 2 = 0.75
- Coefficients: dueDate=1.0 (in sort), priority=1.0 (in sort)
- Final: (60 × 10) + (1.0 × 2 × 1.0) + (0.75 × 1 × 1.0) = 602.75
```

**Example 3: Query keywords only, no sort weighting**
```
Query: "obsidian plugin"
- Core keywords: ["obsidian", "plugin"]
- No due date or priority in query
- Sort settings: ["relevance"] (no dueDate or priority)

Task: "Obsidian plugin development" (no due date, no priority)
- Relevance: 2/2 core = 100% + 20% bonus = 120
- Due date: none = 0.2 (same as far future)
- Priority: none = 0.0
- Coefficients: dueDate=0.0 (not in sort), priority=0.0 (not in sort)
- Final: (120 × 10) + (0.2 × 2 × 0.0) + (0.0 × 1 × 0.0) = 1200
```

## Implementation Details

### Method: `scoreTasksComprehensive()`

**Location:** `taskSearchService.ts`

**Parameters:**
```typescript
scoreTasksComprehensive(
  tasks: Task[],                    // Tasks to score
  keywords: string[],               // Expanded keywords for matching
  coreKeywords: string[],           // Original core keywords
  queryHasDueDate: boolean,         // Due date in query?
  queryHasPriority: boolean,        // Priority in query?
  sortCriteria: string[],           // User's sort settings
)
```

**Returns:**
```typescript
Array<{
  task: Task;
  score: number;              // Final weighted score
  relevanceScore: number;     // Relevance component
  dueDateScore: number;       // Due date component
  priorityScore: number;      // Priority component
}>
```

### Integration Points

**1. Quality Filtering (Phase 1)**
```typescript
// aiService.ts line ~235
if (usingAIParsing && parsedQuery?.coreKeywords) {
  scoredTasks = TaskSearchService.scoreTasksComprehensive(
    filteredTasks,
    intent.keywords,
    parsedQuery.coreKeywords,
    !!intent.extractedDueDateFilter,
    !!intent.extractedPriority,
    displaySortOrder,
  );
} else {
  scoredTasks = TaskSearchService.scoreTasksByRelevance(
    filteredTasks,
    intent.keywords,
  );
}
```

**2. Sorting for Display (Phase 2)**
```typescript
// aiService.ts line ~347
if (usingAIParsing && parsedQuery?.coreKeywords) {
  scoredTasks = TaskSearchService.scoreTasksComprehensive(
    qualityFilteredTasks,
    intent.keywords,
    parsedQuery.coreKeywords,
    !!intent.extractedDueDateFilter,
    !!intent.extractedPriority,
    displaySortOrder,
  );
} else {
  scoredTasks = TaskSearchService.scoreTasksByRelevance(
    qualityFilteredTasks,
    intent.keywords,
  );
}
relevanceScores = new Map(
  scoredTasks.map((st) => [st.task.id, st.score]),
);
```

**3. Fallback Extraction**
```typescript
// aiService.ts extractRecommendedTasks() line ~1275
if (usingAIParsing && coreKeywords.length > 0) {
  scoredTasks = TaskSearchService.scoreTasksComprehensive(
    tasks,
    keywords,
    coreKeywords,
    queryHasDueDate,
    queryHasPriority,
    sortCriteria,
  );
} else {
  scoredTasks = TaskSearchService.scoreTasksByRelevance(
    tasks,
    keywords,
  );
}
```

### Mode Detection

**Smart Search & Task Chat modes:**
- Use comprehensive scoring when `usingAIParsing && parsedQuery?.coreKeywords`
- AI parsing extracts both core keywords and expanded keywords
- Core keywords enable match percentage calculation

**Simple Search mode:**
- Use simple keyword scoring (`scoreTasksByRelevance()`)
- No AI parsing, no core keywords available
- Falls back gracefully to traditional scoring

## Logging System

### Configuration Logging

```
[Task Chat] ========== COMPREHENSIVE SCORING CONFIGURATION ==========
[Task Chat] Core keywords: 5 [develop, Task, Chat, plugin, feature]
[Task Chat] Expanded keywords: 75
[Task Chat] Query filters - dueDate: true, priority: false
[Task Chat] Sort criteria includes - dueDate: true, priority: true
[Task Chat] Scoring coefficients - relevance: 10 (always), dueDate: 2, priority: 1
[Task Chat] ============================================================
```

### Score Breakdown Logging

```
[Task Chat] ========== TOP 5 SCORED TASKS (Comprehensive) ==========
[Task Chat] #1: "Develop Task Chat plugin feature"
[Task Chat]   - Relevance: 145.0 (× 10 = 1450.0)
[Task Chat]   - Due Date: 1.0 (× 2 = 2.0)
[Task Chat]   - Priority: 1.0 (× 1 = 1.0)
[Task Chat]   - FINAL SCORE: 1453.0
[Task Chat] #2: "Build chat interface"
[Task Chat]   - Relevance: 75.0 (× 10 = 750.0)
[Task Chat]   - Due Date: 2.0 (× 2 = 4.0)
[Task Chat]   - Priority: 0.75 (× 1 = 0.75)
[Task Chat]   - FINAL SCORE: 754.75
...
[Task Chat] ==============================================================
```

## Benefits

### 1. Intelligent Ranking
- Tasks ranked by actual relevance, not just keyword count
- Core keyword match percentage prioritizes tasks that match user's main intent
- Weighted scoring balances multiple factors appropriately

### 2. Context-Aware Scoring
- Due date and priority only weighted when user cares about them
- Respects user's sort preferences
- Adapts to query intent automatically

### 3. DataView API Reliability
- Date calculations using proper date parsing
- Handles timezone correctly
- Consistent with Obsidian's DataView plugin

### 4. Semantic Expansion Support
- Core keywords separate from expanded keywords
- Expansion improves recall (finding more tasks)
- Core keywords improve precision (ranking relevance)

### 5. Transparent Scoring
- Comprehensive logging shows score breakdown
- Easy to debug and understand results
- Clear coefficient application

## Testing Scenarios

### Scenario 1: Mixed-Language Query with Priority
```
Query: "开发 plugin för Task Chat 插件 priority 1"
Expected:
- Core keywords: ["开发", "plugin", "Task", "Chat", "插件"]
- Expanded: ~75 keywords (5 core × 15 expansions per core)
- Priority: 1
- Due date coefficient: 0 (not in query or sort)
- Priority coefficient: 1.0 (in query)

Top task should:
- Match most core keywords (high relevance)
- Have priority 1 (adds 1.0 to score)
```

### Scenario 2: Urgent Tasks Query
```
Query: "urgent tasks due today"
Expected:
- Core keywords: ["urgent", "tasks"]
- Due date: "today"
- Due date coefficient: 1.0 (in query)
- Priority coefficient: 1.0 (if "priority" in sort)

Top tasks should:
- Be due today (dueDateScore: 1.0 → adds 2.0)
- Match "urgent" keyword
- Overdue tasks (dueDateScore: 2.0 → adds 4.0) score even higher
```

### Scenario 3: Priority Query without Date
```
Query: "priority 1 tasks"
Expected:
- Core keywords: ["tasks"]
- Priority: 1
- Priority coefficient: 1.0 (in query)
- Due date coefficient: 0.0 (not in query)

Top tasks should:
- Have priority 1 (adds 1.0 to score)
- Match "tasks" keyword
- Due dates ignored in scoring
```

## Backward Compatibility

### Simple Search Mode
- Continues using `scoreTasksByRelevance()`
- No changes to existing behavior
- No core keywords needed

### Smart Search & Task Chat Modes
- Automatically use comprehensive scoring when core keywords available
- Gracefully fall back to simple scoring if AI parsing fails
- No breaking changes to existing queries

## Future Enhancements

### 1. Part 3: Executor/Environment Context
- Time of day scoring (morning tasks vs evening tasks)
- Energy level consideration (complex vs simple tasks)
- User preferences (favorite projects, contexts)

### 2. Machine Learning Integration
- Learn user's scoring preferences over time
- Adjust coefficients based on user behavior
- Personalized relevance scoring

### 3. Task Properties
- Task age (newer vs older)
- Completion rate (similar tasks)
- Recurrence patterns

### 4. User-Configurable Coefficients
- Allow users to adjust relevance:dueDate:priority weights
- Per-mode coefficient settings
- Advanced user customization

## Summary

The comprehensive weighted scoring system provides intelligent, context-aware task ranking for Smart Search and Task Chat modes. It:

✅ Calculates keyword match percentage using core keywords  
✅ Adds bonus for core keyword matches  
✅ Scores due date urgency with DataView API  
✅ Weights priority appropriately  
✅ Applies coefficients based on query and sort settings  
✅ Integrates seamlessly with semantic expansion  
✅ Provides transparent logging for debugging  
✅ Maintains backward compatibility  

The system respects user settings throughout the entire pipeline:
- Expansion: `maxKeywordExpansions × languages` per core keyword
- Filtering: Uses expanded keywords via DataView API
- Scoring: Uses core keywords for match percentage
- Weighting: Conditional coefficients based on query and sort
- Sorting: Multi-criteria sorting with weighted relevance scores

**Status:** ✅ Fully implemented and ready for testing
