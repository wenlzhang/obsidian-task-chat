# Implementation Master Guide

**Last Updated**: 2025-01-21  
**Status**: Phase 0 Complete, Ready for Phase 1  
**Timeline**: 4 weeks total

---

## 📍 **Current Status**

```
✅ Phase 0: Planning & Architecture     (Week 0) - COMPLETE
⏳ Phase 1: Simple Search Parser        (Week 1-2) - READY TO START
📋 Phase 2: DataView Enhancement        (Week 2-3) - PLANNED
📋 Phase 3: Smart/Chat Enhancement      (Week 3-4) - PLANNED
📋 Phase 4: User Documentation          (Week 4) - PLANNED
```

---

## 🎯 **What We're Building**

### **User's Three-Part Query Framework**
```
Part 1: Keywords          → "bug fix" (content search)
Part 2: Task Properties   → "P1 overdue" (structured filters)
Part 3: External Context  → Future: user, time, energy, location
```

### **Mode-Specific Intelligence**
```
Simple Search:  Pure deterministic (regex, no AI, <100ms, $0)
Smart Search:   Hybrid (deterministic baseline + AI enhancement)
Task Chat:      Hybrid (deterministic baseline + AI enhancement)
```

---

## 🔍 **Existing Infrastructure**

### **What Already Works** ✅

Your `src/services/dataviewService.ts` (960 lines) provides:

1. **DataView API Integration** (line 20-28)
   ```typescript
   static getAPI(app: App): any
   static isDataviewEnabled(app: App): boolean
   ```

2. **Property Filtering** (line 593-796)
   ```typescript
   buildTaskFilter(intent, settings)  // Filters by priority, date, status
   ```

3. **Task Parsing** (line 810-892)
   ```typescript
   parseTasksFromDataview(app, settings, dateFilter, propertyFilters)
   ```

4. **Mapping Functions**
   ```typescript
   mapPriority(value, settings)        // Line 63-83
   mapStatusToCategory(symbol, settings)  // Line 32-57
   convertDateFilterToRange(dateFilter)   // Line 511-577
   ```

### **What We're Adding** 🆕

- Phase 1: Simple Search deterministic parser
- Phase 2: Enhanced date parsing (chrono-node), Todoist syntax
- Phase 3: Deterministic baseline for AI parser
- Phase 4: User documentation

---

## 📋 **Phase 1: Simple Search Parser** (Week 1)

### **Status**: ✅ **CORE COMPLETE**

**Started**: 2025-01-21  
**Core Implementation**: 2025-01-21  
**Test Results**: 25/25 tests passed ✅

### **Goals**
- Pure regex-based property parser (NO AI)
- Integration with existing DataView infrastructure
- Performance: < 100ms, Cost: $0, Accuracy: 100%

### **Files to Create**

#### **1.1 SimplePropertyParser**

**File**: `src/services/simplePropertyParser.ts` (NEW)

**Purpose**: Parse query using regex, output DataView-compatible format

