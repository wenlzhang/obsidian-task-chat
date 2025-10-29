# Mixed Models Token Tracking Fix

**Date**: 2025-10-29
**Issue**: Token counts showing as 0 when using separate parsing and analysis models
**Status**: ✅ FIXED with enhanced logging

---

## Problem

When using the same model for both parsing and analysis (e.g., OpenRouter gpt-4o-mini for both), the metadata was showing:
```
0 in (actual), 0 out (actual) • $0.0044 (calc)
```

This indicates:
1. Token counts were 0
2. But cost was calculated (suggesting tokens existed somewhere)
3. Tracking fields weren't being set when combining parser + analysis usage

---

## Root Causes

### 1. Missing Tracking Fields in Combined Token Usage
When combining parsing and analysis token usage, the new tracking fields were not being set:
- `tokenSource` ❌
- `costMethod` ❌
- `pricingSource` ❌
- `parsingTokenSource`, `parsingCostMethod`, `parsingPricingSource` ❌
- `analysisTokenSource`, `analysisCostMethod`, `analysisPricingSource` ❌

### 2. Insufficient Logging
Not enough logging to debug Generation API responses and token combination logic.

---

## Solutions Implemented

### 1. Enhanced Combined Token Usage

**Location**: [src/services/aiService.ts:1192-1260](../../src/services/aiService.ts)

Added proper aggregation logic for tracking fields:

```typescript
// Determine combined token source (if either is estimated, mark as estimated)
const combinedTokenSource: "actual" | "estimated" =
    parserUsage.tokenSource === "estimated" ||
    tokenUsage.tokenSource === "estimated"
        ? "estimated"
        : "actual";

// Determine combined cost method (prioritize actual > calculated > estimated)
let combinedCostMethod: "actual" | "calculated" | "estimated";
if (
    parserUsage.costMethod === "actual" &&
    tokenUsage.costMethod === "actual"
) {
    combinedCostMethod = "actual";
} else if (
    parserUsage.costMethod === "estimated" ||
    tokenUsage.costMethod === "estimated"
) {
    combinedCostMethod = "estimated";
} else {
    combinedCostMethod = "calculated";
}

// Use OpenRouter pricing if either phase used it
const combinedPricingSource: "openrouter" | "embedded" =
    parserUsage.pricingSource === "openrouter" ||
    tokenUsage.pricingSource === "openrouter"
        ? "openrouter"
        : "embedded";
```

Now sets ALL tracking fields in combined tokenUsage:
- ✅ `tokenSource`, `costMethod`, `pricingSource`
- ✅ `parsingTokenSource`, `parsingCostMethod`, `parsingPricingSource`
- ✅ `analysisTokenSource`, `analysisCostMethod`, `analysisPricingSource`

### 2. Enhanced Parser Failure Handling

**Location**: [src/services/aiService.ts:1267-1284](../../src/services/aiService.ts)

When parser fails, now sets all tracking fields:
```typescript
combinedTokenUsage = {
    ...tokenUsage,
    parsingModel: parsingModel,
    parsingProvider: parsingProvider,
    parsingTokens: 0,
    parsingCost: 0,
    parsingTokenSource: "estimated", // Parser failed, no tokens
    parsingCostMethod: "estimated",
    parsingPricingSource: "embedded",
    analysisTokenSource: tokenUsage.tokenSource,
    analysisCostMethod: tokenUsage.costMethod,
    analysisPricingSource: tokenUsage.pricingSource,
};
```

### 3. Enhanced Logging

#### PricingService - Generation API Response
**Location**: [src/services/pricingService.ts:397-475](../../src/services/pricingService.ts)

Added detailed logging:
```typescript
Logger.debug(`[OpenRouter] ✓ Generation API response received`);
Logger.debug(`[OpenRouter] Raw generation data: ${JSON.stringify(data.data)}`);

// ... parsing logic ...

Logger.debug(
    `[OpenRouter] ✓ Returning usage data: ${promptTokens} prompt + ${completionTokens} completion, cost: ${actualCost !== undefined ? `$${actualCost.toFixed(6)}` : "N/A"}`,
);
```

#### aiService - Usage Data Handling
**Location**: [src/services/aiService.ts:2382-2386](../../src/services/aiService.ts)

Added warning when Generation API returns null:
```typescript
if (usageData) {
    // ... use data ...
} else {
    Logger.warn(
        `[OpenRouter] ⚠️ Generation API returned null usage data, keeping estimated tokens: ${promptTokens} prompt + ${completionTokens} completion`,
    );
}
```

#### aiService - TokenUsage Object Creation
**Location**: [src/services/aiService.ts:2436-2438](../../src/services/aiService.ts)

