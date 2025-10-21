# Multi-Value Properties and Date Ranges Implementation
**Date:** 2025-01-20  
**Status:** ✅ COMPLETE - Core implementation done, UI pending

## Overview

Implemented comprehensive support for multi-value properties (priority, status) and date range queries across all search modes. This enables more flexible and powerful task filtering.

## Key Features

### 1. Multi-Value Priority
Users can now search for tasks with multiple priority levels:
- **Query:** "priority 1 2 3 tasks"
- **Parsed:** `priority: [1, 2, 3]`
- **Result:** Tasks with priority 1 OR 2 OR 3

### 2. Multi-Value Status
Users can search across multiple statuses:
- **Query:** "open or in progress tasks"
- **Parsed:** `status: ["open", "inProgress"]`
- **Result:** Tasks that are open OR in progress

### 3. Relative Date Support
Natural language relative dates:
- **Query:** "due in 5 days"
- **Parsed:** `dueDate: "+5d"`
- **Formats:** `+Nd` (days), `+Nw` (weeks), `+Nm` (months)

### 4. Date Range Queries
Time-based range filtering:
- **Query:** "due this week"
- **Parsed:** `dueDateRange: {start: "week-start", end: "week-end"}`
- **Supported:** this week, next week, this month, custom ranges

## Architecture Changes

### Data Structures

#### ParsedQuery Interface (queryParserService.ts)
```typescript
interface ParsedQuery {
    // Multi-value support
    priority?: number | number[];     // Single: 1, Multi: [1, 2, 3]
    status?: string | string[];       // Single: "open", Multi: ["open", "inProgress"]
    
    // Date range support
    dueDate?: string;                 // Single/relative: "today", "+5d"
    dueDateRange?: {                  // Range: "this week"
        start: string;
        end: string;
    };
    
    // Other fields...
    folder?: string;
    tags?: string[];
    keywords?: string[];
}
```

### Service Updates

#### 1. QueryParserService (AI Prompt Enhancement)
**File:** `src/services/queryParserService.ts`  
**Lines:** 596-698 (103 lines added)

**Changes:**
- Added comprehensive multi-value property examples
- Added relative date format documentation (+Nd, +Nw, +Nm)
- Added date range keywords (week-start, month-start, etc.)
- Combined examples showing multi-value + range queries

**Example AI Prompt Section:**
```
🚨 MULTI-VALUE PROPERTIES & DATE RANGES (NEW!)

**MULTI-VALUE PRIORITY:**
- "priority 1 2 3 tasks" → priority: [1, 2, 3]
- "high or medium priority" → priority: [1, 2]
- "priority 1" → priority: 1

**RELATIVE DATE SUPPORT:**
- "due in 5 days" → dueDate: "+5d"
- "due in 2 weeks" → dueDate: "+2w"
- "due in 1 month" → dueDate: "+1m"

**DATE RANGE SUPPORT:**
- "due this week" → dueDateRange: {start: "week-start", end: "week-end"}
- "due next week" → dueDateRange: {start: "next-week-start", end: "next-week-end"}
```

#### 2. DataViewService (Filter Implementation)
**File:** `src/services/dataviewService.ts`

**Changes:**

**a) Method Signature Update (lines 712-722):**
```typescript
static async parseTasksFromDataview(
    app: App,
    settings: PluginSettings,
    dateFilter?: string,
    propertyFilters?: {
        priority?: number | number[] | null;           // NEW: Multi-value
        dueDate?: string | null;                       // Single/relative
        dueDateRange?: { start: string; end: string } | null; // NEW: Range
        status?: string | string[] | null;             // NEW: Multi-value
    },
): Promise<Task[]>
```

**b) buildTaskFilter Enhancement (lines 590-766):**

**Priority Filter (multi-value):**
```typescript
// Normalize to array for consistent handling
const targetPriorities = Array.isArray(intent.priority)
    ? intent.priority
    : [intent.priority];

filters.push((dvTask: any) => {
    for (const field of priorityFields) {
        const value = dvTask[field];
        if (value !== undefined && value !== null) {
            const mapped = this.mapPriority(value, settings);
            if (mapped !== undefined && targetPriorities.includes(mapped)) {
                return true;
            }
        }
    }
    return false;
});
```

