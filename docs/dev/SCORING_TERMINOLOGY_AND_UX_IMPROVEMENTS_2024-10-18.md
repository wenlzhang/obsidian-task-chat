# Scoring Terminology & UX Improvements

**Date:** 2024-10-18  
**Status:** 🎯 Analysis & Recommendations  

## Executive Summary

User identified critical terminology and UX issues:
1. ❌ "Relevance threshold" is **misleading** - it filters on COMBINED score (relevance + dueDate + priority), not just relevance
2. ❌ Internal values (0-31) are **not intuitive** for users
3. ❌ Simple Search doesn't use threshold - **inconsistent behavior**
4. ❌ Settings need better explanations

### Proposed Solutions
1. ✅ Rename to "Quality Filter" (clearer, more accurate)
2. ✅ Show as **percentage** to users (0-100%), keep 0-31 internally
3. ✅ Apply threshold to Simple Search too (with scaled range)
4. ✅ Enhanced settings UI with visual examples
5. ✅ Comprehensive README documentation

---

## 1. Current State Analysis

### Terminology Issue: "Relevance Threshold"

**The Problem:**
```typescript
relevanceThreshold: 0, // Minimum combined score (0-31)
```

**What it ACTUALLY filters:**
```
Score = relevance×20 + dueDate×4 + priority×1
Maximum: 31
```

**Why it's misleading:**
- Name says "relevance" but includes due date and priority
- Users think it only filters by keyword matching
- Maximum of 31 is not intuitive (why 31?)

### Where Threshold is Used

#### Smart Search & Task Chat: ✅ Used
```typescript
// aiService.ts line 321
qualityFilteredTasks = scoredTasks.filter((st) => st.score >= finalThreshold);
```

**Purpose:** Remove low-quality matches before display or AI analysis

**When:** AFTER scoring, BEFORE sorting/display

**Modes:** Smart Search and Task Chat only

#### Simple Search: ❌ NOT Used
```typescript
// Simple Search bypasses threshold entirely
// Just sorts all results and shows them
```

**Inconsistency:** Users get different behavior per mode

### Current Score Ranges

| Mode | Method | Score Range | Threshold Applied? |
|------|--------|-------------|-------------------|
| Simple Search | `scoreTasksByRelevance()` | 0-1.2 | ❌ No |
| Smart Search | `scoreTasksComprehensive()` | 0-31 | ✅ Yes |
| Task Chat | `scoreTasksComprehensive()` | 0-31 | ✅ Yes |

---

## 2. Proposed Improvements

### Improvement 1: Rename to "Quality Filter"

**Current Names (Misleading):**
```typescript
relevanceThreshold: number;  // Settings
Relevance threshold          // UI label
```

**Proposed Names (Clear):**
```typescript
qualityFilterStrength: number;  // Settings (0-100 percentage)
Quality Filter                  // UI label
```

**Why "Quality Filter" is better:**
1. ✅ Accurately describes function (filters quality, not just relevance)
2. ✅ No confusion about what it measures
3. ✅ Intuitive - everyone understands "quality"
4. ✅ Aligns with internal variable name (`qualityFilteredTasks`)

### Improvement 2: Percentage-Based UI

**Current (Not Intuitive):**
```
Slider: 0-31
Value: 5
User thinks: "5 what? Out of 31? Why 31?"
```

**Proposed (Intuitive):**
```
Slider: 0-100%
Display: 25% (internally: 7.75 / 31 ≈ 25%)
User thinks: "25% quality threshold - I get it!"
```

**Implementation:**
```typescript
// Internal storage: 0-1.0 (percentage as decimal)
qualityFilterStrength: number; // 0.0-1.0

// Conversion functions
function percentageToInternal(percent: number): number {
    return percent / 100; // 25% → 0.25
}

function internalToScore(internal: number, maxScore: number): number {
    return internal * maxScore; // 0.25 × 31 = 7.75
}

// In UI: show as 0-100%
slider.setValue(settings.qualityFilterStrength * 100);

// When filtering:
const threshold = settings.qualityFilterStrength * 31; // Max score
qualityFilteredTasks = scored.filter(st => st.score >= threshold);
```

**Benefits:**
- ✅ Users understand "keep top 25% quality"
- ✅ Works regardless of max score (31, 50, whatever)
- ✅ Standard UX pattern (everyone uses percentages)
- ✅ Scales automatically if we change formula