**Implementation**:
```typescript
import { moment } from "obsidian";

export class SimplePropertyParser {
    /**
     * Parse query using regex patterns
     * Output format matches DataviewService.parseTasksFromDataview()
     */
    static parse(query: string): {
        priority?: number | number[];
        dueDate?: string;
        dueDateRange?: { start?: string; end?: string };
        status?: string | string[];
        tags?: string[];
        folder?: string;
    } {
        const result: any = {};
        
        // Priority: P1, p2, P3, P4
        const priorityMatch = query.match(/\b[pP]([1-4])\b/);
        if (priorityMatch) {
            result.priority = parseInt(priorityMatch[1]);
        }
        
        // Date shortcuts: today, tomorrow, overdue, 1d, 1w, 1m
        if (/\btoday\b/i.test(query)) {
            result.dueDate = "today";
        } else if (/\btomorrow\b/i.test(query)) {
            result.dueDate = "tomorrow";
        } else if (/\b(overdue|od)\b/i.test(query)) {
            result.dueDate = "overdue";
        } else {
            const relMatch = query.match(/\b(\d+)([dwm])\b/);
            if (relMatch) {
                result.dueDate = `+${relMatch[1]}${relMatch[2]}`;
            }
        }
        
        // Date ranges: "date before: May 5"
        const rangeMatch = query.match(/date\s+(before|after):\s*([^\s&|]+)/i);
        if (rangeMatch) {
            const operator = rangeMatch[1].toLowerCase();
            const dateStr = rangeMatch[2].trim();
            const parsed = moment(dateStr);
            
            if (parsed.isValid()) {
                result.dueDateRange = operator === "before" 
                    ? { end: parsed.format("YYYY-MM-DD") }
                    : { start: parsed.format("YYYY-MM-DD") };
            }
        }
        
        // Tags: #urgent, #backend
        const tagMatches = [...query.matchAll(/#(\w+)/g)];
        if (tagMatches.length > 0) {
            result.tags = tagMatches.map(m => m[1]);
        }
        
        // Folder: folder:"Projects/Work"
        const folderMatch = query.match(/folder:\s*["']([^"']+)["']/i);
        if (folderMatch) {
            result.folder = folderMatch[1];
        }
        
        return result;
    }
    
    /**
     * Extract keywords after removing property tokens
     */
    static extractKeywords(query: string): string[] {
        let remaining = query;
        
        // Remove property tokens
        remaining = remaining.replace(/\b[pP][1-4]\b/g, '');
        remaining = remaining.replace(/\b(today|tomorrow|overdue|od)\b/gi, '');
        remaining = remaining.replace(/\b\d+[dwm]\b/g, '');
        remaining = remaining.replace(/date\s+(before|after):[^\s&|]+/gi, '');
        remaining = remaining.replace(/#\w+/g, '');
        remaining = remaining.replace(/folder:\s*["'][^"']+["']/gi, '');
        
        // Extract keywords
        return remaining
            .split(/[\s&|!()]+/)
            .map(k => k.trim().toLowerCase())
            .filter(k => k.length > 0);
    }
}
```

**Estimated**: ~150 lines, 2-3 hours

#### **1.2 Integration with TaskSearchService**

**File**: `src/services/taskSearchService.ts` (MODIFY)

**Add new method**:
```typescript
import { SimplePropertyParser } from './simplePropertyParser';
import { DataviewService } from './dataviewService';

/**
 * Execute Simple Search with deterministic parsing
 */
static async executeSimpleSearch(
    query: string,
    app: App,
    settings: PluginSettings,
): Promise<Task[]> {
    console.log('[Simple Search] Starting...');
    const startTime = performance.now();
    
    // Step 1: Parse properties (deterministic, ~0.1ms)
    const properties = SimplePropertyParser.parse(query);
    console.log('[Simple Search] Properties:', properties);
    
    // Step 2: Extract keywords
    const keywords = SimplePropertyParser.extractKeywords(query);
    console.log('[Simple Search] Keywords:', keywords);
    
    // Step 3: Use EXISTING DataviewService
    const tasks = await DataviewService.parseTasksFromDataview(
        app,
        settings,
        properties.dueDate,
        {
            priority: properties.priority,
            dueDate: properties.dueDate,
            dueDateRange: properties.dueDateRange,
            status: properties.status,
        }
    );
    
    console.log(`[Simple Search] DataView filtered: ${tasks.length}`);
    
    // Step 4: Filter by keywords
    let filtered = tasks;
    if (keywords.length > 0) {
        filtered = tasks.filter(task => 
            keywords.some(kw => task.text.toLowerCase().includes(kw))
        );
    }
    
    // Step 5: Filter by tags
    if (properties.tags?.length > 0) {
        filtered = filtered.filter(task =>
            properties.tags!.some(tag => task.tags.includes(tag))
        );
    }
    
    // Step 6: Filter by folder
    if (properties.folder) {
        filtered = filtered.filter(task => task.folder === properties.folder);
    }
    
    // Step 7: Score (existing method)
    const scored = this.scoreTasksByRelevance(
        filtered,
        keywords,
        keywords,
        true,
        settings
    );
    
    // Step 8: Sort (existing method)
    const sorted = TaskSortService.sortTasksMultiCriteria(
        scored,
        settings.taskSortOrder
    );
    
    console.log(`[Simple Search] Total: ${(performance.now() - startTime).toFixed(2)}ms`);
    return sorted;
}
```