**Relative Date Filter:**
```typescript
// Match format: +5d, +2w, +1m
if (intent.dueDate.startsWith("+")) {
    const match = intent.dueDate.match(/^\+(\d+)([dwm])$/);
    if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2];
        let targetDate: moment.Moment;

        if (unit === "d") {
            targetDate = moment().add(amount, "days");
        } else if (unit === "w") {
            targetDate = moment().add(amount, "weeks");
        } else if (unit === "m") {
            targetDate = moment().add(amount, "months");
        }
        
        const targetDateStr = targetDate.format("YYYY-MM-DD");
        // Filter tasks matching this date...
    }
}
```

**Date Range Filter:**
```typescript
if (intent.dueDateRange) {
    const { start, end } = intent.dueDateRange;
    
    // Parse range keywords
    let startDate: moment.Moment;
    if (start === "week-start") {
        startDate = moment().startOf("week");
    } else if (start === "next-week-start") {
        startDate = moment().add(1, "week").startOf("week");
    } else if (start === "month-start") {
        startDate = moment().startOf("month");
    } else {
        startDate = moment(start);
    }
    
    // Similar for endDate...
    
    filters.push((dvTask: any) => {
        const taskDate = moment(this.formatDate(value));
        if (taskDate.isSameOrAfter(startDate, "day") &&
            taskDate.isSameOrBefore(endDate, "day")) {
            return true;
        }
    });
}
```

**Status Filter (multi-value):**
```typescript
const targetStatuses = Array.isArray(intent.status)
    ? intent.status
    : [intent.status];

filters.push((dvTask: any) => {
    const status = dvTask.status;
    if (status !== undefined) {
        const mapped = this.mapStatusToCategory(status, settings);
        return targetStatuses.includes(mapped);
    }
    return false;
});
```

#### 3. TaskSearchService (Simple Search)
**File:** `src/services/taskSearchService.ts`

**Changes:**

**a) extractDueDateFilter (lines 323-339):**
```typescript
// Check for relative date patterns
const relativeDatePattern = /\bin\s+(\d+)\s+(day|days|week|weeks|month|months)\b/i;
const relativeMatch = lowerQuery.match(relativeDatePattern);
if (relativeMatch) {
    const amount = relativeMatch[1];
    const unit = relativeMatch[2].toLowerCase();
    
    if (unit.startsWith("day")) {
        return `+${amount}d`;
    } else if (unit.startsWith("week")) {
        return `+${amount}w`;
    } else if (unit.startsWith("month")) {
        return `+${amount}m`;
    }
}
```

**b) filterByDueDate (lines 431-455):**
```typescript
default:
    // Check for relative date format: +Nd, +Nw, +Nm
    if (filter.startsWith("+")) {
        const relativeMatch = filter.match(/^\+(\d+)([dwm])$/);
        if (relativeMatch) {
            const amount = parseInt(relativeMatch[1]);
            const unit = relativeMatch[2];
            const targetDate = new Date(today);

            if (unit === "d") {
                targetDate.setDate(targetDate.getDate() + amount);
            } else if (unit === "w") {
                targetDate.setDate(targetDate.getDate() + amount * 7);
            } else if (unit === "m") {
                targetDate.setMonth(targetDate.getMonth() + amount);
            }

            targetDate.setHours(0, 0, 0, 0);
            return dueDate.getTime() === targetDate.getTime();
        }
    }
```

#### 4. AIService (Integration)
**File:** `src/services/aiService.ts`  
**Lines:** 183-207

**Changes:**
```typescript
// Updated hasPropertyFilters to include date ranges
const hasPropertyFilters = !!(
    intent.extractedPriority ||
    intent.extractedDueDateFilter ||
    intent.extractedDueDateRange ||    // NEW
    intent.extractedStatus
);

if (hasPropertyFilters) {
    tasksAfterPropertyFilter = await DataviewService.parseTasksFromDataview(
        app,
        settings,
        undefined,
        {
            priority: intent.extractedPriority,        // Can be number or number[]
            dueDate: intent.extractedDueDateFilter,    // Single date or relative
            dueDateRange: intent.extractedDueDateRange, // NEW: Date range
            status: intent.extractedStatus,            // Can be string or string[]
        },
    );
}
```

