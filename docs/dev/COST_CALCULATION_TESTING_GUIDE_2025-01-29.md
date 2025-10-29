# Cost Calculation Testing Guide - 2025-01-29

## What Was Fixed

### 1. Enhanced Pricing Lookup Logging
- **File**: `src/services/pricingService.ts`
- **Changes**: Added detailed `[Pricing]` logs showing:
  - Which pricing source is used (cache, embedded, partial match)
  - Exact rates found ($X/$Y per 1M tokens)
  - Model ID format being looked up
  - Whether lookup succeeded or failed

### 2. Enhanced Cost Calculation Logging
- **Files**: `src/services/aiService.ts`, `src/services/aiQueryParserService.ts`
- **Changes**: Added detailed `[Cost]` logs showing:
  - Token counts (prompt + completion)
  - Rates being used ($X/1M input, $Y/1M output)
  - Final calculated cost
  - Whether fallback pricing was used

### 3. Cost Breakdown in Chat View
- **File**: `src/views/chatView.ts`
- **Changes**: Added `[Cost Breakdown]` and `[Cost Accumulation]` logs showing:
  - Separate parsing and analysis costs
  - Models and providers used for each
  - Total cost for the query
  - Running total after accumulation

## How to Test

### Step 1: Enable Debug Logging

Open Obsidian Developer Console (Ctrl+Shift+I or Cmd+Option+I) and ensure you can see console logs.

### Step 2: Test Scenario 1 - Cloud + Cloud (Your Case)

**Configuration:**
- Parsing: OpenAI GPT-4o-mini (direct API)
- Analysis: OpenRouter OpenAI GPT-4o-mini

**Expected Logs:**
```
[Pricing] Looking up: model="gpt-4o-mini", provider="openai", openRouterFormat="openai/gpt-4o-mini"
[Pricing] ✓ Found model in cache: gpt-4o-mini ($0.15/$0.6 per 1M)
[Cost] Calculating for: gpt-4o-mini (openai), 250 prompt + 50 completion tokens
[Cost] gpt-4o-mini: 250 × $0.15/1M + 50 × $0.6/1M = $0.000068

[Pricing] Looking up: model="gpt-4o-mini", provider="openrouter", openRouterFormat="openai/gpt-4o-mini"
[Pricing] ✓ Found exact match in cache: openai/gpt-4o-mini ($0.20/$0.80 per 1M)
[Cost] Calculating for: gpt-4o-mini (openrouter), 1500 prompt + 300 completion tokens
[Cost] gpt-4o-mini: 1500 × $0.20/1M + 300 × $0.80/1M = $0.000540

[Cost Breakdown] Parsing: gpt-4o-mini (openai) = $0.000068 | Analysis: gpt-4o-mini (openrouter) = $0.000540 | Total: $0.000608
[Cost Accumulation] Added $0.000608, New total: $0.012345
```

**What to Check:**
1. ✅ Parsing uses OpenAI rates ($0.15/$0.60)
2. ✅ Analysis uses OpenRouter rates (higher, e.g., $0.20/$0.80)
3. ✅ Total = parsing + analysis
4. ✅ Accumulation adds correct total

### Step 3: Test Scenario 2 - Cloud + Local

**Configuration:**
- Parsing: OpenAI GPT-4o-mini
- Analysis: Ollama llama3.2

**Expected Logs:**
```
[Pricing] Looking up: model="gpt-4o-mini", provider="openai", openRouterFormat="openai/gpt-4o-mini"
[Pricing] ✓ Found model in cache: gpt-4o-mini ($0.15/$0.6 per 1M)
[Cost] Calculating for: gpt-4o-mini (openai), 250 prompt + 50 completion tokens
[Cost] gpt-4o-mini: 250 × $0.15/1M + 50 × $0.6/1M = $0.000068

[Cost] Ollama model llama3.2: $0.00 (local)

[Cost Breakdown] Parsing: gpt-4o-mini (openai) = $0.000068 | Analysis: llama3.2 (ollama) = $0.000000 | Total: $0.000068
[Cost Accumulation] Added $0.000068, New total: $0.012413
```

**What to Check:**
1. ✅ Parsing has cost
2. ✅ Analysis cost = $0.00 (Ollama is local)
3. ✅ Total = parsing only

### Step 4: Test Scenario 3 - Local + Cloud

**Configuration:**
- Parsing: Ollama llama3.2
- Analysis: OpenRouter GPT-4o-mini

**Expected Logs:**
```
[Cost] Ollama model llama3.2: $0.00 (local)

[Pricing] Looking up: model="gpt-4o-mini", provider="openrouter", openRouterFormat="openai/gpt-4o-mini"
[Pricing] ✓ Found exact match in cache: openai/gpt-4o-mini ($0.20/$0.80 per 1M)
[Cost] Calculating for: gpt-4o-mini (openrouter), 1500 prompt + 300 completion tokens
[Cost] gpt-4o-mini: 1500 × $0.20/1M + 300 × $0.80/1M = $0.000540

[Cost Breakdown] Parsing: llama3.2 (ollama) = $0.000000 | Analysis: gpt-4o-mini (openrouter) = $0.000540 | Total: $0.000540
[Cost Accumulation] Added $0.000540, New total: $0.012953
```

**What to Check:**
1. ✅ Parsing cost = $0.00 (Ollama is local)
2. ✅ Analysis has cost
3. ✅ Total = analysis only

