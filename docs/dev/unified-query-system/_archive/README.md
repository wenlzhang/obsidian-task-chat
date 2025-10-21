# Unified Query System Enhancement

**Created**: 2025-01-21  
**Status**: Planning Phase - Ready for Implementation

---

## 📂 **Directory Contents**

This directory contains all planning documents for the Unified Query System enhancement:

1. **[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)** - Start here! Quick overview of the entire enhancement
2. **[CLARIFIED_IMPLEMENTATION_PLAN.md](./CLARIFIED_IMPLEMENTATION_PLAN.md)** - **UPDATED** plan reflecting existing DataView infrastructure
3. **[ARCHITECTURE_REFINEMENT_2025-01-21.md](./ARCHITECTURE_REFINEMENT_2025-01-21.md)** - How user feedback shaped the architecture
4. **[HYBRID_QUERY_ARCHITECTURE.md](./HYBRID_QUERY_ARCHITECTURE.md)** - Deep technical dive into hybrid deterministic+AI approach
5. **[UNIFIED_QUERY_SYSTEM_PLAN_2025-01-21.md](./UNIFIED_QUERY_SYSTEM_PLAN_2025-01-21.md)** - Original comprehensive plan

---

## 🎯 **What We're Building**

### **User's Three-Part Query Framework**
```
Part 1: Keywords          → "bug fix"
Part 2: Task Properties   → "P1 overdue"
Part 3: External Context  → Future: user, time, energy, location
```

### **Mode-Specific Intelligence**
```
Simple Search:     Pure deterministic (NEW)
                   → Regex parsing, no AI, <100ms, $0

Smart Search:      Hybrid (ENHANCE existing)
                   → Deterministic baseline + AI enhancement
                   
Task Chat:         Hybrid (ENHANCE existing)
                   → Deterministic baseline + AI enhancement
```

---

## 🔍 **Key Discovery: Existing DataView Infrastructure**

### **What Already Exists** ✅

Your `dataviewService.ts` already has:

1. **DataView API Integration** (line 20-28)
   - `getAPI()` - Access to DataView JavaScript API
   - Full integration with Obsidian DataView plugin

2. **Property Filtering** (line 593-796)
   - `buildTaskFilter()` - Filters by priority, due date, status
   - Task-level filtering (not just page-level)
   - Recursive child task processing

3. **Priority Mapping** (line 63-83)
   - `mapPriority()` - Maps DataView priorities to 1-4
   - User-configurable mappings

4. **Date Filtering** (line 511-577)
   - `convertDateFilterToRange()` - Converts date filters
   - Supports: today, tomorrow, overdue, week, etc.

5. **Status Mapping** (line 32-57)
   - `mapStatusToCategory()` - User-configured status categories
   - Flexible status system

6. **Comprehensive Task Parsing** (line 810-892)
   - `parseTasksFromDataview()` - Fetches and filters tasks
   - Property filters applied at load time
   - Efficient filtering

### **What We're Adding** 🆕

**Phase 1: Simple Search Deterministic Parser**
- NEW: Regex-based property parser for Simple Search
- NEW: Keyword extractor for Simple Search
- Integration: Feed into existing DataView filters

**Phase 2: Enhanced DataView Integration** (NOT building from scratch!)
- ENHANCE: `buildTaskFilter()` to handle new query formats
- ENHANCE: Add natural language date parsing (chrono-node)
- ENHANCE: Support Todoist-style syntax conversion

**Phase 3: Smart/Chat Enhancement**
- ENHANCE: Existing AI parser with deterministic baseline
- IMPROVE: Better natural language → property conversion

---

## 📋 **Revised Implementation Strategy**

### **Phase 1: Simple Search Parser** (Week 1-2) ⭐ **START HERE**

**Goal**: Pure deterministic parsing for Simple Search

**What to Build**:
```typescript
// NEW FILES:
src/services/simplePropertyParser.ts
src/services/simpleKeywordExtractor.ts

// MODIFY:
src/services/taskSearchService.ts
  └─ Add executeSimpleSearch() method
```

**How It Integrates**:
```typescript
// Simple Search Flow:
User Query: "bug P1 overdue"
  ↓
SimplePropertyParser.parse()
  → { priority: 1, dueDate: "overdue", keywords: ["bug"] }
  ↓
DataviewService.parseTasksFromDataview(app, settings, "overdue", {
  priority: 1
})
  → Uses EXISTING buildTaskFilter()
  → Uses EXISTING mapPriority()
  → Uses EXISTING convertDateFilterToRange()
  ↓
Filtered tasks from DataView ✅
```

### **Phase 2: DataView Enhancement** (Week 2-3)

**Goal**: Enhance existing DataView integration

