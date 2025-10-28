# Cost Calculation Fix for Mixed Local/Cloud Models

**Date:** 2025-01-28

## Problem

The cost calculation in the metadata display was incorrect when using a mix of local and cloud models. Specifically:

1. **Parser (cloud) + Analysis (local)**: Showed "Free (local)" despite parser incurring costs
2. **Parser (local) + Analysis (cloud)**: Would show "Free (local)" if old logic checked only main provider

### Example from User

```
Mode: Task Chat • OpenAI: gpt-4o-mini (parser), Ollama: qwen3:14b (analysis)
~35,077 tokens (34,758 in, 319 out), Free (local)  ❌ WRONG!
```

**Expected:** Should show actual cost for the parser portion (e.g., `~$0.0052`)

## Root Cause

**File:** `src/services/metadataService.ts` (lines 119-136)

The cost display logic only checked `message.tokenUsage.provider === "ollama"` to determine if the operation was free. This didn't account for mixed configurations where:
- Parser uses cloud model (OpenAI/Anthropic/OpenRouter) but analysis uses local (Ollama)
- Parser uses local (Ollama) but analysis uses cloud model

```typescript
// BEFORE (WRONG)
if (message.tokenUsage.provider === "ollama") {
    // Shows "Free (local)" even if parser used cloud model
    parts.push(
        `${tokenStr}${totalTokens.toLocaleString()} tokens (...), Free (local)`,
    );
} else {
    // Shows cost
    const cost = message.tokenUsage.estimatedCost || 0;
    parts.push(
        `${tokenStr}${totalTokens.toLocaleString()} tokens (...), ${costStr}`,
    );
}
```

## Solution

Updated the logic to check BOTH `parsingProvider` and `analysisProvider`:

```typescript
// AFTER (CORRECT)
// Determine if using ONLY local models (both parser and analysis)
// If ANY cloud model is involved, show actual cost
const parsingProvider =
    message.tokenUsage.parsingProvider ||
    message.tokenUsage.provider;
const analysisProvider =
    message.tokenUsage.analysisProvider ||
    message.tokenUsage.provider;

const bothLocal =
    parsingProvider === "ollama" && analysisProvider === "ollama";

if (bothLocal) {
    // Both parser and analysis use local models → Free
    parts.push(
        `${tokenStr}${totalTokens.toLocaleString()} tokens (${promptTokens.toLocaleString()} in, ${completionTokens.toLocaleString()} out), Free (local)`,
    );
} else {
    // At least one cloud model is used → Show actual cost
    const cost = message.tokenUsage.estimatedCost || 0;
    let costStr: string;
    if (cost === 0) {
        costStr = "$0.00";
    } else if (cost < 0.01) {
        costStr = `~$${cost.toFixed(4)}`;
    } else {
        costStr = `~$${cost.toFixed(2)}`;
    }
    parts.push(
        `${tokenStr}${totalTokens.toLocaleString()} tokens (${promptTokens.toLocaleString()} in, ${completionTokens.toLocaleString()} out), ${costStr}`,
    );
}
```

## Cost Calculation Logic

The actual cost calculation in `aiService.ts` (lines 1201-1203) was already correct:

```typescript
estimatedCost:
    parserUsage.estimatedCost +
    tokenUsage.estimatedCost,
```

This correctly sums the costs:
- If parser uses cloud model: `parserUsage.estimatedCost` > 0
- If parser uses Ollama: `parserUsage.estimatedCost` = 0
- If analysis uses cloud model: `tokenUsage.estimatedCost` > 0
- If analysis uses Ollama: `tokenUsage.estimatedCost` = 0

The issue was only in the **display logic**, not the cost calculation itself.

## Test Cases

### Case 1: Both Local (Ollama)
```
Parser: Ollama (qwen3:14b)
Analysis: Ollama (qwen3:14b)
→ Display: "Free (local)" ✅
→ Cost: $0.00 ✅
```

### Case 2: Parser Cloud, Analysis Local
```
Parser: OpenAI (gpt-4o-mini), cost = $0.0052
Analysis: Ollama (qwen3:14b), cost = $0.00
→ Display: "~$0.0052" ✅ (was "Free (local)" ❌)
→ Cost: $0.0052 ✅
```

### Case 3: Parser Local, Analysis Cloud
```
Parser: Ollama (qwen3:14b), cost = $0.00
Analysis: OpenAI (gpt-4o-mini), cost = $0.0234
→ Display: "~$0.02" ✅ (would have been "Free (local)" ❌)
→ Cost: $0.0234 ✅
```

### Case 4: Both Cloud
```
Parser: OpenAI (gpt-4o-mini), cost = $0.0052
Analysis: Anthropic (claude-3-5-sonnet), cost = $0.1234
→ Display: "~$0.13" ✅
→ Cost: $0.1286 ✅
```

