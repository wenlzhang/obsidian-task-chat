# Cost Tracking Testing Guide

**Purpose**: Verify that token counts and costs displayed in the plugin match the actual charges from AI providers.

## Testing Checklist

### 1. OpenRouter Testing (Primary Fix)

#### Setup
- Set Parser provider: OpenRouter
- Set Analysis provider: OpenRouter
- Use gpt-4o-mini for parser, gpt-5-mini for analysis
- Enable console logging (Dev Tools → Console)

#### Test Procedure

**Step 1: Make a Task Chat query**
```
Query: "Show me urgent tasks due this week"
```

**Step 2: Check Console Logs**

Look for these log messages in sequence:

**Parser Logs:**
```
[OpenRouter Parser] ✓ Generation ID from response: gen-xxxxx
[OpenRouter Parser] Fetching actual token usage and cost for generation gen-xxxxx...
[OpenRouter Parser] Raw generation data: {"usage":{"prompt_tokens":X,"completion_tokens":Y},"total_cost":"0.00XXXX"}
[OpenRouter Parser] ✓ Got actual usage: X prompt + Y completion
[OpenRouter Parser] ✓ Using actual cost from API: $0.00XXXX (not calculated)
[Cost Parser] Using actual cost from openrouter API: $0.00XXXX
```

**Analysis Logs:**
```
[OpenRouter] ✓ Generation ID: gen-yyyyy
[OpenRouter] Fetching actual token usage and cost for generation gen-yyyyy...
[OpenRouter] Raw generation data: {"usage":{"prompt_tokens":A,"completion_tokens":B},"total_cost":"0.00YYYY"}
[OpenRouter] ✓ Got actual usage: A prompt + B completion
[OpenRouter] ✓ Using actual cost from API: $0.00YYYY (not calculated)
[Cost] Using actual cost from openrouter API: $0.00YYYY
```

**Combined Logs:**
```
[Task Chat] Combined token usage: 
  Parser (openrouter/gpt-4o-mini: X+Y tokens, $0.00XXXX) + 
  Analysis (openrouter/gpt-5-mini: A+B tokens, $0.00YYYY) = 
  (X+Y+A+B) total tokens, $0.00ZZZZ total cost
```

**Step 3: Check Metadata Display**

Plugin should show:
```
📊 Mode: Task Chat • OpenRouter: gpt-4o-mini (parser), gpt-5-mini (analysis) • 
   XX,XXX tokens (YY,YYY in, ZZZ out), ~$0.XX • Lang: English
```

**Step 4: Verify Against OpenRouter Dashboard**

1. Go to https://openrouter.ai/activity
2. Find the two most recent API calls
3. Compare:
   - Parser call tokens → Should match console log
   - Analysis call tokens → Should match console log
   - Parser call cost → Should match console log
   - Analysis call cost → Should match console log
   - Total tokens → Should match metadata display
   - Total cost → Should match metadata display

**Expected Result:** ✅ All values match exactly!

#### Common Issues

**Issue 1: "Generation ID not found"**
```
[OpenRouter Parser] ⚠️ Generation ID not found, using estimated costs
```
**Cause**: Response doesn't include `id` field or headers
**Impact**: Falls back to pricing table (may differ from actual)
**Action**: Check OpenRouter API response format

**Issue 2: "Generation API returned 404"**
```
[OpenRouter] Generation API returned 404
```
**Cause**: Generation ID is invalid or too old
**Impact**: Falls back to pricing table
**Action**: OpenRouter may expire generation data after some time

**Issue 3: Cost mismatch with dashboard**
```
[Cost Parser] Actual cost ($0.004600) differs from calculated ($0.004125) - using actual
```
**Expected**: This is NORMAL! OpenRouter's actual costs differ from published rates
**Action**: Verify we're using the actual cost (first value), not calculated

### 2. OpenAI Testing

OpenAI doesn't provide a generation API for actual costs, so we use their published rates.

#### Setup
- Set Parser provider: OpenAI
- Set Analysis provider: OpenAI
- Use gpt-4o-mini for both

#### Test Procedure

**Step 1: Make a query**
```
Query: "Show overdue tasks"
```

**Step 2: Check Console Logs**

**Parser Logs:**
```
[Cost Parser] Calculated cost for openai/gpt-4o-mini: $0.00XXXX
```

**Analysis Logs:**
```
[Cost] Calculated cost for openai/gpt-4o-mini: $0.00YYYY
```

Note: No "Using actual cost from API" - this is expected!

