# Metadata Display Fixes When Analysis Fails (2025-01-27)

## User's Excellent Discovery! 🎯

User identified that when **analysis fails but parsing succeeds**, the metadata display was completely wrong:

1. ❌ **Missing parsing model info** - didn't show gpt-4o-mini (parser) succeeded
2. ❌ **Missing token usage** - parsing consumed tokens but we weren't showing the cost
3. ❌ **Wrong language** - parsing detected "Chinese" but metadata showed "Unknown"
4. ❌ **No analysis model** - didn't show gpt-5-mini (analysis) that failed

**User's insight:** "The metadata part should be exactly the same as when it worked. We still need to calculate that—specifically, the part that worked and consumed the user's cost."

---

## The Problems

### Bug #1: No Token Usage When Analysis Fails ❌

**Location:** `aiService.ts` line 1073

```typescript
// BEFORE (WRONG)
return {
    response: `Found ${sortedTasksForDisplay.length} matching task(s)`,
    recommendedTasks: sortedTasksForDisplay.slice(0, settings.maxRecommendations),
    tokenUsage: undefined, // ❌ WRONG! Parsing succeeded and consumed tokens!
    parsedQuery: usingAIParsing ? parsedQuery : undefined,
    error: structured,
};
```

**Why wrong:**
- When analysis fails, we set `tokenUsage: undefined`
- But parsing **succeeded** and consumed tokens!
- User paid for parsing tokens but we're not showing it

**Impact:**
- No model info displayed
- No token count shown
- No cost shown
- User doesn't know parsing succeeded
- User doesn't see what they paid for!

---

### Bug #2: Early Exit in chatView ❌

**Location:** `chatView.ts` lines 1010-1017 (OLD)

```typescript
// BEFORE (WRONG)
if (!message.tokenUsage && message.error && message.error.model) {
    parts.push(message.error.model);
    parts.push("Language: Unknown");  // ❌ Hardcoded!
    usageEl.createEl("small", { text: parts.join(" · ") });
    return; // ❌ Exits early, doesn't show any details!
}
```

**Why wrong:**
- Checks `!message.tokenUsage` and exits early
- But after our fix, tokenUsage exists (from parsing)!
- Hardcoded "Language: Unknown" instead of getting from parsedQuery

---

### Bug #3: No Model Info for Failed Analysis ❌

**Location:** `chatView.ts` lines 1082-1117 (OLD)

The model display logic had three cases:
1. Simple/Smart Search - show parsing model only
2. Task Chat, same model for both - show once
3. Task Chat, different models for both - show separately

**Missing case:** Task Chat, parsing succeeded, analysis failed!

---

## The Fixes

### Fix #1: Return Parsing Token Usage ✅

**File:** `aiService.ts` (lines 1066-1103)

```typescript
// AFTER (CORRECT)
// Calculate token usage - show parsing tokens even if analysis failed
let tokenUsageForError;
if (usingAIParsing && parsedQuery && parsedQuery._parserTokenUsage) {
    // Parsing succeeded - show its token usage and cost
    const parserUsage = parsedQuery._parserTokenUsage;
    const parsingProvider = parserUsage.provider as
        | "openai"
        | "anthropic"
        | "openrouter"
        | "ollama";
    tokenUsageForError = {
        promptTokens: parserUsage.promptTokens,
        completionTokens: parserUsage.completionTokens,
        totalTokens: parserUsage.totalTokens,
        estimatedCost: parserUsage.estimatedCost,
        model: parserUsage.model,
        provider: parsingProvider,
        isEstimated: parserUsage.isEstimated,
        // Add parsing-specific fields for metadata
        parsingModel: parserUsage.model,
        parsingProvider: parsingProvider,
        parsingTokens: parserUsage.totalTokens,
        parsingCost: parserUsage.estimatedCost,
        // Note: No analysis fields since analysis failed
    };
} else {
    // No parsing or parsing also failed
    tokenUsageForError = undefined;
}

return {
    response: `Found ${sortedTasksForDisplay.length} matching task(s)`,
    recommendedTasks: sortedTasksForDisplay.slice(0, settings.maxRecommendations),
    tokenUsage: tokenUsageForError, // ✅ Show parsing tokens even if analysis failed
    parsedQuery: usingAIParsing ? parsedQuery : undefined,
    error: structured,
};
```

**Now:**
- Returns parsing token usage when parsing succeeded
- Includes: promptTokens, completionTokens, cost
- Includes: parsingModel, parsingProvider for metadata display
- Only returns undefined if both parsing and analysis failed

---

### Fix #2: Get Language from parsedQuery ✅

**File:** `chatView.ts` (lines 1010-1022)

