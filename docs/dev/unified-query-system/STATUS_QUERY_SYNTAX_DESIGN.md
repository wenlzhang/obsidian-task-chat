# Status Query Syntax Design (Todoist-Like)

**Date**: 2025-01-21  
**Status**: 🎨 **DESIGN PROPOSAL**

---

## 🎯 **Goals**

1. **Simple**: Easy to type like `p1`, `p2`, `p3`
2. **Flexible**: Support both status categories AND individual symbols
3. **Intuitive**: Similar to Todoist/DataView patterns
4. **Powerful**: Work in Simple Search, Smart Search, and Task Chat

---

## 📊 **Current Architecture**

### **Status Categories** (Customizable)
```typescript
taskStatusMapping: {
  open: { symbols: [" "], displayName: "Open" },
  completed: { symbols: ["x", "X"], displayName: "Completed" },
  inProgress: { symbols: ["/"], displayName: "In Progress" },
  cancelled: { symbols: ["-"], displayName: "Cancelled" },
  other: { symbols: [], displayName: "Other" }
}
```

### **DataView Status Fields**
- `task.status` → Symbol (e.g., " ", "x", "/", "-", "?", "!", etc.)
- `task.checked` → Boolean (true if "x")
- `task.completed` → Boolean (true if "x")

---

## 🎨 **Proposed Syntax**

### **1. Status Category Syntax** (Primary Method)

**Format**: `status:category` or `s:category`

| Syntax | Matches | Example |
|--------|---------|---------|
| `status:open` | Open tasks (symbol " ") | `status:open & p1` |
| `status:completed` | Completed tasks (symbol "x") | `status:completed` |
| `status:in-progress` | In-progress tasks (symbol "/") | `status:in-progress & ##Work` |
| `status:cancelled` | Cancelled tasks (symbol "-") | `status:cancelled` |
| `s:open` | Short form | `s:open & overdue` |

**Benefits**:
- ✅ Explicit and clear
- ✅ Matches existing `search:`, `due before:` patterns
- ✅ Works with custom categories
- ✅ Supports both `status:` and `s:` shortcuts

### **2. Symbol Syntax** (DataView-Style)

**Format**: `symbol:x` where `x` is the checkbox symbol

| Syntax | Matches | Example |
|--------|---------|---------|
| `symbol:x` | Tasks with [x] | `symbol:x & ##Project` |
| `symbol:/` | Tasks with [/] | `symbol:/` |
| `symbol:-` | Tasks with [-] | `symbol:-` |
| `symbol:?` | Tasks with [?] | `symbol:?` |
| `symbol:!` | Tasks with [!] | `symbol:!` |

**Benefits**:
- ✅ Direct DataView symbol matching
- ✅ Works with ANY custom symbol
- ✅ Perfect for Task Marker plugin users
- ✅ No need to configure categories

### **3. Natural Language** (Already Supported)

Users can already type status words directly:
- `open tasks` → Parsed as status:open
- `completed` → Parsed as status:completed  
- `in progress` → Parsed as status:inProgress

This continues to work via existing AI parsing.

---

## 🔧 **Implementation Plan**

### **Phase 1: Add to Todoist Syntax Parser**

Enhance `parseTodoistSyntax()` in `dataviewService.ts`:

```typescript
// Pattern: "status:open" or "s:completed"
const statusMatch = query.match(/\b(status|s):(\w+[-]?\w+)/i);
if (statusMatch) {
    result.statusCategory = statusMatch[2].replace(/-/g, "");  // "in-progress" → "inprogress"
}

// Pattern: "symbol:x" or "symbol:/"
const symbolMatch = query.match(/\bsymbol:([^\s&|]+)/i);
if (symbolMatch) {
    result.statusSymbol = symbolMatch[1];
}
```

### **Phase 2: Add to Query Parser** 

Update AI prompt in `queryParserService.ts` to recognize:
```
STATUS SYNTAX (Todoist-like):
- status:open → Filter by open tasks
- status:completed → Filter by completed tasks  
- symbol:x → Filter by exact symbol [x]
```

### **Phase 3: Update Filtering**

Update `buildTaskFilter()` in `dataviewService.ts`:

```typescript
// Build status category filter
if (intent.statusCategory) {
    const categoryConfig = settings.taskStatusMapping[intent.statusCategory];
    if (categoryConfig) {
        const symbols = categoryConfig.symbols;
        filters.push((dvTask: any) => {
            return symbols.includes(dvTask.status);
        });
    }
}

// Build status symbol filter  
if (intent.statusSymbol) {
    filters.push((dvTask: any) => {
        return dvTask.status === intent.statusSymbol;
    });
}
```

---

## 📝 **Examples**

### **Simple Queries**

