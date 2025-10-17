# Semantic Expansion Debugging Guide

**Date:** 2024-10-17  
**Issue:** AI not expanding keywords into all configured languages

## Problem Summary

### Issue 1: 🚨 AI Under-Performing

**Expected:** 60 keywords (4 core × 15 per core with 3 languages)  
**Actual:** 8 keywords  
**Ratio:** 13% of target!

```
[Task Chat] Expansion under-performing: 4 core → 8 expanded (target: ~60)
```

### Issue 2: 🚨 Swedish Completely Missing

**Configuration:** `["English", "中文", "Svenska"]`

**Expected distribution:**
- English: ~20 keywords (4 core × 5 per core)
- 中文: ~20 keywords
- Svenska: ~20 keywords
- **Total:** ~60 keywords

**Actual distribution:**
```
English: 6 keywords
中文: 2 keywords
Svenska: 0 keywords ← MISSING!
```

**Impact:** Swedish task "Utveckla plugin-programmet Task Chat" was found by quality filter BUT NOT through semantic expansion.

### Issue 3: ✅ Task Chat Variability (NORMAL)

**Observation:** Task Chat returns 3 tasks sometimes, 5 tasks other times

**Explanation:** This is **expected behavior!**
- Both runs found 19 quality-filtered tasks
- All 19 tasks sent to AI for analysis
- AI **chooses** which tasks to recommend (3-5 is reasonable)
- Smart Search shows all 19 (no AI selection)

**This is by design** - AI recommends most relevant subset.

---

## Root Cause Analysis

### Why AI Ignores Swedish

**The AI model likely:**
1. ❌ Doesn't recognize "Svenska" as Swedish language
2. ❌ Only knows "Swedish" in English
3. ❌ Focuses on English/Chinese (most common in training data)
4. ❌ Ignores less common language instructions

**Evidence:**
- Prompt says: "Languages: English, 中文, Svenska"
- AI only generates English + Chinese keywords
- No Swedish variations at all

### Why Only 8 Keywords Instead of 60

**AI is not following instructions:**
- Should generate 5 variations × 3 languages = 15 per core keyword
- For 4 core keywords: 15 × 4 = 60 total
- Actually generated: Only 2 per core keyword on average

**Possible reasons:**
1. Prompt not explicit enough about Swedish
2. AI doesn't understand "Svenska" 
3. AI skipping expansion when unsure about language
4. Model limitations with multilingual expansion

---

## Solutions Implemented

### Fix 1: 🚨 Much More Explicit Prompt

**Before:**
```
- Languages configured: English, 中文, Svenska
- Distribute evenly: ~5 variations per language
```

**After:**
```
🚨 CRITICAL EXPANSION REQUIREMENT:
You MUST expand EACH core keyword into ALL 3 configured languages: English, 中文, Svenska

For EACH core keyword:
- Generate 5 variations in English
- Generate 5 variations in 中文
- Generate 5 variations in Svenska
- Total: ~15 variations per core keyword

⚠️ DO NOT skip any configured language! If you only expand into some languages, 
the system will reject your response.
```

### Fix 2: 📚 Concrete Examples with Swedish

**Added explicit 3-language examples:**

```typescript
Example for ONE core keyword "develop" with languages [English, 中文, Svenska]:
[
  // English (5 variations)
  "develop", "build", "create", "code", "implement",
  
  // 中文 (5 variations)
  "开发", "构建", "创建", "编程", "实现",
  
  // Svenska (5 variations)
  "utveckla", "bygga", "skapa", "koda", "implementera",
]
```

**Full 2-keyword example:**
```typescript
Example for TWO core keywords "fix" + "bug" with 3 languages:
[
  "fix", "repair", "solve", "correct", "debug",           // fix in English
  "修复", "解决", "处理", "纠正", "调试",                     // fix in 中文
  "fixa", "reparera", "lösa", "korrigera", "felsöka",      // fix in Svenska
  
  "bug", "error", "issue", "defect", "fault",             // bug in English
  "错误", "问题", "缺陷", "故障", "漏洞",                     // bug in 中文
  "bugg", "fel", "problem", "defekt", "brist"             // bug in Svenska
]

⚠️ Notice: BOTH keywords expanded into ALL 3 languages!
```

### Fix 3: 🔍 Enhanced Detection & Validation