**What to Enhance**:
```typescript
// ENHANCE EXISTING:
src/services/dataviewService.ts
  └─ buildTaskFilter() - Add support for new query formats
  └─ convertDateFilterToRange() - Add chrono-node for natural dates
  └─ Add parseTodoistSyntax() - Convert Todoist syntax to DataView format
```

**How It Works**:
```typescript
// Enhanced DataView Flow:
Query: "priority:high date before: next week"
  ↓
parseTodoistSyntax() // NEW
  → Convert to DataView-compatible format
  ↓
buildTaskFilter() // ENHANCED
  → priority: 1
  → dueDateRange: { end: "2025-01-28" }
  ↓
DataView API filters tasks ✅
```

### **Phase 3: Smart/Chat Enhancement** (Week 3-4)

**Goal**: Add deterministic baseline to existing AI parser

**What to Enhance**:
```typescript
// MODIFY EXISTING:
src/services/queryParserService.ts
  └─ parseWithAI() - Add deterministic baseline
  
// Use existing DataView:
AI parses: "high priority overdue bugs"
  ↓
Deterministic baseline: { priority: 1?, dueDate: "overdue" }
  ↓
AI enhancement: "high priority" → priority: 1 ✅
  ↓
DataviewService.parseTasksFromDataview() // EXISTING
  ↓
Filtered tasks ✅
```

---

## 🔧 **Key Architectural Clarification**

### **BEFORE (Misunderstanding)**:
- Thought we needed to build DataView integration from scratch
- Planned to create new converter service
- Duplicate effort!

### **AFTER (Correct Understanding)**:
- **DataView integration already exists** ✅
- **Property filtering already works** ✅
- **Just need to enhance and extend** ✅

### **What This Means**:

**Phase 1**: Build deterministic parser → Feed into existing DataView  
**Phase 2**: Enhance existing DataView methods → Add more query formats  
**Phase 3**: Enhance existing AI parser → Use existing DataView  

---

## 📊 **Updated Timeline**

### **Week 1-2: Simple Search Parser**
- Days 1-3: `SimplePropertyParser` (regex patterns)
- Days 4-5: `SimpleKeywordExtractor` (regex extraction)
- Days 6-7: Integration with existing DataView
- **Deliverable**: Simple Search working with DataView

### **Week 2-3: DataView Enhancement**
- Days 8-10: Add chrono-node date parsing
- Days 11-12: Add Todoist syntax support
- Days 13-14: Testing with all query formats
- **Deliverable**: Enhanced DataView handles more formats

### **Week 3-4: Smart/Chat Enhancement**
- Days 15-17: Add deterministic baseline to AI parser
- Days 18-19: Improve AI prompts
- Days 20-21: End-to-end testing
- **Deliverable**: Smart/Chat with fallback reliability

---

## 💡 **Benefits of This Approach**

### **1. Leverages Existing Infrastructure**
- ✅ DataView integration already robust
- ✅ Property filtering already works
- ✅ Task processing already optimized
- ✅ Less code to write and maintain

### **2. Incremental Enhancement**
- ✅ Build on proven foundation
- ✅ No risk of breaking existing functionality
- ✅ Can test each enhancement independently
- ✅ Easier to debug

### **3. Faster Implementation**
- ✅ Week 1-2: Simple Search (NEW but uses existing DataView)
- ✅ Week 2-3: DataView enhancement (MODIFY existing)
- ✅ Week 3-4: Smart/Chat (MODIFY existing)
- ✅ Total: 3-4 weeks instead of 6 weeks

---

## 📝 **Next Steps**

1. ✅ **Discovered existing DataView infrastructure**
2. ✅ **Revised plan to enhance, not rebuild**
3. ✅ **Organized documentation into subdirectory**
4. ⏳ **Awaiting user approval to start Phase 1**

Once approved, we'll start with:
- `SimplePropertyParser` (regex patterns for P1-P4, dates, etc.)
- Integration with existing `DataviewService.parseTasksFromDataview()`
- Testing with Simple Search mode

---

## 🎓 **For Future Reference**

### **When Adding New Query Features**:

1. **Parse the query** (Simple: regex, Smart/Chat: AI)
2. **Convert to DataView format** (use existing or enhance)
3. **Call `DataviewService.parseTasksFromDataview()`** (already optimized)
4. **Score and sort** (existing infrastructure)
5. **Display results** (existing)

### **Key Services**:
- `dataviewService.ts` - DataView integration (EXISTING)
- `simplePropertyParser.ts` - Simple mode parsing (NEW)
- `queryParserService.ts` - Smart/Chat parsing (ENHANCE)
- `taskSearchService.ts` - Search execution (MODIFY)

---

**Status**: 📋 Ready for Phase 1 implementation upon approval!
