# OpenRouter Generation ID Fix - 2025-01-29

## Problem

OpenRouter pricing was still inaccurate because the **generation ID was not being extracted**, causing the system to use estimated tokens instead of fetching actual usage from OpenRouter's Generation API.

### Evidence from Logs

**What we expected to see:**
```
[OpenRouter] Generation ID: gen_xxxxx
[OpenRouter] Fetching actual token usage...
[OpenRouter] ✓ Got actual usage: 10431 prompt + 3782 completion
[OpenRouter] ✓ Using actual cost from API: $0.010200
```

**What actually happened:**
```
[Token Usage] ⚠️ API did not provide token counts - using estimation
[Token Usage] Estimated: 7676 prompt + 246 completion
[Cost] Calculated cost: $0.002411
```

**OpenRouter Dashboard shows:**
- Actual: 10,431 in + 3,782 out = $0.0102
- Plugin: 7,676 in + 246 out = $0.0024 ❌ (76% underreporting!)

## Root Cause

The generation ID extraction code was present but **returning null**:

```typescript
generationId = response.headers.get("x-generation-id");
```

This could be because:
1. Obsidian's `requestUrl` might not expose all response headers
2. Header name might be case-sensitive or different format
3. OpenRouter might send generation ID in stream chunks, not headers

## Solution

Implemented **dual extraction** with enhanced debugging:

### 1. Try Response Headers First

```typescript
if (provider === "openrouter") {
    // Debug: Log response headers
    Logger.debug(
        `[OpenRouter] Response headers: ${JSON.stringify(response.headers)}`,
    );
    
    // Try different header formats
    generationId = 
        response.headers.get("x-generation-id") ||
        response.headers.get("X-Generation-Id") ||
        (response.headers as any)["x-generation-id"] ||
        null;
        
    if (generationId) {
        Logger.debug(`[OpenRouter] ✓ Generation ID: ${generationId}`);
    } else {
        Logger.warn(
            `[OpenRouter] ⚠️ Generation ID not found in response headers`,
        );
    }
}
```

### 2. Fallback to Stream Chunks

Updated `StreamChunk` interface to include generation ID:

```typescript
export interface StreamChunk {
    content: string;
    done: boolean;
    tokenUsage?: {...};
    generationId?: string; // For OpenRouter
}
```

Capture from stream:

```typescript
return {
    content,
    done: isDone,
    tokenUsage: usage,
    generationId: json.id || undefined, // Capture for OpenRouter
};
```

Use in aiService:

```typescript
// Capture generation ID from stream (fallback if not in headers)
if (provider === "openrouter" && chunk.generationId && !generationId) {
    generationId = chunk.generationId;
    Logger.debug(
        `[OpenRouter] ✓ Generation ID from stream: ${generationId}`,
    );
}
```

### 3. Enhanced Debugging

```typescript
// Debug: Log chunk ID
if (json.id && !content) {
    Logger.debug(
        `[Streaming] Chunk ID from response: ${json.id}`,
    );
}
```

## Files Modified

1. **src/services/aiService.ts**
   - Added debug logging for response headers
   - Try multiple header formats for generation ID
   - Capture generation ID from stream chunks as fallback

2. **src/services/streamingService.ts**
   - Added `generationId` to `StreamChunk` interface
   - Capture generation ID from `json.id` in chunks
   - Added debug logging for chunk IDs

## Testing Instructions

### 1. Build the Plugin

```bash
cd /Users/williamz/Documents/GitHub/3-development/obsidian-task-chat
npm run build
```

### 2. Reload Obsidian

Completely restart Obsidian or reload the plugin.

### 3. Test a Query

Run the same query: "如何开发 Task Chat"

### 4. Check Console Logs

You should now see **detailed debugging**:

**If generation ID is in headers:**
```
[OpenRouter] Response headers: {...}
[OpenRouter] ✓ Generation ID: gen_xxxxx
[OpenRouter] Fetching actual token usage...
[OpenRouter] ✓ Got actual usage: 10431 prompt + 3782 completion
[OpenRouter] ✓ Using actual cost from API: $0.010200
```

**If generation ID is in stream:**
```
[OpenRouter] Response headers: {...}
[OpenRouter] ⚠️ Generation ID not found in response headers
[Streaming] Chunk ID from response: gen_xxxxx
[OpenRouter] ✓ Generation ID from stream: gen_xxxxx
[OpenRouter] Fetching actual token usage...
```

**If neither works (need to investigate further):**
```
[OpenRouter] Response headers: {...}
[OpenRouter] ⚠️ Generation ID not found in response headers
[Streaming] Chunk ID from response: chatcmpl-xxxxx (or nothing)
[Token Usage] ⚠️ API did not provide token counts - using estimation
```

### 5. Compare with Dashboard

Check that:
- Token counts match OpenRouter dashboard exactly
- Cost matches OpenRouter dashboard exactly
- Logs show actual usage, not estimation

## Expected Results

### Before Fix:
```
Parser: 17,187 in + 244 out = $0.00272 ✅
Analysis: 7,676 in + 246 out = $0.00241 ❌ (estimated)
Total: $0.00513 ❌
```

### After Fix:
```
Parser: 17,187 in + 244 out = $0.00272 ✅
Analysis: 10,431 in + 3,782 out = $0.01020 ✅ (actual)
Total: $0.01292 ✅
```

## Next Steps

1. **Test and verify** - Run query and check logs
2. **If generation ID found** - Confirm costs match dashboard
3. **If still not found** - Share debug logs showing:
   - `[OpenRouter] Response headers: {...}`
   - `[Streaming] Chunk ID from response: ...`
   - We'll investigate further based on what's actually returned

## Why This Matters

Without the generation ID:
- ❌ Can't get actual token counts from OpenRouter
- ❌ Must use estimation (often 20-50% off)
- ❌ Can't get actual cost charged
- ❌ Pricing calculations unreliable

With the generation ID:
- ✅ Get exact token counts from OpenRouter
- ✅ Get actual cost charged
- ✅ 100% accurate pricing
- ✅ Matches dashboard perfectly

This is the **critical missing piece** for accurate OpenRouter cost tracking!
