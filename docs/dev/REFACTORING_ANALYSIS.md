# Code Duplication Analysis: DataviewService vs DatacoreService

## Executive Summary

There is significant code duplication (~60-70% similar logic) between dataviewService and datacoreService. This analysis documents the differences, identifies duplication, and proposes a refactoring strategy.

---

## 1. Key Differences Between Dataview and Datacore

### Task Object Structure

#### Dataview Task Object
```typescript
{
    text: string,           // Task text
    visual: string,         // Task text without children (preferred)
    status: string,         // Task status marker
    task: boolean,          // true = task, false = list item
    line: number,           // Line number
    path: string,           // File path
    tags: string[],         // Task tags
    fields: {               // Inline fields
        [key: string]: any
    },
    // Direct properties from frontmatter/emoji
    priority: number,
    due: Date,
    completion: Date,
    created: Date
}
```

#### Datacore Task Object
```typescript
{
    $text: string,          // Task text ($ prefix for built-ins)
    $status: string,        // Task status marker
    $type: string,          // "task" or "list"
    $line: number,          // Line number
    $file: string,          // File path
    $tags: string[],        // Task tags
    $completed: boolean,    // Completion status
    $priority: any,         // Priority value
    $due: any,              // Due date
    $completion: any,       // Completion date
    $created: any,          // Created date
    fields: {               // Inline fields (same as Dataview)
        [key: string]: any
    }
}
```

### Standard Field Names

| Property | Dataview Field | Datacore Field |
|----------|---------------|----------------|
| Text | `text`, `visual` | `$text`, `text` |
| Status | `status`, `symbol` | `$status`, `status` |
| Priority | `priority` | `$priority`, `priority` |
| Due Date | `due` | `$due`, `due` |
| Created | `created` | `$created`, `created` |
| Completed | `completion` | `$completion`, `completion` |
| Tags | `tags` | `$tags`, `tags` |
| File Path | `path` | `$file`, `file` |

### API Access

- **Dataview**: `app.plugins.plugins.dataview.api`
- **Datacore**: `window.datacore`

---

## 2. Duplicated Code Sections

### 2.1 Field Value Extraction (~85% similar)

**dataviewService.getFieldValue** (lines 75-154):
- Checks `dvTask[fieldKey]` (direct property)
- Checks `dvTask.fields[fieldKey]` (inline fields)
- Checks standard Dataview emoji fields
- Extracts from text (emoji shorthands, inline syntax)

**datacoreService.getFieldValue** (lines 79-157):
- Checks `dcTask[builtInKey]` (Datacore $ fields)
- Checks `dcTask[fieldKey]` (direct property)
- Checks `dcTask.fields[fieldKey]` (inline fields)
- Extracts from text (emoji shorthands, inline syntax)

**Duplication**: Steps 2, 3, 4 are identical. Only step 1 differs (field name prefix).

### 2.2 Due Date Matching Logic (~95% similar)

**dataviewService.matchesDueDateValue** (lines 743-806):
```typescript
- Check for "all"/"any" - has any due date
- Check for "none" - no due date
- Check for date keywords (today, overdue, etc.)
- Check for relative dates (1d, 2w, etc.)
- Check for specific dates (YYYY-MM-DD)
```

**datacoreService.matchesDueDateValue** (lines 734-823):
```typescript
- Check for "all"/"any" - has any due date
- Check for "none" - no due date
- Check for date keywords (today, overdue, etc.)
- Check for relative dates (1d, 2w, etc.)
- Check for specific dates (YYYY-MM-DD)
```

**Duplication**: Logic is IDENTICAL, only difference is task object access (dvTask vs dcTask).

### 2.3 Task Filter Building (~90% similar)

**dataviewService.buildTaskFilter** (lines 817-1012):
- Priority filter (all/any/none/specific)
- Due date filter (multi-value OR logic)
- Date range filter (start/end)
- Status filter (multi-value)
- Unified status filter (s: syntax)

