# Unified Query System Implementation Plan (2025-01-21)

## 🎯 **VISION**

Create a **hybrid intelligent query system** where users write queries in natural language or structured syntax, and the system intelligently converts everything to DataView API format.

### **Core Principles**

1. **User-facing Flexibility**: Support multiple input styles
   - Todoist-style: `P1 overdue`
   - Natural language: `high priority overdue tasks`
   - DataView syntax: `priority = 1 AND due < date(today)`

2. **Internal Intelligence**: Hybrid approach
   - **Properties**: Always use deterministic parsing (fast, reliable, accurate)
   - **Keywords**: Mode-dependent intelligence
     * Simple: Deterministic extraction
     * Smart/Chat: AI semantic expansion

3. **Universal Output**: Convert everything to DataView API format
   - Properties → DataView WHERE clauses
   - Keywords → Content filters
   - Execute → Filter → Score → Sort → Display/Chat

### **Key Benefits**

✅ **User Simplicity**: Write queries however feels natural  
✅ **Internal Power**: Best tool for each job (deterministic for properties, AI for keywords)  
✅ **Performance**: Deterministic parsing is instant (~0.1ms), AI only where it adds value  
✅ **Reliability**: Properties parsed accurately 100% of the time  
✅ **Intelligence**: Keywords expanded semantically for better matching  
✅ **Unified Flow**: All modes converge to same DataView API execution

---

## 🏗️ **HYBRID ARCHITECTURE**

### **The Unified Flow**

```
┌─────────────────────────────────────────────────────────┐
│ USER INPUT (any style)                                   │
│ "bug fix P1 overdue" or "important tasks 1w" or         │
│ "high priority tasks due today"                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ UNIFIED QUERY PARSER                                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────────────────┐  ┌──────────────────────┐     │
│ │ Property Parser      │  │ Keyword Extractor     │     │
│ │ (Deterministic)      │  │ (Mode-dependent)      │     │
│ ├──────────────────────┤  ├──────────────────────┤     │
│ │ • Regex patterns     │  │ Simple:               │     │
│ │ • chrono-node dates  │  │   Regex extraction    │     │
│ │ • 100% accurate      │  │                       │     │
│ │ • Instant (~0.1ms)   │  │ Smart/Chat:           │     │
│ │                      │  │   AI expansion        │     │
│ │ Extracts:            │  │   Cross-language      │     │
│ │ • Priority: P1-P4    │  │   Semantic matching   │     │
│ │ • Date: 1d, 1w, etc  │  │                       │     │
│ │ • Status: open, etc  │  │ Extracts:             │     │
│ │ • Tags: #urgent      │  │ • Keywords            │     │
│ │ • Folder: path       │  │ • Expansions (AI)     │     │
│ └──────────────────────┘  └──────────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ DATAVIEW API FORMAT                                      │
├─────────────────────────────────────────────────────────┤
│ Properties → WHERE clauses:                              │
│   WHERE priority = 1 AND due < date(today)              │
│                                                          │
│ Keywords → Content filters:                              │
│   text.contains("bug") OR text.contains("error") ...    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ EXECUTION (Same for all modes)                           │
├─────────────────────────────────────────────────────────┤
│ Filter → Score → Sort → Display/Chat                    │
│                                                          │
│ • DataView API executes WHERE clauses (fast!)           │
│ • Keyword matching on filtered set                      │
│ • Score by relevance + properties                       │
│ • Sort by user preferences                              │
│ • Display results or send to chat AI                    │
└─────────────────────────────────────────────────────────┘
```

### **Why This Works**

**For Properties (Priority, Date, Status):**
- ✅ Deterministic parsing is **100% accurate**
- ✅ Regex is **instant** (~0.1ms)
- ✅ No AI needed = **no API costs**
- ✅ No hallucination risk
- ✅ Predictable and reliable

**For Keywords (Content Search):**
- ✅ Simple mode: Fast regex extraction
- ✅ Smart/Chat: AI semantic expansion adds intelligence
- ✅ Cross-language matching
- ✅ Contextual understanding
- ✅ Only use AI where it adds value

