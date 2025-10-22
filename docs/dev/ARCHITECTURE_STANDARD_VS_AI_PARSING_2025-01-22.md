# Architecture: Standard Syntax vs AI Parsing (2025-01-22)

## Core Principle ✅

**"We should always try to use existing modules (Todoist, DataView, natural language packages) for standard syntax, just like Simple Search. AI is only for non-standard/natural language property recognition."**

---

## Three-Mode Architecture

### Simple Search (Baseline - All Standard)

**Uses existing modules for everything:**

```typescript
parseTodoistSyntax(query) // Comprehensive standard syntax parser

Handles:
→ Priority: p1, p2, p3, p4, "priority 1", "no priority"
→ Status: s:open, s:completed, s:inprogress, s:?, s:x
→ Dates: overdue, today, tomorrow, "3 days", "next Friday" (chrono-node)
→ Keywords: search:term
→ Projects: ##project
→ Special: recurring, subtask, "no date"
→ Operators: &, |, !

All powered by:
✅ Regex patterns (Todoist-style)
✅ chrono-node (natural language dates)
✅ DataView API integration
✅ No AI required
```

### Smart Search (Two-Phase)

**Phase 1: Standard Syntax → Existing Modules** ✅

```typescript
extractStandardProperties(query) {
    // ✅ Uses SAME parser as Simple Search
    const todoistParsed = DataviewService.parseTodoistSyntax(query);
    
    // Extract standard properties
    return {
        priority: todoistParsed.priority,      // P1-P4
        status: todoistParsed.statusValues,    // s:value
        dueDate: todoistParsed.dueDate,       // Standard dates
        // ... special keywords
    };
}

removeStandardProperties(query) {
    // Remove extracted syntax, leaving keywords
    return remainingKeywords;
}
```

**Phase 2: Non-Standard Properties → AI** ✅

```typescript
parseWithAI(remainingKeywords) {
    // AI handles ONLY non-standard natural language
    
    Examples:
    → "urgent tasks" → priority: 1
    → "working on" → status: "inprogress"
    → "紧急任务" → priority: 1, keywords: ["任务"]
    → "tasks due next Friday" → dueDate: calculated
    
    // Keywords also get semantic expansion
    → "fix" → ["fix", "repair", "solve", ...]
}
```

### Task Chat (Same as Smart Search)

**Same two-phase approach:**
1. Standard syntax → Existing modules
2. Non-standard → AI + semantic expansion

Then sends results to AI for analysis and recommendations.

---

## What "Standard Syntax" Means

### Priority (Standard)
```
✅ P1, P2, P3, P4              → Todoist pattern
✅ priority 1, priority 2       → Todoist pattern
✅ "no priority"                → Todoist special keyword

❌ "urgent", "important"        → AI recognition
❌ "紧急", "重要"               → AI recognition
```

### Status (Standard)
```
✅ s:open, s:completed         → Todoist pattern
✅ s:inprogress, s:?           → Todoist pattern
✅ s:x (multiple statuses)     → Todoist pattern

❌ "working on", "in progress" → AI recognition
❌ "已完成", "进行中"          → AI recognition
```

### Due Date (Standard)
```
✅ overdue                     → Todoist keyword
✅ today, tomorrow             → Todoist keyword
✅ "next Friday"               → chrono-node
✅ "in 3 days"                 → Todoist pattern
✅ "2025-01-25"                → Date string

❌ "soon", "later"             → AI interpretation
❌ "过期", "今天到期"          → AI recognition
```

---

## Why This Architecture?

### Performance
- **Standard syntax:** Instant (regex + chrono-node)
- **AI parsing:** ~200-500ms per query
- **Result:** Fast when possible, smart when needed

### Reliability
- **Standard syntax:** Deterministic, tested
- **AI parsing:** Flexible, handles variations
- **Result:** Reliable baseline + intelligent fallback

### Consistency
- **All modes use same standard parser**
- **No divergence between modes**
- **Single source of truth**

### Cost
- **Standard syntax:** Zero tokens
- **AI parsing:** Only for natural language
- **Result:** Minimal AI usage

---

## Existing Modules We Use

### 1. Todoist Syntax Parser (`parseTodoistSyntax`)

**Location:** `dataviewService.ts`