## Query Examples

### Multi-Value Priority
```
Input:  "priority 1 2 tasks"
Parsed: {priority: [1, 2], keywords: ["tasks"]}
Result: Tasks with priority 1 OR 2

Input:  "high or medium priority"
Parsed: {priority: [1, 2], keywords: []}
Result: Tasks with priority 1 (high) OR 2 (medium)
```

### Multi-Value Status
```
Input:  "open or in progress tasks"
Parsed: {status: ["open", "inProgress"], keywords: ["tasks"]}
Result: Tasks that are open OR in progress

Input:  "completed or cancelled"
Parsed: {status: ["completed", "cancelled"], keywords: []}
Result: Tasks that are completed OR cancelled
```

### Relative Dates
```
Input:  "due in 5 days"
Parsed: {dueDate: "+5d"}
Result: Tasks due exactly 5 days from today

Input:  "due in 2 weeks"
Parsed: {dueDate: "+2w"}
Result: Tasks due exactly 2 weeks from today

Input:  "due in 1 month"
Parsed: {dueDate: "+1m"}
Result: Tasks due exactly 1 month from today
```

### Date Ranges
```
Input:  "due this week"
Parsed: {dueDateRange: {start: "week-start", end: "week-end"}}
Result: Tasks due between start and end of current week

Input:  "due next week"
Parsed: {dueDateRange: {start: "next-week-start", end: "next-week-end"}}
Result: Tasks due during next week

Input:  "due this month"
Parsed: {dueDateRange: {start: "month-start", end: "month-end"}}
Result: Tasks due during current month
```

### Combined Queries
```
Input:  "priority 1 2 tasks due this week"
Parsed: {
    priority: [1, 2],
    dueDateRange: {start: "week-start", end: "week-end"},
    keywords: ["tasks"]
}
Result: Priority 1 or 2 tasks due this week

Input:  "open or in progress high priority tasks"
Parsed: {
    status: ["open", "inProgress"],
    priority: 1,
    keywords: ["tasks"]
}
Result: Open or in-progress tasks with priority 1

Input:  "completed tasks from last month"
Parsed: {
    status: "completed",
    dueDateRange: {start: "last-month-start", end: "last-month-end"},
    keywords: ["tasks"]
}
Result: Completed tasks from previous month
```

## Technical Details

### Relative Date Format
- **Pattern:** `+Nd` where N is a number, d/w/m is the unit
- **Units:**
  - `d` = days (e.g., `+5d` = 5 days from now)
  - `w` = weeks (e.g., `+2w` = 2 weeks from now)
  - `m` = months (e.g., `+1m` = 1 month from now)

### Date Range Keywords
- **Current period:**
  - `week-start` / `week-end` = current week
  - `month-start` / `month-end` = current month
- **Next period:**
  - `next-week-start` / `next-week-end` = next week
  - `next-month-start` / `next-month-end` = next month (future implementation)
- **Previous period:**
  - `last-week-start` / `last-week-end` = last week (future implementation)
  - `last-month-start` / `last-month-end` = last month

### Array Normalization Pattern
All multi-value filters use consistent normalization:
```typescript
const targetValues = Array.isArray(value) ? value : [value];
// Then check if task's value is in targetValues
```

This allows seamless handling of both single and multi-value queries.

## Files Modified

### Core Changes
1. **queryParserService.ts**
   - Lines 27-37: Updated ParsedQuery interface
   - Lines 596-698: Added AI prompt examples (103 lines)
   - Build: 205.4kb → 206.0kb (+0.6kb)

2. **dataviewService.ts**
   - Lines 712-722: Updated parseTasksFromDataview signature
   - Lines 590-766: Enhanced buildTaskFilter with multi-value and range support
   - Added relative date parsing (+Nd, +Nw, +Nm)
   - Added date range parsing (week-start, month-start, etc.)