**Result:**
- Best of both worlds: Speed + Intelligence
- Deterministic where accuracy matters
- AI where understanding matters
- Single unified flow

---

## 📚 **RESEARCH SUMMARY**

### **1. Todoist Filter Syntax**

**Core Features:**
- **Keywords**: `search: meeting` (content search)
- **Dates**: `date: Jan 3`, `date before: May 5`, `date after: May 5`, `overdue`, `today`, `no date`
- **Priority**: `p1`, `p2`, `p3`, `p4`
- **Boolean**: `&` (AND), `|` (OR), `!` (NOT)
- **Combination**: `search: meeting & p1 & overdue`

**Examples:**
```
search: bug & p1 & overdue          → High priority overdue bugs
search: meeting | search: standup   → Tasks with "meeting" OR "standup"
date: today & !p1                   → Today's tasks except P1
```

### **2. Natural Language Dates (nldates)**

**Supported Formats:**
- **Relative**: "today", "tomorrow", "yesterday", "next week", "last friday"
- **Offset**: "5 days ago", "2 weeks from now", "3 months later"
- **Ranges**: "this week", "next month", "last year"
- **Specific**: "Jan 3", "August 17 2013", "2014-11-30"

**Examples:**
```
@today                    → 2025-01-21
@next week                → 2025-01-27
@5 days ago               → 2025-01-16
@this friday from 13:00   → 2025-01-24 13:00
```

### **3. DataView Query Language**

**Task Properties:**
- **Emoji shortcuts**: 🗓️ (due), ✅ (completed), ➕ (created), 🛫 (start), ⏳ (scheduled)
- **Priority emoji**: ⏫ (high), 🔼 (medium), 🔽 (low)
- **Inline fields**: `[priority:: 1]`, `[due:: 2025-01-21]`

**Query Commands:**
```dataview
TASK
WHERE due < date(today)        // Overdue tasks
WHERE priority = 1             // P1 tasks
WHERE !completed               // Incomplete tasks
SORT due ASC
LIMIT 10
```

---

## 🎨 **PROPOSED UNIFIED QUERY SYNTAX**

### **Design Principles**

1. **Natural & Intuitive**: Read like plain English
2. **Backwards Compatible**: Existing queries still work
3. **Mode-Appropriate**: Simple parsing for Simple Search, AI for Smart/Chat
4. **Performance First**: Fast deterministic parsing when possible

### **Syntax Components**

#### **1. Keywords (Content Search)**
```
bug fix                    → Search for "bug" AND "fix" in content
"urgent meeting"           → Exact phrase search
search: deployment         → Explicit keyword search (Todoist-style)
```

#### **2. Priority Filters**
```
P1                         → Priority 1 (highest)
P2, P3, P4                 → Priority 2, 3, 4
p1 | p2                    → Priority 1 OR 2
!p1                        → NOT priority 1
priority:high              → Alias for P1
```

#### **3. Date Filters**
```
# Relative dates (natural language)
today                      → Due today
tomorrow                   → Due tomorrow
overdue                    → Overdue tasks
1d                         → Due in 1 day
1w, 2w                     → Due in 1/2 weeks
1m                         → Due in 1 month
next week                  → Due next week
this friday                → Due this Friday

# Date ranges
due before: May 5          → Due before specific date
due after: Jan 1           → Due after specific date
due: this week             → Due this week
no date                    → No due date
!no date                   → Has due date

# Shortcuts (Todoist-style)
od, over due               → Overdue (alias)
```

#### **4. Status Filters**
```
status:open                → Open tasks ([ ])
status:completed           → Completed tasks ([x])
status:inProgress          → In progress tasks
status:important           → Important status (user-defined)
!status:completed          → Not completed

# Shortcuts for user categories
open, completed, important, bookmark, waiting, cancelled
```

#### **5. Tag/Folder Filters**
```
#urgent                    → Tag "urgent"
#backend | #frontend       → Tag "backend" OR "frontend"
folder:"Projects/Work"     → In specific folder
```