**Estimated**: ~100 lines, 2-3 hours

### **Testing Requirements**

**See**: [`TEST_FRAMEWORK.md`](./TEST_FRAMEWORK.md) for complete test suite

1. **Unit Tests**: Run `node test-scripts/phase1-parser-test.js`
   - 18 test cases covering all property types
   - Expected: 18/18 passed (100%)

2. **Integration Tests**: Test with existing DataView
   - Use test vault with sample tasks
   - Verify DataviewService integration

3. **Performance Tests**: Verify < 100ms execution
   - Run 100 iterations
   - Measure average execution time
   - Expected: < 100ms average

4. **Accuracy Tests**: Verify 100% property extraction
   - All regex patterns working
   - Keywords extracted correctly
   - Properties never missed

### **Deliverables**
- ✅ `simplePropertyParser.ts` created
- ✅ `taskSearchService.ts` modified
- ✅ Unit tests passing
- ✅ Integration tests passing
- ✅ Performance < 100ms verified
- ✅ Documentation updated

---

## 📋 **Phase 2: DataView Enhancement** (Week 2-3)

### **Status**: 📋 **PLANNED**

### **Goals**
- Add chrono-node for natural language dates
- Add Todoist syntax support
- Enhance existing DataView methods (NOT build new)

### **Files to Modify**

#### **2.1 Add Natural Language Date Parsing**

**File**: `src/services/dataviewService.ts` (MODIFY existing method)

**Method**: `convertDateFilterToRange()` (line 511-577)

**Enhancement**:
```typescript
import * as chrono from 'chrono-node';

static convertDateFilterToRange(dateFilter: string): {
    start?: string;
    end?: string;
} | null {
    // Keep ALL existing cases
    const today = moment().startOf("day");
    
    switch (dateFilter) {
        case "any":
            return {};
        case "today":
            return { start: today.format("YYYY-MM-DD"), end: today.format("YYYY-MM-DD") };
        // ... all existing cases ...
    }
    
    // ADD: Natural language parsing with chrono-node
    const parsed = chrono.parseDate(dateFilter);
    if (parsed) {
        const dateStr = moment(parsed).format("YYYY-MM-DD");
        return { start: dateStr, end: dateStr };
    }
    
    // Keep existing fallback
    const parsedDate = moment(dateFilter, "YYYY-MM-DD", true);
    if (parsedDate.isValid()) {
        return { start: parsedDate.format("YYYY-MM-DD"), end: parsedDate.format("YYYY-MM-DD") };
    }
    
    return null;
}
```

**Installation**:
```bash
npm install chrono-node --save
npm install @types/chrono-node --save-dev
```

**Estimated**: ~50 lines added, 2 hours

#### **2.2 Add Todoist Syntax Support**

**File**: `src/services/dataviewService.ts` (ADD new method)

**New method**:
```typescript
/**
 * Convert Todoist-style syntax to DataView-compatible format
 */
static parseTodoistSyntax(query: string): {
    keywords?: string[];
    priority?: number;
    dueDate?: string;
    dueDateRange?: { start?: string; end?: string };
} {
    const result: any = {};
    
    // "search: meeting"
    const searchMatch = query.match(/search:\s*([^\s&|]+)/i);
    if (searchMatch) {
        result.keywords = [searchMatch[1].trim()];
    }
    
    // "p1", "p2"
    const priorityMatch = query.match(/\bp([1-4])\b/i);
    if (priorityMatch) {
        result.priority = parseInt(priorityMatch[1]);
    }
    
    // "date before: May 5"
    const dateBeforeMatch = query.match(/date\s+before:\s*([^\s&|]+)/i);
    if (dateBeforeMatch) {
        const parsed = moment(dateBeforeMatch[1].trim());
        if (parsed.isValid()) {
            result.dueDateRange = { end: parsed.format("YYYY-MM-DD") };
        }
    }
    
    return result;
}
```

**Estimated**: ~50 lines, 1-2 hours

