# Terminology Consistency Analysis & Proposal

**Date:** 2025-01-28

## User's Concern

"Sometimes we use provider/model, sometimes parsingProvider/parsingModel, sometimes analysisProvider/analysisModel. Also 'parser' vs 'parsing' is inconsistent. Should we standardize everything?"

## Current State Analysis

### 1. Provider Terminology Issues

**Problem:** Confusing hierarchy and naming

```typescript
// settings.ts
aiProvider: "openai" | "anthropic" | ...         // What is this?
parsingProvider: "openai" | "anthropic" | ...    // For query parsing
analysisProvider: "openai" | "anthropic" | ...   // For task analysis
```

**Usage Analysis:**

**`aiProvider` is used for:**
- Settings UI "main provider" dropdown
- API key validation check (`if settings.aiProvider !== "ollama"`)
- Background model loading
- Helper functions: `getCurrentProviderConfig()`, `updateCurrentProviderConfig()`

**Reality:** `aiProvider` is NOT a "default" - it's just the "settings tab context provider"

**`parsingProvider` and `analysisProvider` are used for:**
- ALL actual operations
- Query parsing: `getProviderForPurpose(settings, "parsing")`
- Task analysis: `getProviderForPurpose(settings, "analysis")`

### 2. "parser" vs "parsing" Inconsistency

**Found in codebase:**

**Using "parsing" (consistent):**
```typescript
parsingProvider: "openai" | ...
parsingModel?: string
parsingTemperature: number
parsingTokens?: number
parsingCost?: number
```

**Using "parser" (inconsistent):**
```typescript
_parserError?: string       // ❌ Should be _parsingError
_parserModel?: string       // ❌ Should be _parsingModel  
_parserTokenUsage?: {...}   // ❌ Should be _parsingTokenUsage
```

**Display strings using "parser":**
```typescript
"(parser)" in metadata display     // Could be "(parsing)" but "parser" is okay for UI
"parser error" in error messages    // Could be "parsing error"
```

## Impact Assessment

### High Impact (Worth Fixing):
1. ✅ **"parser" → "parsing" for internal fields** - Removes confusion
2. ✅ **Clarify `aiProvider` role** - Reduce confusion about hierarchy

### Low Impact (May Not Be Worth Risk):
3. ⚠️ **Rename `aiProvider` to `defaultProvider`** - Requires migration, may break existing code
4. ⚠️ **Change all display text from "parser" to "parsing"** - More verbose, "parser" is actually clearer

## Proposed Solutions

### Option 1: Minimal Fix (RECOMMENDED)
**Goal:** Fix internal inconsistencies, keep user-facing text

**Changes:**
1. Rename internal fields: `_parserError` → `_parsingError`, etc.
2. Add comment clarifying `aiProvider` = "settings UI context provider"
3. Keep display text as "parser" (shorter, clearer for users)

**Pros:**
- Low risk
- Fixes actual inconsistencies
- Maintains backward compatibility for user-facing strings

**Cons:**
- Doesn't address `aiProvider` naming confusion

---

### Option 2: Moderate Fix
**Goal:** Fix everything except user-facing display text

**Changes:**
1. All Option 1 changes
2. Rename `aiProvider` → `defaultProvider`
3. Update helper functions: `getCurrentProviderConfig()` → `getDefaultProviderConfig()`
4. Add migration for existing settings

**Pros:**
- Clearer naming throughout
- Better conceptual model

**Cons:**
- Medium risk (settings migration)
- `defaultProvider` still misleading (it's not a "default", it's the "main settings provider")

---

### Option 3: Complete Overhaul
**Goal:** Perfect consistency everywhere

**Changes:**
1. All Option 2 changes
2. Rename `defaultProvider` → `primaryProvider` or `mainProvider`
3. Change all display text: "parser" → "parsing", "analysis" → "analyzing"
4. Comprehensive codebase refactor

**Pros:**
- Perfect consistency
- Clear conceptual model

