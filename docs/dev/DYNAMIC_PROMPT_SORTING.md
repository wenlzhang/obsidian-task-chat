# Dynamic Prompt Sorting Explanation

**Date:** 2024-10-17  
**Status:** ✅ Implemented  
**Build:** ✅ Success (114.7kb)

## Overview

The AI prompt now **dynamically adapts** to respect the user's actual sort configuration, instead of using a hardcoded explanation. This ensures AI always understands the real task ordering.

---

## Problem: Hardcoded Prompt

### Before

**Prompt always said:**
```
TASK ORDERING:
- Tasks are automatically sorted using multi-criteria sorting (relevance → due date → priority)
```

**But user might configure:**
```typescript
taskSortOrderChatAI: ["priority", "dueDate", "relevance"]  // Priority first!
```

**Result:** ❌ **Prompt lied to AI!** 
- Prompt says: "relevance → due date → priority"
- Actual sort: "priority → due date → relevance"
- AI gets confused about task ordering

---

## Solution: Dynamic Prompt Generation

### Implementation

**1. Pass actual sort order to prompt builder** (`aiService.ts` line 460):
```typescript
const messages = this.buildMessages(
    message,
    taskContext,
    chatHistory,
    settings,
    intent,
    resolvedAIContextSortOrder,  // ← User's actual configuration
);
```

**2. Helper function builds explanation** (`aiService.ts` lines 702-762):
```typescript
private static buildSortOrderExplanation(sortOrder: SortCriterion[]): string {
    // Convert ["priority", "dueDate", "relevance"] 
    // → "priority level → due date → keyword relevance"
    
    // Identify primary criterion
    // → "Priority (1=highest → 4=lowest)"
    
    // Build complete user-specific explanation
}
```

**3. Prompt uses dynamic explanation** (`aiService.ts` line 889):
```typescript
${this.buildSortOrderExplanation(sortOrder)}
```

---

## Examples: Different User Configurations

### Example 1: Default Configuration

**User Setting:**
```typescript
taskSortOrderChatAI: ["relevance", "dueDate", "priority"]
```

**AI Receives:**
```
TASK ORDERING (User-Configured):
- Tasks are sorted using multi-criteria sorting: keyword relevance → due date → priority level
- Primary sort: keyword relevance (best matches first)
- Earlier tasks in the list are MORE important based on this sorting
- [TASK_1] through [TASK_5] are typically the most critical
- When recommending tasks, prioritize earlier task IDs unless there's a specific reason not to
- Each criterion has smart defaults:
  * Relevance: Higher scores first (100 → 0)
  * Priority: Highest first (1 → 2 → 3 → 4, where 1 is highest)
  * Due date: Most urgent first (overdue → today → future)
  * Created: Newest first (recent → older)
  * Alphabetical: A → Z
```

**AI Behavior:**
- ✅ Knows relevance is primary
- ✅ Prioritizes high-relevance tasks
- ✅ Uses due date as tiebreaker

---

### Example 2: Priority-First Configuration

**User Setting:**
```typescript
taskSortOrderChatAI: ["priority", "dueDate", "relevance"]
```

**AI Receives:**
```
TASK ORDERING (User-Configured):
- Tasks are sorted using multi-criteria sorting: priority level → due date → keyword relevance
- Primary sort: priority (1=highest → 4=lowest)
- Earlier tasks in the list are MORE important based on this sorting
- [TASK_1] through [TASK_5] are typically the most critical
- When recommending tasks, prioritize earlier task IDs unless there's a specific reason not to
- Each criterion has smart defaults:
  * Relevance: Higher scores first (100 → 0)
  * Priority: Highest first (1 → 2 → 3 → 4, where 1 is highest)
  * Due date: Most urgent first (overdue → today → future)
  * Created: Newest first (recent → older)
  * Alphabetical: A → Z
```

**AI Behavior:**
- ✅ Knows priority is primary
- ✅ Prioritizes Priority 1 tasks
- ✅ Uses due date and relevance as tiebreakers