**Improved language detection:**
```typescript
// Detect Swedish by special characters (ä, å, ö)
if (/[äåö]/.test(keyword.toLowerCase())) {
    languageBreakdown["Svenska"].push(keyword);
}
```

**Added missing language warnings:**
```typescript
if (missingLanguages.length > 0) {
    console.error(
        `🚨 CRITICAL: AI failed to expand into ${missingLanguages.length} language(s): ${missingLanguages.join(", ")}`
    );
    console.error(
        `This will cause ${missingLanguages.join(", ")} tasks to be missed in search results!`
    );
}
```

**New console output:**
```
[Task Chat] Language Distribution (estimated):
  English: 6 keywords - [develop, build, create, implement, Task...]
  中文: 2 keywords - [开发, 插件]
  Svenska: 0 keywords ⚠️ MISSING!

[Task Chat] 🚨 CRITICAL: AI failed to expand into 1 language(s): Svenska
[Task Chat] This will cause Svenska tasks to be missed in search results!
[Task Chat] AI may not understand the language configuration. Consider using well-known language names.
```

---

## How to Verify the Fix

### Test Query

Use your same query: **"开发 Task Chat 插件"**

### Expected Results (After Fix)

```
[Task Chat] ========== SEMANTIC EXPANSION DETAILS ==========
[Task Chat] User Settings: {
  languages: ["English", "中文", "Svenska"],
  maxExpansionsPerLanguage: 5,
  targetPerCore: 15,
  expansionEnabled: true
}

[Task Chat] Extraction Results: {
  coreKeywords: ["开发", "Task", "Chat", "插件"],
  coreCount: 4
}

[Task Chat] Expansion Results: {
  expandedKeywords: [...array of ~60 keywords...],
  totalExpanded: 60,              ← SHOULD BE ~60, NOT 8!
  averagePerCore: "15.0",         ← SHOULD BE ~15, NOT 2.0!
  targetPerCore: 15
}

[Task Chat] Language Distribution (estimated):
  English: 20 keywords - [develop, build, create, implement, Task, ...]
  中文: 20 keywords - [开发, 构建, 创建, 编程, 实现, ...]
  Svenska: 20 keywords - [utveckla, bygga, skapa, koda, implementera, ...]  ← NOW PRESENT!
```

### What to Look For

✅ **Total expanded:** ~60 keywords (not 8)  
✅ **Average per core:** ~15 (not 2.0)  
✅ **All 3 languages present** with roughly equal distribution  
✅ **No warnings** about missing languages  
✅ **Swedish task found** via semantic expansion (not just quality filter)

---

## Understanding Task Chat Results

### Why 3 Tasks vs 5 Tasks?

**Both runs correctly found 19 tasks:**
1. 510 tasks matched keywords (from 879 total)
2. Quality filter reduced to 19 high-relevance tasks
3. All 19 sent to AI for analysis

**AI then recommends subset:**
- **Run 1:** AI picked 3 tasks to focus on
- **Run 2:** AI picked 5 tasks to focus on

**This is normal AI behavior:**
- AI judges which tasks are most relevant/urgent
- Recommendation count varies based on AI's analysis
- Sometimes 3, sometimes 5, sometimes more
- As long as base 19 are correct, this is fine

**Smart Search shows all 19** because it skips AI recommendation step.

### Consistency Between Runs

**Good news:** Both runs found same 19 tasks!
- ✅ Filtering consistent (510 → 19)
- ✅ Quality threshold consistent (50)
- ✅ Task order consistent (same sorting)

**Variable part:** AI's recommendation choice
- ⚠️ Sometimes picks 3, sometimes 5
- This is expected with LLMs (inherent randomness)
- Both recommendations are valid

---

## Recommendations

### 1. Use Well-Known Language Names

**Consider changing "Svenska" → "Swedish":**
- AI models train on English-language data
- "Swedish" is more recognizable than "Svenska"
- More likely to trigger correct expansions

**Update in settings:**
```typescript
queryLanguages: ["English", "中文", "Swedish"]  // Instead of "Svenska"
```

### 2. Monitor Language Distribution

**Always check console logs:**
```
[Task Chat] Language Distribution (estimated):
  English: X keywords
  中文: Y keywords
  Swedish: Z keywords
```

**Expected:** All languages should have roughly equal counts

