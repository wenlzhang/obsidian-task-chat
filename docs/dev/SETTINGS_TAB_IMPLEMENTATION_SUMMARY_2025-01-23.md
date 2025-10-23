# Settings Tab Implementation Summary (2025-01-23)

## Documentation Created ✅

All documentation files have been created in `/docs/`:

1. **SEARCH_MODES.md** - Detailed comparison of Simple/Smart/Task Chat modes
2. **SEMANTIC_EXPANSION.md** - How AI expands keywords and understands queries
3. **SCORING_SYSTEM.md** - Complete scoring formula and coefficient explanations
4. **SORTING_SYSTEM.md** - Multi-criteria sorting system details
5. **STATUS_CATEGORIES.md** - Status categories guide with score vs order explanation

## Next Steps: Settings Tab Reorganization

### New Structure (11 Sections)

```
1. AI Provider
2. Search Modes  
3. Semantic Search
4. Task Chat
5. DataView Integration
6. Status Categories
7. Task Filtering
8. Task Scoring
9. Task Sorting
10. Task Display
11. Advanced
```

### Key Changes Required

#### 1. Section Reordering

**Current order** → **New order:**
- Move "Chat modes" to position 2 (after AI Provider)
- Create new "Semantic Search" section at position 3
- Move "Task Chat" specific settings to position 4
- Move "DataView" to position 5
- Move "Status Categories" to position 6
- Create "Task Filtering" (stop words) at position 7
- Move "Task Scoring" to position 8
- Move "Task Sorting" to position 9
- Move "Task Display" to position 10
- Keep "Advanced" at position 11

#### 2. Text Reduction

**Remove verbose info boxes:**
- ❌ "Chat Mode Comparison" detailed table → Link to SEARCH_MODES.md
- ❌ "AI Features" detailed explanation → Link to SEMANTIC_EXPANSION.md
- ❌ Scoring formula details → Link to SCORING_SYSTEM.md
- ❌ Sorting explanation → Link to SORTING_SYSTEM.md

**Keep essential info boxes:**
- ✅ "Understanding Settings" (top overview)
- ✅ "Score vs Order" (Status Categories)
- ✅ Validation warnings (duplicate orders)

**Shorten all descriptions:**
- 1-2 sentences max
- Add "Learn more →" links
- Remove redundant explanations

#### 3. New Tag-Based Sorting UI

**Replace current text input:**
```typescript
// OLD (text input)
.addText((text) => {
    text.setValue(sortOrder.join(", "))
        .onChange(...)
});

// NEW (tag-based UI)
const sortContainer = containerEl.createDiv({ cls: "sort-criteria-container" });

// Render selected criteria as tags
for (const criterion of sortOrder) {
    const tag = sortContainer.createDiv({ cls: "sort-criterion-tag" });
    tag.createSpan({ text: criterion });
    
    if (criterion !== "relevance") {  // Relevance is locked
        const removeBtn = tag.createSpan({ text: "✕", cls: "remove-btn" });
        removeBtn.addEventListener("click", () => {
            // Remove criterion
        });
    }
}

// Add criterion button
const addBtn = sortContainer.createDiv({ cls: "add-criterion-btn" });
addBtn.createSpan({ text: "+ Add criterion" });
// Dropdown to select criterion
```

**CSS needed:**
```css
.sort-criteria-container {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 8px 0;
}

.sort-criterion-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 16px;
    font-size: 13px;
}

.sort-criterion-tag.locked {
    background: var(--background-modifier-success);
}

.remove-btn {
    cursor: pointer;
    font-weight: bold;
    opacity: 0.8;
}

.remove-btn:hover {
    opacity: 1;
}

.add-criterion-btn {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    background: var(--background-secondary);
    border: 1px dashed var(--background-modifier-border);
    border-radius: 16px;
    cursor: pointer;
    font-size: 13px;
}

.add-criterion-btn:hover {
    background: var(--background-modifier-hover);
}
```

#### 4. Collapsible Advanced Sections

**Add collapsible containers for:**
- Advanced scoring sub-coefficients
- Advanced status category fields (already exists)
- Advanced system prompt

**Implementation pattern:**
```typescript
// Create collapsible container
const advancedContainer = containerEl.createDiv({ cls: "advanced-section" });
advancedContainer.style.display = "none";

// Toggle button
new Setting(containerEl)
    .setName("⚙️ Advanced options")
    .setDesc("Fine-tune specific scoring components")
    .addButton((button) =>
        button
            .setButtonText("Show")
            .onClick(() => {
                const isHidden = advancedContainer.style.display === "none";
                advancedContainer.style.display = isHidden ? "block" : "none";
                button.setButtonText(isHidden ? "Hide" : "Show");
            })
    );

// Add advanced settings to container
new Setting(advancedContainer)
    .setName("Core keyword match bonus")
    ...
```

