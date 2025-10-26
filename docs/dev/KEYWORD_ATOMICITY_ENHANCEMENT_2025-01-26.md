# Keyword Atomicity Enhancement - 2025-01-26

## User's Excellent Feedback

> "I still feel that this semantic expansion theme for keyword extraction is sometimes too strict. For example, for Chinese, you extracted core keywords that were too long, such as '无人驾驶汽车.' That's too long, right? Maybe you could shorten it to just '无人', '驾驶', '汽车' which would make it easier to match the search keywords. For English words, we may have instructions that specify a maximum of one to two words, but for Chinese, we don't have similar guidelines. Other languages configured by the user should also have comparable standards."

## The Problem

### Example from Console Logs

**Query 1**: "如何提高无人驾驶汽车舒适性？"

**AI extracted (WRONG)**:
```json
{
  "coreKeywords": ["提高", "无人驾驶汽车", "舒适性"],
  "keywords": [...]
}
```

**Problem**: "无人驾驶汽车" is 5 characters - too long!

**Impact**:
- ❌ Query "驾驶" won't match (only searches "无人驾驶汽车")
- ❌ Query "汽车" won't match  
- ❌ Query "自动驾驶" won't match
- ❌ Severely limits search coverage

### Root Cause

The prompt had keyword length guidelines for **English only**:
- ✅ English: "Keywords should be 1-2 words maximum"
- ❌ Chinese: No guidelines at all
- ❌ Other languages: No guidelines

This created an **imbalance**: English keywords were atomic, but Chinese/CJK keywords were often overly long compounds.

## The Solution

### 1. Added Comprehensive Length Guidelines

**Location**: `/src/services/aiQueryParserService.ts` lines 843-877

Added detailed atomicity rules for ALL configured languages:

```typescript
🔴 CRITICAL: KEYWORD LENGTH & ATOMICITY RULES (applies to ALL languages)

**English & Latin-script languages**:
- Maximum: 1-2 words per keyword
- Split phrases: "AI plugin" → ["AI", "plugin"]

**Chinese (中文) & CJK languages**:
- Maximum: 2-3 characters per keyword
- Split long compounds into atomic meaningful units
- ❌ WRONG: "无人驾驶汽车" (5 chars)
- ✅ CORRECT: ["无人", "驾驶", "汽车"] (3 atomic units)

**All other configured languages**:
- Follow similar atomic principle
- Maximum 2-3 meaningful units per keyword
```

### 2. Added Concrete Chinese Examples

**Lines 857-862**: Show WRONG vs CORRECT extraction

```typescript
❌ WRONG: "无人驾驶汽车" (5 chars, too long!)
✅ CORRECT: ["无人", "驾驶", "汽车"]

❌ WRONG: "轨迹规划算法" (6 chars)
✅ CORRECT: ["轨迹", "规划", "算法"]

❌ WRONG: "自动驾驶系统" (6 chars)
✅ CORRECT: ["自动", "驾驶", "系统"]
```

### 3. Explained Why Atomicity Matters

**Lines 869-872**: Clear rationale

```
**Why atomic keywords matter**:
- Query "驾驶" should match tasks containing "无人驾驶", "自动驾驶", "驾驶系统"
- Query "algorithm" should match "planning algorithm", "control algorithm"
- Atomic keywords = better coverage + more flexible matching
```

### 4. Added Full Working Example

**Lines 1106-1206**: Example 2.5 shows the complete process

Shows:
- ❌ WRONG extraction: `["提高", "无人驾驶汽车", "舒适性"]`
- ✅ CORRECT extraction: `["提高", "无人", "驾驶", "汽车", "舒适性"]`
- Full expansion for all 5 atomic keywords
- Result: 5 × 10 = 50 total keywords (much better coverage!)

### 5. Updated End-of-Prompt Rules

**Lines 1285-1294**: Reinforced at the end

```
⚠️ CRITICAL RULES:
- Extract ATOMIC keywords following language-specific length rules:
  * English: 1-2 words maximum
  * Chinese: 2-3 characters maximum
  * All languages: Break down compounds
- DO NOT extract overly long phrases!
```

## Expected Behavior After Fix

### For Query: "如何提高无人驾驶汽车舒适性？"

