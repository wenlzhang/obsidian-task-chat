# Consistency Improvements
## User Settings & Language Emphasis - January 23, 2025

## **User's Feedback** 🎯

> 1. "Use user's threshold setting (not hardcoded 70%)"
> 2. "Emphasize language settings throughout - be consistent everywhere"
> 3. "Simple Search should also track timeContext for consistency"

**All excellent points!** ✅

---

## **Improvement 1: Dynamic Threshold**

### **Problem:**
AI prompt used hardcoded 70% threshold for vague detection, but user can configure this!

**Before:**
```typescript
// AI Prompt (hardcoded)
"If 70%+ are generic words → isVague: true"

// Code (dynamic)
const threshold = settings.vagueQueryThreshold || 0.7;
```

**Inconsistent!** ❌

### **Solution:**
```typescript
// AI Prompt (NOW dynamic)
`If ${Math.round((settings.vagueQueryThreshold || 0.7) * 100)}%+ are generic words → isVague: true`

// Uses user's setting!
// If user sets 0.6 → "If 60%+ are generic..."
// If user sets 0.8 → "If 80%+ are generic..."
```

**Consistent!** ✅

### **Locations Updated:**

1. **Detection Strategy section** (line 989)
2. **Extraction Instructions section** (line 1022)

**Result:** AI now respects user's configured threshold!

---

## **Improvement 2: Language Settings Emphasis**

### **Problem:**
Language settings mentioned in some places but not consistently emphasized throughout prompt.

### **Solution:**
Added **4 prominent reminders** throughout the prompt:

#### **Reminder 1: After Expansion Settings** (line 509-516)
```
⚠️ LANGUAGE SETTINGS REMINDER:
Throughout this entire prompt, when we mention "ANY language" or "ALL languages", 
we are referring to the ${queryLanguages.length} languages configured by the user: ${languageList}

You MUST respect these language settings in:
- Keyword expansion (generate equivalents in ALL ${queryLanguages.length} languages)
- Time context detection (recognize terms in ALL ${queryLanguages.length} languages)
- Property recognition (detect properties in ALL ${queryLanguages.length} languages)
- Vague query detection (consider generic words in ALL ${queryLanguages.length} languages)
```

#### **Reminder 2: In Vague Detection Section** (line 952-953)
```
**CONFIGURED LANGUAGES:** You're working with ${queryLanguages.length} languages: ${languageList}
Recognize generic words and specific content in ALL these languages!
```

#### **Reminder 3: In Extraction Instructions** (line 1024-1025)
```
**LANGUAGE CONTEXT:** Configured languages: ${languageList}
Recognize time terms, properties, and keywords in ALL these languages!
```

#### **Reminder 4: In dueDate Extraction** (line 1027)
```
1. **Extract dueDate** - If query mentions time/deadlines in ANY of the ${queryLanguages.length} configured languages
```

### **Benefits:**

- **Consistent:** Every major section reminds AI of language settings
- **Clear:** "ALL languages" always means user's configured languages
- **Actionable:** Tells AI exactly what to do with each language
- **Dynamic:** Shows actual language count and list

---

## **Improvement 3: Simple Search Consistency**

### **Problem:**
Smart/Chat modes track `timeContext` but Simple Search didn't, causing inconsistency.

### **Before:**

**Smart/Chat:**
```typescript
{
  dueDate: "today",
  timeContext: "today"  // For metadata/logging
}
```

**Simple Search:**
```typescript
extractedDueDateFilter: "today"
// No timeContext tracking! ❌
```

### **After:**

**Simple Search (NOW):**
```typescript
let extractedDueDateFilter = this.extractDueDateFilter(query, settings);
let timeContext: string | string[] | null = extractedDueDateFilter; // Track for consistency!

// When converting for vague queries:
if (timeContextResult) {
    extractedDueDateRange = timeContextResult.range;
    extractedDueDateFilter = null;
    timeContext = timeContextResult.matchedTerm; // Keep timeContext updated!
}
```

### **Benefits:**

1. **Consistent Data Model:**
   - All modes track timeContext
   - Same field for same purpose
   - Easier debugging

2. **Better Logging:**
   ```
   [Simple Search] Time context: "today"
   [Smart Search] Time context: "today"
   [Task Chat] Time context: "today"
   ```