**datacoreService.buildTaskFilter** (lines 499-725):
- Priority filter (all/any/none/specific)
- Due date filter (multi-value OR logic)
- Date range filter (start/end)
- Status filter (multi-value)
- Unified status filter (s: syntax)

**Duplication**: Filter logic is IDENTICAL, only difference is task object access.

### 2.4 Task Processing (~60% similar)

**dataviewService.processDataviewTask** (lines 344-458):
- Extract priority (check all field names)
- Extract due date (check all field names)
- Extract created date
- Extract completed date
- Build Task object

**datacoreService.processDatacoreTask** (lines 203-349):
- Extract priority (check all field names)
- Extract due date (check all field names)
- Extract created date
- Extract completed date
- Build Task object

**Duplication**: Logic structure identical, field access differs.

---

## 3. Safety Verification: getFieldValue Changes

### Original dataviewService.getFieldValue
```typescript
private static getFieldValue(dvTask: any, fieldKey: string, text: string): any {
    // Hardcoded standardFieldMap
    const standardFieldMap = {
        due: ["due"],
        dueDate: ["due"],
        // ...
    };
}
```

### Updated dataviewService.getFieldValue
```typescript
private static getFieldValue(dvTask: any, fieldKey: string, text: string, settings: PluginSettings): any {
    // Dynamic standardFieldMap using settings
    const standardFieldMap = {
        [settings.dataviewKeys.dueDate]: ["due"],
        due: ["due"],
        dueDate: ["due"],
        // ...
    };
}
```

### Safety Analysis

✅ **SAFE**: Changes are backwards compatible:
1. **All original mappings preserved**: `due: ["due"]`, `dueDate: ["due"]` still exist
2. **Additional mappings added**: `[settings.dataviewKeys.dueDate]: ["due"]` adds MORE coverage
3. **Strategy order unchanged**: Still checks direct → fields → standard → text
4. **No removals**: We didn't remove any checks, only added more

⚠️ **Potential Issue**: If `settings.dataviewKeys.dueDate` equals an existing key (e.g., "due"), JavaScript will use the last definition, which is fine because they map to the same value.

**Verdict**: Changes are safe and improve field coverage.

---

## 4. Refactoring Proposal

### Option A: Unified Field Extraction Service (Recommended)

Create a new service `TaskFieldExtractor` in TaskPropertyService that handles both Dataview and Datacore:

```typescript
// In taskPropertyService.ts

export type TaskSource = 'dataview' | 'datacore';

export class TaskPropertyService {
    /**
     * Unified field value extraction for both Dataview and Datacore
     * Handles different task object structures transparently
     */
    static getFieldValue(
        task: any,
        fieldKey: string,
        text: string,
        settings: PluginSettings,
        source: TaskSource
    ): any {
        // Strategy 1: Check direct property (source-specific)
        const directValue = this.getDirectField(task, fieldKey, source);
        if (directValue !== undefined) return directValue;

        // Strategy 2: Check fields object (same for both)
        if (task.fields?.[fieldKey] !== undefined) {
            return task.fields[fieldKey];
        }

        // Strategy 3: Check standard fields (source-specific mapping)
        const standardValue = this.getStandardField(task, fieldKey, settings, source);
        if (standardValue !== undefined) return standardValue;

        // Strategy 4: Extract emoji shorthands from text (same for both)
        const emojiValue = this.extractEmojiShorthand(text, fieldKey);
        if (emojiValue !== undefined) return emojiValue;

        // Strategy 5: Extract from inline field syntax (same for both)
        const inlineValue = this.extractInlineField(text, fieldKey);
        if (inlineValue !== undefined) return inlineValue;

        return undefined;
    }

    private static getDirectField(task: any, fieldKey: string, source: TaskSource): any {
        if (source === 'datacore') {
            // Try $ prefix first for Datacore built-ins
            const builtInKey = this.getDatacoreBuiltInKey(fieldKey);
            if (builtInKey && task[builtInKey] !== undefined) {
                return task[builtInKey];
            }
        }
        // Try direct property (both sources)
        return task[fieldKey];
    }

    private static getStandardField(
        task: any,
        fieldKey: string,
        settings: PluginSettings,
        source: TaskSource
    ): any {
        const mapping = this.getStandardFieldMapping(fieldKey, settings, source);
        for (const standardKey of mapping) {
            if (task[standardKey] !== undefined) return task[standardKey];
            if (task.fields?.[standardKey] !== undefined) return task.fields[standardKey];
        }
        return undefined;
    }

    private static getStandardFieldMapping(
        fieldKey: string,
        settings: PluginSettings,
        source: TaskSource
    ): string[] {
        // Build dynamic mapping based on source
        const fieldMap: Record<string, string[]> = {};

        if (source === 'datacore') {
            // Datacore: $ prefix for built-ins
            fieldMap[settings.dataviewKeys.dueDate] = ['$due'];
            fieldMap['due'] = ['$due'];
            fieldMap['dueDate'] = ['$due'];
            fieldMap['deadline'] = ['$due'];
            // ... more mappings
        } else {
            // Dataview: emoji shorthand names
            fieldMap[settings.dataviewKeys.dueDate] = ['due'];
            fieldMap['due'] = ['due'];
            fieldMap['dueDate'] = ['due'];
            fieldMap['deadline'] = ['due'];
            // ... more mappings
        }

        return fieldMap[fieldKey] || [];
    }

    /**
     * Unified due date matching for both Dataview and Datacore
     */
    static matchesDueDateValue(
        task: any,
        dueDateValue: string,
        dueDateFields: string[],
        settings: PluginSettings,
        source: TaskSource
    ): boolean {
        const taskText = this.getTaskText(task, source);

        // Check for "all"/"any"
        if (dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.all ||
            dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.any) {
            return dueDateFields.some(field => {
                const value = this.getFieldValue(task, field, taskText, settings, source);
                return value !== undefined && value !== null;
            });
        }

        // Check for "none"
        if (dueDateValue === this.DUE_DATE_FILTER_KEYWORDS.none) {
            return !dueDateFields.some(field => {
                const value = this.getFieldValue(task, field, taskText, settings, source);
                return value !== undefined && value !== null;
            });
        }

        // Check for date keywords
        const dueDateKeywords = Object.values(this.DUE_DATE_KEYWORDS) as string[];
        if (dueDateKeywords.includes(dueDateValue)) {
            return dueDateFields.some(field => {
                const value = this.getFieldValue(task, field, taskText, settings, source);
                return this.matchesDueDateKeyword(
                    value,
                    dueDateValue as keyof typeof TaskPropertyService.DUE_DATE_KEYWORDS,
                    this.formatDate.bind(this)
                );
            });
        }

        // Check for relative dates
        const parsedRelativeDate = this.parseRelativeDate(dueDateValue);
        if (parsedRelativeDate) {
            return dueDateFields.some(field => {
                const value = this.getFieldValue(task, field, taskText, settings, source);
                const formatted = this.formatDate(value);
                return formatted === parsedRelativeDate;
            });
        }

        // Check for specific dates
        return dueDateFields.some(field => {
            const value = this.getFieldValue(task, field, taskText, settings, source);
            const formatted = this.formatDate(value);
            return formatted === dueDateValue;
        });
    }

    /**
     * Helper: Get task text based on source
     */
    private static getTaskText(task: any, source: TaskSource): string {
        if (source === 'datacore') {
            return task.$text || task.text || '';
        } else {
            return task.visual || task.text || task.content || '';
        }
    }

    /**
     * Unified filter building for both sources
     */
    static buildTaskFilter(
        propertyFilters: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: { start?: string; end?: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        settings: PluginSettings,
        source: TaskSource
    ): ((task: any) => boolean) | null {
        const filters: ((task: any) => boolean)[] = [];

        // Build priority filter
        if (propertyFilters.priority) {
            const priorityFields = this.getAllPriorityFieldNames(settings);

            if (propertyFilters.priority === this.PRIORITY_FILTER_KEYWORDS.all ||
                propertyFilters.priority === this.PRIORITY_FILTER_KEYWORDS.any) {
                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return priorityFields.some(field => {
                        const value = this.getFieldValue(task, field, taskText, settings, source);
                        if (value === undefined || value === null) return false;
                        const mapped = this.mapPriority(value, settings);
                        return mapped !== undefined && mapped >= 1 && mapped <= 4;
                    });
                });
            } else if (propertyFilters.priority === this.PRIORITY_FILTER_KEYWORDS.none) {
                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return !priorityFields.some(field => {
                        const value = this.getFieldValue(task, field, taskText, settings, source);
                        if (value === undefined || value === null) return false;
                        const mapped = this.mapPriority(value, settings);
                        return mapped !== undefined;
                    });
                });
            } else {
                const targetPriorities = Array.isArray(propertyFilters.priority)
                    ? propertyFilters.priority
                    : [propertyFilters.priority];

                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return priorityFields.some(field => {
                        const value = this.getFieldValue(task, field, taskText, settings, source);
                        if (value !== undefined && value !== null) {
                            const mapped = this.mapPriority(value, settings);
                            return mapped !== undefined && targetPriorities.includes(mapped);
                        }
                        return false;
                    });
                });
            }
        }

        // Build due date filter
        if (propertyFilters.dueDate) {
            const dueDateFields = this.getAllDueDateFieldNames(settings);
            const dueDateValues = Array.isArray(propertyFilters.dueDate)
                ? propertyFilters.dueDate
                : [propertyFilters.dueDate];

            filters.push((task: any) => {
                for (const dueDateValue of dueDateValues) {
                    if (this.matchesDueDateValue(task, dueDateValue, dueDateFields, settings, source)) {
                        return true;
                    }
                }
                return false;
            });
        }

        // Build date range filter
        if (propertyFilters.dueDateRange) {
            const dueDateFields = this.getAllDueDateFieldNames(settings);
            const { start, end } = propertyFilters.dueDateRange;

            if (start || end) {
                const startDate = start ? this.parseDateRangeKeyword(start) : null;
                const endDate = end ? this.parseDateRangeKeyword(end) : null;

                filters.push((task: any) => {
                    const taskText = this.getTaskText(task, source);
                    return dueDateFields.some(field => {
                        const value = this.getFieldValue(task, field, taskText, settings, source);
                        if (!value) return false;

                        const taskDate = moment(this.formatDate(value));

                        if (startDate && !taskDate.isSameOrAfter(startDate, "day")) return false;
                        if (endDate && !taskDate.isSameOrBefore(endDate, "day")) return false;

                        return true;
                    });
                });
            }
        }

        // Build status filter
        if (propertyFilters.status) {
            const targetStatuses = Array.isArray(propertyFilters.status)
                ? propertyFilters.status
                : [propertyFilters.status];

            filters.push((task: any) => {
                const status = source === 'datacore'
                    ? (task.$status || task.status)
                    : task.status;
                if (status !== undefined) {
                    const mapped = this.mapStatusToCategory(status, settings);
                    return targetStatuses.includes(mapped);
                }
                return false;
            });
        }

        // Build unified status filter (s: syntax)
        if (propertyFilters.statusValues && propertyFilters.statusValues.length > 0) {
            filters.push((task: any) => {
                const taskStatus = source === 'datacore'
                    ? (task.$status || task.status)
                    : task.status;
                if (taskStatus === undefined) return false;

                return propertyFilters.statusValues!.some(value => {
                    if (taskStatus === value) return true;

                    const normalizedValue = value.toLowerCase().replace(/-/g, '').replace(/\s+/g, '');

                    for (const [categoryKey, categoryConfig] of Object.entries(settings.taskStatusMapping)) {
                        if (categoryKey.toLowerCase() === normalizedValue ||
                            categoryKey.toLowerCase().replace(/-/g, '') === normalizedValue) {
                            return categoryConfig.symbols.includes(taskStatus);
                        }

                        const aliases = categoryConfig.aliases.toLowerCase().split(',').map(a => a.trim());
                        if (aliases.includes(value.toLowerCase())) {
                            return categoryConfig.symbols.includes(taskStatus);
                        }
                    }

                    return false;
                });
            });
        }

        if (filters.length === 0) return null;

        return (task: any) => filters.every(f => f(task));
    }
}
```

