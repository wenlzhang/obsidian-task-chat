# Settings Refactoring Status - 2025-01-27

## ✅ Completed

### 1. settings.ts Structure (COMPLETE)
- ✅ Removed "default" from parsingProvider and analysisProvider types
- ✅ Added parsingTemperature field (number)
- ✅ Added analysisTemperature field (number)
- ✅ Updated getProviderForPurpose() to return temperature
- ✅ Updated DEFAULT_SETTINGS with proper defaults:
  ```typescript
  parsingProvider: "openai",
  parsingModel: "gpt-4o-mini",
  parsingTemperature: 0.1,
  analysisProvider: "openai",
  analysisModel: "gpt-4o",
  analysisTemperature: 0.1,
  ```
- ✅ Removed all backward compatibility comments

### 2. settingsTab.ts - TypeScript Errors Fixed
- ✅ Removed "default" option from parsing provider dropdown
- ✅ Removed "default" option from analysis provider dropdown  
- ✅ Removed "default" comparisons in parsing model placeholder logic
- ✅ Removed "default" comparisons in analysis model placeholder logic
- ✅ Updated descriptions to remove "uses main provider if default" text

### 3. Service Updates - Partial
- ✅ aiQueryParserService.ts already uses getProviderForPurpose()
- ✅ aiService.ts already uses getProviderForPurpose()
- ✅ Both services get temperature from getProviderForPurpose result
- ⚠️ Need to update actual temperature usage in API calls

## 🔄 In Progress / Remaining Work

### Phase 1: AI Provider Section Restructure (HIGH PRIORITY)

**Current Issues:**
- Model selection still in main AI Provider section (should move to subsection)
- Temperature still in main AI Provider section (should move to subsection)  
- No visual separation between main section and subsection

**Required Changes:**
1. **Remove from lines 104-147:** Model dropdown + refresh button + model info
2. **Remove from lines 174-193:** Temperature slider
3. Keep: Provider, API key, Test connection, Max tokens, Context window, Endpoint

### Phase 2: Model Purpose Configuration Subsection (HIGH PRIORITY)

**Current Issues:**
- Currently a separate main section (.setHeading())
- Should be a SUBSECTION under AI Provider
- Missing model dropdown/refresh functionality
- Missing temperature sliders
- Missing model count display

**Required Changes:**

**Structure Change:**
```
Current: Two separate main sections
├── AI Provider (heading)
└── Model Purpose Configuration (heading) ← WRONG

Target: One main section with subsection
└── AI Provider (heading)
    └── Model Purpose Configuration (subsection) ← CORRECT
```

**Implementation Needed:**

1. **Visual Formatting** (like other subsections)
   - Remove `.setHeading()` call
   - Add visual separator or spacing
   - Use styled description box instead of heading

2. **Query Parsing Provider** ✅ Done
   - Dropdown without "default" ✅
   - Description ✅

3. **Query Parsing Model** (Needs Enhancement)
   - Current: Text input only
   - Need: Dropdown + Refresh button + Model count
   - Example: "347 models available - Click 'Refresh' to fetch from OpenRouter"

4. **Query Parsing Temperature** (Missing - NEW)
   ```typescript
   new Setting(containerEl)
       .setName("Query parsing temperature")
       .setDesc("Temperature for query parsing (0.0-2.0). Recommended: 0.1 for reliable JSON output.")
       .addSlider((slider) =>
           slider
               .setLimits(0, 2, 0.1)
               .setValue(this.plugin.settings.parsingTemperature)
               .setDynamicTooltip()
               .onChange(async (value) => {
                   this.plugin.settings.parsingTemperature = value;
                   await this.plugin.saveSettings();
               })
       );
   ```

5. **Task Analysis Provider** ✅ Done
   - Dropdown without "default" ✅
   - Description ✅

6. **Task Analysis Model** (Needs Enhancement)
   - Current: Text input only
   - Need: Dropdown + Refresh button + Model count

7. **Task Analysis Temperature** (Missing - NEW)
   ```typescript
   new Setting(containerEl)
       .setName("Task analysis temperature")
       .setDesc("Temperature for task analysis (0.0-2.0). Recommended: 0.1 for structured responses, 1.0 for creative.")
       .addSlider((slider) =>
           slider
               .setLimits(0, 2, 0.1)
               .setValue(this.plugin.settings.analysisTemperature)
               .setDynamicTooltip()
               .onChange(async (value) => {
                   this.plugin.settings.analysisTemperature = value;
                   await this.plugin.saveSettings();
               })
       );
   ```

### Phase 3: Helper Methods (MEDIUM PRIORITY)

**New Methods Needed:**

