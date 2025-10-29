# Token and Cost Tracking Guide

This guide explains how Task Chat tracks token usage and costs across different AI providers, and how to interpret the tracking metadata displayed in your chat interface.

## Overview

Task Chat provides **transparent, multi-layer cost tracking** for all AI operations:

- **Token Tracking**: Shows actual token counts from APIs or estimated counts when unavailable
- **Cost Tracking**: Displays actual costs (from API), calculated costs (from tokens + pricing), or estimated costs
- **Provider Support**: Works with OpenAI, Anthropic, OpenRouter, and Ollama
- **Mixed Models**: Correctly handles scenarios where parser and analysis use different providers

## Display Format

The cost tracking information appears in the metadata line below each AI response:

```
📊 Mode: Task Chat • OpenRouter: openai/gpt-4o-mini (parser + analysis) • 27,619 in (actual), 478 out (actual) • $0.0044 (actual) • Lang: Chinese
```

### Components

1. **Mode**: Which chat mode was used (Task Chat, Smart Search, or Simple Search)
2. **Model Info**: Provider and model for parsing and/or analysis
3. **Token Usage**: Input and output tokens with source indicator
4. **Cost**: Total cost with calculation method
5. **Language**: Detected language (for Smart Search and Task Chat)

## Understanding Symbols and Indicators

### Tilde (~) Symbol

The tilde `~` means **approximate** or **estimated** value:

- `27,619 in (actual)` - Actual tokens from API (no tilde)
- `~24,863 in (est)` - Estimated tokens (with tilde)
- `$0.0044 (actual)` - Actual cost from API (no tilde)
- `~$0.0039 (calc)` - Calculated cost from tokens (with tilde)

**Rule**: If it's **actual** data from the provider's API, no tilde. Otherwise, tilde indicates approximation.

### Token Source Indicators

- **(actual)** - Tokens obtained directly from provider API
- **(est)** - Tokens estimated using text length (1 token ≈ 4 characters)

### Cost Method Indicators

- **(actual)** - Cost obtained directly from provider API (OpenRouter only)
- **(calc)** - Cost calculated from actual tokens + pricing data
- **(est)** - Cost estimated from estimated tokens + pricing data

## Provider-Specific Behavior

### OpenRouter

**Best for accurate tracking!**

- ✅ Provides **actual token counts** via Generation API
- ✅ Provides **actual costs** via Generation API
- ✅ Works with all upstream models (OpenAI, Anthropic, etc.)
- ✅ No estimation needed

**Example:**
```
27,619 in (actual), 478 out (actual) • $0.0044 (actual)
```

### OpenAI (Direct)

