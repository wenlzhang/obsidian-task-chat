# Comprehensive Prompt Cleanup Plan

## Issues Identified by User ✅

1. **Dynamic example code is redundant** - Instruction at TOP makes complex examples unnecessary
2. **× symbol might confuse AI** - Should use actual calculated values (e.g., "100 total" not "50 × 2")
3. **Inconsistent variable usage** - "4", "max", "maxKeywordsPerCore" used inconsistently
4. **Fallback error needs numbered list** - Match Solutions section format

## Solution

### Part 1: Remove ALL Redundant Example Code

**Remove:**
- ❌ `developExamples`, `taskExamples`, `chatExamples` pools (161 lines)
- ❌ All complex ternary expressions checking language
- ❌ `QueryParserService.formatExampleArray()` calls
- ❌ `QueryParserService.getExampleKeywords()` calls  
- ❌ `QueryParserService.generateDynamicExample()` calls

**Replace with:**
- ✅ Simple `getExamplePattern(lang)` calls
- ✅ Pattern: `[item1, item2, item3, ..., item50] ← 50 items in English`

### Part 2: Replace × with Calculated Values

**Before:**
```
- Total per keyword: ${maxKeywordsPerCore} (${expansionsPerLanguage} × ${queryLanguages.length})
- Total: 3 × ${maxKeywordsPerCore} = ${3 * maxKeywordsPerCore}
```

**After:**
```
- Total per keyword: ${maxKeywordsPerCore} (calculated: ${expansionsPerLanguage} per language, ${queryLanguages.length} languages)
- Total: ${3 * maxKeywordsPerCore} keywords (3 core keywords, ${maxKeywordsPerCore} each)
```

### Part 3: Standardize Variable References

**Use consistently:**
- `maxKeywordsPerCore` = expansions per SINGLE core keyword
- Actual count (e.g., `${3 * maxKeywordsPerCore}`) = total for entire query

**Avoid:**
- Generic "max" without context
- Inconsistent example counts ("4" in some places, "3" in others)

### Part 4: Fix Fallback Error Format

**chatView.ts lines 847-861:**

**Before:**
```typescript
// Split fallback message by period
const fallbackMessages = message.error.fallbackUsed
    .split(". ")
    .filter((s: string) => s.trim())
    .map((s: string) => s.trim() + (s.endsWith(".") ? "" : "."));

if (fallbackMessages.length > 1) {
    fallbackMessages.forEach((msg: string) => {
        fallbackEl.createEl("div", { text: msg });
    });
}
```

**After:**
```typescript
// Split by newlines (like Solutions section)
const fallbackMessages = message.error.fallbackUsed
    .split("\\n")
    .filter((s: string) => s.trim());

if (fallbackMessages.length > 1) {
    const listEl = fallbackEl.createEl("ol");
    fallbackMessages.forEach((msg: string) => {
        // Remove trailing periods and numbers
        listEl.createEl("li", {
            text: msg.replace(/^\d+\.\s*/, "").replace(/\.$/, "")
        });
    });
}
```

## Implementation Order

1. ✅ Remove all example pools and complex ternary logic
2. ✅ Replace with simple getExamplePattern calls
3. ✅ Replace × symbols with calculated values  
4. ✅ Standardize variable names throughout
5. ✅ Fix fallback error formatting in chatView.ts

## Expected Results

**Code reduction:** ~200-300 lines removed
**Clarity:** Calculations explicit, no confusing symbols
**Consistency:** One pattern throughout
**User experience:** Better error messages

## Files to Modify

1. `src/services/aiQueryParserService.ts` - Remove examples, fix calculations
2. `src/views/chatView.ts` - Fix fallback formatting