**Before (WRONG)**:
```json
{
  "coreKeywords": ["提高", "无人驾驶汽车", "舒适性"],
  "keywords": [
    // 3 keywords × 10 expansions = 30 total
  ]
}
```

**After (CORRECT)**:
```json
{
  "coreKeywords": ["提高", "无人", "驾驶", "汽车", "舒适性"],
  "keywords": [
    // 5 keywords × 10 expansions = 50 total
    // English: improve, enhance, boost, increase, raise,
    //          unmanned, driverless, autonomous, automated, crewless,
    //          driving, steering, piloting, operating, controlling,
    //          vehicle, car, automobile, auto, motor,
    //          comfort, comfortability, ease, pleasantness, coziness
    // 中文: 提高, 提升, 改善, 增强, 增进,
    //      无人, 自动, 自主, 智能, 无人化,
    //      驾驶, 操控, 控制, 操作, 驾驶,
    //      汽车, 车辆, 车, 轿车, 机动车,
    //      舒适性, 舒适度, 舒适, 安逸, 便利性
  ]
}
```

**Impact**:
- ✅ 67% more keywords (30 → 50)
- ✅ Each unit independently searchable
- ✅ Query "驾驶" matches ✓
- ✅ Query "汽车" matches ✓
- ✅ Query "自动驾驶" matches ✓
- ✅ Much better search coverage

## Language-Specific Guidelines

### English (1-2 words max)

| Query | Before | After |
|-------|--------|-------|
| "trajectory planning algorithm" | ["trajectory planning algorithm"] ❌ | ["trajectory", "planning", "algorithm"] ✅ |
| "AI powered plugin" | ["AI powered plugin"] ❌ | ["AI", "powered", "plugin"] ✅ |
| "autonomous vehicle control" | ["autonomous vehicle control"] ❌ | ["autonomous", "vehicle", "control"] ✅ |

### Chinese (2-3 chars max)

| Query | Before | After |
|-------|--------|-------|
| "无人驾驶汽车" | ["无人驾驶汽车"] (5 chars) ❌ | ["无人", "驾驶", "汽车"] (2+2+2) ✅ |
| "轨迹规划算法" | ["轨迹规划算法"] (6 chars) ❌ | ["轨迹", "规划", "算法"] (2+2+2) ✅ |
| "舒适性控制策略" | ["舒适性控制策略"] (7 chars) ❌ | ["舒适性", "控制", "策略"] (3+2+2) ✅ |
| "自动驾驶系统" | ["自动驾驶系统"] (6 chars) ❌ | ["自动", "驾驶", "系统"] (2+2+2) ✅ |

### Swedish (similar to English)

| Query | Before | After |
|-------|--------|-------|
| "bana planering algoritm" | ["bana planering algoritm"] ❌ | ["bana", "planering", "algoritm"] ✅ |
| "automatisk körning system" | ["automatisk körning system"] ❌ | ["automatisk", "körning", "system"] ✅ |

## Why This Matters

### 1. **Better Search Coverage**

**Atomic keywords** match more variations:
- "驾驶" matches: "无人驾驶", "自动驾驶", "驾驶员", "辅助驾驶", "驾驶系统"
- Compound "无人驾驶汽车" ONLY matches exact phrase

### 2. **Flexible Matching**

Users can search with any part of the compound:
- Query "汽车" → finds tasks with "无人驾驶汽车", "电动汽车", "汽车工业"
- Query "驾驶" → finds tasks with any driving-related content

### 3. **Cross-Language Consistency**

ALL languages now follow same atomic principle:
- English: 1-2 words
- Chinese: 2-3 characters
- Swedish: 1-2 words
- Any language: Break down compounds

### 4. **Language-Agnostic Approach**

Guidelines work for any configured language:
- Don't need to hardcode each language's rules
- AI applies atomic principle based on language structure
- Scales to new languages user adds

## Technical Implementation

### Changes Made

**File**: `/src/services/aiQueryParserService.ts`

**Sections Enhanced**:

1. **Lines 843-877**: Added comprehensive atomicity guidelines
   - English rules
   - Chinese rules with examples
   - All-language rules
   - Rationale and benefits

2. **Lines 1106-1206**: Added Example 2.5
   - Shows WRONG vs CORRECT extraction
   - Full step-by-step atomic keyword expansion
   - Demonstrates much better coverage

