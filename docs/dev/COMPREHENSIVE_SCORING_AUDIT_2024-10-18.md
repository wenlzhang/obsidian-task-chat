# Comprehensive Scoring System Audit & Improvement Plan

**Date:** 2024-10-18  
**Status:** 🔍 Analysis Complete - Improvements Needed  

## Executive Summary

After your formula changes (removing `× 100`, adjusting coefficients), I've identified **critical incompatibilities** and several areas for improvement:

### 🚨 Critical Issues
1. **Relevance threshold broken** - Set to 0-100, but new scores are 0-31 max
2. **Score range mismatch** - Settings describe 0-100, actual scores are different
3. **Inconsistent scoring** - Different methods across modes

### 🔧 Improvements Needed
1. Remove dead code (`sortByKeywordRelevance`)
2. Unify scoring approach
3. Update threshold logic and settings
4. Align logging with actual scores

---

## 1. Scoring Methods Analysis

### Current Methods

| Method | Purpose | Used Where | Score Range | Status |
|--------|---------|-----------|-------------|--------|
| `scoreTasksByRelevance()` | Simple keyword count | Simple Search fallback | 0-N keywords | ✅ Used |
| `scoreTasksComprehensive()` | Weighted multi-criteria | Smart Search, Task Chat | 0-31 (after changes) | ✅ Used |
| `calculateRelevanceScore()` | Ratio-based relevance | Called by comprehensive | 0-1.2 | ✅ Used |
| `sortByKeywordRelevance()` | Sort by simple scoring | **NEVER CALLED** | N/A | ❌ Dead code |

### Issue: Dead Method

**`sortByKeywordRelevance` is defined but never used!**

```typescript
// This method exists but is NEVER called anywhere
static sortByKeywordRelevance(tasks: Task[], keywords: string[]): Task[] {
    const sorted = this.scoreTasksByRelevance(tasks, keywords);
    return sorted.map((item) => item.task);
}
```

**Recommendation:** Remove this method - it's unused and adds confusion.

---

## 2. Score Range Analysis (After Your Changes)

### User's Changes
You removed `× 100` from relevance and adjusted coefficients:

**Relevance Score:**
- Old: `(coreRatio × 0.2 + allRatio × 1.0) × 100` → **0-120**
- New: `coreRatio × 0.2 + allRatio × 1.0` → **0-1.2**

**Due Date Score:**
- Changed overdue from 2.0 to 1.5
- Range: **0.1-1.5**

**Priority Score:**
- Unchanged: **0.1-1.0**

**Final Score Formula:**
```
finalScore = relevanceScore × 20 + dueDateScore × 4 × coeff + priorityScore × 1 × coeff
```

### Maximum Possible Scores

**Scenario: Perfect match, overdue, priority 1, all filters active**
```
Relevance: 1.2 × 20 = 24.0
Due Date: 1.5 × 4 × 1.0 = 6.0
Priority: 1.0 × 1 × 1.0 = 1.0
────────────────────────────
Total Maximum: 31.0
```

**Scenario: Perfect match, no date/priority filters**
```
Relevance: 1.2 × 20 = 24.0
Due Date: 1.5 × 4 × 0.0 = 0.0
Priority: 1.0 × 1 × 0.0 = 0.0
────────────────────────────
Total Maximum: 24.0
```

### 🚨 Critical Problem: Threshold Incompatibility

**Settings define threshold as 0-100:**
```typescript
// settings.ts
relevanceThreshold: 30, // "Minimum relevance score (0-100)"
```

**But actual scores are now 0-31 maximum!**

This means:
- Threshold of 30 will filter out almost ALL tasks (only perfect matches pass)
- Threshold of 50+ will filter out EVERYTHING
- User settings are completely misleading

---

## 3. Usage Analysis Across Modes

### Simple Search Mode
```typescript
// Uses: scoreTasksByRelevance()
// Score: Number of matching keywords (1, 2, 3, ...)
// Threshold: NOT APPLIED (direct sort)
// Issue: Different scoring than Smart/Chat modes
```

### Smart Search Mode
```typescript
// Uses: scoreTasksComprehensive()
// Score: relevance×20 + dueDate×4 + priority×1
// Threshold: APPLIED (0-100 setting, but scores are 0-31!)
// Issue: Threshold incompatible with actual scores
```

### Task Chat Mode
```typescript
// Uses: scoreTasksComprehensive()
// Score: relevance×20 + dueDate×4 + priority×1
// Threshold: APPLIED (same issue as Smart Search)
// Issue: Same threshold incompatibility
```

---

## 4. Threshold Logic Analysis