#### 5. Section Headers

**Use consistent `.setHeading()` style:**
```typescript
// Use this:
new Setting(containerEl)
    .setName("Search modes")
    .setHeading();

// Not this:
containerEl.createEl("h2", { text: "Search Modes" });
containerEl.createEl("h3", { text: "Search modes" });
```

### Detailed Section Changes

#### Section 1: AI Provider
**Status:** Keep as-is (already clean)
**Changes:** None

#### Section 2: Search Modes
**Current:** "Chat modes" with verbose comparison box
**New:**
```typescript
new Setting(containerEl)
    .setName("Search modes")
    .setHeading();

new Setting(containerEl)
    .setName("Default search mode")
    .setDesc("Choose your preferred mode. Simple (free), Smart (AI keywords), Task Chat (AI analysis). [Learn more →](docs/SEARCH_MODES.md)")
    .addDropdown(...);
```
**Remove:** Entire "Chat Mode Comparison" info box

#### Section 3: Semantic Search
**Current:** Scattered across multiple sections
**New:** Consolidate all AI query features
```typescript
new Setting(containerEl)
    .setName("Semantic search")
    .setHeading();

// Brief intro
const infoBox = containerEl.createDiv({ cls: "task-chat-info-box" });
infoBox.innerHTML = `
    <p><strong>🔍 Semantic Search</strong></p>
    <p>AI-powered query understanding for Smart Search and Task Chat modes.</p>
    <p><a href="docs/SEMANTIC_EXPANSION.md">Learn more about semantic expansion →</a></p>
`;

// Settings
new Setting(containerEl)
    .setName("Query languages")
    .setDesc("Languages for keyword expansion (comma-separated)")
    ...

new Setting(containerEl)
    .setName("Enable semantic expansion")
    .setDesc("AI expands keywords to synonyms in multiple languages")
    ...

new Setting(containerEl)
    .setName("Max keyword expansions")
    .setDesc("Maximum variations per keyword per language (default: 5)")
    ...

new Setting(containerEl)
    .setName("Enable natural language queries")
    .setDesc("Allow conversational queries like 'what should I work on?'")
    ...

new Setting(containerEl)
    .setName("Enable typo correction")
    .setDesc("Automatically fix common typing mistakes")
    ...

// Collapsible custom property terms
const customTermsContainer = containerEl.createDiv();
customTermsContainer.style.display = "none";

new Setting(containerEl)
    .setName("⚙️ Custom property terms")
    .setDesc("Teach AI your custom terminology")
    .addButton((button) =>
        button.setButtonText("Show").onClick(...)
    );

// Add priority/status/dueDate term settings to customTermsContainer
```

#### Section 4: Task Chat
**Current:** Mixed with other settings
**New:** Task Chat-specific settings only
```typescript
new Setting(containerEl)
    .setName("Task chat")
    .setHeading();

new Setting(containerEl)
    .setName("Show AI understanding")
    .setDesc("Display AI's interpretation of your query (Task Chat only)")
    ...

new Setting(containerEl)
    .setName("Enable streaming responses")
    .setDesc("Stream AI responses in real-time for faster feedback")
    ...

new Setting(containerEl)
    .setName("Max AI recommendations")
    .setDesc("Maximum number of AI recommendations to generate (default: 5)")
    ...
```

#### Section 5: DataView Integration
**Status:** Keep current structure
**Changes:** Minor text reduction

#### Section 6: Status Categories
**Status:** Keep structure, reduce text
**Changes:**
- Shorten field descriptions
- Keep Score vs Order info box
- Add link to STATUS_CATEGORIES.md
- Keep validation warnings

#### Section 7: Task Filtering
**Current:** Stop words buried in middle
**New:** Standalone section
```typescript
new Setting(containerEl)
    .setName("Task filtering")
    .setHeading();

new Setting(containerEl)
    .setName("Stop words")
    .setDesc("Generic words removed from searches (comma-separated). [Learn more →](docs/README.md#stop-words)")
    .addTextArea(...);
```

#### Section 8: Task Scoring
**Current:** Scattered, verbose
**New:** Consolidated with collapsible advanced
```typescript
new Setting(containerEl)
    .setName("Task scoring")
    .setHeading();

const infoBox = containerEl.createDiv({ cls: "task-chat-info-box" });
infoBox.innerHTML = `
    <p><strong>📊 Task Scoring</strong></p>
    <p>Control how tasks are ranked by relevance and importance.</p>
    <p><a href="docs/SCORING_SYSTEM.md">Learn more about the scoring system →</a></p>
