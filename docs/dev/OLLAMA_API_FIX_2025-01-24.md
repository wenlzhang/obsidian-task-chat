# Ollama API Implementation Fix - 2025-01-24

## Problem Statement

The same model works when called via OpenRouter but fails when called via Ollama local API. This indicates an API format mismatch between our implementation and Ollama's actual requirements.

## Root Cause Analysis

### 1. API Format Differences

**OpenRouter/OpenAI API Format:**
```json
{
  "model": "model-name",
  "messages": [...],
  "temperature": 0.7,          // Top-level
  "max_tokens": 2000           // Top-level, OpenAI parameter name
}
```

**Response:**
```json
{
  "choices": [
    { "message": { "content": "..." }}
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200
  }
}
```

**Ollama API Format (Correct):**
```json
{
  "model": "model-name",
  "messages": [...],
  "stream": false,
  "options": {                 // Parameters inside 'options' object
    "temperature": 0.7,
    "num_predict": 8000,       // Ollama uses 'num_predict', not 'max_tokens'
    "num_ctx": 32000           // Context window size (optional but important)
  }
}
```

**Response:**
```json
{
  "message": {                 // Direct 'message' field (not 'choices')
    "role": "assistant",
    "content": "..."
  },
  "done": true,
  "total_duration": 4883583458,
  "load_duration": 1334875,
  "prompt_eval_count": 26,
  "prompt_eval_duration": 342546000,
  "eval_count": 282,
  "eval_duration": 4535599000
}
```

### 2. Two Different Ollama Implementations in Codebase

**aiService.ts** (Task Chat mode):
```typescript
body: JSON.stringify({
    model: providerConfig.model,
    messages: messages,
    stream: false,
    options: {
        temperature: providerConfig.temperature,
        num_predict: 8000,
        // ❌ MISSING: num_ctx for context window
    },
}),
```

**aiQueryParserService.ts** (Query parsing):
```typescript
const requestBody: any = {
    model: providerConfig.model,
    messages: strategy.messages,
    stream: false,
    options: {
        temperature: 0.1,
        num_predict: 16000,      // ✅ Higher for complex parsing
        num_ctx: 32000,          // ✅ Explicit context window
    },
};
```

### 3. Key Issues Identified

1. **Missing `num_ctx` in aiService.ts**: The context window parameter is missing, which can cause truncation issues with large prompts
2. **Low `num_predict` value**: 8000 tokens may be insufficient for comprehensive task recommendations
3. **No error handling for model-specific issues**: Some models may require different parameters
4. **Inconsistent implementations**: Two different Ollama handlers with different parameter sets

## Official Ollama API Documentation

From https://github.com/ollama/ollama/blob/main/docs/api.md:

**Endpoint:** `POST /api/chat`

**Parameters:**
- `model`: (required) the model name
- `messages`: the messages of the chat
- `stream`: if false, returns single response object
- `options`: additional model parameters including:
  - `temperature`: sampling temperature (0.0-2.0)
  - `num_predict`: maximum number of tokens to predict (default: 128, -1 = infinite, -2 = fill context)
  - `num_ctx`: size of context window (default: 2048)
  - `top_k`, `top_p`, `repeat_penalty`, etc.

## Solution

### Unified Ollama Implementation

Create a single, robust Ollama handler with:

1. **Proper parameter formatting** using `options` object
2. **Adequate token limits**: `num_predict` and `num_ctx` based on task requirements
3. **Better error handling** with specific Ollama error messages
4. **Cleaner code** without overly complex debugging (move to production-ready state)
5. **Consistent behavior** across all usage contexts

### Recommended Parameters

For **Task Chat** (aiService.ts):
```typescript
options: {
    temperature: providerConfig.temperature,
    num_predict: 16000,    // Higher for comprehensive responses
    num_ctx: 32000,        // Large context for task lists
}
```

For **Query Parsing** (aiQueryParserService.ts):
```typescript
options: {
    temperature: 0.1,      // Low for deterministic parsing
    num_predict: 16000,    // Sufficient for JSON with 60 keywords
    num_ctx: 32000,        // Handle large system prompts
}
```

## Implementation Plan

1. **Consolidate** Ollama handling logic
2. **Remove** excessive debug logging (move to production state)
3. **Unify** parameter handling across both services
4. **Add** proper error messages specific to Ollama issues
5. **Test** with various models and prompt sizes

## References

- Ollama API Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
- Ollama Modelfile Parameters: https://github.com/ollama/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
- Obsidian Copilot (reference): https://github.com/logancyang/obsidian-copilot

## Status

🔄 **In Progress** - Implementing unified Ollama handler with correct API format
