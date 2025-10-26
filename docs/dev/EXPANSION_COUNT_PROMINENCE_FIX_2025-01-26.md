# Semantic Expansion Count Prominence Fix (2025-01-26)

## Problem Identified

User set `expansionsPerLanguage` to **50** with **2 languages**, expecting:
- 5 core keywords × 50 per language × 2 languages = **500 total keywords**
- Actually got: **~100 keywords** (only ~10 per core keyword per language)

**Root Cause:** AI copies what it sees in examples, not what's instructed in buried text.

Even with dynamic example generation functions, the issue persisted because:
1. Examples showed ~15 items maximum (from example pools)
2. Expansion count instruction was buried in the middle of a long prompt
3. AI pattern-matched the examples rather than following the count instruction
4. Helper functions added complexity without solving the core issue

## The Fix

### Change #1: Move Expansion Count to CRITICAL RULES (Top of Prompt)

**Before:** Instruction buried at line ~750 in middle of prompt

**After:** Added at line ~710, immediately after "CRITICAL PARSING RULES" header:

```typescript
🚨 CRITICAL: SEMANTIC EXPANSION COUNT 🚨
**YOU MUST GENERATE EXACTLY ${expansionsPerLanguage} SEMANTIC EQUIVALENTS PER LANGUAGE FOR EACH CORE KEYWORD**

Your settings:
- Languages: ${queryLanguages.length} (${languageList})
- Expansions per language: ${expansionsPerLanguage}
- Total per core keyword: ${maxKeywordsPerCore} (${expansionsPerLanguage} × ${queryLanguages.length})

⚠️ CRITICAL: If user sets 50 expansions per language:
- Generate EXACTLY 50 equivalents in English
- Generate EXACTLY 50 equivalents in 中文
- Total: 100 keywords per core keyword (NOT 15!)

⚠️ DO NOT limit yourself to examples shown below!
⚠️ Examples show ~15 items for readability, but you MUST generate ${expansionsPerLanguage} per language!
⚠️ For high counts (30-100), generate creative variations: synonyms, related terms, alternative phrasings!
```

**Why This Works:**
- AI sees the count FIRST (before any examples)
- Multiple warnings prevent pattern-matching examples
- Concrete example: "50 expansions = 50 items, NOT 15!"
- Tells AI to be creative for high counts

### Change #2: Simplify Example Format (Make Count Crystal Clear)

**Before:** Helper functions tried to show all items:
```typescript
const getExampleKeywords = (lang, baseKeywords) => {
    const count = expansionsPerLanguage;
    const examples = baseKeywords.slice(0, count);
    while (examples.length < count) {
        examples.push(`...`);
    }
    return `[${examples.join(", ")}]`;
};
```

**Problem:** For count=50, this generated `[item1, item2, ..., item15, ..., ..., ...]` - confusing!

**After:** Show explicit pattern with count reminder:
```typescript
const getExampleKeywords = (lang, baseKeywords) => {
    const examples = baseKeywords.slice(0, 3); // Show first 3
    if (expansionsPerLanguage <= 5) {
        return `[${baseKeywords.slice(0, expansionsPerLanguage).join(", ")}]`;
    } else {
        // Make count unmistakable with arrow and reminder
        return `[${examples.join(", ")}, ..., item${expansionsPerLanguage}] ← GENERATE ALL ${expansionsPerLanguage} ITEMS`;
    }
};
```

**Examples:**
- `expansionsPerLanguage=5`: `[develop, build, create, implement, code]`
- `expansionsPerLanguage=15`: `[develop, build, create, ..., item15] ← GENERATE ALL 15 ITEMS`
- `expansionsPerLanguage=50`: `[develop, build, create, ..., item50] ← GENERATE ALL 50 ITEMS`

**Why This Works:**
- Shows first 3 real examples (AI understands the pattern)
- `item50` makes target count explicit
- Arrow `←` draws attention
- `GENERATE ALL 50 ITEMS` is impossible to miss

### Change #3: Update generateDynamicExample (Unknown Languages)

**Before:**
```typescript
// For count=50: "[equiv1, equiv2, equiv3, ..., equiv50]"
```

**After:**
```typescript
// For count=50: "[equiv1, equiv2, equiv3, ..., equiv50] ← GENERATE ALL 50 ITEMS"
```

**Why:** Consistent pattern across all examples (known and unknown languages)

### Change #4: Fix Threshold Comment

**Before:**
```typescript
const expectedMinPerLanguage = Math.floor(
    expansionsPerLanguage * 0.8,
); // Reasonable minimum threshold (50% of target)  // ❌ WRONG!
```

**After:**
```typescript
const expectedMinPerLanguage = Math.floor(
    expansionsPerLanguage * 0.8,
); // Reasonable minimum threshold (80% of target)  // ✅ CORRECT
```

**Impact:** User changed from 0.5 to 0.8, but comment still said 50%

## Expected Results After Fix

### Test Case: User Settings
```typescript
queryLanguages: ["English", "中文"]
expansionsPerLanguage: 50
```

### Test Query: "How to improve motion comfort in trajectory planner?"

**Core Keywords Extracted:** 5
- improve
- motion  
- comfort
- trajectory
- planner