### **Testing Requirements**

1. Test natural language dates: "next Friday", "in 2 weeks"
2. Test Todoist syntax: "search: meeting & p1"
3. Verify backward compatibility (existing queries still work)

### **Deliverables**
- ✅ chrono-node installed
- ✅ `convertDateFilterToRange()` enhanced
- ✅ `parseTodoistSyntax()` added
- ✅ Tests passing
- ✅ Backward compatibility verified

---

## 📋 **Phase 3: Smart/Chat Enhancement** (Week 3-4)

### **Status**: 📋 **PLANNED**

### **Goals**
- Add deterministic baseline to existing AI parser
- Ensure properties are never missed (fallback to regex)
- Improve reliability

### **Files to Modify**

#### **3.1 Enhance Existing AI Parser**

**File**: `src/services/queryParserService.ts` (MODIFY existing method)

**Method**: `parseWithAI()` (existing)

**Enhancement**:
```typescript
import { SimplePropertyParser } from './simplePropertyParser';

async parseWithAI(
    query: string,
    settings: PluginSettings
): Promise<ParsedQuery> {
    // NEW: Add deterministic baseline (fast fallback)
    const baseline = SimplePropertyParser.parse(query);
    console.log('[AI Parser] Baseline:', baseline);
    
    // EXISTING: AI enhancement
    const aiResult = await this.callAI(query, settings);
    console.log('[AI Parser] AI result:', aiResult);
    
    // NEW: Merge (AI takes precedence, baseline fills gaps)
    const merged = {
        properties: {
            priority: aiResult.priority ?? baseline.priority,
            dueDate: aiResult.dueDate ?? baseline.dueDate,
            dueDateRange: aiResult.dueDateRange ?? baseline.dueDateRange,
            status: aiResult.status ?? baseline.status,
            tags: aiResult.tags?.length > 0 ? aiResult.tags : baseline.tags,
            folder: aiResult.folder ?? baseline.folder,
        },
        keywords: aiResult.keywords, // AI expansion always used
    };
    
    console.log('[AI Parser] Merged:', merged);
    
    // EXISTING: Use DataviewService
    return await DataviewService.parseTasksFromDataview(
        app,
        settings,
        merged.properties.dueDate,
        merged.properties
    );
}
```

**Estimated**: ~50 lines added, 2-3 hours

### **Testing Requirements**

1. Test AI enhancement: "high priority" → P1
2. Test fallback: If AI fails, baseline still works
3. Test merged results: Best of both worlds

### **Deliverables**
- ✅ `parseWithAI()` enhanced
- ✅ Baseline fallback working
- ✅ Smart Search tested
- ✅ Task Chat tested
- ✅ Reliability improved

---

## 📋 **Phase 4: User Documentation** (Week 4)

### **Status**: 📋 **PLANNED**

### **Goals**
- Update user-facing documentation
- Create comprehensive query syntax guide
- Add examples for all query types

### **Files to Update**

#### **4.1 Query Syntax Reference**

**File**: `docs/QUERY_SYNTAX_REFERENCE.md` (MODIFY)

**Sections to add/update**:
1. **Getting Started** - Basic queries
2. **Priority Filters** - P1-P4, priority:high
3. **Date Filters** - Natural language, Todoist syntax
4. **Status Filters** - User-defined status categories
5. **Tags & Folders** - #tag, folder:"path"
6. **Boolean Operators** - &, |, !
7. **Mode Differences** - Simple vs Smart vs Chat
8. **Examples** - Real-world use cases
9. **Troubleshooting** - Common issues

#### **4.2 User Guide**

**File**: `docs/USER_GUIDE_QUERIES.md` (NEW)

**Contents**:
1. **Quick Start** - Your first query
2. **Query Modes** - When to use Simple/Smart/Chat
3. **Common Patterns** - Frequently used queries
4. **Advanced Tips** - Power user features
5. **FAQ** - Common questions

### **Deliverables**
- ✅ `QUERY_SYNTAX_REFERENCE.md` updated
- ✅ `USER_GUIDE_QUERIES.md` created
- ✅ Examples tested
- ✅ Screenshots added
- ✅ Ready for users

