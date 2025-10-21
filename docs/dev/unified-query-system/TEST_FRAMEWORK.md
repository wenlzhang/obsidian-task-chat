# Test Framework - Unified Query System

**Last Updated**: 2025-01-21  
**Status**: Ready for Phase 1 Testing

---

## 🎯 **Overview**

This document provides a comprehensive test framework for all phases of the unified query system implementation.

**Benefits**:
- ✅ No need to build plugin repeatedly
- ✅ Test each phase independently
- ✅ AI simulates Smart Search & Task Chat
- ✅ Automated verification
- ✅ Clear pass/fail criteria

---

## 📂 **Test Data**

### **Test Vault Structure**

Create a test vault: `test-vault-unified-query/`

```
test-vault-unified-query/
├── Tasks/
│   ├── Development.md
│   ├── Bugs.md
│   ├── Features.md
│   └── Research.md
├── Projects/
│   ├── TaskChat.md
│   └── Obsidian.md
└── Archive/
    └── Completed.md
```

### **Test Tasks** (DataView Syntax)

#### **File: `Tasks/Development.md`**

```markdown
# Development Tasks

## Active Development

- [ ] 如何开发 Task Chat 📝 2025-10-14T22:29 [p::2] [due::2025-10-25] #development #taskchat
- [?] 开发 Task Chat AI 响应功能 📝 2025-10-14T22:55 [p::2] [due::2025-10-22] #ai #development
- [ ] 开发 Task Chat 时间依赖功能 📝 2025-10-16T17:26 [due::2025-10-16] [p::1] #overdue #development
- [ ] 开发 Task Chat AI 模型配置功能 📝 2025-10-16T17:26 [due::2025-10-20] [p::1] #ai #configuration
- [ ] 开发 Task 聊天插件 📝 2025-10-17T20:40 [p::3] #development #plugin
- [ ] 开发 任务 Chat plugin 📝 2025-10-17T20:40 [p::2] [due::2025-10-23] #development #plugin
- [ ] Utveckla plugin-programmet Task Chat 📝 2025-10-17T20:51 [p::2] #development #swedish

## API & Integration

- [ ] 开发 Task Chat note link and #Tag support 📝 2025-10-19T12:05 [p::1] [due::2025-10-21] #api #integration [[TaskChat]] https://github.com/blacksmithgu/obsidian-dataview
- [ ] Implement DataView API integration 📝 2025-10-20T10:00 [p::1] [due::2025-10-22] #api #dataview
- [ ] Add chrono-node date parsing 📝 2025-10-20T11:00 [p::2] [due::2025-10-24] #enhancement #dates

## Simple Search Parser

- [ ] Create SimplePropertyParser class 📝 2025-10-21T09:00 [p::1] [due::2025-10-22] #phase1 #parser
- [ ] Add regex patterns for properties 📝 2025-10-21T09:30 [p::1] [due::2025-10-22] #phase1 #regex
- [ ] Integrate with TaskSearchService 📝 2025-10-21T10:00 [p::2] [due::2025-10-23] #phase1 #integration
- [ ] Test Simple Search performance 📝 2025-10-21T11:00 [p::2] [due::2025-10-23] #phase1 #testing

## DataView Enhancement

- [ ] Add natural language date parsing 📝 2025-10-23T09:00 [p::1] [due::2025-10-25] #phase2 #dates
- [ ] Implement Todoist syntax support 📝 2025-10-23T10:00 [p::2] [due::2025-10-26] #phase2 #todoist
- [ ] Test backward compatibility 📝 2025-10-23T11:00 [p::1] [due::2025-10-26] #phase2 #testing
```

#### **File: `Tasks/Bugs.md`**

```markdown
# Bug Fixes

## Critical Bugs

- [ ] Fix bug in payment system 📝 2025-10-15T08:00 [p::1] [due::2025-10-16] #bug #critical #urgent
- [ ] Fix critical authentication error 📝 2025-10-15T09:00 [p::1] [due::2025-10-17] #bug #critical #auth
- [ ] Resolve database connection timeout 📝 2025-10-15T10:00 [p::1] [due::2025-10-18] #bug #critical #database

## High Priority Bugs

- [ ] Fix UI rendering issue 📝 2025-10-16T08:00 [p::2] [due::2025-10-20] #bug #ui #highpriority
- [ ] Correct calculation error in reports 📝 2025-10-16T09:00 [p::2] [due::2025-10-21] #bug #reports
- [ ] Fix memory leak in background sync 📝 2025-10-16T10:00 [p::2] [due::2025-10-22] #bug #performance

## Medium Priority

- [ ] Update documentation typos 📝 2025-10-17T08:00 [p::3] [due::2025-10-25] #bug #documentation
- [ ] Fix minor CSS alignment 📝 2025-10-17T09:00 [p::3] [due::2025-10-26] #bug #css
- [ ] Correct tooltip text 📝 2025-10-17T10:00 [p::4] [due::2025-10-27] #bug #ui

## Resolved

- [x] 如何给出 Task Chat 响应 📝 2025-10-14T23:19 [p::1] [completion::2025-10-19] ✅ 2025-10-19T19:41 #bug #resolved
- [x] 如何开发 Obsidian AI 插件 📝 2025-10-15T14:07 [due::2025-10-10] [completion::2025-10-17] ✅ 2025-10-17T22:39 #resolved
```

