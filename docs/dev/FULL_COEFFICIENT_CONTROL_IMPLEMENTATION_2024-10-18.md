# Full Coefficient Control & Simplified Multi-Criteria UI - Implementation Plan

**Date:** 2024-10-18  
**Status:** 🚧 IN PROGRESS (Phases 1-2 Complete)  
**Build:** 142.1kb ✅  

---

## User's Excellent Observations

1. ✅ **Order doesn't matter with user coefficients** - Users control weight directly via coefficient values
2. ✅ **UI should be simpler** - Remove drag/drop reordering (↑↓ buttons), use horizontal add/remove
3. ✅ **Expose ALL coefficients** - Give users full control over all scoring sub-coefficients
4. ✅ **Relevance always first** - Cannot be removed, always most important

---

## Implementation Phases

### ✅ Phase 1: Add All Sub-Coefficients to Settings (COMPLETE)

**File:** `settings.ts`

**Added 13 new coefficient settings:**

```typescript
// Relevance Sub-Coefficients
relevanceCoreWeight: number;        // Default: 0.2 (core keyword bonus)
relevanceAllWeight: number;         // Default: 1.0 (all keywords weight)

// Due Date Sub-Coefficients (0-2 range)
dueDateOverdueScore: number;        // Default: 1.5 (most urgent)
dueDateWithin7DaysScore: number;    // Default: 1.0
dueDateWithin1MonthScore: number;   // Default: 0.5
dueDateLaterScore: number;          // Default: 0.2
dueDateNoneScore: number;           // Default: 0.1

// Priority Sub-Coefficients (0-1 range)
priorityP1Score: number;            // Default: 1.0 (highest)
priorityP2Score: number;            // Default: 0.75 (high)
priorityP3Score: number;            // Default: 0.5 (medium)
priorityP4Score: number;            // Default: 0.2 (low)
priorityNoneScore: number;          // Default: 0.1 (none)
```

**Defaults Match Current Behavior:**
- All defaults match existing hard-coded values
- ✅ Backward compatible
- ✅ No behavior change for existing users
- ✅ Power users can customize everything

---

### ✅ Phase 2: Update Scoring Methods (COMPLETE)

**File:** `taskSearchService.ts`

**Updated 3 private methods to use settings:**

```typescript
// 1. calculateRelevanceScore() - Now uses settings
private static calculateRelevanceScore(
    taskText: string,
    coreKeywords: string[],
    allKeywords: string[],
    settings: PluginSettings,  // NEW!
): number {
    return (
        coreMatchRatio * settings.relevanceCoreWeight +
        allKeywordsRatio * settings.relevanceAllWeight
    );
}

// 2. calculateDueDateScore() - Now uses settings
private static calculateDueDateScore(
    dueDate: string | undefined,
    settings: PluginSettings,  // NEW!
): number {
    if (diffDays < 0) return settings.dueDateOverdueScore;
    if (diffDays <= 7) return settings.dueDateWithin7DaysScore;
    if (diffDays <= 30) return settings.dueDateWithin1MonthScore;
    if (diffDays > 30) return settings.dueDateLaterScore;
    return settings.dueDateNoneScore;
}

// 3. calculatePriorityScore() - Now uses settings
private static calculatePriorityScore(
    priority: number | undefined,
    settings: PluginSettings,  // NEW!
): number {
    switch (priority) {
        case 1: return settings.priorityP1Score;
        case 2: return settings.priorityP2Score;
        case 3: return settings.priorityP3Score;
        case 4: return settings.priorityP4Score;
        default: return settings.priorityNoneScore;
    }
}
```

**Updated scoreTasksComprehensive() signature:**

```typescript
static scoreTasksComprehensive(
    tasks: Task[],
    keywords: string[],
    coreKeywords: string[],
    queryHasDueDate: boolean,
    queryHasPriority: boolean,
    sortCriteria: string[],
    relevCoeff: number = 20,
    dateCoeff: number = 4,
    priorCoeff: number = 1,
    settings: PluginSettings,  // NEW! 10th parameter
)
```