`;

// Main coefficients
new Setting(containerEl)
    .setName("Relevance coefficient")
    .setDesc("Keyword match weight (default: 20)")
    .addSlider(...);

new Setting(containerEl)
    .setName("Due date coefficient")
    .setDesc("Deadline urgency weight (default: 4)")
    .addSlider(...);

new Setting(containerEl)
    .setName("Priority coefficient")
    .setDesc("Task importance weight (default: 1)")
    .addSlider(...);

new Setting(containerEl)
    .setName("Status coefficient")
    .setDesc("Task state weight (default: 1)")
    .addSlider(...);

new Setting(containerEl)
    .setName("Quality filter")
    .setDesc("Minimum score threshold percentage (default: 30%)")
    .addSlider(...);

new Setting(containerEl)
    .setName("Minimum relevance score")
    .setDesc("Minimum keyword match quality (0% = disabled)")
    .addSlider(...);

// Collapsible advanced sub-coefficients
const advancedContainer = containerEl.createDiv();
advancedContainer.style.display = "none";

new Setting(containerEl)
    .setName("⚙️ Advanced scoring options")
    .setDesc("Fine-tune specific score components")
    .addButton((button) =>
        button.setButtonText("Show").onClick(...)
    );

// Add all sub-coefficients to advancedContainer

// Reset button
new Setting(containerEl)
    .setName("Reset scoring to defaults")
    .addButton(...);
```

#### Section 9: Task Sorting
**Current:** Text input, verbose explanation
**New:** Tag-based UI, concise
```typescript
new Setting(containerEl)
    .setName("Task sorting")
    .setHeading();

const infoBox = containerEl.createDiv({ cls: "task-chat-info-box" });
infoBox.innerHTML = `
    <p><strong>🔀 Task Sorting</strong></p>
    <p>Multi-criteria sorting with tiebreakers. Relevance is always first.</p>
    <p><a href="docs/SORTING_SYSTEM.md">Learn more about sorting →</a></p>
`;

new Setting(containerEl)
    .setName("Sort criteria")
    .setDesc("Additional criteria break ties for tasks with equal scores");

// Tag-based UI (see implementation above)
const sortContainer = containerEl.createDiv({ cls: "sort-criteria-container" });
// ... render tags
```

#### Section 10: Task Display
**Current:** Mixed with other settings
**New:** Display-specific settings
```typescript
new Setting(containerEl)
    .setName("Task display")
    .setHeading();

new Setting(containerEl)
    .setName("Max direct results")
    .setDesc("Maximum tasks to display in Simple/Smart Search (default: 50)")
    .addText(...);
```

#### Section 11: Advanced
**Current:** Good structure
**Changes:** Make system prompt collapsible

### Implementation Steps

1. **Backup current settingsTab.ts**
2. **Create new section structure** with proper ordering
3. **Move settings** to appropriate sections
4. **Reduce text** and add documentation links
5. **Implement tag-based sorting UI**
6. **Add collapsible sections**
7. **Update CSS** for new UI components
8. **Test all settings** functionality
9. **Verify no features broken**
10. **Build and test** in Obsidian

### CSS Additions Needed

```css
/* Tag-based sorting UI */
.sort-criteria-container { ... }
.sort-criterion-tag { ... }
.sort-criterion-tag.locked { ... }
.remove-btn { ... }
.add-criterion-btn { ... }

/* Collapsible sections */
.advanced-section { ... }

/* Info boxes */
.task-chat-info-box a {
    color: var(--text-accent);
    text-decoration: none;
}

.task-chat-info-box a:hover {
    text-decoration: underline;
}
```

### Testing Checklist

- [ ] All 11 sections appear in correct order
- [ ] All settings still functional
- [ ] Tag-based sorting UI works (add/remove criteria)
- [ ] Collapsible sections toggle correctly
- [ ] All documentation links work
- [ ] Score vs Order info box still visible
- [ ] Validation warnings still appear
- [ ] No TypeScript errors
- [ ] Build successful
- [ ] Settings save/load correctly

### Estimated Changes

- **Lines modified:** ~1500 (out of 2900)
- **Lines added:** ~200 (new UI, links)
- **Lines removed:** ~400 (verbose text)
- **Net change:** ~1300 lines modified

### Risk Assessment

**Low risk:**
- Only UI/organization changes
- No logic changes
- All settings keep same internal names
- Backward compatible

**Testing required:**
- Verify all settings still work
- Check all links
- Test tag-based UI
- Verify collapsible sections

## Ready to Implement?

All documentation is created. The implementation plan is detailed above.

**Recommendation:** Implement in phases:
1. Phase 1: Reorder sections + reduce text (1-2 hours)
2. Phase 2: Tag-based sorting UI (1 hour)
3. Phase 3: Collapsible sections (30 min)
4. Phase 4: Test + polish (1 hour)

**Total estimated time:** 3-4 hours

Proceed with implementation?
