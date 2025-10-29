# Task Filtering

**Control which tasks appear in Task Chat using inclusions and exclusions.**

## Overview

Task Chat provides two powerful ways to control which tasks appear in your searches:

1. **✅ Inclusions** - Use the filter interface to temporarily focus on specific tasks
2. **❌ Exclusions** - Use settings to permanently hide tasks from all searches

**Important:** Exclusions always take priority over inclusions. If a task is excluded in settings, it won't appear even if included by filters.

## Table of Contents

- [Inclusions (Filter Interface)](#inclusions-filter-interface)
  - [How to Access](#how-to-access-the-filter-interface)
  - [Filter Types](#filter-types)
  - [Tag Types: Task Tags vs Note Tags](#tag-types-task-tags-vs-note-tags)
  - [Filter Logic](#filter-logic)
  - [Quick Date Filters](#quick-date-filters)
- [Exclusions (Settings)](#exclusions-settings)
  - [How to Manage](#how-to-manage-exclusions)
  - [Exclusion Types](#exclusion-types)
- [Priority Rules](#priority-rules)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## Inclusions (Filter Interface)

The filter interface allows you to **temporarily focus** on specific tasks during a chat session. Filters are applied on top of exclusions and can be saved across sessions.

### How to Access the Filter Interface

1. Open the Task Chat view (click the chat icon in the left sidebar)
2. Click the **🔍 Filter** button at the top of the chat interface
3. The filter modal will open

### Filter Types

The filter interface supports the following inclusion criteria:

#### 1. 📁 Folders
Include only tasks from specific folders.

**Example:**
```
Include folders: ["Projects/Work", "Projects/Personal"]

Result:
✅ Tasks in "Projects/Work/Report.md" → Included
✅ Tasks in "Projects/Personal/TODO.md" → Included
❌ Tasks in "Archive/Old.md" → Not included
```

**How it works:**
- Folder matching includes subfolders
- Use fuzzy search to find folders quickly
- OR logic: tasks from ANY selected folder are included

---

#### 2. 🏷️ Tags in Notes (Note-Level Tags)
Include tasks from notes that have specific tags in their frontmatter or inline tags.

**Example:**
```yaml
Include note tags: ["#project", "#work"]

Note with frontmatter:
---
tags: [project, important]
---

- [ ] Task 1
- [ ] Task 2

Result:
✅ Task 1 → Included (note has #project)
✅ Task 2 → Included (note has #project)
```

**How it works:**
- Checks tags in note's frontmatter (YAML)
- Checks inline tags in note body
- **ALL tasks** in matching notes are included
- OR logic: tasks from notes with ANY selected tag are included

---

#### 3. 🏷️ Tags in Tasks (Task-Level Tags)
Include only tasks that have specific tags directly on the task line.

**Example:**
```markdown
Include task tags: ["#urgent", "#high-priority"]

Note content:
- [ ] Regular task
- [ ] Important task #urgent
- [ ] Critical task #high-priority
- [ ] Another regular task

Result:
❌ Regular task → Not included
✅ Important task #urgent → Included
✅ Critical task #high-priority → Included
❌ Another regular task → Not included
```

**How it works:**
- Checks tags that appear directly on the task line
- Does NOT check note-level tags
- Only matching tasks are included (not entire notes)
- OR logic: tasks with ANY selected tag are included

---

#### 4. 📄 Specific Notes
Include tasks only from specific notes (file paths).

**Example:**
```
Include notes: ["Projects/Work/Q1-Goals.md", "Daily/2024-01-15.md"]

Result:
✅ Tasks in "Projects/Work/Q1-Goals.md" → Included
✅ Tasks in "Daily/2024-01-15.md" → Included
❌ Tasks in other notes → Not included
```

---

#### 5. 🎯 Priorities
Include only tasks with specific priority levels.

**Obsidian task priority syntax:**
- `1` - Highest priority (⏫)
- `2` - High priority (🔼)
- `3` - Medium priority (🔽)
- `4` - Low priority (⏬)
- `0` - No priority

**Example:**
```
Include priorities: [1, 2]

Result:
✅ High priority task ⏫ → Included
✅ Medium-high task 🔼 → Included
❌ Low priority task 🔽 → Not included
```

---

#### 6. ⏰ Due Date Range
Include only tasks with due dates within a specific range.

**Quick date options:**
- Today
- This Week
- This Month
- Overdue
- Custom Range

**Example:**
```
Include: "This Week"

Result:
✅ Due 2024-01-15 (within this week) → Included
✅ Due 2024-01-19 (within this week) → Included
❌ Due 2024-01-25 (next week) → Not included
```

---

#### 7. 📊 Task Statuses
Include only tasks with specific status categories.

**Default status categories:**
- `open` - Not yet started (` `)
- `inProgress` - Currently working on (`/`)
- `completed` - Done (`x`)
- `cancelled` - Cancelled (`-`)

**Note:** Status categories can be customized in settings. See [Status Categories Guide](STATUS_CATEGORIES.md) for details.

**Example:**
```
Include statuses: ["open", "inProgress"]

Result:
✅ - [ ] Open task → Included
✅ - [/] In progress task → Included
❌ - [x] Completed task → Not included
```

---

### Tag Types: Task Tags vs Note Tags

Task Chat distinguishes between two types of tags to give you precise control:

| Type | Location | Scope | Example |
|------|----------|-------|---------|
| **Task Tags** | On task line itself | Individual tasks | `- [ ] Task #urgent` |
| **Note Tags** | Frontmatter or inline | ALL tasks in note | `tags: [project]` |

#### Why Keep Them Separate?

**Different semantics:**
- **Note tag filter** → "Show me tasks from project notes"
- **Task tag filter** → "Show me tasks marked as urgent"

**Different effects:**
- **Note tag exclusion** → Removes entire pages (more efficient)
- **Task tag exclusion** → Removes individual tasks (more precise)

**Performance:**
- Note-level filtering can short-circuit entire pages
- Task-level filtering requires per-task evaluation

#### When to Use Each

**Use Note Tags when:**
- Organizing tasks by project, area, or context
- All tasks in a note share the same classification
- Example: All tasks in "Work Project" note have `#work` tag

**Use Task Tags when:**
- Individual tasks need different classifications within the same note
- Marking specific tasks with special attributes
- Example: Some tasks in a note are `#urgent`, others aren't

**Use Both when:**
- You want maximum flexibility
- Example: Filter by `#work` notes AND tasks tagged `#urgent`

---

### Filter Logic

**OR logic across dimensions:**
Tasks are included if they match **ANY** of the following:
- Is in an included folder, OR
- Is from a note with an included tag, OR
- Has an included task tag, OR
- Is in an included note, OR
- Has an included priority, OR
- Has a due date in the included range, OR
- Has an included status

**AND logic within dimensions:**
Multiple filters from different categories work together.

**Example:**
```
Include:
- Folders: ["Projects"]
- Task Tags: ["#urgent"]
- Priorities: [1, 2]

Result:
✅ Task in "Projects/" folder → Included (matches folder)
✅ Task with #urgent tag (anywhere) → Included (matches tag)
✅ High priority task ⏫ (anywhere) → Included (matches priority)
✅ Task in "Projects/" with #urgent → Included (matches multiple)
❌ Task not matching any criteria → Not included
```

---

### Quick Date Filters

The filter interface provides quick shortcuts for common date ranges:

| Button | Includes |
|--------|----------|
| **Today** | Tasks due today |
| **This Week** | Tasks due this week (Sunday-Saturday) |
| **This Month** | Tasks due this month |
| **Overdue** | Tasks with past due dates (incomplete only) |
| **Custom** | Specify exact start and end dates |

**Note:** All quick filters only include incomplete tasks by default.

---

## Exclusions (Settings)

Exclusions are **permanent rules** that hide tasks from ALL searches. They're useful for:
- Archive folders
- Template notes
- Completed projects
- Personal notes you never want to see in searches

### How to Manage Exclusions

1. Go to **Settings** → **Task Chat** → **Task filtering**
2. Click the **"Manage..."** button next to "Manage exclusions"
3. The Manage Exclusions modal will open
4. Click **"Add..."** to add exclusion rules
5. Select the type (Folder, Tag, or Note)
6. Search and select items using fuzzy search
7. Click the **×** button to remove exclusions

**Auto-refresh:** Changes to exclusions immediately update the task count in the chat interface.

### Exclusion Types

#### 1. 📁 Folder Exclusions
Excludes **ALL tasks** in specified folders and subfolders.

**Example:**
```
Exclude folder: "Archive"

Result:
✅ Tasks in "Projects/Work.md" → Included
❌ Tasks in "Archive/Old.md" → Excluded
❌ Tasks in "Archive/2023/Notes.md" → Excluded (subfolder)
```

---

#### 2. 🏷️ Tag Exclusions

Tag exclusions work at **TWO levels**:

**A. Task-Level Tags (Direct)**
Excludes individual tasks that have the tag on the task line.

**Example:**
```markdown
Exclude tag: "#archive"

Note content:
- [ ] Active task
- [ ] Old task #archive
- [ ] Another active task

Result:
✅ Active task → Included
❌ Old task #archive → Excluded
✅ Another active task → Included
```

**B. Note-Level Tags (Inherited)**
Excludes **ALL tasks** in notes that have the tag.

**Example:**
```yaml
Exclude tag: "#archive"

Note with frontmatter:
---
tags: [project, archive]
---

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

Result:
❌ Task 1 → Excluded (note has #archive)
❌ Task 2 → Excluded (note has #archive)
❌ Task 3 → Excluded (note has #archive)
```

---

#### 3. 📄 Note Exclusions
Excludes **ALL tasks** in specific notes.

**Example:**
```
Exclude note: "Templates/Task Template.md"

Result:
❌ All tasks in "Templates/Task Template.md" → Excluded
✅ Tasks in other notes → Included
```

**Use cases:**
- Template files
- Example notes
- Reference materials

---

## Priority Rules

**Exclusions ALWAYS override inclusions.**

This ensures that tasks you've explicitly marked to hide (via settings) will never appear, even if included by filters.

### Examples

**Example 1: Excluded folder cannot be included**
```
Settings (Exclusions):
- Folders: ["Archive"]

Filter Interface (Inclusions):
- Folders: ["Archive", "Projects"]

Result:
❌ Tasks in "Archive/" → Excluded (settings override)
✅ Tasks in "Projects/" → Included
```

**Example 2: Excluded tag cannot be included**
```
Settings (Exclusions):
- Tags: ["#draft"]

Filter Interface (Inclusions):
- Task Tags: ["#draft", "#urgent"]

Result:
❌ Tasks with #draft → Excluded (settings override)
✅ Tasks with #urgent (without #draft) → Included
```

**Example 3: Combining both**
```
Settings (Exclusions):
- Folders: ["Archive"]
- Tags: ["#template"]

Filter Interface (Inclusions):
- Folders: ["Projects"]
- Task Tags: ["#urgent"]

Result:
✅ "Projects/Task.md" with #urgent → Included
❌ "Archive/Task.md" with #urgent → Excluded (folder rule)
❌ "Projects/Task.md" with #template → Excluded (tag rule)
❌ "Archive/Task.md" with #template → Excluded (both rules)
```

---

## Examples

### Example 1: Student Workflow

**Goal:** Focus on homework due this week, excluding archived courses.

**Settings (Exclusions):**
```
Folders: ["Archive/Completed Courses"]
Tags: ["#graduated"]
```

**Filter Interface (Inclusions):**
```
Folders: ["Courses"]
Task Tags: ["#homework"]
Due Date: "This Week"
```

**Result:**
- Shows homework tasks from current courses
- Due this week
- Excludes archived courses

---

### Example 2: Work Project Management

**Goal:** Show urgent tasks from active work projects.

**Settings (Exclusions):**
```
Tags: ["#archived", "#template"]
Folders: ["Templates"]
```

**Filter Interface (Inclusions):**
```
Note Tags: ["#work"]
Task Tags: ["#urgent", "#blocked"]
Priorities: [1, 2]
Statuses: ["open", "inProgress"]
```

**Result:**
- Shows high-priority, urgent/blocked tasks
- From work-related notes
- Only open or in-progress
- Excludes archived projects and templates

---

### Example 3: Daily Review

**Goal:** Review all overdue and today's tasks across all projects.

**Settings (Exclusions):**
```
Tags: ["#someday", "#maybe"]
Folders: ["Archive", "Ideas"]
```

**Filter Interface (Inclusions):**
```
Due Date: "Overdue" + "Today"
Statuses: ["open", "inProgress"]
```

**Result:**
- Shows all tasks that need attention today
- Excludes future ideas and archived items

---

## Troubleshooting

### No tasks found after applying filters

**Check:**
1. **Active exclusions** - Go to Settings → Task Chat → Manage Exclusions
   - Exclusions may be hiding tasks you're trying to include
   - Remove or modify conflicting exclusion rules

2. **Filter combination** - Multiple filters use OR logic
   - Make sure at least ONE filter matches your tasks
   - Try removing some filters to see if tasks appear

3. **Task syntax** - Ensure tasks use proper Obsidian syntax
   - Must start with `- [ ]` for checkbox tasks
   - Check for proper spacing: `- [ ] Task` not `- []Task`

4. **DataView indexing** - Wait for DataView to finish indexing
   - Check DataView status in the console
   - Refresh tasks using the refresh button

---

### Zero tasks after restart

**Solution:**
Filter state is saved and restored on restart. If you had filters active:
1. Click the **🔍 Filter** button
2. Click **"Clear All"** to reset filters
3. Or adjust filters to match your current needs

---

### Exclusions not auto-updating

**Symptom:** Task count doesn't update after changing exclusions.

**Solution:**
This should auto-update now. If not:
1. Click the refresh button in the chat interface
2. Report the issue on GitHub

---

### Combining folder and tag filters returns zero results

**Check filter logic:**
- Filters use **OR** logic, not AND
- Tasks matching **ANY** filter are included
- If zero results, likely all matching tasks are excluded

**Example of common confusion:**
```
Filter:
- Folders: ["Projects"]
- Task Tags: ["#urgent"]

Expected (incorrect): "Tasks in Projects folder AND tagged #urgent"
Actual (correct): "Tasks in Projects folder OR tagged #urgent"
```

To get AND behavior, use exclusions to narrow down results.

---

### Tag filter showing wrong tasks

**Check tag type:**
- **Note Tags** → Includes ALL tasks from matching notes
- **Task Tags** → Includes only tasks with the tag

**Solution:**
Make sure you're using the correct tag type for your use case.

---

## Related Documentation

- [Task Exclusions Guide](EXCLUSIONS.md) - Detailed exclusion documentation
- [Status Categories Guide](STATUS_CATEGORIES.md) - Customize task statuses
- [Settings Guide](SETTINGS_GUIDE.md) - Complete settings reference
- [Query Syntax](../README.md#query-syntax) - Search syntax for chat queries

---

## Feedback

Found an issue or have a suggestion? [Open an issue on GitHub](https://github.com/wenlzhang/obsidian-task-chat/issues).