### Improvement 3: Apply to Simple Search

**Current Problem:**
- Smart/Chat: Filtered by threshold
- Simple: Shows ALL results (no filtering)
- Inconsistent user experience

**Proposed Solution:**

**Option A: Scale Simple Search scores to 0-31**
```typescript
// Make Simple Search use comprehensive scoring
scoreTasksComprehensive(
    tasks,
    keywords,    // All keywords
    keywords,    // Treat all as "core" (no expansion)
    false,       // No due date in query
    false,       // No priority in query  
    sortOrder
);
// Now scores are 0-31, threshold applies directly
```

**Option B: Scale threshold to Simple Search range**
```typescript
// Keep Simple Search at 0-1.2, scale threshold
const simpleMaxScore = 1.2;
const comprehensiveMaxScore = 31;

// Scale threshold based on mode
if (mode === "simple") {
    const scaledThreshold = threshold * (simpleMaxScore / comprehensiveMaxScore);
    // threshold 5 → 5 × (1.2/31) = 0.19
}
```

**Recommendation: Option A**
- Simpler implementation
- Consistent behavior across modes
- Simple Search can still be fast (no semantic expansion)

### Improvement 4: Enhanced Settings UI

**Current:**
```
Relevance threshold
Slider: 0-31
Description: Technical explanation
```

**Proposed:**
```
Quality Filter
Slider: 0-100% with visual zones

Visual Scale:
├─────────┬─────────┬─────────┬─────────┤
0%     25%      50%      75%     100%
🟢      🟡       🟠       🔴
Permissive        Strict

Description:
Controls how strictly tasks are filtered before display. Higher = fewer but higher-quality results.

• 0%: Adaptive (recommended) - auto-adjusts based on query
• 1-25%: Permissive - broad matching, more results
• 26-50%: Balanced - moderate quality filtering  
• 51-75%: Strict - only strong matches
• 76-100%: Very strict - only near-perfect matches

Examples based on your query:
- Semantic expansion (many keywords): 10-25% recommended
- Specific queries (few keywords): 30-50% recommended
- Exact matching needed: 60-80%
```

### Improvement 5: Comprehensive README Section

**Add to README:**

```markdown
## Quality Filtering

### What is Quality Filtering?

After finding tasks that match your query, Task Chat scores each task based on:
1. **Keyword relevance** (20× weight) - How well keywords match
2. **Due date urgency** (4× weight) - How soon it's due
3. **Priority level** (1× weight) - Task importance

The Quality Filter removes low-scoring tasks before showing results.

### How to Configure

**Settings → Task Display → Quality Filter**

Slider: 0-100%
- **0% (Adaptive)**: Recommended - automatically adjusts based on your query
- **Low (1-25%)**: More results, broader matching
- **Medium (26-50%)**: Balanced filtering
- **High (51-75%)**: Strict, fewer results
- **Very High (76-100%)**: Only near-perfect matches

### When to Adjust

**Use Lower (10-25%):**
- Exploring broadly
- Semantic expansion with many keywords
- Want to see all potentially relevant tasks

**Use Medium (30-50%):**
- Daily task management
- Balanced between quantity and quality
- Default for most users

**Use Higher (60-80%):**
- Need exact matches
- Specific queries with clear criteria
- Want only top-quality results

### Examples

**Query:** "fix bug priority 1 due today"
- **0% (Adaptive)**: 8 tasks (all matches, auto-adjusted)
- **25%**: 6 tasks (removed weak keyword matches)
- **50%**: 3 tasks (only strong relevance + priority + due date)
- **75%**: 1 task (near-perfect match on all criteria)

### Mode Differences

**Simple Search:**
- Filters based on keyword matching only
- No semantic expansion
- Fast and straightforward

**Smart Search:**
- Filters on combined score (keywords + due date + priority)
- Uses semantic expansion
- More intelligent matching

**Task Chat:**
- Same filtering as Smart Search
- Then sends top results to AI for analysis
- AI provides recommendations from filtered set
```

---

## 3. DataView API Usage Clarification

### Current Usage (Correct ✅)

**DataView API is used for:**
1. ✅ **Task fetching** - Get all tasks from vault
2. ✅ **Metadata extraction** - Parse due dates, priorities, tags, etc.
3. ✅ **Field mapping** - Handle emoji shorthands, inline fields, frontmatter

