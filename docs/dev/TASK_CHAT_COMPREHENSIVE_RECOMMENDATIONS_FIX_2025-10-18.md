# Task Chat Comprehensive Recommendations Fix (2025-10-18)

## Critical Issue: AI Recommended Too Few Tasks

User discovered that Task Chat mode was recommending only **5 tasks** when **32 high-quality filtered tasks** were available, while Smart Search mode correctly showed all 32.

---

## The Problem

**User's Observation:**
> "In smart search mode, it displayed more than 30 tasks... but in task chat mode, you only recommend five tasks. That's just too few; it doesn't cover all the target tasks that I wanted to have."

**What Was Happening:**
```
Filtering: 533 → 32 tasks (quality filter + minimum relevance) ✅
Smart Search: Shows all 32 tasks ✅
Task Chat: AI recommends only 5 tasks ❌

Result: 27 relevant tasks missing from recommendations!
```

**Console Logs:**
```
[Task Chat] Sending top 32 tasks to AI (max: 100)
[Task Chat] AI explicitly recommended 5 tasks.
[Task Chat] Returning 5 recommended tasks:
```

**User Settings:**
- `maxRecommendations: 20` (can recommend up to 20)
- 32 high-quality tasks available
- Expected: ~15-20 recommendations
- Actual: 5 recommendations ❌

---

## Root Cause: Contradictory Prompt Instructions

The AI prompt had **conflicting guidance** that caused the AI to be too conservative:

### Problem 1: "Concise" vs "Comprehensive"

**Line 960 (OLD):**
```
10. Keep your EXPLANATION concise, but DO reference all relevant tasks
```

**Issue:** AI interpreted "concise" as "be selective with tasks" rather than just "brief explanation"

### Problem 2: Weak Recommendation Targets

**Line 961 (OLD):**
```
11. When 10+ tasks match the query well, aim to recommend at least 10-15 tasks, not just 3-4
```

**Issues:**
- "aim to recommend" = too weak, AI ignored it
- "10-15 tasks" = static number, doesn't scale with available tasks
- Buried at end of long prompt = easily missed

### Problem 3: Redundant Instructions

`PromptBuilderService.buildRecommendationLimits()` repeated similar guidance:
```
- Recommend ALL truly relevant tasks, not just a "top few"
- When there are 20+ relevant matches, aim for at least 10-15 recommendations
```

But this was AFTER the contradictory "concise" instruction, causing confusion.

---

## The Fix

### 1. Strong, Prominent Recommendation Requirements

Moved to top of rules section with clear visual emphasis:

```typescript
🚨 CRITICAL: COMPREHENSIVE TASK RECOMMENDATIONS REQUIRED 🚨
⚠️ Users want to see ALL relevant tasks, not a curated subset!
⚠️ With ${taskCount} high-quality tasks available, you MUST recommend a substantial portion!

RECOMMENDATION TARGETS (based on available tasks):
- ${taskCount} tasks available → Aim for ${Math.max(Math.floor(taskCount * 0.6), 10)}-${Math.min(taskCount, settings.maxRecommendations)} recommendations
- ONLY exclude tasks that are clearly NOT relevant to the query
- If a task matches keywords AND has reasonable urgency/priority → INCLUDE IT
- Err on the side of inclusion - users prefer comprehensive lists over missing tasks
- Maximum allowed: ${settings.maxRecommendations} tasks
```

**Key Improvements:**
- **Dynamic targets:** 60-80% of available tasks, not fixed numbers
- **Prominent positioning:** Top of rules section with emoji warnings
- **Clear mandate:** "MUST recommend a substantial portion"
- **Explicit calculations:** With 32 tasks → aim for 19-20 recommendations

### 2. Clarified "Concise" Language

**OLD:**
```
10. Keep your EXPLANATION concise, but DO reference all relevant tasks
```

**NEW:**
```
10. Keep your EXPLANATION brief (2-3 sentences), but REFERENCE MANY tasks in your recommendation
```

**Impact:** Makes it clear that conciseness applies to explanation ONLY, not task count

### 3. Added Strong Closing Instruction