**Expected Expansion (Per Core Keyword):**
```
English: 50 semantic equivalents
中文: 50 semantic equivalents
Total per keyword: 100 equivalents
```

**Expected Total Keywords:**
```
5 core keywords × 100 equivalents per keyword = 500 keywords ✅
```

**Before Fix:**
```
5 core keywords × ~20 equivalents per keyword = ~100 keywords ❌
```

## Why Dynamic Examples Didn't Work

The user suspected correctly: **The dynamic example feature wasn't effective because:**

1. **AI is a pattern matcher** - Sees examples with 15 items, generates ~15 items
2. **Instructions buried** - Count instruction was in the middle, AI didn't prioritize it
3. **Example complexity** - Helper functions added code but didn't help communication
4. **Visual prominence matters** - AI needs to see the count FIRST and REPEATEDLY

**The Real Solution:**
- Move instruction to TOP ✅
- Make it IMPOSSIBLE to miss (warnings, concrete examples) ✅
- Keep examples SIMPLE with explicit count markers ✅
- Remove complexity that doesn't help ✅

## Files Modified

**`src/services/aiQueryParserService.ts`:**

1. **Lines 710-726:** Added CRITICAL EXPANSION COUNT section at top
   - Explicit count requirements
   - Concrete example (50 → 50 items, NOT 15)
   - Multiple warnings
   - Creative generation guidance

2. **Lines 474-500:** Simplified helper functions
   - `getExampleKeywords()`: Shows pattern `[item1, item2, item3, ..., itemN] ← GENERATE ALL N ITEMS`
   - `getJSONExampleKeywords()`: Shows pattern with comment `/* ...up to "itemN" - TOTAL: N items */`
   - Removed complexity, added clarity

3. **Lines 87-97:** Updated `generateDynamicExample()`
   - Added explicit count reminder
   - Pattern: `[item1, item2, item3, ..., itemN] ← GENERATE ALL N ITEMS`

4. **Line 2833:** Fixed threshold comment
   - Changed "50% of target" → "80% of target"
   - Matches actual 0.8 multiplier

## Build Impact

**Code Changes:**
- Added: ~16 lines (CRITICAL EXPANSION COUNT section)
- Modified: ~30 lines (helper functions + comments)
- Removed redundancy: Simplified logic

**Size:** Negligible increase (~0.1kb) from additional warnings in prompt

**Performance:** No impact - only prompt changes

## Key Lessons

### What Didn't Work

❌ **Dynamic example generation** - Added complexity without solving root issue
❌ **Buried instructions** - AI didn't prioritize them
❌ **Showing too many examples** - AI pattern-matched them
❌ **Assuming AI follows math** - AI copies patterns, not formulas

### What Works

✅ **Instruction prominence** - TOP of prompt, BEFORE examples
✅ **Multiple warnings** - Repetition helps AI prioritize
✅ **Explicit patterns** - `item50` makes count unmistakable
✅ **Visual markers** - `←` and `GENERATE ALL` draw attention
✅ **Concrete examples** - "50 means 50, NOT 15!"
✅ **Simplicity** - Removed helper complexity

### AI Communication Principles

1. **Say it FIRST** - Before any examples
2. **Say it CLEARLY** - No ambiguity
3. **Say it REPEATEDLY** - Multiple warnings
4. **Show it VISUALLY** - Arrows, caps, markers
5. **Give CONCRETE examples** - Not just abstract rules

## Testing Recommendations

1. **Default Settings (5 per language):**
   ```
   Expected: ~10 per core keyword (5 × 2 languages)
   Check: Should remain backward compatible
   ```

2. **Medium Settings (15 per language):**
   ```
   Expected: ~30 per core keyword (15 × 2 languages)
   Check: Examples show "item15" pattern
   ```

3. **High Settings (50 per language):**
   ```
   Expected: ~100 per core keyword (50 × 2 languages)
   Check: Examples show "item50" pattern + warnings active
   ```

4. **Very High Settings (100 per language):**
   ```
   Expected: ~200 per core keyword (100 × 2 languages)
   Check: AI generates creative variations as instructed
   ```

## User Feedback Integration

The user correctly identified:

1. ✅ **"Dynamic examples don't work"** - Correct! AI copies patterns, not instructions
2. ✅ **"Too much redundant code"** - Correct! Helper functions added complexity
3. ✅ **"Move to CRITICAL RULES"** - Correct! Prominence is key
4. ✅ **"Simplify examples"** - Correct! Explicit patterns better than trying to be clever

**All suggestions were excellent and have been implemented!** 🎯

## Next Steps

1. **Rebuild plugin** - Integrate changes
2. **Test with high settings** - Verify 50 per language works
3. **Monitor logs** - Check if AI now generates correct counts
4. **Adjust if needed** - May need to make warnings even MORE prominent

## Conclusion

The fix addresses the root cause: **AI visibility and pattern-matching behavior.**

By moving the expansion count instruction to the TOP with MULTIPLE prominent warnings, and simplifying examples to show explicit count patterns, we ensure the AI cannot miss or misinterpret the requirement.

The "dynamic examples" feature was well-intentioned but didn't solve the core communication problem. Sometimes **simpler and more prominent is better than clever and buried**.

**Status:** ✅ Ready for testing with high expansion settings!