**If one is 0 or very low:** AI is not expanding properly

### 3. Adjust Max Expansions if Needed

**If still under-performing:**
- Increase `maxKeywordExpansions` from 5 to 7
- More variations = more chances to match tasks
- Trade-off: Higher token costs

**If getting too much noise:**
- Decrease to 3
- Fewer variations = more precise matching
- Trade-off: May miss relevant tasks

### 4. Accept Task Chat Variability

**Don't worry about 3 vs 5 recommendations:**
- ✅ Both found same 19 base tasks
- ✅ AI is just choosing different subsets
- ✅ This is normal LLM behavior

**If concerned:**
- Use Smart Search to see all results
- Compare base filtered count (should be consistent)
- Focus on whether correct tasks are in the 19

---

## Testing Checklist

After applying fixes, test with:

### Test 1: Chinese Query
- **Query:** "开发 Task Chat 插件"
- **Expect:** ~60 keywords, all 3 languages present
- **Verify:** Swedish task "Utveckla..." is found

### Test 2: English Query
- **Query:** "Develop Task Chat plugin"
- **Expect:** ~60 keywords, all 3 languages present
- **Verify:** Chinese tasks + Swedish task found

### Test 3: Swedish Query
- **Query:** "Utveckla Task Chat plugin"
- **Expect:** ~60 keywords, all 3 languages present
- **Verify:** Chinese + English tasks found

### Test 4: Consistency
- **Run same query 3 times**
- **Verify:** Same 19 base tasks each time
- **Accept:** Different AI recommendations (3-5 tasks)

---

## Technical Details

### Prompt Changes

**File:** `queryParserService.ts`  
**Lines:** 286-416

**Key additions:**
1. 🚨 CRITICAL EXPANSION REQUIREMENT section
2. Explicit per-language instructions
3. Warning about skipping languages
4. Concrete 3-language examples with Swedish
5. Dynamic template filling based on `queryLanguages` array

### Validation Changes

**File:** `queryParserService.ts`  
**Lines:** 558-637

**Key additions:**
1. Swedish character detection (ä, å, ö)
2. Missing language tracking
3. Per-language quality checks
4. Critical error messages when languages missing
5. Expected vs actual comparison

### Console Output

**Before:**
```
Language Distribution (estimated):
  English: 6 keywords
  中文: 2 keywords
```

**After (with warnings):**
```
Language Distribution (estimated):
  English: 6 keywords
  中文: 2 keywords
  Svenska: 0 keywords ⚠️ MISSING!

🚨 CRITICAL: AI failed to expand into 1 language(s): Svenska
```

---

## Future Improvements

### Potential Enhancements

1. **Fallback Expansion**
   - If AI fails, use simple translation API
   - Google Translate or similar
   - Ensure all languages covered

2. **Language Name Normalization**
   - Map "Svenska" → "Swedish" automatically
   - Support both native and English names
   - More robust for users

3. **Expansion Validation & Retry**
   - Check language coverage before returning
   - If missing languages, retry with stronger prompt
   - Maximum 2-3 retries

4. **Per-Language Quality Metrics**
   - Track expansion success per language
   - Adjust prompts based on historical performance
   - Learn which language names work best

5. **User Feedback Loop**
   - Let users report when expansions fail
   - Collect data on language recognition issues
   - Improve prompts over time

---

## Summary

**Issues Found:**
1. ❌ AI only expanded into 2 languages instead of 3
2. ❌ Swedish completely missing from expansion
3. ❌ Only 8 keywords instead of expected 60
4. ✅ Task Chat variability is normal (3 vs 5 tasks)

**Fixes Applied:**
1. ✅ Much more explicit prompt with 🚨 warnings
2. ✅ Concrete 3-language examples including Swedish
3. ✅ Enhanced validation with missing language detection
4. ✅ Better console logging with critical errors
5. ✅ Swedish character detection (ä, å, ö)

**Next Steps:**
1. Test with same query after rebuild
2. Verify all 3 languages present in distribution
3. Check Swedish task is found via expansion
4. Consider using "Swedish" instead of "Svenska"
5. Monitor console for missing language warnings

**Expected Outcome:**
- ✅ ~60 keywords total (not 8)
- ✅ All 3 languages represented
- ✅ Swedish task found via semantic expansion
- ✅ Cross-language search working properly