#### **6. Boolean Operators**
```
&                          → AND
|                          → OR
!                          → NOT
()                         → Grouping
```

---

## 📋 **IMPLEMENTATION PLAN (REFINED)**

### **Current Status**
- ✅ **Smart Search & Task Chat**: Already have AI parser with property understanding
- ❌ **Simple Search**: Needs NEW pure deterministic implementation

### **PHASE 1: Simple Search Deterministic Parser** (Week 1-2) ⭐ HIGHEST PRIORITY

#### **Architecture Overview**

```typescript
UnifiedQueryParser
├─ PropertyParser (deterministic)
│  ├─ PriorityExtractor (regex)
│  ├─ DateExtractor (regex + chrono-node)
│  ├─ StatusExtractor (regex)
│  └─ TagExtractor (regex)
│
├─ KeywordExtractor (mode-dependent)
│  ├─ Simple: Regex-based extraction
│  ├─ Smart: AI semantic expansion
│  └─ Chat: AI semantic expansion
│
└─ DataViewConverter
   ├─ Properties → WHERE clauses
   └─ Keywords → Content filters
```

#### **Task 1.1: Create Unified Query Parser**

**File**: `src/services/unifiedQueryParser.ts` (NEW)

**Core Concept:**
- **Properties**: Always parsed deterministically (100% accurate, instant)
- **Keywords**: Parsed based on mode (simple = regex, smart/chat = AI)
- **Output**: Always DataView API format

**Features:**
- Single unified parser for all modes
- Mode parameter controls keyword intelligence level
- Properties always use deterministic parsing (fast, reliable)
- Converts to DataView API format automatically

**Architecture:**
```typescript
interface UnifiedQueryFilter {
    // Keywords
    keywords: string[];                    // Content search terms
    exactPhrases: string[];                // Exact phrase matches
    
    // Properties
    priority: number | number[] | null;    // P1, P2, P3, P4, or [1,2]
    dueDate: DateFilter | null;            // Single date or range
    status: string | string[] | null;      // open, completed, etc.
    tags: string[];                        // #urgent, #backend
    folder: string | null;                 // Projects/Work
    
    // Metadata
    hasDate: boolean | null;               // !no date, no date
    
    // Boolean logic
    operators: {
        keywordOperator: 'AND' | 'OR';     // Between keywords
        filterOperator: 'AND' | 'OR';      // Between filters
    };
    
    // Original query
    originalQuery: string;
    queryType: 'keywords-only' | 'properties-only' | 'mixed' | 'empty';
}

interface DateFilter {
    type: 'single' | 'range' | 'relative' | 'comparison';
    value?: string;                        // "2025-01-21"
    range?: { start: string; end: string }; // { start: "2025-01-21", end: "2025-01-28" }
    relative?: string;                     // "today", "next week", "+1d"
    comparison?: {
        operator: 'before' | 'after' | 'equals';
        date: string;
    };
}
```

**Parsing Strategy:**
```typescript
class UnifiedQueryParser {
    // Mode-specific entry points
    static parseSimple(query: string): UnifiedQueryFilter;    // Regex-based
    static parseSmart(query: string): Promise<UnifiedQueryFilter>;  // AI-enhanced
    static parseChat(query: string): Promise<UnifiedQueryFilter>;   // Full AI
    
    // Core parsing functions
    private static extractKeywords(query: string): string[];
    private static extractPriority(query: string): number | number[] | null;
    private static extractDateFilters(query: string): DateFilter | null;
    private static extractStatusFilters(query: string): string | string[] | null;
    private static extractTags(query: string): string[];
    private static extractBooleanOperators(query: string): OperatorMap;
}
```

#### **Task 1.2: Natural Language Date Parser**

**File**: `src/services/naturalDateParser.ts` (NEW)

**Features:**
- Parse natural language dates using `chrono-node` library
- Convert to ISO format for DataView
- Handle relative dates, ranges, offsets

