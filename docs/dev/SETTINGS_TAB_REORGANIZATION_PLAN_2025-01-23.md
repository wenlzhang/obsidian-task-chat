# Settings Tab Reorganization Plan (2025-01-23)

## Current Problems

Based on user feedback and screenshots:

1. **Too much text** - Excessive explanations clutter the interface
2. **Poor grouping** - Related settings scattered across sections
3. **Inconsistent structure** - Not following Obsidian standards
4. **Messy appearance** - Multi-criteria sorting UI is cluttered (see screenshot)
5. **Redundant information** - Same concepts explained multiple times

## Reference Standards

### Obsidian Plugin Guidelines
- Use `.setHeading()` for section headers
- Keep descriptions concise (1-2 sentences max)
- Link to documentation for details
- Follow sentence case for all UI text
- Group related settings logically

### Reference Plugins Structure

**Todoist Context Bridge:**
- Clean sections with `.setHeading()`
- Brief descriptions
- Logical grouping (API → Sync → Format → Advanced)

**Task Marker:**
- Simple headings: "General", "Create tasks", "Complete tasks"
- Minimal text
- Clear organization

## Proposed New Structure

### 1. AI Provider
**Current:** Good, keep as-is
**Settings:**
- Model provider
- API key
- Model selection
- Temperature

### 2. Search Modes
**New section** combining chat modes
**Settings:**
- Default chat mode
- Brief explanation of each mode
- Link to README for comparison table

**Remove:** "Chat Mode Comparison" verbose box → Move to README

### 3. Semantic Search
**New section** for AI-enhanced search features
**Settings:**
- Query languages
- Enable semantic expansion
- Max keyword expansions
- Enable natural language queries
- Enable typo correction
- Custom property terms

**Rationale:** All AI query understanding features together

### 4. Task Chat
**Settings specific to Task Chat mode:**
- Show AI understanding
- Enable streaming responses
- Max AI recommendations

### 5. Task Display
**Settings for how tasks appear:**
- Max direct results (Simple/Smart Search)
- Task display format options

### 6. Task Scoring
**All scoring-related settings:**
- Main coefficients (Relevance, Due Date, Priority, Status)
- Advanced sub-coefficients (collapsible)
- Quality filter percentage
- Minimum relevance score
- Reset buttons

**Improvement:** Simplify descriptions, link to README for formula details

### 7. Task Sorting
**Multi-criteria sorting:**
- Task sort order
- **Improve UI:** Use tag-based interface (like screenshot Image 1)
  - Selected criteria shown as removable tags
  - "+ Add criterion" button
  - Much cleaner than current text input

### 8. Stop Words
**Standalone section:**
- Stop words list
- Brief explanation
- Link to README

**Rationale:** Affects filtering, not specific to any one feature

### 9. DataView Integration
**Current:** Good structure, keep
**Settings:**
- Enable DataView
- Due date field
- Created date field