### Step 5: Test Scenario 4 - Local + Local

**Configuration:**
- Parsing: Ollama llama3.2
- Analysis: Ollama llama3.2

**Expected Logs:**
```
[Cost] Ollama model llama3.2: $0.00 (local)
[Cost] Ollama model llama3.2: $0.00 (local)

[Cost Breakdown] Parsing: llama3.2 (ollama) = $0.000000 | Analysis: llama3.2 (ollama) = $0.000000 | Total: $0.000000
[Cost Accumulation] Added $0.000000, New total: $0.012953
```

**What to Check:**
1. ✅ Both costs = $0.00
2. ✅ Total = $0.00
3. ✅ No accumulation

## Verifying Against OpenRouter Dashboard

### Step 1: Note Your Current Total
Before testing, note your current `totalCost` in settings.

### Step 2: Run a Query
Execute a query using OpenRouter for analysis.

### Step 3: Check Console Logs
Look for the `[Cost Breakdown]` log and note the total cost.

### Step 4: Check OpenRouter Dashboard
Go to OpenRouter dashboard and find the same query. Compare:
- **Token counts**: Should match exactly
- **Cost**: Should match within rounding (±$0.000001)

### Step 5: Check Plugin Total
After query, check settings. The increase should match the logged cost.

## Common Issues and Solutions

### Issue 1: Pricing Not Found
**Log:**
```
[Pricing] ✗ No pricing found for: gpt-4o-mini (provider: openrouter, tried: openai/gpt-4o-mini)
[Cost] Unknown model pricing for: gpt-4o-mini, using gpt-4o-mini fallback
```

**Cause:** Pricing cache doesn't have OpenRouter rates.

**Solution:**
1. Go to settings → AI Provider Configuration
2. Click "Refresh Pricing Cache"
3. Wait for success message
4. Try query again

### Issue 2: Wrong Rates Used
**Log:**
```
[Pricing] ✓ Found model in cache: gpt-4o-mini ($0.15/$0.6 per 1M)
[Cost] gpt-4o-mini: 1500 × $0.15/1M + 300 × $0.6/1M = $0.000405
```

**Expected (OpenRouter):**
```
[Pricing] ✓ Found exact match in cache: openai/gpt-4o-mini ($0.20/$0.80 per 1M)
[Cost] gpt-4o-mini: 1500 × $0.20/1M + 300 × $0.80/1M = $0.000540
```

**Cause:** Using direct OpenAI rates instead of OpenRouter rates.

**Solution:**
1. Refresh pricing cache (see above)
2. Ensure model ID in settings matches OpenRouter format
3. Check that provider is set to "openrouter"

### Issue 3: Cost Mismatch with Dashboard
**Plugin shows:** $0.000405
**OpenRouter shows:** $0.000540

**Cause:** Using wrong pricing source (embedded instead of cached).

**Solution:**
1. Check `[Pricing]` log - should say "Found exact match in cache"
2. If says "Using embedded rate", refresh pricing cache
3. Embedded rates are for direct API, not OpenRouter

### Issue 4: Accumulation Incorrect
**Log:**
```
[Cost Breakdown] Total: $0.000608
[Cost Accumulation] Added $0.000608, New total: $0.012345
```

**But settings shows:** $0.011737 (different!)

**Cause:** Multiple queries running simultaneously or settings not saved.

**Solution:**
1. Wait for all queries to complete
2. Check for error messages in console
3. Restart Obsidian to ensure settings saved

## Expected Behavior Summary

### Correct Pricing Lookup
1. ✅ OpenRouter models use OpenRouter rates (with markup)
2. ✅ Direct API models use direct API rates
3. ✅ Ollama models always $0.00
4. ✅ Fallback to gpt-4o-mini if model not found

### Correct Cost Calculation
1. ✅ Cost = (prompt_tokens / 1M) × input_rate + (completion_tokens / 1M) × output_rate
2. ✅ Parsing and analysis calculated separately
3. ✅ Total = parsing_cost + analysis_cost
4. ✅ Ollama contributes $0.00

### Correct Accumulation
1. ✅ Each query adds its total cost once
2. ✅ No double-counting
3. ✅ Running total increases correctly
4. ✅ Matches sum of all individual query costs

## Debugging Checklist

When costs don't match OpenRouter:

- [ ] Check `[Pricing]` logs - which source was used?
- [ ] Check `[Cost]` logs - which rates were used?
- [ ] Check `[Cost Breakdown]` - parsing + analysis = total?
- [ ] Check `[Cost Accumulation]` - total increased correctly?
- [ ] Refresh pricing cache and try again
- [ ] Compare token counts with OpenRouter dashboard
- [ ] Verify model ID format (should include provider prefix for OpenRouter)
- [ ] Check provider setting (should be "openrouter" not "openai")

## Success Criteria

✅ **Test passes if:**
1. Console logs show detailed pricing lookup
2. Console logs show detailed cost calculation
3. Console logs show cost breakdown (parsing + analysis)
4. Console logs show accumulation
5. Plugin total cost matches sum of all logged costs
6. Plugin total cost matches OpenRouter dashboard (within $0.000001)
7. All four scenarios (cloud+cloud, cloud+local, local+cloud, local+local) work correctly

## Next Steps

After testing:
1. Document any remaining discrepancies
2. Check if pricing cache needs more frequent updates
3. Consider adding cost breakdown to UI (not just console)
4. Consider adding cost warnings for expensive queries