**NEW Line 971:**
```
11. 🚨 CRITICAL: With 10+ high-quality tasks, you MUST recommend at least 60-80% of them, not just 20-30%
```

**Impact:** Reinforces the comprehensive requirement at the end

### 4. Simplified PromptBuilderService

Removed redundant detailed instructions, kept core philosophy:

```typescript
CORE RECOMMENDATION PHILOSOPHY:
⚠️ Users prefer comprehensive task lists over curated subsets
⚠️ Maximum allowed: ${settings.maxRecommendations} tasks
⚠️ Goal: Show ALL relevant work, let users decide what to focus on
⚠️ Only exclude tasks that are clearly irrelevant to the query

Remember: Inclusion > Exclusion. When in doubt, include the task!
```

**Impact:** Consistent messaging without contradictions

### 5. Added Task Count Parameter

**Function Signature Update:**
```typescript
private static buildMessages(
    userMessage: string,
    taskContext: string,
    chatHistory: ChatMessage[],
    settings: PluginSettings,
    intent: any,
    sortOrder: SortCriterion[],
    taskCount: number, // NEW: Number of tasks available for recommendation
): any[]
```

**Call Site:**
```typescript
const messages = this.buildMessages(
    message,
    taskContext,
    chatHistory,
    settings,
    intent,
    sortOrder,
    tasksToAnalyze.length, // Pass task count for dynamic targets
);
```

**Impact:** Enables dynamic recommendation targets based on available tasks

---

## Expected Behavior After Fix

### Scenario: 32 High-Quality Tasks Available

**Settings:**
- `maxRecommendations: 20`
- `maxTasksForAI: 100`

**Calculation:**
```
Target minimum: Math.max(Math.floor(32 * 0.6), 10) = 19
Target maximum: Math.min(32, 20) = 20

Expected recommendations: 19-20 tasks
```

**Before Fix:**
```
AI recommends: 5 tasks ❌
Coverage: 16% of available tasks
Missing: 27 relevant tasks
```

**After Fix:**
```
AI recommends: 19-20 tasks ✅
Coverage: 60-62% of available tasks
Missing: ~12-13 less relevant tasks (acceptable)
```

---

## Dynamic Recommendation Targets

The system now calculates targets based on available tasks:

| Available Tasks | Min Target (60%) | Max Target (limit 20) | Actual Range |
|----------------|------------------|----------------------|--------------|
| 10 tasks       | 10 (min cap)     | 10                   | 10 tasks     |
| 20 tasks       | 12               | 20                   | 12-20 tasks  |
| 32 tasks       | 19               | 20                   | 19-20 tasks  |
| 50 tasks       | 30               | 20 (limit)           | 20 tasks     |
| 100 tasks      | 60               | 20 (limit)           | 20 tasks     |

**Formula:**
```typescript
min = Math.max(Math.floor(taskCount * 0.6), 10)
max = Math.min(taskCount, settings.maxRecommendations)
```

**Design Principles:**
1. **Minimum 10 tasks:** Even with fewer tasks, aim for comprehensive coverage
2. **60% target:** Most tasks should be recommended if they're relevant
3. **Respect user limit:** Don't exceed `maxRecommendations` setting
4. **Scale dynamically:** Targets adapt to available task count

---

## User's Core Insight

> "The way of filtering, curating, and scoring tasks is the same as in smart search mode. What's different is that task chat mode analyzes the sorted tasks a bit more; it fine-tunes the scoring and sorting based on AI analysis."

**User is correct!** Task Chat should:
1. ✅ Use same filtering as Smart Search
2. ✅ Get same sorted list of high-quality tasks
3. ✅ Let AI refine and prioritize within that list
4. ❌ **NOT** drastically reduce the number of recommendations

**The relationship:**
- Smart Search: Shows ALL filtered tasks (direct display)
- Task Chat: Shows MOST filtered tasks (AI-curated subset with analysis)
- **NOT:** Smart Search shows many, Task Chat shows only 5

---

## Files Modified

