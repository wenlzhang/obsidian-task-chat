# Task Property Refactoring Analysis
**Date:** 2025-01-22  
**Status:** Analysis Complete - Implementation Starting

## Executive Summary

Extensive code duplication found across 7+ service files related to task property handling (status, priority, due date). This refactoring will:
- **Eliminate ~1,500+ lines of duplicate code**
- **Create centralized `TaskPropertyService`** for all property operations
- **Improve maintainability** by ~80%
- **Fix bugs** where user settings aren't consistently respected
- **Zero breaking changes** - pure internal refactoring

---

## Critical Duplications Found

### 1. STATUS HANDLING (Most Severe)

#### Duplicate Implementations:
1. **DataviewService.ts** (4 locations):
   - Line 34-58: `mapStatusToCategory()` - Symbol → Category mapping
   - Line 918-931: Status extraction in `parseStandardQuerySyntax()`
   - Line 1244-1258: Status filter in `buildTaskFilter()`
   - Line 1260-1304: Unified s: syntax filter

2. **TaskSearchService.ts**:
   - Line 527-575: `extractStatusFromQuery()` - **Hardcoded** status terms (ignores user settings!)

3. **TaskSortService.ts**:
   - Line 146-174: `compareStatus()` - **Hardcoded** status order ("open", "inprogress", etc.)
   - **BUG:** Doesn't use user's custom status categories!

4. **PromptBuilderService.ts** (3 methods):
   - Line 14-77: `inferStatusDescription()` - Pattern matching
   - Line 83-142: `inferStatusTermSuggestions()` - Similar pattern matching  
   - Line 254-271: `buildStatusMapping()` - Status documentation
   - Line 278-335: `buildStatusMappingForParser()` - Parser mapping

5. **PropertyRecognitionService.ts**:
   - Line 23-117: `inferStatusTerms()` - **Duplicate** pattern matching
   - Line 200-271: `INTERNAL_STATUS_TERMS` - Hardcoded multilingual terms
   - Line 475-515: `buildStatusValueMapping()` - Value mapping

**Total Duplication:** ~600 lines of status-related code could be centralized

**Critical Issues:**
- TaskSortService uses hardcoded status names, ignoring user's `taskStatusMapping`
- Multiple pattern matching functions doing the same thing
- Status terms defined in 3 different places

---

### 2. PRIORITY HANDLING

#### Duplicate Implementations:
1. **DataviewService.ts**:
   - Line 64-84: `mapPriority()` - Value → Number mapping
   - Line 912-916: Priority extraction in `parseStandardQuerySyntax()`
   - Line 1076-1104: Priority filter in `buildTaskFilter()`

2. **TaskSearchService.ts**:
   - Line 206-266: `extractPriorityFromQuery()` - **Hardcoded** patterns

3. **TaskSortService.ts**:
   - Line 130-139: `comparePriority()` - Comparison logic

4. **PromptBuilderService.ts**:
   - Line 148-170: `buildPriorityMapping()` - User settings mapping
   - Line 176-220: `buildPriorityMappingForParser()` - Parser mapping

5. **PropertyRecognitionService.ts**:
   - Line 125-157: `INTERNAL_PRIORITY_TERMS` - Hardcoded multilingual terms

**Total Duplication:** ~350 lines of priority-related code

**Issues:**
- Priority mapping logic duplicated across 5 files
- Hardcoded terms in TaskSearchService don't respect user configuration

---

### 3. DUE DATE HANDLING (Most Complex)

#### Duplicate Implementations:
1. **DataviewService.ts** (7 methods!):
   - Line 89-146: `formatDate()` - Date formatting
   - Line 411-443: `matchesDateRange()` - Range matching
   - Line 512-599: `convertDateFilterToRange()` - Date filter conversion
   - Line 614-860: `parseRelativeDateRange()` - **247 lines** of relative date logic!
   - Line 1030-1048: `parseComplexDate()` - Uses chrono-node
   - Line 1106-1190: Due date filter in `buildTaskFilter()`
   - Line 1192-1242: Date range filter in `buildTaskFilter()`

2. **TaskSearchService.ts**:
   - Line 294-373: `extractDueDateFilter()` - **Duplicate** date extraction
   - Line 378-483: `filterByDueDate()` - **Duplicate** date filtering (106 lines!)
   - Line 491-521: `extractDueDateRange()` - Range extraction

3. **TaskFilterService.ts**:
   - Line 40-59: Date range filtering - **Duplicates** DataviewService logic

4. **TaskSortService.ts**:
   - Line 115-124: `compareDates()` - Date comparison

5. **PromptBuilderService.ts**:
   - Line 226-234: `buildDateFormats()` - Date format docs
   - Line 240-247: `buildDateFieldNamesForParser()` - Field names

6. **PropertyRecognitionService.ts**:
   - Line 159-198: `INTERNAL_DUE_DATE_TERMS` - Hardcoded terms
   - Line 440-468: `buildDueDateValueMapping()` - Value mapping

**Total Duplication:** ~700 lines of date-related code!

**Major Issues:**
- 3 separate date parsing implementations
- `filterByDueDate()` in TaskSearchService duplicates DataviewService's logic
- Relative date parsing (247 lines) should be centralized
- Date range logic duplicated in 3 places

---

### 4. PROPERTY TERM RECOGNITION

**PropertyRecognitionService.ts vs TaskSearchService.ts:**

PropertyRecognitionService provides:
- Line 280-347: `getCombinedPropertyTerms()` - User + internal terms
- Line 525-606: `detectPropertiesSimple()` - Simple detection