---

### Example 3: Due Date-First Configuration

**User Setting:**
```typescript
taskSortOrderChatAI: ["dueDate", "priority", "relevance"]
```

**AI Receives:**
```
TASK ORDERING (User-Configured):
- Tasks are sorted using multi-criteria sorting: due date → priority level → keyword relevance
- Primary sort: urgency (overdue → today → future)
- Earlier tasks in the list are MORE important based on this sorting
- [TASK_1] through [TASK_5] are typically the most critical
- When recommending tasks, prioritize earlier task IDs unless there's a specific reason not to
- Each criterion has smart defaults:
  * Relevance: Higher scores first (100 → 0)
  * Priority: Highest first (1 → 2 → 3 → 4, where 1 is highest)
  * Due date: Most urgent first (overdue → today → future)
  * Created: Newest first (recent → older)
  * Alphabetical: A → Z
```

**AI Behavior:**
- ✅ Knows urgency is primary
- ✅ Prioritizes overdue/today tasks
- ✅ Uses priority and relevance as tiebreakers

---

### Example 4: Single-Criterion Configuration

**User Setting:**
```typescript
taskSortOrderChatAI: ["priority"]
```

**AI Receives:**
```
TASK ORDERING (User-Configured):
- Tasks are sorted using multi-criteria sorting: priority level
- Primary sort: priority (1=highest → 4=lowest)
- Earlier tasks in the list are MORE important based on this sorting
- [TASK_1] through [TASK_5] are typically the most critical
- When recommending tasks, prioritize earlier task IDs unless there's a specific reason not to
- Each criterion has smart defaults:
  * Relevance: Higher scores first (100 → 0)
  * Priority: Highest first (1 → 2 → 3 → 4, where 1 is highest)
  * Due date: Most urgent first (overdue → today → future)
  * Created: Newest first (recent → older)
  * Alphabetical: A → Z
```

**AI Behavior:**
- ✅ Knows only priority matters
- ✅ Tasks with same priority are randomly ordered (no tiebreaker)

---

## Scenario: User Changes Configuration

### Real-World Example

**User's workflow evolution:**

**Phase 1: Learning (Default)**
```typescript
taskSortOrderChatAI: ["relevance", "dueDate", "priority"]
```
- User learns the system
- AI helps find relevant tasks
- ✅ Prompt: "keyword relevance → due date → priority level"

**Phase 2: Deadline-Driven (User customizes)**
```typescript
taskSortOrderChatAI: ["dueDate", "priority", "relevance"]
```
- User has urgent deadlines
- Wants overdue tasks first regardless of relevance
- ✅ Prompt: "urgency (overdue → today → future) → priority level → keyword relevance"

**Phase 3: Priority-Focused (User customizes again)**
```typescript
taskSortOrderChatAI: ["priority", "dueDate", "relevance"]
```
- User follows strict priority system
- High-priority tasks always first
- ✅ Prompt: "priority (1=highest → 4=lowest) → due date → keyword relevance"

**Key Point:** AI prompt **automatically adapts** to each phase without code changes!

---

## Benefits

### 1. Honesty ✅
- Prompt never lies about sort order
- AI always knows the truth
- No confusion about task ordering

### 2. Flexibility ✅
- Users can customize sort order anytime
- Prompt adapts automatically
- No manual prompt editing needed

### 3. Consistency ✅
- What user configures = what AI understands
- Code behavior matches AI understanding
- Reduces debugging confusion

### 4. User Empowerment ✅
- Users control AI's understanding of importance
- Can switch between workflows (urgency vs. priority vs. relevance)
- AI respects user's mental model

---

## Technical Details

### Code Flow

