# Status Terminology Analysis & Clarification

**Date**: 2025-01-25  
**Issue**: Confusion between status handling in AI Query Parser vs AI Prompt Builder

## The Problem

User identified critical inconsistencies:

1. **AI Query Parser Service** says: "Properties need CONVERSION, not EXPANSION"
2. **AI Prompt Builder Service** says: "Apply semantic expansion to ALL property terms"
3. **Terminology confusion**: "category", "status category", "status", "specific status value" used inconsistently

## Current Architecture Analysis

### 1. AI Query Parser Service (aiQueryParserService.ts)

**Lines 520-593**: Property Recognition Section

```typescript
**CRITICAL PRINCIPLE**: Properties need CONVERSION, not EXPANSION!

Unlike keywords (which need semantic expansion for better recall), 
task properties must be converted directly to Dataview-compatible format.

**PROCESS FOR PROPERTIES**:
1. Read user's query in ANY language
2. Recognize which concepts are expressed (priority? status? due date?)
3. Convert directly to Dataview format
4. DO NOT expand properties - just convert!
```

**What it does**:
- Uses AI's native multilingual understanding
- Recognizes STATUS CONCEPT in ANY language
- Maps directly to internal category keys: "open", "inprogress", "completed", "cancelled"
- Returns: `status: "inprogress"` (single category key)

**Examples**:
```
English: "in progress" → status: "inprogress"
中文: "进行中" → status: "inprogress"
Svenska: "pågående" → status: "inprogress"
```

### 2. AI Prompt Builder Service (aiPromptBuilderService.ts)

**Lines 497-526**: Property Term Guidance Section

```typescript
LAYER 3: Semantic Expansion (You provide this!)
- Apply semantic expansion to ALL property terms across configured languages
- Generate semantic equivalents DIRECTLY in each language
- This enables cross-language property recognition

Step 2: Apply Semantic Expansion
- Expand EACH core property term into ALL languages
- Generate semantic equivalents DIRECTLY in each language
```

**What it's trying to do**:
- Help AI recognize property terms in multiple languages
- Generate semantic equivalents for better recognition
- Enable cross-language property matching

## The Confusion Explained

### What "Semantic Expansion" Means in Each Context

#### For Keywords (Correct Usage):
```
Query: "fix bug"
Core keywords: ["fix", "bug"]

Semantic Expansion:
- "fix" → ["fix", "repair", "solve", "correct", "debug", "修复", "解决", "处理"]
- "bug" → ["bug", "issue", "problem", "defect", "error", "错误", "问题", "缺陷"]

Result: 16+ keywords for better task matching
```

#### For Properties (Current Confusion):

**Query Parser says**: NO expansion, just conversion
```
Query: "in progress tasks"
Recognition: STATUS CONCEPT detected
Conversion: status: "inprogress"
NO expansion needed!
```

**Prompt Builder says**: YES expansion
```
Step 2: Apply Semantic Expansion
- Expand "in progress" into all languages
- Generate: ["in progress", "doing", "working", "进行中", "pågående"]
```

**Why this is confusing**:
- These are TWO DIFFERENT operations!
- Query Parser: AI recognizes concept → converts to key
- Prompt Builder: Helping AI recognize terms in multiple languages

## The Real Issue: Terminology Mismatch

### What's Actually Happening

The Prompt Builder's "semantic expansion" is NOT the same as keyword expansion!

**It's actually**: **Recognition Guidance** (not expansion for matching)

```
WHAT WE THINK IT MEANS:
"Expand 'in progress' into ['in progress', 'doing', 'working', '进行中']"
→ Then match tasks against all these terms

WHAT IT ACTUALLY MEANS:
"Here are examples of how users might express 'in progress' in different languages"
→ AI uses native understanding to recognize the concept
→ AI converts to internal key: "inprogress"
```

### The Three-Layer System (Prompt Builder)

**LAYER 1**: User-configured terms
- User's custom property terms from settings
- Example: User adds "WIP" as alias for "in progress"

**LAYER 2**: Base internal terms
- System's default recognition terms
- Example: "open", "todo", "pending" for open status