### Updated Service Files

**dataviewService.ts**:
```typescript
private static getFieldValue(dvTask: any, fieldKey: string, text: string, settings: PluginSettings): any {
    return TaskPropertyService.getFieldValue(dvTask, fieldKey, text, settings, 'dataview');
}

private static matchesDueDateValue(
    dvTask: any,
    dueDateValue: string,
    dueDateFields: string[],
    settings: PluginSettings
): boolean {
    return TaskPropertyService.matchesDueDateValue(dvTask, dueDateValue, dueDateFields, settings, 'dataview');
}

private static buildTaskFilter(...): ((dvTask: any) => boolean) | null {
    return TaskPropertyService.buildTaskFilter(propertyFilters, settings, 'dataview');
}
```

**datacoreService.ts**:
```typescript
private static getFieldValue(dcTask: any, fieldKey: string, text: string, settings: PluginSettings): any {
    return TaskPropertyService.getFieldValue(dcTask, fieldKey, text, settings, 'datacore');
}

private static matchesDueDateValue(
    dcTask: any,
    dueDateValue: string,
    settings: PluginSettings
): boolean {
    const dueDateFields = TaskPropertyService.getAllDueDateFieldNames(settings);
    return TaskPropertyService.matchesDueDateValue(dcTask, dueDateValue, dueDateFields, settings, 'datacore');
}

private static buildTaskFilter(...): ((dcTask: any) => boolean) | null {
    return TaskPropertyService.buildTaskFilter(propertyFilters, settings, 'datacore');
}
```

