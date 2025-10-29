# Cost Tracking Best Practices for AI Providers

**Purpose**: Guidelines for accurate token and cost tracking across different AI providers (OpenAI, OpenRouter, Anthropic, Ollama).

## Overview

Different AI providers offer different levels of cost transparency:

| Provider | Token Counts | Actual Cost API | Fallback Method |
|----------|--------------|-----------------|-----------------|
| OpenRouter | ✅ In response | ✅ Generation API | Pricing table |
| OpenAI | ✅ In response | ❌ No | Pricing table |
| Anthropic | ✅ In response | ❌ No | Pricing table |
| Ollama | ⚠️ Estimated | ❌ Local/Free | N/A ($0) |

## Best Practices by Provider

### OpenRouter

**Always fetch actual cost from Generation API:**

```typescript
// 1. Extract generation ID from response
const generationId = data.id || headers["x-generation-id"];

// 2. Fetch actual usage and cost
if (generationId) {
    const usageData = await fetchOpenRouterUsage(generationId, apiKey);
    if (usageData) {
        // Use ACTUAL values from API
        promptTokens = usageData.promptTokens;
        completionTokens = usageData.completionTokens;
        actualCost = usageData.actualCost;
    }
}

// 3. Always prefer actual cost over calculated
const finalCost = actualCost !== undefined ? actualCost : calculatedCost;
```

**Why this matters:**
- OpenRouter has volume discounts (actual < published)
- Model routing can use cheaper providers
- Promotional pricing
- Credits applied automatically

**Typical difference**: 5-20% lower than pricing table

**Logging best practice:**
```typescript
if (actualCost !== undefined) {
    Logger.debug(`Using actual cost: $${actualCost.toFixed(6)}`);
    if (Math.abs(actualCost - calculatedCost) > 0.000001) {
        Logger.warn(
            `Actual ($${actualCost.toFixed(6)}) differs from ` +
            `calculated ($${calculatedCost.toFixed(6)}) - using actual`
        );
    }
}
```

**Error handling:**
```typescript
try {
    const usageData = await fetchOpenRouterUsage(generationId, apiKey);
    if (usageData) {
        return usageData;
    }
} catch (error) {
    Logger.warn(`Generation API failed, using estimates: ${error}`);
    // Fall back to pricing table
}
```

### OpenAI

**Use token counts from response, calculate cost from pricing table:**

```typescript
// 1. Extract token counts (always provided)
const usage = data.usage || {};
const promptTokens = usage.prompt_tokens || 0;
const completionTokens = usage.completion_tokens || 0;

// 2. Calculate cost from pricing table (no API for actual cost)
const cost = calculateCost(
    promptTokens,
    completionTokens,
    model,
    "openai",
    pricingCache
);

// 3. Mark as not estimated (token counts are real)
return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: cost,
    isEstimated: false, // Token counts real, only cost calculated
};
```

**Why pricing table is acceptable:**
- OpenAI has consistent, published pricing
- No volume discounts (for most users)
- Pricing changes infrequently
- Typically accurate within 1-2%

**Pricing table maintenance:**
- Update when OpenAI announces price changes
- Check quarterly: https://openai.com/api/pricing/
- Use automatic pricing updates if available

### Anthropic

**Same as OpenAI - use response tokens, calculate cost:**

```typescript
// 1. Extract token counts (Anthropic format)
const usage = data.usage || {};
const promptTokens = usage.input_tokens || 0;  // Different key!
const completionTokens = usage.output_tokens || 0;  // Different key!

// 2. Calculate cost
const cost = calculateCost(
    promptTokens,
    completionTokens,
    model,
    "anthropic",
    pricingCache
);

return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: cost,
    isEstimated: false,
};
```

**Key differences from OpenAI:**
- Uses `input_tokens` / `output_tokens` instead of `prompt_tokens` / `completion_tokens`
- Anthropic has tiered pricing (changes with usage volume)
- Cost calculation may vary by user's tier