**Our code handles:**
1. ✅ **Keyword matching** - Filter by keywords using `text.includes()`
2. ✅ **Scoring** - Calculate relevance + due date + priority
3. ✅ **Sorting** - Multi-criteria sorting (relevance → due date → priority)
4. ✅ **Quality filtering** - Apply threshold to remove low-quality matches

### Why We Don't Use DataView for Scoring/Sorting

**DataView can't do:**
- ❌ Semantic keyword expansion
- ❌ Multi-language matching
- ❌ Weighted scoring (relevance×20 + due date×4 + priority×1)
- ❌ Adaptive thresholds
- ❌ AI-powered analysis

**Our approach:**
```
DataView API → Extract tasks & metadata
              ↓
Our code → Filter, score, sort, analyze
         ↓
Results → Display or send to AI
```

**This is correct!** DataView provides data, we add intelligence.

---

## 4. Implementation Plan

### Phase 1: Rename & Percentage (Critical)

#### Step 1.1: Update Settings Interface
```typescript
// settings.ts

// OLD:
relevanceThreshold: number; // 0-31

// NEW:
qualityFilterStrength: number; // 0.0-1.0 (percentage as decimal)
```

#### Step 1.2: Update Default Value
```typescript
// OLD:
relevanceThreshold: 0, // 0-31 scale

// NEW:
qualityFilterStrength: 0.0, // 0% = adaptive
```

#### Step 1.3: Update Settings UI
```typescript
// settingsTab.ts

new Setting(containerEl)
    .setName("Quality filter")
    .setDesc(
        `Controls task filtering strictness (0-100%). Higher = fewer but higher-quality results.
        
• 0%: Adaptive (recommended) - auto-adjusts based on query
• 1-25%: Permissive - broad matching, more results
• 26-50%: Balanced - moderate filtering
• 51-75%: Strict - only strong matches
• 76-100%: Very strict - near-perfect matches only

💡 Start with 0% (adaptive) and adjust if needed.`
    )
    .addSlider((slider) =>
        slider
            .setLimits(0, 100, 1) // Show as percentage
            .setValue(this.plugin.settings.qualityFilterStrength * 100)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.qualityFilterStrength = value / 100;
                await this.plugin.saveSettings();
            }),
    );
```

#### Step 1.4: Update Threshold Calculation
```typescript
// aiService.ts

// Convert percentage to actual score threshold
const maxScore = 31; // For comprehensive scoring
let baseThreshold: number;

if (settings.qualityFilterStrength === 0) {
    // Adaptive mode - calculate based on query
    if (intent.keywords.length >= 20) {
        baseThreshold = 3;
    } else if (intent.keywords.length >= 4) {
        baseThreshold = 5;
    } else {
        baseThreshold = 8;
    }
} else {
    // User-defined percentage
    baseThreshold = settings.qualityFilterStrength * maxScore;
    // e.g., 25% → 0.25 × 31 = 7.75
}

console.log(
    `[Task Chat] Quality filter: ${(settings.qualityFilterStrength * 100).toFixed(0)}% (threshold: ${baseThreshold.toFixed(1)} / ${maxScore})`
);
```

### Phase 2: Apply to Simple Search

#### Option: Use Comprehensive Scoring

```typescript
// aiService.ts - for Simple Search mode

if (chatMode === "simple") {
    // Use comprehensive scoring even for Simple Search
    // But without semantic expansion (keywords = coreKeywords)
    scoredTasks = TaskSearchService.scoreTasksComprehensive(
        filteredTasks,
        intent.keywords,    // No expansion
        intent.keywords,    // All keywords are "core"
        false,              // No due date filter
        false,              // No priority filter
        displaySortOrder
    );
    
    // Apply threshold (now works consistently)
    if (settings.qualityFilterStrength > 0) {
        const threshold = settings.qualityFilterStrength * 31;
        qualityFilteredTasks = scoredTasks
            .filter(st => st.score >= threshold)
            .map(st => st.task);
    } else {
        qualityFilteredTasks = scoredTasks.map(st => st.task);
    }
}
```

### Phase 3: Update Logging