**LAYER 3**: "Semantic Expansion" (MISLEADING NAME!)
- NOT expansion for matching
- Actually: **Recognition examples** to help AI understand
- AI uses native language understanding, not these exact terms

## Status Category vs Status Value Confusion

### Current Terminology Issues

The prompts use these terms inconsistently:

1. **"status category"** - Sometimes means the category key ("open", "inprogress")
2. **"status"** - Sometimes means category, sometimes means value
3. **"specific status value"** - Unclear if this means category key or something else
4. **"status category name"** - The display name? The key? Both?

### What Users Actually Want

Users can query in THREE ways:

#### 1. Query by Category Key (Internal Name)
```
Query: "s:inprogress"
User wants: Tasks with status category "inprogress"
```

#### 2. Query by Display Name
```
Query: "in progress tasks"
User wants: Tasks with status category "inprogress" (matched via display name)
```

#### 3. Query by Alias
```
Query: "wip tasks"
User wants: Tasks with status category "inprogress" (matched via alias "wip")
```

#### 4. Query by Symbol (Task Marker)
```
Query: "s:/"
User wants: Tasks with symbol [/] in their checkbox
```

#### 5. Mixed Queries
```
Query: "s:open,/,wip"
User wants: Tasks that are:
- Category "open" OR
- Symbol [/] OR
- Category "inprogress" (via alias "wip")
```

### The Real Data Model

```typescript
taskStatusMapping: Record<string, {
    symbols: string[];        // Task Marker symbols: ["x", "X"]
    score: number;            // Scoring weight
    displayName: string;      // UI display: "Completed"
    aliases: string;          // Query aliases: "done,finished,closed"
}>;
```

**Category Key** (Record key): "completed"
- Stable identifier
- Used in code and data
- Never changes

**Display Name**: "Completed"
- User-facing label
- Can be customized
- Shown in UI

**Aliases**: "done,finished,closed"
- Alternative query terms
- User can add more
- Used for flexible querying

**Symbols**: ["x", "X"]
- Task Marker checkbox symbols
- Direct symbol matching
- Can mix with categories

## The Solution

### 1. Fix Terminology in Prompts

**STOP saying**: "Apply semantic expansion to properties"
**START saying**: "Recognize property concepts using your native language understanding"

### 2. Clarify the Three-Layer System

**LAYER 1**: User-configured terms (aliases)
**LAYER 2**: Base recognition terms (defaults)
**LAYER 3**: AI's native multilingual understanding (NOT expansion!)

### 3. Use Consistent Status Terminology

**Category Key**: The internal identifier ("open", "inprogress", "completed")
**Display Name**: The user-facing label ("Open", "In Progress", "Completed")
**Alias**: Alternative query terms ("wip", "doing", "active")
**Symbol**: Task Marker checkbox symbol ("[/]", "[x]")

### 4. Clarify User Intent

Users can query for:
- **Specific category**: "open tasks" → status: "open"
- **Multiple categories**: "open or wip" → status: ["open", "inprogress"]
- **Specific symbols**: "s:/" → tasks with [/] symbol
- **Mixed**: "s:open,/,wip" → category + symbol + alias

## Recommended Changes

### Change 1: AI Query Parser Service

**Current** (line 522):
```
**CRITICAL PRINCIPLE**: Properties need CONVERSION, not EXPANSION!
```

**Improved**:
```
**CRITICAL PRINCIPLE**: Properties need CONCEPT RECOGNITION and CONVERSION!

Unlike keywords (which need semantic expansion for better recall), 
task properties use your native language understanding to:
1. Recognize the concept (STATUS, PRIORITY, DUE_DATE)
2. Convert directly to internal format (category keys, numbers, dates)

NO expansion needed - you already understand all languages!
```

### Change 2: AI Prompt Builder Service

**Current** (line 497-512):
```
LAYER 3: Semantic Expansion (You provide this!)
- Apply semantic expansion to ALL property terms
- Generate semantic equivalents DIRECTLY in each language

Step 2: Apply Semantic Expansion
- Expand EACH core property term into ALL languages
```

