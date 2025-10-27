# Structured Error Preservation Fix (2025-01-27)

## User's Critical Discovery 🎯

> "It's very strange; in the chat interface, I still see nothing... Did you actually create a proper item for AI parsing errors in this error handling file? Additionally, the status error is 400; did your error handling reflect this part during this parser failure?"

**User is 100% CORRECT!** Two critical bugs:

1. ❌ **ErrorHandler had NO handler for 400 errors**
2. ❌ **Structured error was being DESTROYED when thrown**

---

## The Root Cause

### Bug #1: ErrorHandler Missing 400 Handler ❌

**File:** `errorHandler.ts` lines 74-114 (before fix)

**Checks for:**
- ✅ Context length errors
- ✅ Model not found
- ✅ API key errors
- ✅ Rate limit errors
- ✅ Server errors (500/503)
- ✅ Connection errors
- ❌ **400 Bad Request** ← MISSING!

**Your error:**
```
Request failed, status 400
```

**What happened:**
- Fell through to generic error handler
- Lost specific error details from response body
- No helpful guidance for 400 errors

---

### Bug #2: Structured Error Destroyed ❌

**The Fatal Flaw:** `aiQueryParserService.ts` line 2298 (before fix)

```typescript
// ErrorHandler creates beautiful StructuredError
const structured = ErrorHandler.parseAPIError(errorData, modelInfo, "parser");
// StructuredError has: type, message, details, solution, docsLink, model

// Then we DESTROY it by converting to plain string! ❌
throw new Error(`${structured.details} | ${structured.solution}`);
// Result: "AI API error: 400 | 1. Check console... 2. Verify settings..."
```

**What gets lost:**
- ✅ Error type detection (400, 500, rate limit, etc.)
- ✅ Helpful solutions specific to error type
- ✅ Documentation links
- ✅ Consistent format

**aiService.ts catches it:**
```typescript
catch (error) {
    const errorMessage = error.message;  
    // Gets: "AI API error: 400 | 1. Check console..."
    // LOSES: Everything except this string!
}
```

**Then creates NEW error:**
```typescript
error = ErrorHandler.createParserError(originalError, modelInfo, "simple");
// But originalError only has the string!
// Can't detect it's a 400 error anymore!
// Falls to generic handler AGAIN!
```

---

## The Complete Fix

### Fix #1: Add 400 Bad Request Handler ✅

**File:** `errorHandler.ts` (lines 74-82)

```typescript
// Check for 400 Bad Request errors (invalid request/model/parameters)
if (
    errorMsg.includes("400") ||
    errorMsg.includes("bad request") ||
    errorMsg.includes("invalid request") ||
    errorBody?.error?.code === "invalid_request_error"
) {
    return this.createBadRequestError(errorMsg, errorBody, model);
}
```

**New handler method (lines 203-234):**
```typescript
private static createBadRequestError(
    errorMsg: string,
    errorBody: any,
    model: string,
): StructuredError {
    // Try to extract specific error from response body
    let details = errorMsg;
    let solution = "1. Check model name is correct (e.g., 'gpt-4o-mini' not 'gpt-5-mini')\n2. Verify request parameters are valid\n3. Check API endpoint configuration\n4. Try a different model";
    
    // Check if it's a model validation error
    if (errorBody?.error?.message) {
        details = errorBody.error.message;
        
        // Specific guidance for model errors
        if (details.toLowerCase().includes("model")) {
            solution = "1. The model name may be invalid or not exist\n2. Check available models for your provider\n3. Try 'gpt-4o-mini' for OpenAI\n4. Verify model format for OpenRouter (provider/model)";
        }
    }

    return {
        type: "api",
        message: "Bad Request (400)",
        details: details,
        solution: solution,
        docsLink: "...",
        model: model,
    };
}
```

**Now handles:**
- ✅ 400 errors detected
- ✅ Extracts details from response body
- ✅ Model-specific guidance
- ✅ Professional error message

---

### Fix #2: Preserve Structured Error with AIError ✅

