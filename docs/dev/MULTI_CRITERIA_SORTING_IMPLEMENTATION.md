# Multi-Criteria Sorting System Implementation

**Date:** 2024-10-17  
**Status:** ✅ Completed and Tested

## Overview

Implemented a comprehensive multi-criteria sorting system that allows users to configure multiple sort criteria in priority order for different modes and contexts. This addresses the need for more sophisticated task organization beyond single-criterion sorting.

## Motivation

### Problems Solved

1. **Single-criterion limitation**: Previously, tasks could only be sorted by ONE criterion (relevance, dueDate, priority, etc.), leading to random/undefined ordering when many tasks matched

2. **Same sorting for different contexts**: Tasks sent to AI used the same sort order as display, even though AI might benefit from different ordering (e.g., relevance + priority + dueDate)

3. **Limited flexibility**: Users couldn't customize sort priority chains (e.g., "sort by dueDate first, then priority, then relevance")

4. **Suboptimal AI context**: When many tasks match a query, the order sent to AI significantly impacts response quality

## Solution Architecture

### Multi-Criteria Sorting Logic

Tasks are now sorted by applying criteria sequentially:
1. Apply first criterion (primary sort)
2. When tasks tie, apply second criterion (secondary sort)
3. Continue until all criteria exhausted or difference found

Example: `["relevance", "dueDate", "priority"]`
- First sorts by relevance score (highest first)
- Tasks with same relevance score are then sorted by due date
- Tasks with same relevance AND due date are sorted by priority

### Separate Sort Configurations

**Four independent sort configurations:**

1. **Simple Search Display**: `taskSortOrderSimple`
   - Default: `["relevance", "dueDate", "priority"]`
   - Used for displaying Simple Search results

2. **Smart Search Display**: `taskSortOrderSmart`
   - Default: `["relevance", "dueDate", "priority"]`
   - Used for displaying Smart Search results (AI-expanded keywords)

3. **Task Chat Display**: `taskSortOrderChat`
   - Default: `["auto", "dueDate", "priority"]`
   - Used for displaying results to user in Chat mode
   - "auto" resolves to "relevance" for keyword searches, "dueDate" otherwise

4. **Task Chat AI Context**: `taskSortOrderChatAI`
   - Default: `["relevance", "priority", "dueDate"]`
   - Used for ordering tasks SENT TO AI for analysis
   - Prioritizes most relevant and urgent tasks for AI understanding
   - Can differ from display order for optimal AI performance

## Implementation Details

### 1. Settings Type System (`src/settings.ts`)

```typescript
// New type for sort criteria
export type SortCriterion =
    | "relevance"  // Keyword relevance score
    | "dueDate"    // Due date (overdue tasks first in asc mode)
    | "priority"   // Priority level (1=highest, 4=lowest)
    | "created"    // Creation date
    | "alphabetical" // Alphabetical by task text
    | "auto";      // AI-driven (resolves to relevance or dueDate)

// New multi-criteria settings
export interface PluginSettings {
    // ... existing settings ...
    
    // Multi-criteria sorting arrays
    taskSortOrderSimple: SortCriterion[];
    taskSortOrderSmart: SortCriterion[];
    taskSortOrderChat: SortCriterion[];
    taskSortOrderChatAI: SortCriterion[];
    
    // Legacy single-criterion (kept for backward compatibility)
    taskSortBySimple: string;
    taskSortBySmart: string;
    taskSortByChat: string;
    taskSortDirection: "asc" | "desc";
}
```

### 2. Sort Service (`src/services/taskSortService.ts`)

```typescript
class TaskSortService {
    /**
     * Multi-criteria sorting - NEW primary method
     */
    static sortTasksMultiCriteria(
        tasks: Task[],
        sortOrder: SortCriterion[],
        sortDirection: "asc" | "desc" = "asc",
        relevanceScores?: Map<string, number>,
    ): Task[] {
        // Filters out "auto" (should be resolved before calling)
        // Applies criteria in sequence until difference found
        // Relevance always DESC (higher scores first)
        // Other criteria respect sortDirection parameter
    }
    
    /**
     * Single-criterion sorting - LEGACY method
     * Kept for backward compatibility
     */
    static sortTasks(...): Task[] { ... }
}
```

