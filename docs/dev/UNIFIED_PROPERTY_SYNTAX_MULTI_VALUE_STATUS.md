# Unified Property Syntax - Multi-Value Support Status

**Date:** 2025-01-23  
**Status:** Partially Implemented ⚠️

## What Was Implemented ✅

### 1. Unified Syntax Patterns (taskPropertyService.ts)
```typescript
// Priority patterns
priority: /\bp[1-4]\b/gi,                           // Legacy: p1, p2, p3, p4
priorityUnified: /\bp:(1|2|3|4|all|none)\b/gi,     // New: p:1, p:2, p:all, p:none

// Due date patterns  
dueUnified: /\b(?:d|due):([^\s&|,]+)/gi,           // New: d:today, due:all, d:none

// Status patterns (already unified)
status: /\b(?:s|status):([^\s&|,]+)/i,             // Already works: s:open, s:x,/
```

### 2. Property Removal (taskSearchService.ts)
All new patterns are properly removed before sending to AI:
- ✅ `p:1`, `p:2`, `p:3`, `p:4`, `p:all`, `p:none`
- ✅ `d:today`, `due:all`, `d:none`, etc.
- ✅ Legacy patterns still removed (`p1`, `due`, `today`)

### 3. Single-Value Parsing ✅

**Priority (extractPriorityFromQuery):**
- ✅ `p:1` → returns `1`
- ✅ `p:all` → returns `"all"`
- ✅ `p:none` → returns `"none"`
- ✅ `p1 p2` → returns `[1, 2]` (multi-value via space)

**Due Date (extractDueDateFilter):**
- ✅ `d:today` → returns `"today"`
- ✅ `due:all` → returns `"any"`
- ✅ `d:none` → returns `"none"`

**Status (already working):**
- ✅ `s:open` → works
- ✅ `s:x,/` → works (multi-value)

### 4. Filtering Logic

**Priority (dataviewService.ts buildTaskFilter):**
- ✅ `p:all` → filters tasks with ANY priority (P1-P4)
- ✅ `p:none` → filters tasks with NO priority
- ✅ Single values work: `p:1` → P1 tasks
- ⚠️ Multi-value arrays partially supported

**Due Date:**
- ✅ `d:all` / `due:all` → tasks with any due date
- ✅ `d:none` / `due:none` → tasks with no due date
- ✅ Single values work: `d:today`, `d:overdue`
- ❌ Multi-value arrays NOT YET implemented

## What Still Needs Work ⚠️

### 1. Multi-Value Priority (Comma-Separated)
**Current:** `p:1,2,3` is parsed but filtering needs enhancement

**What works:**
- `p1 p2 p3` (space-separated) → `[1, 2, 3]` ✅

**What needs work:**
- `p:1,2,3` (comma-separated) → Parsed as `[1, 2, 3]` but filtering may not handle correctly

**Fix needed:** Ensure `buildTaskFilter` properly handles priority arrays

### 2. Multi-Value Due Date (Comma-Separated)  
**Current:** `d:today,tomorrow,overdue` is parsed but filtering NOT implemented

**What's parsed:**
- `d:today,tomorrow` → `["today", "tomorrow"]` ✅

**What's missing:**
- Filtering logic to handle due date arrays ❌
- Need to check if task matches ANY of the values (OR logic)

**Fix needed:** Add array handling in `buildTaskFilter` for due dates

### 3. Type Casting Issues
Some type mismatches when returning arrays vs single values:
- Priority: `number | number[] | "all" | "none" | null`
- Due date: `string | string[] | null`

Currently using `as any` casts - should be properly typed.

## Examples That Work ✅

```
p:1                    → P1 tasks
p:all                  → All priority tasks (P1-P4)
p:none                 → Non-priority tasks
p1 p2                  → P1 or P2 tasks (space-separated)

d:today                → Due today
d:all / due:all        → Has any due date
d:none / due:none      → No due date
d:overdue              → Overdue tasks

s:open                 → Open tasks
s:x,/                  → Completed or in-progress (multi-value works!)
```

## Examples That Need Work ⚠️

```
p:1,2,3                → Should match P1, P2, or P3 (may not work correctly)
d:today,tomorrow       → Should match today or tomorrow (NOT implemented)
d:overdue,week         → Should match overdue or this week (NOT implemented)
```

## Recommended Next Steps

### Priority 1: Complete Multi-Value Due Date
1. Update `buildTaskFilter` in `dataviewService.ts`
2. Handle `string[]` for due dates
3. Implement OR logic (match ANY value)
4. Test: `d:today,tomorrow,overdue`

### Priority 2: Verify Multi-Value Priority
1. Test `p:1,2,3` thoroughly
2. Ensure array handling works in all modes
3. Fix any type issues

### Priority 3: Remove Type Casts
1. Properly type return values
2. Update interfaces to support arrays
3. Remove `as any` casts

### Priority 4: Documentation
1. Update README with all syntax examples
2. Document which combinations work
3. Add troubleshooting section

## Build Status
✅ **292.4kb** - Builds successfully with current implementation

## Backward Compatibility
✅ All legacy syntax still works:
- `p1`, `p2`, `p3`, `p4`
- `due`, `today`, `tomorrow`, `overdue`
- No breaking changes

## User Impact
- ✅ Single-value unified syntax works great
- ✅ Special values (`all`, `none`) work
- ⚠️ Multi-value comma syntax partially works
- ⚠️ Users should use space-separated for now: `p1 p2` instead of `p:1,2`