**Step 3: Verify Against OpenAI Usage Page**

1. Go to https://platform.openai.com/usage
2. Check daily usage
3. Compare total cost with plugin's total cost setting

**Expected Result:** Within 1-2% margin (pricing table vs actual)

### 3. Anthropic Testing

Anthropic provides token counts in response but not cost.

#### Setup
- Set Parser provider: Anthropic
- Set Analysis provider: Anthropic
- Use claude-3-5-sonnet-20241022 for both

#### Test Procedure

**Step 1: Make a query**
```
Query: "Find high priority tasks"
```

**Step 2: Check Console Logs**

**Parser Logs:**
```
[Cost Parser] Calculated cost for anthropic/claude-3-5-sonnet-20241022: $0.00XXXX
```

**Analysis Logs:**
```
[Cost] Calculated cost for anthropic/claude-3-5-sonnet-20241022: $0.00YYYY
```

**Step 3: Verify Token Counts**

Compare plugin token counts with Anthropic Console:
1. Go to https://console.anthropic.com/settings/usage
2. Check recent API calls
3. Token counts should match exactly
4. Cost should be within 1-2% (depends on pricing tier)

### 4. Mixed Provider Testing

#### Setup
- Set Parser provider: OpenRouter (gpt-4o-mini)
- Set Analysis provider: OpenAI (gpt-4o)

#### Test Procedure

**Step 1: Make a query**
```
Query: "Show tasks tagged #work"
```

**Step 2: Check Console Logs**

**Parser Logs:**
```
[OpenRouter Parser] ✓ Using actual cost from API: $0.00XXXX
[Cost Parser] Using actual cost from openrouter API: $0.00XXXX
```

**Analysis Logs:**
```
[Cost] Calculated cost for openai/gpt-4o: $0.00YYYY
```

**Combined:**
```
[Task Chat] Combined token usage: 
  Parser (openrouter/gpt-4o-mini: X tokens, $0.00XXXX) + 
  Analysis (openai/gpt-4o: Y tokens, $0.00YYYY) = 
  Z total tokens, $0.00ZZZZ total cost
```

**Expected Result:** 
- Parser cost is ACTUAL from OpenRouter
- Analysis cost is CALCULATED from pricing table
- Total is sum of both

### 5. Ollama Testing (Local Models)

#### Setup
- Set Parser provider: Ollama
- Set Analysis provider: Ollama
- Use llama3:latest for both

#### Test Procedure

**Step 1: Make a query**
```
Query: "Show completed tasks"
```

**Step 2: Check Console Logs**

Both should show:
```
[Cost] Calculated cost for ollama/llama3:latest: $0.000000
```

**Step 3: Check Metadata Display**

Should show:
```
📊 Mode: Task Chat • Ollama: llama3:latest (parser + analysis) • 
   XX,XXX tokens (YY,YYY in, ZZZ out), Free (local) • Lang: English
```

**Expected Result:** $0.00 cost, "Free (local)" label

## Automated Verification Script

Create a test file `test-cost-tracking.md` in your vault:

```markdown
# Cost Tracking Test Cases

## Test 1: Simple keyword query
- [ ] Query: "urgent tasks"
- [ ] Check logs for both parser and analysis
- [ ] Verify metadata shows combined cost
- [ ] Compare with provider dashboard

## Test 2: Complex query with properties
- [ ] Query: "Show high priority tasks due this week in #work folder"
- [ ] Verify parser extracts properties correctly
- [ ] Check analysis provides recommendations
- [ ] Verify cost tracking for both calls

## Test 3: Multilingual query
- [ ] Query: "紧急任务" (urgent tasks in Chinese)
- [ ] Check language detection in logs
- [ ] Verify semantic expansion costs
- [ ] Compare with dashboard

## Test 4: Error case - invalid API key
- [ ] Set invalid API key temporarily
- [ ] Make a query
- [ ] Verify error shows 0 tokens but proper error message
- [ ] Restore valid API key
```

## Dashboard Comparison Checklist

For each test, verify in provider dashboard:

### OpenRouter Dashboard
- [ ] Activity page shows 2 calls (parser + analysis)
- [ ] Parser call tokens match console log
- [ ] Analysis call tokens match console log
- [ ] Parser call cost matches console log (actual cost)
- [ ] Analysis call cost matches console log (actual cost)
- [ ] Total matches plugin metadata display

### OpenAI Dashboard
- [ ] Usage page shows 2 API calls
- [ ] Total tokens approximately match (within 5%)
- [ ] Total cost approximately match (within 1-2%)
- [ ] No significant discrepancies