**Pricing complexity:**
- Standard tier: Fixed rates
- Scale tier: Volume discounts
- Enterprise: Custom pricing

**Best practice**: Inform users that displayed cost is based on standard tier

### Ollama (Local Models)

**Local models = $0 cost, token estimation only:**

```typescript
// 1. Estimate tokens (Ollama doesn't provide counts)
const promptTokens = estimateTokenCount(inputText);
const completionTokens = estimateTokenCount(outputText);

// 2. Cost is always $0 (local)
return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: 0,
    isEstimated: true, // Both tokens and cost estimated
};
```

**Token estimation methods:**
1. Simple: `text.length / 4` (rough approximation)
2. Better: Use tiktoken library
3. Best: Use model-specific tokenizer

**Display recommendations:**
- Show "~X tokens" with tilde to indicate estimation
- Show "Free (local)" instead of "$0.00"
- Don't track cumulative cost for local models

## Combining Costs from Multiple Calls

When combining parser + analysis calls:

```typescript
// CORRECT: Both use same cost source
const parserCost = parserUsage.estimatedCost;  // Actual from API
const analysisCost = analysisUsage.estimatedCost;  // Actual from API
const totalCost = parserCost + analysisCost;  // ✅ Accurate

// WRONG: Mixed sources
const parserCost = calculatedFromPricingTable;  // Estimate
const analysisCost = actualFromAPI;  // Actual
const totalCost = parserCost + analysisCost;  // ❌ Inconsistent!
```

**Key principle**: Use same cost source for all calls being combined

**Implementation:**
```typescript
// Ensure both parser and analysis fetch actual costs
if (provider === "openrouter") {
    // Parser: Fetch actual cost
    const parserActual = await fetchOpenRouterUsage(parserId, apiKey);
    
    // Analysis: Fetch actual cost
    const analysisActual = await fetchOpenRouterUsage(analysisId, apiKey);
    
    // Combine: Both are actual
    const totalCost = parserActual.cost + analysisActual.cost;
}
```

## Pricing Table Management

### Structure

```typescript
interface PricingData {
    [modelKey: string]: {
        input: number;   // Per 1M tokens
        output: number;  // Per 1M tokens
    };
}

// Example
const pricing: PricingData = {
    "openai/gpt-4o-mini": {
        input: 0.150,   // $0.150 per 1M input tokens
        output: 0.600,  // $0.600 per 1M output tokens
    },
    "openrouter/gpt-4o-mini": {
        input: 0.150,
        output: 0.600,
    },
};
```

### Update Frequency

- **OpenRouter**: Daily (has API endpoint for pricing)
- **OpenAI**: Monthly check (stable pricing)
- **Anthropic**: Monthly check (stable pricing)
- **Ollama**: Never (always $0)

### Automatic Updates

```typescript
// Fetch latest pricing from OpenRouter
async function updateOpenRouterPricing(cache: PricingCache): Promise<void> {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        const data = await response.json();
        
        data.data.forEach((model: any) => {
            const key = `openrouter/${model.id}`;
            cache[key] = {
                input: model.pricing.prompt * 1000000,  // Convert to per-1M
                output: model.pricing.completion * 1000000,
            };
        });
        
        // Save updated cache
        await savePricingCache(cache);
        Logger.debug("OpenRouter pricing updated");
    } catch (error) {
        Logger.warn(`Pricing update failed: ${error}`);
    }
}
```

## Cost Calculation Formula

```typescript
function calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string,
    provider: string,
    pricingCache: PricingData
): number {
    // 1. Get pricing for model
    const modelKey = `${provider}/${model}`;
    const rates = pricingCache[modelKey];
    
    // 2. Fallback to default if unknown
    if (!rates) {
        Logger.warn(`Unknown model: ${modelKey}, using gpt-4o-mini fallback`);
        return calculateCost(
            promptTokens,
            completionTokens,
            "gpt-4o-mini",
            "openai",
            pricingCache
        );
    }
    
    // 3. Calculate (rates are per 1M tokens)
    const inputCost = (promptTokens / 1000000) * rates.input;
    const outputCost = (completionTokens / 1000000) * rates.output;
    
    return inputCost + outputCost;
}
```

