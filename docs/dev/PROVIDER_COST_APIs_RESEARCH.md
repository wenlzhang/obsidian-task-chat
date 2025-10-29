# Provider Cost APIs Research

## Question
Can we get **actual cost charged** from OpenAI and Anthropic APIs (like we do with OpenRouter)?

## Current Situation

### OpenRouter ✅
**API Response includes:**
```json
{
  "data": {
    "usage": {
      "prompt_tokens": 10431,
      "completion_tokens": 3362
    },
    "total_cost": "0.009332"  ← ACTUAL COST!
  }
}
```
**Endpoint:** `GET /api/v1/generation?id={generation_id}`

### OpenAI ❌
**API Response includes:**
```json
{
  "usage": {
    "prompt_tokens": 7676,
    "completion_tokens": 318,
    "total_tokens": 7994
  }
  // NO COST FIELD!
}
```
**Streaming:** Same - only token counts in `usage` field
**No generation/usage API** that returns actual cost per request

### Anthropic ❌
**API Response includes:**
```json
{
  "usage": {
    "input_tokens": 7676,
    "output_tokens": 318
  }
  // NO COST FIELD!
}
```
**No generation/usage API** that returns actual cost per request

## APIs Available

### OpenRouter
- ✅ **Generation API**: Returns actual cost per request
- ✅ **Models API**: Returns current pricing
- ✅ **Best for accuracy**: Actual cost includes markup

### OpenAI
- ❌ **No per-request cost API**
- ✅ **Pricing page**: https://openai.com/pricing (manual)
- ⚠️ **Usage API**: `/v1/usage` returns daily totals, not per-request
- ⚠️ **Must calculate**: tokens × rate

### Anthropic
- ❌ **No per-request cost API**
- ✅ **Pricing page**: https://anthropic.com/pricing (manual)
- ⚠️ **Must calculate**: tokens × rate

## Recommendation for Consistency

### Option 1: Best Available from Each Provider ✅ (RECOMMENDED)

**OpenRouter:**
```typescript
// Use actual cost from Generation API
const actualCost = response.data.total_cost; // ✅ PERFECT
```

**OpenAI:**
```typescript
// Calculate using official pricing
// Get pricing from: https://openai.com/pricing
const cost = (promptTokens / 1M) * inputRate + (completionTokens / 1M) * outputRate;
// Keep embedded pricing updated with official rates
```

**Anthropic:**
```typescript
// Calculate using official pricing
// Get pricing from: https://anthropic.com/pricing  
const cost = (inputTokens / 1M) * inputRate + (outputTokens / 1M) * outputRate;
// Keep embedded pricing updated with official rates
```

**Key Points:**
- ✅ Use actual cost when provider gives it (OpenRouter)
- ✅ Use official pricing for calculation when provider doesn't (OpenAI/Anthropic)
- ✅ Keep embedded pricing in sync with official rates
- ✅ Embedded pricing as fallback only

### Option 2: Use Billing APIs for Historical Data (NOT Real-time)

**OpenAI Usage API:**
```
GET https://api.openai.com/v1/usage?date=2025-01-29
```
Returns daily aggregated usage, not per-request cost
❌ Not suitable for real-time cost tracking

**Anthropic:**
No usage API available
❌ Must use dashboard for historical usage

### Option 3: Dashboard Scraping ❌ (NOT RECOMMENDED)
- Fragile, breaks with UI changes
- May violate TOS
- Not real-time
- ❌ Don't do this

## Implementation Strategy

### Phase 1: Current (Implemented)
- ✅ OpenRouter: Use actual cost from Generation API
- ✅ OpenAI/Anthropic: Calculate using pricing data
- ✅ Embedded pricing as fallback

### Phase 2: Pricing Accuracy (TODO)
- [ ] Add OpenAI pricing scraper/updater
- [ ] Add Anthropic pricing scraper/updater  
- [ ] Alert when embedded pricing is stale
- [ ] Consider fetching pricing from provider docs regularly

### Phase 3: Verification (TODO)
- [ ] Add cost comparison with dashboard
- [ ] Log warnings when calculated differs from expected
- [ ] User-facing cost reports

## Conclusion

**Answer to User's Question:**
> "For OpenAI and Anthropic, if we use them directly as the provider, are we also obtaining the actual cost from the API?"

**No.** OpenAI and Anthropic **do not provide actual cost** in their API responses. They only provide token counts. We **must calculate** the cost using:
1. Token counts (from API) ✅
2. Pricing rates (from official pricing pages or embedded fallback) ⚠️

**To maintain consistency:**
- ✅ Always use actual provider data when available (OpenRouter)
- ✅ Calculate using official pricing when cost not provided (OpenAI/Anthropic)
- ✅ Keep embedded pricing synchronized with official rates
- ✅ Use embedded pricing only as fallback
- ✅ Document clearly which method is used for each provider

**The best we can do** for consistency is:
1. Document the limitation clearly
2. Ensure our pricing data matches official rates exactly
3. Add verification/comparison tools
4. Log clearly when using calculated vs actual costs