### 3. AI Service Integration (`src/services/aiService.ts`)

**Key changes:**

```typescript
// Get mode-specific sort orders
let displaySortOrder: SortCriterion[];
let aiContextSortOrder: SortCriterion[];

switch (chatMode) {
    case "simple":
        displaySortOrder = settings.taskSortOrderSimple;
        aiContextSortOrder = settings.taskSortOrderSimple;
        break;
    case "smart":
        displaySortOrder = settings.taskSortOrderSmart;
        aiContextSortOrder = settings.taskSortOrderSmart;
        break;
    case "chat":
        displaySortOrder = settings.taskSortOrderChat;
        aiContextSortOrder = settings.taskSortOrderChatAI; // Different!
        break;
}

// Build relevance scores for keyword searches
let relevanceScores: Map<string, number> | undefined;
if (intent.keywords && intent.keywords.length > 0) {
    const scoredTasks = TaskSearchService.scoreTasksByRelevance(
        qualityFilteredTasks,
        intent.keywords,
    );
    relevanceScores = new Map(
        scoredTasks.map((st) => [st.task.id, st.score]),
    );
}

// Resolve "auto" criteria
const resolvedDisplaySortOrder = displaySortOrder.map((criterion) => {
    if (criterion === "auto") {
        return intent.keywords?.length > 0 ? "relevance" : "dueDate";
    }
    return criterion;
}) as SortCriterion[];

// Sort for display
const sortedTasksForDisplay = TaskSortService.sortTasksMultiCriteria(
    qualityFilteredTasks,
    resolvedDisplaySortOrder,
    settings.taskSortDirection,
    relevanceScores,
);

// For Chat mode: Sort differently for AI context
const resolvedAIContextSortOrder = aiContextSortOrder.map(...);
const sortedTasksForAI = TaskSortService.sortTasksMultiCriteria(
    qualityFilteredTasks,
    resolvedAIContextSortOrder,
    settings.taskSortDirection,
    relevanceScores,
);
```

### 4. Settings UI (`src/settingsTab.ts`)

**Interactive multi-criteria editor with:**

- **Visual order display**: Each criterion shows position (1., 2., 3., etc.)
- **Reorder buttons**: ↑↓ arrows to move criteria up/down
- **Remove button**: ✕ to remove criteria (minimum 1 must remain)
- **Add dropdown**: + button with dropdown to add available criteria
- **Real-time preview**: Shows current sort chain immediately

**Methods:**
- `renderMultiCriteriaSortSetting()`: Renders one sort configuration
- `getCriterionDisplayName()`: Maps criterion to friendly name
- `getAvailableCriteria()`: Filters out already-used criteria

### 5. Styling (`styles.css`)

```css
/* Multi-criteria sort containers */
.task-chat-sort-criteria-container { ... }
.task-chat-sort-criterion { ... }
.task-chat-sort-order { ... }
.task-chat-sort-name { ... }
.task-chat-sort-buttons { ... }
.task-chat-sort-add-container { ... }
```

## Default Configurations

### Simple Search
```
["relevance", "dueDate", "priority"]
```
- Best match first
- Then by urgency (overdue tasks)
- Then by importance

### Smart Search
```
["relevance", "dueDate", "priority"]
```
- Same as Simple (AI-expanded keywords, same display logic)

### Task Chat (Display)
```
["auto", "dueDate", "priority"]
```
- Auto intelligently picks relevance vs. dueDate
- Then urgency
- Then importance

