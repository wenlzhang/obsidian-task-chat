# Parameter Architecture - Complete Documentation

**Date**: 2025-01-27  
**Status**: VERIFIED ✅

---

## Architecture Overview

### Two-Level Configuration System

**Level 1: Provider-Specific Settings**
Each of the 4 providers (OpenAI, Anthropic, OpenRouter, Ollama) has its own `ProviderConfig`:

```typescript
interface ProviderConfig {
    apiKey: string           // Provider's API key
    model: string            // Default model for this provider
    apiEndpoint: string      // API endpoint URL
    temperature: number      // DEPRECATED - kept for compatibility
    maxTokens: number        // Max response tokens
    contextWindow: number    // Context window size
    availableModels: string[] // Cached model list
}
```

**Level 2: Purpose-Specific Settings**
Separate configurations for parsing vs analysis:

```typescript
interface PluginSettings {
    // Parsing-specific
    parsingProvider: "openai" | "anthropic" | "openrouter" | "ollama"
    parsingModel: string       // Empty = use provider's default
    parsingTemperature: number // 0.0-2.0
    
    // Analysis-specific
    analysisProvider: "openai" | "anthropic" | "openrouter" | "ollama"
    analysisModel: string      // Empty = use provider's default
    analysisTemperature: number // 0.0-2.0
}
```

---

## Parameter Resolution Flow

### When Making API Call

**For Parsing (Smart Search & Task Chat query parsing):**
```
1. Get parsing provider: settings.parsingProvider (e.g., "openai")
2. Get parsing model: settings.parsingModel || providerConfigs[parsingProvider].model
3. Get parsing temperature: settings.parsingTemperature
4. Get maxTokens: providerConfigs[parsingProvider].maxTokens
5. Get contextWindow: providerConfigs[parsingProvider].contextWindow
6. Get endpoint: providerConfigs[parsingProvider].apiEndpoint
7. Get API key: providerConfigs[parsingProvider].apiKey
```

**For Analysis (Task Chat response generation):**
```
1. Get analysis provider: settings.analysisProvider (e.g., "anthropic")
2. Get analysis model: settings.analysisModel || providerConfigs[analysisProvider].model
3. Get analysis temperature: settings.analysisTemperature
4. Get maxTokens: providerConfigs[analysisProvider].maxTokens
5. Get contextWindow: providerConfigs[analysisProvider].contextWindow
6. Get endpoint: providerConfigs[analysisProvider].apiEndpoint
7. Get API key: providerConfigs[analysisProvider].apiKey
```

---

## Why This Architecture?

### Purpose-Specific Parameters
**Provider, Model, Temperature** - Vary by task type
- Parsing needs fast, cheap models with low temperature (consistent JSON)
- Analysis needs quality models with flexible temperature (detailed insights)
- Users want different models for different purposes

### Provider-Specific Parameters
**maxTokens, contextWindow, apiEndpoint** - Vary by provider capability
- OpenAI supports up to 128K tokens
- Anthropic supports up to 200K tokens
- Ollama's limits depend on local hardware
- Each provider has its own API endpoint
- Settings persist per provider when switching

---

## Example Scenarios

### Scenario 1: Different Providers for Each Purpose
```
Parsing: OpenAI gpt-4o-mini
  └─ Uses: OpenAI's maxTokens (8000)
           OpenAI's contextWindow (128000)
           OpenAI's apiEndpoint
           parsingTemperature (0.1)

Analysis: Anthropic claude-sonnet-4
  └─ Uses: Anthropic's maxTokens (4000)
           Anthropic's contextWindow (200000)
           Anthropic's apiEndpoint
           analysisTemperature (0.1)
```

**Result**: Each purpose uses its provider's capabilities independently ✅

### Scenario 2: Same Provider, Different Models
```
Parsing: OpenAI gpt-4o-mini
  └─ Uses: OpenAI's maxTokens (8000)
           OpenAI's contextWindow (128000)
           parsingTemperature (0.1)
           Model: gpt-4o-mini

Analysis: OpenAI gpt-4o
  └─ Uses: Same OpenAI's maxTokens (8000)
           Same OpenAI's contextWindow (128000)
           analysisTemperature (0.3) ← Different!
           Model: gpt-4o ← Different!
```

**Result**: Shares provider settings but uses different models/temperatures ✅

### Scenario 3: Switching Providers Preserves Settings
```
Initial State:
  OpenAI config: maxTokens=8000, contextWindow=128000
  Anthropic config: maxTokens=4000, contextWindow=200000
  parsingProvider: "openai"

User changes parsingProvider to "anthropic"
  → Parsing now uses Anthropic's maxTokens/contextWindow
  → OpenAI's settings remain unchanged
  
User changes back to "openai"
  → Parsing uses OpenAI's settings again
  → Settings were preserved ✅
```

---

## Service Integration Status

### Query Parser Service (aiQueryParserService.ts) ✅
- **callAI()** (OpenAI/OpenRouter)
  - Model: parsingModel ✅
  - Temperature: parsingTemperature ✅
  - maxTokens: parsing provider's config ✅
  
- **callAnthropic()**
  - Model: parsingModel ✅
  - Temperature: parsingTemperature ✅
  - maxTokens: parsing provider's config ✅
  
- **callOllama()**
  - Model: parsingModel ✅
  - Temperature: parsingTemperature ✅
  - maxTokens: parsing provider's config ✅
  - contextWindow: parsing provider's config ✅

### AI Service (aiService.ts) ✅
- **callAI()** (OpenAI/OpenRouter non-streaming)
  - Model: analysisModel ✅
  - Temperature: analysisTemperature ✅
  - maxTokens: analysis provider's config ✅
  
