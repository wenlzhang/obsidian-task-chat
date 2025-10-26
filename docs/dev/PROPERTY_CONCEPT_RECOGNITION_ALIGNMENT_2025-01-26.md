# Property Concept Recognition Alignment - January 26, 2025

## Summary

Improved prompts across three core services to clearly distinguish between **property recognition (direct concept identification)** and **keyword expansion (semantic expansion)**. All files now consistently emphasize that the AI should use its native multilingual understanding to recognize property concepts directly, rather than relying on term matching.

---

## Core Principle

### ⚠️ CRITICAL DISTINCTION

**PROPERTIES: Direct Concept Recognition (NO Expansion)**
- Use AI's native multilingual understanding
- Recognize concepts semantically in ANY language
- Convert directly to category keys
- Term lists are REFERENCE EXAMPLES, not requirements

**KEYWORDS: Semantic Expansion (YES Expansion)**
- Generate semantic equivalents across ALL configured languages
- Expand EACH keyword independently
- Include synonyms, related terms, variations
- Maximize recall for task matching

---

## Files Modified

### 1. taskPropertyService.ts

**What was added:** Comprehensive class-level documentation (75 lines)

**Location:** Lines 31-105

**Key sections:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: Property Recognition vs Keyword Expansion
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ PROPERTIES: Direct Concept Recognition (NO Expansion)
- Use AI's native multilingual understanding to recognize CONCEPTS
- Convert directly to category keys (e.g., "inProgress", 1, "overdue")
- Term lists are REFERENCE EXAMPLES, not exhaustive requirements

⚠️ KEYWORDS: Semantic Expansion (YES Expansion)
- Generate semantic equivalents across ALL configured languages
- Expand EACH keyword independently for better matching
```

**Purpose:**
- Single source of truth for the concept recognition approach
- Explains why this distinction matters (precision vs recall)
- Clarifies how term lists should be used in AI prompts
- Provides examples of both approaches

---

### 2. aiPromptBuilderService.ts

#### A. Enhanced buildPropertyTermGuidance() Method

**Location:** Lines 473-585

**Before (old approach):**
```typescript
LAYER 1: User-Configured Terms (Highest Priority)
- Priority: [list]
LAYER 2: Base Terms (Built-in, Multilingual)
- Priority: [list]
LAYER 3: Native Language Understanding (You provide this!)
```

**After (new approach):**
```typescript
⚠️ CRITICAL DISTINCTION:
- **PROPERTIES**: Use DIRECT CONCEPT RECOGNITION → Convert to category keys (NO expansion)
- **KEYWORDS**: Use SEMANTIC EXPANSION → Generate equivalents across languages (YES expansion)

🎯 PRIMARY MECHANISM: Your Native Multilingual Understanding (LAYER 3)

**HOW TO RECOGNIZE PROPERTY CONCEPTS:**

1. **PRIORITY Concept** = Any expression of urgency, importance, criticality
   - Understand the MEANING, not just match words
   - Examples you already understand naturally:
     * English: urgent, critical, important, high priority, asap, can wait
     * 中文: 紧急, 重要, 优先, 关键, 不急
     * Svenska: brådskande, viktigt, prioritet, kan vänta
     * ANY language - use your native comprehension!

📚 REFERENCE LAYERS (Context & Aliases - NOT for term matching!)
These layers provide CONTEXT and EXAMPLES, but your primary tool is native understanding.
```

**Key improvements:**
- **Reframed layers**: Layer 3 (native understanding) is now PRIMARY, not tertiary
- **Emphasized concept over terms**: "Understand the MEANING, not just match words"
- **Cross-language examples**: Shows concepts work in ANY language
- **Clear warning**: Term lists are HINTS, not REQUIREMENTS
- **Explicit workflow**: 4-step process from concept recognition to conversion

#### B. Enhanced buildStatusMapping() Method

**Location:** Lines 207-290

**Before (old approach):**
```typescript
⚠️ Use your NATIVE LANGUAGE UNDERSTANDING to recognize status concepts
NO expansion needed - recognize concepts directly

RECOGNITION EXAMPLES:
- "open" → status: "open" ✅
- "open tasks" → status: "open" ✅
```

**After (new approach):**
```typescript
⚠️ CRITICAL: Use DIRECT CONCEPT RECOGNITION, not term matching!

Your task: Recognize task STATE/PROGRESS concepts in ANY language → Convert to category keys

🔄 CONCEPT RECOGNITION PROCESS:

Step 1: Understand what task STATE the user is asking about
   - NOT started yet? → Likely "open" concept
   - Currently working on? → Likely "inprogress" concept

Step 2: Use YOUR NATIVE MULTILINGUAL UNDERSTANDING
   - Recognize the STATUS concept in ANY language
   - Examples you understand naturally:
     * English: "in progress", "working on", "doing", "active"
     * 中文: "进行中", "正在做", "处理中"
     * Deutsch: "in Arbeit", "läuft"
     * ANY language - trust your understanding!

Step 3: Convert to the matching category key
   - Map recognized concept → category key from list above

Cross-language examples:
- "進行中のタスク" (Japanese - in-progress tasks) → status: "inprogress"
- "tâches en cours" (French - tasks in progress) → status: "inprogress"
- "незавершенные задачи" (Russian - incomplete tasks) → status: "open"
```

**Key improvements:**
- **Step-by-step process**: Clear workflow from understanding to conversion
- **Concept-first approach**: Focus on WHAT state, not which words
- **Cross-language validation**: Examples in languages NOT in base terms
- **Trust emphasis**: "Trust your understanding" - don't rely on lists
- **Semantic hints**: "Display names and terms are REFERENCE EXAMPLES"

---

### 3. aiQueryParserService.ts

**Status:** Already well-aligned, no changes needed

**Existing good structure (lines 560-634):**
```typescript
⚠️ CRITICAL PRINCIPLE: Properties use CONCEPT RECOGNITION and CONVERSION!

Unlike keywords (which need semantic expansion for better recall), 
task properties use your native language understanding to:
1. Recognize the concept (STATUS, PRIORITY, DUE_DATE) in ANY language
2. Convert directly to Dataview-compatible format

NO expansion needed - you already understand all languages!

⚠️ KEY POINTS:
- Properties = concept recognition + direct conversion (NO expansion)
- Keywords = semantic expansion across languages (YES expansion)
- You already know all languages - use native understanding
```

---

## Alignment Verification

### Common Themes Across All Three Files

✅ **Consistent messaging:**
- Properties use DIRECT concept recognition
- Keywords use SEMANTIC expansion
- Term lists are REFERENCE/EXAMPLES
- Native understanding is PRIMARY mechanism

✅ **Clear workflow:**
1. Recognize concept in ANY language
2. Convert to category key
3. Separate from content keywords
4. Expand keywords semantically

✅ **Cross-language emphasis:**
- All files show examples in multiple languages
- All files emphasize "ANY language, not just listed"
- All files provide examples beyond configured languages

✅ **Trust in AI:**
- Don't rely on term matching
- Use native multilingual training
- Understand MEANING, not just match words

---

## Why This Matters

### For Property Recognition

**OLD: Term Matching Approach**
```
Query: "très urgent" (French - very urgent)
❌ Not in term list → Skip or fail
```

**NEW: Concept Recognition Approach**
```
Query: "très urgent" (French - very urgent)
✅ Recognize PRIORITY concept → priority: 1
```

### For Keyword Expansion

**CORRECT: Semantic Expansion**
```
Keyword: "bug"
✅ Expand: ["bug", "error", "issue", "defect", "错误", "问题", "bugg", "fel", ...]
```

**WRONG: Would be term matching**
```
Keyword: "bug"
❌ Just: ["bug"]
```

---

## Technical Architecture

### Property Recognition Flow

```
User query (ANY language)
    ↓
AI recognizes CONCEPT semantically
    ↓
Convert to category key
    - PRIORITY → 1, 2, 3, or 4
    - STATUS → "open", "inProgress", etc.
    - DUE_DATE → "today", "overdue", etc.
    ↓
Structured filter (NO expansion)
```

### Keyword Expansion Flow

```
User query (ANY language)
    ↓
Extract content keywords
    ↓
For EACH keyword:
    Generate semantic equivalents in ALL languages
    ↓
Expanded keyword array
    ↓
