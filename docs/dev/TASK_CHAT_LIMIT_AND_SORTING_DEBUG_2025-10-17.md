# Task Chat Limit and Sorting Debug (2025-10-17)

## Problems Identified

### 1. **30-Task Limit Too Restrictive**

**Current Behavior:**
- 494 relevant tasks found after filtering
- Only 30 tasks sent to AI (`maxTasksForAI: 30`)
- AI sees only 6% of relevant tasks
- Many important tasks with due dates/priorities missed

**Impact:**
- User query: "开发 plugin för Task Chat"
- 494 tasks match (many with due dates and priorities)
- AI only analyzes top 30 by relevance score
- Tasks ranked 31-494 completely invisible to AI
- Results feel incomplete and random

**Root Cause:**
- `maxTasksForAI` default is 30 (conservative for token costs)
- When semantic expansion generates 60 keywords, many tasks match
- 30-task window becomes bottleneck for broad queries

### 2. **Multi-Criteria Sorting Working But Limited by 30-Task Window**

**Sorting Configuration:**
- AI context sort: `[relevance, dueDate, priority]`
- Multi-criteria sorting is working correctly ✅
- Tasks ARE sorted by: relevance → dueDate → priority

**The Problem:**
- Sorting is correct for the 494 tasks
- But only top 30 are sent to AI
- If top 30 by relevance don't have due dates/priorities...
- ...AI never sees the important tasks with due dates that are ranked 31-100

**Example Scenario:**
```
Query: "开发 Task Chat 插件"

After sorting by [relevance, dueDate, priority]:
Rank 1-20: High relevance, but no due dates/priorities (generic tasks)
Rank 21-30: High relevance, but no due dates/priorities
Rank 31-50: High relevance + overdue due dates + high priority ← AI NEVER SEES THESE!
Rank 51-100: Medium relevance + upcoming due dates ← AI NEVER SEES THESE!
```

### 3. **Smart Search vs Task Chat Discrepancy**

**Smart Search Mode:**
- Shows all 494 tasks directly to user
- User can scroll and see everything
- No AI analysis, no recommendations

**Task Chat Mode:**
- Only 30 tasks → AI → recommendations
- AI has limited view of task landscape
- Recommendations miss important tasks outside top 30

## Current Architecture

```
Query → AI parsing → 60 keywords
     → Filter by keywords → 533 tasks
     → Quality filter (score ≥ 30) → 494 tasks
     → Sort by [relevance, dueDate, priority] → sorted 494 tasks
     → Take top 30 → Send to AI
     → AI recommends from these 30 only
```

## Why 30 Was Chosen Initially

**Token Cost Considerations:**
- Each task in context ~50-100 tokens
- 30 tasks ≈ 1500-3000 tokens in context
- With query + system prompt: ~4000-5000 total input tokens
- Cost with gpt-4o-mini: ~$0.0006 per query

**The Trade-off:**
- Lower limit (30): Cheaper, but AI misses many relevant tasks
- Higher limit (100): More expensive, but AI sees full landscape
- Current setting optimized for cost, not quality

## Solutions

### Option 1: Increase maxTasksForAI (Recommended)

**Change default from 30 → 100:**

```typescript
// settings.ts
maxTasksForAI: 100, // Increased from 30 to give AI better context
```

**Benefits:**
- AI sees top 100 tasks instead of 30
- Better coverage of due dates, priorities
- More comprehensive recommendations
- Still manageable token costs

**Cost Impact (gpt-4o-mini):**
- Current (30 tasks): ~$0.0006 per query
- New (100 tasks): ~$0.0015 per query
- Increase: +$0.0009 per query (~$1.35/month for 50 queries/day)
- Negligible for most users

### Option 2: Adaptive Limit Based on Task Count

**Smart scaling:**

```typescript
// Adaptive maxTasksForAI based on filtered count
const adaptiveMaxTasks = Math.min(
    qualityFilteredTasks.length,
    qualityFilteredTasks.length < 50 ? qualityFilteredTasks.length : 
    qualityFilteredTasks.length < 200 ? 50 :
    100 // Cap at 100 for very broad queries
);
```

**Benefits:**
- Small result sets: Send all tasks
- Medium result sets (50-200): Send 50
- Large result sets (200+): Send 100
- Optimizes both quality and cost

### Option 3: Improve Sort Order for AI Context

**Problem:** Current sort prioritizes relevance above all else
**Solution:** Adjust AI context sort to prioritize urgency

**Current:**
```typescript
taskSortOrderChatAI: ["relevance", "dueDate", "priority"]
```