```typescript
// Better logging messages

// OLD:
console.log(`Quality filter threshold: ${threshold}`);

// NEW:
console.log(
    `[Task Chat] Quality filter: ${(percentage * 100).toFixed(0)}% ` +
    `(threshold: ${threshold.toFixed(1)} / ${maxScore}) ` +
    `${percentage === 0 ? '(adaptive)' : '(user-defined)'}`
);

// Example output:
// [Task Chat] Quality filter: 25% (threshold: 7.8 / 31) (user-defined)
// [Task Chat] Quality filter: 0% (threshold: 5.0 / 31) (adaptive)
```

### Phase 4: Migration Code

```typescript
// main.ts - onload()

async onload() {
    await this.loadSettings();
    
    // Migrate old relevanceThreshold (0-31) to qualityFilterStrength (0.0-1.0)
    if ('relevanceThreshold' in this.settings) {
        const oldValue = (this.settings as any).relevanceThreshold;
        
        if (oldValue === 0) {
            // Was adaptive, keep adaptive
            this.settings.qualityFilterStrength = 0.0;
        } else {
            // Convert: (oldValue / 31) = percentage
            this.settings.qualityFilterStrength = oldValue / 31;
        }
        
        // Remove old setting
        delete (this.settings as any).relevanceThreshold;
        await this.saveSettings();
        
        console.log(
            `[Task Chat] Migrated quality filter: ${oldValue}/31 → ${(this.settings.qualityFilterStrength * 100).toFixed(0)}%`
        );
    }
    
    // Rest of initialization...
}
```

---

## 5. Visual Settings Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ Quality Filter                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Controls task filtering strictness. Higher = fewer but      │
│ higher-quality results.                                      │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │  0%        25%        50%        75%       100%        │  │
│ │  ├─────────┼─────────┼──────────┼──────────┤          │  │
│ │  🟢                                          🔴        │  │
│ │  ●─────────────────────────────────────────○          │  │
│ │            Current: 25%                                │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ 💡 Recommendations:                                         │
│  • 0%: Adaptive (recommended) - auto-adjusts                │
│  • 1-25%: Permissive - more results                         │
│  • 26-50%: Balanced - moderate filtering                    │
│  • 51-75%: Strict - only strong matches                     │
│  • 76-100%: Very strict - near-perfect only                 │
│                                                              │
│ Current setting: 25% (Permissive)                           │
│ Effective threshold: ~7.8 / 31 max score                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. README Section (Complete)

```markdown
# Quality Filtering

## Overview

Task Chat scores each task based on multiple factors:
- **Keyword relevance** (20× weight)
- **Due date urgency** (4× weight)  
- **Priority level** (1× weight)

The Quality Filter removes low-scoring tasks before display.

## Configuration

**Settings → Task Display → Quality Filter**

- **Slider:** 0-100%
- **Default:** 0% (Adaptive - recommended)

### Filter Levels

| Level | Percentage | Description | Use When |
|-------|-----------|-------------|-----------|
| Adaptive | 0% | Auto-adjusts based on query | Recommended for most users |
| Permissive | 1-25% | Broad matching, more results | Exploring, semantic expansion |
| Balanced | 26-50% | Moderate quality filtering | Daily task management |
| Strict | 51-75% | Only strong matches | Specific requirements |
| Very Strict | 76-100% | Near-perfect matches only | Exact matching needed |

## Examples

**Query:** "fix urgent bug"
**Semantic expansion:** 45 keywords total

### Results by Filter Level:

**0% (Adaptive):**
- Auto-calculates threshold: ~10%
- Returns: 12 tasks
- Includes: All relevant matches

**25% (Permissive):**
- Threshold: 7.8 / 31 points
- Returns: 8 tasks
- Removed: Weak keyword matches

**50% (Balanced):**
- Threshold: 15.5 / 31 points
- Returns: 4 tasks
- Kept: Strong relevance + metadata

**75% (Strict):**
- Threshold: 23.3 / 31 points
- Returns: 1 task
- Kept: Near-perfect match only

## Mode-Specific Behavior

### Simple Search
- Fast keyword matching
- No semantic expansion
- Filter based on keyword relevance only
- Scores: 0-31 (using relevance×20)

### Smart Search
- AI keyword expansion
- Semantic matching across languages
- Filter on combined score (relevance + date + priority)
- Scores: 0-31 (full weighted scoring)

### Task Chat
- Same filtering as Smart Search
- Top-scored tasks sent to AI
- AI analyzes and recommends from filtered set
- Final recommendations: Subset of filtered tasks

## Tips

1. **Start with 0% (Adaptive)** - The system will adjust automatically
2. **Too many results?** Increase to 30-50%
3. **Too few results?** Decrease to 10-25% or set to 0%
4. **Semantic expansion** queries work best with 10-25%
5. **Exact queries** may need 50-75%

## Technical Details

### Score Calculation
```
Final Score = (Relevance × 20) + (Due Date × 4) + (Priority × 1)
Maximum: 31 points
```

### Threshold Application
```
Filter Strength (%) → Threshold (score)
25% → 7.75 points (keep tasks scoring ≥ 7.75)
50% → 15.5 points (keep tasks scoring ≥ 15.5)
75% → 23.25 points (keep tasks scoring ≥ 23.25)
```

### Adaptive Mode (0%)
When set to 0%, threshold adjusts based on:
- Number of keywords (more keywords = lower threshold)
- Semantic expansion detected (permissive threshold)
- Query complexity (simpler = higher threshold)

Default adaptive thresholds:
- 20+ keywords: ~10% (3/31 points)
- 4-19 keywords: ~16% (5/31 points)
- 2-3 keywords: ~26% (8/31 points)
- 1 keyword: ~32% (10/31 points)
```

