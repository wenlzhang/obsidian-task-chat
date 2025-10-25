# AI Prompt Optimization Plan

**Date**: 2025-01-25  
**Goal**: Streamline prompts for better reliability across all models (GPT-4o-mini, Claude, offline models)

## Current Problems

### 1. Prompt Length & Complexity
- **aiQueryParserService.ts**: ~1,600 lines of prompt text
- Too many detailed examples (20+ examples for keywords alone)
- Repetitive instructions across multiple sections
- Overwhelming for smaller models

### 2. Redundancy & Conflicts
- Same concepts explained multiple times:
  - Semantic expansion explained in 5+ places
  - Property extraction repeated 3+ times
  - Stop words mentioned but conflicting guidance
- Keywords vs properties separation explained too many times
- Multiple "CRITICAL" sections competing for attention

### 3. Structure Issues
- No clear hierarchy
- Examples scattered throughout
- Hard to find specific guidance
- Mixing settings, instructions, and examples

### 4. Model Failures
- GPT-4o-mini unstable, especially with stopwords
- Smaller models failing at parsing stage
- JSON format errors from confusion
- Missing required fields due to overwhelm

## Optimization Strategy

### Core Principles

1. **Simplicity**: Fewer words, clearer meaning
2. **Hierarchy**: Logical structure (settings → rules → examples)
3. **Consolidation**: One place for each concept
4. **Clarity**: No conflicts, no redundancy
5. **User Settings**: Always respect via variables
6. **External Processing**: Let code handle complexity (stopwords, deduplication)

### New Structure

```
SYSTEM PROMPT
├── Role & Task (1 paragraph)
├── User Settings (variables only, no explanations)
├── Output Format (JSON structure)
├── Part 1: Extract Keywords
│   ├── Rule (1 paragraph)
│   └── Example (1 comprehensive)
├── Part 2: Expand Keywords
│   ├── Rule (1 paragraph)
│   └── Example (1 comprehensive)
├── Part 3: Extract Properties
│   ├── Priority (rule + mapping)
│   ├── Status (rule + mapping)
│   └── Due Date (rule + mapping)
└── Complete Examples (2-3 covering all cases)
```

### Length Targets

| Component | Current | Target | Reduction |
|-----------|---------|--------|-----------|
| System prompt intro | 200 lines | 30 lines | -85% |
| Keyword section | 400 lines | 80 lines | -80% |
| Property section | 600 lines | 120 lines | -80% |
| Examples | 400 lines | 100 lines | -75% |
| **Total** | **1,600 lines** | **330 lines** | **-79%** |

## Detailed Changes

### 1. Role & Task (Streamlined)

**Before** (scattered across 50+ lines):
```
You are a user query parser...
THREE-PART QUERY PARSING SYSTEM...
PART 1: TASK CONTENT (Keywords)...
PART 2: TASK ATTRIBUTES...
PART 3: EXECUTOR & ENVIRONMENT...
```

**After** (5 lines):
```
Parse user query into structured filters for task search.
Extract: (1) Keywords for content matching, (2) Properties for filtering (priority/status/due date).
Respect user settings. Return valid JSON only.
```

### 2. User Settings (Variables Only)

**Before** (100+ lines with explanations):
```
SEMANTIC KEYWORD EXPANSION SETTINGS:
- Languages configured: ${languageList}
- Number of languages: ${queryLanguages.length}
- Target expansions per keyword per language: ${maxExpansions}
- Expansion enabled: ${expansionEnabled}
- Target variations to generate PER core keyword: ${maxKeywordsPerCore}
  (Formula: ${maxExpansions} expansions/language × ${queryLanguages.length} languages)

🚨 CRITICAL EXPANSION REQUIREMENT:
You MUST expand EVERY SINGLE core keyword into ALL ${queryLanguages.length} configured languages...
[continues for 50+ lines]
```

**After** (10 lines):
```
USER SETTINGS:
- Languages: ${languageList}
- Expansions per keyword per language: ${maxExpansions}
- Total expansions per keyword: ${maxKeywordsPerCore}
- Priority mapping: ${JSON.stringify(settings.dataviewPriorityMapping)}
- Status categories: ${Object.keys(settings.taskStatusMapping).join(", ")}
- Due date field: ${settings.dataviewKeys.dueDate}
```

### 3. Keywords: Extract & Expand (Consolidated)

**Before** (400+ lines):
- Multiple sections on extraction
- Repetitive expansion instructions
- 10+ examples for extraction
- 10+ examples for expansion
- Conflicts between sections

**After** (80 lines):
```
KEYWORDS (Content Matching):

Step 1 - Extract meaningful keywords:
- Identify main concepts (nouns, verbs, adjectives that describe the task)
- Skip generic words (e.g., "show", "find", "get", "me", "all")
- Property words go to properties, not keywords

Step 2 - Expand semantically:
- For EACH keyword, generate ${maxExpansions} equivalents in EACH language: ${languageList}
- Total per keyword: ${maxKeywordsPerCore} variations
- Think: "How would native speakers express this concept?"

Example:
Query: "Fix urgent bug in payment"
Extract: ["fix", "bug", "payment"] (skip "urgent" - it's priority)
Expand each across ${languageList}:
- "fix" → ["fix", "repair", "solve", "修复", "解决", "fixa", "reparera", ...]
- "bug" → ["bug", "error", "issue", "错误", "问题", "fel", "bugg", ...]
- "payment" → ["payment", "billing", "pay", "支付", "付款", "betalning", ...]
Result: ~${maxKeywordsPerCore * 3} total keywords
```

