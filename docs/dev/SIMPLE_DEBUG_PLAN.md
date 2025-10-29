# Simple Debug Plan - What's Actually Wrong?

## Current Situation

**Dashboard shows:**
- gpt-5-mini: 10,431 in + 3,782 out = **$0.0102**

**Plugin shows:**
- gpt-5-mini: 7,676 in + 246 out = **$0.0024** ❌

**Why the mismatch?**
- ❌ Using **ESTIMATED** tokens (7676 + 246)
- ❌ Not using **ACTUAL** tokens (10431 + 3782)

**Why not using actual tokens?**
- ❌ Generation ID not being extracted
- ❌ Can't query `/api/v1/generation` without ID
- ❌ Falls back to estimation

## OpenRouter Documentation Says

From https://openrouter.ai/docs/responses:

> "The token counts that are returned in the completions API response are not counted via the model's native tokenizer. Instead it uses a normalized, model-agnostic count."
>
> **"Credit usage and model pricing are based on the native token counts (not the 'normalized' token counts returned in the API response)."**
>
> **"For precise token accounting using the model's native tokenizer, you can retrieve the full generation information via the /api/v1/generation endpoint."**
>
> "You can use the returned `id` to query for the generation stats (including token counts and cost)."

## What We Need to Find Out

### Question 1: Where is the generation ID?

**Option A: In response headers** (what I assumed)
```typescript
response.headers.get("x-generation-id")
```

**Option B: In the response body/stream** (more likely!)
```json
{
  "id": "gen-xxxxx",  // ← This is probably it!
  "choices": [...]
}
```

### Question 2: What does the Generation API actually return?

```bash
GET /api/v1/generation?id=gen-xxxxx
```

Returns:
```json
{
  "data": {
    "id": "gen-xxxxx",
    "usage": {
      "prompt_tokens": 10431,      // Native tokens
      "completion_tokens": 3782,   // Native tokens  
      "total_tokens": 14213
    },
    "total_cost": 0.0102,          // Actual cost!
    // ... other fields
  }
}
```

## Simplest Approach

1. **Extract `id` from first streaming chunk**
2. **After streaming completes, call Generation API**
3. **Use actual tokens and cost from Generation API**
4. **Done!**

## Current Code Status

**I've already added this logic:**
```typescript
// In streamingService.ts
return {
    content,
    done: isDone,
    tokenUsage: usage,
    generationId: json.id || undefined,  // ✅ Capture ID
};

// In aiService.ts
if (provider === "openrouter" && chunk.generationId) {
    generationId = chunk.generationId;  // ✅ Store ID
}

// After streaming
if (provider === "openrouter" && generationId) {
    const usageData = await fetchOpenRouterUsage(generationId);  // ✅ Fetch actual
    actualCostFromAPI = usageData.actualCost;  // ✅ Use actual cost
}
```

**BUT IT HASN'T BEEN TESTED!**

## What You Need to Do

### Step 1: Build
```bash
npm run build
```

### Step 2: Reload Obsidian

### Step 3: Run Query
"如何开发 Task Chat"

### Step 4: Check Logs

**If it works, you'll see:**
```
[OpenRouter] ✓ Generation ID from stream: gen-xxxxx
[OpenRouter] Fetching actual token usage...
[OpenRouter] Raw generation data: {...}
[OpenRouter] ✓ Got actual usage: 10431 prompt + 3782 completion
[OpenRouter] ✓ Got actual cost from API: $0.010200
[Cost] Using actual cost from openrouter API: $0.010200
```

**If it doesn't work, you'll see debug info showing what's missing**

## Alternative: Check What Copilot Does

Unfortunately I can't access the Copilot directory from this workspace. But based on OpenRouter's docs, the approach is clear:

1. Get generation ID from response
2. Query Generation API
3. Use actual tokens/cost

This is the only way to get accurate costs from OpenRouter!

## Bottom Line

**The fix is already in the code** - it just needs to be:
1. Built
2. Tested
3. Debugged if needed

The approach is correct per OpenRouter's documentation. The question is just: does the `json.id` contain the generation ID we need?

Let's find out!
