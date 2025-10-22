# TaskPropertyService Analysis & Improvement Plan
**Date:** 2025-01-22  
**Status:** Critical Issues Identified

---

## 🎯 USER'S CRITICAL QUESTIONS ANSWERED

### 1. mapStatusToCategory - Does it handle custom categories?

**Current Implementation:**
```typescript
static mapStatusToCategory(symbol: string | undefined, settings: PluginSettings): TaskStatusCategory {
    // Checks settings.taskStatusMapping for ALL categories
    for (const [category, config] of Object.entries(settings.taskStatusMapping)) {
        if (config.symbols.some((s) => s === cleanSymbol)) {
            return category as TaskStatusCategory;
        }
    }
}
```

**Answer:** ✅ YES, it handles BOTH internal AND custom categories!
- Iterates through ALL categories in `settings.taskStatusMapping`
- Works with built-in (open, completed, inProgress, cancelled)
- Works with custom categories users add (e.g., "waiting", "important", "bookmark")
- **Status:** This method is CORRECT ✅

---

### 2. getStatusOrder - How does it work? Why do we need it?

**Current Implementation:**
```typescript
static getStatusOrder(status: string | undefined, settings: PluginSettings): number {
    // Looks up category in settings.taskStatusMapping
    // Gets displayName
    // Infers order from displayName patterns (PROBLEM!)
    return this.inferStatusOrderFromPattern(config.displayName);
}
```

**Answer:** It's for SORTING (tiebreaking), NOT scoring!

**Purpose:**
- Used in `TaskSortService` when sorting by status
- Determines which tasks appear FIRST when they have the same score
- Example: Open tasks (order=1) before completed tasks (order=6)
- This is DIFFERENT from the `score` field which is for relevance scoring!

**Why we need it:**
- Scoring: How many points a task gets (affects ranking)
- Sorting order: When two tasks have same score, which appears first (tiebreaking)
- User has `score` field in taskStatusMapping for scoring ✅
- We need `order` field for sorting order ✅

---

### 3. CRITICAL PROBLEMS IDENTIFIED 🚨

**Problem #1: Uses Display Names (Unreliable!)**
```typescript
// CURRENT (WRONG)
return this.inferStatusOrderFromPattern(config.displayName); // Display name can be changed!

// User sets:
// open → displayName: "我的待办事项" (Chinese)
// System tries to match: "我的待办事项".includes("open") → FALSE! ❌
// Falls back to order=8 (lowest priority) → WRONG!
```

**Problem #2: Hardcoded Language Patterns**
```typescript
if (lower.includes("open") || lower.includes("todo") || 
    lower.includes("待办") || lower.includes("öppen")) {
    return 1;
}
```
- Only checks 3-4 languages (English, Chinese, Swedish)
- What about Russian, Arabic, Korean, French, etc.? ❌
- What if user's display name is "Not started yet"? ❌

**Problem #3: Doesn't Handle Custom Categories**
```typescript
// User adds custom category: "urgent"
// displayName: "Urgent Items"
// Current code: Matches "urgent" pattern → order=3 ✅

// User adds custom category: "clientWork"  
// displayName: "Client Work"
// Current code: No pattern match → order=8 (lowest!) ❌ WRONG!
```

**Problem #4: Same Issues in inferStatusDescription & inferStatusTerms**
- Both use display names for pattern matching
- Both have hardcoded languages
- Both fail for custom categories with non-standard names

---

## ✅ COMPREHENSIVE SOLUTION

### Approach: Use Category Keys (Internal Names) + Optional Configuration