### Benefits of This Approach

1. **Single Source of Truth**: All field extraction logic in one place
2. **Easier Maintenance**: Bug fixes apply to both sources automatically
3. **Consistent Behavior**: Both services behave identically
4. **Better Testing**: Test once, covers both sources
5. **Reduced Code Size**: ~400-500 lines eliminated
6. **Preserved API**: Service files remain small, delegate to TaskPropertyService

### Migration Strategy

1. Add new methods to TaskPropertyService (backward compatible)
2. Update dataviewService to use new methods (one method at a time)
3. Update datacoreService to use new methods (one method at a time)
4. Remove old methods once migration complete
5. Test thoroughly at each step

---

## 5. Recommendation

**Implement Option A (Unified Field Extraction Service)** because:

1. ✅ Eliminates ~400-500 lines of duplication
2. ✅ Preserves existing service APIs (backward compatible)
3. ✅ Single source of truth for field extraction logic
4. ✅ Easy to test and maintain
5. ✅ Handles Dataview/Datacore differences cleanly with source parameter

**Risk Level**: Low
- Changes are incremental
- Existing tests will catch regressions
- Can be done method by method

**Estimated Effort**: 4-6 hours
- 2 hours: Implement unified methods in TaskPropertyService
- 2 hours: Migrate dataviewService
- 1 hour: Migrate datacoreService
- 1 hour: Testing and validation

---

## Conclusion

The refactoring is worthwhile and safe. The getFieldValue changes made earlier are correct and backwards compatible. Moving forward with Option A will significantly improve code quality and maintainability.