---

## 7. Benefits Summary

### For Users

**Before (Confusing):**
- ❌ "Relevance threshold" - what does that mean?
- ❌ "0-31" - why 31?
- ❌ Different behavior per mode (inconsistent)
- ❌ Technical jargon

**After (Clear):**
- ✅ "Quality Filter" - everyone understands
- ✅ "0-100%" - intuitive percentage
- ✅ Same behavior across modes (consistent)
- ✅ Plain language with examples

### For Developers

**Before:**
- ❌ Hard-coded score range (31)
- ❌ Inconsistent application (only 2/3 modes)
- ❌ Percentage calculations scattered

**After:**
- ✅ Percentage-based (scales with any max score)
- ✅ Applied consistently (all 3 modes)
- ✅ Centralized conversion logic

### For Maintenance

**Before:**
- ❌ If formula changes, must update threshold range
- ❌ If max score changes, must update UI
- ❌ Must remember 31 is the magic number

**After:**
- ✅ Percentage works regardless of max score
- ✅ Formula changes don't affect UI
- ✅ Self-documenting code

---

## 8. Testing Plan

### Test 1: Percentage Conversion
```
Set to 25% → Internal: 0.25 → Threshold: 7.75/31
Set to 50% → Internal: 0.50 → Threshold: 15.5/31
Set to 75% → Internal: 0.75 → Threshold: 23.25/31
```

### Test 2: Adaptive Mode
```
Setting: 0%
Query with 30 keywords → Threshold: ~3/31 (10%)
Query with 5 keywords → Threshold: ~5/31 (16%)
Query with 1 keyword → Threshold: ~10/31 (32%)
```

### Test 3: Cross-Mode Consistency
```
Query: "fix bug"
Simple Search → Filter applied → X tasks
Smart Search → Filter applied → Y tasks (may differ due to expansion)
Task Chat → Same filtering as Smart Search
```

### Test 4: Migration
```
Old setting: relevanceThreshold = 15 (out of 31)
After migration: qualityFilterStrength = 0.484 (48.4%)
Effective threshold: 0.484 × 31 = 15 ✓ (same as before)
```

---

## 9. Summary

### What Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Name** | "Relevance threshold" | "Quality filter" |
| **Scale** | 0-31 (internal) | 0-100% (user-facing) |
| **Default** | 0 (was 30, then 0) | 0% (adaptive) |
| **Simple Search** | Not applied | Applied consistently |
| **Settings UI** | Technical, confusing | Intuitive, with examples |
| **README** | Basic | Comprehensive guide |

### Migration Path

1. ✅ Settings migration (automatic)
2. ✅ Percentage conversion (seamless)
3. ✅ Backward compatible (old threshold → percentage)
4. ✅ No user action required

### Priority

1. **Critical:** Rename + percentage (Phase 1)
2. **High:** Apply to Simple Search (Phase 2)
3. **Medium:** Enhanced UI (Phase 3)
4. **Low:** README expansion (Phase 4)

---

**Ready to implement?** Let me know and I'll start with Phase 1! 🚀