1. **src/services/aiService.ts** (lines 599-606, 861-868, 949-971)
   - Added `taskCount` parameter to `buildMessages()`
   - Updated function signature and call site
   - Strengthened recommendation requirements
   - Added dynamic target calculations
   - Clarified "concise" language
   - Added closing reinforcement instruction

2. **src/services/promptBuilderService.ts** (lines 125-133)
   - Simplified `buildRecommendationLimits()`
   - Removed redundant instructions
   - Kept core philosophy
   - Consistent messaging

---

## Build

✅ **153.6kb** (same as before - only prompt text changes)

---

## Testing Scenarios

### Test 1: 32 Tasks Available (User's Case)

**Query:** "开发 Task Chat 插件"

**Before Fix:**
```
Filtered: 32 tasks
AI recommends: 5 tasks (16%)
User sees: 5 tasks in recommended list
```

**After Fix:**
```
Filtered: 32 tasks
Target: 19-20 tasks (60-62%)
AI should recommend: 19-20 tasks
User sees: 19-20 tasks in recommended list
```

### Test 2: 100 Tasks Available

**Query:** Broad search

**Before Fix:**
```
Filtered: 100 tasks (sent to AI)
AI recommends: 5-8 tasks (5-8%)
Many relevant tasks missing
```

**After Fix:**
```
Filtered: 100 tasks (sent to AI)
Target: 20 tasks (maxRecommendations limit)
AI should recommend: 20 tasks
Comprehensive coverage
```

### Test 3: 10 Tasks Available

**Query:** Specific search

**Before & After (Similar):**
```
Filtered: 10 tasks
Target: 10 tasks (minimum cap)
AI should recommend: 8-10 tasks
Most tasks covered
```

---

## User Benefits

### For Task Discovery
- **Before:** Miss 84% of relevant tasks (5 of 32)
- **After:** See 60-62% of relevant tasks (19-20 of 32)
- **Impact:** Much better overview of available work

### For Task Prioritization
- **Before:** Only top 5 tasks, no context on others
- **After:** See full spectrum, understand relative importance
- **Impact:** Better decision making

### For Work Planning
- **Before:** Might miss important tasks outside top 5
- **After:** Comprehensive view of related tasks
- **Impact:** More complete planning

---

## AI Behavior Change

### Old Behavior (Too Conservative)
```
AI thinking: "User asked to be concise"
→ Selects only top 5 most critical tasks
→ Ignores instruction to be comprehensive
→ Result: Users miss relevant work
```

### New Behavior (Appropriately Comprehensive)
```
AI thinking: "32 tasks available, aim for 19-20"
→ Includes all highly relevant tasks
→ Brief explanation (2-3 sentences)
→ But references MANY tasks
→ Result: Users see complete picture
```

---

## Design Philosophy

**Old Philosophy:**
- Be selective and curate
- Show only the "best" tasks
- Assume users want short lists
- ❌ Result: Users missed relevant work

**New Philosophy:**
- Be comprehensive and inclusive
- Show ALL relevant tasks
- Let users decide what to focus on
- ✅ Result: Users see complete picture

**Key Principle:**
> **Inclusion > Exclusion**  
> When in doubt, include the task. Users prefer comprehensive lists over curated subsets.

---

## Backward Compatibility

**Default Users:**
- Behavior improves (more recommendations)
- No breaking changes
- Same filtering/scoring
- Better coverage ✅

**Existing Workflows:**
- If users relied on short lists → may see more tasks
- But all tasks are still high-quality (same filtering)
- Users can adjust `maxRecommendations` if needed

---

## Status

✅ **COMPLETE** - AI prompts strengthened to ensure comprehensive task recommendations!

**Key Improvements:**
1. Dynamic targets based on available tasks (60-80%)
2. Clear, prominent instructions with visual emphasis
3. Removed contradictory "concise" language
4. Strong closing reinforcement
5. Simplified redundant instructions
6. Task count parameter for dynamic calculations

**Expected Result:**
- With 32 tasks: AI should recommend 19-20 (vs. 5 before)
- With 100 tasks: AI should recommend 20 (limit)
- With 10 tasks: AI should recommend 8-10

**Thank you to the user for the excellent analysis and clear explanation of the expected behavior!** 🙏
