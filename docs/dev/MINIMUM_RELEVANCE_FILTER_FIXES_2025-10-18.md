# Minimum Relevance Filter Fixes (2025-10-18)

## Critical Bugs Fixed

User discovered two critical issues with the minimum relevance threshold that made it ineffective.

---

## Bug #1: Safety Override Ignored User's Explicit Filters

### Problem

The "safety override" logic (aiService.ts lines 422-432) overrode user's explicit filter choices.

**User's Experience:**
```
User sets: minimum relevance = 60%
System correctly filters: 507 → 32 tasks
System then overrides: "Too strict! Keeping 100 tasks instead"
Result: User's explicit choice IGNORED ❌
```

**Console Log Evidence:**
```
[Task Chat] Minimum relevance filter (0.60): 507 → 32 tasks
[Task Chat] Quality filter too strict (32 tasks), keeping top 100 scored tasks
```

### Root Cause

The safety override applied to ALL modes, regardless of whether the user explicitly set filters:

```typescript
// BEFORE (WRONG)
const minTasksNeeded = Math.min(settings.maxTasksForAI, filteredTasks.length);
if (qualityFilteredTasks.length < minTasksNeeded) {
    console.log(
        `[Task Chat] Quality filter too strict (${qualityFilteredTasks.length} tasks), keeping top ${minTasksNeeded} scored tasks`,
    );
    // Override user's explicit choice!
    qualityFilteredScored = scoredTasks
        .sort((a, b) => b.score - a.score)
        .slice(0, minTasksNeeded);
}
```

**Logic flaw:**
- User set minimum relevance = 60% → explicit choice
- System filtered to 32 tasks → correct behavior
- Safety override then kept 100 tasks → WRONG! Ignored user's choice

### Fix

Only apply safety override in **adaptive mode** (when user has NOT set explicit filters):

```typescript
// AFTER (CORRECT)
const userHasExplicitFilters =
    settings.qualityFilterStrength > 0 ||
    settings.minimumRelevanceScore > 0;

if (!userHasExplicitFilters) {
    // Adaptive mode - apply safety override
    const minTasksNeeded = Math.min(settings.maxTasksForAI, filteredTasks.length);
    if (qualityFilteredTasks.length < minTasksNeeded) {
        console.log(
            `[Task Chat] Adaptive mode: quality filter too strict (${qualityFilteredTasks.length} tasks), keeping top ${minTasksNeeded} scored tasks`,
        );
        qualityFilteredScored = scoredTasks
            .sort((a, b) => b.score - a.score)
            .slice(0, minTasksNeeded);
    }
} else {
    // User has explicit filters - RESPECT their choice!
    console.log(
        `[Task Chat] User has explicit filters - respecting strict filtering (${qualityFilteredTasks.length} tasks)`,
    );
}
```

### Impact

**Before:**
- User sets minimum relevance 60% → System ignores it ❌
- User sets quality filter 50% → System ignores it ❌
- All explicit filtering choices overridden ❌

**After:**
- User sets minimum relevance 60% → System respects it ✅
- User sets quality filter 50% → System respects it ✅
- Adaptive mode (0% filters) → Safety override still applies ✅
- **User control restored!** ✅

---

## Bug #2: Slider Maximum Hardcoded Instead of Dynamic

### Problem

The minimum relevance slider was hardcoded to 0-200%, but the actual maximum relevance score is dynamic based on the core keyword coefficient.

**Mismatch:**
```
Settings:
- Core keyword coefficient: 0.2 (default)
- Max relevance score: 0.2 + 1.0 = 1.2 (120%)
- Slider maximum: 200% (hardcoded)

Problem: Slider allows values up to 200%, but max relevance is only 120%!
```

**UI showed the correct max in description:**
```
📊 MAXIMUM VALUE: Current maximum: 120% (based on your core bonus of 0.20)
```

But the slider itself went to 200%!

### Root Cause

Hardcoded slider limit:

```typescript
// BEFORE (HARDCODED)
.addSlider((slider) =>
    slider
        .setLimits(0, 200, 1)  // ← Hardcoded 200%
        .setValue(this.plugin.settings.minimumRelevanceScore * 100)
        .setDynamicTooltip()
        .onChange(async (value) => {
            this.plugin.settings.minimumRelevanceScore = value / 100;
            await this.plugin.saveSettings();
        }),
);
```

### Fix

Calculate slider maximum dynamically based on actual max relevance:

```typescript
// AFTER (DYNAMIC)
.addSlider((slider) => {
    // Dynamic maximum based on actual max relevance score
    const maxRelevanceScore = this.plugin.settings.relevanceCoreWeight + 1.0;
    const sliderMax = Math.ceil(maxRelevanceScore * 100);

    return slider
        .setLimits(0, sliderMax, 1)  // ← Dynamic max!
        .setValue(this.plugin.settings.minimumRelevanceScore * 100)
        .setDynamicTooltip()
        .onChange(async (value) => {
            this.plugin.settings.minimumRelevanceScore = value / 100;
            await this.plugin.saveSettings();
        });
});
```

### Impact

**Before:**
- Core bonus 0.2 → max relevance 120%, slider goes to 200% ❌
- Core bonus 0.5 → max relevance 150%, slider goes to 200% ❌
- Core bonus 0.0 → max relevance 100%, slider goes to 200% ❌
- Slider maximum doesn't match actual maximum ❌