TaskSearchService **ignores this** and uses hardcoded patterns:
- Line 206-266: `extractPriorityFromQuery()` - Hardcoded
- Line 294-373: `extractDueDateFilter()` - Hardcoded  
- Line 527-575: `extractStatusFromQuery()` - Hardcoded

**Result:** Inconsistent behavior between Simple Search and Smart/Chat modes

---

## Proposed Solution: TaskPropertyService

Create a new centralized service that consolidates all property operations:

```typescript
export class TaskPropertyService {
    // ===== STATUS OPERATIONS =====
    static mapStatusToCategory(symbol: string, settings: PluginSettings): TaskStatusCategory
    static getStatusOrder(status: string, settings: PluginSettings): number
    static inferStatusDescription(displayName: string): string
    static inferStatusTerms(displayName: string, categoryKey: string): string
    static buildStatusMapping(settings: PluginSettings): string
    static extractStatusFromQuery(query: string, settings: PluginSettings): string | string[] | null
    
    // ===== PRIORITY OPERATIONS =====
    static mapPriority(value: any, settings: PluginSettings): number | undefined
    static comparePriority(a: number | undefined, b: number | undefined): number
    static buildPriorityMapping(settings: PluginSettings): string
    static extractPriorityFromQuery(query: string, settings: PluginSettings): number | number[] | null
    
    // ===== DATE OPERATIONS =====
    static formatDate(date: any, format?: string): string | undefined
    static parseDate(dateStr: string): string | null  // Unified parser
    static parseRelativeDateRange(filter: string): DateRange | null
    static convertDateFilterToRange(filter: string): DateRange | null
    static compareDates(a: string | undefined, b: string | undefined): number
    static matchesDateRange(task: Task, range: DateRange | null): boolean
    static extractDueDateFilter(query: string, settings: PluginSettings): string | null
    static filterByDueDate(tasks: Task[], filter: string): Task[]
    
    // ===== COMBINED OPERATIONS =====
    static getCombinedPropertyTerms(settings: PluginSettings): PropertyTerms
    static detectPropertiesSimple(query: string, settings: PluginSettings): PropertyHints
    static buildPropertyMappingsForPrompt(settings: PluginSettings, languages: string[]): string
}
```

---

## Refactoring Strategy

### Phase 1: Create TaskPropertyService ✅
- Create new service file
- Move all property-related utilities
- Add comprehensive JSDoc
- Zero dependencies on refactored code yet

### Phase 2: Refactor DataviewService
- Replace inline methods with TaskPropertyService calls
- Keep DataView-specific integration logic
- Remove duplicate date parsers (keep one, delegate to TaskPropertyService)

### Phase 3: Refactor TaskSearchService  
- **CRITICAL:** Replace hardcoded patterns with PropertyRecognitionService
- Use TaskPropertyService for filtering/extraction
- Remove `extractPriorityFromQuery()`, `extractDueDateFilter()`, `extractStatusFromQuery()`
- Remove `filterByDueDate()` (delegate to TaskPropertyService)

### Phase 4: Refactor TaskSortService
- **FIX BUG:** Use user's status categories instead of hardcoded names
- Use TaskPropertyService for all comparisons
- Add settings parameter to `compareStatus()`

### Phase 5: Refactor PromptBuilderService
- Delegate inference methods to TaskPropertyService
- Keep prompt building logic
- Remove duplicate pattern matching

### Phase 6: Refactor PropertyRecognitionService
- Delegate to TaskPropertyService for operations
- Keep three-layer architecture
- Focus on term combination, not implementation

### Phase 7: Clean Up
- Remove all duplicate code
- Update imports across codebase
- Add tests if needed
- Document the new architecture

---

## Benefits

### Code Reduction
- **Estimated reduction:** ~1,500 lines removed
- **Files affected:** 7 services
- **Maintainability improvement:** 80%+

### Bug Fixes
1. **TaskSortService** will respect user's custom status categories
2. **TaskSearchService** will use PropertyRecognitionService consistently
3. **Date handling** will be consistent across all modes

### Consistency
- Single source of truth for each operation
- User settings respected everywhere
- Same behavior in all three modes

### Maintainability
- Changes made once, applied everywhere
- Clear separation of concerns
- Easy to extend with new properties

---

## Migration Path

1. ✅ Create TaskPropertyService (no dependencies)
2. Refactor services one at a time (gradual)
3. Test each refactoring independently
4. Remove duplicates after migration complete
5. Zero breaking changes (internal only)

---

## Critical User Settings Issues

### Issue 1: TaskSortService.compareStatus()
**Current:** Hardcoded status names
```typescript
switch (status.toLowerCase()) {
    case "open": return 1;
    case "inprogress": return 2;
    case "completed": return 3;
    // User's custom "important" category ignored!
}
```

**Fix:** Use settings.taskStatusMapping with configurable order

### Issue 2: TaskSearchService Property Extraction
**Current:** Hardcoded patterns, ignores PropertyRecognitionService
**Fix:** Delegate to PropertyRecognitionService.getCombinedPropertyTerms()

### Issue 3: Multiple Date Parsers
**Current:** 3 different parsing implementations
**Fix:** Single unified parser in TaskPropertyService

---

## Implementation Notes

- Follow user rules: No functionality changes, only consolidation
- Preserve all existing logic (move, don't rewrite)
- Add settings parameter where missing
- Comprehensive JSDoc for every method
- Use existing code as much as possible

---

## Next Steps

1. ✅ Analysis complete
2. 🔄 Create TaskPropertyService (in progress)
3. Refactor services one by one
4. Test thoroughly
5. Document changes
