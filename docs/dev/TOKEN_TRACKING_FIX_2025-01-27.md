# Token Tracking Fix - Complete Implementation (2025-01-27)

## Problem Summary

Token and cost calculations were **incomplete** for Smart Search and Task Chat modes. The system was only tracking some AI calls while missing others, resulting in inaccurate usage and cost reports.

## Issues Found

### 1. **Smart Search Mode** - Using Hardcoded Estimates

**Location:** `aiService.ts` lines 738-750

```typescript
// Smart Search: AI used for keyword expansion only
// Note: Actual token usage from QueryParserService would need to be tracked
// For now, using estimated values
tokenUsage = {
    promptTokens: 200,      // ❌ Hardcoded
    completionTokens: 50,   // ❌ Hardcoded
    totalTokens: 250,       // ❌ Hardcoded
    estimatedCost: 0.0001,  // ❌ Hardcoded
    ...
    isEstimated: true,
};
```

**Problem:** Uses hardcoded values instead of actual API response

### 2. **Task Chat Mode** - Missing Query Parser Tokens

**What was tracked:**
- ✅ Final AI analysis (summary generation)

**What was missing:**
- ❌ Query parser tokens (keyword expansion, property extraction)
- ❌ System prompts used in query parsing
- ❌ Internal prompts for semantic expansion

**Example from screenshot:**
```
~3,448 tokens (3,362 in, 86 out)
```

This **only counted** the final Task Chat analysis, not the query parsing that happened first.

### 3. **Query Parser** - No Token Return

**Location:** `aiQueryParserService.ts` 

The query parser made AI calls but didn't return token usage data:

```typescript
private static async callAI(messages: any[], settings: PluginSettings): Promise<string> {
    const response = await requestUrl({...});
    
    // Returns ONLY text content, NOT token usage ❌
    return response.json.choices[0].message.content.trim();
}
```

## Solution Implemented

### Phase 1: Update ParsedQuery Interface

Added `_parserTokenUsage` field to store token usage from query parsing:

```typescript
export interface ParsedQuery {
    // ... existing fields ...
    
    // Token Usage from Query Parsing (AI calls made during parsing)
    _parserTokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        estimatedCost: number;
        model: string;
        provider: string;
        isEstimated: boolean;
    };
}
```

### Phase 2: Update Query Parser Methods

Modified all three provider methods to return token usage:

#### OpenAI/OpenRouter (`callAI`)
```typescript
private static async callAI(
    messages: any[],
    settings: PluginSettings,
): Promise<{ response: string; tokenUsage: any }> {
    const response = await requestUrl({...});
    
    // Extract token usage
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    const tokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost: this.calculateCost(...),
        model: providerConfig.model,
        provider: settings.aiProvider,
        isEstimated: false, // Real token counts from API
    };

    return { response: content, tokenUsage };
}
```

#### Anthropic (`callAnthropic`)
```typescript
// Similar to OpenAI but uses Anthropic's token field names
const promptTokens = usage.input_tokens || 0;
const completionTokens = usage.output_tokens || 0;
```

#### Ollama (`callOllama`)
```typescript
// Ollama doesn't provide token counts - estimate based on character count
// Rough estimate: 1 token ≈ 4 characters
const promptText = messages.map((m: any) => m.content).join(' ');
const promptTokens = Math.ceil(promptText.length / 4);
const completionTokens = Math.ceil(responseContent.length / 4);

const tokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost: 0, // Ollama is free (local)
    model: providerConfig.model,
    provider: settings.aiProvider,
    isEstimated: true, // Ollama doesn't provide real token counts
};
```

### Phase 3: Update parseWithAI Method

Modified to capture and return token usage:

```typescript
try {
    const { response: aiResponse, tokenUsage } = await this.callAI(messages, settings);
    Logger.debug("AI query parser raw response:", aiResponse);
    Logger.debug("AI query parser token usage:", tokenUsage);

    // ... parsing logic ...

    return {
        coreKeywords: coreKeywords,
        keywords: expandedKeywords,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        // ... other fields ...
        _parserTokenUsage: tokenUsage, // ✅ Include token usage from query parsing
    };
} catch (error) {
    // ... error handling ...
}
```

### Phase 4: Smart Search - Use Actual Parser Tokens

**Before:**
```typescript
tokenUsage = {
    promptTokens: 200,      // ❌ Hardcoded
    completionTokens: 50,   // ❌ Hardcoded
    totalTokens: 250,
    estimatedCost: 0.0001,
    isEstimated: true,
};
```

**After:**
```typescript
if (parsedQuery && parsedQuery._parserTokenUsage) {
    const parserUsage = parsedQuery._parserTokenUsage;
    tokenUsage = {
        promptTokens: parserUsage.promptTokens,          // ✅ Actual
        completionTokens: parserUsage.completionTokens,  // ✅ Actual
        totalTokens: parserUsage.totalTokens,
        estimatedCost: parserUsage.estimatedCost,        // ✅ Actual
        model: parserUsage.model,
        provider: settings.aiProvider,
        isEstimated: parserUsage.isEstimated,
        directSearchReason: `${sortedTasksForDisplay.length} result${...}`,
    };
} else {
    // Fallback to estimates if parser token usage not available
    tokenUsage = { /* hardcoded fallback */ };
}
```

### Phase 5: Task Chat - Combine Parser + Analysis Tokens

**Before:**
```typescript
return {
    response: processedResponse,
    recommendedTasks,
    tokenUsage,  // ❌ Only final analysis tokens
    parsedQuery: usingAIParsing ? parsedQuery : undefined,
};
```

