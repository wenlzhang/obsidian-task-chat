# Algorithmic Expansion Enforcement - 2025-01-26

## User's Problem Report

> "Now I think the performance is still not good enough because I included English and Chinese in the settings tab. Sometimes it expands the search keywords only into Chinese or only into English, but it never does both, which is a bit strange."

**Configuration**: Languages = [English, 中文], Max expansions = 5

**Actual Behavior**:
- **Attempt 1** (gpt-4o-mini): 15 keywords ALL Chinese, 0 English ❌
- **Attempt 2** (gpt-4.1-nano): 16 keywords mixed (13 English, 3 Chinese) ❌

**Expected Behavior**:
- 3 core keywords × (5 English + 5 中文) = 30 total keywords
- Each keyword should have BOTH languages equally

## Root Cause

Despite previous fixes making the prompt dynamic, the AI was still **not consistently following instructions**:

1. **Missing explicit algorithm**: Instructions said "generate in all languages" but didn't specify HOW
2. **Examples too complex**: Conditional logic might confuse AI about whether to choose OR iterate
3. **No verification steps**: AI had no checklist to verify it processed all languages

## The Solution

### 1. Added Explicit Step-by-Step Algorithm

**Location**: `/src/services/aiQueryParserService.ts` lines 866-880

```typescript
🔴 CRITICAL ALGORITHM - FOLLOW THESE STEPS EXACTLY:
Step 1: For EACH core keyword, create an empty expansion list
Step 2: For the current keyword, iterate through EVERY language in order: ${languageList}
Step 3: For each language, generate EXACTLY ${maxExpansions} semantic equivalents
Step 4: Add all ${maxExpansions} equivalents to the expansion list
Step 5: Repeat steps 2-4 until ALL ${queryLanguages.length} languages are processed
Step 6: Verify the expansion list has ${maxKeywordsPerCore} total items
Step 7: Move to next core keyword and repeat steps 1-6
```

**Why this works**:
- **Sequential**: Forces AI to process one language at a time
- **Explicit**: No ambiguity about what "all languages" means
- **Verifiable**: Each step has clear output
- **Iterative**: Clear loop structure AI can follow

### 2. Added Verification Checklist

**Location**: `/src/services/aiQueryParserService.ts` lines 875-880

```typescript
⚠️ VERIFICATION CHECKLIST (check before returning):
☐ Did I process ALL ${queryLanguages.length} languages for EVERY keyword?
☐ Does each keyword have ${maxExpansions} equivalents in ${queryLanguages[0]}?
☐ Does each keyword have ${maxExpansions} equivalents in ${queryLanguages[1]}?
☐ Total keywords = ${maxKeywordsPerCore} × (number of core keywords)?
```

**Why this works**:
- **Self-checking**: AI verifies before returning
- **Language-specific**: Checks each configured language explicitly
- **Quantitative**: Exact numbers to verify against

### 3. Replaced Examples with Step-by-Step Demonstrations

**Old approach** (lines 895-953):
```typescript
THINKING PROCESS:
- Generate equivalents in all languages

JSON output:
{
  "keywords": [conditional logic showing different languages...]
}
```

**New approach** (lines 895-953):
```typescript
🔴 STEP-BY-STEP ALGORITHM APPLICATION:

Core keyword 1: "提高"
    Language 1 (English): 5 equivalents → [improve, enhance, boost, increase, raise]
    Language 2 (中文): 5 equivalents → [提高, 提升, 改善, 增强, 增进]
    Subtotal: 10 equivalents ✓

Core keyword 2: "舒适性"
    Language 1 (English): 5 equivalents → [comfort, ease, convenience, coziness, luxury]
    Language 2 (中文): 5 equivalents → [舒适性, 舒适, 舒服, 安逸, 便利]
    Subtotal: 10 equivalents ✓

✅ VERIFICATION:
- Core keywords: 2
- Languages processed: 2 (English, 中文)
- Equivalents per keyword: 10 (5 × 2)
- Total equivalents: 2 × 10 = 20
```

**Why this works**:
- **Shows the process**: Not just the output, but HOW to get there
- **Labeled steps**: Each language explicitly labeled
- **Running totals**: Subtotals and verification at each step
- **Concrete numbers**: AI can follow and replicate exact pattern

### 4. Added Second Example Reinforcing Pattern

**Location**: lines 955-1002

Another complete example showing the same algorithm applied to different keywords:
- Different query ("开发插件")
- Same step-by-step breakdown
- Same verification pattern
- Reinforces that ALL queries must follow this process

## Expected Behavior After Fix

### For Query: "如何提高无人驾驶汽车舒适性"

**Configuration**:
- Languages: [English, 中文]
- Max expansions: 5 per language

**Core Keywords Extracted**: ["提高", "无人驾驶汽车", "舒适性"] (3 keywords)

**Expansion Process** (following algorithm):

**Keyword 1**: "提高"
- English (5): improve, enhance, boost, increase, raise
- 中文 (5): 提高, 提升, 改善, 增强, 增进
- Subtotal: 10 ✓

**Keyword 2**: "无人驾驶汽车"
- English (5): autonomous vehicle, driverless car, self-driving car, automated vehicle, unmanned vehicle
- 中文 (5): 无人驾驶汽车, 自动驾驶汽车, 无人驾驶, 自动驾驶, 智能汽车
- Subtotal: 10 ✓

**Keyword 3**: "舒适性"
- English (5): comfort, ease, convenience, coziness, luxury
- 中文 (5): 舒适性, 舒适, 舒服, 安逸, 便利
- Subtotal: 10 ✓

**Total**: 30 keywords (3 core × 10 per core) ✅