**Examples:**
```typescript
NaturalDateParser.parse("today")           → "2025-01-21"
NaturalDateParser.parse("next week")       → "2025-01-27"
NaturalDateParser.parse("5 days ago")      → "2025-01-16"
NaturalDateParser.parse("this friday")     → "2025-01-24"
NaturalDateParser.parseRange("this week")  → { start: "2025-01-20", end: "2025-01-26" }
```

**Library Integration:**
```bash
npm install chrono-node --save
```

#### **Task 1.3: Query Syntax Validator**

**File**: `src/services/querySyntaxValidator.ts` (NEW)

**Features:**
- Validate query syntax
- Provide helpful error messages
- Suggest corrections

**Examples:**
```typescript
// Invalid: p5 (should be p1-p4)
{ valid: false, error: "Invalid priority: p5. Valid: p1, p2, p3, p4" }

// Invalid: date: invalid
{ valid: false, error: "Cannot parse date: 'invalid'. Try: today, tomorrow, 2025-01-21" }

// Valid
{ valid: true }
```

---

### **PHASE 2: Simple Search Enhancement** (Week 2-3)

#### **Task 2.1: Regex-Based Property Parser**

**File**: `src/services/simplePropertyParser.ts` (NEW)

**Features:**
- Fast regex-based parsing (no AI)
- Extract all property filters
- 10-100x faster than AI parsing

**Regex Patterns:**
```typescript
const PATTERNS = {
    // Priority: p1, p2, p3, p4, P1, priority:high
    priority: /\b(?:p|P)([1-4])\b|priority:\s*(high|medium|low|none)/gi,
    
    // Date shortcuts: 1d, 1w, 2w, 1m, today, tomorrow, overdue
    dateShortcut: /\b(\d+[dwm]|today|tomorrow|overdue|od)\b/gi,
    
    // Date ranges: date before: May 5, date after: Jan 1
    dateRange: /date\s+(before|after):\s*([^\s&|]+)/gi,
    
    // Status: status:open, status:completed, or just: open, completed
    status: /(?:status:)?(\w+)/gi,
    
    // Tags: #urgent, #backend
    tags: /#(\w+)/gi,
    
    // Folder: folder:"Projects/Work"
    folder: /folder:\s*["']([^"']+)["']/gi,
    
    // Boolean: &, |, !
    operators: /(&|\||!)/g,
};
```

**Performance:**
- Regex parsing: **~0.1ms** per query
- AI parsing: **~500-1000ms** per query
- **5,000-10,000x faster!**

#### **Task 2.2: Enhanced Simple Search Service**

**File**: `src/services/taskSearchService.ts` (MODIFY)

**Current Flow:**
```typescript
// BEFORE (only keywords)
Simple Search → Extract keywords (regex) → Filter by keywords → Score → Sort
```

**New Flow:**
```typescript
// AFTER (keywords + properties)
Simple Search → Parse query (regex) → Extract keywords & properties
    ↓
Filter by keywords (DataView substring match)
    ↓
Filter by priority (if specified)
    ↓
Filter by date (if specified)
    ↓
Filter by status (if specified)
    ↓
Filter by tags (if specified)
    ↓
Score by relevance → Sort → Return
```

**Code Changes:**
```typescript
// Add new method
static async executeSimpleSearchWithProperties(
    query: string,
    allTasks: Task[],
    settings: PluginSettings,
): Promise<Task[]> {
    // 1. Parse query with regex (fast!)
    const filter = SimplePropertyParser.parse(query);
    
    // 2. Apply keyword filter
    let filtered = this.filterByKeywords(allTasks, filter.keywords);
    
    // 3. Apply property filters (if specified)
    if (filter.priority !== null) {
        filtered = filtered.filter(t => 
            this.matchesPriority(t, filter.priority)
        );
    }
    
    if (filter.dueDate !== null) {
        filtered = filtered.filter(t => 
            this.matchesDate(t, filter.dueDate)
        );
    }
    
    if (filter.status !== null) {
        filtered = filtered.filter(t => 
            this.matchesStatus(t, filter.status, settings)
        );
    }
    
    // 4. Score and sort
    return this.scoreAndSort(filtered, filter, settings);
}
```