**Cons:**
- High risk
- Extensive testing needed
- May break user expectations ("parser" is widely understood)
- Verbose UI text

---

## Deep Dive: What is `aiProvider`?

### Current Reality:

```typescript
// aiProvider is used for:
1. Settings UI: Which provider's settings are shown in main tab
2. Helper functions: Get/update "current" provider config
3. API key check: settings.aiProvider !== "ollama"
4. Background: Load models for this provider
```

### Problem:

It's called `aiProvider` with a comment saying "default provider", but:
- It's NOT used as a fallback if parsing/analysis providers aren't set
- It's NOT a "default" in any functional sense
- It's really just "which provider is selected in the main settings UI"

### Better Names:

1. **`primaryProvider`** - Implies main/primary but not default fallback
2. **`selectedProvider`** - Clear it's just UI selection
3. **`settingsProvider`** - Most accurate (provider shown in settings)
4. Keep `aiProvider` but update comment to be accurate

## Recommendation: Option 1 + Comment Clarification

### Why This Approach?

1. **Risk vs Reward:**
   - Option 1 fixes real inconsistencies (parser/parsing) with minimal risk
   - Options 2-3 have migration risks that may not justify the benefits

2. **User Impact:**
   - Users understand "parser" better than "parsing" in UI
   - `aiProvider` is confusing but only for developers, not users

3. **Code Clarity:**
   - Internal consistency is most important (parser → parsing)
   - External naming (aiProvider) less critical if well-documented

### Specific Changes:

**1. Internal Field Renaming (Low Risk):**
```typescript
// Before
interface ParsedQuery {
    _parserError?: string;
    _parserModel?: string;
    _parserTokenUsage?: {...};
}

// After
interface ParsedQuery {
    _parsingError?: string;
    _parsingModel?: string;
    _parsingTokenUsage?: {...};
}
```

**2. Comment Clarification (Zero Risk):**
```typescript
// Before
aiProvider: "openai" | ...;  // "default" provider

// After
aiProvider: "openai" | ...;  // Primary provider shown in main settings tab
                             // NOT used as a default - actual operations use
                             // parsingProvider and analysisProvider explicitly
```

**3. Keep User-Facing Text:**
```typescript
// Keep these as-is (user-friendly):
"(parser)"           // Shorter than "(parsing)"
"parser error"       // More familiar than "parsing error"
```

## Files to Modify (Option 1):

### settings.ts
- Update comment for `aiProvider`

### models/task.ts (ParsedQuery interface)
- `_parserError` → `_parsingError`
- `_parserModel` → `_parsingModel`
- `_parserTokenUsage` → `_parsingTokenUsage`

### services/aiQueryParserService.ts
- Update all references to renamed fields

### views/chatView.ts
- Update field references (but keep display text)

**Impact:** ~10 files, ~30 lines changed

## Testing Requirements:

- ✅ Simple Search: Works with no AI calls
- ✅ Smart Search: Query parsing works, correct provider used
- ✅ Task Chat: Both parsing and analysis work
- ✅ Error handling: Parser errors display correctly
- ✅ Settings: UI shows correct provider info
- ✅ Mixed configs: Different providers for parsing/analysis

## Migration Strategy:

For Option 1: **No migration needed** - Internal field names don't persist to settings

For Option 2+: Would need migration for `aiProvider` → `defaultProvider`

## Conclusion:

**Recommend Option 1** - Fix internal inconsistencies (parser→parsing) with minimal risk, add clear comments to explain `aiProvider` role.

**Do NOT recommend Options 2-3** - Migration risks and code churn not justified by marginal clarity improvements. The current functional design (separate parsing/analysis providers) is correct.

## Alternative: Do Nothing?

**If we decide not to fix:**
- Document the inconsistency (this document)
- Add code comments explaining the distinction
- Accept that `parser` and `parsing` are used interchangeably

**This is also reasonable** - the system works correctly, inconsistency is minor.