#### **File: `Tasks/Features.md`**

```markdown
# Feature Requests

## High Priority Features

- [ ] Add multi-language search support 📝 2025-10-18T09:00 [p::1] [due::2025-10-23] #feature #i18n #highpriority
- [ ] Implement semantic keyword expansion 📝 2025-10-18T10:00 [p::1] [due::2025-10-24] #feature #ai #search
- [ ] Add natural date parsing 📝 2025-10-18T11:00 [p::1] [due::2025-10-25] #feature #dates

## Medium Priority Features

- [ ] Create settings import/export 📝 2025-10-19T09:00 [p::2] [due::2025-10-26] #feature #settings
- [ ] Add task templates 📝 2025-10-19T10:00 [p::2] [due::2025-10-27] #feature #templates
- [ ] Implement keyboard shortcuts 📝 2025-10-19T11:00 [p::2] [due::2025-10-28] #feature #ui

## Low Priority

- [ ] Add dark theme variants 📝 2025-10-20T09:00 [p::3] #feature #ui #theme
- [ ] Create onboarding tutorial 📝 2025-10-20T10:00 [p::3] #feature #documentation
- [ ] Add more examples to README 📝 2025-10-20T11:00 [p::4] #feature #documentation
```

#### **File: `Tasks/Research.md`**

```markdown
# Research Tasks

## Technical Research

- [ ] Research chrono-node capabilities 📝 2025-10-21T09:00 [p::2] [due::2025-10-23] #research #dates
- [ ] Investigate Todoist query syntax 📝 2025-10-21T10:00 [p::2] [due::2025-10-24] #research #syntax
- [ ] Study DataView API limitations 📝 2025-10-21T11:00 [p::2] [due::2025-10-25] #research #dataview

## Performance Research

- [ ] Benchmark regex vs AI parsing 📝 2025-10-22T09:00 [p::3] [due::2025-10-26] #research #performance
- [ ] Measure memory usage patterns 📝 2025-10-22T10:00 [p::3] [due::2025-10-27] #research #performance
- [ ] Test with large vaults (10k+ tasks) 📝 2025-10-22T11:00 [p::3] [due::2025-10-28] #research #scalability
```

---

## 🧪 **Phase 1: Simple Search Parser Tests**

### **Test Suite 1.1: Property Parsing**

**Objective**: Verify regex patterns correctly extract properties

**Test Cases**:

```typescript
// Test: Priority extraction
const tests = [
    { query: "bug P1 overdue", expected: { priority: 1 } },
    { query: "feature p2 urgent", expected: { priority: 2 } },
    { query: "task P3", expected: { priority: 3 } },
    { query: "item p4", expected: { priority: 4 } },
    { query: "no priority", expected: { priority: undefined } },
];

// Test: Date extraction
const dateTests = [
    { query: "meeting today", expected: { dueDate: "today" } },
    { query: "task tomorrow", expected: { dueDate: "tomorrow" } },
    { query: "bug overdue", expected: { dueDate: "overdue" } },
    { query: "task od", expected: { dueDate: "overdue" } }, // od = overdue
    { query: "item 1d", expected: { dueDate: "+1d" } },
    { query: "feature 2w", expected: { dueDate: "+2w" } },
    { query: "project 3m", expected: { dueDate: "+3m" } },
];

// Test: Date ranges
const rangeTests = [
    { 
        query: "date before: 2025-10-25", 
        expected: { dueDateRange: { end: "2025-10-25" } }
    },
    { 
        query: "date after: 2025-10-20", 
        expected: { dueDateRange: { start: "2025-10-20" } }
    },
];

// Test: Tags
const tagTests = [
    { query: "task #urgent", expected: { tags: ["urgent"] } },
    { query: "bug #critical #backend", expected: { tags: ["critical", "backend"] } },
];

// Test: Folder
const folderTests = [
    { query: 'folder:"Projects/Work"', expected: { folder: "Projects/Work" } },
    { query: "folder:'Tasks/Dev'", expected: { folder: "Tasks/Dev" } },
];
```

**Expected Results**: All tests pass with 100% accuracy