### Current Threshold Code

```typescript
// aiService.ts line 265-310
let baseThreshold: number;
if (settings.relevanceThreshold === 0) {
    // Adaptive defaults: 20, 30, or 40
    if (intent.keywords.length >= 4) {
        baseThreshold = 20;
    } else if (intent.keywords.length >= 2) {
        baseThreshold = 30;
    } else {
        baseThreshold = 40;
    }
} else {
    baseThreshold = settings.relevanceThreshold;
}

// Then filters:
qualityFilteredTasks = scoredTasks.filter((st) => st.score >= finalThreshold);
```

### 🚨 Problem Breakdown

**With comprehensive scoring (max 31):**
- Threshold 40: **Filters out EVERYTHING**
- Threshold 30: **Only keeps perfect matches**
- Threshold 20: **Only keeps very strong matches**
- Threshold 0: **Keeps all (adaptive mode)**

**The threshold values were designed for 0-120 score range, not 0-31!**

---

## 5. Logging Analysis

### Current Logging Issues

**1. Logging says one coefficient, code uses another:**
```typescript
// Line 993 in logging (user hasn't updated)
console.log(`[Task Chat]   - Relevance: ${item.relevanceScore.toFixed(1)} (× 10 = ...)`);
// But actual code uses × 20 now!
```

**2. Due date coefficient logging:**
```typescript
// Line 996
console.log(`[Task Chat]   - Due Date: ... (× ${dueDateCoefficient * 2} = ...)`);
// Should be × ${dueDateCoefficient * 4} now!
```

**3. Threshold logging misleading:**
```typescript
console.log(`Quality filter threshold: ${finalThreshold} (base: ${baseThreshold}, keywords: ...)`);
// Says threshold is 30-40, but max score is only 31!
```

---

## 6. Improvement Plan

### Phase 1: Fix Critical Issues (Immediate)

#### 1.1 Update Logging to Match Code
```typescript
// taskSearchService.ts lines 993-1001
// OLD (incorrect):
console.log(`- Relevance: ${score} (× 10 = ${score * 10})`);
console.log(`- Due Date: ${score} (× ${coeff * 2} = ...)`);

// NEW (correct):
console.log(`- Relevance: ${score.toFixed(2)} (× 20 = ${(score * 20).toFixed(1)})`);
console.log(`- Due Date: ${score.toFixed(2)} (× ${coeff * 4} = ...)`);
```

#### 1.2 Remove Dead Code
```typescript
// Remove sortByKeywordRelevance() - it's never called
```

#### 1.3 Update Threshold Scale

**Option A: Scale threshold down to match new range (0-31)**
```typescript
// settings.ts
relevanceThreshold: 5, // New range: 0-31 (was 0-100)

// settingsTab.ts
slider.setLimits(0, 31, 1) // Change from 0-100
```

**Option B: Keep threshold 0-100, scale it internally**
```typescript
// aiService.ts - scale threshold to actual score range
const scaledThreshold = (finalThreshold / 100) * 31; // Map 0-100 to 0-31
qualityFilteredTasks = scoredTasks.filter((st) => st.score >= scaledThreshold);
```

**Option C: Remove threshold, use percentile-based filtering**
```typescript
// Instead of fixed threshold, keep top X%
const topPercent = 0.3; // Keep top 30%
const cutoffIndex = Math.ceil(scoredTasks.length * topPercent);
qualityFilteredTasks = scoredTasks.slice(0, cutoffIndex);
```

**Recommendation: Option A** - Simplest and most transparent. Update all documentation.

### Phase 2: Unify Scoring Approach

#### 2.1 Decision: One Scoring Method or Two?

**Current Split:**
- `scoreTasksByRelevance()`: Simple keyword count for Simple Search
- `scoreTasksComprehensive()`: Weighted multi-criteria for Smart/Chat

**Option 1: Keep Both (Status Quo)**
- ✅ Pro: Simple Search stays lightweight
- ❌ Con: Different score ranges, harder to compare

**Option 2: Always Use Comprehensive**
- ✅ Pro: Consistent scoring everywhere
- ✅ Pro: Even Simple Search benefits from due date/priority
- ❌ Con: Requires core keywords even for Simple Search
- **Solution:** For Simple Search, treat ALL keywords as core keywords:
  ```typescript
  // When parsing fails, use all keywords as both core and expanded
  scoreTasksComprehensive(tasks, keywords, keywords, false, false, sortOrder)
  ```

