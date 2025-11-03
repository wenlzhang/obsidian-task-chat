# Task Exclusions

**Exclude tasks from searches by tags, folders, or notes.**

## Overview

Task Chat allows you to exclude tasks from appearing in search results based on:
- **📁 Folders** - Exclude all tasks in specific folders (including subfolders)
- **🏷️ Tags** - Exclude tasks with specific tags (both task-level and note-level)
- **📄 Notes** - Exclude all tasks in specific notes

Exclusions are applied when tasks are loaded from the vault, ensuring excluded tasks never appear in search results.

## How to Manage Exclusions

### Open the Exclusions Manager

1. Go to **Settings** → **Task Chat** → **Task filtering**
2. Click the **"Task exclusions"** button next to "Manage exclusions"
3. The Manage Exclusions modal will open

### Add Exclusions

Click the **"Add..."** button in the modal and select:
- **📁 Folder** - Search and select folders from your vault
- **🏷️ Tag** - Search and select tags from your vault
- **📄 Note** - Search and select notes from your vault

All three use **fuzzy search** - just start typing and matching items will appear.

## How Exclusions Work

### Folder Exclusions

**Excludes:** All tasks in the specified folder and its subfolders

**Example:**
```
Exclude folder: "Archive"

Result:
✅ Tasks in "Projects/Work.md" → Included
❌ Tasks in "Archive/Old.md" → Excluded
❌ Tasks in "Archive/2023/Notes.md" → Excluded (subfolder)
```

**Use cases:**
- Archive folders
- Template folders
- Reference folders
- Draft folders

### Tag Exclusions

**Excludes:** Tasks in TWO ways

#### 1. Task-Level Tags (Direct)
Tasks that have the excluded tag directly on the task line.

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

#### 2. Note-Level Tags (Inherited)
ALL tasks in notes that have the excluded tag (frontmatter or inline).

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

**Note:** Tag matching is **case-insensitive**. `#Archive`, `#ARCHIVE`, and `#archive` are all treated as the same tag.

**Use cases:**
- Archive tags
- Template tags
- Completed project tags
- Draft tags

### Note Exclusions

**Excludes:** All tasks in the specific note

**Example:**
```
Exclude note: "Daily Note Template.md"

Result:
✅ Tasks in "Daily Notes/2024-01-28.md" → Included
❌ Tasks in "Daily Note Template.md" → Excluded
✅ Tasks in "Projects/Work.md" → Included
```

**Use cases:**
- Template files
- Example files
- Scratch/temporary notes
- Test notes

## Combining Exclusions

You can combine multiple exclusions of different types:

**Example:**
```
Exclusions:
🏷️ #archive
🏷️ #template
📁 Archive
📁 Templates
📄 Daily Note Template.md

Result:
Any task matching ANY of these criteria will be excluded.
```

## Viewing Exclusion Results

### Task Count

After adding exclusions:
1. Click the **"Refresh"** button in the chat interface
2. The task count will update to reflect excluded tasks
3. Send a new query to see the filtered results

### Verify Exclusions

To verify exclusions are working:
1. Note the current task count
2. Add an exclusion (e.g., a common tag)
3. Click "Refresh"
4. The task count should decrease
5. Send a query and verify excluded tasks don't appear

## Troubleshooting

### Task Count Doesn't Update

**Problem:** After adding exclusions, task count stays the same

**Solution:**
1. Click the "Refresh" button in the chat interface
2. Wait a moment for tasks to reload
3. Check the task count again

### Tags Not Being Excluded

**Problem:** Tasks with excluded tags still appear

**Possible causes:**
1. **Tag format mismatch** - Check if tag has `#` prefix
   - Both `#archive` and `archive` should work
   - Tag matching is case-insensitive
2. **Task-level vs note-level** - Verify where the tag is:
   - On the task line: `- [ ] Task #tag`
   - In the note frontmatter: `tags: [tag]`
   - Inline in the note: `#tag`
3. **Cache not updated** - Click "Refresh" to reload tasks

### Folders Not Being Excluded

**Problem:** Tasks in excluded folders still appear

**Possible causes:**
1. **Path mismatch** - Verify the folder path is correct
   - Use the fuzzy search to select the exact folder
2. **Subfolder confusion** - Remember that subfolders are automatically excluded
   - Excluding "Projects" also excludes "Projects/Work"
3. **Cache not updated** - Click "Refresh" to reload tasks

## Related Documentation

- **[Task Filtering](SETTINGS_GUIDE.md#4-task-filtering)** - Other filtering options
- **[Task Indexing](TASK_INDEXING.md)** - How Task Chat uses Datacore
- **[Search Syntax](README.md#-search-examples)** - Query syntax examples

## FAQ

**Q: Do exclusions affect all search modes?**  
A: Yes, exclusions apply to Simple Search, Smart Search, and Task Chat modes.

**Q: Are subfolders automatically excluded?**  
A: Yes, excluding a folder automatically excludes all its subfolders.

**Q: How many exclusions can I add?**  
A: There's no limit, but be reasonable. Too many exclusions may slow down task loading slightly.

**Q: Can I export/import exclusions?**  
A: Exclusions are stored in Task Chat's settings file. You can copy settings between vaults.

## Summary

**Exclusions provide powerful filtering to keep your task list focused on what matters.**

- 📁 **Folder exclusions** - Hide entire folders and subfolders
- 🏷️ **Tag exclusions** - Hide tasks by tag (task-level or note-level)
- 📄 **Note exclusions** - Hide specific notes

**Remember:** Click "Refresh" after adding exclusions to see the updated task count!