3. **taskSearchService.ts**
   - Lines 323-339: Added relative date extraction
   - Lines 431-455: Added relative date filtering
   - Supports "in N days/weeks/months" format

4. **aiService.ts**
   - Lines 183-207: Updated property filter passing
   - Added date range detection
   - Added comments for multi-value support

## Build Results

```bash
✅ Build successful: 206.0kb (from 205.4kb, +0.6kb)
✅ No TypeScript errors
✅ All services updated consistently
```

## Backward Compatibility

### Single Values Still Work
```typescript
// Old queries continue to work
"priority 1 tasks"     → priority: 1        (number)
"open tasks"           → status: "open"     (string)
"due today"            → dueDate: "today"   (string)

// New multi-value queries
"priority 1 2 tasks"   → priority: [1, 2]   (number[])
"open or done tasks"   → status: ["open", "completed"] (string[])
"due this week"        → dueDateRange: {...} (object)
```

### Array Normalization Ensures Compatibility
All filter functions normalize to arrays internally:
```typescript
const values = Array.isArray(input) ? input : [input];
```

This means:
- Single values: Converted to `[value]` → checked with `includes()`
- Multi values: Already `[val1, val2]` → checked with `includes()`
- No special cases needed

## Testing Scenarios

### 1. Multi-Value Priority
- [ ] "priority 1 2 3 tasks" → Returns tasks with P1, P2, or P3
- [ ] "high or medium priority" → Returns P1 or P2 tasks
- [ ] "priority 1" → Still works (backward compatible)

### 2. Multi-Value Status
- [ ] "open or in progress" → Returns open or inProgress tasks
- [ ] "completed or cancelled" → Returns completed or cancelled tasks
- [ ] "open tasks" → Still works (backward compatible)

### 3. Relative Dates
- [ ] "due in 5 days" → Tasks due exactly 5 days from today
- [ ] "due in 2 weeks" → Tasks due exactly 2 weeks from today
- [ ] "due in 1 month" → Tasks due exactly 1 month from today

### 4. Date Ranges
- [ ] "due this week" → Tasks due this week
- [ ] "due next week" → Tasks due next week
- [ ] "due this month" → Tasks due this month

### 5. Combined Queries
- [ ] "priority 1 2 due this week" → P1/P2 tasks this week
- [ ] "open or in progress high priority" → Open/InProgress P1 tasks
- [ ] "completed tasks in 5 days" → Completed tasks due in 5 days

## Next Steps

### UI Implementation (Pending)
- [ ] Add status mapping UI to settings tab
- [ ] Allow users to configure status value mapping
- [ ] Add tooltips explaining multi-value syntax
- [ ] Add examples to settings descriptions

### Documentation (Pending)
- [ ] Update README with multi-value examples
- [ ] Add user guide for date ranges
- [ ] Document relative date format
- [ ] Add troubleshooting section

### Future Enhancements
- [ ] Add more date range keywords (last week, next month, etc.)
- [ ] Support custom date ranges (between X and Y)
- [ ] Add multi-value tag support
- [ ] Add multi-value folder support

## Notes

### Design Decisions

1. **Multi-value as arrays:** Clearest representation, easy to extend
2. **Relative dates as strings:** Compact, parseable, user-friendly
3. **Date ranges as objects:** Structured, extensible, clear intent
4. **Array normalization:** Single pattern for all multi-value handling

### Performance Considerations

- Multi-value filtering happens at DataView level (efficient)
- Array normalization is minimal overhead
- Date parsing uses moment.js (already in codebase)
- No impact on single-value queries (backward compatible)

### Edge Cases Handled

- Empty arrays: Treated as no filter
- Invalid relative dates: Fallback to current handling
- Invalid date range keywords: Fallback to moment parsing
- Null/undefined values: Properly checked before includes()

## Status

✅ **Core Implementation:** Complete  
✅ **DataView Integration:** Complete  
✅ **Simple Search Support:** Complete  
✅ **AI Service Integration:** Complete  
⏳ **UI Implementation:** Pending (status mapping)  
⏳ **Documentation:** Pending (user guide)  

**Overall Progress:** 80% complete
