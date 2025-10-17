# Task Recommendation Improvements - 2024-10-17

## Problem Summary

User identified three critical issues with Task Chat recommendations:

### 1. **Hard-coded minimum 10 auto-expansion**
- System forced exactly 10 recommendations even when AI only recommended 4
- Added irrelevant tasks that AI didn't consider worthy
- Example: AI recommended 4 tasks → system auto-expanded to 10 by adding next 6 highest-scored tasks

### 2. **Generic tasks score too high**
- Tasks with minimal content like "Task" got inflated relevance scores (166 in user's case)
- These generic placeholder tasks matched many keywords (task, work, item, etc.)
- Quality filtering wasn't strong enough to exclude them

### 3. **Weak prompt guidance**
- Prompt didn't strongly emphasize following sort order
- Didn't clearly communicate that earlier task IDs are more important
- Didn't emphasize comprehensive recommendations (AI was being too selective)

## Console Logs Showing the Problem

```
[Task Chat] AI explicitly recommended 4 tasks.
[Task Chat] AI only recommended 4 tasks, but 100 were analyzed.
[Task Chat] Auto-expanding to 10 tasks for comprehensive coverage.
[Task Chat] Added 6 additional high-relevance tasks.
```

**Top tasks sent to AI:**
```
[TASK_1]: Task                                    ← Generic! Score=166
[TASK_2]: Task                                    ← Generic! Score=166
[TASK_3]: 开发 Task 聊天插件                      ← Relevant! Score=125
[TASK_4]: Utveckla plugin-programmet Task Chat   ← Relevant! Score=125
```

**AI only recommended:**
- [TASK_3], [TASK_4], [TASK_5], [TASK_6] (4 tasks)

**System auto-added:**
- [TASK_1], [TASK_2] (generic "Task" entries) + 4 more

**Result:** 
- ❌ Generic tasks in recommendations
- ❌ Auto-expansion overriding AI judgment
- ❌ Not respecting sort order properly

## Solutions Implemented

### 1. **Removed Hard-Coded Auto-Expansion**

**File:** `src/services/aiService.ts` (lines 1240-1246)

**Before:**
```typescript
// SAFETY: If AI recommended too few tasks (less than 10) and we have many available (30+),
// automatically expand to top 10 by relevance to ensure comprehensive results
const minRecommendations = 10;
if (recommended.length < minRecommendations && tasks.length >= 30) {
    // Add top tasks that AI didn't explicitly mention, up to minimum
    const additionalTasks = tasks
        .filter((t) => !recommendedIds.has(t.id))
        .slice(0, minRecommendations - recommended.length);
    recommended.push(...additionalTasks);
}
```

**After:**
```typescript
// Trust the AI's judgment on how many tasks to recommend
// The prompt emphasizes comprehensive recommendations, so if AI selects fewer tasks,
// it means the others aren't relevant enough to include
```

**Why this is better:**
- ✅ Trusts AI's judgment on relevance
- ✅ Doesn't force irrelevant tasks into recommendations
- ✅ Prompt now emphasizes comprehensiveness, so AI will recommend more if appropriate
- ✅ User's `maxRecommendations` setting is still respected

### 2. **Strengthened Quality Filtering**

**File:** `src/services/taskSearchService.ts` (lines 726-740)

**Before:**
```typescript
// Penalize very short generic tasks (likely test/placeholder tasks)
if (task.text.trim().length < 10) {
    score -= 50;
}
```

**After:**
```typescript
// Penalize very short generic tasks (likely test/placeholder tasks)
const trimmedText = task.text.trim();
if (trimmedText.length < 10) {
    score -= 100; // Strong penalty for very short tasks
}

// Additional penalty for generic task names (case-insensitive)
const genericTaskNames = ['task', 'todo', 'item', 'work'];
const firstWord = trimmedText.split(/\s+/)[0]?.toLowerCase() || '';
if (genericTaskNames.includes(firstWord)) {
    // Only penalize if the task is JUST the generic word (or very short)
    if (trimmedText.length < 20) {
        score -= 150; // Very strong penalty for generic placeholder tasks
    }
}
```

**Impact:**
- Generic "Task" entries: **-250 total penalty** (was only -50)
- Before: "Task" with score 166 → After: "Task" with score ~-84 (filtered out)
- Legitimate tasks like "Task Chat plugin development" are NOT penalized (length > 20)

### 3. **Enhanced Prompt Guidance**

**File:** `src/services/promptBuilderService.ts`

#### A. Recommendation Limits (lines 125-139)

**Before:**
```typescript
TASK RECOMMENDATION REQUIREMENTS:
- You MUST recommend at least 10-15 tasks when there are many relevant matches
- Maximum allowed: ${settings.maxRecommendations} tasks
- DO NOT be overly selective - if a task is relevant, include it in recommendations
- Goal: Give user comprehensive view of ALL relevant work, not just the "top few"
```

**After:**
```typescript
TASK RECOMMENDATION REQUIREMENTS:
⚠️ CRITICAL: You MUST be comprehensive in your recommendations!

- Recommend ALL truly relevant tasks, not just a "top few"
- When there are 20+ relevant matches, aim for at least 10-15 recommendations
- Maximum allowed: ${settings.maxRecommendations} tasks
- DO NOT be overly selective - if a task matches the query and has reasonable relevance, INCLUDE IT
- Users prefer comprehensive lists over missing relevant tasks
- Goal: Give user complete view of ALL relevant work, not a curated subset
- Only exclude tasks that are clearly NOT relevant to the query

⚠️ Remember: It's better to recommend more relevant tasks than to exclude potentially useful ones!
```

#### B. Sort Order Explanation (lines 221-239)

**Before:**
```typescript
TASK ORDERING (User-Configured):
- Tasks are sorted using multi-criteria sorting: ${sortChain}
- Primary sort: ${primaryDescription}
- Earlier tasks in the list are MORE important based on this sorting
- Lower task IDs (e.g., [TASK_1], [TASK_2]) are typically more critical than higher IDs
- When recommending tasks, prioritize earlier task IDs unless there's a specific reason not to
```

**After:**
```typescript
TASK ORDERING (User-Configured):
⚠️ CRITICAL: Tasks are PRE-SORTED based on user's criteria before reaching you!

Multi-criteria sort order: ${sortChain}
- Primary sort: ${primaryDescription}
- Secondary/tertiary sorts break ties when primary criteria are equal

⚠️ IMPORTANT IMPLICATIONS FOR YOUR RECOMMENDATIONS:
- [TASK_1], [TASK_2], [TASK_3] are at the TOP because they rank highest by these criteria
- [TASK_90], [TASK_91], [TASK_92] are at the BOTTOM because they rank lowest
- Earlier task IDs = MORE relevant/urgent/important (based on sort criteria)
- When many tasks match the query, PRIORITIZE EARLIER TASK IDs (lower numbers)
- The system already did the sorting - you should respect and leverage this ordering

Sort criteria in use (in priority order):
${criteriaDetails.map((detail) => `  * ${detail}`).join("\n")}

⚠️ ACTION: When recommending tasks, start with lower task IDs and work your way up. Tasks near [TASK_1] are the most aligned with user's needs based on the sort criteria!
```

#### C. Main Prompt Rules (aiService.ts, lines 815-826)

**Added rules:**
```typescript
5. ⚠️ CRITICAL: If there are MULTIPLE relevant tasks, reference ALL of them using their [TASK_X] IDs - be comprehensive!
8. ⚠️ PRIORITIZE tasks based on their [TASK_X] ID numbers - lower IDs are more important (already sorted by relevance/urgency/priority)
10. Keep your EXPLANATION concise, but DO reference all relevant tasks - users prefer comprehensive lists over missing tasks
11. When 10+ tasks match the query well, aim to recommend at least 10-15 tasks, not just 3-4
```

## Expected Results

### Before Fix:
```
Query: "开发 Task Chat 插件"
→ AI analyzes 100 tasks (top by relevance)
→ AI recommends 4 tasks: [TASK_3], [TASK_4], [TASK_5], [TASK_6]
→ System auto-expands to 10 by adding [TASK_1], [TASK_2], etc.
→ [TASK_1] and [TASK_2] are just "Task" (generic placeholders)
→ User sees 10 tasks including irrelevant ones ❌
```

### After Fix:
```
Query: "开发 Task Chat 插件"
→ Generic "Task" entries get -250 penalty → score becomes negative
→ These tasks filtered out before sending to AI
→ AI receives only quality tasks (no generic placeholders)
→ AI sees strengthened prompt emphasizing comprehensiveness
→ AI sees explicit guidance to prioritize lower task IDs
→ AI recommends 10-15 truly relevant tasks (not just 4)
→ No auto-expansion - AI decides based on actual relevance
→ User sees comprehensive list of relevant tasks ✅
```

## Testing Verification

**Expected behaviors:**

1. **Generic task filtering:**
   - Tasks like "Task", "Todo", "Work item" should get very low/negative scores
   - These should NOT appear in top 100 tasks sent to AI
   - Log should show: `[Task Chat] Quality filter applied: 533 → 480 tasks` (more filtered)

2. **No auto-expansion:**
   - Log should NOT show: "Auto-expanding to 10 tasks"
   - Log should show: "AI explicitly recommended X tasks" (and respect that number)

3. **Comprehensive recommendations:**
   - AI should recommend 10-15 tasks when 20+ match query
   - AI should prioritize lower task IDs ([TASK_1], [TASK_2], etc.)
   - Recommendations should align with sort order

4. **Sort order respect:**
   - Tasks with better relevance/due dates/priority should be recommended first
   - AI's explanation should reference the sort order reasoning

## Files Modified

1. **src/services/aiService.ts** (lines 1240-1246)
   - Removed hard-coded minimum 10 auto-expansion
   - Added comment explaining trust in AI judgment

2. **src/services/taskSearchService.ts** (lines 726-740)
   - Increased penalty for very short tasks: -50 → -100
   - Added -150 penalty for generic task names (task, todo, item, work)
   - Only applies to short tasks (< 20 chars) to avoid false positives

3. **src/services/promptBuilderService.ts**
   - Enhanced `buildRecommendationLimits()` (lines 125-139)
   - Enhanced `buildSortOrderExplanation()` (lines 221-239)
   - Added ⚠️ critical warnings and action items

4. **src/services/aiService.ts** (lines 815-826)
   - Updated main prompt rules to emphasize comprehensiveness
   - Added rule about prioritizing lower task IDs
   - Added rule about aiming for 10-15 recommendations when applicable

## Build Result

```bash
✅ Build successful: 134.6kb
✅ All files formatted with Prettier
✅ No errors or warnings
```

## Key Improvements Summary

| Issue | Before | After |
|-------|--------|-------|
| **Generic tasks** | "Task" scores 166 → included in top results | "Task" scores -84 → filtered out |
| **Auto-expansion** | Forced minimum 10 tasks | Trust AI judgment |
| **Comprehensiveness** | AI recommends 4 tasks | AI aims for 10-15 when applicable |
| **Sort order** | Weakly emphasized | Strongly emphasized with action items |
| **User control** | System overrides AI | AI decides based on relevance |

## Benefits

1. **Better quality:** No more generic placeholder tasks in recommendations
2. **More relevant:** AI recommends truly relevant tasks, not forced fillers
3. **Comprehensive:** AI encouraged to recommend more tasks when appropriate
4. **Sort-aware:** AI prioritizes tasks based on user's configured sort order
5. **User trust:** System respects AI's judgment on relevance

## Prevention

To avoid similar issues in the future:

1. **Avoid hard-coded minimums:** Let AI decide based on prompt guidance
2. **Strong quality filters:** Penalize generic/placeholder content heavily
3. **Clear prompts:** Use ⚠️ warnings and explicit action items
4. **Test with real data:** Use actual user queries with generic tasks to verify filtering
5. **Monitor logs:** Check for patterns of auto-expansion or low-quality recommendations

## Related Issues

This fix addresses the user's concern:
> "There are actually more related tasks, but you seem to limit the task to the minimum number; I mean, the minimum number is 10, and it appears you have limited it to just that. Another issue is that the recommended list contains tasks that don't match the query very well; I mean, they are not very relevant, yet you still output them."

Now:
- ✅ No hard-coded minimum limiting recommendations
- ✅ Generic tasks filtered out by strong penalties
- ✅ AI encouraged to be comprehensive
- ✅ Sort order strongly emphasized
- ✅ Lower task IDs prioritized
