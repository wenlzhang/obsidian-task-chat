# Complex Query Handling

This document describes the advanced query parsing and filtering capabilities implemented in Task Chat.

## Overview

The plugin now supports sophisticated compound queries that combine multiple filters intelligently. The system extracts structured filters from natural language queries and applies them efficiently before using AI for refinement.

## Architecture

### Query Processing Flow

1. **Intent Analysis** - Extract all structured filters from the query
2. **Compound Filtering** - Apply all detected filters simultaneously
3. **Result Assessment** - Determine if AI refinement is needed
4. **AI Enhancement** - Use AI for complex prioritization when needed

### Components

- `TaskSearchService.analyzeQueryIntent()` - Comprehensive query parsing
- `TaskSearchService.applyCompoundFilters()` - Multi-filter application
- `AIService.sendMessage()` - Intelligent routing and AI enhancement

## Supported Filter Types

### 1. Priority Filters

**Supported Formats:**
- English: `priority 1`, `p1`, `priority is 1`, `priority = 1`, `high`, `highest`
- Chinese: `优先级1`, `优先级为1`, `优先级是1`, `高`

**Mapping:**
- High: `1`, `p1`, `high`, `highest`, `高`
- Medium: `2`, `p2`, `medium`, `med`, `中`
- Low: `3`, `p3`, `low`, `低`
- None: `4`, `p4`, `none`, `无`

**Examples:**
```
"tasks with priority 1"
"优先级为1的任务"
"show me high priority tasks"
"p1 tasks that are overdue"
```

### 2. Due Date Filters

**Supported Formats:**
- Relative: `today`, `tomorrow`, `this week`, `next week`, `overdue`
- Chinese: `今天`, `明天`, `本周`, `下周`, `过期`
- Specific dates: `2025-10-15`, `10/15/2025`, `2025/10/15`

**Examples:**
```
"tasks due today"
"今天到期的任务"
"overdue priority 1 tasks"
"tasks due 2025-10-20"
"show me tasks due this week with high priority"
```

### 3. Status Filters

**Supported Values:**
- Open: `open`, `incomplete`, `pending`, `todo`, `未完成`, `待办`
- Completed: `completed`, `done`, `finished`, `完成`, `已完成`
- In Progress: `in progress`, `in-progress`, `ongoing`, `进行中`, `正在做`

**Examples:**
```
"open tasks with priority 1"
"completed tasks from this week"
"in progress tasks in project folder"
```

### 4. Folder Filters

**Supported Formats:**
- `in folder X`
- `from folder X`
- `folder: X`
- `文件夹: X`

**Examples:**
```
"tasks in folder projects"
"high priority tasks from work folder"
"show me tasks in folder personal that are due today"
```

### 5. Tag Filters

**Supported Formats:**
- Hashtag: `#work`, `#urgent`
- Natural language: `with tag work`, `tagged urgent`
- Chinese: `标签: 工作`

**Examples:**
```
"tasks with tag work"
"#urgent tasks due today"
"show me #project tasks with priority 1"
```

### 6. Keyword Search

**Automatic extraction** removes stop words and focuses on meaningful terms.

**Supported Languages:** English, Chinese

**Examples:**
```
"tasks about development"
"关于开发的任务"
"priority 1 tasks about fixing bugs"
```

## Complex Query Examples

### Multi-Filter Queries

#### Example 1: Priority + Due Date
```
Query: "优先级为1的任务，今天到期"
Translation: "Priority 1 tasks due today"

Filters Extracted:
- Priority: high (1)
- Due Date: today

Result: Returns only high-priority tasks that are due today
```

#### Example 2: Status + Priority + Folder
```
Query: "open priority 1 tasks in folder projects"

Filters Extracted:
- Status: open
- Priority: high
- Folder: projects

Result: Returns only open, high-priority tasks from the projects folder
```

#### Example 3: Due Date + Status + Tags + Keywords
```
Query: "overdue in-progress tasks with tag work about development"

Filters Extracted:
- Due Date: overdue
- Status: inProgress
- Tags: ["work"]
- Keywords: ["development"]

Result: Returns overdue, in-progress tasks tagged #work that mention "development"
```