**Language Distribution**:
- English: 15 keywords (5 per keyword × 3 keywords) ✅
- 中文: 15 keywords (5 per keyword × 3 keywords) ✅

## Key Improvements

### 1. From Implicit to Explicit

**Before**: "Generate in all languages"
**After**: "Step 1: For EACH keyword... Step 2: Iterate through EVERY language..."

**Impact**: AI knows exactly WHAT to do and HOW to do it

### 2. From Description to Algorithm

**Before**: Descriptive instructions about what should happen
**After**: Executable algorithm with clear steps

**Impact**: AI can follow mechanically without interpretation

### 3. From Single Example to Process Demonstration

**Before**: One JSON example with conditional logic
**After**: Two complete examples showing step-by-step process

**Impact**: AI sees the PATTERN, not just one instance

### 4. From Unverified to Self-Checking

**Before**: No verification mechanism
**After**: Explicit checklist AI must complete

**Impact**: AI catches its own mistakes before returning

## Technical Details

### Algorithm Structure

```
FOR each core_keyword IN coreKeywords:
    expansion_list = []
    
    FOR each language IN queryLanguages:
        equivalents = generate_semantic_equivalents(
            concept=core_keyword,
            language=language,
            count=maxExpansions
        )
        expansion_list.append(equivalents)
    
    ASSERT len(expansion_list) == maxExpansions * len(queryLanguages)
    
    keywords.extend(expansion_list)

ASSERT len(keywords) == len(coreKeywords) * maxExpansions * len(queryLanguages)
```

### Example Output Format

```json
{
  "coreKeywords": ["提高", "舒适性"],
  "keywords": [
    "improve", "enhance", "boost", "increase", "raise",
    "提高", "提升", "改善", "增强", "增进",
    "comfort", "ease", "convenience", "coziness", "luxury",
    "舒适性", "舒适", "舒服", "安逸", "便利"
  ]
}
```

**Order**: Each keyword's expansions grouped together, languages in configured order

### Verification Math

```
Expected total = core_count × expansions_per_language × language_count

For query "如何提高舒适性":
- core_count = 2 (提高, 舒适性)
- expansions_per_language = 5
- language_count = 2 (English, 中文)
- Expected = 2 × 5 × 2 = 20 keywords

Per language:
- English = core_count × expansions_per_language = 2 × 5 = 10
- 中文 = core_count × expansions_per_language = 2 × 5 = 10
```

## Files Modified

**File**: `/src/services/aiQueryParserService.ts`

**Changes**:
1. Lines 866-880: Added explicit 7-step algorithm
2. Lines 875-880: Added verification checklist
3. Lines 895-953: Replaced Example 1 with step-by-step demonstration
4. Lines 955-1002: Replaced Example 2 with reinforcing demonstration

**Total**: ~120 lines modified/replaced

## Testing Recommendations

### Test Case 1: Chinese Query
```
Query: "如何提高无人驾驶汽车舒适性"
Languages: [English, 中文]
Max expansions: 5

Expected:
- Core: 3 keywords
- Total: 30 keywords (15 English + 15 Chinese)
- Each keyword: 10 expansions (5 per language)
```

### Test Case 2: English Query
```
Query: "How to improve autonomous vehicle comfort"
Languages: [English, 中文]
Max expansions: 5

Expected:
- Core: 4 keywords (improve, autonomous, vehicle, comfort)
- Total: 40 keywords (20 English + 20 Chinese)
- Each keyword: 10 expansions (5 per language)
```

### Test Case 3: Mixed Query
```
Query: "开发 Task Chat plugin"
Languages: [English, 中文]
Max expansions: 5

Expected:
- Core: 3 keywords (开发, Task, Chat)
- Total: 30 keywords (15 English + 15 Chinese)
- Source language irrelevant - ALL expand to both languages
```

### Verification in Console

Check logs for:
```
[Task Chat] Language Distribution:
  English: 15 keywords ✓
  中文: 15 keywords ✓
  
[Task Chat] Expansion Results:
  Total: 30 keywords
  Average per core: 10.0
  Target per core: 10 ✓
```

## Expected Impact

### Before Fix
- Inconsistent expansion (sometimes only 1 language)
- Unpredictable keyword counts
- Poor search coverage (missing half the languages)
- AI ignoring instructions

### After Fix
- Consistent expansion (ALWAYS all languages) ✅
- Predictable keyword counts (formula-based) ✅
- Complete search coverage (both languages) ✅
- AI following explicit algorithm ✅

## Success Criteria

✅ **Every query** expands to ALL configured languages  
✅ **Every keyword** gets exact number of expansions per language  
✅ **Total keywords** = core_count × expansions × language_count  
✅ **Language distribution** balanced (equal keywords per language)  
✅ **No warnings** about missing languages in console

## Status

✅ **COMPLETE** - Algorithm enforcement implemented

**Next Steps**:
1. Build plugin: `npm run build`
2. Test with user's query: "如何提高无人驾驶汽车舒适性"
3. Verify console logs show balanced distribution
4. Confirm 30 keywords (15 English + 15 Chinese)

---

**Related Documentation**:
- `/docs/dev/KEYWORD_EXPANSION_LANGUAGE_BUG_FIX_2025-01-26.md` - Initial dynamic fix
- `/docs/dev/COMPREHENSIVE_LANGUAGE_PROMPT_ENHANCEMENT_2025-01-26.md` - Consistency fix

**Thank you for the persistent feedback!** Your testing revealed that dynamic references alone weren't enough - the AI needed an explicit, step-by-step algorithm to follow consistently. This fix should ensure reliable expansion across all configured languages. 🎯
