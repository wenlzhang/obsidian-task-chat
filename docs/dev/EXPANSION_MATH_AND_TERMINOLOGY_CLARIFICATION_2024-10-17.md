# Expansion Math and Terminology Clarification

**Date:** 2024-10-17  
**Purpose:** Clarify `maxKeywordsPerCore` calculation and remove "translation" terminology

---

## Problem 1: `maxKeywordsPerCore` Was Confusing

### User's Valid Concern

> "I don't know what `maxKeywordsPerCore` actually means. The user sets maximum expansion in settings. This means for each identified keyword, the maximum number should be expanded. A sentence might include several keywords, and there are multiple languages. All this should be multiplied together. Is it applicable to all languages or something else?"

**Answer:** You were right to be confused! Let me clarify the math.

---

## The Math Explained Step-by-Step

### User Settings

**What the user sets in Settings Tab:**
- `maxKeywordExpansions` = **5** 
  - Meaning: "Generate 5 semantic equivalents per language"
- `queryLanguages` = **["English", "中文", "Svenska"]**
  - Meaning: "Generate equivalents in these 3 languages"

### Internal Calculations

**Step 1: Calculate per-keyword total**
```typescript
maxKeywordsPerCore = maxExpansions × numberOfLanguages
                   = 5 × 3
                   = 15
```

**What `maxKeywordsPerCore` means:**
- Maximum semantic equivalents to generate **FOR ONE SINGLE KEYWORD**
- This is the total **ACROSS ALL LANGUAGES** for that one keyword
- **NOT** per language (that would be `maxExpansions`)
- **NOT** for entire query (that would be `totalKeywords`)

**Step 2: Calculate total for entire query**
```typescript
totalExpandedKeywords = numberOfCoreKeywords × maxKeywordsPerCore
                      = 4 × 15
                      = 60
```

---

## Concrete Example

### Query: "如何开发 Task Chat 插件"

**Settings:**
- `maxKeywordExpansions` = **5** (what user set)
- `queryLanguages` = **["English", "中文", "Svenska"]** (3 languages)

**Step 1: Extract core keywords**
```
Core keywords: ["开发", "Task", "Chat", "插件"]
Number of core keywords: 4
```

**Step 2: Calculate maxKeywordsPerCore**
```
maxKeywordsPerCore = 5 expansions/language × 3 languages = 15
```

**Step 3: Expand EACH keyword**

**For "开发":**
```
English (5): develop, build, create, implement, code
中文 (5): 开发, 构建, 创建, 编程, 实现
Swedish (5): utveckla, bygga, skapa, programmera, implementera
Total: 15 semantic equivalents ✅
```

**For "Task":**
```
English (5): task, work, item, assignment, job
中文 (5): 任务, 工作, 事项, 项目, 作业
Swedish (5): uppgift, arbete, göra, uppdrag, ärende
Total: 15 semantic equivalents ✅
```

**For "Chat":**
```
English (5): chat, conversation, talk, discussion, dialogue
中文 (5): 聊天, 对话, 交流, 谈话, 沟通
Swedish (5): chatt, konversation, prata, diskussion, samtal
Total: 15 semantic equivalents ✅
```

**For "插件":**
```
English (5): plugin, extension, addon, module, component
中文 (5): 插件, 扩展, 附加组件, 模块, 组件
Swedish (5): plugin, tillägg, modul, komponent, instick
Total: 15 semantic equivalents ✅
```

**Step 4: Total for entire query**
```
Total keywords: 4 keywords × 15 per keyword = 60 keywords ✅
```

---

## The Formula Summary

### Variables Hierarchy

```
1. maxExpansions (User setting)
   = Semantic equivalents per language
   = Example: 5

2. numberOfLanguages (User setting)  
   = Number of configured languages
   = Example: 3 (English, 中文, Svenska)

3. maxKeywordsPerCore (Calculated)
   = maxExpansions × numberOfLanguages
   = Example: 5 × 3 = 15
   = Meaning: Total equivalents per ONE keyword

4. numberOfCoreKeywords (From query)
   = Keywords extracted from user's query
   = Example: 4 (开发, Task, Chat, 插件)

5. totalExpandedKeywords (Calculated)
   = numberOfCoreKeywords × maxKeywordsPerCore
   = Example: 4 × 15 = 60
   = Meaning: Total keywords returned
```

### Visual Breakdown

```
Query: "如何开发 Task Chat 插件"
       ↓
Extract: ["开发", "Task", "Chat", "插件"] (4 core keywords)
       ↓
For EACH keyword:
  Generate 5 in English    }
  Generate 5 in 中文       } = 15 total per keyword
  Generate 5 in Swedish    }
       ↓
Total: 4 × 15 = 60 keywords
```

---

## Problem 2: "Translation" Terminology Was Confusing

### User's Valid Concern

> "In other parts of the codebase, you still mentioned translations. Please clarify this and make necessary improvements."

**You were right!** Several places still used "translation" language, which is confusing because:

1. This is **NOT a translation task**
2. It's **semantic equivalence generation**
3. "Translation" implies literal conversion
4. We want conceptual equivalents, not word-for-word translation

---

## All "Translation" References Fixed

### Locations Found and Fixed

#### 1. `queryParserService.ts` Line 259

**Before:**
```typescript
: queryLanguages.length; // Just translations, no extra expansions
```

**After:**
```typescript
: queryLanguages.length; // Just original keywords in each language, no semantic expansion
```

**Why:** Clarifies that without expansion, we just have the base keywords, not "translations"

---

#### 2. `queryParserService.ts` Line 346