**Handles:**
- Priority patterns (p1-p4)
- Status patterns (s:value)
- Date keywords (overdue, today, tomorrow)
- Relative dates ("3 days", "-3 days")
- Special keywords (no date, recurring, subtask)
- Operators (&, |, !)
- Project filters (##project)

**Used by:**
- ✅ Simple Search (everything)
- ✅ Smart Search (standard properties)
- ✅ Task Chat (standard properties)

### 2. chrono-node (Natural Language Dates)

**Location:** npm package, used in `dataviewService.ts`

**Handles:**
- "next Friday"
- "in 3 days"
- "tomorrow at 2pm"
- "first day of next month"
- Complex date expressions

**Used by:**
- ✅ Simple Search (via parseTodoistSyntax)
- ✅ Smart Search (via parseTodoistSyntax)
- ✅ Task Chat (via parseTodoistSyntax)

### 3. DataView API

**Location:** Obsidian plugin API

**Handles:**
- Task metadata queries
- Field access (due, priority, status, etc.)
- File queries
- Link resolution

**Used by:**
- ✅ All three modes (task filtering)

### 4. AI Service (Only for Non-Standard)

**Location:** `aiService.ts` → `queryParserService.ts`

**Handles:**
- Natural language property recognition ("urgent" → priority:1)
- Multilingual support ("紧急" → priority:1)
- Semantic keyword expansion ("fix" → ["fix", "repair", ...])
- Typo correction ("urgant" → "urgent")

**Used by:**
- ❌ Simple Search (not used)
- ✅ Smart Search (keywords + non-standard properties)
- ✅ Task Chat (keywords + non-standard properties)

---

## Data Flow Comparison

### Simple Search: All Standard
```
User Query: "Fix bug P1 overdue"
    ↓
parseTodoistSyntax()
    ↓ (ALL handled by existing modules)
Result: {
    keywords: ["Fix", "bug"],
    priority: 1,
    dueDate: "overdue"
}
    ↓
Filter & Display
```

### Smart Search / Task Chat: Two-Phase
```
User Query: "Fix bug P1 overdue"
    ↓
Phase 1: extractStandardProperties() 
    ↓ (uses parseTodoistSyntax)
Extracted: {priority: 1, dueDate: "overdue"}
Remaining: "Fix bug"
    ↓
Phase 2: parseWithAI("Fix bug")
    ↓ (AI only for keywords)
Result: {
    priority: 1,              // From Phase 1 (Todoist)
    dueDate: "overdue",       // From Phase 1 (Todoist)
    keywords: [...expanded]   // From Phase 2 (AI)
}
    ↓
Filter, Score, Display/Analyze
```

### Smart Search / Task Chat: Natural Language
```
User Query: "urgent tasks working on"
    ↓
Phase 1: extractStandardProperties()
    ↓ (uses parseTodoistSyntax)
Extracted: {} (nothing standard)
Remaining: "urgent tasks working on"
    ↓
Phase 2: parseWithAI("urgent tasks working on")
    ↓ (AI recognizes everything)
Result: {
    priority: 1,                    // AI recognized "urgent"
    status: "inprogress",           // AI recognized "working on"
    keywords: ["tasks", ...]        // AI expanded
}
    ↓
Filter, Score, Display/Analyze
```

---

## Examples: Standard vs AI

### Example 1: All Standard (No AI)
```
Query: "P1 s:open overdue"

extractStandardProperties():
→ Uses parseTodoistSyntax()
→ Result: {priority: 1, status: "open", dueDate: "overdue"}

removeStandardProperties():
→ Remaining: "" (nothing left)

AI: NOT called ✅
Tokens: 0
Speed: Instant
```

### Example 2: Mixed (Both)
```
Query: "Fix urgent bug P1"

extractStandardProperties():
→ Uses parseTodoistSyntax()
→ Result: {priority: 1}

removeStandardProperties():
→ Remaining: "Fix urgent bug"

AI: Called for "Fix urgent bug"
→ Keywords: ["Fix", "bug"] (expanded)
→ Properties: "urgent" recognized as priority:1
→ But P1 takes precedence (standard syntax wins)

Result: {
    priority: 1,              // From Todoist (standard)
    keywords: [...expanded]   // From AI
}

Tokens: ~200-300
Speed: ~300ms
```

### Example 3: All Natural Language (AI Only)
```
Query: "urgent tasks I'm working on"

extractStandardProperties():
→ Uses parseTodoistSyntax()
→ Result: {} (nothing standard)

removeStandardProperties():
→ Remaining: "urgent tasks I'm working on"

AI: Called for everything
→ Priority: "urgent" → priority:1
→ Status: "working on" → status:"inprogress"
→ Keywords: ["tasks"] (expanded)

Result: {
    priority: 1,              // From AI
    status: "inprogress",     // From AI
    keywords: [...expanded]   // From AI
}

Tokens: ~400-500
Speed: ~400ms
```

### Example 4: Complex Dates (chrono-node)
```
Query: "Fix bug due next Friday"

extractStandardProperties():
→ Uses parseTodoistSyntax()
→ parseTodoistSyntax uses chrono-node
→ Result: {dueDate: "2025-01-31"} (calculated)

removeStandardProperties():
→ Remaining: "Fix bug"

AI: Called for keywords only
→ Keywords: ["Fix", "bug"] (expanded)

Result: {
    dueDate: "2025-01-31",    // From chrono-node (standard)
    keywords: [...expanded]   // From AI
}

Tokens: ~200
Speed: ~300ms
```

---

## Code Organization

### Standard Syntax Processing
```
src/services/dataviewService.ts
    └─ parseTodoistSyntax()          // Main parser
        ├─ Priority patterns          // p1-p4
        ├─ Status patterns            // s:value
        ├─ Date keywords              // overdue, today
        ├─ Date parsing (chrono)      // "next Friday"
        ├─ Relative dates             // "3 days", "-3 days"
        └─ Special keywords           // no date, recurring
```

### AI Processing (Non-Standard Only)
```
src/services/queryParserService.ts
    └─ parseQuery()
        ├─ extractStandardProperties() // Uses parseTodoistSyntax
        ├─ removeStandardProperties()  // Clean query
        └─ parseWithAI()               // Only for non-standard
            ├─ Natural language props  // "urgent" → priority:1
            ├─ Multilingual props      // "紧急" → priority:1
            └─ Keyword expansion       // "fix" → ["fix", "repair"...]
```

---

## Benefits of This Architecture

### 1. Code Reuse
- ✅ All modes use same standard parser
- ✅ No duplication
- ✅ Single source of truth

### 2. Performance
- ✅ Standard syntax: Instant (no AI)
- ✅ Mixed queries: Fast standard + AI only for keywords
- ✅ Natural language: AI when needed

### 3. Cost Efficiency
- ✅ Zero tokens for standard syntax
- ✅ Minimal tokens for mixed queries
- ✅ AI only when necessary

### 4. Consistency
- ✅ "P1" works same in all modes
- ✅ "overdue" works same in all modes
- ✅ No mode-specific behavior

### 5. Maintainability
- ✅ Update parser once, applies to all modes
- ✅ Bug fixes propagate automatically
- ✅ New features inherited

### 6. Extensibility
- ✅ Add new Todoist patterns → works everywhere
- ✅ Update chrono-node → better dates everywhere
- ✅ Improve AI → better natural language

---

## Testing Matrix

| Query Type | Simple | Smart | Task Chat | AI Used? | Modules Used |
|------------|--------|-------|-----------|----------|--------------|
| "P1 overdue" | ✅ | ✅ | ✅ | ❌ No | Todoist |
| "P1 urgent bug" | ✅ | ✅ | ✅ | ✅ Yes (keywords) | Todoist + AI |
| "urgent tasks" | Partial | ✅ | ✅ | ✅ Yes (all) | AI only |
| "due next Friday" | ✅ | ✅ | ✅ | ❌ No | chrono-node |
| "紧急任务" | ❌ | ✅ | ✅ | ✅ Yes (all) | AI only |
| "Fix s:open P1" | ✅ | ✅ | ✅ | ✅ Yes (keywords) | Todoist + AI |

---

## Key Principles

1. **Use Existing Modules First**
   - Todoist syntax → `parseTodoistSyntax()`
   - Natural dates → chrono-node
   - Task queries → DataView API
   - Don't reinvent the wheel

2. **AI Only for Non-Standard**
   - Natural language properties
   - Multilingual recognition
   - Semantic expansion
   - Not for standard syntax

3. **Consistent Across Modes**
   - "P1" means same thing everywhere
   - Same parser for all modes
   - No divergence

4. **Performance First**
   - Standard syntax: Instant
   - AI: Only when needed
   - Best of both worlds

5. **Single Source of Truth**
   - One parser for standard syntax
   - Updates apply everywhere
   - No duplication

---

## Verification Checklist

- [x] Simple Search uses existing modules only
- [x] Smart/Task Chat use same modules for standard syntax
- [x] AI only used for non-standard properties
- [x] All modes use `parseTodoistSyntax()`
- [x] chrono-node used consistently
- [x] No code duplication
- [x] Standard syntax precedence over AI
- [x] Zero tokens for standard queries
- [x] Build successful
- [x] Architecture documented

---

## Summary

**Architecture Pattern:**

```
Standard Syntax (P1, s:open, overdue, "next Friday")
    ↓
Existing Modules (Todoist, chrono-node, DataView)
    ↓
All Three Modes (Simple, Smart, Task Chat)

Non-Standard Syntax ("urgent", "紧急", "working on")
    ↓
AI Recognition + Semantic Expansion
    ↓
Smart Search & Task Chat Only
```

**Key Insight:**

All three modes share the same foundation (existing modules for standard syntax).

Smart Search and Task Chat add AI on top for non-standard/natural language.

This gives us:
- ✅ Consistency (standard syntax works everywhere)
- ✅ Performance (instant for standard)
- ✅ Flexibility (AI for natural language)
- ✅ Cost efficiency (minimal AI usage)

---

**This architecture is now correctly implemented and documented!** ✅