### Task Chat (AI Context)
```
["relevance", "priority", "dueDate"]
```
- Most relevant first (what user asked about)
- Then importance (high-priority tasks)
- Then urgency (overdue/soon tasks)
- **Rationale**: AI should see most relevant + important tasks first for better recommendations

## Benefits

### 1. Better Task Organization
- Tasks with similar primary scores are further organized by secondary/tertiary criteria
- No more random ordering for tied tasks

### 2. Optimized AI Performance
- AI receives tasks in optimal order for understanding context
- Display order can differ from AI context order
- Example: Display by due date for user urgency, but send by relevance to AI for better analysis

### 3. User Flexibility
- Users can customize sort chains per mode
- Can add/remove/reorder criteria as needed
- Can have 1-6 criteria in any order

### 4. Backward Compatibility
- Old single-criterion settings still exist in data
- New multi-criteria settings have smart defaults
- Gradual migration path for existing users

## Usage Examples

### Example 1: User wants "overdue first, then priority"
**Configuration:**
```
["dueDate", "priority", "relevance"]
```
**Result:**
1. All overdue tasks (sorted by priority among overdue)
2. Today's tasks (sorted by priority)
3. Future tasks (sorted by priority)

### Example 2: AI optimal for project planning
**Display:** `["dueDate", "priority", "relevance"]`  
**AI Context:** `["relevance", "priority", "created"]`

User sees tasks by urgency, but AI receives them by query relevance + importance + recency for better project planning advice.

### Example 3: Keyword search with many results
**Query:** "write documentation"  
**Sort:** `["relevance", "priority", "dueDate"]`

**Result:**
1. Tasks that most closely match "write documentation" (high relevance)
2. Among matching tasks, high-priority ones first
3. Among same priority, overdue/urgent ones first

## Testing Checklist

✅ Build completes without errors  
✅ TypeScript types are correct  
✅ Settings serialize/deserialize properly  
✅ UI renders correctly with default values  
✅ Add/remove/reorder controls work  
✅ Multi-criteria sorting logic is sound  
✅ Relevance scores are properly passed  
✅ "auto" criterion resolves correctly  
✅ Separate display/AI sorting works  
✅ CSS styling is consistent with theme  

## Migration Notes

**Existing users:**
- Old `taskSortBySimple/Smart/Chat` settings remain in data
- New `taskSortOrderSimple/Smart/Chat/ChatAI` arrays use smart defaults
- Plugin uses new multi-criteria system, old settings are legacy
- No data loss or breaking changes

**New users:**
- Get optimal default multi-criteria configurations
- Can customize immediately through Settings UI

## Performance Considerations

- Multi-criteria sorting has O(n log n) complexity (same as single-criterion)
- Relevance score map lookup is O(1) per task
- No significant performance impact vs. old system
- Tested with 1000+ tasks, no noticeable slowdown

## Future Enhancements

Potential improvements for future versions:

1. **Drag-and-drop reordering**: Visual drag handles instead of ↑↓ buttons
2. **Per-criterion sort direction**: Allow mixing asc/desc (e.g., relevance DESC, dueDate ASC)
3. **Preset configurations**: Quick templates like "Urgency First" or "AI Optimal"
4. **Smart suggestions**: Recommend sort orders based on query type
5. **Export/import configurations**: Share sort configurations between devices

## Code Quality

- ✅ Follows existing code style and patterns
- ✅ Uses TypeScript types properly
- ✅ Respects Obsidian plugin guidelines
- ✅ No inline styles (all CSS in styles.css)
- ✅ Sentence case in all UI text
- ✅ Comprehensive comments and documentation
- ✅ No breaking changes to existing functionality

## Conclusion

The multi-criteria sorting system significantly improves task organization and AI performance without adding complexity for users who don't need it. Smart defaults ensure good experience out-of-the-box, while power users can fine-tune sort behavior per mode and context.

This implementation addresses the core concern: **when filtering results in many tasks, having multiple sort criteria ensures consistent, meaningful ordering that benefits both display and AI analysis.**
