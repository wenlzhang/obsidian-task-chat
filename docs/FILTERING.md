# Task Filtering

**Control which tasks appear in Task Chat using inclusions and exclusions.**

## Overview

Task Chat provides two powerful ways to control which tasks appear in your searches:

1. **✅ Inclusions** - Use the filter interface to temporarily focus on specific tasks
2. **❌ Exclusions** - Use settings to permanently hide tasks from all searches

**Important:** Exclusions always take priority over inclusions. If a task is excluded in settings, it won't appear even if included by filters.

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
s
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

---

#### 6. ⏰ Due Date Range

Include only tasks with due dates within a specific range.

**Quick date options:**
- Today
- This Week
- This Month
- Custom Range

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

### Filter Logic

Task Chat uses **two different logic systems** for different filter types:

#### 📍 Source Filters (OR Logic)

Tasks are included if they match **ANY** of these criteria:
- **Folders**: Is in an included folder, **OR**
- **Note tags**: Is from a note with an included tag, **OR**
- **Task tags**: Has an included task tag, **OR**
- **Notes**: Is in an included specific note

**Example:**
```
Include:
- Folders: ["Projects"]
- Task Tags: ["#urgent"]

Result:
✅ Task in "Projects/" folder (no tags) → Included
✅ Task with #urgent (in any folder) → Included
✅ Task in "Projects/" with #urgent → Included
✅ Task in "Archive/" with #urgent → Included (tag matches)
❌ Task in "Archive/" (no #urgent) → Not included
```

#### 🎯 Task Property Filters (AND Logic)

Tasks must match **ALL** selected property criteria:
- **Priorities**: Has one of the selected priorities, **AND**
- **Due date**: Falls within the date range, **AND**
- **Status**: Has one of the selected statuses

**Example:**
```
Include:
- Priorities: [1, 2] (high priority)
- Due Date: This Week
- Statuses: ["open"]

Result:
✅ Priority 1, due this week, open → Included (all match)
❌ Priority 1, due next month, open → Not included (date doesn't match)
❌ Priority 3, due this week, open → Not included (priority doesn't match)
❌ Priority 1, due this week, completed → Not included (status doesn't match)
```

#### 🔗 Combining Source + Property Filters

Source filters (OR) are applied first, then property filters (AND) refine the results.

**Example:**
```
Include:
- Folders: ["Projects"] OR Task Tags: ["#urgent"] (Source OR)
- AND Priorities: [1, 2] (Property AND)
- AND Due Date: This Week (Property AND)

Result:
✅ "Projects/" task, priority 1, due this week → Included
✅ Task with #urgent, priority 2, due this week → Included
❌ "Projects/" task, priority 3, due this week → Not included (priority)
❌ Task with #urgent, priority 1, due next month → Not included (date)
```

---

## Exclusions (Settings)

Exclusions are **permanent rules** that hide tasks from ALL searches. They're useful for:
- Archive folders
- Template notes
- Completed projects
- Personal notes you never want to see in searches

### Exclusion Logic (AND)

Tasks must pass **ALL** exclusion rules to be included:
- **NOT** in excluded folder, **AND**
- **NOT** has excluded note tag, **AND**
- **NOT** has excluded task tag, **AND**
- **NOT** in excluded specific note

**Example:**
```
Exclude:
- Folders: ["Archive"]
- Task Tags: ["#draft"]

Result:
✅ Task in "Projects/" (no #draft) → Included (passes all exclusions)
❌ Task in "Archive/" (no #draft) → Excluded (fails folder rule)
❌ Task in "Projects/" with #draft → Excluded (fails tag rule)
❌ Task in "Archive/" with #draft → Excluded (fails both rules)
```

### How to Manage Exclusions

1. Go to **Settings** → **Task Chat** → **Task filtering**
2. Click the **"Manage exclusions"** button next to "Task exclusions"
3. The Manage Exclusions modal will open
4. Click **"Add..."** to add exclusion rules
5. Select the type (Folder, Tag, or Note)
6. Search and select items using fuzzy search
7. Click the **×** button to remove exclusions

**Auto-refresh:** Changes to exclusions immediately update the task count in the chat interface.

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

---

### Zero tasks after restart

**Solution:**
Filter state is saved and restored on restart. If you had filters active:
1. Click the **🔍 Filter** button
2. Click **"Clear All"** to reset filters
3. Or adjust filters to match your current needs

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