### Anthropic Console
- [ ] Recent calls show 2 requests
- [ ] Token counts match exactly
- [ ] Cost within expected range for tier

## Expected Console Log Format

### Complete Success Flow (OpenRouter)

```
=== PARSER CALL ===
[AI Query Parser] Parsing query: "urgent tasks"
[OpenRouter Parser] Calling OpenRouter with model: gpt-4o-mini
[OpenRouter Parser] ✓ Generation ID from response: gen-abc123
[OpenRouter Parser] Fetching actual token usage and cost for generation gen-abc123...
[OpenRouter Parser] Raw generation data: {"usage":{"prompt_tokens":150,"completion_tokens":80},"total_cost":"0.000035"}
[OpenRouter Parser] ✓ Got actual usage: 150 prompt + 80 completion
[OpenRouter Parser] ✓ Using actual cost from API: $0.000035 (not calculated)
[Cost Parser] Using actual cost from openrouter API: $0.000035

=== ANALYSIS CALL ===
[Task Chat] Sending top 32 tasks to AI (max: 100)
[OpenRouter] Calling OpenRouter with model: gpt-5-mini
[OpenRouter] Response headers: {...}
[OpenRouter] ✓ Generation ID: gen-def456
[OpenRouter] Streaming completed successfully
[OpenRouter] Fetching actual token usage and cost for generation gen-def456...
[OpenRouter] Raw generation data: {"usage":{"prompt_tokens":2500,"completion_tokens":150},"total_cost":"0.000285"}
[OpenRouter] ✓ Got actual usage: 2500 prompt + 150 completion
[OpenRouter] ✓ Using actual cost from API: $0.000285 (not calculated)
[Cost] Using actual cost from openrouter API: $0.000285

=== COMBINATION ===
[Task Chat] Combined token usage: Parser (openrouter/gpt-4o-mini: 230) + Analysis (openrouter/gpt-5-mini: 2650) = 2880 total tokens
[Cost Breakdown] Parsing: gpt-4o-mini (openrouter) = $0.000035 | Analysis: gpt-5-mini (openrouter) = $0.000285 | Total: $0.000320
[Cost Accumulation] Added $0.000320, New total: $0.045678
```

### Fallback Flow (Generation API Fails)

```
[OpenRouter Parser] ⚠️ Generation ID not found, using estimated costs
[Cost Parser] Calculated cost for openrouter/gpt-4o-mini: $0.000034
```

## Known Limitations

1. **OpenRouter delay**: Generation API data may take 1-2 seconds to become available
2. **Historical data**: OpenRouter may only keep generation data for 24-48 hours
3. **Pricing changes**: Cached pricing tables updated every 24 hours
4. **Rate limits**: Generation API has same rate limits as main API
5. **Network issues**: If generation API is unreachable, falls back to estimates

## Success Criteria

✅ **PASS** if:
- Console logs show "Using actual cost from API" for OpenRouter
- Token counts match dashboard exactly
- Total cost matches dashboard within $0.0001
- Metadata display shows combined values correctly
- No errors in console

❌ **FAIL** if:
- Console shows "using estimated costs" when using OpenRouter
- Token count difference > 100 tokens
- Cost difference > 10%
- Metadata shows only one call's data
- Errors about missing generation ID

## Debugging Tips

### Issue: No generation ID found

**Check 1**: Response body
```javascript
// In console, after API call:
console.log(data.id); // Should print generation ID
```

**Check 2**: Response headers
```javascript
// In callOpenAI method, add:
Logger.debug(`Response object keys: ${Object.keys(response)}`);
Logger.debug(`Response headers: ${JSON.stringify((response as any).headers)}`);
```

### Issue: Generation API returns 404

**Possible causes:**
1. Generation ID is invalid format
2. Data expired (>24 hours old)
3. OpenRouter API endpoint changed
4. Rate limiting on generation API

**Solution**: Check OpenRouter API docs for current endpoint

### Issue: Cost mismatch

**Expected behavior**: Actual cost ≠ Calculated cost

This is NORMAL because:
- OpenRouter has volume discounts
- Promotional pricing
- Model routing (may use cheaper provider)
- Credits applied

**Action**: Always use actual cost when available!

## References

- OpenRouter Docs: https://openrouter.ai/docs
- OpenRouter Generation API: https://openrouter.ai/docs#generation
- OpenAI Usage Page: https://platform.openai.com/usage
- Anthropic Console: https://console.anthropic.com/settings/usage