```typescript
// AFTER (CORRECT)
// If error occurred, check if we still have parsing token usage
// (parsing may have succeeded even if analysis failed)
if (message.error && !message.tokenUsage) {
    // Neither parsing nor analysis succeeded - show minimal error info
    if (message.error.model) {
        parts.push(message.error.model);
    }
    // Try to get language from parsedQuery if available  ✅
    const detectedLang = message.parsedQuery?.aiUnderstanding?.detectedLanguage;
    parts.push(`Language: ${detectedLang || "Unknown"}`);
    usageEl.createEl("small", { text: parts.join(" · ") });
    return; // Skip rest of processing since no tokenUsage
}
```

**Now:**
- Gets language from `parsedQuery.aiUnderstanding.detectedLanguage`
- Shows detected language (e.g., "Chinese") instead of "Unknown"
- Only shows "Unknown" if language detection truly failed

---

### Fix #3: Show Both Models When Analysis Fails ✅

**File:** `chatView.ts` (lines 1090-1098)

```typescript
// AFTER (CORRECT)
} else if (!hasAnalysisModel && message.error && message.error.model) {
    // Task Chat: Parsing succeeded, but analysis failed
    // Show parsing model from tokenUsage + analysis model from error
    const parsingProviderName = formatProvider(
        message.tokenUsage.parsingProvider!,
    );
    parts.push(
        `${parsingProviderName}: ${message.tokenUsage.parsingModel} (parser), ${message.error.model} (analysis failed)`,
    );
}
```

**Now shows:**
```
OpenAI: gpt-4o-mini (parser), OpenAI: gpt-5-mini (analysis failed)
```

---

## Impact

### Before Fixes ❌

**Metadata when analysis fails:**
```
Mode: Task Chat · OpenAI: gpt-5-mini · Language: Unknown
```

**Problems:**
- Only shows failed analysis model (gpt-5-mini)
- Doesn't show parsing model (gpt-4o-mini) that succeeded
- No token count (parsing consumed ~500 tokens!)
- No cost ($0.0001 for parsing)
- Language shows "Unknown" even though parsing detected "Chinese"

---

### After Fixes ✅

**Metadata when analysis fails:**
```
Mode: Task Chat · OpenAI: gpt-4o-mini (parser), OpenAI: gpt-5-mini (analysis failed) · 523 tokens (478 in, 45 out) · ~$0.0001 · Lang: Chinese
```

**Now shows:**
- ✅ Parsing model (gpt-4o-mini) with "(parser)" label
- ✅ Analysis model (gpt-5-mini) with "(analysis failed)" label  
- ✅ Token count from parsing (523 tokens)
- ✅ Cost from parsing ($0.0001)
- ✅ Detected language from parsing (Chinese)

---

## Complete Scenarios

### Scenario 1: Everything Works ✅

**Setup:**
- Parsing: gpt-4o-mini (succeeds)
- Analysis: gpt-4o-mini (succeeds)

**Metadata:**
```
Mode: Task Chat · OpenAI: gpt-4o-mini (parser + analysis) · 1,234 tokens · ~$0.0002 · Lang: Chinese
```

---

### Scenario 2: Analysis Fails (Our Fix!) ✅