### 4. Properties (Concept Recognition)

**Before** (600+ lines):
- Multiple "CRITICAL PRINCIPLE" sections
- Repetitive concept explanations
- 20+ multilingual examples
- Conflicting guidance on expansion vs recognition

**After** (120 lines):
```
PROPERTIES (Structured Filters):

Recognize these concepts in ANY language, convert to internal format:

1. PRIORITY (urgency/importance) → number 1-4:
   - Urgent/critical/high/asap → 1
   - Important/medium → 2
   - Normal → 3
   - Low → 4
   User mapping: ${JSON.stringify(settings.dataviewPriorityMapping)}

2. STATUS (task state) → category key:
   Valid keys: ${Object.keys(settings.taskStatusMapping).join(", ")}
   - Open/todo/pending → "open"
   - In progress/doing/working → "inprogress"
   - Done/finished/completed → "completed"
   - Cancelled/abandoned → "cancelled"

3. DUE DATE (deadline/timing) → date string:
   - Today → "today"
   - Tomorrow → "tomorrow"
   - Overdue/late → "overdue"
   - This week → "this-week"
   - Next week → "next-week"

Multilingual examples:
- "срочные задачи" (Russian) → priority: 1, keywords: ["задачи"]
- "進行中のタスク" (Japanese) → status: "inprogress", keywords: ["タスク"]
- "urgentes et en retard" (French) → priority: 1, dueDate: "overdue"
```

### 5. Complete Examples (Comprehensive)

**Before** (400+ lines):
- 30+ scattered examples
- Many redundant
- Mixed throughout prompt

**After** (100 lines):
```
COMPLETE EXAMPLES:

1. Pure keywords:
   Query: "develop Task Chat plugin"
   {
     "coreKeywords": ["develop", "Task", "Chat", "plugin"],
     "keywords": [<~${maxKeywordsPerCore * 4} expanded>],
     "priority": null,
     "status": null,
     "dueDate": null
   }

2. Keywords + properties:
   Query: "urgent open bugs in payment system due today"
   {
     "coreKeywords": ["bugs", "payment", "system"],
     "keywords": [<~${maxKeywordsPerCore * 3} expanded>],
     "priority": 1,
     "status": "open",
     "dueDate": "today"
   }

3. Pure properties:
   Query: "priority 1 overdue"
   {
     "coreKeywords": [],
     "keywords": [],
     "priority": 1,
     "status": null,
     "dueDate": "overdue"
   }

4. Multilingual:
   Query: "紧急的进行中任务明天到期"
   {
     "coreKeywords": ["任务"],
     "keywords": [<expanded in ${languageList}>],
     "priority": 1,
     "status": "inprogress",
     "dueDate": "tomorrow"
   }
```

## Removed Complexity

### What We're Removing (Handled Externally)

1. **Stop Words Filtering**: 
   - Current: Complex AI instructions to avoid stop words
   - New: Extract keywords naturally, filter externally in code
   - Why: Simpler for AI, more reliable

2. **Typo Correction**:
   - Current: 50+ lines of typo examples
   - New: Trust AI's natural understanding
   - Why: Already capable, don't need explicit instructions

3. **Multiple Redundant Examples**:
   - Current: 30+ examples for same concept
   - New: 3-4 comprehensive examples
   - Why: Fewer is clearer

4. **Repetitive "CRITICAL" Warnings**:
   - Current: 10+ "🚨 CRITICAL" sections
   - New: Clear rules without drama
   - Why: Everything is critical, so nothing is

### What We're Keeping (Essential)

1. ✅ User settings via variables
2. ✅ Semantic expansion rules
3. ✅ Property recognition guidance
4. ✅ Mutual exclusivity (keyword ≠ property)
5. ✅ JSON format requirements
6. ✅ Multilingual support
7. ✅ Multi-value properties
8. ✅ Date ranges
9. ✅ All output fields

## Testing Strategy

### Test Cases

1. **Pure keywords**: "develop plugin for obsidian"
2. **Keywords + properties**: "urgent bug fix due today"
3. **Pure properties**: "priority 1 overdue open"
4. **Multilingual**: "紧急任务明天到期"
5. **Complex**: "high priority open bugs in payment system due this week"
6. **With typos**: "urgant complated taks"
7. **Edge cases**: Empty query, only stopwords, very long query

### Success Criteria

- ✅ GPT-4o-mini: 95%+ success rate
- ✅ Claude: 95%+ success rate
- ✅ Smaller models: 85%+ success rate
- ✅ All fields populated correctly
- ✅ JSON always valid
- ✅ Properties correctly separated from keywords
- ✅ Expansion follows settings

## Implementation Plan

### Phase 1: aiQueryParserService.ts

1. Replace system prompt (lines 456-1250)
2. Keep extraction logic intact
3. Test with all providers

### Phase 2: aiPromptBuilderService.ts

1. Streamline property term guidance
2. Remove redundant examples
3. Keep user settings injection

### Phase 3: aiPropertyPromptService.ts

1. Simplify mapping builders
2. Keep terminology consistent
3. Remove verbosity

### Phase 4: Verification

1. Run full test suite
2. Test with multiple providers
3. Check user settings respected
4. Verify all features work

## Expected Improvements

### For Models
- 79% shorter prompt → faster processing
- Clearer structure → better understanding
- No conflicts → consistent behavior
- External filtering → simpler task

### For Users
- More reliable parsing
- Works with cheaper models
- Consistent results
- Settings always respected

### For Developers
- Easier to maintain
- Clear structure
- No redundancy
- Better documentation
