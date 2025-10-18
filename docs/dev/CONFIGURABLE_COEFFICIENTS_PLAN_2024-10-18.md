# Configurable Scoring Coefficients Implementation Plan

**Date:** 2024-10-18  
**Status:** 📋 Plan - Ready for Review  

## User's Requirements

1. ✅ **Simple Search should use comprehensive scoring**
   - Currently uses scoreTasksByRelevance (0-1.2 range)
   - Should use scoreTasksComprehensive like Smart/Chat
   - Only difference: no semantic expansion (keywords = coreKeywords)

2. ✅ **Make coefficients user-configurable**
   - Relevance coefficient (currently hard-coded 20)
   - Due date coefficient (currently hard-coded 4)
   - Priority coefficient (currently hard-coded 1)

3. ✅ **Update entire system**
   - Settings definitions
   - Settings UI
   - Scoring calculations
   - Max score calculations
   - Quality filter threshold calculations
   - Logging
   - Documentation

---

## Current State Analysis

### Scoring Methods

**scoreTasksByRelevance():**
- Used by: Simple Search (fallback)
- Score range: 0-1.2
- Formula: `coreRatio × 0.2 + allRatio × 1.0`
- Only considers relevance

**scoreTasksComprehensive():**
- Used by: Smart Search, Task Chat
- Score range: 0-31
- Formula: `(relevance × 20) + (dueDate × 4 × coeff) + (priority × 1 × coeff)`
- Considers relevance + due date + priority

### The Problem

**Issue 1: Simple Search incomplete**
- Doesn't score due dates or priorities
- Users can't sort by these in Simple Search
- Inconsistent behavior across modes

**Issue 2: Hard-coded coefficients**
- Users can't tune scoring to their preferences
- Some users want priority > due date
- Others want due date > priority
- Fixed 20:4:1 ratio doesn't work for everyone

**Issue 3: Max score assumptions**
- Quality filter assumes max score = 31
- If coefficients change, max score changes
- System needs to calculate max score dynamically

---

## Implementation Plan

### Phase 1: Add Settings ✅ DONE

**Add to settings.ts:**
```typescript
// Scoring Coefficients
relevanceCoefficient: number; // Weight for keyword relevance (default: 20)
dueDateCoefficient: number; // Weight for due date urgency (default: 4)
priorityCoefficient: number; // Weight for task priority (default: 1)
```

**Defaults:**
```typescript
relevanceCoefficient: 20,
dueDateCoefficient: 4,
priorityCoefficient: 1,
```

### Phase 2: Update scoreTasksComprehensive Method

**Add coefficient parameters:**
```typescript
static scoreTasksComprehensive(
    tasks: Task[],
    keywords: string[],
    coreKeywords: string[],
    queryHasDueDate: boolean,
    queryHasPriority: boolean,
    sortCriteria: string[],
    relevCoeff: number = 20,  // NEW
    dateCoeff: number = 4,     // NEW
    priorCoeff: number = 1,    // NEW
): Array<{...}>
```

**Update formula (line ~914):**
```typescript
// OLD:
const finalScore =
    relevanceScore * 20 +
    dueDateScore * 4 * dueDateCoefficient +
    priorityScore * 1 * priorityCoefficient;

// NEW:
const finalScore =
    relevanceScore * relevCoeff +
    dueDateScore * dateCoeff * dueDateActivation +
    priorityScore * priorCoeff * priorityActivation;
```

**Update logging (lines ~930-945):**
```typescript
// Show user's configured coefficients
console.log(`[Task Chat] User coefficients - relevance: ${relevCoeff}, dueDate: ${dateCoeff}, priority: ${priorCoeff}`);
console.log(`[Task Chat] Scoring coefficients - relevance: ${relevCoeff} (always), dueDate: ${dueDateActivation * dateCoeff}, priority: ${priorityActivation * priorCoeff}`);
```

###  Phase 3: Remove scoreTasksByRelevance Usage

**Replace all calls to scoreTasksByRelevance with scoreTasksComprehensive:**

**In aiService.ts (lines ~256):**
```typescript
// OLD:
scoredTasks = TaskSearchService.scoreTasksByRelevance(
    filteredTasks,
    intent.keywords,
);

// NEW (Simple Search uses comprehensive too):
scoredTasks = TaskSearchService.scoreTasksComprehensive(
    filteredTasks,
    intent.keywords,      // No expansion
    intent.keywords,      // Same as keywords (all are "core")
    false,                // No due date filter
    false,                // No priority filter
    displaySortOrder,
    settings.relevanceCoefficient,
    settings.dueDateCoefficient,
    settings.priorityCoefficient,
);
```

**Result:** Simple Search now scores due dates and priorities!