**Key Insight:** Category keys are STABLE (don't change), display names are USER-DEFINED (unreliable)!

### Solution 1: Add Optional Fields to Settings

```typescript
taskStatusMapping: Record<string, {
    symbols: string[];
    score: number;          // For relevance scoring (already exists)
    displayName: string;
    aliases: string;
    
    // NEW OPTIONAL FIELDS:
    order?: number;         // Sort order (1=highest priority)
    description?: string;    // For AI prompts
    terms?: string;          // Semantic terms for AI/recognition
}>
```

**Benefits:**
- Users can explicitly configure order/description/terms
- Falls back to smart defaults for built-in categories
- Clear and predictable behavior
- No language limitations!

### Solution 2: Use Category Key (Not Display Name) for Inference

```typescript
// BEFORE (WRONG)
static getStatusOrder(status: string, settings: PluginSettings): number {
    const config = settings.taskStatusMapping[status];
    return this.inferStatusOrderFromPattern(config.displayName); // ❌
}

// AFTER (CORRECT)
static getStatusOrder(status: string, settings: PluginSettings): number {
    const config = settings.taskStatusMapping[status];
    
    // 1. Use explicit order if configured
    if (config.order !== undefined) {
        return config.order;
    }
    
    // 2. Fall back to defaults for built-in categories (by category KEY!)
    return this.getDefaultOrder(status); // Uses category key, not display name!
}
```

### Solution 3: Built-in Category Defaults (By Category Key)

```typescript
private static getDefaultOrder(categoryKey: string): number {
    const defaults: Record<string, number> = {
        open: 1,          // Active work first
        inProgress: 2,    
        cancelled: 7,     // Finished work last
        completed: 6,
    };
    return defaults[categoryKey] ?? 8; // Custom categories default to 8
}

private static getDefaultDescription(categoryKey: string): string {
    const defaults: Record<string, string> = {
        open: "Tasks not yet started or awaiting action",
        inProgress: "Tasks currently being worked on",
        completed: "Finished tasks",
        cancelled: "Tasks that were abandoned or cancelled",
    };
    return defaults[categoryKey] ?? `Tasks with ${categoryKey} status`;
}

private static getDefaultTerms(categoryKey: string): string {
    const defaults: Record<string, string> = {
        open: "open, todo, pending, unstarted, incomplete",
        inProgress: "inprogress, in-progress, wip, doing, active, working",
        completed: "completed, done, finished, closed, resolved",
        cancelled: "cancelled, canceled, abandoned, dropped, discarded",
    };
    return defaults[categoryKey] ?? categoryKey;
}
```

**Key Points:**
- Defaults based on CATEGORY KEY (stable), not display name
- Custom categories get sensible defaults
- No language hardcoding!
- Users can override via settings

---

## 🎯 DETAILED ANSWERS TO ALL QUESTIONS

### Q1: Should we use display name or internal name as input parameter?

**Answer:** **INTERNAL NAME (category key)** for all operations!

**Reasoning:**
- Category keys are STABLE (user cannot change them)
- Display names are USER-DEFINED (can be in any language, any format)
- Pattern matching on display names is BRITTLE and will FAIL
- If you need the display name, get it FROM settings using the category key

**Changes needed:**
```typescript
// BEFORE
inferStatusDescription(displayName: string): string
inferStatusTerms(displayName: string, categoryKey: string): string

// AFTER
inferStatusDescription(categoryKey: string, settings: PluginSettings): string
inferStatusTerms(categoryKey: string, settings: PluginSettings): string
```

### Q2: How to handle customized categories?

**Answer:** Three-tier system:

1. **User-configured** (highest priority)
   - User explicitly sets order/description/terms in settings
   - Use these values directly

2. **Built-in defaults** (for standard categories)
   - open, inProgress, completed, cancelled have defaults
   - Based on category KEY, not display name

3. **Generic fallback** (for custom categories without config)
   - order: 8 (appears after built-in categories)
   - description: "Tasks with {categoryKey} status"
   - terms: "{categoryKey}" (just the category name)

**Example:**
```typescript
// User adds custom category "urgent"
{
    urgent: {
        symbols: ["!"],
        score: 1.5,
        displayName: "Urgent Items",
        aliases: "urgent,priority,critical",
        // No order/description/terms configured
    }
}

// System behavior:
// order: 8 (fallback)
// description: "Tasks with urgent status" (generic)
// terms: "urgent" (categoryKey)

// User can configure explicitly:
{
    urgent: {
        symbols: ["!"],
        score: 1.5,
        displayName: "Urgent Items",
        aliases: "urgent,priority,critical",
        order: 3,           // Custom order
        description: "High-priority urgent tasks requiring immediate attention",
        terms: "urgent, critical, priority, immediate, emergency",
    }
}
```

### Q3: Where should users add terms for custom categories?

**Answer:** Multiple options:

**Option A: In taskStatusMapping (RECOMMENDED)**
```typescript
taskStatusMapping: {
    myCustom: {
        symbols: ["@"],
        score: 1.2,
        displayName: "My Custom Status",
        aliases: "custom,mycustom",
        terms: "custom, special, unique, tagged", // NEW FIELD
    }
}
```

**Benefits:**
- All configuration in one place
- Clear and discoverable
- Settings UI already has this structure

**Option B: Separate settings tab**
- More complex
- Harder to maintain
- Users need to configure in multiple places
- **NOT RECOMMENDED**

### Q4: Are hardcoded languages only for simple search or also smart search/task chat?

**Answer:** Used in MULTIPLE places:

1. **Simple Search:**
   - PropertyRecognitionService uses inferStatusTerms
   - Extracts keywords from query
   - Matches against terms

2. **Smart Search:**
   - Uses AI parsing (different approach)
   - But PropertyRecognitionService provides term suggestions to AI
   - inferStatusTerms used in prompts

3. **Task Chat:**
   - Same as Smart Search
   - PropertyRecognitionService provides term suggestions
   - AI uses these for understanding

**Impact:**
- Hardcoded languages affect ALL THREE MODES! 🚨
- Must fix to work with any language

---

## 📊 OTHER METHODS EXPLAINED

### mapPriority

**Purpose:** Convert DataView priority values to internal numeric priority (1-4)

**Usage:**
- DataviewService calls it when loading tasks
- Converts user's priority notation to standard 1-4 scale
- Uses `dataviewPriorityMapping` settings

**Example:**
```
DataView: priority: "high" or priority: 1
→ mapPriority() → 1 (internal representation)
```

### comparePriority

**Purpose:** Compare two priorities for sorting

**Usage:**
- TaskSortService calls it when sorting by priority
- Returns -1, 0, or 1 (standard comparison)
- Lower number = higher priority (1 > 2 > 3 > 4)

### formatDate

**Purpose:** Convert Date objects to consistent string format (YYYY-MM-DD)

**Usage:**
- Ensures all dates displayed/stored consistently
- Handles null/undefined dates
- Used throughout codebase

### parseDate

**Purpose:** Parse date strings into Date objects

**Usage:**
- Handles natural language ("next Friday", "in 2 weeks")
- Uses chrono-node for intelligent parsing
- Falls back to moment.js for standard formats

**Difference from formatDate:**
- parseDate: String → Date object
- formatDate: Date object → String

### matchesDateRange

**Purpose:** Check if task's due date falls within a date range

**Usage:**
- TaskFilterService uses it for filtering
- Checks if dueDate is between range.start and range.end
- Handles missing dates

### convertDateFilterToRange

**Purpose:** Convert date filter string to {start, end} range

**Usage:**
- Converts "this week" → {start: Monday, end: Sunday}
- Converts "overdue" → {start: null, end: yesterday}
- Used before calling matchesDateRange

### parseRelativeDateRange

**Purpose:** Parse complex relative dates ("next 2 weeks", "next month")

**Usage:**
- Called by convertDateFilterToRange
- Handles complex expressions
- ~250 lines of date parsing logic

### filterByDueDate

**Purpose:** Filter tasks by due date criteria

**Usage:**
- High-level filter method
- Combines parseRelativeDateRange + matching
- Used by TaskSearchService and DataviewService

**Relationship:**
```
filterByDueDate()
  ↓
convertDateFilterToRange() or parseRelativeDateRange()
  ↓
matchesDateRange()
```

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Add Optional Fields to Settings ✅

**Files:** settings.ts
```typescript
export interface StatusConfig {
    symbols: string[];
    score: number;
    displayName: string;
    aliases: string;
    order?: number;         // NEW
    description?: string;    // NEW
    terms?: string;          // NEW
}
```

### Phase 2: Update TaskPropertyService Methods

**Files:** taskPropertyService.ts

1. **getStatusOrder**
   - Check config.order first
   - Fall back to getDefaultOrder(categoryKey)
   - Remove inferStatusOrderFromPattern or make it use categoryKey

2. **inferStatusDescription**
   - Change signature: (categoryKey, settings)
   - Check config.description first
   - Fall back to getDefaultDescription(categoryKey)

3. **inferStatusTerms**
   - Change signature: (categoryKey, settings)
   - Check config.terms first
   - Fall back to getDefaultTerms(categoryKey)

### Phase 3: Update All Call Sites

**Files:**
- taskSortService.ts (already passes settings ✅)
- promptBuilderService.ts (update to pass categoryKey instead of displayName)
- propertyRecognitionService.ts (update to pass categoryKey)

### Phase 4: Update Settings UI

**Files:** settingsTab.ts

Add 3 new optional columns to status mapping grid:
- Order (number input, optional)
- Description (text input, optional)  
- Terms (text input, optional)

With tooltips explaining when to configure these.

### Phase 5: Add Migration

**Files:** main.ts

Auto-generate order/description/terms for existing custom categories
based on simple heuristics.

---

## 🎯 EXPECTED BENEFITS

1. **Reliability**
   - No more broken inference when users change display names
   - Works with ANY language
   - Clear behavior

2. **Flexibility**
   - Users can configure everything explicitly
   - Or rely on smart defaults
   - Custom categories fully supported

3. **Performance**
   - No pattern matching overhead
   - Direct lookups

4. **Maintainability**
   - No hardcoded language patterns to maintain
   - Simple default mappings
   - Easy to extend

---

## 📋 TESTING CHECKLIST

- [ ] Built-in categories (open, inProgress, completed, cancelled)
- [ ] Custom categories without config (fallback behavior)
- [ ] Custom categories with explicit config
- [ ] Non-English display names
- [ ] Mixed language environments
- [ ] All three modes (Simple Search, Smart Search, Task Chat)
- [ ] Migration from old settings
- [ ] Settings UI for new fields

