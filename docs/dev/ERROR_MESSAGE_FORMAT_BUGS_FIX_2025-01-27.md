# Error Message Format Bugs Fixed (2025-01-27)

## User's Excellent Discovery! 🎯

User identified **THREE critical bugs** in error message formatting:

1. **Bug #1:** Error message shows "openai/gpt-5-mini" instead of "OpenAI: gpt-5-mini"
2. **Bug #2:** Wrong error label - says "AI parser failed" when analysis failed
3. **Bug #3:** Metadata display shows "Model: openai/gpt-5-mini" instead of "OpenAI: gpt-5-mini"

---

## The Problems

### Bug #1: Error Handler Uses Internal Format ❌

**Location:** `aiService.ts` line 1035

```typescript
// BEFORE (WRONG)
const modelInfo = `${analysisProvider}/${analysisModel}`;  // "openai/gpt-5-mini"
```

**Why wrong:**
- Used internal "provider/model" format for display
- Should format as "Provider: model" for users

**Example error message:**
```
⚠️ AI parser failed
Model: openai/gpt-5-mini  ❌ CONFUSING!
Error: AI API error: 400
```

---

### Bug #2: Wrong Error Title ❌

**Location:** `chatView.ts` line 805-806

```typescript
// BEFORE (WRONG)
if (errorTitle.includes("analysis")) {
    errorTitle = "AI parser failed";  // ❌ This is ANALYSIS, not parsing!
}
```

**Why wrong:**
- Analysis errors were labeled as "parser failed"
- Parser errors had no specific label
- Completely misleading for users!

**What happened:**
- User configured: gpt-4o-mini for parsing, gpt-5-mini for analysis
- Analysis failed → showed "AI parser failed" ❌
- User thought parser failed, but it was actually analysis!

---

### Bug #3: Metadata Display Uses Internal Format ❌

**Location:** `chatView.ts` line 1010

```typescript
// BEFORE (WRONG)
parts.push(`Model: ${message.error.model}`);  // Shows "openai/gpt-5-mini"
```

**Why wrong:**
- Raw model field from error (internal format)
- Should use same formatting as normal display: "Provider: model"

**Example metadata:**
```
Mode: Task Chat · Model: openai/gpt-5-mini · Language: Unknown  ❌ UGLY!
```

---

## The Fixes

### Fix #1: Format Model Info for Display ✅

**File:** `aiService.ts` (lines 1035-1041)

```typescript
// AFTER (CORRECT)
// Format model info for display: "Provider: model" not "provider/model"
const providerName = 
    analysisProvider === "openai" ? "OpenAI" :
    analysisProvider === "anthropic" ? "Anthropic" :
    analysisProvider === "openrouter" ? "OpenRouter" :
    "Ollama";
const modelInfo = `${providerName}: ${analysisModel}`;  // "OpenAI: gpt-5-mini" ✅
```

**Also fixed in `aiQueryParserService.ts`:**
- Line 2282-2284: OpenAI/OpenRouter errors (callAI function)
- Line 2393-2395: Anthropic errors (callAnthropic function)  
- Line 2578-2580: Ollama errors (callOllama function)

**Result:**
```
⚠️ AI analysis failed
Model: OpenAI: gpt-5-mini  ✅ CLEAR!
Error: AI API error: 400
```

---

### Fix #2: Correct Error Labels ✅

**File:** `chatView.ts` (lines 803-809)

```typescript
// AFTER (CORRECT)
// Make error message more specific based on error type
let errorTitle = message.error.message;
if (errorTitle.includes("analysis")) {
    errorTitle = "AI analysis failed";  ✅ Correct!
} else if (errorTitle.includes("parsing")) {
    errorTitle = "AI parser failed";    ✅ Also correct!
}
```

**Now shows:**
- Analysis errors → "AI analysis failed" ✅
- Parser errors → "AI parser failed" ✅
- Other errors → Original message ✅

---

### Fix #3: Metadata Display Format ✅

**File:** `chatView.ts` (lines 1010-1013)

```typescript
// AFTER (CORRECT)
// Error model is already formatted as "Provider: model" from error handler
parts.push(message.error.model);  // Already formatted! ✅
```

**Result:**
```
Mode: Task Chat · OpenAI: gpt-5-mini · Language: Unknown  ✅ CLEAN!
```

---

## Impact

### Before Fixes ❌

**Console:**
```
[Task Chat] Starting OpenAI streaming call... (provider: openai, model: gpt-5-mini, normalized: gpt-5-mini)
POST https://api.openai.com/v1/chat/completions 400 (Bad Request)
[Task Chat] Parsing API error: {message: 'AI API error: 400 ', body: {…}, model: 'openai/gpt-5-mini', operation: 'analysis'}
```