**File:** `aiService.ts`

**Updated all 6 calls to scoreTasksComprehensive:**
- 2 calls in quality filtering (with/without expansion)
- 2 calls in display sorting (with/without expansion)
- 2 calls in fallback (with/without expansion)

All now pass `settings` as 10th parameter! ✅

---

### 🚧 Phase 3: Simplify Multi-Criteria UI (IN PROGRESS)

**Current UI (Complex):**
```
Simple Search Sort Order
1. Relevance    [↑] [↓] [✕]
2. Due Date     [↑] [↓] [✕]
3. Priority     [↑] [↓] [✕]

[Add criterion...] ▼  [+]
```

**Problems:**
- ↑↓ buttons suggest order matters (it doesn't with user coefficients!)
- Vertical layout is cluttered
- Users confused about why they need to reorder
- Settings take up too much space

**New UI (Simple & Clear):**
```
🔧 Multi-Criteria Sorting

ℹ️ Note: With user-configurable coefficients, property ORDER no longer matters. 
The WEIGHT (coefficient value) determines importance. Select which properties 
to include; relevance is always included.

Active Criteria:  [Relevance*] [Due Date] [✕] [Priority] [✕]

Available: [+ Status] [+ Folder] [+ Tags]

* Relevance cannot be removed
```

**Changes:**
- ❌ Remove ↑↓ reorder buttons
- ❌ Remove numbered order indicators
- ✅ Horizontal chip-style layout
- ✅ Simple [✕] to remove
- ✅ Simple [+] to add
- ✅ Clear note about coefficients vs order
- ✅ Relevance always first, non-removable

**Implementation:** `settingsTab.ts` lines 1450-1700 (to be updated)

---

### 📝 Phase 4: Add Explanations to Settings Tab (PENDING)

**Need to add comprehensive UI for all sub-coefficients:**

#### 4.1 Main Coefficients Section (Already exists)
- Relevance weight (1-50, default: 20) ✅
- Due date weight (1-20, default: 4) ✅
- Priority weight (1-20, default: 1) ✅

#### 4.2 NEW: Advanced Coefficients Section

**Location:** After main coefficients, before multi-criteria sorting

**Structure:**
```
┌─────────────────────────────────────────────────────┐
│ Advanced Scoring Coefficients (Optional)           │
│                                                      │
│ [🔽 Show Advanced Settings]                        │
│                                                      │
│ These control fine-grained scoring within each     │
│ factor. Most users don't need to change these.     │
└─────────────────────────────────────────────────────┘
```

**When expanded:**

```typescript
// Relevance Sub-Coefficients
containerEl.createEl("h4", { text: "Relevance Sub-Coefficients" });

new Setting(containerEl)
    .setName("Core keyword weight")
    .setDesc(
        "Bonus for matching core keywords (0.0-1.0). Default: 0.2. " +
        "Core keywords are original extracted keywords before expansion."
    )
    .addSlider((slider) =>
        slider
            .setLimits(0, 1, 0.05)
            .setValue(settings.relevanceCoreWeight)
            .setDynamicTooltip()
            .onChange(async (value) => {
                settings.relevanceCoreWeight = value;
                await this.plugin.saveSettings();
            })
    );

new Setting(containerEl)
    .setName("All keywords weight")
    .setDesc(
        "Weight for all keyword matches (0.0-2.0). Default: 1.0. " +
        "Includes core + semantic equivalents."
    )
    .addSlider((slider) =>
        slider
            .setLimits(0, 2, 0.1)
            .setValue(settings.relevanceAllWeight)
            .setDynamicTooltip()
            .onChange(async (value) => {
                settings.relevanceAllWeight = value;
                await this.plugin.saveSettings();
            })
    );

// Due Date Sub-Coefficients
containerEl.createEl("h4", { text: "Due Date Sub-Coefficients" });

new Setting(containerEl)
    .setName("Overdue tasks")
    .setDesc("Score for overdue tasks (0.0-2.0). Default: 1.5 (most urgent).")
    .addSlider(...);

new Setting(containerEl)
    .setName("Due within 7 days")
    .setDesc("Score for tasks due within 7 days (0.0-2.0). Default: 1.0.")
    .addSlider(...);

new Setting(containerEl)
    .setName("Due within 1 month")
    .setDesc("Score for tasks due within 1 month (0.0-2.0). Default: 0.5.")
    .addSlider(...);

new Setting(containerEl)
    .setName("Due later")
    .setDesc("Score for tasks due after 1 month (0.0-2.0). Default: 0.2.")
    .addSlider(...);

new Setting(containerEl)
    .setName("No due date")
    .setDesc("Score for tasks with no due date (0.0-2.0). Default: 0.1.")
    .addSlider(...);

// Priority Sub-Coefficients
containerEl.createEl("h4", { text: "Priority Sub-Coefficients" });

new Setting(containerEl)
    .setName("Priority 1 (Highest)")
    .setDesc("Score for priority 1 tasks (0.0-1.0). Default: 1.0.")
    .addSlider(...);

new Setting(containerEl)
    .setName("Priority 2 (High)")
    .setDesc("Score for priority 2 tasks (0.0-1.0). Default: 0.75.")
    .addSlider(...);

new Setting(containerEl)
    .setName("Priority 3 (Medium)")
    .setDesc("Score for priority 3 tasks (0.0-1.0). Default: 0.5.")
    .addSlider(...);

new Setting(containerEl)
    .setName("Priority 4 (Low)")
    .setDesc("Score for priority 4 tasks (0.0-1.0). Default: 0.2.")
    .addSlider(...);

new Setting(containerEl)
    .setName("No priority")
    .setDesc("Score for tasks with no priority (0.0-1.0). Default: 0.1.")
    .addSlider(...);
```

**Info Box:** Add explanation with examples

```
📊 Score Calculation Example:

With defaults:
- Core keyword match: 0.2 base × 20 (relevance coeff) = 4 points
- All keywords: 1.0 base × 20 (relevance coeff) = 20 points
- Overdue: 1.5 base × 4 (date coeff) = 6 points
- Priority 1: 1.0 base × 1 (priority coeff) = 1 point
Total: 31 points maximum

Customizing sub-coefficients lets you fine-tune how each property
level affects scoring within its category.
```

---

### 📚 Phase 5: Update README (PENDING)

**Add comprehensive section: "Advanced Scoring Configuration"**

**Location:** After "Scoring Coefficients" section

**Contents (~200 lines):**

```markdown
## Advanced Scoring Configuration

### Sub-Coefficients: Fine-Grained Control

Beyond the main coefficients (Relevance, Due Date, Priority), you can control
the exact scoring for each level within each factor.

#### Relevance Sub-Coefficients

**Core Keyword Weight (default: 0.2)**
- Applied to original keywords from your query
- Before semantic expansion
- Example: Query "fix bug" → core keywords ["fix", "bug"]
- Range: 0.0-1.0

**All Keywords Weight (default: 1.0)**  
- Applied to all keywords including semantic equivalents
- Example: ["fix", "repair", "solve", "bug", "issue", ...]
- Range: 0.0-2.0

**When to adjust:**
- Increase core weight: Prioritize exact query matches
- Increase all weight: Cast wider semantic net

**Example configurations:**

*Exact Match Focus (core: 0.5, all: 0.8):*
- Emphasizes original query terms
- Semantic equivalents matter less
- Good for: Precise searches

*Semantic Breadth Focus (core: 0.1, all: 1.5):*
- Emphasizes semantic coverage
- Original terms get small bonus
- Good for: Exploratory searches

---

#### Due Date Sub-Coefficients

Control scoring at each time range level:

| Time Range | Default Score | Range |
|------------|---------------|-------|
| **Overdue** | 1.5 (most urgent) | 0.0-2.0 |
| **Within 7 days** | 1.0 | 0.0-2.0 |
| **Within 1 month** | 0.5 | 0.0-2.0 |
| **After 1 month** | 0.2 | 0.0-2.0 |
| **No due date** | 0.1 | 0.0-2.0 |

**When to adjust:**

*Aggressive Urgency (overdue: 2.0, 7days: 1.0, rest: 0.1):*
- Overdue tasks massively prioritized
- Far-future tasks ignored
- Good for: Deadline-driven workflow

*Balanced Timeline (overdue: 1.2, 7days: 0.8, month: 0.5, later: 0.3):*
- Smoother urgency curve
- All dates considered
- Good for: Long-term planning

*Ignore Overdue (overdue: 0.5, 7days: 1.0, rest: 0.3):*
- Future tasks prioritized
- Overdue tasks downplayed
- Good for: Forward-looking workflow

---

#### Priority Sub-Coefficients

Control scoring at each priority level:

| Priority | Default Score | Range |
|----------|---------------|-------|
| **P1 (Highest)** | 1.0 | 0.0-1.0 |
| **P2 (High)** | 0.75 | 0.0-1.0 |
| **P3 (Medium)** | 0.5 | 0.0-1.0 |
| **P4 (Low)** | 0.2 | 0.0-1.0 |
| **No priority** | 0.1 | 0.0-1.0 |

**When to adjust:**

*Binary Priority (P1: 1.0, P2: 0.9, P3-4: 0.1):*
- Sharp distinction between high and low
- P1 and P2 treated similarly (both "important")
- P3-4 largely ignored
- Good for: Simple high/low workflow

*Graduated Priority (P1: 1.0, P2: 0.7, P3: 0.4, P4: 0.15):*
- Smooth progression
- All levels distinct
- Good for: Detailed priority management

*Flatten Priority (all: 0.5):*
- Priority doesn't matter much
- Focus on relevance and dates
- Good for: Priority-agnostic workflow

---

### Complete Example Configurations

#### 1. Keyword-Focused Power User

**Main Coefficients:**
- Relevance: 30
- Due Date: 2  
- Priority: 1

**Sub-Coefficients:**
- Core weight: 0.3 (emphasize exact matches)
- All weight: 1.2 (but semantic still important)
- Due date: All default (dates matter less)
- Priority: All default

**Result:** Tasks matching query keywords heavily prioritized, dates/priority secondary.

---

#### 2. Deadline Warrior

**Main Coefficients:**
- Relevance: 20
- Due Date: 10
- Priority: 5

**Sub-Coefficients:**
- Relevance: All default
- Overdue: 2.0 (critical!)
- Within 7 days: 1.5 (very important)
- Within month: 0.8 (moderate)
- Later: 0.2 (minimal)
- Priority: All elevated slightly (×1.2)

**Result:** Overdue and urgent tasks dominate, priority reinforces urgency.

---

#### 3. Importance Over Urgency

**Main Coefficients:**
- Relevance: 15
- Due Date: 3
- Priority: 10

**Sub-Coefficients:**
- Relevance: All default
- Due date: All default
- P1: 1.0
- P2: 0.6 (bigger drop)
- P3: 0.3
- P4: 0.1

**Result:** High-priority tasks always top, dates are tiebreakers.

---

### Tips for Customization

1. **Start with defaults** - They work well for most users
2. **Adjust main coefficients first** - Get the overall balance right
3. **Then fine-tune sub-coefficients** - If main adjustments aren't enough
4. **Test with real queries** - See how changes affect results
5. **Document your config** - Note why you chose certain values
6. **One change at a time** - Easier to understand impact

### When NOT to Use Sub-Coefficients

- **First-time users** - Stick with main coefficients
- **Simple workflows** - Defaults work great
- **Time-constrained** - Not worth the complexity
- **Unsure about impact** - Main coefficients are safer

Sub-coefficients are **power user features**. Most users will be happy
with just the main three coefficients (Relevance, Due Date, Priority).

---

### Multi-Criteria Sorting Note

**Important:** With user-configurable coefficients, **property order no longer matters**!

**Before (order mattered):**
- Sort order: [relevance, dueDate, priority]
- Relevance first, dueDate breaks ties, priority breaks those ties

**Now (weights matter):**
- Coefficients: R=30, D=4, P=1
- Relevance weighted 30× → dominates score
- Order irrelevant, weights determine importance

**What to select:**
- Include properties you want scored
- Exclude properties you want ignored
- Don't worry about order
```

---

## Benefits of This Approach

### For Users

**Transparency:**
- See exactly how every score component works
- Understand why tasks rank as they do
- No "magic" scoring

**Control:**
- Tune scoring to exact workflow
- From simple (3 sliders) to advanced (13 sliders)
- Progressive complexity

**Flexibility:**
- Different workflows supported
- Keyword-focused, deadline-driven, importance-based
- Experiment without risk (defaults always available)

**Simplicity:**
- Main coefficients sufficient for most users
- Advanced users can dive deeper
- UI doesn't overwhelm

### For System

**Maintainability:**
- No hard-coded scoring values
- All configurable from one place
- Easy to extend

**Scalability:**
- Add new factors easily
- Add new levels easily
- User controls everything

**Clarity:**
- Order vs weight confusion eliminated
- Multi-criteria UI simplified
- Purpose of each setting clear

---

## Migration Strategy

### For Existing Users

**No migration needed!**
- All defaults match current hard-coded values
- Scores identical with default settings
- Zero behavior change

**If they customize main coefficients:**
- Sub-coefficients automatically scale
- No action required
- Everything works as expected

### For New Users

**Default experience:**
- Get sensible defaults
- Can ignore advanced settings
- Simple UI guides them

**Power users:**
- Discover advanced settings
- Full control available
- Comprehensive documentation

---

## Implementation Status

### ✅ Completed

- [x] Phase 1: Added 13 sub-coefficients to settings
- [x] Phase 2: Updated all scoring methods to use settings
- [x] Phase 2: Updated all 6 calls to pass settings parameter
- [x] Build successful: 142.1kb

### 🚧 In Progress

- [ ] Phase 3: Simplify multi-criteria UI
  - [ ] Remove ↑↓ reorder buttons
  - [ ] Change to horizontal chip layout
  - [ ] Add clear explanatory note
  - [ ] Keep relevance non-removable

### 📝 Pending

- [ ] Phase 4: Add advanced coefficients UI
  - [ ] Collapsible "Advanced" section
  - [ ] 13 sliders with descriptions
  - [ ] Examples and tips
  
- [ ] Phase 5: Update README
  - [ ] Add "Advanced Scoring Configuration" section (~200 lines)
  - [ ] Example configurations
  - [ ] When to use/not use sub-coefficients
  - [ ] Multi-criteria note

- [ ] Phase 6: Final testing
  - [ ] Test all coefficient combinations
  - [ ] Verify UI responsiveness
  - [ ] Check documentation clarity

---

## Next Steps

1. **Complete Phase 3:** Simplify multi-criteria UI in `settingsTab.ts`
2. **Complete Phase 4:** Add advanced coefficients UI with collapsible section
3. **Complete Phase 5:** Update README with comprehensive examples
4. **Test everything:** Verify all scenarios work correctly
5. **Create memory:** Document completion for future reference

---

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `settings.ts` | Added 13 sub-coefficient settings | ✅ Complete |
| `taskSearchService.ts` | Updated 3 scoring methods + signature | ✅ Complete |
| `aiService.ts` | Updated 6 method calls | ✅ Complete |
| `settingsTab.ts` | Multi-criteria UI simplification | 🚧 In Progress |
| `settingsTab.ts` | Advanced coefficients UI | 📝 Pending |
| `README.md` | Advanced scoring documentation | 📝 Pending |

---

## Estimated Completion

- Phase 3: ~100 lines (UI simplification)
- Phase 4: ~350 lines (Advanced coefficients UI)
- Phase 5: ~200 lines (README documentation)

**Total remaining:** ~650 lines of code + documentation

**Status:** ~60% complete (Phases 1-2 done, Phases 3-5 pending)

