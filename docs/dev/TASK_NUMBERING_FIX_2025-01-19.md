# Task Numbering Fix - January 19, 2025

## Issue
The AI's recommended tasks had inconsistent numbering where some `[TASK_X]` references were correctly replaced with "Task N" while others remained unreplaced, resulting in mixed output like:
- Task 1, Task 3, `[TASK_8]`, Task 5, `[TASK_30]`, Task 8, `[TASK_33]`, `[TASK_34]`

## Root Cause
The `replaceTaskReferences` function used `findIndex` to locate each recommended task in the original task array to determine its ID. When **duplicate tasks** existed (same text, same file, same line), `findIndex` always returned the **first occurrence**, causing:

1. Incorrect mappings (Task A at index 7 mapped to index 6)
2. Overwritten mappings (later tasks overwriting earlier ones)
3. Incomplete `taskIdToPosition` map (missing mappings for tasks referenced by AI)

### Example Problem
```
allTasks[6] = "Test implementing..." (TASK_7)
allTasks[7] = "Test implementing..." (TASK_8) - duplicate

recommendedTasks = [TASK_7, TASK_8, ...]

When building map:
- Position 0: findIndex finds 6 → maps [TASK_7] -> Task 1 ✓
- Position 1: findIndex finds 6 again → maps [TASK_7] -> Task 2 ✗ (overwrites!)
- TASK_8 never gets mapped!
```

## Solution
Modified the code to **track original indices** during task extraction and pass them directly to the replacement function:

### Changes Made

1. **`extractRecommendedTasks` return type**: Changed from `Task[]` to `{ tasks: Task[]; indices: number[] }`
   - Now returns both the tasks and their original indices in the `allTasks` array

2. **Track indices during extraction**: Added `recommendedIndices` array that stores the original index for each recommended task

3. **Simplified `replaceTaskReferences`**: 
   - Changed signature from `(response, recommendedTasks, allTasks)` to `(response, recommendedIndices)`
   - Directly maps: `originalIndex + 1` → `displayPosition + 1`
   - No longer uses `findIndex`, avoiding the duplicate task issue

4. **Updated caller**: Destructures result and passes indices:
   ```typescript
   const { tasks: recommendedTasks, indices: recommendedIndices } = 
       this.extractRecommendedTasks(...);
   
   const processedResponse = this.replaceTaskReferences(
       response,
       recommendedIndices,
   );
   ```

## Benefits
- ✅ Correct 1:1 mapping between `[TASK_X]` and display positions
- ✅ Handles duplicate tasks correctly
- ✅ More efficient (no repeated `findIndex` searches)
- ✅ Simpler logic with fewer potential failure points

## Files Modified
- `/src/services/aiService.ts`
  - Lines 1383-1395: Updated `extractRecommendedTasks` signature and initialization
  - Lines 1440: Track indices when adding recommended tasks
  - Lines 1497, 1523: Update return statements to include indices
  - Lines 1536-1549: Simplified `replaceTaskReferences` to use indices directly
  - Lines 675-691: Updated caller to destructure and use indices

## Verification
- Build successful: `npm run build` completed without errors
- Type checking passed
- All lint errors resolved
