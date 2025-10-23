# AI Prompt Simplification
## Removing Repetition - January 23, 2025

## **User's Feedback** 🎯

> "This part feels repetitive with other sections. The due date and time context instructions are repeated multiple times. Also, the JSON schema applies to ALL queries (both generic and non-generic), not just generic - this should be clarified."

**User is 100% CORRECT!** The prompt had significant repetition that made it harder to understand.

---

## **Problems Identified**

### **1. Repetitive Time Context Section** ❌

**Before:**
```
**DUE DATE & TIME CONTEXT DETECTION:**
[40+ lines of instructions]

**UNIFIED APPROACH (for ALL queries):**
- Extract dueDate when query mentions time/deadlines
- ALSO set aiUnderstanding.timeContext (for metadata)
- External code will convert dueDate to dueDateRange for vague queries only

**When to extract dueDate:**
[10+ lines]

**When NOT to extract dueDate:**
[5+ lines]

**KEY PRINCIPLE - Semantic Date Detection:**
[10+ lines]

**EXAMPLES:**
[6 examples with full explanations = 40+ lines]
```

**Total:** ~100 lines just for time context!

### **2. Repeated Instructions After JSON** ❌

**Before:**
```
} // End of JSON schema

⚠️ CRITICAL: 
- Extract dueDate if query mentions time/deadlines
- ALSO set timeContext (same value, for metadata)
- External code converts for vague queries only:
  * If isVague = true → ...
  * If isVague = false → ...
```

**Problem:** These instructions were already stated 40 lines earlier!

### **3. Unclear JSON Scope** ❌

**Before:**
```
🚨 CRITICAL JSON FORMAT RULES:
```

**Problem:** Not clear this applies to ALL queries (vague AND specific)

---

## **The Simplification**

### **1. Reduced Time Context Section** ✅

**After:**
```
**EXTRACTION INSTRUCTIONS:**

1. **Extract dueDate** - If query mentions time/deadlines in ANY language
   - Recognize: today/今天/idag, tomorrow/明天/imorgon, this week/本周/denna vecka
   - Examples: "tasks due today", "What can I do today?", "Fix bug tomorrow"
   - Set: dueDate = "today" (external code converts if vague)
   
2. **Set timeContext** - Same as dueDate, for metadata/logging
   - Always set when time word detected
   - Used for debugging, not filtering

3. **Determine isVague** - Analyze coreKeywords AFTER extraction
   - If 70%+ are generic words → isVague: true
   - If most are specific content → isVague: false
   - Time context alone doesn't make it specific!
```

**Result:** 15 lines instead of 100 lines! **85% reduction!** ✅

### **2. Removed Repetitive Instructions** ✅

**After:**
```
} // End of JSON schema

🚨 JSON FORMAT RULES (applies to ALL queries - vague AND specific):
- JSON does NOT support comments...
```

**Result:** No repetition of extraction logic!

### **3. Clarified JSON Scope** ✅

**After:**
```
🚨 JSON FORMAT RULES (applies to ALL queries - vague AND specific):
```

**Result:** Clear that this applies to everything!

---

## **Comparison**

| Section | Before | After | Reduction |
|---------|--------|-------|-----------|
| **Time Context** | ~100 lines | ~15 lines | 85% ✅ |
| **Examples** | 6 examples | 0 (moved earlier) | 100% ✅ |
| **Post-JSON Instructions** | ~10 lines | 0 (removed) | 100% ✅ |
| **JSON Scope** | Unclear | Clear | N/A ✅ |
| **Total Lines** | ~1200 | ~1100 | ~8% ✅ |

---

## **What Was Kept**

### **Essential Instructions:**

1. ✅ **Extract dueDate** - Brief, clear instruction
2. ✅ **Set timeContext** - Purpose clearly stated (metadata)
3. ✅ **Determine isVague** - Simple rule (70% threshold)
4. ✅ **JSON Format Rules** - Critical for valid output
5. ✅ **Field Usage Rules** - How to use each field

### **Examples (Moved Earlier):**

All time context examples were already present in the **VAGUE QUERY DETECTION** section (lines 990-1008). No need to repeat them!

---

## **Benefits**

### **1. Clearer Mental Model** ✅

**Before:**
- Time context mentioned 3 times (redundant)
- Examples scattered throughout
- Unclear when each instruction applies

**After:**
- Each concept mentioned once (clear)
- Examples grouped logically
- Clear scope for each section

### **2. Easier to Maintain** ✅

**Before:**
- Update instructions in 3 places
- Keep examples in sync
- Risk of contradictions

