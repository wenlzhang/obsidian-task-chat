# Legacy Code Cleanup (2025-10-17)

## Summary

Removed all deprecated fields, migration code, and legacy references since the plugin is still in development phase with no users requiring migration.

---

## Removed Deprecated Fields

### 1. **`apiKey`** (Settings)

**Before**:
```typescript
apiKey: string; // Legacy API key (for backward compatibility)
```

**Reason for Removal**:
- Replaced by provider-specific keys: `openaiApiKey`, `anthropicApiKey`, `openrouterApiKey`
- No migration needed in development phase

**Files Modified**:
- `src/settings.ts` - Removed from interface and DEFAULT_SETTINGS
- `src/services/aiService.ts` - Removed fallback in `getApiKeyForProvider`
- `src/services/queryParserService.ts` - Removed fallback in `getApiKeyForProvider`
- `src/settingsTab.ts` - Removed fallback in `getCurrentApiKey` and setter
- `src/main.ts` - Removed migration code

---

### 2. **`searchMode`** (Settings)

**Before**:
```typescript
searchMode: "simple" | "smart" | "chat"; // DEPRECATED: renamed to currentChatMode
```

**Reason for Removal**:
- Renamed to `currentChatMode` for clarity
- `currentChatMode` serves the same purpose
- No migration needed in development phase

**Files Modified**:
- `src/settings.ts` - Removed from interface and DEFAULT_SETTINGS
- `src/views/chatView.ts` - Updated to use `currentChatMode`
- `src/main.ts` - Removed migration code

---

### 3. **`useAIQueryParsing`** (Settings)

**Before**:
```typescript
useAIQueryParsing: boolean; // DEPRECATED: kept for migration only
```

**Reason for Removal**:
- Replaced by three-mode system (`defaultChatMode`)
- Boolean flag no longer needed
- No migration needed in development phase

**Files Modified**:
- `src/settings.ts` - Removed from interface and DEFAULT_SETTINGS
- `src/main.ts` - Removed migration code

---

### 4. **`taskSortByAIEnabled`** (Settings)

**Before**:
```typescript
taskSortByAIEnabled: "auto" | "relevance" | "dueDate" | "priority" | "created" | "alphabetical"; // DEPRECATED
```

**Reason for Removal**:
- Replaced by single `taskSortBy` field
- Mode-specific sorting no longer needed
- No migration needed in development phase

**Files Modified**:
- `src/settings.ts` - Removed from interface and DEFAULT_SETTINGS
- `src/services/aiService.ts` - Removed `getEffectiveTaskSortBy` method
- `src/main.ts` - Removed migration code

---

### 5. **`taskSortByAIDisabled`** (Settings)

**Before**:
```typescript
taskSortByAIDisabled: "relevance" | "dueDate" | "priority" | "created" | "alphabetical"; // DEPRECATED
```

**Reason for Removal**:
- Replaced by single `taskSortBy` field
- Mode-specific sorting no longer needed
- No migration needed in development phase

**Files Modified**:
- `src/settings.ts` - Removed from interface and DEFAULT_SETTINGS
- `src/services/aiService.ts` - Removed `getEffectiveTaskSortBy` method
- `src/main.ts` - Removed migration code

---

## Removed Migration Code

### main.ts - `loadSettings()`

**Removed**:

1. **API Key Migration**:
```typescript
// Migrate legacy apiKey to provider-specific keys
if (
    this.settings.apiKey &&
    !this.settings.openaiApiKey &&
    !this.settings.anthropicApiKey &&
    !this.settings.openrouterApiKey
) {
    console.log("Migrating legacy API key to provider-specific storage");
    switch (this.settings.aiProvider) {
        case "openai":
            this.settings.openaiApiKey = this.settings.apiKey;
            break;
        case "anthropic":
            this.settings.anthropicApiKey = this.settings.apiKey;
            break;
        case "openrouter":
            this.settings.openrouterApiKey = this.settings.apiKey;
            break;
    }
    await this.saveSettings();
}
```

2. **useAIQueryParsing to searchMode Migration**:
```typescript
// Migrate useAIQueryParsing to searchMode (three-mode system)
if (!this.settings.searchMode) {
    console.log("Migrating useAIQueryParsing to three-mode searchMode system");
    if (this.settings.useAIQueryParsing) {
        this.settings.searchMode = "chat";
    } else {
        this.settings.searchMode = "simple";
    }
    await this.saveSettings();
}
```

3. **searchMode to defaultChatMode Migration**:
```typescript
// Migrate searchMode to defaultChatMode (renamed for clarity)
if (!this.settings.defaultChatMode && this.settings.searchMode) {
    console.log("Migrating searchMode to defaultChatMode");
    this.settings.defaultChatMode = this.settings.searchMode;
    await this.saveSettings();
}
```

4. **searchMode to currentChatMode Migration**:
```typescript
// Migrate searchMode to currentChatMode (renamed for clarity)
if (!this.settings.currentChatMode && this.settings.searchMode) {
    console.log("Migrating searchMode to currentChatMode");
    this.settings.currentChatMode = this.settings.searchMode;
    await this.saveSettings();
}
```

**After**:
```typescript
async loadSettings(): Promise<void> {
    this.settings = Object.assign(
        {},
        DEFAULT_SETTINGS,
        await this.loadData(),
    );

    // Auto-load models if not already cached
    this.loadModelsInBackground();
}
```

---

## Removed Helper Methods