**Run Test**:
```bash
# Manual test
node test-simple-parser.js

# Expected output:
# ✅ Priority extraction: 5/5 passed
# ✅ Date extraction: 7/7 passed
# ✅ Date ranges: 2/2 passed
# ✅ Tags: 2/2 passed
# ✅ Folder: 2/2 passed
# Total: 18/18 passed (100%)
```

### **Test Suite 1.2: Keyword Extraction**

**Test Cases**:

```typescript
const keywordTests = [
    { 
        query: "bug P1 overdue", 
        expected: ["bug"] 
    },
    { 
        query: "fix critical bug P1", 
        expected: ["fix", "critical", "bug"] 
    },
    { 
        query: "开发 Task Chat", 
        expected: ["开发", "task", "chat"] 
    },
    { 
        query: "#urgent P1 today", 
        expected: [] // All tokens are properties
    },
];
```

### **Test Suite 1.3: DataView Integration**

**Test Cases**:

```typescript
// Test: Integration with existing DataviewService
const integrationTests = [
    {
        query: "开发 P1 overdue",
        expectedFlow: [
            "SimplePropertyParser.parse() → { priority: 1, dueDate: 'overdue', keywords: ['开发'] }",
            "DataviewService.parseTasksFromDataview(app, settings, 'overdue', { priority: 1 })",
            "Returns filtered tasks"
        ]
    }
];
```

### **Test Suite 1.4: Performance**

**Requirement**: < 100ms total execution

**Test**:
```typescript
const performanceTest = {
    query: "bug P1 overdue #critical",
    iterations: 100,
    maxAvgTime: 100, // milliseconds
};

// Run 100 times, measure average
const times = [];
for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await executeSimpleSearch(query, app, settings);
    const end = performance.now();
    times.push(end - start);
}

const avg = times.reduce((a, b) => a + b) / times.length;
console.log(`Average: ${avg.toFixed(2)}ms`);
// Expected: < 100ms
```

**Expected Results**: Average < 100ms, Cost: $0

---

## 🤖 **AI Simulation for Smart Search & Task Chat**

### **How It Works**

Since you (AI) will implement the code, you can also simulate the AI responses during testing!

### **Simulation Format**

**Input**: Query + Test tasks  
**Output**: Expected parsing result

### **Test Suite 2.1: Smart Search Simulation**

**Query 1**: "开发 Task Chat 插件"

**AI Expected Response**:
```json
{
  "coreKeywords": ["开发", "Task", "Chat", "插件"],
  "keywords": [
    "开发", "develop", "build", "create", "implement",
    "开发", "构建", "创建", "编程", "实现",
    "utveckla", "bygga", "skapa", "programmera", "implementera",
    "Task", "work", "item", "assignment", "job",
    "任务", "工作", "事项", "项目", "作业",
    "uppgift", "arbete", "göra", "uppdrag", "ärende",
    "Chat", "conversation", "messaging", "talk", "dialogue",
    "聊天", "对话", "消息", "交谈", "沟通",
    "chatt", "konversation", "meddelande", "prat", "dialog",
    "插件", "plugin", "extension", "add-on", "module",
    "扩展", "组件", "模块", "附加", "功能",
    "tillägg", "modul", "utökning", "komponent", "funktion"
  ],
  "extractedProperties": {}
}
```

**Query 2**: "high priority overdue bugs"

**AI Expected Response**:
```json
{
  "coreKeywords": ["bugs"],
  "keywords": [
    "bugs", "bug", "issue", "error", "problem", "defect",
    "错误", "问题", "缺陷", "故障", "异常",
    "fel", "problem", "bugg", "defekt", "issue"
  ],
  "extractedProperties": {
    "priority": 1,
    "dueDate": "overdue"
  }
}
```

**Query 3**: "Show all P1 tasks"

**AI Expected Response**:
```json
{
  "coreKeywords": [],
  "keywords": [],
  "extractedProperties": {
    "priority": 1
  }
}
```

### **Test Suite 2.2: Task Chat Simulation**

**Query**: "What should I work on today?"

**Context**: 100 filtered tasks (overdue, due today, high priority)

**AI Expected Response**:
```markdown
Based on your current tasks, I recommend focusing on these priorities:

**🚨 Critical & Overdue (3 tasks):**
- [TASK_1] Fix critical bug in payment system (P1, overdue 5 days)
- [TASK_5] 开发 Task Chat 时间依赖功能 (P1, overdue today)
- [TASK_8] 开发 Task Chat note link and #Tag support (P1, due today)

**⏰ Due Today (5 tasks):**
- [TASK_12] Add multi-language search support (P1)
- [TASK_15] Create SimplePropertyParser class (P1)
- [TASK_18] Add regex patterns for properties (P1)
- [TASK_22] Fix UI rendering issue (P2)
- [TASK_25] Test Simple Search performance (P2)

**🔥 High Priority Not Yet Due (8 tasks):**
- [TASK_30] Implement DataView API integration (P1, due in 2 days)
- [TASK_33] Add chrono-node date parsing (P2, due in 3 days)
...

**Recommendation**: Start with the 3 critical overdue tasks, then tackle the 5 P1 tasks due today. You have 16 high-priority items that need attention.
```