**Improved**:
```
LAYER 3: Native Language Understanding (You provide this!)
- Use your multilingual training to recognize property concepts
- Understand property terms in ANY language users type
- No expansion needed - direct concept recognition!

Step 2: Concept Recognition
- Recognize property concepts in user's query (any language)
- Map concepts to internal category keys
- Example: "进行中" (Chinese) → Recognize as IN_PROGRESS concept → "inprogress"
```

### Change 3: Status Value Mapping

**Current** (aiPropertyPromptService.ts, line 113):
```
STATUS VALUE MAPPING (normalize to user-configured categories):
```

**Improved**:
```
STATUS CATEGORY MAPPING (recognize concepts, convert to category keys):

TERMINOLOGY:
- Category Key: Internal identifier (e.g., "open", "inprogress", "completed")
- Display Name: User-facing label (e.g., "Open", "In Progress", "Completed")
- Alias: Alternative query terms (e.g., "wip", "doing", "active")
- Symbol: Task Marker checkbox symbol (e.g., "[/]", "[x]")

USER QUERY INTENT:
1. Query by category key: "s:inprogress" → status: "inprogress"
2. Query by display name: "in progress tasks" → status: "inprogress"
3. Query by alias: "wip tasks" → status: "inprogress"
4. Query by symbol: "s:/" → tasks with [/] symbol
5. Mixed query: "s:open,/,wip" → ["open", symbol [/], "inprogress"]
```

### Change 4: Clarify Status Mapping Prompt

**Current** (aiPromptBuilderService.ts, line 207-244):
```
STATUS MAPPING (User-Configured - Dynamic):
Status values must be EXACTLY one of: ${categoryList}

⚠️ EXPAND STATUS TERMS ACROSS ALL LANGUAGES
```

**Improved**:
```
STATUS CATEGORY MAPPING (User-Configured - Dynamic):

TERMINOLOGY CLARIFICATION:
- Category Key: Internal identifier (stable, used in code)
- Display Name: User-facing label (customizable, shown in UI)
- Alias: Alternative query terms (flexible, user-defined)
- Symbol: Task Marker checkbox symbol (direct matching)

CURRENT CATEGORIES:
${categoryExamples}

YOUR TASK:
1. Recognize status concepts in user's query (ANY language)
2. Map to category keys: ${categoryList}
3. Use your native language understanding (NO expansion needed!)

RECOGNITION EXAMPLES:
- "in progress" (English) → Recognize IN_PROGRESS concept → "inprogress"
- "进行中" (Chinese) → Recognize IN_PROGRESS concept → "inprogress"
- "pågående" (Swedish) → Recognize IN_PROGRESS concept → "inprogress"
- "wip" (alias) → Match alias → "inprogress"
- "/" (symbol) → Match symbol → tasks with [/]

USER QUERY PATTERNS:
1. Natural language: "in progress tasks" → status: "inprogress"
2. Alias: "wip tasks" → status: "inprogress"
3. Symbol syntax: "s:/" → tasks with [/] symbol
4. Multiple: "s:open,wip,/" → ["open", "inprogress", symbol [/]]
```

## Summary

### The Core Confusion

**"Semantic Expansion"** means different things in different contexts:

1. **For Keywords**: Generate semantic equivalents for better task matching
   - Input: "fix" → Output: ["fix", "repair", "solve", "修复", "解决"]
   - Used for: Task content matching

2. **For Properties** (MISNAMED!): Recognition guidance examples
   - NOT expansion for matching
   - Actually: Help AI understand how users express concepts
   - AI uses native understanding, not these exact terms

### The Fix

1. **Rename**: "Semantic Expansion" → "Native Language Understanding" (for properties)
2. **Clarify**: Properties use concept recognition, not expansion
3. **Standardize**: Use consistent terminology (category key, display name, alias, symbol)
4. **Document**: Clear user query patterns and intent

### Key Principle

**Keywords**: Expand for better matching (YES expansion)
**Properties**: Recognize concepts, convert to keys (NO expansion, just recognition)

Both use AI's multilingual capabilities, but in different ways!
