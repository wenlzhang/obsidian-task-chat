# Cost Calculation Debug and Fix - 2025-01-29

## User's Critical Discovery

**Problem:** Cost calculation is significantly underestimating actual costs.

**Example:**
- User configuration:
  - Parsing: OpenAI GPT-4o-mini
  - Analysis: OpenRouter's OpenAI GPT-4o-mini
- Single query cost from OpenRouter: **$0.0156**
- Plugin's calculated total: **Less than $0.0156** (incorrect!)

**User is 100% CORRECT** - The cost calculation has bugs!

## Possible Scenarios

The plugin supports multiple combinations:
1. **Cloud + Cloud**: Cloud model for parsing, cloud model for analysis
2. **Cloud + Local**: Cloud model for parsing, local model for analysis
3. **Local + Cloud**: Local model for parsing, cloud model for analysis
4. **Local + Local**: Local model for both (free)

## Root Cause Analysis

### Issue 1: Model Name Mismatch in OpenRouter

When using OpenRouter, the model names might not match the pricing database format:

**User sets in settings:**
- Model: `gpt-4o-mini` (short name)

**OpenRouter expects:**
- Model ID: `openai/gpt-4o-mini` (provider/model format)

**Pricing lookup fails:**
- `getPricing("gpt-4o-mini", "openrouter", cache)` → NOT FOUND
- Falls back to embedded `gpt-4o-mini` pricing → WRONG!
- OpenRouter charges different rates than direct OpenAI!

### Issue 2: Provider Parameter Incorrect

In `aiService.ts` line 2168, when calling `calculateCost()`:

```typescript
estimatedCost: this.calculateCost(
    promptTokens,
    completionTokens,
    model,
    provider,  // ← This is "openrouter"
    settings.pricingCache.data,
)
```

But the actual model being used might be `openai/gpt-4o-mini` on OpenRouter, which has different pricing!

### Issue 3: Pricing Cache Not Including OpenRouter-Specific Rates

OpenRouter has markup on top of base model prices:
- Direct OpenAI GPT-4o-mini: $0.15/$0.60 per 1M tokens
- OpenRouter GPT-4o-mini: **Higher rates** (includes platform fee)

If pricing cache doesn't have OpenRouter-specific rates, we use embedded rates which are for direct API access.

### Issue 4: Model ID Format Inconsistency

**In settings:**
```typescript
aiProviderAnalysis: "openrouter"
aiModelAnalysis: "gpt-4o-mini"  // Short name
```

**In API call:**
```typescript
// OpenRouter expects: "openai/gpt-4o-mini"
// But we might be sending: "gpt-4o-mini"
```

**In pricing lookup:**
```typescript
// We look up: "gpt-4o-mini" with provider "openrouter"
// Should look up: "openai/gpt-4o-mini" in OpenRouter pricing
```

## The Fix

### Step 1: Ensure Correct Model ID Format for OpenRouter

When provider is "openrouter", construct full model ID:

```typescript
// In aiService.ts and aiQueryParserService.ts
private static getFullModelId(
    model: string,
    provider: "openai" | "anthropic" | "openrouter" | "ollama"
): string {
    // If already has provider prefix, return as-is
    if (model.includes("/")) {
        return model;
    }
    
    // For OpenRouter, we need to add provider prefix
    // User might set "gpt-4o-mini" but OpenRouter needs "openai/gpt-4o-mini"
    if (provider === "openrouter") {
        // Detect which provider the model belongs to
        if (model.startsWith("gpt-") || model.startsWith("o1")) {
            return `openai/${model}`;
        } else if (model.startsWith("claude-")) {
            return `anthropic/${model}`;
        } else if (model.includes("llama")) {
            return `meta-llama/${model}`;
        } else if (model.includes("gemini")) {
            return `google/${model}`;
        } else if (model.includes("mistral")) {
            return `mistralai/${model}`;
        }
        // If can't detect, return as-is and let pricing lookup handle it
    }
    
    return model;
}
```