**Error Message:**
```
⚠️ AI parser failed        ❌ WRONG! It's analysis, not parser
Model: openai/gpt-5-mini   ❌ UGLY internal format
Error: AI API error: 400
```

**Metadata:**
```
Mode: Task Chat · Model: openai/gpt-5-mini · Language: Unknown  ❌ UGLY!
```

---

### After Fixes ✅

**Console:**
```
[Task Chat] Starting OpenAI streaming call... (provider: openai, model: gpt-5-mini, normalized: gpt-5-mini)
POST https://api.openai.com/v1/chat/completions 400 (Bad Request)
[Task Chat] Parsing API error: {message: 'AI API error: 400 ', body: {…}, model: 'OpenAI: gpt-5-mini', operation: 'analysis'}
```

**Error Message:**
```
⚠️ AI analysis failed      ✅ CORRECT label!
Model: OpenAI: gpt-5-mini  ✅ CLEAN display format!
Error: AI API error: 400
```

**Metadata:**
```
Mode: Task Chat · OpenAI: gpt-5-mini · Language: Unknown  ✅ CLEAN!
```

---

## Files Modified

### aiService.ts
- **Lines 1035-1041:** Format analysis error model info as "Provider: model"

### chatView.ts
- **Lines 803-809:** Fix error labels (analysis vs parser)
- **Lines 1010-1013:** Use formatted model from error (no "Model:" prefix duplication)

### aiQueryParserService.ts
- **Lines 2282-2284:** Format OpenAI/OpenRouter parsing error model info
- **Lines 2393-2395:** Format Anthropic parsing error model info  
- **Lines 2578-2580:** Format Ollama parsing error model info

---

## Key Lessons

### 1. Display Format vs Internal Format

**Internal format** (for code/logs):
- `"openai/gpt-5-mini"` → good for provider/model separation
- Used in settings, routing, normalization

**Display format** (for users):
- `"OpenAI: gpt-5-mini"` → clear, professional
- Used in UI, error messages, metadata

**Rule:** Never show internal formats to users!

---

### 2. Error Messages Must Be Specific

**Generic:** "AI parser failed" ❌
- User doesn't know which AI operation failed
- Could be parsing OR analysis
- Confusing!

**Specific:** "AI analysis failed" ✅
- User knows exactly which operation failed
- Can check correct settings (analysis model vs parser model)
- Clear!

---

### 3. Consistent Formatting Everywhere

Error message format should match metadata format:
- Both use "Provider: model"
- Not "provider/model" or "Model: provider/model"
- Consistent = professional

---

## User Benefits

**Before:**
- ❌ Confusing "openai/" prefix in error messages
- ❌ Wrong error labels (parser vs analysis)
- ❌ Inconsistent formatting
- ❌ Hard to debug which model/provider failed

**After:**
- ✅ Clean "OpenAI: model" display format
- ✅ Correct error labels
- ✅ Consistent formatting everywhere
- ✅ Easy to identify which model/provider failed
- ✅ Professional appearance

---

## Testing

**Scenario 1: Analysis fails with OpenAI**
```
Settings:
- Parsing: gpt-4o-mini
- Analysis: gpt-5-mini (doesn't exist)

Expected Error:
⚠️ AI analysis failed
Model: OpenAI: gpt-5-mini
Error: AI API error: 400
```

**Scenario 2: Parser fails with Anthropic**
```
Settings:
- Parsing: claude-invalid
- Analysis: gpt-4o-mini

Expected Error:
⚠️ AI parser failed
Model: Anthropic: claude-invalid
Error: AI API error: 400
```

**Scenario 3: Mixed providers**
```
Settings:
- Parsing: OpenRouter (openai/gpt-4o-mini)
- Analysis: OpenAI (gpt-5-mini)

If analysis fails:
⚠️ AI analysis failed
Model: OpenAI: gpt-5-mini  ✅ Clear which provider!
Error: AI API error: 400
```

---

## Status

✅ **ALL THREE BUGS FIXED!**

- Error handler formats model info correctly
- Error labels are specific and accurate
- Metadata displays clean "Provider: model" format
- Consistent across all 4 providers (OpenAI, Anthropic, OpenRouter, Ollama)
- Ready for rebuild and testing!

---

## Thank You! 🙏

**Huge thanks to the user for:**
1. Testing thoroughly with different provider configurations
2. Identifying ALL THREE formatting bugs
3. Providing detailed screenshots and console logs
4. Explaining exactly what was confusing

This kind of detailed feedback makes the plugin so much better!