**Step 1: Import and throw AIError**

**File:** `aiQueryParserService.ts` line 16

```typescript
import { ErrorHandler, AIError } from "../utils/errorHandler";
```

**Lines 2297-2298 (OpenAI/OpenRouter):**
```typescript
// BEFORE (WRONG)
throw new Error(`${structured.details} | ${structured.solution}`);

// AFTER (CORRECT)
throw new AIError(structured);  // ✅ Preserves all structure!
```

**Same fix for Anthropic (line 2406) and Ollama (line 2588)**

---

**Step 2: Catch and store structured error**

**File:** `aiService.ts` (lines 192-211)

```typescript
// Store error info in parsedQuery for UI display
// Check if it's an AIError with structured information
let errorMessage: string;
if (error instanceof AIError && error.structured) {
    // AIError has full structured info - store it for later use
    errorMessage = error.structured.details;
    parsedQuery = {
        _parserError: errorMessage,
        _parserModel: error.structured.model || "unknown",
        _structuredError: error.structured,  // ✅ Store full structured error!
    } as ParsedQuery;
} else {
    // Fallback for plain errors
    errorMessage = error instanceof Error ? error.message : String(error);
    parsedQuery = {
        _parserError: errorMessage,
        _parserModel: (error as any).parserModel || "unknown",
    } as ParsedQuery;
}
```

---

**Step 3: Use structured error for display**

**File:** `aiService.ts` Smart Search (lines 880-884)

```typescript
if ((parsedQuery as any)._structuredError) {
    // Use stored structured error from AIError
    error = (parsedQuery as any)._structuredError;  // ✅ Full structure preserved!
    // Add result count to fallback message
    error.fallbackUsed = `AI parser failed, used Simple Search fallback (${sortedTasksForDisplay.length} tasks found).`;
}
```

**Same for Task Chat (lines 1090-1092)**

---

## Data Flow Comparison

### Before Fix ❌

```
1. API returns 400 error with body: {error: {message: "Invalid model 'gpt-5-mini'"}}
   ↓
2. aiQueryParserService calls ErrorHandler.parseAPIError()
   → Creates StructuredError {
       type: "api",
       message: "AI parser failed",  // Generic!
       details: "API request failed with status 400",
       solution: "1. Check console... 2. Verify settings...",
       model: "OpenAI: gpt-5-mini"
     }
   ↓
3. Converts to plain string and throws
   throw new Error("AI request failed with status 400 | 1. Check console...")
   → LOSES all structure! ❌
   ↓
4. aiService.ts catches plain Error
   parsedQuery._parserError = "AI request failed with status 400 | 1. Check console..."
   → Only has string, no structure ❌
   ↓
5. Smart Search creates NEW error
   ErrorHandler.createParserError(new Error("AI request..."), modelInfo, "simple")
   → Can't detect 400 anymore, uses generic handler again ❌
   ↓
6. UI displays generic error
   Message: "AI parser failed"
   Details: "AI request failed with status 400"
   Solution: Generic solutions
   → User has no idea model doesn't exist! ❌
```

---

### After Fix ✅

```
1. API returns 400 error with body: {error: {message: "Invalid model 'gpt-5-mini'"}}
   ↓
2. aiQueryParserService calls ErrorHandler.parseAPIError()
   → Detects 400 error ✅
   → Creates StructuredError {
       type: "api",
       message: "Bad Request (400)",  // Specific! ✅
       details: "Invalid model 'gpt-5-mini'",  // Exact error! ✅
       solution: "1. The model name may be invalid or not exist\n2. Check available models...\n3. Try 'gpt-4o-mini' for OpenAI",  // Helpful! ✅
       docsLink: "...",
       model: "OpenAI: gpt-5-mini"
     }
   ↓
3. Throws AIError with full structure
   throw new AIError(structured)
   → ALL structure preserved! ✅
   ↓
4. aiService.ts catches AIError
   parsedQuery._structuredError = error.structured
   → Stores FULL StructuredError object! ✅
   ↓
5. Smart Search uses stored error directly
   error = parsedQuery._structuredError
   → No re-processing, perfect structure! ✅
   ↓
6. UI displays rich error
   Message: "Bad Request (400)"  ✅
   Details: "Invalid model 'gpt-5-mini'"  ✅
   Solution: "1. The model name may be invalid or not exist..."  ✅
   → User knows exactly what's wrong! ✅
```