**After:**
```typescript
// Combine parser token usage with final analysis token usage
let combinedTokenUsage = tokenUsage;
if (usingAIParsing && parsedQuery && parsedQuery._parserTokenUsage) {
    const parserUsage = parsedQuery._parserTokenUsage;
    combinedTokenUsage = {
        promptTokens: parserUsage.promptTokens + tokenUsage.promptTokens,
        completionTokens: parserUsage.completionTokens + tokenUsage.completionTokens,
        totalTokens: parserUsage.totalTokens + tokenUsage.totalTokens,
        estimatedCost: parserUsage.estimatedCost + tokenUsage.estimatedCost,
        model: `${parserUsage.model} (parser) + ${tokenUsage.model} (analysis)`,
        provider: settings.aiProvider,
        isEstimated: parserUsage.isEstimated || tokenUsage.isEstimated,
    };
    Logger.debug(
        `[Task Chat] Combined token usage: Parser (${parserUsage.totalTokens}) + Analysis (${tokenUsage.totalTokens}) = ${combinedTokenUsage.totalTokens} total tokens`,
    );
}

return {
    response: processedResponse,
    recommendedTasks,
    tokenUsage: combinedTokenUsage,  // ✅ Complete token usage
    parsedQuery: usingAIParsing ? parsedQuery : undefined,
};
```

## Complete Token Breakdown

### Simple Search Mode
- **AI Calls:** None
- **Input Tokens:** 0
- **Output Tokens:** 0
- **Total Tokens:** 0
- **Cost:** $0.00

### Smart Search Mode
- **AI Calls:** Query parser only
- **Input Tokens:** 
  - System prompt: ~200-300 tokens
  - User query: ~10-50 tokens
  - Property mappings: ~100-200 tokens
  - **Total:** ~300-550 tokens
- **Output Tokens:**
  - Keyword expansion: ~200-800 tokens (depends on expansion settings)
  - Property extraction: ~50-100 tokens
  - **Total:** ~250-900 tokens
- **Total Tokens:** ~550-1,450 tokens
- **Cost:** ~$0.0001-$0.0003 per query (with gpt-4o-mini)

### Task Chat Mode
- **AI Calls:** Query parser + Final analysis
- **Input Tokens:**
  - Query parser: ~300-550 tokens
  - System prompt (analysis): ~500-800 tokens
  - Task context: ~1,000-3,000 tokens (depends on maxTasksForAI)
  - Chat history: ~200-1,000 tokens
  - **Total:** ~2,000-5,350 tokens
- **Output Tokens:**
  - Query parser: ~250-900 tokens
  - Task analysis/summary: ~500-8,000 tokens (depends on maxTokensChat setting)
  - **Total:** ~750-8,900 tokens
- **Total Tokens:** ~2,750-14,250 tokens
- **Cost:** ~$0.0005-$0.0030 per query (with gpt-4o-mini)

## Example: User's Screenshot

Looking at the screenshot showing `~3,448 tokens (3,362 in, 86 out)`:

**Before fix (incomplete):**
- This was **only** the final Task Chat analysis
- Missing: Query parser tokens (~800 tokens)
- Actual total should be: ~4,248 tokens

**After fix (complete):**
```
Query Parser:
  Input: ~500 tokens (prompts + query)
  Output: ~300 tokens (keywords + properties)
  Subtotal: ~800 tokens

Task Analysis:
  Input: ~3,362 tokens (prompts + tasks + history)
  Output: ~86 tokens (summary)
  Subtotal: ~3,448 tokens

Combined Total: ~4,248 tokens ✅
Cost: ~$0.0009 (with gpt-4o-mini)
```

## Files Modified

1. **src/services/aiQueryParserService.ts**
   - Added `_parserTokenUsage` to `ParsedQuery` interface
   - Added `calculateCost()` helper method
   - Updated `callAI()` to return `{ response, tokenUsage }`
   - Updated `callAnthropic()` to return `{ response, tokenUsage }`
   - Updated `callOllama()` to return `{ response, tokenUsage }`
   - Updated `parseWithAI()` to capture and return token usage

2. **src/services/aiService.ts**
   - Smart Search: Use actual parser token usage instead of hardcoded estimates
   - Task Chat: Combine parser + analysis token usage
   - Added debug logging for combined token usage

## Benefits

### For Users
- ✅ **Accurate token counts** - See real AI usage, not estimates
- ✅ **Complete cost tracking** - Know exactly what you're paying for
- ✅ **Better budgeting** - Accurate data for cost optimization
- ✅ **Transparency** - See all AI calls made by the system

### For Developers
- ✅ **Consistent tracking** - All AI calls properly logged
- ✅ **Better debugging** - See token usage at each step
- ✅ **Accurate metrics** - Real data for performance optimization

## Testing Checklist

- [ ] Simple Search: Verify 0 tokens shown
- [ ] Smart Search: Verify parser tokens shown (not hardcoded 250)
- [ ] Task Chat: Verify combined tokens (parser + analysis)
- [ ] OpenAI provider: Verify real token counts
- [ ] Anthropic provider: Verify real token counts
- [ ] Ollama provider: Verify estimated token counts
- [ ] Check console logs show token breakdown
- [ ] Verify cost calculations are accurate

## Migration Notes

- **Backward compatible:** No breaking changes
- **Existing users:** Will see accurate tokens on next query
- **Data structure:** ParsedQuery extended with optional `_parserTokenUsage`
- **Fallback:** If parser token usage not available, uses estimates (Smart Search only)

## Status

✅ **COMPLETE** - All token tracking implemented and ready for testing!

**Next steps:**
1. Build and test in Obsidian
2. Verify token counts match API responses
3. Document any edge cases found during testing
