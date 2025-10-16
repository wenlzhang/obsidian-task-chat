# Relevance Filtering Architecture

## Overview

This document explains the two-phase architecture for task filtering and sorting in Task Chat.

## Core Concept

**Relevance is a QUALITY FILTER, not a sort option.**

- **Quality Filter**: "Which tasks are good enough matches?" (relevance threshold)
- **Sort Preference**: "In what order should I display them?" (user's choice)

## Architecture: Two Distinct Phases

### Phase 1: Quality Filtering (Always Applied for Keyword Searches)

**Purpose**: Remove low-quality matches before any further processing

**When**: ALWAYS applied when query contains keywords, regardless of user's sort preference

**How**:
```typescript
// 1. Score all tasks by relevance
const scoredTasks = scoreTasksByRelevance(filteredTasks, keywords);

// 2. Determine adaptive threshold
let baseThreshold = settings.relevanceThreshold || adaptiveDefault;

// Adaptive adjustments:
// - 4+ keywords: base - 10 (more lenient)
// - 2-3 keywords: base (as-is)
// - 1 keyword: base + 10 (stricter)

// 3. Filter out low-quality matches
qualityFilteredTasks = scoredTasks.filter(score >= threshold);

// 4. Safety: Keep minimum if threshold too strict
if (qualityFilteredTasks.length < 5) {
    qualityFilteredTasks = top 20 by score;
}
```

**Respects User Settings**:
- `relevanceThreshold = 0`: Use system defaults (20/30/40 based on keyword count)
- `relevanceThreshold = 1-100`: Use as custom base, with adaptive adjustments

**Result**: Only quality matches proceed to Phase 2

### Phase 2: Sorting (Context-Dependent)

**Purpose**: Order tasks appropriately for the use case

**When**: After quality filtering

**Two Different Use Cases**:

#### 2a. For Direct Search Results (User Display)
- **Respects user's `taskSortBy` preference**
- Options: Auto, Relevance, Due Date, Priority, etc.
- Purpose: Display results in the order user prefers

```typescript
// User wants "Sort by Due Date"
// → Quality-filtered tasks, ordered by due date
// → User sees: Relevant tasks in chronological order ✓
```

#### 2b. For AI Input (Best Context)
- **Always prioritizes relevance** for keyword searches
- Purpose: Give AI the most relevant context first
- User's sort preference is for display, not AI input

```typescript
// User's query: "开发 Task Chat"
// → Quality filter: Keep high-relevance tasks
// → Sort for AI: By relevance (best matches first)
// → AI receives: Most relevant 30 tasks
// → AI provides: Intelligent recommendations ✓
```

## Why This Matters

### Problem Before
```
Filter (526 tasks) → Sort by Due Date → Take top 30
→ AI receives: Oldest 30 tasks (mostly 2021 test data)
→ AI response: "I can't help, tasks not relevant" ❌
```

### Solution After
```
Filter (526 tasks) → Quality Filter (→ 80 relevant) → Sort by Relevance → Take top 30
→ AI receives: 30 most relevant tasks
→ AI response: Useful recommendations ✓
```

## Key Features Preserved

1. **Adaptive Thresholding**: 
   - Base threshold respects user settings
   - Intelligent adjustments (±10) based on keyword count
   - Safety fallback if too strict

2. **User Control**:
   - `relevanceThreshold = 0`: Smart defaults
   - `relevanceThreshold = custom`: Your preference + adaptive intelligence

3. **Safety Mechanisms**:
   - Minimum result guarantee (keep top 20 if threshold filters out too many)
   - Early return with helpful message if no quality matches

4. **Dual Sorting Logic**:
   - **Direct search**: User's display preference (respect `taskSortBy`)
   - **AI analysis**: Relevance priority (best context for AI)

## Examples

### Example 1: Keyword Search with Custom Threshold

**Settings**:
- `relevanceThreshold = 50` (custom)
- `taskSortBy = "dueDate"` (user preference)

**Query**: "开发 Task Chat" (2 keywords)

**Process**:
```
1. Quality Filter:
   - Base: 50 (user setting)
   - Keywords: 2 → no adjustment (base as-is)
   - Final threshold: 50
   - Result: 526 → 45 tasks

2. Sorting for Direct Results:
   - User prefers: Due Date
   - Result: 45 tasks ordered by due date

3. Display:
   - User sees: Relevant tasks in chronological order ✓
```

### Example 2: Complex Query for AI Analysis

**Settings**:
- `relevanceThreshold = 0` (adaptive)
- `taskSortBy = "priority"` (user preference for display)

**Query**: "high priority tasks related to development workflow optimization" (4+ keywords)

**Process**:
```
1. Quality Filter:
   - Base: 20 (system default for 4+ keywords)
   - Keywords: 4+ → reduce by 10
   - Final threshold: 10
   - Result: 200 → 120 tasks

2. Sorting for AI Input:
   - Purpose: Best context for AI
   - Method: Sort by relevance (ignore user's "priority" preference)
   - Result: Top 120 by relevance score

3. AI Analysis:
   - Receives: Top 30 most relevant tasks
   - Analyzes: High-quality context
   - Recommends: Intelligent task suggestions ✓

4. (If results were direct instead of AI):
   - Would use: Sort by priority (user preference)
   - Display: Relevant tasks ordered by priority
```

## Implementation Notes

### Location
- File: `src/services/aiService.ts`
- Methods: `sendMessage()` (two separate branches)

### Two Processing Paths

1. **AI Query Understanding Path** (Smart Search):
   - Line ~214-370
   - Quality filter → Sort for direct display → AI if needed

2. **Direct/Regex Parsing Path**:
   - Line ~457-615
   - Quality filter → Sort for AI → AI analysis

### Console Logging

The implementation includes detailed logging:
- `[Task Chat] Using default adaptive base: X (Y keywords)`
- `[Task Chat] Using user-defined base threshold: X`
- `[Task Chat] Quality filter threshold: X (base: Y, keywords: Z)`
- `[Task Chat] Quality filter applied: A → B tasks (threshold: X)`
- `[Task Chat] Direct search: Sorting by X` (for user display)
- `[Task Chat] AI input: Sorting by relevance` (for AI context)

## Design Principles

1. **Separation of Concerns**:
   - Quality filtering = Independent of display preference
   - Sorting = Context-dependent (display vs AI input)

2. **User Control with Intelligence**:
   - User sets base threshold
   - System applies adaptive adjustments
   - Safety mechanisms prevent edge cases

3. **Context-Appropriate Ordering**:
   - Direct results: User's preference
   - AI input: Relevance priority (better AI context)

4. **Fail-Safe Design**:
   - Adaptive defaults (0 = smart)
   - Minimum result guarantees
   - Helpful error messages

## Future Considerations

1. **Could add**: User option to control AI input sorting
2. **Could expose**: Adaptive adjustment factor (currently ±10)
3. **Could enhance**: Quality filter to consider other factors (priority, due date proximity)
4. **Could add**: User-visible "quality score" in results