```typescript
// 1. User configures sort order
taskSortOrderChatAI: ["priority", "dueDate", "relevance"]

// 2. Code applies this sorting
const sortedTasksForAI = TaskSortService.sortTasksMultiCriteria(
    tasks,
    ["priority", "dueDate", "relevance"],  // User's config
    relevanceScores
);

// 3. Build dynamic prompt explanation
const sortExplanation = buildSortOrderExplanation(
    ["priority", "dueDate", "relevance"]  // Same config
);

// 4. AI receives accurate information
"Tasks are sorted: priority level → due date → keyword relevance"
"Primary sort: priority (1=highest → 4=lowest)"
```

### Human-Readable Mapping

| Criterion | Human-Readable | Primary Description |
|-----------|----------------|---------------------|
| `relevance` | "keyword relevance" | "keyword relevance (best matches first)" |
| `dueDate` | "due date" | "urgency (overdue → today → future)" |
| `priority` | "priority level" | "priority (1=highest → 4=lowest)" |
| `created` | "creation date" | "recency (newest → oldest)" |
| `alphabetical` | "alphabetical order" | "alphabetical order (A → Z)" |

### Smart Defaults Explanation

The prompt always includes:
```
- Each criterion has smart defaults:
  * Relevance: Higher scores first (100 → 0)
  * Priority: Highest first (1 → 2 → 3 → 4, where 1 is highest)
  * Due date: Most urgent first (overdue → today → future)
  * Created: Newest first (recent → older)
  * Alphabetical: A → Z
```

This ensures AI understands:
- Priority 1 always comes before Priority 4 (ASC)
- Overdue always comes before future (ASC)
- Relevance 100 always comes before 0 (DESC)
- etc.

---

## Comparison: Before vs. After

### Before: Hardcoded

**User sets:** `["priority", "dueDate", "relevance"]`  
**Prompt says:** "relevance → due date → priority" ❌  
**AI thinks:** Relevance is most important  
**Code does:** Priority is most important  
**Result:** Confusion and poor recommendations

### After: Dynamic

**User sets:** `["priority", "dueDate", "relevance"]`  
**Prompt says:** "priority level → due date → keyword relevance" ✅  
**AI thinks:** Priority is most important  
**Code does:** Priority is most important  
**Result:** Accurate understanding and good recommendations

---

## Future Enhancements

### Potential Improvements

1. **Visual indicator in settings UI**
   - Show preview of AI prompt when configuring sort order
   - Help users understand what AI will "think"

2. **Per-query prompt logging**
   - Console log the actual sort explanation sent to AI
   - Debug what AI understood

3. **Sort rationale in response**
   - AI could explain: "I prioritized [TASK_1] because it's Priority 1 (your primary sort criterion)"
   - Makes AI reasoning transparent

4. **Adaptive prompts**
   - If user consistently changes sort order, suggest optimal configuration
   - Learn user's workflow patterns

---

## Testing Matrix

| User Configuration | Prompt Accuracy | AI Understanding | Status |
|-------------------|-----------------|------------------|--------|
| `["relevance", "dueDate", "priority"]` | ✅ Correct | ✅ Accurate | ✅ Pass |
| `["priority", "dueDate", "relevance"]` | ✅ Correct | ✅ Accurate | ✅ Pass |
| `["dueDate", "priority", "relevance"]` | ✅ Correct | ✅ Accurate | ✅ Pass |
| `["priority"]` (single) | ✅ Correct | ✅ Accurate | ✅ Pass |
| `["created", "relevance"]` | ✅ Correct | ✅ Accurate | ✅ Pass |
| `["alphabetical", "dueDate", "priority"]` | ✅ Correct | ✅ Accurate | ✅ Pass |

---

## Conclusion

The dynamic prompt generation ensures:

✅ **Honesty:** AI always knows the real sort order  
✅ **Flexibility:** Users can change configuration anytime  
✅ **Consistency:** Code behavior matches AI understanding  
✅ **Simplicity:** Automatic adaptation, no manual work  

This resolves the conflict between user settings and AI prompts, making the system **truly user-configurable** without sacrificing AI quality.

**Build:** ✅ Success (114.7kb)  
**User Impact:** ✅ AI recommendations now respect user's sort preferences  
**Configuration:** ✅ Fully dynamic, no hardcoded values