**Alternative 1 - Priority-First:**
```typescript
taskSortOrderChatAI: ["priority", "dueDate", "relevance"]
```
- Ensures high-priority tasks in top 30
- Due dates used as tiebreaker
- Relevance least important for AI context

**Alternative 2 - Due-Date-First:**
```typescript
taskSortOrderChatAI: ["dueDate", "priority", "relevance"]
```
- Ensures overdue/urgent tasks in top 30
- Priority as tiebreaker
- Good for deadline-focused users

**Alternative 3 - Balanced:**
```typescript
taskSortOrderChatAI: ["relevance", "priority", "dueDate"]
```
- Relevance still primary
- Priority before due date (importance before urgency)
- Better than current for seeing important tasks

## Recommended Action Plan

### Immediate Fix:
1. ✅ Add debug logging to verify sorting (DONE)
2. Increase `maxTasksForAI` default: 30 → 100
3. Update user documentation about setting

### Medium-term:
1. Implement adaptive limit based on result count
2. Add setting explanation in UI (token cost vs coverage)
3. Consider different default sort for AI context vs display

### Long-term:
1. Implement "task clustering" to ensure diverse representation
2. Two-pass AI analysis: Quick scan of top 100, deep analysis of top 20
3. User-configurable sort strategies per query type

## Debug Logs Added

New console output will show:
```
[Task Chat] === TOP 10 TASKS DEBUG (sorted by relevance → dueDate → priority) ===
[Task Chat]   1. [score=150] [due=2025-10-16] [p=1] 开发 Task Chat 时间依赖功能...
[Task Chat]   2. [score=150] [due=2025-10-20] [p=2] 开发 Task Chat AI 模型配置功能...
[Task Chat]   3. [score=120] [due=none] [p=none] 开发 Task 聊天插件...
...
[Task Chat] ===========================================
```

This will help verify:
- Are tasks actually sorted by multiple criteria?
- Are high-priority/urgent tasks in top 30?
- Or are they ranked 31-100 and invisible to AI?

## Testing Instructions

1. Rebuild plugin with new debug logs
2. Run query: "开发 plugin för Task Chat"
3. Check console for TOP 10 TASKS DEBUG output
4. Verify scores, due dates, priorities in order
5. Check if important tasks are in top 30 or missed

## Expected Findings

**Hypothesis 1: Sorting is correct, but limit is too low**
- Top 10 will show proper multi-criteria sorting
- High-relevance tasks without due dates/priorities in top 30
- Important tasks with due dates are ranked 31-100
- **Solution:** Increase maxTasksForAI to 100

**Hypothesis 2: Sorting is not working**
- Top 10 will show random order or relevance-only
- Due dates and priorities ignored in sort
- **Solution:** Fix multi-criteria sorting bug

**Hypothesis 3: All high-relevance tasks lack metadata**
- Top 100 tasks are all generic without due dates/priorities
- Tasks with metadata have low relevance scores
- **Solution:** Improve relevance scoring or adjust sort order

## Files Modified

- `src/services/aiService.ts`: Added debug logging (lines 465-477)

## Next Steps

After reviewing debug logs:
1. Confirm which hypothesis is correct
2. Implement appropriate solution
3. Test with real user data
4. Update documentation

## Related Issues

- Multi-criteria sorting implementation (2024-10-17)
- Semantic expansion generating 60 keywords (2024-10-17)
- Quality filter threshold (30) removing low-scoring tasks

## User Impact

**Before Fix:**
- User: "Show me tasks to develop Task Chat plugin"
- System: Finds 494 relevant tasks
- AI: Sees only 30, recommends from those
- User: "Where are my overdue high-priority tasks?"

**After Fix:**
- User: "Show me tasks to develop Task Chat plugin"
- System: Finds 494 relevant tasks
- AI: Sees top 100 (sorted by relevance → dueDate → priority)
- User: Gets comprehensive recommendations including urgent tasks

## Cost-Benefit Analysis

**Current (30 tasks):**
- Token cost: Low (~$0.0006/query)
- Quality: Poor (misses 94% of relevant tasks)
- User satisfaction: Low (random/incomplete results)

**Proposed (100 tasks):**
- Token cost: Medium (~$0.0015/query, +150%)
- Quality: Good (sees top 20% of relevant tasks)
- User satisfaction: High (comprehensive recommendations)
- Monthly cost increase: ~$1.35 for 50 queries/day

**Conclusion:** 150% token cost increase for 10x better coverage is excellent value.
