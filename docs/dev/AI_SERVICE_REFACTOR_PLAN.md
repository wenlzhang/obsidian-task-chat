# AI Service Refactor Plan for Three-Mode System

## Current Implementation Issues

The current `aiService.ts` uses `settings.useAIQueryParsing` to decide behavior, but this doesn't match the new three-mode system.

## New Logic Required

### Mode 1: Simple Search (searchMode === "simple")
```
Query Parsing: Regex-based (TaskSearchService.analyzeQueryIntent)
Keyword Expansion: None
Result Handling: Direct results only (no AI analysis)
Token Usage: {model: "none", totalTokens: 0}
Message Role: "simple"
```

### Mode 2: Smart Search (searchMode === "smart")  
```
Query Parsing: AI-powered (QueryParserService.parseQuery)
Keyword Expansion: Yes (multilingual synonyms)
Result Handling: Direct results only (no AI analysis)
Token Usage: {model: "gpt-4o-mini", totalTokens: ~234, ...}
Message Role: "smart"
```

### Mode 3: Task Chat (searchMode === "chat")
```
Query Parsing: AI-powered (QueryParserService.parseQuery)
Keyword Expansion: Yes (multilingual synonyms)
Result Handling: AI analysis and recommendations
Token Usage: {model: "gpt-4o-mini", totalTokens: ~1234, ...}
Message Role: "chat"
```

## Code Changes Needed

### 1. Update sendMessage function signature (NO CHANGE)
Still accepts settings, but will use `settings.searchMode` instead of `useAIQueryParsing`

### 2. Query Parsing Logic
```typescript
// OLD:
if (settings.useAIQueryParsing) {
    // AI parsing
} else {
    // Regex parsing
}

// NEW:
const searchMode = settings.searchMode;

if (searchMode === "simple") {
    // Regex parsing only
    intent = TaskSearchService.analyzeQueryIntent(message);
    usingAIParsing = false;
} else { // smart or chat
    // AI parsing for both
    try {
        parsedQuery = await QueryParserService.parseQuery(message, settings);
        usingAIParsing = true;
        // Convert to intent format
    } catch (error) {
        // Fallback to regex
        intent = TaskSearchService.analyzeQueryIntent(message);
        usingAIParsing = false;
    }
}
```

### 3. Result Handling Logic
```typescript
// After filtering and sorting tasks...

// OLD: Complex decision tree with multiple conditions
if (forceDirectResults || isSimpleQuery && results <= maxDirectResults) {
    // Direct results
} else {
    // AI analysis
}

// NEW: Clear three-mode decision
if (searchMode === "simple" || searchMode === "smart") {
    // Direct results for both Simple and Smart modes
    return {
        response: "",
        directResults: sortedTasks,
        tokenUsage: {
            model: usingAIParsing ? settings.model : "none",
            totalTokens: usingAIParsing ? parsingTokens : 0,
            // ...
        }
    };
} else { // searchMode === "chat"
    // AI analysis
    return await this.getAITaskAnalysis(...);
}
```

### 4. Token Usage Updates
```typescript
// Simple Search
{
    model: "none",
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    estimatedCost: 0,
    provider: settings.aiProvider,
    isEstimated: false
}

// Smart Search
{
    model: settings.model,
    totalTokens: parsingResult.totalTokens,
    promptTokens: parsingResult.promptTokens,
    completionTokens: parsingResult.completionTokens,
    estimatedCost: parsingCost,
    provider: settings.aiProvider,
    isEstimated: false
}

// Task Chat
{
    model: settings.model,
    totalTokens: parsingTokens + analysisTokens,
    promptTokens: parsingPromptTokens + analysisPromptTokens,
    completionTokens: parsingCompletionTokens + analysisCompletionTokens,
    estimatedCost: parsingCost + analysisCost,
    provider: settings.aiProvider,
    isEstimated: false
}
```

### 5. Message Role Assignment
```typescript
// In chatView.ts, when creating system message:
const systemMessage: ChatMessage = {
    role: searchMode, // "simple", "smart", or "chat"
    content: result.response || messageContent,
    timestamp: Date.now(),
    tokenUsage: result.tokenUsage,
    // ...
};
```

## Implementation Steps

1. ✅ Update settings interface
2. ✅ Update UI (SettingsTab, ChatView)
3. ⏳ Update aiService.ts:
   - Replace useAIQueryParsing checks with searchMode checks
   - Simplify decision tree (no more auto-detection)
   - Update token usage tracking
4. ⏳ Update chatView.ts:
   - Update message role assignment based on searchMode
   - Update role name display (Simple Search, Smart Search, Task Chat)
5. ⏳ Update token display to show mode name

## Benefits

1. **Predictable**: Each mode always behaves the same way
2. **Simple**: No complex decision logic
3. **Clear**: Users know exactly what they're getting
4. **Maintainable**: Three clear code paths instead of nested conditions

## Testing Checklist

- [ ] Simple Search: No AI calls, $0 cost
- [ ] Smart Search: AI parsing only, ~$0.0001 cost
- [ ] Task Chat: AI parsing + analysis, ~$0.0021 cost
- [ ] Mode names display correctly in messages
- [ ] Token usage shows correct mode and costs
- [ ] Migration from useAIQueryParsing works correctly