- ⚠️ Token counts: **estimated** (streaming API doesn't return usage in all cases)
- ⚠️ Cost: **calculated** from estimated tokens + OpenRouter pricing cache
- ⚠️ Accuracy: ±20-30% for token estimates

**Example:**
```
~26,149 in (est), ~382 out (est) • ~$0.0042 (calc)
```

### Anthropic (Direct)

- ✅ Token counts: **actual** (Anthropic API provides usage)
- ⚠️ Cost: **calculated** from actual tokens + OpenRouter pricing cache
- ✅ Accuracy: High for tokens, good for cost

**Example:**
```
18,532 in (actual), 294 out (actual) • ~$0.0033 (calc)
```

### Ollama (Local)

- ⚠️ Token counts: **estimated** (local models may not report usage)
- ✅ Cost: **actual** ($0.00 - free!)
- ℹ️ Note: Ollama is local, so costs are always zero

**Example:**
```
~15,243 in (est), ~186 out (est) • Free (local)
```

## Mixed Provider Scenarios

When using different providers for parsing and analysis:

### Scenario 1: OpenRouter (parser) + OpenRouter (analysis)

**Token Source**: `actual`
**Cost Method**: `actual`

Both phases use OpenRouter → Both provide actual data.

```
27,619 in (actual), 478 out (actual) • $0.0044 (actual)
```

### Scenario 2: OpenRouter (parser) + OpenAI (analysis)

**Token Source**: `estimated`
**Cost Method**: `calculated` or `estimated`

Mixing providers → Tokens become estimated (even though parser was actual).
Cost is calculated/estimated based on mixed data.

```
~24,863 in (est), ~345 out (est) • ~$0.0039 (calc)
```

### Scenario 3: OpenAI (parser) + OpenRouter (analysis)

**Token Source**: `estimated`
**Cost Method**: `calculated` or `estimated`

Same as Scenario 2 - mixing providers results in estimated tokens.

```
~24,863 in (est), ~372 out (est) • ~$0.0027 (calc)
```

### Scenario 4: OpenRouter (parser) + Ollama (analysis)

**Token Source**: `estimated`
**Cost Method**: `actual`

Mixing providers → Tokens estimated.
But cost is actual because:
- Ollama is free ($0)
- OpenRouter provided actual parser cost
- Combined cost is actual ($X + $0 = $X)

```
~18,432 in (est), ~234 out (est) • $0.0027 (actual)
```

### Scenario 5: Ollama (parser) + Ollama (analysis)

**Token Source**: `estimated`
**Cost Method**: `actual`

Both local → Tokens estimated, cost is actual (free).

```
~15,243 in (est), ~186 out (est) • Free (local)
```

### Scenario 6: OpenAI (parser) + OpenAI (analysis)

**Token Source**: `estimated`
**Cost Method**: `estimated`

Both phases estimate tokens → Everything is estimated.

```
~26,149 in (est), ~382 out (est) • ~$0.0042 (est)
```

## Combining Rules

### Token Source Logic

1. **Both OpenRouter (not mixing)** → `actual`
2. **Any provider mixing** → `estimated`
3. **Any estimated phase** → `estimated`

### Cost Method Logic

1. **Both OpenRouter with actual costs** → `actual`
2. **OpenRouter + Ollama** → `actual` (one free, one actual)
3. **Both Ollama** → `actual` (both free)
4. **Any non-OpenRouter cloud mixing** → `calculated` or `estimated`

## Cost Estimation Accuracy

### High Accuracy (±5%)

- ✅ OpenRouter → OpenRouter: Both actual
- ✅ OpenRouter → Ollama: Parser actual, analysis free
- ✅ Anthropic tokens + OpenRouter pricing: Calculated from actual tokens

### Medium Accuracy (±15%)

- ⚠️ Calculated from actual tokens + cached pricing
- ⚠️ Anthropic/OpenAI direct: Tokens actual, but pricing may differ from OpenRouter

### Low Accuracy (±20-30%)

- ❌ OpenAI estimated tokens: Text length estimation is rough
- ❌ Mixed cloud providers: Estimation compounds across phases
- ❌ Chinese/Japanese text: Token estimation less accurate

## Best Practices

### For Maximum Accuracy

1. **Use OpenRouter for both parsing and analysis**
   - Provides actual tokens AND actual costs
   - Works with any upstream model (OpenAI, Anthropic, etc.)
   - Most transparent cost tracking

2. **Check the Generation API logs**
   - Look for `[OpenRouter] ✓ Got actual usage: X prompt + Y completion`
   - Confirms actual data was retrieved

3. **Enable console logging**
   - See detailed breakdown of token retrieval and cost calculation
   - Debug any discrepancies

### For Development/Testing

1. **Use Ollama for free testing**
   - No API costs
   - Good for development and experimentation
   - Tokens are estimated but cost is always $0

2. **Monitor your total costs**
   - Settings tab shows cumulative costs
   - Track usage across sessions

### Understanding Estimates

**When you see estimates:**

- OpenAI/Anthropic direct: API limitations or configuration
- Mixed providers: Combining different data sources
- Token estimation: Uses 1 token ≈ 4 characters (rough approximation)

**Estimation can be off by:**

- English text: ±10-20%
- Chinese/Japanese: ±25-35% (more tokens per character)
- Code/structured data: ±15-25%

## Cost Calculation Methods

### Layer 1: Actual Cost from API

**Source**: OpenRouter Generation API

1. Stream completion from OpenRouter
2. Extract `generation_id` from response
3. Query `https://openrouter.ai/api/v1/generation?id={generation_id}`
4. Extract `total_cost` and `native_tokens_*` fields
5. Use actual cost directly

**Result**: Highest accuracy, no calculation needed

### Layer 2: Calculated from Actual Tokens

**Source**: Provider API tokens + OpenRouter pricing cache

1. Get actual tokens from provider API (Anthropic, OpenAI with usage enabled)
2. Look up model pricing from OpenRouter pricing API (cached)
3. Calculate: `cost = (prompt_tokens × input_price) + (completion_tokens × output_price)`

**Result**: High accuracy if pricing cache is up-to-date

### Layer 3: Estimated from Text Length

**Source**: Character count + estimation formula

1. Count input characters: `input_text.length`
2. Count output characters: `response.length`
3. Estimate tokens: `tokens = characters ÷ 4`
4. Calculate cost using estimated tokens + pricing

**Result**: Rough approximation, ±20-30% accuracy

## Pricing Data Source

Task Chat uses the **OpenRouter pricing API** to get up-to-date pricing:

1. **Fetched**: Every 24 hours (cached)
2. **Source**: `https://openrouter.ai/api/v1/models`
3. **Fallback**: Embedded pricing if API fails
4. **Coverage**: All major models from OpenAI, Anthropic, Google, etc.

## Troubleshooting

### "All tokens showing as 0"

**Cause**: OpenRouter Generation API not returning data, and streaming API not providing usage.

**Solution**:
1. Check console logs for `[OpenRouter] ✓ Returning usage data`
2. Ensure streaming is enabled
3. Wait a few seconds after completion (Generation API has delay)

### "Costs differ significantly between providers"

**Cause**: Token estimation inaccuracy when using direct OpenAI/Anthropic.

**Solution**:
1. Use OpenRouter for both parsing and analysis (most accurate)
2. Understand that estimates can be ±20-30% off
3. Check console logs to see which method was used

### "Tilde (~) appearing when it shouldn't"

**Cause**: Provider mixing or estimation fallback.

**Solution**:
1. Check if you're mixing providers (e.g., OpenRouter parser + OpenAI analysis)
2. Verify OpenRouter Generation API is succeeding (check console)
3. Ensure `stream_options.include_usage: true` is enabled for OpenAI

## Model Configuration

To link to model configuration from the settings tab, see:
- [Model Configuration Guide](./MODEL_CONFIGURATION.md)
- [AI Provider Configuration](./AI_PROVIDER_CONFIGURATION.md)
- [Model Selection Guide](./MODEL_SELECTION_GUIDE.md)

## Console Logging

Enable debug logging to see detailed cost tracking:

### Parser Phase
```
[Cost Tracking Parser] Final: $0.002724, Method: actual, Pricing: openrouter, Tokens: actual
```

### Analysis Phase
```
[Cost Tracking] Final: $0.001705, Method: actual, Pricing: openrouter, Tokens: actual
```

### Combined Usage
```
[Task Chat] Combined tokens breakdown: promptTokens=27619, completionTokens=478, tokenSource=actual, costMethod=actual
```

## Summary

- **Use OpenRouter** for most accurate tracking (actual tokens AND costs)
- **Understand symbols**: `~` means approximate/estimated, no tilde means actual
- **Mixed providers** result in estimated tokens (even if one phase was actual)
- **Ollama is free** and always shows `Free (local)` regardless of token estimation
- **Check console logs** to debug and understand the tracking process

For more information, see the related documentation:
- [Model Configuration](./MODEL_CONFIGURATION.md)
- [AI Provider Configuration](./AI_PROVIDER_CONFIGURATION.md)
- [Settings Guide](./SETTINGS_GUIDE.md)