**Key points:**
- Pricing is **per 1 million tokens** (industry standard)
- Divide token counts by 1,000,000
- Multiply by rate
- Sum input + output costs

## Display Best Practices

### Metadata Line Format

```typescript
// Good: Clear, informative
"📊 Mode: Task Chat • OpenRouter: gpt-4o-mini (parser), gpt-5-mini (analysis) • 
 32,237 tokens (27,618 in, 4,619 out), ~$0.01 • Lang: Chinese"

// Bad: Incomplete
"📊 Task Chat • $0.01"
```

### Console Log Format

```typescript
// Good: Detailed for debugging
"[Cost Breakdown] Parsing: gpt-4o-mini (openrouter) = $0.004600 | 
 Analysis: gpt-5-mini (openrouter) = $0.007200 | 
 Total: $0.011800"

// Bad: Missing context
"Cost: $0.01"
```

### Cost Display Precision

```typescript
// Rules:
if (cost === 0) {
    return "$0.00";
} else if (cost < 0.01) {
    return `~$${cost.toFixed(4)}`;  // Show 4 decimals for tiny amounts
} else {
    return `~$${cost.toFixed(2)}`;  // Show 2 decimals normally
}

// Examples:
// $0.00       - Zero cost
// ~$0.0003    - Very small (< 1 cent)
// ~$0.05      - Normal small amount
// ~$1.23      - Larger amount
```

### Token Display

```typescript
// Use toLocaleString() for readability
const display = `${totalTokens.toLocaleString()} tokens`;

// Examples:
// 1,234 tokens
// 32,237 tokens
// 1,234,567 tokens
```

## Verification Strategies

### 1. Dashboard Comparison (Most Reliable)

For each query:
1. Record plugin's displayed cost
2. Check provider dashboard within 5 minutes
3. Compare values
4. Investigate if difference > 5%

**When to check:**
- During development
- After changing cost tracking code
- Weekly spot checks in production
- After provider pricing updates

### 2. Cumulative Cost Tracking

```typescript
// In settings
interface PluginSettings {
    totalTokensUsed: number;
    totalCost: number;
    lastResetDate: string;
}

// After each query
settings.totalTokensUsed += tokenUsage.totalTokens;
settings.totalCost += tokenUsage.estimatedCost;
await saveSettings();

// Compare with provider dashboard monthly
```

### 3. Automated Testing

```typescript
// Test with known queries
async function testCostAccuracy() {
    const query = "Show urgent tasks";
    
    // Make API call
    const result = await processQuery(query);
    
    // Expected values (from previous runs)
    const expectedTokens = 2500;
    const expectedCost = 0.00035;
    
    // Verify within tolerance
    assert(Math.abs(result.tokens - expectedTokens) < 100);
    assert(Math.abs(result.cost - expectedCost) < 0.00001);
}
```

## Error Handling

### Generation API Failures

```typescript
// Graceful fallback
try {
    const actual = await fetchOpenRouterUsage(id, key);
    return actual;
} catch (error) {
    Logger.warn(`Generation API failed: ${error.message}`);
    // Fall back to pricing table
    return {
        promptTokens,
        completionTokens,
        estimatedCost: calculateCost(...),
        isEstimated: true,  // Mark as fallback
    };
}
```

### Invalid Pricing Data

```typescript
// Detect and handle
if (!rates || rates.input === 0 || rates.output === 0) {
    Logger.error(`Invalid pricing for ${model}: ${JSON.stringify(rates)}`);
    // Use safe fallback
    return calculateCost(
        promptTokens,
        completionTokens,
        "gpt-4o-mini",
        "openai",
        pricingCache
    );
}
```