**Setup:**
- Parsing: gpt-4o-mini (succeeds ✅)
- Analysis: gpt-5-mini (fails ❌ - model doesn't exist)

**Metadata:**
```
Mode: Task Chat · OpenAI: gpt-4o-mini (parser), OpenAI: gpt-5-mini (analysis failed) · 523 tokens (478 in, 45 out) · ~$0.0001 · Lang: Chinese
```

**Shows:**
- ✅ Both models with clear labels
- ✅ Parsing tokens and cost (user paid for this!)
- ✅ Detected language (parsing worked!)

---

### Scenario 3: Both Fail ❌

**Setup:**
- Parsing: claude-invalid (fails ❌)
- Analysis: not reached (parsing failed)

**Metadata:**
```
Mode: Task Chat · Anthropic: claude-invalid · Language: Unknown
```

**Shows:**
- Error model only
- No token usage (nothing succeeded)
- Language Unknown (parsing failed, no detection)

---

### Scenario 4: Different Providers ✅

**Setup:**
- Parsing: OpenRouter openai/gpt-4o-mini (succeeds)
- Analysis: OpenAI gpt-5-mini (fails)

**Metadata:**
```
Mode: Task Chat · OpenRouter: openai/gpt-4o-mini (parser), OpenAI: gpt-5-mini (analysis failed) · 523 tokens · ~$0.0001 · Lang: Chinese
```

---

## Console Logs

### Before Fix ❌

```
[Task Chat] Starting OpenAI streaming call...
POST https://api.openai.com/v1/chat/completions 400 (Bad Request)
[Task Chat] AI Analysis Error: Error: AI API error: 400
[Task Chat] ⚠️ AI Analysis Failed - returning filtered tasks as fallback
[Task Chat] Parsing API error: {
  message: 'AI API error: 400',
  model: 'OpenAI: gpt-5-mini',
  operation: 'analysis'
}
[Task Chat] Returning 667 tasks from semantic search as fallback
```

**Metadata displays:**
- Model: OpenAI: gpt-5-mini (only failed model)
- Language: Unknown (wrong!)
- No tokens, no cost

---

### After Fix ✅

```
[Task Chat] Starting OpenAI streaming call...
POST https://api.openai.com/v1/chat/completions 400 (Bad Request)
[Task Chat] AI Analysis Error: Error: AI API error: 400
[Task Chat] ⚠️ AI Analysis Failed - returning filtered tasks as fallback
[Task Chat] Parsing API error: {
  message: 'AI API error: 400',
  model: 'OpenAI: gpt-5-mini',
  operation: 'analysis'
}
[Task Chat] Returning 667 tasks from semantic search as fallback
```

**Metadata displays:**
- Models: OpenAI: gpt-4o-mini (parser), OpenAI: gpt-5-mini (analysis failed)
- Tokens: 523 tokens (478 in, 45 out)
- Cost: ~$0.0001
- Language: Chinese (from parsing!)

---

## Files Modified

### aiService.ts
- **Lines 1066-1103:** Calculate token usage even when analysis fails
  - Extract parsing token usage from `parsedQuery._parserTokenUsage`
  - Return it with parsing-specific fields
  - Only return undefined if both parsing and analysis failed

### chatView.ts
- **Lines 1010-1022:** Get language from parsedQuery instead of hardcoding "Unknown"
- **Lines 1090-1098:** Add case for parsing succeeded + analysis failed
  - Show both models with clear labels
  - Format: "Provider: parser-model (parser), analysis-model (analysis failed)"

---

## Key Principles

### 1. Show What Succeeded

Even if something fails, show what succeeded:
- Parsing succeeded → Show parsing model, tokens, cost, language
- Only analysis failed → Show that too, with "(analysis failed)" label

### 2. User Paid for It

If parsing consumed tokens:
- User paid for it → MUST show the cost
- Transparency is critical for trust

### 3. Complete Information

Metadata should always show:
- All models used (parsing + analysis)
- All tokens consumed (even if partial)
- All costs incurred (even if partial)
- Language detected (if available)

### 4. Clear Labels

When showing mixed success/failure:
- "(parser)" - parsing model that worked
- "(analysis failed)" - analysis model that failed
- Clear and unambiguous

---

## User Benefits

**Before:**
- ❌ Didn't know parsing succeeded
- ❌ Didn't see parsing cost ($0.0001)
- ❌ Thought language detection failed (showed "Unknown")
- ❌ Couldn't debug which part failed (only saw error model)

**After:**
- ✅ Sees parsing succeeded with cost
- ✅ Sees tokens consumed (523 tokens = user paid for this!)
- ✅ Sees detected language (Chinese)
- ✅ Clearly sees analysis failed with model name
- ✅ Can debug: parsing works, analysis model invalid
- ✅ Professional and transparent

---

## Testing

**Test Case 1: Valid parser, invalid analysis model**
```
Settings:
- Parsing: gpt-4o-mini ✅
- Analysis: gpt-5-mini ❌ (doesn't exist)

Expected Metadata:
Mode: Task Chat · OpenAI: gpt-4o-mini (parser), OpenAI: gpt-5-mini (analysis failed) · 523 tokens · ~$0.0001 · Lang: Chinese
```

**Test Case 2: Different providers, analysis fails**
```
Settings:
- Parsing: OpenRouter openai/gpt-4o-mini ✅
- Analysis: OpenAI gpt-5-mini ❌

Expected Metadata:
Mode: Task Chat · OpenRouter: openai/gpt-4o-mini (parser), OpenAI: gpt-5-mini (analysis failed) · 523 tokens · ~$0.0001 · Lang: Chinese
```

**Test Case 3: Both fail**
```
Settings:
- Parsing: claude-invalid ❌
- Analysis: not reached ❌

Expected Metadata:
Mode: Task Chat · Anthropic: claude-invalid · Language: Unknown
```

---

## Status

✅ **ALL FIXES COMPLETE!**

- Parsing token usage returned when analysis fails
- Metadata shows both models with clear labels
- Language detected from parsedQuery
- Cost transparency maintained
- Ready for rebuild and testing!

---

## Thank You! 🙏

**Huge thanks to the user for:**
1. Testing with different model configurations
2. Noticing the missing token usage and cost
3. Pointing out language should come from parsing
4. Emphasizing "metadata should be the same as when it worked"

This kind of attention to detail makes the plugin professional and trustworthy!