**After:**
- Core bonus 0.2 → max relevance 120%, slider goes to 120% ✅
- Core bonus 0.5 → max relevance 150%, slider goes to 150% ✅
- Core bonus 0.0 → max relevance 100%, slider goes to 100% ✅
- Slider maximum matches actual maximum ✅
- **Accurate and user-friendly!** ✅

---

## User's Insights

User provided excellent feedback identifying these issues:

1. **"I'm not sure if minimum relevance worked or not"**
   → Confirmed: It didn't work because safety override ignored it!

2. **"Should depend on actual value of core coefficient"**
   → Confirmed: Slider should be dynamic, not hardcoded to 200%!

3. **"Smart chat shows all tasks even with high minimum relevance"**
   → Confirmed: Safety override was keeping 100 tasks regardless of filter!

---

## Testing Scenarios

### Scenario 1: Minimum Relevance Filter (No Override)

**Setup:**
- Quality filter: 30%
- Minimum relevance: 60%
- Query: "开发 Task Chat 插件"

**Before Fix:**
```
Step 1: Quality filter → 507 tasks
Step 2: Minimum relevance (0.60) → 32 tasks
Step 3: Safety override → 100 tasks (WRONG!)
Result: User's 60% filter IGNORED
```

**After Fix:**
```
Step 1: Quality filter → 507 tasks
Step 2: Minimum relevance (0.60) → 32 tasks
Step 3: User has explicit filters → No override
Result: 32 tasks (CORRECT!)
Console: "User has explicit filters - respecting strict filtering (32 tasks)"
```

### Scenario 2: Adaptive Mode (With Override)

**Setup:**
- Quality filter: 0% (adaptive)
- Minimum relevance: 0% (disabled)
- Query: Very specific query

**Before & After (Same):**
```
Step 1: Quality filter → 15 tasks
Step 2: No explicit filters → Apply safety override
Step 3: Keep 100 tasks for AI context
Result: 100 tasks (safety net works as intended)
Console: "Adaptive mode: quality filter too strict..."
```

### Scenario 3: Dynamic Slider Maximum

**Setup:**
- Core keyword coefficient: 0.2 (default)

**Before Fix:**
```
Slider: 0-200% (hardcoded)
Actual max relevance: 120%
User can set slider to 150% (but it's meaningless!)
```

**After Fix:**
```
Slider: 0-120% (dynamic, matches actual max)
Actual max relevance: 120%
User cannot set slider beyond actual maximum ✅
```

---

## Console Log Changes

### Before Fix

```
[Task Chat] Minimum relevance filter (0.60): 507 → 32 tasks
[Task Chat] Quality filter too strict (32 tasks), keeping top 100 scored tasks
```
❌ User's filter ignored!

### After Fix (With Explicit Filters)

```
[Task Chat] Minimum relevance filter (0.60): 507 → 32 tasks
[Task Chat] User has explicit filters - respecting strict filtering (32 tasks)
```
✅ User's filter respected!

### After Fix (Adaptive Mode)

```
[Task Chat] Quality filter applied: 533 → 15 tasks (threshold: 11.82)
[Task Chat] Adaptive mode: quality filter too strict (15 tasks), keeping top 100 scored tasks
```
✅ Safety override still applies when appropriate!

---

## Design Principle

**Old Design:**
- Always apply safety override
- Assumes system knows better than user
- Ignores explicit user choices
- ❌ Removes user control

**New Design:**
- Adaptive mode (0% filters): Safety override applies
- Explicit filters (>0%): Respect user's choice
- User is in control
- ✅ Empowers power users while protecting beginners

---

## Files Modified

1. **src/services/aiService.ts** (lines 415-444)
   - Added `userHasExplicitFilters` check
   - Conditional safety override
   - Better console logging

2. **src/settingsTab.ts** (lines 505-522)
   - Dynamic slider maximum calculation
   - Based on `relevanceCoreWeight + 1.0`
   - Matches actual max relevance score

---

## Build

✅ 153.3kb (from 152.9kb, +0.4kb for better logic)

---

## User Benefits

### For All Users
- System respects your choices ✅
- No mysterious overrides ✅
- Predictable behavior ✅

### For Power Users
- Minimum relevance filter ACTUALLY works ✅
- Can set strict filtering and it stays strict ✅
- Slider maximum matches reality ✅
- Full control over filtering ✅

### For Default Users
- Adaptive mode still has safety net ✅
- Won't get 0 results accidentally ✅
- Default behavior unchanged ✅

---

## Backward Compatibility

**Default Users:**
- Quality filter: 0% (adaptive) ✓
- Minimum relevance: 0% (disabled) ✓
- Safety override still applies ✓
- No behavior change ✅

**Power Users:**
- Now their filters actually work!
- Previously broken, now fixed ✅

---

## Status

✅ **COMPLETE** - Both critical bugs fixed, user control restored, build successful!

**Key Improvements:**
1. Safety override now conditional (respects explicit filters)
2. Slider maximum now dynamic (matches actual max)
3. User feedback loop: Report → Investigation → Fix → Test
4. System now empowers users instead of fighting them

**Thank you to the user for the excellent bug report!** 🙏