---

### **PHASE 3: Smart Search & Task Chat Enhancement** (Week 3-4)

#### **Task 3.1: AI Query Parser Enhancement**

**File**: `src/services/queryParserService.ts` (MODIFY)

**Current:**
- AI extracts keywords, priority, dueDate, status
- Semantic expansion for keywords

**Enhancements:**
1. **Recognize unified syntax** (priority: P1, date: 1d, etc.)
2. **Parse natural language dates** using chrono-node
3. **Extract boolean operators** (AND, OR, NOT)
4. **Support exact phrases** ("urgent meeting")

**New AI Prompt Section:**
```
UNIFIED QUERY SYNTAX SUPPORT:

The system now supports Todoist-style query syntax for precise filtering:

1. PRIORITY FILTERS:
   - "P1", "p1", "priority:high" → priority: 1
   - "P2 | P3" → priority: [2, 3] (array for OR)
   - "!P1" → Exclude P1 tasks

2. DATE FILTERS (Natural Language):
   - "1d", "1w", "2w", "1m" → Relative dates
   - "today", "tomorrow", "overdue" → Named dates
   - "next week", "this friday" → Natural language
   - "date before: May 5" → Comparison
   - "no date", "!no date" → Has/doesn't have date

3. STATUS FILTERS:
   - "status:open", "open" → status: "open"
   - "status:completed | status:cancelled" → status: ["completed", "cancelled"]
   - User-defined: "important", "bookmark", "waiting"

4. BOOLEAN OPERATORS:
   - "&" = AND between filters
   - "|" = OR between filters  
   - "!" = NOT (exclusion)
   - "()" = Grouping

EXAMPLES:
- "bug P1 overdue" → keywords:["bug"], priority:1, dueDate:"overdue"
- "meeting 1w & !p1" → keywords:["meeting"], dueDate:"+1w", priority:![1]
- "status:open & (p1 | p2)" → status:"open", priority:[1,2]
```

#### **Task 3.2: Semantic Expansion + Property Filters**

**Strategy:**
- AI expands **keywords** semantically (existing feature)
- **Properties** are extracted deterministically (new)
- Combine both for powerful filtering

**Example:**
```
Query: "bug fix P1 1w"

AI Processing:
1. Extract keywords: ["bug", "fix"]
2. Expand keywords: ["bug", "error", "issue", "defect", "fix", "repair", "solve", ...]
3. Extract properties: { priority: 1, dueDate: "+1w" }

Result:
- Semantic keyword matching (cross-language)
- Precise property filtering
- Best of both worlds!
```

---

### **PHASE 4: DataView API Integration** (Week 4-5)

#### **Task 4.1: Enhanced DataView Query Builder**

**File**: `src/services/dataviewQueryBuilder.ts` (NEW)

**Purpose**: Generate optimized DataView queries from unified filters

**Example:**
```typescript
class DataViewQueryBuilder {
    static buildQuery(filter: UnifiedQueryFilter): string {
        let query = 'TASK\n';
        
        // Add WHERE clauses for properties
        const whereClauses: string[] = [];
        
        if (filter.priority !== null) {
            if (Array.isArray(filter.priority)) {
                whereClauses.push(
                    `(${filter.priority.map(p => `priority = ${p}`).join(' OR ')})`
                );
            } else {
                whereClauses.push(`priority = ${filter.priority}`);
            }
        }
        
        if (filter.dueDate !== null) {
            whereClauses.push(this.buildDateClause(filter.dueDate));
        }
        
        if (filter.status !== null) {
            if (Array.isArray(filter.status)) {
                whereClauses.push(
                    `(${filter.status.map(s => `status = "${s}"`).join(' OR ')})`
                );
            } else {
                whereClauses.push(`status = "${filter.status}"`);
            }
        }
        
        if (whereClauses.length > 0) {
            query += 'WHERE ' + whereClauses.join(' AND ') + '\n';
        }
        
        return query;
    }
}
```