#### Example 4: Specific Date + Priority + Folder
```
Query: "tasks due 2025-10-20 with priority 2 from folder personal"

Filters Extracted:
- Due Date: 2025-10-20 (specific date)
- Priority: medium (2)
- Folder: personal

Result: Returns medium-priority tasks from personal folder due on that specific date
```

## Performance Optimization

### Direct Results (No AI)
For simple queries with ≤10 results and single filter:
- Response time: <100ms
- Token cost: $0
- Example: "priority 1 tasks"

### AI-Enhanced Results
For complex queries or >10 results:
- Pre-filters tasks using extracted criteria
- Sends only top 15 relevant tasks to AI
- AI provides prioritization and context
- Example: "urgent priority 1 tasks about development that are overdue"

### Filter Application Order

1. **Priority** - Fast hashtable lookup
2. **Due Date** - Date comparison
3. **Status** - Direct property match
4. **Folder** - String contains check
5. **Tags** - Array intersection
6. **Keywords** - Text search

## Implementation Details

### Query Intent Analysis

```typescript
interface QueryIntent {
    isSearch: boolean;
    isPriority: boolean;
    isDueDate: boolean;
    keywords: string[];
    extractedPriority: string | null;
    extractedDueDateFilter: string | null;
    extractedStatus: string | null;
    extractedFolder: string | null;
    extractedTags: string[];
    hasMultipleFilters: boolean;
}
```

### Compound Filter Application

```typescript
TaskSearchService.applyCompoundFilters(tasks, {
    priority: "high",
    dueDate: "today",
    status: "open",
    folder: "projects",
    tags: ["work", "urgent"],
    keywords: ["development"]
})
```

## Configuration

### Priority Mapping (in Settings)
```typescript
dataviewPriorityMapping: {
    high: ["high", "1", "p1"],
    medium: ["medium", "2", "p2"],
    low: ["low", "3", "p3"],
    none: ["none", "4", "p4"]
}
```

Users can customize these mappings in plugin settings to match their Dataview metadata format.

## Error Handling

### No Results Found
```
Query: "priority 5 tasks"
Response: "No tasks found matching priority: 5."
```

### Invalid Filter Values
- System gracefully ignores unrecognized filter values
- Falls back to keyword search
- AI helps interpret unclear queries

## Future Enhancements

Potential improvements for consideration:

1. **Date Range Queries**
   - "tasks due between Oct 15 and Oct 20"
   - "tasks created last month"

2. **Negation Filters**
   - "tasks not in folder archive"
   - "tasks without tag completed"

3. **Sorting Options**
   - "sort by due date"
   - "order by priority"

4. **Aggregation Queries**
   - "count tasks by priority"
   - "show task distribution by folder"

5. **Smart Suggestions**
   - Auto-complete folder names
   - Suggest available tags
   - Hint at common priority values

## Testing Complex Queries

### Test Scenarios

1. **Single Filter**
   - ✅ "priority 1 tasks"
   - ✅ "tasks due today"
   - ✅ "completed tasks"

2. **Two Filters**
   - ✅ "priority 1 tasks due today"
   - ✅ "open tasks in folder work"
   - ✅ "overdue high priority tasks"

3. **Three+ Filters**
   - ✅ "open priority 1 tasks due today in folder projects"
   - ✅ "completed tasks with tag work from last week"
   - ✅ "overdue in-progress priority 2 tasks about development"

4. **Bilingual Support**
   - ✅ "优先级为1的任务，今天到期"
   - ✅ "未完成的任务，在项目文件夹"
   - ✅ Mixed: "priority 1 任务 due today"

## Benefits

1. **Performance** - Direct filtering avoids unnecessary AI calls
2. **Accuracy** - Structured extraction prevents misinterpretation
3. **Cost** - Reduced token usage for simple queries
4. **Flexibility** - Natural language + structured filters
5. **Scalability** - Handles large task lists efficiently
6. **Multilingual** - Works with English and Chinese seamlessly

## See Also

- [Task Search Service](../../src/services/taskSearchService.ts)
- [AI Service](../../src/services/aiService.ts)
- [Dataview Integration](../../src/services/dataviewService.ts)