## Impact

### Before Fix
- **Parser (cloud) + Analysis (local)**: Showed "Free (local)", users didn't see actual costs ❌
- **Parser (local) + Analysis (cloud)**: Might show "Free (local)" depending on main provider ❌
- Users couldn't accurately track API costs when using mixed configurations

### After Fix
- **Both local**: Shows "Free (local)" ✅
- **Any cloud model**: Shows actual cost ✅
- Users can accurately track API costs in all configurations
- Consistent cost display regardless of which component uses cloud models

## Additional Bugs Found During Code Review

After the initial fix, a comprehensive codebase review revealed additional issues:

### Bug #2: Anthropic API Calls Using Wrong Provider

**Location:** `src/services/aiService.ts` (lines 2476, 2480, 2545, 2549)

Both streaming and non-streaming Anthropic calls were using `settings.aiProvider` instead of the local `provider` variable:

```typescript
// BEFORE (WRONG)
estimatedCost: this.calculateCost(
    promptTokens,
    completionTokens,
    providerConfig.model,
    settings.aiProvider,  // ❌ Wrong! Uses global default
    settings.pricingCache.data,
),
provider: settings.aiProvider,  // ❌ Wrong!
```

**Fix:** Use the local `provider` variable from `getProviderForPurpose(settings, "analysis")`:

```typescript
// AFTER (CORRECT)
estimatedCost: this.calculateCost(
    promptTokens,
    completionTokens,
    providerConfig.model,
    provider,  // ✅ Correct! Uses analysis provider
    settings.pricingCache.data,
),
provider: provider,  // ✅ Correct!
```

Also added missing analysis model tracking fields to match other providers.

### Bug #3: Missing Analysis Model Tracking in Ollama

**Location:** `src/services/aiService.ts` (lines 2675-2688, 2772-2785)

Ollama calls (both streaming and non-streaming) were missing the analysis model tracking fields that other providers had:

```typescript
// BEFORE (INCOMPLETE)
const tokenUsage: TokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: 0,
    model: providerConfig.model,
    provider: "ollama",
    isEstimated: !tokenUsageInfo,
    // Missing: analysisModel, analysisProvider, analysisTokens, analysisCost
};
```

**Fix:** Added missing tracking fields for consistency:

```typescript
// AFTER (COMPLETE)
const tokenUsage: TokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: 0,
    model: providerConfig.model,
    provider: "ollama",
    isEstimated: !tokenUsageInfo,
    // Track analysis model separately
    analysisModel: model,
    analysisProvider: "ollama",
    analysisTokens: promptTokens + completionTokens,
    analysisCost: 0,
};
```

### Verification: Query Parser Service Already Correct

**Location:** `src/services/aiQueryParserService.ts`

All query parser API calls (OpenAI, Anthropic, Ollama) were already correctly using the local `provider` variable from `getProviderForPurpose(settings, "parsing")`. No changes needed! ✅

## Files Modified

- `src/services/metadataService.ts` (lines 119-147): Fixed cost display logic
- `src/services/aiService.ts` (lines 2468-2493, 2548-2573): Fixed Anthropic API calls to use correct provider
- `src/services/aiService.ts` (lines 2675-2688, 2772-2785): Added missing analysis tracking to Ollama calls

## User Benefits

1. **Accurate cost tracking**: Users see actual costs when ANY cloud model is involved
2. **Budget awareness**: Can monitor spending even with mixed configurations
3. **Transparency**: Clear indication of whether operation was free or had costs
4. **Decision making**: Can evaluate cost-effectiveness of different model combinations

## Configuration Examples

Users can now accurately see costs for various configurations:

**Budget-conscious (minimize costs):**
```
Parser: Ollama (fast, local)
Analysis: Ollama (capable, local)
→ Cost: $0.00, Privacy: High
```

**Fast parsing, powerful analysis:**
```
Parser: OpenAI gpt-4o-mini (fast, cheap)
Analysis: Anthropic claude-3-5-sonnet (powerful, expensive)
→ Cost: Parser $0.005 + Analysis $0.120 = $0.125/query
```

**Quality parsing, budget analysis:**
```
Parser: Anthropic claude-3-5-sonnet (best parsing)
Analysis: Ollama (free)
→ Cost: Parser $0.030 + Analysis $0.00 = $0.030/query
```

**All cloud (maximum quality):**
```
Parser: OpenAI gpt-4o-mini
Analysis: OpenAI gpt-4o-mini
→ Cost: Parser $0.005 + Analysis $0.020 = $0.025/query
```

## Status

✅ **COMPLETE** - Cost calculation now correctly reflects actual usage in all local/cloud combinations!