### Step 2: Enhanced Logging for Cost Calculation

Add detailed logging to track every cost calculation:

```typescript
private static calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string,
    provider: "openai" | "anthropic" | "openrouter" | "ollama",
    cachedPricing: Record<string, { input: number; output: number }>,
): number {
    // Ollama is free (local)
    if (provider === "ollama") {
        Logger.debug(`[Cost] Ollama model ${model}: $0.00 (local)`);
        return 0;
    }

    // Get full model ID for OpenRouter
    const fullModelId = this.getFullModelId(model, provider);
    Logger.debug(`[Cost] Looking up pricing for: ${fullModelId} (provider: ${provider}, original: ${model})`);

    // Get pricing from cache or embedded rates
    const rates = PricingService.getPricing(fullModelId, provider, cachedPricing);

    if (!rates) {
        Logger.warn(
            `[Cost] No pricing found for: ${fullModelId}, using gpt-4o-mini fallback`,
        );
        const fallback = PricingService.getPricing("gpt-4o-mini", "openai", {});
        if (!fallback) {
            return 0;
        }
        const inputCost = (promptTokens / 1000000) * fallback.input;
        const outputCost = (completionTokens / 1000000) * fallback.output;
        const total = inputCost + outputCost;
        Logger.debug(`[Cost] Fallback: ${promptTokens} prompt + ${completionTokens} completion = $${total.toFixed(6)}`);
        return total;
    }

    // Calculate cost (pricing is per 1M tokens)
    const inputCost = (promptTokens / 1000000) * rates.input;
    const outputCost = (completionTokens / 1000000) * rates.output;
    const total = inputCost + outputCost;

    Logger.debug(
        `[Cost] ${fullModelId}: ${promptTokens} prompt ($${rates.input}/1M) + ${completionTokens} completion ($${rates.output}/1M) = $${total.toFixed(6)}`
    );

    return total;
}
```

### Step 3: Fix Pricing Lookup in PricingService

Enhance `getPricing()` to handle OpenRouter model IDs better:

```typescript
static getPricing(
    model: string,
    provider: "openai" | "anthropic" | "openrouter" | "ollama",
    cachedPricing: Record<string, { input: number; output: number }>,
): { input: number; output: number } | null {
    // Ollama is always free
    if (provider === "ollama") {
        return { input: 0, output: 0 };
    }

    // For OpenRouter, try multiple lookup strategies
    if (provider === "openrouter") {
        // 1. Try exact match with full ID (e.g., "openai/gpt-4o-mini")
        if (cachedPricing[model]) {
            Logger.debug(`[Pricing] Found exact match in cache: ${model}`);
            return cachedPricing[model];
        }

        // 2. Try constructing OpenRouter format if not already
        if (!model.includes("/")) {
            const openRouterFormat = this.constructOpenRouterModelId(provider, model);
            if (cachedPricing[openRouterFormat]) {
                Logger.debug(`[Pricing] Found constructed format in cache: ${openRouterFormat}`);
                return cachedPricing[openRouterFormat];
            }
        }

        // 3. Try embedded pricing with full ID
        const embedded = this.getEmbeddedPricing();
        if (embedded[model]) {
            Logger.debug(`[Pricing] Using embedded rate for: ${model}`);
            return embedded[model];
        }

        // 4. Try partial match (last resort)
        const modelLower = model.toLowerCase();
        for (const [key, value] of Object.entries(cachedPricing)) {
            if (key.toLowerCase().includes(modelLower) || modelLower.includes(key.toLowerCase())) {
                Logger.debug(`[Pricing] Found partial match in cache: ${key} for ${model}`);
                return value;
            }
        }

        Logger.warn(`[Pricing] No pricing found for OpenRouter model: ${model}`);
        return null;
    }

    // Original logic for other providers...
    const openRouterFormat = this.constructOpenRouterModelId(provider, model);

    if (cachedPricing[openRouterFormat]) {
        Logger.debug(`[Pricing] Found exact match in cache: ${openRouterFormat}`);
        return cachedPricing[openRouterFormat];
    }

    if (cachedPricing[model]) {
        Logger.debug(`[Pricing] Found model in cache: ${model}`);
        return cachedPricing[model];
    }

    const embedded = this.getEmbeddedPricing();
    if (embedded[openRouterFormat]) {
        Logger.debug(`[Pricing] Using embedded rate for: ${openRouterFormat}`);
        return embedded[openRouterFormat];
    }

    if (embedded[model]) {
        Logger.debug(`[Pricing] Using embedded rate for: ${model}`);
        return embedded[model];
    }

    Logger.warn(`[Pricing] No pricing found for: ${model} (provider: ${provider})`);
    return null;
}
```