### 10. Status Categories
**Keep current structure** - Already well-organized
**Minor improvements:**
- Reduce verbose text
- Keep Score vs Order info box (it's helpful!)
- Link to README for detailed examples

### 11. Advanced
**System-level settings:**
- Advanced system prompt
- Usage statistics
- Pricing data
- Reset statistics

**Rationale:** Power user features grouped together

## Text Reduction Strategy

### Move to README

**Create new sections in README:**
1. **Search Modes Comparison** - Detailed table from current "Chat Mode Comparison"
2. **Scoring System** - Formula explanations, examples
3. **Sorting System** - How multi-criteria sorting works
4. **Semantic Expansion** - Detailed explanation of AI features
5. **Status Categories Guide** - Examples, use cases

### Keep in Settings Tab

**Only essential information:**
- What the setting does (1 sentence)
- Valid values/range
- Link to README section for details

**Example:**

**Before (verbose):**
```
🤖 AI Features (Automatic in Smart Search & Task Chat)

AI is used for two purposes in Smart Search and Task Chat modes:

1. Keyword Semantic Expansion: Better recall - "fix" → "fix, repair, solve, correct..."
2. Property Concept Recognition: Convert natural language to DataView format
   ✅ Type "urgent tasks" → AI converts to priority:1
   ✅ Type "working on" → AI converts to status:inprogress
   ...
```

**After (concise):**
```
AI enhancement (Natural language & typo correction)

Enable AI to understand natural language queries and expand keywords semantically.
Works automatically in Smart Search and Task Chat modes.

[Learn more about AI features →](link-to-readme)
```

## UI Improvements

### 1. Multi-Criteria Sorting

**Current (cluttered):**
```
Task sort order: relevance, dueDate, priority
[Text input field]
```

**Proposed (clean tag-based):**
```
Task sort order

[Relevance 🔒] [Due date ✕] [Priority ✕]  [+ Add criterion ▼]

Note: Relevance is always first. Additional criteria break ties.
```

**Benefits:**
- Visual representation
- Easy to remove (click ✕)
- Easy to add (dropdown)
- Matches screenshot Image 1 style

### 2. Collapsible Advanced Sections

**Use collapsible containers for:**
- Advanced scoring sub-coefficients
- Advanced status category fields
- Advanced system prompt

**Implementation:**
```typescript
const advancedContainer = containerEl.createDiv();
advancedContainer.style.display = "none";

const toggleButton = new Setting(containerEl)
    .setName("⚙️ Advanced scoring options")
    .addButton(button => button
        .setButtonText("Show")
        .onClick(() => {
            const isHidden = advancedContainer.style.display === "none";
            advancedContainer.style.display = isHidden ? "block" : "none";
            button.setButtonText(isHidden ? "Hide" : "Show");
        })
    );
```

### 3. Info Boxes

**Keep only essential info boxes:**
- ✅ Score vs Order (Status Categories) - Very helpful!
- ✅ Understanding Settings (top) - Good overview
- ❌ Chat Mode Comparison - Move to README
- ❌ AI Features detailed explanation - Move to README

### 4. Section Headers

**Use consistent heading style:**
```typescript
new Setting(containerEl)
    .setName("Search modes")
    .setHeading();
```

**Not:**
```typescript
containerEl.createEl("h2", { text: "Search Modes" });
```

## Implementation Plan

### Phase 1: Create README Documentation
1. Create `/docs/SEARCH_MODES.md`
2. Create `/docs/SCORING_SYSTEM.md`
3. Create `/docs/SORTING_SYSTEM.md`
4. Create `/docs/SEMANTIC_EXPANSION.md`
5. Create `/docs/STATUS_CATEGORIES.md`
6. Update main README with links

### Phase 2: Reorganize Settings Structure
1. Reorder sections according to new structure
2. Update section names
3. Add `.setHeading()` for all sections

### Phase 3: Reduce Text
1. Shorten all descriptions to 1-2 sentences
2. Add "Learn more →" links to README
3. Remove verbose info boxes

### Phase 4: Improve UI Components
1. Implement tag-based sorting UI
2. Add collapsible advanced sections
3. Clean up spacing and styling

### Phase 5: Test & Verify
1. Verify all settings still work
2. Check all links
3. Ensure no features broken

## Detailed Section Breakdown

### AI Provider
```
AI provider
├── Model provider [dropdown]
├── API key [text, password]
├── Model [dropdown]
└── Temperature [slider]
```

### Search Modes
```
Search modes
├── Default chat mode [dropdown]
└── [Link to SEARCH_MODES.md]
```

### Semantic Search
```
Semantic search
├── Query languages [text]
├── Enable semantic expansion [toggle]
├── Max keyword expansions [number]
├── Enable natural language [toggle]
├── Enable typo correction [toggle]
├── Custom property terms [collapsible]
│   ├── Priority terms
│   ├── Status terms
│   └── Due date terms
└── [Link to SEMANTIC_EXPANSION.md]
```

### Task Chat
```
Task chat
├── Show AI understanding [toggle]
├── Enable streaming [toggle]
└── Max AI recommendations [number]
```

### Task Display
```
Task display
├── Max direct results [number]
└── [Link to README]
```

### Task Scoring
```
Task scoring
├── Relevance coefficient [slider]
├── Due date coefficient [slider]
├── Priority coefficient [slider]
├── Status coefficient [slider]
├── Quality filter [slider]
├── Minimum relevance [slider]
├── ⚙️ Advanced sub-coefficients [collapsible]
│   ├── Core keyword bonus
│   ├── Due date sub-coefficients
│   └── Priority sub-coefficients
├── Reset to defaults [button]
└── [Link to SCORING_SYSTEM.md]
```

### Task Sorting
```
Task sorting
├── Sort criteria [tag-based UI]
│   [Relevance 🔒] [Due date ✕] [Priority ✕] [+ Add ▼]
└── [Link to SORTING_SYSTEM.md]
```

### Stop Words
```
Stop words
├── Stop words list [textarea]
└── [Link to README]
```

### DataView Integration
```
DataView integration
├── Enable DataView [toggle]
├── Due date field [text]
└── Created date field [text]
```

### Status Categories
```
Status categories
├── [Score vs Order info box] ← Keep this!
├── [Validation warnings if duplicates]
├── Category list [table]
└── [Link to STATUS_CATEGORIES.md]
```

### Advanced
```
Advanced
├── Advanced system prompt [textarea, collapsible]
├── Usage statistics [display]
├── Pricing data [display]
└── Reset statistics [button]
```

## Benefits

### For Users
- ✅ Cleaner, less cluttered interface
- ✅ Easier to find settings
- ✅ Logical grouping
- ✅ Detailed docs available when needed
- ✅ Follows Obsidian standards

### For Developers
- ✅ Easier to maintain
- ✅ Clear structure
- ✅ Documentation separated from code
- ✅ Consistent patterns

## Migration Notes

**No breaking changes:**
- All settings keep same internal names
- All functionality preserved
- Only UI/organization changes

**Backward compatible:**
- Existing user settings unchanged
- No data migration needed

## Next Steps

1. Get user approval on structure
2. Create documentation files
3. Implement reorganization
4. Test thoroughly
5. Update README with new structure