Use for task matching (YES expansion)
```

---

## Examples Demonstrating Alignment

### Example 1: Russian Query (not in configured languages)

**Query:** "срочные задачи которые просрочены" (urgent tasks that are overdue)

**Property Recognition (direct concept):**
- "срочные" → Recognize PRIORITY concept → priority: 1 ✅
- "просрочены" → Recognize DUE_DATE concept → dueDate: "overdue" ✅

**Keyword Expansion (semantic):**
- "задачи" → ["task", "work", "item", "任务", "工作", "uppgift", ...] ✅

### Example 2: Mixed Language Query

**Query:** "urgent bug修复 pågående" (English + Chinese + Swedish)

**Property Recognition:**
- "urgent" → PRIORITY concept → priority: 1 ✅
- "pågående" → STATUS concept → status: "inProgress" ✅

**Keyword Expansion:**
- "bug" → ["bug", "error", "issue", "错误", "问题", "bugg", ...] ✅
- "修复" → ["fix", "repair", "solve", "修复", "解决", "fixa", ...] ✅

### Example 3: Natural Language Variations

**Query 1:** "very important unfinished work"
- "very important" → PRIORITY concept → priority: 1 ✅
- "unfinished" → STATUS concept → status: "open" ✅

**Query 2:** "super urgent stuff not done yet"
- "super urgent" → PRIORITY concept → priority: 1 ✅
- "not done yet" → STATUS concept → status: "open" ✅

Both work despite different phrasing!

---

## Benefits

### For Users

✅ **More flexible queries**: Natural language works in ANY language
✅ **Cross-language support**: Not limited to configured languages
✅ **Better understanding**: AI uses semantic comprehension, not pattern matching
✅ **Consistent behavior**: Same approach across all services

### For Developers

✅ **Clearer architecture**: Sharp distinction between two approaches
✅ **Better maintainability**: Single source of truth (taskPropertyService.ts)
✅ **No hardcoding**: No need to add languages manually
✅ **Leverages AI**: Uses native capabilities, not pre-programmed rules

### For the System

✅ **More accurate**: Recognizes concepts, not just exact phrases
✅ **More robust**: Handles variations, typos, natural language
✅ **More scalable**: Works for 100+ languages automatically
✅ **Future-proof**: No code changes needed for new languages

---

## Implementation Notes

### No Breaking Changes

- All existing queries continue to work
- Backward compatible with term lists
- Enhanced functionality, not replaced functionality
- Term lists still useful as examples and hints

### Improved Prompt Structure

**Before:**
- Term lists presented as THE way to recognize properties
- Three layers but unclear which was primary
- Examples mostly in configured languages
- Didn't emphasize concept over terms

**After:**
- Native understanding presented as PRIMARY mechanism
- Term lists explicitly marked as REFERENCE/EXAMPLES
- Cross-language examples showing universality
- Clear emphasis on concept recognition
- Step-by-step workflow

---

## Testing Recommendations

### Test Cases to Verify Alignment

1. **Cross-language property recognition**
   - Query in languages NOT configured (French, Russian, Arabic, etc.)
   - Verify properties recognized correctly
   - Verify keywords still expanded in configured languages

2. **Natural language variations**
   - "very urgent" vs "super important" vs "critical"
   - "working on" vs "in progress" vs "doing"
   - "overdue" vs "late" vs "past due"
   - All should map to same category keys

3. **Mixed language queries**
   - Combine multiple languages in one query
   - Verify properties recognized regardless of language
   - Verify keywords expanded across all configured languages

4. **Edge cases**
   - Typos in property terms (should still recognize concept)
   - Synonyms not in term lists (should still work)
   - Cultural variations (e.g., "muy urgente" in Spanish)

---

## Success Criteria

✅ **Consistency**: All three files emphasize concept recognition
✅ **Clarity**: Clear distinction between properties (direct) and keywords (expand)
✅ **Examples**: Cross-language examples in all prompts
✅ **Documentation**: Comprehensive explanation in taskPropertyService.ts
✅ **Workflow**: Step-by-step process clearly defined
✅ **Trust**: Emphasize native understanding over term matching

---

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| taskPropertyService.ts | +75 lines | Added comprehensive documentation |
| aiPromptBuilderService.ts | ~200 lines modified | Enhanced two key methods |
| aiQueryParserService.ts | No changes | Already well-aligned |

**Total impact:** ~275 lines of improved documentation and prompts

---

## Conclusion

All three files are now properly aligned with a consistent message:

**For properties:** Use your native multilingual understanding to recognize CONCEPTS directly in ANY language, then convert to category keys. Term lists are reference examples, not requirements.

**For keywords:** Generate semantic equivalents across ALL configured languages to maximize recall.

This distinction is now crystal clear throughout the codebase, with comprehensive documentation in taskPropertyService.ts serving as the single source of truth.

The system now properly leverages AI's native capabilities for property recognition while maintaining semantic expansion for keywords - the best of both worlds!