### aiService.ts - `getEffectiveTaskSortBy()`

**Removed**:
```typescript
private static getEffectiveTaskSortBy(settings: PluginSettings): string {
    return settings.useAIQueryParsing
        ? settings.taskSortByAIEnabled
        : settings.taskSortByAIDisabled;
}
```

**Reason**: Used deprecated fields that no longer exist

**Replacement**: Direct use of `settings.taskSortBy`

---

## Updated Code Patterns

### API Key Access

**Before**:
```typescript
return settings.openaiApiKey || settings.apiKey || "";
```

**After**:
```typescript
return settings.openaiApiKey || "";
```

---

### Sort By Access

**Before**:
```typescript
const effectiveTaskSortBy = this.getEffectiveTaskSortBy(settings);
if (effectiveTaskSortBy === "auto") { ... }
```

**After**:
```typescript
if (settings.taskSortBy === "auto") { ... }
```

---

### Chat Mode Access

**Before**:
```typescript
const currentMode = this.searchModeOverride || this.plugin.settings.searchMode;
```

**After**:
```typescript
const currentMode = this.searchModeOverride || this.plugin.settings.currentChatMode;
```

---

## Current Settings Structure

### Active Fields (No Deprecated)

```typescript
export interface PluginSettings {
    // AI Provider Settings
    aiProvider: "openai" | "anthropic" | "openrouter" | "ollama";
    openaiApiKey: string;
    anthropicApiKey: string;
    openrouterApiKey: string;
    model: string;
    
    // Chat Mode (three-mode system)
    defaultChatMode: "simple" | "smart" | "chat"; // User preference for new sessions
    currentChatMode: "simple" | "smart" | "chat"; // Current session mode (stored in data.json)
    queryLanguages: string[];
    
    // Task Display
    maxDirectResults: number;
    maxTasksForAI: number;
    maxRecommendations: number;
    relevanceThreshold: number;
    
    // Sort Settings
    taskSortBy: "auto" | "relevance" | "dueDate" | "priority" | "created" | "alphabetical";
    taskSortDirection: "asc" | "desc";
    
    // ... other settings
}
```

---

## Benefits

### 1. **Cleaner Codebase** ✓
- No deprecated fields cluttering the interface
- No migration logic to maintain
- Simpler code paths

### 2. **Reduced Complexity** ✓
- No fallback chains (`openaiApiKey || apiKey || ""`)
- No conditional logic based on deprecated flags
- Direct field access

### 3. **Better Performance** ✓
- No migration checks on every plugin load
- Fewer settings fields to serialize/deserialize
- Simpler logic = faster execution

### 4. **Easier Maintenance** ✓
- Less code to understand and maintain
- No "why is this here?" moments for future developers
- Clear, single-purpose fields

### 5. **Development Phase Advantage** ✓
- No users to migrate
- Can make breaking changes freely
- Start fresh with clean architecture

---

## Files Modified

| File | Changes | Removed |
|------|---------|---------|
| `src/settings.ts` | Removed 5 deprecated fields | `apiKey`, `searchMode`, `useAIQueryParsing`, `taskSortByAIEnabled`, `taskSortByAIDisabled` |
| `src/main.ts` | Removed migration code (60+ lines) | All migration logic |
| `src/services/aiService.ts` | Removed helper method, updated references | `getEffectiveTaskSortBy()`, apiKey fallbacks |
| `src/services/queryParserService.ts` | Updated API key access | apiKey fallbacks |
| `src/views/chatView.ts` | Updated mode references | searchMode references |
| `src/settingsTab.ts` | Updated API key methods | apiKey fallbacks and setters |

---

## Testing Checklist

- [ ] **New plugin install works**
  - Fresh install creates correct default settings
  - No errors on first load

- [ ] **API keys work correctly**
  - Can set OpenAI API key
  - Can set Anthropic API key
  - Can set OpenRouter API key
  - Ollama works without API key

- [ ] **Chat modes work correctly**
  - Default mode applies to new sessions
  - Current mode persists across reloads
  - Mode override works in chat interface

- [ ] **Sorting works correctly**
  - `taskSortBy` field is used
  - Auto sorting works in Task Chat mode
  - Manual sorting works in all modes

- [ ] **No references to deprecated fields**
  - No TypeScript errors
  - No console errors
  - No undefined property access

---

## Migration Path (If Needed in Future)

If users are ever added and migration becomes necessary:

1. **Detect old data.json format**:
   ```typescript
   if (loadedData.apiKey && !loadedData.openaiApiKey) {
       // Has old format, needs migration
   }
   ```

2. **Add migration logic back to `loadSettings()`**:
   ```typescript
   // Check for legacy fields and migrate
   if (needsMigration(loadedData)) {
       this.settings = migrateSettings(loadedData);
   }
   ```

3. **Create migration helper**:
   ```typescript
   function migrateSettings(old: any): PluginSettings {
       return {
           ...DEFAULT_SETTINGS,
           openaiApiKey: old.apiKey || old.openaiApiKey,
           currentChatMode: old.searchMode || old.defaultChatMode,
           // ... other migrations
       };
   }
   ```

---

## Summary

**What was removed**:
- 5 deprecated settings fields
- 4 migration code blocks
- 1 helper method
- Multiple fallback chains

**Result**:
- Cleaner, simpler codebase
- No unnecessary complexity
- Ready for fresh development

**Status**: ✅ All legacy code removed, no migration needed in development phase

**Next Steps**: Continue development with clean architecture