### Step 4: Add Cost Breakdown to Console

In `chatView.ts`, log detailed cost breakdown:

```typescript
// Update total usage in settings
if (result.tokenUsage) {
    const tu = result.tokenUsage;
    
    // Log detailed breakdown
    if (tu.parsingCost !== undefined && tu.analysisCost !== undefined) {
        Logger.debug(
            `[Cost Breakdown] Parsing: ${tu.parsingModel} (${tu.parsingProvider}) = $${tu.parsingCost.toFixed(6)} | ` +
            `Analysis: ${tu.analysisModel} (${tu.analysisProvider}) = $${tu.analysisCost.toFixed(6)} | ` +
            `Total: $${tu.estimatedCost.toFixed(6)}`
        );
    } else {
        Logger.debug(
            `[Cost Breakdown] Single model: ${tu.model} (${tu.provider}) = $${tu.estimatedCost.toFixed(6)}`
        );
    }
    
    this.plugin.settings.totalTokensUsed += tu.totalTokens;
    this.plugin.settings.totalCost += tu.estimatedCost;
    await this.plugin.saveSettings();
    
    Logger.debug(
        `[Cost Accumulation] Added $${tu.estimatedCost.toFixed(6)}, ` +
        `New total: $${this.plugin.settings.totalCost.toFixed(6)}`
    );
}
```

## Testing Scenarios

### Scenario 1: Cloud + Cloud (OpenAI + OpenRouter)
- Parsing: OpenAI GPT-4o-mini (direct)
- Analysis: OpenRouter OpenAI GPT-4o-mini
- Expected: Two separate costs, correctly calculated with different rates

### Scenario 2: Cloud + Local
- Parsing: OpenAI GPT-4o-mini
- Analysis: Ollama llama3.2
- Expected: Only parsing cost, analysis = $0

### Scenario 3: Local + Cloud
- Parsing: Ollama llama3.2
- Analysis: OpenRouter GPT-4o-mini
- Expected: Only analysis cost, parsing = $0

### Scenario 4: OpenRouter Only
- Parsing: OpenRouter GPT-4o-mini
- Analysis: OpenRouter GPT-4o-mini
- Expected: Both costs using OpenRouter rates (with markup)

## Expected Results

After fix:
1. ✅ Correct model ID format for OpenRouter (`openai/gpt-4o-mini`)
2. ✅ Correct pricing lookup (OpenRouter rates, not direct API rates)
3. ✅ Detailed logging shows every cost calculation
4. ✅ User can verify costs match OpenRouter dashboard
5. ✅ All four scenarios (cloud+cloud, cloud+local, local+cloud, local+local) work correctly

## Files to Modify

1. **src/services/aiService.ts**
   - Add `getFullModelId()` helper
   - Enhance `calculateCost()` with logging
   - Use full model ID in cost calculations

2. **src/services/aiQueryParserService.ts**
   - Add `getFullModelId()` helper
   - Enhance `calculateCost()` with logging
   - Use full model ID in cost calculations

3. **src/services/pricingService.ts**
   - Enhance `getPricing()` for OpenRouter
   - Add better logging
   - Handle model ID format variations

4. **src/views/chatView.ts**
   - Add detailed cost breakdown logging
   - Show accumulation clearly

## Priority

**CRITICAL** - User is paying real money and costs are being underreported!