**Option 3: Make scoreTasksByRelevance call calculateRelevanceScore**
- Use the same relevance calculation, but skip due date/priority
- ✅ Pro: Consistent relevance calculation
- ✅ Pro: Keeps Simple Search lightweight
  ```typescript
  static scoreTasksByRelevance(tasks: Task[], keywords: string[]) {
      return tasks.map(task => {
          const score = this.calculateRelevanceScore(
              task.text.toLowerCase(),
              keywords, // Treat all as core
              keywords  // No expansion in Simple Search
          );
          return { task, score };
      }).sort((a, b) => b.score - a.score);
  }
  ```

**Recommendation: Option 3** - Consistent relevance calculation, but keep Simple Search lightweight.

### Phase 3: Settings Alignment

#### 3.1 Update Settings Documentation
```typescript
// settings.ts
relevanceThreshold: number; // OLD: "(0-100)"
relevanceThreshold: number; // NEW: "(0-31) Minimum combined score for task relevance"
```

#### 3.2 Update Settings UI
```typescript
// settingsTab.ts
.addSlider((slider) =>
    slider
        .setLimits(0, 31, 1) // Changed from 0-100
        .setValue(this.plugin.settings.relevanceThreshold)
        .setDynamicTooltip()
)
.setDesc(
    `Minimum score for including tasks (0-31). Score = relevance×20 + dueDate×4 + priority×1. 
    Set to 0 for adaptive (recommended). Lower = more results, higher = stricter filtering.
    
    Examples:
    - 0: Adaptive (adjusts based on query)
    - 5: Permissive (includes most relevant tasks)
    - 10: Balanced (moderate filtering)
    - 15: Strict (only strong matches)
    - 20+: Very strict (only perfect matches)`
)
```

#### 3.3 Migrate Existing Settings
```typescript
// In plugin initialization (main.ts or similar)
// Convert old threshold (0-100) to new scale (0-31)
if (loadedSettings.relevanceThreshold > 31) {
    // Old scale detected, convert
    loadedSettings.relevanceThreshold = Math.round(
        (loadedSettings.relevanceThreshold / 100) * 31
    );
    console.log(`[Task Chat] Migrated relevance threshold to new scale: ${loadedSettings.relevanceThreshold}`);
}
```

### Phase 4: Comprehensive Testing

#### 4.1 Test Scenarios

**Test 1: Simple Search with threshold**
```
Query: "fix bug"
Mode: Simple Search
Expected: Uses calculateRelevanceScore with keywords as both core and expanded
Threshold: Should filter appropriately with 0-31 scale
```

**Test 2: Smart Search with semantic expansion**
```
Query: "develop plugin feature"
Mode: Smart Search
Core: 3 keywords
Expanded: 45 keywords
Expected: Comprehensive scoring, threshold on 0-31 scale
```

**Test 3: Task Chat with all filters**
```
Query: "urgent bug priority 1 due today"
Mode: Task Chat
Expected: High scores for matching tasks (relevance + dueDate + priority)
Threshold: Should let top-scored tasks through
```

**Test 4: Adaptive threshold**
```
Setting: relevanceThreshold = 0
Expected: Automatically adjusts based on keyword count
Should scale to new 0-31 range
```

---

## 7. Migration Checklist

### Immediate (Critical Fixes)

- [ ] Update logging coefficients (× 10 → × 20, × 2 → × 4)
- [ ] Fix threshold scale (0-100 → 0-31) in settings
- [ ] Fix threshold scale in adaptive logic
- [ ] Update settings description and UI
- [ ] Add migration code for existing users

### Short Term (Code Cleanup)

- [ ] Remove `sortByKeywordRelevance()` dead code
- [ ] Make `scoreTasksByRelevance()` use `calculateRelevanceScore()`
- [ ] Unify score ranges across modes
- [ ] Update all documentation comments

### Long Term (Enhancements)

- [ ] Consider percentile-based filtering instead of fixed threshold
- [ ] Add score range display to settings
- [ ] Show score breakdown in UI (optional debug mode)
- [ ] Add unit tests for scoring edge cases

---

## 8. Detailed Code Changes Needed

### Change 1: Update Logging (taskSearchService.ts lines 993-1001)

```typescript
// CURRENT (WRONG):
console.log(
    `[Task Chat]   - Relevance: ${item.relevanceScore.toFixed(1)} (× 10 = ${(item.relevanceScore * 10).toFixed(1)})`,
);
console.log(
    `[Task Chat]   - Due Date: ${item.dueDateScore.toFixed(1)} (× ${dueDateCoefficient * 2} = ${(item.dueDateScore * 2 * dueDateCoefficient).toFixed(1)})`,
);

// CORRECT:
console.log(
    `[Task Chat]   - Relevance: ${item.relevanceScore.toFixed(2)} (× 20 = ${(item.relevanceScore * 20).toFixed(1)})`,
);
console.log(
    `[Task Chat]   - Due Date: ${item.dueDateScore.toFixed(2)} (× ${dueDateCoefficient * 4} = ${(item.dueDateScore * 4 * dueDateCoefficient).toFixed(1)})`,
);
```