3. **Future-Proof:**
   - If we add features using timeContext
   - Works across all modes automatically

---

## **Summary of Changes**

### **AI Prompt (aiQueryParserService.ts):**

| Change | Location | Benefit |
|--------|----------|---------|
| Dynamic threshold | Lines 989, 1022 | Respects user setting ✅ |
| Language reminder #1 | Lines 509-516 | Clear scope ✅ |
| Language reminder #2 | Lines 952-953 | Vague detection context ✅ |
| Language reminder #3 | Lines 1024-1025 | Extraction context ✅ |
| Language reminder #4 | Line 1027 | Specific instruction ✅ |

### **Simple Search (taskSearchService.ts):**

| Change | Location | Benefit |
|--------|----------|---------|
| Track timeContext | Line 882 | Consistency ✅ |
| Update on conversion #1 | Line 977 | Keep in sync ✅ |
| Update on conversion #2 | Line 996 | Keep in sync ✅ |

---

## **Examples**

### **Example 1: Custom Threshold**

**User sets threshold to 0.6 (60%)**

**AI Prompt receives:**
```
If 60%+ are generic words → isVague: true
```

**Code uses:**
```typescript
const threshold = settings.vagueQueryThreshold; // 0.6
```

**Consistent!** ✅

### **Example 2: Language Emphasis**

**User configures: English, 中文**

**AI sees 4 times:**
1. "You're working with 2 languages: English, 中文"
2. "Recognize generic words in ALL 2 languages!"
3. "Configured languages: English, 中文"
4. "in ANY of the 2 configured languages"

**Clear expectations!** ✅

### **Example 3: Simple Search timeContext**

**Query:** "What should I do today?" (vague)

**Before:**
```typescript
extractedDueDateFilter: "today"
extractedDueDateRange: { operator: "<=", date: "today" }
// timeContext: undefined ❌
```

**After:**
```typescript
extractedDueDateFilter: null (cleared after conversion)
extractedDueDateRange: { operator: "<=", date: "today" }
timeContext: "today" ✅ (tracked!)
```

**Consistent with Smart/Chat!** ✅

---

## **Benefits**

### **For Users:**

- **Respected Settings:** Threshold works as configured
- **Clear Behavior:** Language settings consistently applied
- **Predictable:** All modes work the same way

### **For Developers:**

- **Maintainable:** Changes to threshold/languages propagate automatically
- **Debuggable:** timeContext logged consistently across modes
- **Consistent:** Same data model everywhere

### **For System:**

- **Accurate:** AI uses actual user settings, not hardcoded values
- **Extensible:** Adding features to timeContext works in all modes
- **Reliable:** Less room for inconsistency bugs

---

## **Files Modified**

| File | Change | Lines |
|------|--------|-------|
| `aiQueryParserService.ts` | Dynamic threshold | 2 locations |
| `aiQueryParserService.ts` | Language reminders | 4 additions |
| `taskSearchService.ts` | Track timeContext | +3 lines |
| `taskSearchService.ts` | Update timeContext | 2 locations |
| **Total** | | **~15 lines** |

---

## **Verification**

### **Test Case 1: Custom Threshold**

**Setup:** User sets `vagueQueryThreshold: 0.6`

**Query:** "What should I work on?"

**Expected:**
- AI prompt shows "If 60%+ are generic..."
- Code uses 0.6 threshold
- Both match! ✅

### **Test Case 2: Language Settings**

**Setup:** User configures 3 languages

**Expected:**
- 4 reminders throughout prompt
- All mention "3 languages"
- All list same languages ✅

### **Test Case 3: Simple Search timeContext**

**Query:** "today tasks" (vague)

**Expected:**
```
timeContext: "today" (initial)
→ Convert to range
timeContext: "today" (preserved)
dueDateRange: { operator: "<=", date: "today" }
```

**Consistent with Smart/Chat!** ✅

---

## **Status**

✅ **COMPLETE** - All three improvements implemented:

1. ✅ Dynamic threshold - Respects user settings
2. ✅ Language emphasis - Consistent throughout prompt
3. ✅ timeContext tracking - Consistent across all modes

**System is now more consistent, respects user settings everywhere, and has unified data model!** 🎉

---

**Thank you for the excellent feedback that improved consistency across the entire system!** 🙏
