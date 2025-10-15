# Query Examples

Quick reference for Task Chat query capabilities.

## Simple Queries

### By Priority
```
"priority 1 tasks"
"high priority tasks"
"p1 tasks"
"优先级为1的任务"
"show me priority 2 tasks"
```

### By Due Date
```
"tasks due today"
"overdue tasks"
"tasks due tomorrow"
"tasks due this week"
"今天到期的任务"
"过期的任务"
```

### By Status
```
"open tasks"
"completed tasks"
"in progress tasks"
"未完成的任务"
"已完成的任务"
```

### By Folder
```
"tasks in folder projects"
"tasks from work folder"
"personal folder tasks"
```

### By Tag
```
"#work tasks"
"tasks with tag urgent"
"#project tasks"
```

## Compound Queries

### Two Filters

```
"priority 1 tasks due today"
优先级为1，今天到期的任务

"open tasks in folder work"
未完成的任务，在工作文件夹

"overdue high priority tasks"
过期的高优先级任务

"completed tasks with tag project"
已完成的任务，标签为project
```

### Three+ Filters

```
"open priority 1 tasks due today"
未完成的优先级1任务，今天到期

"in progress tasks in folder projects with tag development"
进行中的任务，在项目文件夹，标签为开发

"overdue priority 2 tasks in work folder"
过期的优先级2任务，在工作文件夹

"completed tasks due this week with tag review"
已完成的任务，本周到期，标签为审查
```

### Filters with Keywords

```
"priority 1 tasks about development"
优先级1关于开发的任务

"overdue tasks in folder projects about API integration"
过期的任务，在项目文件夹，关于API集成

"open priority 2 tasks due today about bug fixes"
未完成的优先级2任务，今天到期，关于bug修复

"in progress #work tasks about documentation"
进行中的工作任务，关于文档编写
```

## Advanced Examples

### Complex Multi-Filter Queries

```
"open priority 1 tasks due today in folder projects with tag urgent about development"
未完成的优先级1任务，今天到期，在项目文件夹，标签为紧急，关于开发

"overdue in progress priority 2 tasks in work folder with tag client"
过期的进行中优先级2任务，在工作文件夹，标签为客户

"completed tasks due this week in folder personal with tag health"
已完成的任务，本周到期，在个人文件夹，标签为健康
```

### Natural Language Variations

```
English:
- "show me tasks with priority 1"
- "what tasks are due today?"
- "find open tasks in projects folder"
- "list high priority tasks that are overdue"

Chinese:
- "给我显示优先级为1的任务"
- "今天有哪些任务到期？"
- "查找项目文件夹中未完成的任务"
- "列出过期的高优先级任务"

Mixed:
- "priority 1 任务 due today"
- "未完成的 tasks in folder projects"
```

## Tips for Best Results

### ✅ Do

1. **Be specific with filters**
   - "priority 1 tasks due today" ✓
   - "tasks" ✗ (too broad)

2. **Combine filters naturally**
   - "open priority 1 tasks in folder work" ✓
   - Natural language flows well

3. **Use consistent terminology**
   - Priority: "priority 1", "p1", "high"
   - Due dates: "today", "tomorrow", "this week"

4. **Add context with keywords**
   - "priority 1 tasks about API development" ✓
   - Keywords help narrow results

### 🎯 Query Patterns

**Filter-focused queries** → Direct results (fast, free)
```
"priority 1 tasks"
"tasks due today"
"open tasks in folder work"
```

**Complex analytical queries** → AI-enhanced results
```
"what should I work on next from my priority 1 tasks?"
"which overdue tasks are most urgent?"
"summarize my progress on project tasks"
```

## Priority Reference

Based on default settings (customizable):

| Level | Values | Chinese |
|-------|--------|---------|
| High | 1, p1, high, highest | 高, 优先级1 |
| Medium | 2, p2, medium, med | 中, 优先级2 |
| Low | 3, p3, low | 低, 优先级3 |
| None | 4, p4, none | 无, 优先级4 |

## Date Reference

| Filter | English | Chinese |
|--------|---------|---------|
| Today | today | 今天 |
| Tomorrow | tomorrow | 明天 |
| This Week | this week | 本周 |
| Next Week | next week | 下周 |
| Overdue | overdue | 过期, 逾期 |
| Specific | 2025-10-15 | 2025-10-15 |

## Status Reference

| Status | Keywords (English) | Keywords (Chinese) |
|--------|-------------------|-------------------|
| Open | open, incomplete, pending, todo | 未完成, 待办 |
| Completed | completed, done, finished | 完成, 已完成 |
| In Progress | in progress, in-progress, ongoing | 进行中, 正在做 |

## Performance Notes

### Instant Results (No AI, $0)
- Simple single-filter queries with ≤10 results
- Example: "priority 1 tasks" with 5 tasks → instant

### AI-Enhanced Results
- Multiple filters + many results
- Complex analytical queries
- Prioritization and context needed
- Example: "open priority 1 tasks about development due today" → AI helps prioritize

## See Also

- [Complex Query Documentation](dev/COMPLEX_QUERIES.md) - Technical details
- [Enhancement Summary](dev/ENHANCEMENT_SUMMARY_2025-10-15.md) - Implementation details
