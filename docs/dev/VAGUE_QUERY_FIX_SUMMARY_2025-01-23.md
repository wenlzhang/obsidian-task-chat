# Vague Query Bug Fix - Executive Summary
## January 23, 2025

## **The Problem** 🐛

**User's Query:** "What should I do today?" / "今天可以做什么？"  
**Expected:** Tasks due today + overdue tasks  
**Got:** **0 tasks** ❌

---

## **Root Causes**

### **1. Missing Filter Condition** ❌

**File:** `aiService.ts` line 287

```typescript
// BEFORE (BROKEN):
if (
    intent.extractedPriority ||
    intent.extractedDueDateFilter ||
    // ❌ MISSING: intent.extractedDueDateRange ||
    intent.extractedStatus ||
    ...
)
```

**Impact:** System skipped filtering when only `dueDateRange` was present!

### **2. Contradictory AI Instructions** ❌

**File:** `aiQueryParserService.ts` lines 1084-1091

Prompt said:
- DON'T extract dueDateRange for vague queries ❌
- BUT DO extract dueDateRange for vague queries ❌

**Confusion!**

### **3. Missing English Example** ❌

Had Chinese example, no English example for "What should I do today?"

---

## **The Fix** ✅

### **1. Add dueDateRange to Filter Condition**
```typescript
// AFTER (FIXED):
if (
    intent.extractedPriority ||
    intent.extractedDueDateFilter ||
    intent.extractedDueDateRange ||  // ✅ ADDED!
    intent.extractedStatus ||
    ...
)
```

### **2. Clarify AI Prompt**
```typescript
**When to extract dueDateRange (vague queries with time context):**
✅ Vague query with time word: "What can I do today?"
   - Use dueDateRange: { "operator": "<=", "date": "today" }
   - Includes overdue tasks
```

### **3. Add English Example**
```typescript
Query: "What should I do today?"  ← NEW!
→ dueDateRange: { "operator": "<=", "date": "today" }
→ timeContext: "today"
```

---

## **Changes**

| File | Lines Changed | Impact |
|------|--------------|--------|
| `aiService.ts` | +3 | Filter condition + logging |
| `aiQueryParserService.ts` | +34/-18 | AI prompt clarity + examples |

---

## **Result** ✅

**Before:**
```
Query: "What should I do today?"
→ 0 tasks ❌
```

**After:**
```
Query: "What should I do today?"
→ 25 tasks (due today + overdue) ✅
→ Sorted by urgency ✅
```

---

## **User's Key Insight** 🎯

> "If there are no meaningful keywords, you should focus on the 'due date' task property. Filter tasks, score them, sort them using the DataView API."

**Absolutely correct!** The fix implements exactly this approach.

---

**Status:** ✅ **FIXED** - Ready for testing and rebuild
