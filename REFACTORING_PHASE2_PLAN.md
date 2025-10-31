# Phase 2 Refactoring Plan: Task Processing Logic

## Analysis Summary

After analyzing `processDataviewTask` and `processDatacoreTask`, I found **~80% similarity** in logic.

### Common Logic (Can be Unified)

1. **Validation**: Both call `isValidTask()`
2. **Basic Field Extraction**: path, text, status, line, statusCategory, folder
3. **Priority Extraction**:
   - Check all possible priority field names
   - Fallback to emoji-based priority
4. **Date Extraction**: Due date, created date, completed date
5. **Tags Extraction**: Extract both task tags and note tags
6. **Task Object Construction**: Build identical Task object

### Key Differences (Source-Specific)

1. **Field Access Strategy**:
   - Dataview: `dvTask.visual || dvTask.text || dvTask.content`
   - Datacore: `dcTask.$text || dcTask.text`

2. **Built-in Field Priority**:
   - Datacore checks built-in fields first (`$priority`, `$due`, etc.)
   - Dataview doesn't have built-in fields

3. **Task ID Prefix**:
   - Dataview: `dataview-...`
   - Datacore: `datacore-...`

---

## Refactoring Strategy

### Option A: Complete Unification (Recommended)

Create `TaskPropertyService.processUnifiedTask()` that handles both sources.

**Benefits:**
- Eliminates ~140 lines of duplication
- Single source of truth for task processing
- Consistent behavior guaranteed

**Implementation:**
```typescript
static processUnifiedTask(
    task: any,
    settings: PluginSettings,
    index: number,
    filePath: string,
    pageTags: string[],
    source: TaskSource
): Task | null
```

The method would:
1. Use source-specific field access (already handled by `getUnifiedFieldValue`)
2. Use source-specific task ID prefix
3. Share all other logic

### Option B: Partial Unification

Extract only the **most duplicated logic** into helper methods:
- `extractTaskPriority()`
- `extractTaskDates()`
- `buildTaskObject()`

**Benefits:**
- Less risky than complete unification
- Incremental improvement

**Drawbacks:**
- Still maintains some duplication
- Services still need to orchestrate the calls

---

## Recommendation: Option A

**Rationale:**
1. We've already successfully unified field extraction and filtering
2. The differences are minimal and cleanly abstracted
3. Reduces maintenance burden significantly
4. Provides consistent behavior across sources

**Risk Assessment:**
- **Low Risk**: The logic is straightforward, well-tested by existing usage
- **Easy Rollback**: Services can revert to direct implementation if needed

---

## Status Mapping Analysis

### Current Duplication

Both services have:
```typescript
private static mapStatusToCategory(
    status: string,
    settings: PluginSettings
): TaskStatusCategory
```

These are **IDENTICAL** - perfect candidates for extraction.

Both services also have:
```typescript
private static mapPriority(
    priorityValue: any,
    settings: PluginSettings
): number | undefined
```

These are also **IDENTICAL**.

### Recommendation

Move these to TaskPropertyService:
- `TaskPropertyService.mapStatusToCategory()`
- `TaskPropertyService.mapPriority()`

**Already exists in TaskPropertyService!** Just need to update services to use them.

---

## Implementation Plan

### Step 1: Verify Existing Methods in TaskPropertyService

Check if `mapStatusToCategory` and `mapPriority` already exist centrally.

### Step 2: Create Unified Task Processing

Add `processUnifiedTask()` to TaskPropertyService.

### Step 3: Update Services to Delegate

Update both services to call the unified method.

### Step 4: Clean Up Duplicates

Remove old methods from both services.

### Step 5: Test

Run build and verify behavior.

---

## Expected Results

**Lines Removed:**
- dataviewService: ~140 lines
- datacoreService: ~150 lines
- **Total: ~290 lines**

**Bundle Size Reduction:**
- Estimated: ~5-7kb additional savings

**Maintenance Improvement:**
- **Critical**: Bug fixes and improvements apply to both sources automatically
- **Critical**: No risk of divergence between implementations