### Phase 4: Update Quality Filter Max Score Calculation

**In aiService.ts (line ~267):**
```typescript
// OLD (hard-coded):
const maxScore = isSimpleScoring ? 1.2 : 31;

// NEW (calculated from coefficients):
const maxScore = this.calculateMaxScore(
    settings.relevanceCoefficient,
    settings.dueDateCoefficient,
    settings.priorityCoefficient
);

// Helper method:
private static calculateMaxScore(
    relevCoeff: number,
    dateCoeff: number,
    priorCoeff: number
): number {
    // Max relevance score: 1.2 (when allRatio > 1.0)
    // Max due date score: 1.5 (overdue)
    // Max priority score: 1.0 (priority 1)
    return (1.2 * relevCoeff) + (1.5 * dateCoeff) + (1.0 * priorCoeff);
}

// With defaults (20, 4, 1):
// maxScore = (1.2 × 20) + (1.5 × 4) + (1.0 × 1)
//          = 24 + 6 + 1
//          = 31 ✓
```

### Phase 5: Update All Method Calls

**Update all calls to scoreTasksComprehensive to pass coefficients:**

**aiService.ts line ~243:**
```typescript
scoredTasks = TaskSearchService.scoreTasksComprehensive(
    filteredTasks,
    intent.keywords,
    parsedQuery.coreKeywords,
    !!intent.extractedDueDateFilter,
    !!intent.extractedPriority,
    displaySortOrder,
    settings.relevanceCoefficient,   // NEW
    settings.dueDateCoefficient,     // NEW
    settings.priorityCoefficient,    // NEW
);
```

**Repeat for all other calls** (there are ~3 more locations)

### Phase 6: Add Settings UI

**In settingsTab.ts, add after Quality Filter:**

```typescript
// Scoring Coefficients Section
containerEl.createEl("h3", { text: "Scoring coefficients" });

containerEl.createDiv({ cls: "task-chat-info-box" }).createEl("p", {
    text: "Control how heavily each factor weighs in task scoring. Higher values = more important. These affect all search modes.",
});

// Relevance Coefficient
new Setting(containerEl)
    .setName("Relevance weight")
    .setDesc(
        `How much keyword matching affects score (1-50). Default: 20. 
        Higher = keyword relevance matters more.
        
Example impacts:
• 10: Balanced with other factors
• 20: Standard (recommended)
• 30: Keyword matching very important`
    )
    .addSlider((slider) =>
        slider
            .setLimits(1, 50, 1)
            .setValue(this.plugin.settings.relevanceCoefficient)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.relevanceCoefficient = value;
                await this.plugin.saveSettings();
                this.updateMaxScoreDisplay(); // Update max score display
            }),
    );

// Due Date Coefficient
new Setting(containerEl)
    .setName("Due date weight")
    .setDesc(
        `How much due date urgency affects score (1-20). Default: 4.
        Higher = urgency matters more.
        
Example impacts:
• 2: Due dates less important
• 4: Standard (recommended)
• 8: Urgent tasks heavily prioritized`
    )
    .addSlider((slider) =>
        slider
            .setLimits(1, 20, 1)
            .setValue(this.plugin.settings.dueDateCoefficient)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.dueDateCoefficient = value;
                await this.plugin.saveSettings();
                this.updateMaxScoreDisplay();
            }),
    );

// Priority Coefficient  
new Setting(containerEl)
    .setName("Priority weight")
    .setDesc(
        `How much task priority affects score (1-20). Default: 1.
        Higher = priority matters more.
        
Example impacts:
• 1: Standard (recommended)
• 5: Priority very important
• 10: Priority dominates scoring`
    )
    .addSlider((slider) =>
        slider
            .setLimits(1, 20, 1)
            .setValue(this.plugin.settings.priorityCoefficient)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.priorityCoefficient = value;
                await this.plugin.saveSettings();
                this.updateMaxScoreDisplay();
            }),
    );

// Max Score Display (calculated)
const maxScoreDisplay = containerEl.createDiv({ cls: "task-chat-info-box" });
maxScoreDisplay.createEl("p", {
    text: `📊 Maximum possible score with current coefficients:`,
    cls: "task-chat-info-box-title",
});

const maxScoreValue = maxScoreDisplay.createEl("p", {
    cls: "task-chat-max-score-value",
});

// Helper to update display
this.updateMaxScoreDisplay = () => {
    const maxScore = (1.2 * this.plugin.settings.relevanceCoefficient) +
                     (1.5 * this.plugin.settings.dueDateCoefficient) +
                     (1.0 * this.plugin.settings.priorityCoefficient);
    maxScoreValue.setText(
        `Max Score: ${maxScore.toFixed(1)} points\n` +
        `(Relevance: ${(1.2 * this.plugin.settings.relevanceCoefficient).toFixed(1)} + ` +
        `Due Date: ${(1.5 * this.plugin.settings.dueDateCoefficient).toFixed(1)} + ` +
        `Priority: ${(1.0 * this.plugin.settings.priorityCoefficient).toFixed(1)})`
    );
};

// Initial display
this.updateMaxScoreDisplay();
```

