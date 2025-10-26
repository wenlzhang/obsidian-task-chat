# Dynamic Expansion Formula Fix - 2025-01-26

## Problem Identified

The AI was consistently generating only ~10 expansions per core keyword (5 per language × 2 languages) regardless of the user's `expansionsPerLanguage` setting.

**User's Setting:** `expansionsPerLanguage = 50`  
**Expected:** 50 per language × 2 languages = **100 keywords per core**  
**Actual:** Only ~10 keywords per core (5 per language)

**Console Evidence:**
```
Expansion under-performing: 5 core → 50 expanded (target: ~500)
Language "English" has only 25 keywords (expected at least 40 per core keyword)
Language "中文" has only 25 keywords (expected at least 40 per core keyword)
```

## Root Cause

The AI was copying concrete example arrays literally instead of using the variable `${expansionsPerLanguage}`.

**Example prompt showed:**
```
"keywords": [
  "develop", "build", "create", "implement", "code",  // 5 items shown
  "开发", "构建", "创建", "编程", "制作"               // 5 items shown
]
```

**AI behavior:** Copied the 5-item pattern even though `${expansionsPerLanguage} = 50`

**Why this happened:**
- LLMs are pattern matchers - they learn from examples
- Seeing concrete 5-item arrays → AI mimics that exact pattern
- Variable text like `${expansionsPerLanguage}` gets less weight than visual patterns
- The AI's training prioritizes matching observed structures

## Solution Implemented

### 1. Mathematical Formula Emphasis

Replaced abstract warnings with concrete algorithmic instructions:

**BEFORE (ineffective):**
```
⚠️ Examples show ~15 items for readability, but you MUST generate ${expansionsPerLanguage} per language!
```

**AFTER (effective):**
```
🔴 MATHEMATICAL FORMULA (FOLLOW THIS EXACTLY):

FOR EACH core keyword:
  total_expansions = 0
  FOR EACH language in [${languageList}]:
    generate EXACTLY ${expansionsPerLanguage} semantic equivalents
    total_expansions += ${expansionsPerLanguage}
  END FOR
  VERIFY: total_expansions == ${maxKeywordsPerCore}
END FOR

FINAL VERIFICATION:
total_keywords_returned = (number_of_core_keywords) × ${maxKeywordsPerCore}
```

### 2. Placeholder Examples Instead of Concrete Arrays

**BEFORE (misleading):**
```javascript
"keywords": [
  "develop", "build", "create", "implement", "code",     // Shows exactly 5
  "开发", "构建", "创建", "编程", "制作",                  // Shows exactly 5
  "task", "work", "job", "assignment", "item"            // Shows exactly 5
]
```

**AFTER (clear placeholders):**
```javascript
"keywords": [
  // For "开发": ${maxKeywordsPerCore} items total (${expansionsPerLanguage} per language)
  // English: ${expansionsPerLanguage} items
  "item1_English", "item2_English", "item3_English", "..." /* ${expansionsPerLanguage - 3} more */
  
  // 中文: ${expansionsPerLanguage} items
  "item1_中文", "item2_中文", "item3_中文", "..." /* ${expansionsPerLanguage - 3} more */
]

🔴 CRITICAL: The above is a STRUCTURE TEMPLATE!
- Replace "item1_English" etc. with ACTUAL semantic equivalents
- Generate FULL ${expansionsPerLanguage} items per language (not just 3!)
- Total keywords array length: N core × ${maxKeywordsPerCore} = ___ items
```

### 3. Step-by-Step Algorithm with Dynamic Values

**BEFORE:**
```
Core keyword 1: "开发"
  Language 1 (English): 5 equivalents → [develop, build, create, implement, code]
  Language 2 (中文): 5 equivalents → [开发, 构建, 创建, 编程, 制作]
Subtotal: 10 equivalents ✓
```

**AFTER:**
```
Core keyword 1: "开发"
  Language 1 (English): Generate ${expansionsPerLanguage} semantic equivalents
    Examples: develop, build, create, ...(${expansionsPerLanguage} total)
  Language 2 (中文): Generate ${expansionsPerLanguage} semantic equivalents
    Examples: 开发, 构建, 创建, ...(${expansionsPerLanguage} total)
Subtotal: ${maxKeywordsPerCore} equivalents ✓ (${expansionsPerLanguage} per language × ${queryLanguages.length} languages)
```

