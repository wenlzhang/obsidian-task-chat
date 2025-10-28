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
2. Click the **"Manage..."** button next to "Manage exclusions"
3. The Manage Exclusions modal will open

### Add Exclusions

Click the **"Add..."** button in the modal and select:
- **🏷️ Tag** - Search and select tags from your vault
- **📁 Folder** - Search and select folders from your vault
- **📄 Note** - Search and select notes from your vault

All three use **fuzzy search** - just start typing and matching items will appear.

### Remove Exclusions

Hover over any exclusion in the list and click the **×** button to remove it.

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

## Technical Details

### How Exclusions Are Applied

1. **DataView API** queries all tasks from your vault
2. **Task Chat** processes each task through `processDataviewTask()`
3. **Exclusion check** (`isTaskExcluded()`) filters out:
   - Tasks in excluded notes
   - Tasks in excluded folders (and subfolders)
   - Tasks with excluded tags (task-level or note-level)
4. **Filtered tasks** are displayed in search results

### Execution Order

Exclusions are checked in this order:
1. **Note exclusion** - Is the task in an excluded note?
2. **Folder exclusion** - Is the task in an excluded folder?
3. **Tag exclusion** - Does the task or note have an excluded tag?

If any check returns true, the task is excluded.

### Path Normalization

- All paths are normalized to lowercase for comparison
- Leading/trailing slashes are removed
- Case-insensitive matching ensures reliability

### Tag Normalization

- Tags are normalized by removing the `#` prefix
- Case-insensitive matching (`#Archive` = `#archive`)
- Works with or without `#` when adding exclusions

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

## Performance

Exclusions are very efficient:
- ✅ Applied during task loading (no post-processing)
- ✅ Early return on first match (no unnecessary checks)
- ✅ Uses Obsidian's metadata cache (no file I/O)
- ✅ Path/tag normalization cached per task

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

## Common Use Cases

### Archive Completed Projects

**Scenario:** Keep old project tasks but don't show them in searches

**Solution:**
1. Add a `#completed` or `#archive` tag to completed project notes
2. Exclude the `#completed` or `#archive` tag
3. All tasks in those notes will be hidden

### Hide Templates

**Scenario:** Template files contain example tasks

**Solution:**
1. Keep all templates in a "Templates" folder
2. Exclude the "Templates" folder
3. All template tasks will be hidden

### Exclude Draft Notes

**Scenario:** Draft notes have tasks that aren't ready

**Solution:**
1. Add `#draft` tag to draft notes
2. Exclude the `#draft` tag
3. All tasks in draft notes will be hidden

### Mix Approaches

**Scenario:** Complex workflow with multiple exclusion needs

**Solution:**
```
Exclusions:
🏷️ #archive
🏷️ #template
🏷️ #draft
📁 Archive
📁 Templates
📁 Old Projects
📄 Scratchpad.md
📄 Test Notes.md
```

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
   - Check for typos

2. **Subfolder confusion** - Remember that subfolders are automatically excluded
   - Excluding "Projects" also excludes "Projects/Work"

3. **Cache not updated** - Click "Refresh" to reload tasks

## Best Practices

### Use Consistent Tagging

Establish tag conventions for your vault:
- `#archive` for old content
- `#template` for templates
- `#draft` for work in progress

### Organize with Folders

Use folders to group related content:
- Archive old projects in "Archive" folder
- Keep templates in "Templates" folder
- Separate work areas with folders

### Review Exclusions Regularly

Periodically review your exclusions:
1. Open the Manage Exclusions modal
2. Remove exclusions you no longer need
3. Add new exclusions as your vault grows

### Test New Exclusions

When adding exclusions:
1. Note the current task count
2. Add the exclusion
3. Click "Refresh"
4. Verify the count decreased as expected

## Examples

### Example 1: Student Workflow

**Goal:** Hide completed course tasks

**Setup:**
```yaml
Course Note:
---
tags: [course, cs101]
status: completed
---

- [ ] Assignment 1
- [ ] Assignment 2
```

**Exclusion:** Add tag `#completed`

**Result:** All tasks in completed course notes hidden

### Example 2: Work Projects

**Goal:** Hide archived projects but keep active ones

**Setup:**
```
Folders:
- Projects/
  - Active/
  - Archive/
```

**Exclusion:** Add folder `Projects/Archive`

**Result:** Only tasks in `Projects/Active` appear

### Example 3: Mixed Content

**Goal:** Hide templates, drafts, and old content

**Setup:**
```
Exclusions:
🏷️ #template
🏷️ #draft
🏷️ #archive
📁 Templates
📁 Archive
📄 Scratchpad.md
```

**Result:** Clean task list with only relevant tasks

## Related Documentation

- **[Task Filtering](SETTINGS_GUIDE.md#4-task-filtering)** - Other filtering options
- **[DataView Integration](SETTINGS_GUIDE.md#5-dataview-integration)** - How Task Chat uses DataView
- **[Search Syntax](README.md#-search-examples)** - Query syntax examples

## FAQ

**Q: Do exclusions affect all search modes?**  
A: Yes, exclusions apply to Simple Search, Smart Search, and Task Chat modes.

**Q: Can I temporarily disable exclusions?**  
A: No, but you can remove them from the Manage Exclusions modal and add them back later.

**Q: Are subfolders automatically excluded?**  
A: Yes, excluding a folder automatically excludes all its subfolders.

**Q: Does tag exclusion work with nested tags?**  
A: Obsidian doesn't support true nested tags. Each tag is treated independently.

**Q: Can I exclude by file extension?**  
A: Not currently. Only markdown files with tasks are processed.

**Q: Do exclusions affect the vault or just Task Chat?**  
A: Exclusions only affect Task Chat. Your vault files remain unchanged.

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