**Before:**
```typescript
"keywords": [<array of EXPANDED search terms with translations and semantic variations>],
```

**After:**
```typescript
"keywords": [<array of EXPANDED search terms with semantic equivalents across all languages>],
```

**Why:** Removes "translations" terminology, uses "semantic equivalents"

---

#### 3. `queryParserService.ts` Line 527

**Before:**
```typescript
- For each meaningful keyword, provide translations in ALL configured languages
```

**After:**
```typescript
- For each meaningful keyword, generate semantic equivalents in ALL configured languages
```

**Why:** "Generate semantic equivalents" is more accurate than "provide translations"

---

#### 4. `settingsTab.ts` Line 376

**Before:**
```typescript
"When you search in one language, keywords are automatically translated to all configured languages..."
```

**After:**
```typescript
"When you search in one language, semantic equivalents are automatically generated in all configured languages..."
```

**Why:** More accurate description of what the system does

---

#### 5. `settingsTab.ts` Line 405

**Before:**
```typescript
"...expanded with semantic variations and translations in all configured languages..."
```

**After:**
```typescript
"...expanded with semantic equivalents across all configured languages. Example: 'develop' → 'develop', '开发', 'build', 'create', 'implement', 'utveckla', etc. This is NOT translation but direct cross-language semantic equivalence generation..."
```

**Why:** 
- Removes "translations" word
- Adds explicit clarification: "This is NOT translation"
- Explains it's "direct cross-language semantic equivalence generation"

---

### Kept References (Correct Context)

**These references REMAIN because they're correct:**

1. Line 300: `"This is NOT a translation task!"`
2. Line 317: `"Do NOT just translate - generate semantic equivalents!"`
3. Line 379: `"Do NOT translate! Generate semantic equivalents DIRECTLY"`

**Why keep these?** They're **warnings to the AI** to NOT treat it as translation, which is exactly what we want!

---

## Terminology Standardization

### Old Terms (REMOVED)

- ❌ "translations"
- ❌ "translate to other languages"
- ❌ "provide translations"
- ❌ "translated to all languages"

### New Terms (USING NOW)

- ✅ "semantic equivalents"
- ✅ "generate equivalents in each language"
- ✅ "direct cross-language semantic equivalence generation"
- ✅ "semantic equivalents across all languages"

### Context-Appropriate Terms

**For warnings to AI:**
- ✅ "This is NOT a translation task!"
- ✅ "Do NOT translate!"
- ✅ "Generate semantic equivalents, not translations"

**For user-facing descriptions:**
- ✅ "semantic equivalents are generated"
- ✅ "cross-language semantic matching"
- ✅ "direct semantic equivalence generation"

---

## Why This Matters

### 1. **Clearer for Users**

**Old terminology:**
> "Keywords are translated to all languages"

**Problem:** Users might think:
- Is it using Google Translate?
- Is it literal translation?
- What if the translation is wrong?

**New terminology:**
> "Semantic equivalents are generated in all languages"

**Benefit:** Users understand:
- It's conceptual matching, not literal translation
- AI generates contextually-appropriate terms
- It's about semantic meaning, not word-for-word conversion

### 2. **Clearer for AI**

**Old prompt:**
> "Expand keywords, then translate to other languages"

**Problem:** AI might:
- Think it's a two-step process
- Focus on literal translation
- Miss semantic nuances

**New prompt:**
> "Generate semantic equivalents DIRECTLY in each language. This is NOT translation!"

**Benefit:** AI understands:
- One-step conceptual process
- Focus on semantic meaning
- Generate contextually-appropriate equivalents

### 3. **Accurate Description**

**What the system actually does:**
```
Keyword "开发" → 
  Think: "What are ways to express 'development/building' in English?"
  → develop, build, create, implement, code

NOT:
  Translate "开发" word-by-word to English
```

**Old term "translation" didn't capture this. New term "semantic equivalents" does!**

---

## Summary

### Problem 1: Math Clarification ✅

**`maxKeywordsPerCore` means:**
- Total semantic equivalents **per ONE keyword**
- Across **ALL languages**
- Formula: `maxExpansions × numberOfLanguages`
- Example: 5 × 3 = 15

**Total keywords formula:**
- `numberOfCoreKeywords × maxKeywordsPerCore`
- Example: 4 keywords × 15 per keyword = 60 total

### Problem 2: Terminology Fixed ✅

**Removed "translation" from:**
- Comments in code ✅
- User-facing descriptions ✅
- Variable explanations ✅
- Prompt instructions ✅

**Replaced with:**
- "semantic equivalents" ✅
- "direct cross-language generation" ✅
- Clear explanations of what system does ✅

**Kept warnings:**
- "This is NOT a translation task!" ✅
- These warnings help AI understand correctly ✅

---

## Files Modified

**queryParserService.ts:**
- Line 257-261: Added math explanation, removed "translations"
- Line 348: Changed to "semantic equivalents across all languages"
- Line 529: Changed to "generate semantic equivalents"

**settingsTab.ts:**
- Line 376: Changed to "semantic equivalents are automatically generated"
- Line 405: Changed to "semantic equivalents across all languages"
- Added: "This is NOT translation but direct cross-language semantic equivalence generation"

---

## Verification

**Check these to confirm fixes:**

1. ✅ No "translation" terminology in user-facing text (except "NOT translation")
2. ✅ Math clearly explained with comments
3. ✅ `maxKeywordsPerCore` meaning documented
4. ✅ Formula breakdown provided
5. ✅ Consistent terminology throughout codebase

**The codebase now uses accurate, clear terminology that matches what the system actually does!** 🎉