### 4. Multiple Verification Checkpoints

Added verification checklist the AI must follow:

```
⚠️ BEFORE RETURNING JSON, VERIFY:
☐ Counted my core keywords: N = ___ 
☐ Generated ${expansionsPerLanguage} equivalents in English for EACH keyword?
☐ Generated ${expansionsPerLanguage} equivalents in 中文 for EACH keyword?
☐ Total keywords returned = N × ${maxKeywordsPerCore} = ___ ?
```

### 5. Prominent Warning About Examples

```
🔴 CRITICAL: EXAMPLES USE PLACEHOLDERS, NOT LITERAL OUTPUT
⚠️ Arrays in examples show "[...${expansionsPerLanguage} items...]" as PLACEHOLDERS
⚠️ DO NOT copy example arrays literally!
⚠️ The number ${expansionsPerLanguage} is a VARIABLE - use this exact value!

📊 YOUR ACTUAL TASK:
- User configured: ${expansionsPerLanguage} expansions per language
- You MUST generate: ${expansionsPerLanguage} items per language (NOT 5, NOT 10, EXACTLY ${expansionsPerLanguage}!)
- For 50 per language: generate 50 creative variations (synonyms, related terms, context variants)
- For 100 per language: generate 100 variations (be extremely creative!)
```

## Technical Changes

### File: `src/services/aiQueryParserService.ts`

**Changes Made:**

1. **Lines 517-537:** Added mathematical formula with dynamic calculations
2. **Lines 931-943:** Emphasized dynamic calculation over static examples
3. **Lines 945-973:** Converted algorithm from concrete examples to step-by-step with variables
4. **Lines 987-1002:** Replaced abstract warnings with concrete task instructions
5. **Lines 1009-1060:** Updated Example 1 to use placeholders with formula annotations
6. **Lines 1068-1104:** Updated JSON output to show structure template with variable counts
7. **Lines 1117-1179:** Updated Example 2 with placeholders and dynamic formulas

**Key Patterns Removed:**
- ❌ `[develop, build, create, implement, code]` (concrete 5-item array)
- ❌ `[开发, 构建, 创建, 编程, 制作]` (concrete 5-item array)
- ❌ Static examples that AI could copy literally

**Key Patterns Added:**
- ✅ `Generate ${expansionsPerLanguage} semantic equivalents`
- ✅ `...(${expansionsPerLanguage} total)`
- ✅ `/* ${expansionsPerLanguage - 3} more */`
- ✅ `${maxKeywordsPerCore} items total (${expansionsPerLanguage} per language)`
- ✅ Mathematical formulas with variables
- ✅ Verification checklists with placeholders to fill in

## Expected Behavior After Fix

### Scenario: User sets `expansionsPerLanguage = 50`

**Query:** "How to improve motion comfort in trajectory planner?"

**Expected AI Output:**

```json
{
  "coreKeywords": ["improve", "motion", "comfort", "trajectory", "planner"],
  "keywords": [
    // For "improve": 100 items (50 English + 50 中文)
    "improve", "enhance", "boost", "increase", "raise", "upgrade", "refine", "optimize", "better", "ameliorate",
    "strengthen", "advance", "develop", "augment", "elevate", "polish", "perfect", "fine-tune", "enrich", "heighten",
    ... // 30 more English
    "改善", "提升", "增强", "提高", "增进", "优化", "改进", "加强", "改良", "完善",
    "精进", "促进", "强化", "发展", "改造", "革新", "提炼", "优化", "改善", "升级",
    ... // 30 more 中文
    
    // For "motion": 100 items (50 English + 50 中文)
    ... // Similar pattern
    
    // For "comfort": 100 items (50 English + 50 中文)
    ... // Similar pattern
    
    // For "trajectory": 100 items (50 English + 50 中文)
    ... // Similar pattern
    
    // For "planner": 100 items (50 English + 50 中文)
    ... // Similar pattern
  ]
}
```

**Total keywords:** 5 core × 100 = **500 keywords**