**After:**
- Update once (single source of truth)
- Examples in one place
- Consistent message

### **3. Reduced AI Confusion** ✅

**Before:**
- Conflicting instructions? (repeated differently)
- Which to follow?
- Over-emphasis on time context

**After:**
- Clear, single instruction
- No ambiguity
- Balanced coverage

### **4. Better Prompt Efficiency** ✅

**Before:**
- ~100 lines for time context
- ~10 lines repeated after JSON
- Wasted tokens

**After:**
- ~15 lines for time context
- No repetition
- More efficient

---

## **Prompt Structure (After)**

```
1. VAGUE QUERY DETECTION (lines 940-1008)
   - What makes query vague
   - Generic word categories
   - Detection strategy
   - Examples (vague AND specific)
   
2. EXTRACTION INSTRUCTIONS (lines 1010-1024)
   - Extract dueDate (brief)
   - Set timeContext (purpose)
   - Determine isVague (rule)
   
3. JSON SCHEMA (lines 1026-1049)
   - Complete structure
   - All fields defined
   
4. JSON FORMAT RULES (lines 1051-1056)
   - Valid JSON requirements
   - Applies to ALL queries
   
5. FIELD USAGE RULES (lines 1058+)
   - How to use each field
   - Specific examples
```

**Flow:** Detect vague → Extract fields → Return JSON

**Clear, logical, no repetition!** ✅

---

## **JSON Scope Clarification**

### **User's Question:**
> "Is the JSON part used for both generic and non-generic cases, or only for generic?"

### **Answer:** ✅ **BOTH!**

The JSON schema applies to **ALL queries:**

**Vague queries:**
```json
{
  "dueDate": "today",
  "isVague": true,
  "keywords": [],
  "timeContext": "today"
}
```

**Specific queries:**
```json
{
  "dueDate": "today",
  "isVague": false,
  "keywords": ["API", "project"],
  "timeContext": "today"
}
```

**Only difference:** `isVague` flag and keywords presence

**Everything else is the same!** ✅

---

## **Why This Matters**

### **1. AI Performance**

**Shorter prompts:**
- Faster processing
- Lower cost
- Better focus

**Clearer instructions:**
- Better compliance
- Fewer errors
- More reliable output

### **2. Maintainability**

**Single source of truth:**
- Update once
- No sync issues
- Consistent behavior

**Clear structure:**
- Easy to find sections
- Logical flow
- Better organization

### **3. User Understanding**

**Documentation that matches:**
- Prompt reflects reality
- No contradictions
- Clear expectations

---

## **Implementation**

### **Files Modified:**

| File | Change | Lines |
|------|--------|-------|
| `aiQueryParserService.ts` | Removed time context section | -85 |
| `aiQueryParserService.ts` | Removed post-JSON instructions | -10 |
| `aiQueryParserService.ts` | Clarified JSON scope | +1 |
| **Net Change** | | **-94 lines** ✅ |

### **What Changed:**

1. ✅ Removed 100-line time context section
2. ✅ Removed 10-line post-JSON instructions
3. ✅ Added brief extraction instructions (15 lines)
4. ✅ Clarified JSON applies to ALL queries

**Net:** ~94 lines removed, prompt cleaner!

---

## **Verification**

### **Test Cases:**

All should return same JSON structure:

1. **Vague + time:**
   ```
   "What should I do today?"
   → dueDate: "today", isVague: true
   ```

2. **Specific + time:**
   ```
   "Tasks due today"
   → dueDate: "today", isVague: false
   ```

3. **Vague, no time:**
   ```
   "What should I work on?"
   → dueDate: null, isVague: true
   ```

4. **Specific, no time:**
   ```
   "Fix authentication bug"
   → dueDate: null, isVague: false
   ```

**All use same JSON schema!** ✅

---

## **Summary**

### **User's Feedback:**

1. ✅ **Repetition removed** - Time context not repeated 3 times
2. ✅ **JSON scope clarified** - Applies to ALL queries
3. ✅ **Instructions consolidated** - Single source of truth
4. ✅ **Examples organized** - Grouped logically, not scattered

### **Benefits:**

- **Clearer:** No repetition or confusion
- **Shorter:** ~94 lines removed (~8% reduction)
- **Efficient:** Better token usage
- **Maintainable:** Update once, not multiple times

### **Result:**

**Much cleaner, clearer prompt that's easier to understand and maintain!** 🎉

---

**Thank you for the excellent feedback that led to this significant improvement!** 🙏