---

## 📊 **Integration Points**

### **How Everything Connects**

```
┌─────────────────────────────────┐
│ USER QUERY                       │
│ "bug fix P1 overdue"            │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ PARSING LAYER                    │
│ (Mode-Dependent)                 │
├─────────────────────────────────┤
│ Simple: SimplePropertyParser     │
│ Smart:  AI + SimplePropertyParser│
│ Chat:   AI + SimplePropertyParser│
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ DATAVIEW SERVICE                 │
│ (EXISTING - 960 lines)          │
├─────────────────────────────────┤
│ parseTasksFromDataview()        │
│   ├─ buildTaskFilter()          │
│   ├─ mapPriority()              │
│   ├─ convertDateFilterToRange() │
│   └─ processTaskRecursively()   │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ POST-PROCESSING                  │
│ Score → Sort → Display/Chat     │
└─────────────────────────────────┘
```

---

## ✅ **Acceptance Criteria**

### **Phase 1**
- [ ] Simple Search uses NO AI
- [ ] Properties parsed in < 1ms
- [ ] Total execution < 100ms
- [ ] Cost: $0
- [ ] Property accuracy: 100%
- [ ] Integrates with existing DataView

### **Phase 2**
- [ ] Natural language dates work ("next Friday")
- [ ] Todoist syntax supported
- [ ] Backward compatible
- [ ] No breaking changes

### **Phase 3**
- [ ] Deterministic baseline added
- [ ] AI enhancement still works
- [ ] Properties never missed
- [ ] Fallback tested

### **Phase 4**
- [ ] User documentation complete
- [ ] All examples tested
- [ ] Clear and comprehensive
- [ ] Ready for users

---

## 🚀 **Getting Started**

### **For Phase 1 Implementation**

1. **Read** existing `dataviewService.ts` (understand what's there)
2. **Create** `simplePropertyParser.ts` (new file)
3. **Modify** `taskSearchService.ts` (add executeSimpleSearch)
4. **Test** integration with DataView
5. **Verify** performance < 100ms

### **Development Workflow**

```bash
# 1. Create new branch
git checkout -b feature/unified-query-phase1

# 2. Implement Phase 1
# Create simplePropertyParser.ts
# Modify taskSearchService.ts

# 3. Test locally
npm run build
# Test in Obsidian

# 4. Commit and push
git add .
git commit -m "Phase 1: Simple Search deterministic parser"
git push origin feature/unified-query-phase1
```

---

## 📝 **Progress Tracking**

Update this section as phases complete:

```
[✅] Phase 0: Planning - COMPLETE (2025-01-21)
[ ] Phase 1: Simple Search - IN PROGRESS (Start: ___)
[ ] Phase 2: DataView Enhancement - PLANNED
[ ] Phase 3: Smart/Chat Enhancement - PLANNED
[ ] Phase 4: User Documentation - PLANNED
```

---

## 🔗 **Related Documents**

- [`00_START_HERE.md`](./00_START_HERE.md) - Master index
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Technical details
- [`PROJECT_HISTORY.md`](./PROJECT_HISTORY.md) - Design decisions

---

## 🧪 **Test Framework**

**Complete test suite available**: [`TEST_FRAMEWORK.md`](./TEST_FRAMEWORK.md)

### **Key Features**
- ✅ Test vault with DataView syntax tasks
- ✅ Automated test scripts for each phase
- ✅ AI simulation for Smart Search & Task Chat
- ✅ Performance benchmarking
- ✅ Documentation update workflow

### **Test Scripts**
- `test-scripts/phase1-parser-test.js` - Phase 1 unit tests
- `test-scripts/ai-simulation-test.md` - AI simulation reference

### **Documentation Workflow**
**See**: [`DOCUMENTATION_UPDATE_WORKFLOW.md`](./DOCUMENTATION_UPDATE_WORKFLOW.md)
- After each feature: Update progress, test results
- After each phase: Create phase summary, update master docs
- Systematic approach to keeping all docs current

---

**Last Updated**: 2025-01-21  
**Next Review**: After Phase 1 completion