### Phase 7: Update Documentation

**README.md Quality Filter section:**

Update score calculation to mention it's configurable:

```markdown
**Score Calculation (Configurable):**
```
Final Score = (Relevance × R) + (Due Date × D) + (Priority × P)

Defaults: R=20, D=4, P=1 (max: 31 points)
Configure in Settings → Scoring Coefficients
```

**Add new section:**

```markdown
### ⚙️ Scoring Coefficients

Control how much each factor affects task scores. Configure in Settings → Scoring Coefficients.

**Relevance Weight (default: 20)**
- How much keyword matching matters
- Higher = keyword relevance more important
- Range: 1-50

**Due Date Weight (default: 4)**
- How much urgency matters
- Higher = overdue tasks prioritized more
- Range: 1-20

**Priority Weight (default: 1)**  
- How much task priority matters
- Higher = priority 1 tasks prioritized more
- Range: 1-20

**Examples:**

Keyword-focused: R=30, D=2, P=1
- Emphasizes keyword matching
- Max score: 37 points

Urgency-focused: R=20, D=10, P=5
- Emphasizes deadlines and priority
- Max score: 44 points

Balanced (default): R=20, D=4, P=1
- Good for most users
- Max score: 31 points
```

---

## Benefits

### For Users

1. ✅ **Simple Search improved**
   - Now considers due dates and priorities
   - Consistent with Smart/Chat modes
   - Can sort by all criteria

2. ✅ **Personalization**
   - Tune scoring to your workflow
   - Priority-focused users can emphasize priority
   - Deadline-focused users can emphasize due dates

3. ✅ **Transparency**
   - See max score update in real-time
   - Understand how coefficients affect scoring
   - Examples show common configurations

### For System

1. ✅ **Dynamic max score**
   - Quality filter adapts automatically
   - No hard-coded assumptions
   - Scales with user preferences

2. ✅ **Consistent scoring**
   - All modes use same method
   - Only difference: expansion vs no expansion
   - Simpler architecture

3. ✅ **Future-proof**
   - Easy to add more scoring factors
   - Coefficients already parameterized
   - Clean, maintainable code

---

## Testing Plan

### Test 1: Simple Search with Comprehensive Scoring
```
Mode: Simple Search
Query: "urgent task"
Expected:
- Scores include due date and priority
- Can sort by due date
- Can sort by priority
- Quality filter works correctly
```

### Test 2: Custom Coefficients
```
Set: R=10, D=10, P=5
Max Score: (1.2×10) + (1.5×10) + (1.0×5) = 32 points
Query: "overdue priority 1 task"
Expected:
- Due dates weighted heavily
- Priority weighted moderately
- Keywords weighted less
```

### Test 3: Quality Filter Adaptation
```
Set: R=30, D=2, P=1
Max Score: (1.2×30) + (1.5×2) + (1.0×1) = 40 points
Quality Filter: 25%
Expected:
- Threshold: 0.25 × 40 = 10 points
- Filter adapts to new max score
```

### Test 4: Real-time UI Updates
```
Action: Change relevance from 20 → 30
Expected:
- Max score display updates immediately
- Shows: "Max Score: 37.0 points"
- Breakdown shows new calculation
```

---

## Migration Notes

### For Existing Users

**Default coefficients (20, 4, 1) match current behavior:**
- No migration needed
- Scores identical to before
- Max score still 31
- Seamless upgrade

### For New Users

- Get sensible defaults
- Can customize immediately
- Clear guidance in settings

---

## Implementation Order

1. ✅ **Phase 1**: Add settings (DONE)
2. **Phase 2**: Update scoreTasksComprehensive signature
3. **Phase 3**: Replace scoreTasksByRelevance usage
4. **Phase 4**: Add calculateMaxScore helper
5. **Phase 5**: Update all method calls
6. **Phase 6**: Add settings UI
7. **Phase 7**: Update documentation

---

## Questions for Review

1. **Coefficient ranges OK?**
   - Relevance: 1-50
   - Due Date: 1-20
   - Priority: 1-20

2. **Default values OK?**
   - 20, 4, 1 (matches current)

3. **Max score calculation correct?**
   - `(1.2 × R) + (1.5 × D) + (1.0 × P)`

4. **Ready to proceed with implementation?**

---

**Status:** Ready for your approval to proceed! 🚀