3. **Lines 1285-1294**: Updated end-of-prompt rules
   - References detailed guidelines
   - Reinforces atomic principle
   - Warns against long phrases

### Prompt Structure

```
1. CRITICAL FIELD USAGE RULES
   └─ Atomicity guidelines (NEW!)
      ├─ English: 1-2 words
      ├─ Chinese: 2-3 chars
      ├─ Other languages: Similar principle
      └─ Why it matters

2. Expansion algorithm
   └─ (Existing step-by-step instructions)

3. Examples
   ├─ Example 1: "开发 Task Chat"
   ├─ Example 2: "Fix bug"
   └─ Example 2.5: Chinese atomicity (NEW!)

4. End-of-prompt rules
   └─ Reinforced atomicity (UPDATED!)
```

## Testing

### Test Case 1: Chinese Compound Query

```
Query: "如何提高无人驾驶汽车舒适性？"
Languages: [English, 中文]
Max expansions: 5

Expected extraction:
- Core: ["提高", "无人", "驾驶", "汽车", "舒适性"]
- Total: 5 × 10 = 50 keywords
- Distribution: 25 English + 25 中文
```

### Test Case 2: Mixed Language Compound

```
Query: "Develop autonomous vehicle control algorithm"
Languages: [English, 中文]
Max expansions: 5

Expected extraction:
- Core: ["develop", "autonomous", "vehicle", "control", "algorithm"]
- Total: 5 × 10 = 50 keywords
```

### Test Case 3: Long Chinese Compound

```
Query: "轨迹规划算法优化"
Languages: [English, 中文]
Max expansions: 5

Expected extraction:
- Core: ["轨迹", "规划", "算法", "优化"]
- Total: 4 × 10 = 40 keywords
- Each 2-char unit independently searchable
```

### Verification

Check console logs for:
```
[Task Chat] AI query parser parsed:
{
  "coreKeywords": ["提高", "无人", "驾驶", "汽车", "舒适性"],  // ✓ Atomic!
  "keywords": [50 keywords],  // ✓ More coverage!
  ...
}
```

## Benefits Summary

### Before Fix
- ❌ English: Atomic (good)
- ❌ Chinese: Long compounds (bad)
- ❌ Other languages: No guidelines
- ❌ Inconsistent across languages
- ❌ Poor search coverage for compounds

### After Fix
- ✅ English: Atomic (1-2 words)
- ✅ Chinese: Atomic (2-3 chars)
- ✅ All languages: Clear atomic guidelines
- ✅ Consistent across all languages
- ✅ Much better search coverage
- ✅ Flexible matching for all query types

### Quantitative Impact

For typical Chinese compound query:
- **Before**: 3 core keywords → 30 expansions
- **After**: 5 atomic keywords → 50 expansions
- **Improvement**: **+67% keyword coverage**

For search matching:
- **Before**: Query "驾驶" → 0 matches (only searches full "无人驾驶汽车")
- **After**: Query "驾驶" → matches all tasks with "驾驶" component
- **Improvement**: **Unlimited additional matches** depending on task content

## Related Issues

This enhancement addresses similar issues for:
- Japanese: Break "自動運転システム" → ["自動", "運転", "システム"]
- Korean: Break compound Hangul phrases
- German: Break compounds like "Fahrzeugsteuerungssystem"
- Any language with compound words

The atomic principle applies universally!

## Status

✅ **COMPLETE** - Comprehensive atomicity guidelines implemented

**Files Modified**:
- `/src/services/aiQueryParserService.ts` (~120 lines added/modified)

**Documentation Created**:
- `/docs/dev/KEYWORD_ATOMICITY_ENHANCEMENT_2025-01-26.md` (this file)

**Next Steps**:
1. Build plugin: `npm run build`
2. Test with query: "如何提高无人驾驶汽车舒适性？"
3. Verify atomic extraction in console logs
4. Confirm better search coverage

---

**Thank you for the excellent observation!** Your feedback about Chinese keyword length revealed a fundamental issue that affects search quality for ALL compound-heavy languages. The atomic keyword principle now applies consistently across English, Chinese, and any other configured language. This will significantly improve search coverage and flexibility! 🎯