#### **Task 4.2: Performance Optimization**

**Strategies:**

1. **Property-first filtering** (fastest)
   ```typescript
   // Filter by properties first (DataView indexes)
   tasks = await dataview.query(`
       TASK WHERE priority = 1 AND due < date(today)
   `);
   
   // Then filter by keywords (slower but smaller set)
   tasks = tasks.filter(t => matchesKeywords(t, keywords));
   ```

2. **Cached property values**
   ```typescript
   // Cache property extraction to avoid re-parsing
   const propertyCache = new Map<string, TaskProperties>();
   ```

3. **Incremental filtering**
   ```typescript
   // Apply filters in order of selectivity
   // (priority first, then date, then keywords)
   ```

---

### **PHASE 5: User Interface & Documentation** (Week 5-6)

#### **Task 5.1: Query Syntax Help**

**Location**: Settings tab + In-app help modal

**Contents:**
```markdown
# Query Syntax Guide

## Basic Searches

**Keywords**: Just type what you're looking for
- `bug fix` → Tasks containing "bug" AND "fix"
- `"urgent meeting"` → Exact phrase

## Priority Filters

- `P1` or `p1` → Priority 1 (highest)
- `P2`, `P3`, `P4` → Lower priorities
- `p1 | p2` → Priority 1 OR 2
- `!p1` → NOT priority 1

## Date Filters

**Shortcuts:**
- `1d` → Due in 1 day
- `1w`, `2w` → Due in 1/2 weeks
- `1m` → Due in 1 month

**Natural Language:**
- `today`, `tomorrow`
- `next week`, `this friday`
- `overdue` or `od`

**Ranges:**
- `date before: May 5`
- `date after: Jan 1`
- `no date` → No due date

## Status Filters

- `status:open` or just `open`
- `status:completed` or `completed`
- `status:important` → Custom status

## Tags & Folders

- `#urgent` → Tag "urgent"
- `#backend | #frontend` → Multiple tags
- `folder:"Projects/Work"` → Specific folder

## Boolean Operators

- `&` → AND
- `|` → OR
- `!` → NOT

## Examples