```typescript
// Get available models for a specific provider (not just current)
private getAvailableModelsForProvider(provider: string): string[] {
    return this.plugin.settings.providerConfigs[provider].availableModels || [];
}

// Refresh models for a specific provider
private async refreshModelsForProvider(provider: string): Promise<void> {
    const apiKey = this.plugin.settings.providerConfigs[provider].apiKey;
    if (!apiKey && provider !== "ollama") {
        new Notice(`Please set API key for ${provider} first`);
        return;
    }

    try {
        let models: string[] = [];
        switch (provider) {
            case "openai":
                models = await ModelProviderService.fetchOpenAIModels(apiKey);
                break;
            case "anthropic":
                models = await ModelProviderService.fetchAnthropicModels(apiKey);
                break;
            case "openrouter":
                models = await ModelProviderService.fetchOpenRouterModels(apiKey);
                break;
            case "ollama":
                models = await ModelProviderService.fetchOllamaModels();
                break;
        }
        
        this.plugin.settings.providerConfigs[provider].availableModels = models;
        await this.plugin.saveSettings();
        
        new Notice(`Fetched ${models.length} models for ${provider}`);
    } catch (error) {
        new Notice(`Failed to fetch models: ${error.message}`);
    }
}
```

### Phase 4: Service Temperature Integration (LOW PRIORITY)

**Files to Update:**
- aiQueryParserService.ts: Use temperature from getProviderForPurpose result in API calls
- aiService.ts: Use temperature from getProviderForPurpose result in API calls

**Current:**
```typescript
// Both services get temperature but may not use it in all API calls
const { provider, model, temperature } = getProviderForPurpose(settings, "parsing");
// Need to ensure temperature is passed to API call body
```

### Phase 5: Chat Interface Model Selection (LOW PRIORITY)

**Location:** src/views/chatView.ts

**Requirements:**
- Display current parsing/analysis models
- Allow quick switching
- Compact format (space-constrained)
- Update on change

**Potential Design:**
```
[Chat Input Box]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Parsing: OpenAI/gpt-4o-mini [▼]
💬 Analysis: OpenAI/gpt-4o [▼]
```

### Phase 6: Documentation (MEDIUM PRIORITY)

**Tasks:**
- ✅ MODEL_CONFIGURATION.md created (not duplicate, new content)
- ⏳ Update SETTINGS_GUIDE.md with new structure
- ⏳ Update all doc links in settingsTab.ts
- ⏳ Add temperature configuration examples

## Testing Requirements

### Functionality Tests
- [ ] Parsing provider selection works
- [ ] Parsing model selection/refresh works
- [ ] Parsing temperature saves correctly
- [ ] Analysis provider selection works
- [ ] Analysis model selection/refresh works
- [ ] Analysis temperature saves correctly
- [ ] Smart Search uses parsing config
- [ ] Task Chat uses both configs
- [ ] Token tracking shows correct models/providers

### UI Tests
- [ ] Subsection visually distinct from main section
- [ ] No inline styles
- [ ] Consistent formatting with other subsections
- [ ] Model count displays correctly
- [ ] Refresh buttons work
- [ ] Temperature sliders work

### Integration Tests
- [ ] Services use correct temperature
- [ ] API calls include correct temperature parameter
- [ ] Different temperatures for parsing vs analysis work
- [ ] Cost calculations accurate

## Estimated Effort

**Total Remaining Work:** ~8-12 hours

**Breakdown:**
- Phase 1 (AI Provider cleanup): 1-2 hours
- Phase 2 (Model Purpose subsection): 4-6 hours
- Phase 3 (Helper methods): 1-2 hours
- Phase 4 (Service integration): 1 hour
- Phase 5 (Chat interface): 2-3 hours
- Phase 6 (Documentation): 1-2 hours
- Testing & debugging: 2-3 hours

## Recommended Approach

Given the scope, I recommend:

1. **Option A: Complete in phases** over multiple sessions
   - Session 1: Phases 1-2 (core settings restructure)
   - Session 2: Phases 3-4 (functionality)
   - Session 3: Phases 5-6 (UI polish + docs)

2. **Option B: MVP first, then enhance**
   - Quick version: Add temperature sliders only (2 hours)
   - Full version: Complete restructure later (10 hours)

3. **Option C: Current working state**
   - Keep current structure
   - Just add temperature sliders
   - Skip major restructure

## Current Build Status

✅ **Should build successfully** with TypeScript errors fixed
⚠️ **Partial functionality** - has parsing/analysis provider selection but:
- No temperature controls for parsing/analysis separately
- No model dropdown/refresh for parsing/analysis
- Not structured as subsection (separate heading instead)
- Model and Temperature still in main AI Provider section

## Next Steps

User should decide which approach to take:
1. Continue with full refactoring now (8-12 hours)
2. Split into multiple sessions
3. Implement MVP (just temperature sliders)
4. Accept current state and move on

Let me know your preference!