- **callOpenAIWithStreaming()**
  - Model: analysisModel ✅
  - Temperature: analysisTemperature ✅
  - maxTokens: analysis provider's config ✅
  
- **callAnthropic()** (streaming & non-streaming)
  - Model: analysisModel ✅
  - Temperature: analysisTemperature ✅
  - maxTokens: analysis provider's config ✅
  
- **callOllama()** (streaming & non-streaming)
  - Model: analysisModel ✅
  - Temperature: analysisTemperature ✅
  - maxTokens: analysis provider's config ✅
  - contextWindow: analysis provider's config ✅

---

## Smart Search vs Task Chat

### Smart Search Mode
```
User Query
    ↓
Parse with:
  - Provider: parsingProvider
  - Model: parsingModel
  - Temperature: parsingTemperature ✅
  - maxTokens: parsingProvider's maxTokens ✅
  - contextWindow: parsingProvider's contextWindow ✅
    ↓
Filter & Score Tasks
    ↓
Display Results (no analysis phase)
```

### Task Chat Mode
```
User Query
    ↓
Parse with:
  - Provider: parsingProvider
  - Model: parsingModel
  - Temperature: parsingTemperature ✅
  - maxTokens: parsingProvider's maxTokens ✅
    ↓
Filter & Score Tasks
    ↓
Analyze with:
  - Provider: analysisProvider
  - Model: analysisModel
  - Temperature: analysisTemperature ✅
  - maxTokens: analysisProvider's maxTokens ✅
  - contextWindow: analysisProvider's contextWindow ✅
    ↓
Display AI Response
```

---

## Backward Compatibility

### Deprecated Parameters
- `providerConfig.temperature` - DEPRECATED, kept for compatibility
  - Old code that reads this still works
  - But API calls now use purpose-specific temperatures
  - Will be removed in future major version

### Migration Path
- Existing users: providerConfig.temperature ignored
- New users: Start with purpose-specific temperatures
- No breaking changes

---

## Settings Persistence

### When User Changes Parsing Provider
```
Before: parsingProvider = "openai"
        parsingModel = "gpt-4o-mini"
        parsingTemperature = 0.1

User changes to: parsingProvider = "anthropic"

Result: parsingModel = "gpt-4o-mini" (preserved) ✅
        parsingTemperature = 0.1 (preserved) ✅
        Uses Anthropic's maxTokens/contextWindow ✅
```

### When User Changes Analysis Provider
```
Before: analysisProvider = "openai"
        analysisModel = "gpt-4o"
        analysisTemperature = 0.3

User changes to: analysisProvider = "ollama"

Result: analysisModel = "gpt-4o" (preserved) ✅
        analysisTemperature = 0.3 (preserved) ✅
        Uses Ollama's maxTokens/contextWindow ✅
```

### All Settings Saved Automatically
- Every change triggers `await this.plugin.saveSettings()`
- Provider-specific settings persist in `providerConfigs`
- Purpose-specific settings persist in root level
- No data loss when switching providers ✅

---

## Complete Parameter Matrix

| Parameter | Level | Scope | Used By | Current Value From |
|-----------|-------|-------|---------|-------------------|
| provider | Purpose | Parsing | aiQueryParserService | `settings.parsingProvider` |
| provider | Purpose | Analysis | aiService | `settings.analysisProvider` |
| model | Purpose | Parsing | aiQueryParserService | `settings.parsingModel` or provider default |
| model | Purpose | Analysis | aiService | `settings.analysisModel` or provider default |
| temperature | Purpose | Parsing | aiQueryParserService | `settings.parsingTemperature` ✅ |
| temperature | Purpose | Analysis | aiService | `settings.analysisTemperature` ✅ |
| maxTokens | Provider | Both | Both services | `providerConfigs[provider].maxTokens` ✅ |
| contextWindow | Provider | Both | Both services | `providerConfigs[provider].contextWindow` ✅ |
| apiEndpoint | Provider | Both | Both services | `providerConfigs[provider].apiEndpoint` ✅ |
| apiKey | Provider | Both | Both services | `providerConfigs[provider].apiKey` ✅ |

---

## Verification Checklist

### Temperature Integration ✅
- [x] Parsing uses parsingTemperature in all providers
- [x] Analysis uses analysisTemperature in all providers
- [x] OpenAI streaming uses correct temperature
- [x] Anthropic streaming uses correct temperature
- [x] Ollama streaming uses correct temperature
- [x] Non-streaming paths use correct temperature

### Provider-Specific Parameters ✅
- [x] maxTokens pulled from correct provider config
- [x] contextWindow pulled from correct provider config
- [x] apiEndpoint pulled from correct provider config
- [x] apiKey pulled from correct provider config

### Settings Persistence ✅
- [x] Purpose-specific settings preserved when switching providers
- [x] Provider-specific settings preserved independently
- [x] All changes auto-saved
- [x] No data loss on provider switch

### Mode Support ✅
- [x] Smart Search uses parsing config
- [x] Task Chat uses parsing config for query
- [x] Task Chat uses analysis config for response
- [x] Both modes work correctly

---

## Summary

**Architecture Status**: COMPLETE ✅  
**Service Integration**: COMPLETE ✅  
**Parameter Flow**: VERIFIED ✅  
**Settings Persistence**: VERIFIED ✅  
**Mode Support**: VERIFIED ✅

All parameters are:
- Correctly scoped (purpose vs provider level)
- Properly integrated (all services use correct values)
- Fully persistent (settings saved on every change)
- Backward compatible (no breaking changes)

**The system is production-ready!** 🎉