```
bug P1 overdue
→ High priority overdue bugs

meeting 1w & !p1
→ Meetings due in 1 week, excluding P1

status:open & (p1 | p2)
→ Open tasks with priority 1 or 2

#urgent & date: today
→ Urgent tasks due today
```
```

#### **Task 5.2: Query Builder UI** (Optional)

**Interactive query builder** for users unfamiliar with syntax:

```
┌─────────────────────────────────────┐
│ Query Builder                        │
├─────────────────────────────────────┤
│ Keywords: [bug fix_____________]    │
│                                      │
│ Priority: [ ] Any                    │
│          [x] P1  [ ] P2             │
│          [ ] P3  [ ] P4             │
│                                      │
│ Due Date: [v] Today                  │
│          [ ] Tomorrow                │
│          [ ] This week               │
│          [ ] Overdue                 │
│          [ ] Custom: [___]          │
│                                      │
│ Status:  [v] Open                    │
│          [ ] Completed               │
│          [ ] In Progress             │
│          [ ] Custom...               │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ Generated Query:                 │ │
│ │ bug fix & P1 & today & open      │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [Search]  [Clear]                   │
└─────────────────────────────────────┘
```

#### **Task 5.3: Comprehensive Documentation**

**Files to Create:**

1. **USER_GUIDE_QUERY_SYNTAX.md**
   - Complete syntax reference
   - Examples for each feature
   - Tips and best practices

2. **MIGRATION_GUIDE.md**
   - How existing queries work
   - New features available
   - Backwards compatibility notes

3. **API_DOCUMENTATION.md**
   - For developers/plugin authors
   - Integration examples
   - Extension points

---

## 🎯 **PERFORMANCE TARGETS**

### **Simple Search (Regex-Based)**
- **Parsing**: < 1ms per query
- **Filtering**: < 50ms for 1000 tasks
- **Total**: < 100ms end-to-end

### **Smart Search (AI-Enhanced)**
- **AI Parsing**: ~500ms (semantic expansion)
- **Filtering**: < 50ms for 1000 tasks
- **Total**: < 600ms end-to-end

### **Task Chat (Full AI)**
- **AI Parsing**: ~500ms
- **Filtering**: < 50ms
- **AI Analysis**: ~2000ms
- **Total**: ~2500ms end-to-end

---

## 📊 **SUCCESS METRICS**

1. **Performance**
   - Simple Search < 100ms
   - 90% of queries under 600ms
   - No query over 3 seconds

2. **Accuracy**
   - Property filters: 100% accurate
   - Date parsing: 95%+ accurate
   - Status matching: 100% accurate

3. **User Adoption**
   - 50%+ of queries use new syntax within 1 month
   - Positive feedback on performance
   - Reduced "no results" queries

4. **Backwards Compatibility**
   - 100% of existing queries still work
   - No breaking changes

---

## 🔄 **MIGRATION STRATEGY**

### **Phase 1: Soft Launch (Week 1-2)**
- Enable new parser alongside old
- Log usage statistics
- Collect feedback

### **Phase 2: Gradual Rollout (Week 3-4)**
- Default to new parser
- Show "upgrade to new syntax" hints
- Provide migration examples

### **Phase 3: Full Launch (Week 5-6)**
- New parser is default
- Old parser remains as fallback
- Documentation complete

---

## 🎓 **DEVELOPER NOTES**

### **Key Design Decisions**

1. **Why regex for Simple Search?**
   - 5,000-10,000x faster than AI
   - Deterministic and reliable
   - No API costs
   - Instant feedback

2. **Why keep AI for Smart Search?**
   - Semantic expansion invaluable
   - Cross-language matching
   - Context understanding
   - Natural language flexibility

3. **Why unified syntax?**
   - Consistent user experience
   - Easier to learn once
   - Progressive enhancement
   - Mode-appropriate parsing

### **Testing Strategy**

```typescript
// Unit tests for each parser
describe('UnifiedQueryParser', () => {
    describe('Simple Mode (Regex)', () => {
        it('parses priority filters', () => {
            expect(parseSimple('bug P1')).toEqual({
                keywords: ['bug'],
                priority: 1
            });
        });
        
        it('parses date shortcuts', () => {
            expect(parseSimple('meeting 1w')).toEqual({
                keywords: ['meeting'],
                dueDate: { type: 'relative', value: '+1w' }
            });
        });
    });
    
    describe('Smart Mode (AI)', () => {
        it('expands keywords semantically', async () => {
            const result = await parseSmart('fix bug');
            expect(result.keywords.length).toBeGreaterThan(10);
        });
    });
});
```

---

## 📝 **NEXT STEPS**

1. **Review this plan** with user for feedback
2. **Prioritize phases** based on user needs
3. **Start with Phase 1** (Query Parser Enhancement)
4. **Iterate based on feedback**

---

## 🎉 **EXPECTED OUTCOMES**

### **For Users:**
✅ **Faster searches** - Simple Search with properties is 100x faster
✅ **More powerful** - Combine keywords + properties + boolean logic
✅ **Intuitive syntax** - Natural language dates, simple operators
✅ **Consistent** - Same syntax across all modes
✅ **Well-documented** - Comprehensive guides and examples

### **For Developers:**
✅ **Cleaner architecture** - Unified parser, modular design
✅ **Better performance** - Regex for simple, AI for complex
✅ **Easier testing** - Deterministic parsing
✅ **More maintainable** - Single source of truth

### **For the Plugin:**
✅ **Competitive feature set** - Match/exceed Todoist capabilities
✅ **Unique advantage** - AI semantic expansion + property filters
✅ **Better UX** - Fast, accurate, powerful
✅ **Future-proof** - Extensible syntax system

---

**Status**: 📋 **PLAN COMPLETE** - Ready for review and implementation!