```
status:open                      → All open tasks
status:completed                 → All completed tasks
status:in-progress               → All in-progress tasks
symbol:x                         → Tasks with [x] status
symbol:?                         → Tasks with [?] status
```

### **Combined with Priority**

```
status:open & p1                 → High priority open tasks
status:in-progress & p2          → Medium priority WIP tasks
symbol:/ & ##Work                → In-progress tasks in Work project
```

### **Combined with Dates**

```
status:open & overdue            → Overdue open tasks
status:in-progress & 7d          → WIP tasks due in 7 days
status:open & due before: Friday → Open tasks due before Friday
```

### **Complex Queries**

```
search: meeting & status:open & p1 & ##Work
status:in-progress & !subtask & overdue
symbol:? & next week & #urgent
```

---

## 🎯 **Comparison with Priority Syntax**

| Priority | Status (Proposed) |
|----------|-------------------|
| `p1` | `status:open` or `s:open` |
| `p2` | `status:completed` or `s:completed` |
| `p3` | `status:in-progress` or `s:wip` |
| `p4` | `symbol:x` (direct matching) |

**Why not `s1`, `s2`, `s3`?**
- Status categories are **user-customizable** (could have 5, 10, or 20 categories)
- Priority has **fixed** 4 levels (1-4)
- Using names (`status:open`) is clearer than numbers
- Numbers would break with custom categories

---

## ✅ **Advantages**

1. **Explicit**: `status:open` is clearer than `s1`
2. **Flexible**: Works with ANY custom status category
3. **Powerful**: `symbol:x` works with ANY symbol
4. **Consistent**: Matches `search:`, `due before:` pattern
5. **Short**: `s:open` for quick typing
6. **DataView-Compatible**: `symbol:` matches DataView field

---

## 🚀 **Backward Compatibility**

**Existing queries continue to work**:
- ✅ `completed tasks` → Still parsed as status filter
- ✅ `open` → Still works via natural language
- ✅ `in progress` → Still parsed correctly

**New syntax provides**:
- More explicit control
- Symbol-level precision
- Better composability with operators

---

## 📊 **Coverage Matrix**

| Method | Open | Completed | In-Progress | Custom Symbol |
|--------|------|-----------|-------------|---------------|
| **Natural Language** | `open tasks` | `completed` | `in progress` | ❌ |
| **Status Syntax** | `status:open` | `status:completed` | `status:in-progress` | ❌ |
| **Symbol Syntax** | `symbol: ` | `symbol:x` | `symbol:/` | ✅ `symbol:?` |
| **Short Form** | `s:open` | `s:completed` | `s:wip` | ❌ |

---

## 🎨 **UI Considerations**

### **Settings Tab**

Add examples to status mapping section:
```
Examples:
- Query by category: status:open, s:completed
- Query by symbol: symbol:x, symbol:/
- Natural language: "open tasks", "completed"
```

### **README Documentation**

Add new section:
```markdown
#### **Status Filtering** (Todoist-Like)

Filter tasks by status using multiple syntaxes:

**Status Category**:
- `status:open` - Open tasks
- `status:completed` - Completed tasks
- `status:in-progress` - In-progress tasks
- `s:open` - Short form

**Symbol Matching** (DataView-style):
- `symbol:x` - Tasks with [x] status
- `symbol:/` - Tasks with [/] status
- `symbol:?` - Tasks with [?] status

**Examples**:
```
status:open & p1 & overdue
s:completed & ##Project
symbol:/ & due before: Friday
```
```

---

## 🔄 **Test Cases**

```javascript
// Status category tests
test('Parse "status:open"', ..., (r) => r.statusCategory === 'open');
test('Parse "s:completed"', ..., (r) => r.statusCategory === 'completed');
test('Parse "status:in-progress"', ..., (r) => r.statusCategory === 'inprogress');

// Symbol tests
test('Parse "symbol:x"', ..., (r) => r.statusSymbol === 'x');
test('Parse "symbol:/"', ..., (r) => r.statusSymbol === '/');
test('Parse "symbol:?"', ..., (r) => r.statusSymbol === '?');

// Combined tests
test('Parse "status:open & p1"', ..., (r) => r.statusCategory === 'open' && r.priority === 1);
test('Parse "symbol:/ & overdue"', ..., (r) => r.statusSymbol === '/' && r.specialKeywords.includes('overdue'));
```

---

## ✅ **Recommendation**

**Implement both syntaxes**:
1. `status:category` for category-level filtering
2. `symbol:x` for symbol-level filtering

**Why both?**
- `status:` works with custom categories
- `symbol:` works with custom symbols (Task Marker plugin)
- User chooses based on their workflow
- Maximum flexibility

---

**Next Steps**: Implement Phase 1-3, create tests, update documentation