**Validation**:
- ✅ Uses [TASK_X] format
- ✅ References 80%+ of filtered tasks (80/100)
- ✅ Organized by urgency
- ✅ Clear prioritization

---

## 📊 **Test Execution Workflow**

### **Phase 1 Testing**

```bash
# Step 1: Create test vault
mkdir test-vault-unified-query
cd test-vault-unified-query
# Add test files (Development.md, Bugs.md, etc.)

# Step 2: Run unit tests
npm run test:phase1:parser
npm run test:phase1:keywords
npm run test:phase1:performance

# Step 3: Manual testing
# Open Obsidian with test vault
# Execute queries:
# - "bug P1 overdue"
# - "开发 P2"
# - "task #urgent today"

# Step 4: Verify results
# - Check console logs
# - Verify < 100ms
# - Verify $0 cost
# - Verify 100% accuracy
```

### **Phase 2 Testing**

```bash
# Test chrono-node
npm run test:phase2:dates

# Test queries:
# - "task due next Friday"
# - "meeting in 2 weeks"
# - "date before: May 5"

# Verify backward compatibility
npm run test:phase2:compat
```

### **Phase 3 Testing**

```bash
# Test AI with deterministic baseline
npm run test:phase3:baseline

# Test queries:
# - "high priority tasks"
# - "开发 plugin overdue"

# Verify fallback works
# (Simulate AI failure, check baseline still works)
```

---

## 📝 **Documentation Update Workflow**

### **After Each Feature**

**Checklist**:
```markdown
- [ ] Update `IMPLEMENTATION_MASTER.md` progress tracking
- [ ] Update `00_START_HERE.md` status
- [ ] Add test results to `TEST_RESULTS.md`
- [ ] Document any issues in `ISSUES.md`
- [ ] Update code comments
```

### **After Each Phase**

**Checklist**:
```markdown
- [ ] Mark phase complete in `IMPLEMENTATION_MASTER.md`
- [ ] Update status in `00_START_HERE.md`
- [ ] Create `PHASE_X_COMPLETE.md` summary
- [ ] Update `ARCHITECTURE.md` if needed
- [ ] Update `PROJECT_HISTORY.md` with learnings
- [ ] Update user docs (`QUERY_SYNTAX_REFERENCE.md`) if applicable
```

### **Template: `PHASE_X_COMPLETE.md`**

```markdown
# Phase X Complete

**Date**: YYYY-MM-DD  
**Duration**: X days  
**Status**: ✅ Complete

## What Was Built

- Feature 1
- Feature 2
- Feature 3

## Test Results

- Test Suite 1: X/X passed
- Test Suite 2: X/X passed
- Performance: Xms average
- Cost: $X

## Issues Encountered

1. Issue description → Solution

## Learnings

1. What worked well
2. What to improve

## Next Phase

- [ ] Task 1
- [ ] Task 2
```

---

## 🎯 **Acceptance Criteria per Phase**

### **Phase 1: Simple Search**

```markdown
✅ All property regex tests pass (18/18)
✅ All keyword extraction tests pass
✅ DataView integration works
✅ Performance < 100ms (avg)
✅ Cost = $0
✅ Accuracy = 100%
✅ Documentation updated
```

### **Phase 2: DataView Enhancement**

```markdown
✅ Natural language dates work
✅ Todoist syntax supported
✅ All date tests pass
✅ Backward compatible (100%)
✅ No breaking changes
✅ Documentation updated
```

### **Phase 3: Smart/Chat Enhancement**

```markdown
✅ Deterministic baseline works
✅ AI enhancement works
✅ Fallback tested
✅ Smart Search tested
✅ Task Chat tested
✅ 80%+ task recommendations
✅ Documentation updated
```

---

## 🔄 **Continuous Testing**

### **After Every Commit**

```bash
# Quick smoke test
npm run test:quick

# Full test suite
npm run test:all

# Performance regression test
npm run test:perf
```

### **Before Each Phase Completion**

```bash
# Run full acceptance criteria
npm run test:phase1:accept
npm run test:phase2:accept
npm run test:phase3:accept
```

---

## 📈 **Test Results Tracking**

Create `TEST_RESULTS.md` to track all test runs:

```markdown
# Test Results

## Phase 1

### 2025-01-22
- Parser tests: 18/18 ✅
- Performance: 45ms avg ✅
- Cost: $0 ✅

### 2025-01-23
- Integration tests: 5/5 ✅
- E2E tests: 3/3 ✅
```

---

**Last Updated**: 2025-01-21  
**Next Review**: After Phase 1 completion