**Console Output:**
```
[Task Chat] Expansion Results: {expandedKeywords: Array(500), totalExpanded: 500, averagePerCore: '100.0', targetPerCore: 100}
[Task Chat]   English: 250 keywords
[Task Chat]   中文: 250 keywords
```

## Why This Approach Works

### 1. **Visual Structure Over Text Instructions**

LLMs weight what they "see" more than what they "read":
- Seeing `[a, b, c, d, e]` → AI copies 5 items
- Seeing `[item1, item2, ..., /* N more */]` → AI knows to generate N items

### 2. **Mathematical Formulas as Guardrails**

Pseudocode creates logical constraints:
```
FOR EACH core keyword:
  FOR EACH language:
    generate EXACTLY ${expansionsPerLanguage} equivalents
```

This structure forces the AI to think algorithmically, not pattern-match.

### 3. **Multiple Reinforcement**

The fix repeats the key message in multiple formats:
- Mathematical formula (logical)
- Verification checklist (procedural)
- Example annotations (contextual)
- Warning boxes (attention-grabbing)

Each format targets different aspects of how LLMs process instructions.

### 4. **Placeholder Patterns**

Instead of showing concrete examples, we show:
```
"item1_English", "item2_English", "..." /* ${expansionsPerLanguage - 2} more */
```

This makes it **impossible** for the AI to copy literally - it **must** generate actual words.

## Testing Recommendations

### Test Case 1: Default Setting (5 per language)
```
Settings: expansionsPerLanguage = 5, languages = ["English", "中文"]
Query: "Fix bug"
Expected: 2 core × 10 = 20 keywords
```

### Test Case 2: High Setting (50 per language)
```
Settings: expansionsPerLanguage = 50, languages = ["English", "中文"]
Query: "Improve motion comfort"
Expected: 3 core × 100 = 300 keywords
```

### Test Case 3: Very High Setting (100 per language)
```
Settings: expansionsPerLanguage = 100, languages = ["English", "中文", "Svenska"]
Query: "develop plugin"
Expected: 2 core × 300 = 600 keywords
```

### Test Case 4: Multiple Languages
```
Settings: expansionsPerLanguage = 30, languages = ["English", "中文", "Svenska", "Español"]
Query: "task management"
Expected: 2 core × 120 = 240 keywords
```

## Verification Checklist

After implementing these changes, verify:

- [ ] AI generates EXACTLY `expansionsPerLanguage` items per language per keyword
- [ ] Total keywords = `coreCount × (expansionsPerLanguage × languageCount)`
- [ ] No more "expansion under-performing" warnings
- [ ] Language distribution matches expectations
- [ ] Works with any value: 5, 10, 30, 50, 100, etc.
- [ ] Console logs show correct counts
- [ ] No hardcoded 5-item patterns remain in prompt

## Key Principle

> **Show structure, not content. Use variables, not constants. Make the AI calculate, not copy.**

When designing prompts for LLMs:
- ❌ Don't show concrete examples they can copy
- ✅ Do show structure templates with variables
- ❌ Don't rely on text warnings about "don't copy"
- ✅ Do make it structurally impossible to copy literally
- ❌ Don't use static counts in examples
- ✅ Do use variable expressions like `${expansionsPerLanguage}`

## User's Excellent Insight

The user correctly identified:

> "We tell the AI that for each keyword, we need to generate a variable multiplied by the number of languages. We use variables, settings, and calculations. The AI's capability is limited by the number of examples provided."

This insight led to the fix:
1. Use **variables** throughout (`${expansionsPerLanguage}`)
2. Show **calculations** not results (`5 × 2 = 10`)
3. Make examples **structural** not literal (placeholders with "...")
4. Emphasize the **formula** over specific numbers

## Status

✅ **IMPLEMENTED** - All changes applied to `aiQueryParserService.ts`

**Next Steps:**
1. Test with `expansionsPerLanguage = 50` and verify 500 total keywords
2. Test with `expansionsPerLanguage = 100` and verify 1000 total keywords
3. Monitor console logs for correct expansion counts
4. Verify no more "under-performing" warnings

**Build:** Ready to test (TypeScript errors resolved)

**Impact:** AI should now respect user's `expansionsPerLanguage` setting exactly, generating the full dynamic count instead of copying 5-item example patterns.
