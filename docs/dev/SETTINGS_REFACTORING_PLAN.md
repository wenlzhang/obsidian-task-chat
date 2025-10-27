# Settings Refactoring Plan

**Date**: 2025-01-27
**Status**: IN PROGRESS

## Overview

Comprehensive refactoring of AI Provider settings based on user feedback to:
1. Remove ALL backward compatibility
2. Remove "default" option from provider dropdowns
3. Add separate temperature settings for parsing and analysis
4. Restructure settings tab: Make Model Purpose Configuration a subsection under AI Provider
5. Move Model and Temperature settings from main section to subsection

## Changes Completed

### ✅ settings.ts
- Removed "default" from `parsingProvider` and `analysisProvider` types
- Added `parsingTemperature` and `analysisTemperature` fields
- Updated `getProviderForPurpose()` to return temperature
- Updated `DEFAULT_SETTINGS` with proper defaults:
  - parsingProvider: "openai"
  - parsingModel: "gpt-4o-mini"
  - parsingTemperature: 0.1
  - analysisProvider: "openai"
  - analysisModel: "gpt-4o"
  - analysisTemperature: 0.1
- Removed all backward compatibility comments

## Changes In Progress

### 🔄 settingsTab.ts - AI Provider Section Restructure

**Current Structure** (BEFORE):
```
AI Provider (heading)
├── Provider dropdown
├── API key
├── Model (dropdown + refresh) ← REMOVE
├── Test connection
├── Temperature ← REMOVE
├── Max response tokens
├── Context window
└── API endpoint

Model Purpose Configuration (separate heading)
├── Parsing provider (with "default")
├── Parsing model
├── Analysis provider (with "default")
└── Analysis model
```

**New Structure** (AFTER):
```
AI Provider (heading)
├── Intro text + learn more link
├── Provider dropdown (4 options only)
├── API key (per provider)
├── Test connection
├── Max response tokens
├── Context window
├── API endpoint
│
└── Model Purpose Configuration (SUBSECTION, not separate heading)
    ├── Subsection intro text + learn more link
    ├── Query parsing provider (4 options, no "default")
    ├── Query parsing model (dropdown + refresh + model count)
    ├── Query parsing temperature (slider)
    ├── Task analysis provider (4 options, no "default")
    ├── Task analysis model (dropdown + refresh + model count)
    └── Task analysis temperature (slider)
```

### Implementation Details

#### 1. Remove from AI Provider Main Section
- [x] Identify Model setting (lines 104-147)
- [x] Identify Temperature setting (lines 174-193)
- [ ] Delete these sections
- [ ] Keep: Provider, API key, Test, Max tokens, Context, Endpoint

#### 2. Create Model Purpose Configuration Subsection
- [ ] Add visual separator or spacing before subsection
- [ ] Add subsection title (NOT .setHeading(), use formatted text like other subsections)
- [ ] Add intro description
- [ ] Add learn more link

#### 3. Query Parsing Provider
- [ ] Dropdown with 4 options (no "default"):
  - OpenAI
  - Anthropic
  - OpenRouter
  - Ollama (Local)
- [ ] Description: "Provider for AI query parsing (Smart Search & Task Chat)"
- [ ] onChange: save and refresh display

#### 4. Query Parsing Model
- [ ] Text input OR dropdown (based on available models)
- [ ] Refresh button
- [ ] Model count display (e.g., "347 models available")
- [ ] Description: "Model for query parsing. Leave empty to use provider's default model."
- [ ] Smart placeholder based on selected parsing provider:
  - OpenAI: "gpt-4o-mini (recommended)"
  - Anthropic: "claude-haiku-3-5"
  - Ollama: "qwen2.5:14b"
  - OpenRouter: "openai/gpt-4o-mini"

#### 5. Query Parsing Temperature
- [ ] Slider 0.0-2.0, step 0.1
- [ ] Description: "Temperature for query parsing. Lower (0.1) = consistent, focused. Recommended: 0.1 for reliable JSON output."
- [ ] Link to docs

#### 6. Task Analysis Provider
- [ ] Dropdown with 4 options (no "default")
- [ ] Description: "Provider for AI task analysis (Task Chat mode only). Smart Search does not use this."
- [ ] onChange: save and refresh display

#### 7. Task Analysis Model
- [ ] Text input OR dropdown (based on available models)
- [ ] Refresh button
- [ ] Model count display
- [ ] Description: "Model for task analysis in Task Chat mode. Leave empty to use provider's default model."
- [ ] Smart placeholder based on selected analysis provider:
  - OpenAI: "gpt-4o (recommended)"
  - Anthropic: "claude-sonnet-4"
  - Ollama: "qwen2.5:32b"
  - OpenRouter: "openai/gpt-4o"

#### 8. Task Analysis Temperature
- [ ] Slider 0.0-2.0, step 0.1
- [ ] Description: "Temperature for task analysis. Lower (0.1) = consistent, higher (1.0) = creative. Recommended: 0.1 for structured responses."
- [ ] Link to docs

### Helper Methods to Update

#### getAvailableModelsForProvider()
New method to get models for a specific provider (not just current provider):
```typescript
private getAvailableModelsForProvider(provider: string): string[] {
    return this.plugin.settings.providerConfigs[provider].availableModels || [];
}
```

#### refreshModelsForProvider()
New method to refresh models for a specific provider:
```typescript
private async refreshModelsForProvider(provider: string): Promise<void> {
    // Similar to existing refreshModels() but for specific provider
}
```

## Changes Pending

### Services Updates
- [ ] aiQueryParserService.ts: Use `parsingTemperature` from getProviderForPurpose
- [ ] aiService.ts: Use `analysisTemperature` from getProviderForPurpose
- [ ] Update all API calls to use the temperature from getProviderForPurpose result

### Chat Interface
- [ ] Add model selection UI in chatView.ts
- [ ] Display current parsing/analysis models
- [ ] Allow quick switching between models
- [ ] Format: Similar to settings but more compact

### Documentation
- [ ] Check MODEL_CONFIGURATION.md for duplication with existing docs
- [ ] Merge or reference appropriately
- [ ] Update links in settingsTab.ts
- [ ] Update SETTINGS_GUIDE.md with new structure

## Testing Checklist

### Settings Persistence
- [ ] Parsing provider saves correctly
- [ ] Parsing model saves correctly
- [ ] Parsing temperature saves correctly
- [ ] Analysis provider saves correctly
- [ ] Analysis model saves correctly
- [ ] Analysis temperature saves correctly

### UI Behavior
- [ ] Parsing provider dropdown works
- [ ] Parsing model dropdown populates with correct models
- [ ] Parsing model refresh button works
- [ ] Analysis provider dropdown works
- [ ] Analysis model dropdown populates with correct models
- [ ] Analysis model refresh button works
- [ ] Temperature sliders work
- [ ] Placeholder text updates based on provider selection

### Functionality
- [ ] Smart Search uses parsing provider/model/temperature
- [ ] Task Chat uses both parsing and analysis configurations
- [ ] Token tracking shows correct models
- [ ] Cost calculations use correct pricing

### Visual
- [ ] Subsection properly indented/styled
- [ ] No inline styles
- [ ] Consistent with other sections
- [ ] Learn more links work

## Notes

- NO "default" option anywhere
- NO backward compatibility mentions
- All descriptions should be brief with links to docs for details
- Follow existing patterns for subsections
- Ensure proper provider/model/temperature resolution in all services