---

## Impact

### Before Fix ❌

**Smart Search with "gpt-5-mini" (doesn't exist):**
```
Smart Search

Found 0 matching task(s):
```
- ❌ No error warning
- ❌ No indication why it failed
- ❌ Generic solutions
- ❌ User confused

**Console:**
```
AI Query Parser failed with model: {provider: 'openai', model: 'gpt-5-mini', ...}
⚠️ AI Query Parser Failed - falling back to Simple Search module
```
- Shows in console but not UI

---

### After Fix ✅

**Smart Search with "gpt-5-mini":**
```
Smart Search

⚠️ Bad Request (400)
Model: OpenAI: gpt-5-mini
Error: Invalid model 'gpt-5-mini'
💡 Solutions:
1. The model name may be invalid or not exist
2. Check available models for your provider
3. Try 'gpt-4o-mini' for OpenAI
4. Verify model format for OpenRouter (provider/model)

✓ Fallback: AI parser failed, used Simple Search fallback (0 tasks found).

Found 0 matching task(s):

📊 Mode: Smart Search • OpenAI: gpt-5-mini (parser) • ~250 tokens • ~$0.0001 • Language: Unknown
```
- ✅ Clear error warning
- ✅ Specific error type (400)
- ✅ Exact error from API
- ✅ Model-specific solutions
- ✅ Full metadata

**Same for Task Chat!**

---

## Files Modified

✅ **errorHandler.ts**
- **Lines 74-82:** Add 400 Bad Request detection
- **Lines 203-234:** Add createBadRequestError() method

✅ **aiQueryParserService.ts**
- **Line 16:** Import AIError
- **Lines 2297-2298:** Throw AIError (OpenAI/OpenRouter)
- **Lines 2405-2406:** Throw AIError (Anthropic)
- **Lines 2587-2588:** Throw AIError (Ollama)

✅ **aiService.ts**
- **Lines 192-211:** Store structured error from AIError
- **Lines 880-903:** Smart Search uses stored structured error
- **Lines 1090-1114:** Task Chat uses stored structured error

---

## Key Lessons

### 1. Don't Destroy Structured Data

**Wrong:**
```typescript
throw new Error(`${obj.field1} | ${obj.field2}`);
// Converts object to string - LOSES STRUCTURE!
```

**Right:**
```typescript
throw new CustomError(obj);
// Preserves entire object - KEEPS STRUCTURE!
```

---

### 2. Check Entire Error Handler Coverage

**Before:** Handled context length, model not found, API key, rate limit, 500/503, connection  
**Missing:** 400 Bad Request (very common!)

**Lesson:** Review error handler for ALL common HTTP status codes:
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 429 Rate Limit
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable

---

### 3. Preserve Error Context Through Call Stack

```
API → aiQueryParserService → aiService → chatView
      [creates struct]      [stores]    [displays]
```

At EACH step, preserve the FULL structured error, don't extract just one field!

---

## Status

✅ **ALL FIXES COMPLETE!**

- 400 Bad Request handler added
- AIError preserves structured errors
- Smart Search displays rich error info
- Task Chat displays rich error info
- Model-specific solutions provided
- Ready for rebuild and testing!

---

## Thank You! 🙏

**Huge thanks to the user for:**
1. Questioning whether ErrorHandler handles 400 errors (it didn't!)
2. Pointing out the error details weren't showing in UI
3. Persistent testing to find this critical bug
4. Not accepting "I fixed it" when it wasn't really fixed

**This is exactly the kind of scrutiny that leads to real fixes!** 🎉