### Network Issues

```typescript
// Timeout for generation API
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

try {
    const response = await fetch(url, { signal: controller.signal });
    // ...
} catch (error) {
    if (error.name === "AbortError") {
        Logger.warn("Generation API timeout, using estimates");
    }
} finally {
    clearTimeout(timeout);
}
```

## Common Pitfalls

### ❌ Pitfall 1: Mixing Actual and Calculated Costs

```typescript
// WRONG
const parserCost = calculateFromTable(parserTokens);  // Calculated
const analysisCost = fetchActual(analysisId);  // Actual
const total = parserCost + analysisCost;  // Inconsistent!
```

**Fix**: Fetch actual for both or calculate for both

### ❌ Pitfall 2: Not Handling Generation API Delays

```typescript
// WRONG - too fast
const response = await callAPI();
const usage = await fetchUsage(response.id);  // May return null!
```

**Fix**: Add retry with delay
```typescript
async function fetchUsageWithRetry(id: string, apiKey: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        const usage = await fetchUsage(id, apiKey);
        if (usage) return usage;
        
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return null;
}
```

### ❌ Pitfall 3: Hardcoded Pricing

```typescript
// WRONG
const cost = (tokens / 1000000) * 0.15;  // Hardcoded rate!
```

**Fix**: Always use pricing table
```typescript
const rates = pricingCache[`${provider}/${model}`];
const cost = (tokens / 1000000) * rates.input;
```

### ❌ Pitfall 4: Ignoring Provider-Specific Token Keys

```typescript
// WRONG - assumes OpenAI format for all
const promptTokens = usage.prompt_tokens;  // Fails for Anthropic!
```

**Fix**: Handle provider differences
```typescript
const promptTokens = provider === "anthropic"
    ? usage.input_tokens
    : usage.prompt_tokens;
```

### ❌ Pitfall 5: Not Marking Estimates

```typescript
// WRONG
return {
    ...tokenUsage,
    isEstimated: false,  // But we calculated the cost!
};
```

**Fix**: Be honest about estimates
```typescript
return {
    ...tokenUsage,
    isEstimated: !actualCostAvailable,  // True if calculated
};
```

## Testing Checklist

For each AI provider integration:

- [ ] Token counts match provider dashboard
- [ ] Costs match provider dashboard (within 5%)
- [ ] Generation API fetched for OpenRouter
- [ ] Fallback works when generation API fails
- [ ] Pricing table has all supported models
- [ ] Console logs show cost source (actual vs calculated)
- [ ] Metadata displays combined totals correctly
- [ ] Cumulative cost tracking works
- [ ] Local models show $0 / "Free (local)"
- [ ] Error cases handled gracefully

## References

- **OpenRouter API**: https://openrouter.ai/docs
- **OpenRouter Generation API**: https://openrouter.ai/docs#generation
- **OpenAI Pricing**: https://openai.com/api/pricing/
- **Anthropic Pricing**: https://www.anthropic.com/pricing
- **Token Counting**: https://github.com/openai/tiktoken

## Maintenance Schedule

| Task | Frequency | Priority |
|------|-----------|----------|
| Verify OpenRouter costs | Daily during dev | High |
| Update OpenRouter pricing | Automated/Daily | Medium |
| Check OpenAI pricing | Monthly | Low |
| Check Anthropic pricing | Monthly | Low |
| Review cumulative costs | Monthly | Medium |
| Dashboard spot checks | Weekly | High |
| Pricing table accuracy | Quarterly | Medium |

## Summary

**Golden Rules:**

1. **Always fetch actual costs from APIs when available** (OpenRouter)
2. **Use provider-specific token keys** (input_tokens vs prompt_tokens)
3. **Fall back gracefully** when APIs fail
4. **Be transparent** about actual vs calculated costs
5. **Verify regularly** against provider dashboards
6. **Handle errors** without crashing
7. **Log clearly** for debugging
8. **Test thoroughly** with real API calls