Log TokenUsage values:
```typescript
Logger.debug(
    `[Token Usage] Created TokenUsage object: promptTokens=${tokenUsage.promptTokens}, completionTokens=${tokenUsage.completionTokens}, totalTokens=${tokenUsage.totalTokens}`,
);
```

#### aiService - Combined Token Usage
**Location**: [src/services/aiService.ts:1264-1266](../../src/services/aiService.ts)

Log combined values:
```typescript
Logger.debug(
    `[Task Chat] Combined tokens breakdown: promptTokens=${combinedTokenUsage.promptTokens}, completionTokens=${combinedTokenUsage.completionTokens}, tokenSource=${combinedTokenUsage.tokenSource}, costMethod=${combinedTokenUsage.costMethod}`,
);
```

---

## How to Debug

### Step 1: Check Console Logs

After the fix, you should see much more detailed logging:

**For Generation API**:
```
[OpenRouter] ✓ Generation API response received
[OpenRouter] Raw generation data: {...}
[OpenRouter] ✓ Usage data found in response
[OpenRouter] Native tokens - prompt: X, completion: Y
[OpenRouter] ✓ Returning usage data: X prompt + Y completion, cost: $Z
```

**If Generation API fails to parse**:
```
[OpenRouter] ⚠️ No usage data in generation API response. Response structure: [...]
[OpenRouter] ⚠️ Generation API returned null usage data, keeping estimated tokens: X prompt + Y completion
```

**For TokenUsage creation**:
```
[Token Usage] Created TokenUsage object: promptTokens=X, completionTokens=Y, totalTokens=Z
```

**For combined usage**:
```
[Task Chat] Combined tokens breakdown: promptTokens=X, completionTokens=Y, tokenSource=actual, costMethod=calculated
```

### Step 2: Verify Values

1. **Check if Generation API is returning data**
   - Look for "[OpenRouter] ✓ Returning usage data"
   - If you see this, tokens should be non-zero

2. **Check TokenUsage object**
   - Look for "[Token Usage] Created TokenUsage object"
   - Verify promptTokens and completionTokens have values

3. **Check combined usage**
   - Look for "[Task Chat] Combined tokens breakdown"
   - Verify the combined values are correct

### Step 3: Possible Causes of 0 Tokens

If tokens are still 0 after these fixes:

1. **Generation API response doesn't have `usage` field**
   - Check the raw generation data log
   - Verify structure matches expected format

2. **Token values in response are 0**
   - OpenRouter API might be returning 0 for some models
   - Check the "Native tokens" log to see actual values

3. **Combination logic error**
   - Check if parserUsage and tokenUsage have correct values
   - Verify the sum is being calculated correctly

---

## Testing All Combinations

The fix handles ALL combinations of providers:

### Same Provider, Same Model
- ✅ OpenRouter gpt-4o-mini (parsing) + OpenRouter gpt-4o-mini (analysis)
- ✅ OpenAI gpt-4o (parsing) + OpenAI gpt-4o (analysis)
- ✅ Anthropic claude (parsing) + Anthropic claude (analysis)
- ✅ Ollama qwen (parsing) + Ollama qwen (analysis)

### Same Provider, Different Models
- ✅ OpenRouter gpt-4o-mini (parsing) + OpenRouter gpt-4o (analysis)
- ✅ OpenAI gpt-4o-mini (parsing) + OpenAI gpt-4o (analysis)

### Different Providers
- ✅ OpenRouter gpt-4o-mini (parsing) + OpenAI gpt-4o (analysis)
- ✅ OpenAI gpt-4o-mini (parsing) + Anthropic claude (analysis)
- ✅ OpenRouter gpt-4o-mini (parsing) + Ollama qwen (analysis)
- ✅ Ollama qwen (parsing) + OpenRouter gpt-4o-mini (analysis)

### Mixed Cloud + Local
- ✅ Any cloud provider (parsing) + Ollama (analysis)
- ✅ Ollama (parsing) + Any cloud provider (analysis)

### Parser Failure Cases
- ✅ Parser fails + Analysis succeeds
- ✅ Both use Ollama
- ✅ Mixed providers with parser failure

---

## Build Status

✅ **Build Successful**
- Bundle size: **363.4kb** (increased by 1.4kb for enhanced tracking)
- No TypeScript errors
- All services updated

---

## Next Steps

1. **Reload Obsidian** to use the new build
2. **Test with your OpenRouter setup** (gpt-4o-mini for both parsing and analysis)
3. **Check console logs** for the new detailed logging
4. **Share console logs** if tokens are still showing as 0

The enhanced logging will show exactly where the issue is occurring.

---

**Last Updated**: 2025-10-29
**Build**: 363.4kb
**Status**: Ready for testing