### Change 2: Update Threshold Scale (settings.ts)

```typescript
// CURRENT:
relevanceThreshold: 30, // Minimum relevance score (0-100)

// CORRECT:
relevanceThreshold: 5, // Minimum combined score (0-31). 0 = adaptive (recommended).
```

### Change 3: Scale Adaptive Thresholds (aiService.ts)

```typescript
// CURRENT (WRONG - values 20-40 for max score of 31):
if (intent.keywords.length >= 4) {
    baseThreshold = 20;
} else if (intent.keywords.length >= 2) {
    baseThreshold = 30;
} else {
    baseThreshold = 40;
}

// CORRECT (scaled to 0-31):
if (settings.relevanceThreshold === 0) {
    // Adaptive defaults - scaled to new range
    if (intent.keywords.length >= 20) {
        // Semantic expansion - very permissive
        baseThreshold = 3;
    } else if (intent.keywords.length >= 4) {
        baseThreshold = 5;
    } else if (intent.keywords.length >= 2) {
        baseThreshold = 8;
    } else {
        baseThreshold = 10;
    }
} else {
    baseThreshold = settings.relevanceThreshold;
}
```

### Change 4: Update Settings UI (settingsTab.ts)

```typescript
// CURRENT:
.addSlider((slider) =>
    slider
        .setLimits(0, 100, 5) // WRONG RANGE
        .setValue(this.plugin.settings.relevanceThreshold)
)

// CORRECT:
.addSlider((slider) =>
    slider
        .setLimits(0, 31, 1) // NEW RANGE matches actual scores
        .setValue(this.plugin.settings.relevanceThreshold)
)
```

### Change 5: Unify Relevance Calculation

```typescript
// scoreTasksByRelevance should use calculateRelevanceScore
static scoreTasksByRelevance(
    tasks: Task[],
    keywords: string[],
): Array<{ task: Task; score: number }> {
    const deduplicatedKeywords = this.deduplicateWithLogging(keywords, "keywords");

    const scored = tasks.map((task) => {
        const taskText = task.text.toLowerCase();
        
        // Use the same relevance calculation as comprehensive scoring
        // Treat all keywords as both core and expanded (no distinction in Simple Search)
        const score = this.calculateRelevanceScore(
            taskText,
            deduplicatedKeywords, // All keywords are "core" in simple mode
            deduplicatedKeywords, // No expansion in simple mode
        );

        return { task, score };
    });

    return scored.sort((a, b) => b.score - a.score);
}
```

### Change 6: Remove Dead Code

```typescript
// DELETE THIS METHOD (never called):
static sortByKeywordRelevance(tasks: Task[], keywords: string[]): Task[] {
    const sorted = this.scoreTasksByRelevance(tasks, keywords);
    return sorted.map((item) => item.task);
}
```

---

## 9. Summary

### Current State: Broken
- Threshold expects 0-100, actual scores are 0-31
- Logging shows wrong coefficients
- Dead code exists
- Different scoring methods across modes
- Settings UI misleading

### After Fixes: Clean & Consistent
- ✅ Threshold scaled to 0-31
- ✅ Logging matches actual calculations
- ✅ Dead code removed
- ✅ Unified relevance calculation (calculateRelevanceScore everywhere)
- ✅ Settings UI accurate with examples
- ✅ Migration for existing users
- ✅ Comprehensive testing

### Priority Order
1. **CRITICAL**: Fix threshold scale (users getting 0 results!)
2. **HIGH**: Update logging (confusing debug output)
3. **MEDIUM**: Unify scoring methods
4. **LOW**: Remove dead code

---

## 10. Questions for You

Before I proceed with changes:

1. **Threshold approach**: Do you prefer Option A (scale to 0-31), B (keep 0-100 and scale internally), or C (percentile-based)?

2. **Simple Search scoring**: Should it use `calculateRelevanceScore` (Option 3) or always use comprehensive scoring (Option 2)?

3. **Migration**: Should I auto-migrate old threshold settings, or reset to default (0 = adaptive)?

4. **Score display**: Would you like to show score breakdowns in the UI for debugging?

Let me know your preferences and I'll implement the fixes! 🛠️
