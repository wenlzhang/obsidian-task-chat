# Stop Word Inconsistency Analysis (2025-10-17)

## Problem Identified

### Current Behavior

**Direct Search Mode** (regex-based):
```typescript
// In taskSearchService.ts
stopWords = ["the", "a", "and", "show", "find", "get", "list", "tell", "me", ...]
keywords = words.filter(word => !stopWords.has(word))
```
✅ Removes stop words BEFORE matching

**Smart Search Mode** (AI-powered):
```typescript
// In queryParserService.ts - AI prompt examples:
"How to develop..." → Extract: ["develop", "Obsidian", "AI", "plugin", "how"]
"如何开发..." → Extract: ["开发", "develop", "如何", "how"]
```
❌ AI INCLUDES stop words in results!

### Impact

#### 1. Inconsistent Keyword Count
```
Query: "how to fix bug"

Direct search:
- Extracts: ["fix", "bug"] (2 keywords)
- Threshold: 30 (for 2 keywords)

Smart search:
- Extracts: ["how", "fix", "修复", "bug", "错误"] (5 keywords) 
- Threshold: 40 (for 4-6 keywords, HIGHER!)
- More results filtered out!
```

#### 2. Different Results
```
Query: "show me all tasks"

Direct search:
- Keywords: ["tasks", "任务"] (stop words removed)
- Matches: All tasks with word "task"

Smart search:
- Keywords: ["show", "me", "all", "tasks", "任务", "显示", "所有"]
- Matches: Tasks containing "show", "me", "all" → noise!
- Higher threshold filters more aggressively
```

#### 3. Relevance Scoring Pollution
```
Task: "Fix the login bug"
Keywords: ["show", "me", "fix", "bug"]

Score calculation:
- "fix" match: +50
- "bug" match: +50
- "show" no match: 0
- "me" no match: 0
- Average: 25 (LOW!)

Without stop words:
Keywords: ["fix", "bug"]
- "fix" match: +50
- "bug" match: +50
- Average: 50 (HIGH!)
```

---

## Root Cause

### In queryParserService.ts (Line 280-297)

**AI prompt examples show INCLUDING stop words**:
```
Query: "How to develop Obsidian AI plugin" 
→ Extract: ["develop", "开发", "Obsidian", "AI", "plugin", "插件", "how"]
                                                                      ^^^^
```

**Instructions don't mention stop words**:
```
CRITICAL RULES:
- Remove filter-related words (priority, due date, status) from keywords
  ^^^^^^^ Only mentions filter words, NOT stop words!
```

---

## Solution Approach

### Option A: Update AI Prompt (Inconsistent)
❌ AI might not follow instructions perfectly
❌ Different AI models interpret differently
❌ Multilingual stop words are complex

### Option B: Post-Process AI Results (Consistent)
✅ Reliable removal
✅ Same logic as direct search
✅ Single source of truth

### Option C: Hybrid (Best)
✅ Tell AI to avoid stop words (reduce noise)
✅ Post-process to guarantee removal
✅ Share stop word list between modes

---

## Recommended Implementation

### 1. Create Shared Stop Word Module

**File**: `src/services/stopWords.ts`

```typescript
/**
 * Shared stop word list for both direct and AI-powered search modes
 * These words add no semantic value and should be filtered from queries
 */
export class StopWords {
    private static readonly STOP_WORDS = new Set([
        // English articles and prepositions
        "the", "a", "an", "and", "or", "but",
        "in", "on", "at", "to", "for", "of",
        "with", "by", "from", "as", "is", "was",
        "are", "were",
        
        // English query words (add missing ones)
        "show", "find", "get", "list", "tell", "give",
        "me", "my", "all",
        "how", "what", "when", "where", "why", "which",  // <-- ADD THESE
        "do", "does", "can", "could", "should", "would",
        
        // Task-related generic words
        "task", "tasks",
        
        // Chinese stop words
        "给我", "给", "我", "的", "了", "吗", "呢", "啊",
        "如何", "怎么", "怎样", "什么", "哪些", "哪个",  // <-- ADD THESE
        "任务",
    ]);

    static isStopWord(word: string): boolean {
        return this.STOP_WORDS.has(word.toLowerCase());
    }

    static filterStopWords(words: string[]): string[] {
        return words.filter(word => 
            word.length > 1 && !this.isStopWord(word)
        );
    }

    static getStopWordsList(): string[] {
        return Array.from(this.STOP_WORDS);
    }
}
```

### 2. Update Direct Search to Use Shared List

**File**: `taskSearchService.ts`

```typescript
import { StopWords } from "./stopWords";

// REMOVE local stopWords definition (lines 133-177)
// REPLACE with:
return StopWords.filterStopWords(words);
```

### 3. Update AI Prompt to Mention Stop Words

**File**: `queryParserService.ts`

```typescript
CRITICAL RULES:
- Extract INDIVIDUAL words, not phrases
- Remove filter-related words (priority, due date, status) from keywords
- Remove stop words (how, what, when, where, the, a, an, 如何, 什么, etc.) from keywords  // <-- ADD
- For each meaningful keyword, provide translations in ALL configured languages
```

### 4. Post-Process AI Results

**File**: `queryParserService.ts`

```typescript
import { StopWords } from "./stopWords";

// After parsing AI response (line 343):
const result = {
    priority: parsed.priority || undefined,
    dueDate: parsed.dueDate || undefined,
    status: parsed.status || undefined,
    folder: parsed.folder || undefined,
    tags: parsed.tags || [],
    keywords: StopWords.filterStopWords(keywords),  // <-- POST-PROCESS
    originalQuery: query,
};
```

### 5. Update Fallback Logic

**File**: `queryParserService.ts` (line 334)

```typescript
// When AI returns nothing, split query and filter stop words
keywords = StopWords.filterStopWords(
    query.split(/\s+/).filter((word) => word.length > 0)
);
```

---

## Expected Improvements

### Consistency
```
Query: "how to fix bug"

Before:
- Direct search: ["fix", "bug"]
- Smart search: ["how", "fix", "修复", "bug", "错误"]
- INCONSISTENT keyword count and matching

After:
- Direct search: ["fix", "bug"]
- Smart search: ["fix", "修复", "bug", "错误"]
- CONSISTENT (both remove "how")
```

### Relevance Threshold Alignment
```
Before:
- Direct: 2 keywords → threshold 30
- Smart: 5 keywords → threshold 40 (too strict!)

After:
- Direct: 2 keywords → threshold 30
- Smart: 4 keywords → threshold 35 (closer!)
```

### Better Scoring
```
Task: "Fix the login bug"
Query: "how to fix bug"

Before (Smart search):
Keywords: ["how", "fix", "修复", "bug", "错误"] (5)
Matches: "fix" (1/5) + "bug" (1/5) = 2/5 = 40% → LOW SCORE

After (Smart search):
Keywords: ["fix", "修复", "bug", "错误"] (4)
Matches: "fix" (1/4) + "bug" (1/4) = 2/4 = 50% → BETTER SCORE
```

---

## Benefits

1. ✅ **Consistency**: Both modes filter same stop words
2. ✅ **Maintainability**: Single stop word list
3. ✅ **Extensibility**: Easy to add more stop words
4. ✅ **Reliability**: Post-processing guarantees removal
5. ✅ **Better thresholds**: Keyword count reflects meaningful words only
6. ✅ **Improved relevance**: Scores based on semantic keywords only

---

## Migration Notes

- No breaking changes
- Results improve immediately
- May surface more tasks (lower keyword counts = lower thresholds)
- Users should see more consistent results between modes
