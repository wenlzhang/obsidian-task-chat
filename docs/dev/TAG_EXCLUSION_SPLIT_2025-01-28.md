# Tag Exclusion Split: Note-Level vs Task-Level

**Date:** 2025-01-28  
**Status:** ✅ Implemented

## User Request

> "Currently, if a tag is added to a task, it excludes all tasks within that note because there is no distinction about whether the tag belongs to a task or to the note itself. For example, it could be in frontmatter, in another part, in a paragraph, or in a list item. All of these are the same type; they are used to filter all tasks within a note. However, if a tag is within a note task, regardless of its status, we should only filter out tasks with that tag, while leaving other tasks within that note unaffected. Therefore, you need to establish a distinction."

## The Problem

**Before:** Single "Tags" exclusion treated all tags the same
```
Settings:
  exclusions.tags = ["#archive", "#skip"]

Behavior:
  - Note with #archive in frontmatter → ALL tasks excluded ❌
  - Task with #archive on task line → ALL tasks in note excluded ❌
  - No distinction between note-level and task-level tags
```

**Issues:**
- ❌ Too coarse-grained - can't exclude specific tasks
- ❌ No control over scope (note vs task)
- ❌ Confusing UX - same tag, different intent

## The Solution

**After:** Separate note-level and task-level tag exclusions
```
Settings:
  exclusions.noteTags = ["#archive", "#template"]
  exclusions.taskTags = ["#skip", "#ignore"]

Behavior:
  - Note with #archive in frontmatter → ALL tasks excluded ✅
  - Task with #skip on task line → ONLY that task excluded ✅
  - Clear distinction and control
```

**Benefits:**
- ✅ Fine-grained control
- ✅ Two distinct exclusion types
- ✅ Clear user intent
- ✅ More flexible filtering

## Implementation

### 1. Settings Structure

**Old:**
```typescript
exclusions: {
    tags: string[];        // Ambiguous scope
    folders: string[];
    notes: string[];
}
```

**New:**
```typescript
exclusions: {
    noteTags: string[];    // Note-level: exclude ALL tasks in note
    taskTags: string[];    // Task-level: exclude ONLY specific tasks
    folders: string[];
    notes: string[];
}
```

### 2. DataView JavaScript API Usage

**Note-Level Tag Exclusion:**
```typescript
// Filter pages using .where() method (JavaScript API)
if (settings.exclusions.noteTags?.length > 0) {
    pages = pages.where((page: any) => {
        const pageTags = page.file.tags || [];
        
        // Check if page has any excluded note tag
        return !settings.exclusions.noteTags.some((excludedTag: string) => {
            const normalizedExcluded = excludedTag.replace(/^#+/, '');
            
            return pageTags.some((pageTag: string) => {
                const normalizedPageTag = pageTag.replace(/^#+/, '');
                // Case-insensitive comparison
                return normalizedPageTag.toLowerCase() === normalizedExcluded.toLowerCase();
            });
        });
    });
}
```

**Task-Level Tag Exclusion:**
```typescript
// Check individual task tags
const isTaskTagExcluded = this.isTaskExcludedByTag(
    dvTask,
    settings.exclusions.taskTags || [],
);

if (shouldInclude && !isTaskTagExcluded) {
    tasks.push(task);
}

// Helper method
private static isTaskExcludedByTag(
    dvTask: any,
    excludedTags: string[],
): boolean {
    const taskTags = dvTask.tags || [];
    
    return excludedTags.some((excludedTag: string) => {
        const normalizedExcluded = excludedTag.replace(/^#+/, '');
        
        return taskTags.some((taskTag: string) => {
            const normalizedTaskTag = taskTag.replace(/^#+/, '');
            return normalizedTaskTag.toLowerCase() === normalizedExcluded.toLowerCase();
        });
    });
}
```

### 3. UI Updates

**Modal Header:**
```typescript
// Before
"Exclude tags, folders, or notes from task searches."

// After
"Exclude items from task searches.

Tags in notes: Excludes ALL tasks in notes with these tags
Tags in tasks: Excludes ONLY specific tasks with these tags"
```

**Add Menu:**
```
Before:
  🏷️ Tag
  📁 Folder
  📄 Note

After:
  🏷️ Tag in notes (exclude all tasks in note)
  🏷️ Tag in tasks (exclude specific tasks)
  📁 Folder
  📄 Note
```

**Exclusion Sections:**
```
Before:
  Tags: #archive, #skip, #template

After:
  Tags in notes: #archive, #template
  Tags in tasks: #skip, #ignore
```

### 4. Migration

**Auto-migration for existing settings:**
```typescript
// In loadSettings()
if (loadedData?.exclusions && 'tags' in loadedData.exclusions) {
    const oldTags = (loadedData.exclusions as any).tags || [];
    // Old behavior was note-level exclusion
    this.settings.exclusions.noteTags = oldTags;
    this.settings.exclusions.taskTags = [];
    await this.saveSettings();
}
```

**Why migrate to noteTags?**
- Old behavior excluded ALL tasks in a note with the tag
- This matches note-level exclusion semantics
- Preserves user's existing exclusion behavior

## Use Cases

### Use Case 1: Archive Entire Notes

**Scenario:** You have archived notes with many tasks you don't want to see

**Solution:** Use **note-level tags**
```
Note: "Old Project.md"
  Frontmatter: tags: [archive]
  - [ ] Task 1 ← EXCLUDED
  - [ ] Task 2 ← EXCLUDED
  - [ ] Task 3 ← EXCLUDED

Exclusion: noteTags = ["#archive"]
Result: ALL tasks in "Old Project.md" are excluded
```

### Use Case 2: Skip Specific Tasks

**Scenario:** You have a note with mixed tasks - some active, some to skip

**Solution:** Use **task-level tags**
```
Note: "Current Project.md"
  - [ ] Important task ← INCLUDED
  - [ ] Another task ← INCLUDED
  - [ ] Test task #skip ← EXCLUDED
  - [ ] Debug task #skip ← EXCLUDED

Exclusion: taskTags = ["#skip"]
Result: Only tasks with #skip are excluded, others remain
```

### Use Case 3: Template Notes

**Scenario:** You have template notes that contain example tasks

**Solution:** Use **note-level tags**
```
Note: "Task Template.md"
  Frontmatter: tags: [template]
  - [ ] Example task 1 ← EXCLUDED
  - [ ] Example task 2 ← EXCLUDED

Exclusion: noteTags = ["#template"]
Result: ALL tasks in template notes are excluded
```

### Use Case 4: Mixed Approach

**Scenario:** Archive old notes + skip specific tasks in active notes

**Solution:** Use **both exclusion types**
```
Settings:
  noteTags: ["#archive", "#template"]
  taskTags: ["#skip", "#ignore", "#maybe"]

Result:
  - Notes tagged #archive → all tasks excluded
  - Notes tagged #template → all tasks excluded
  - Individual tasks with #skip → only those tasks excluded
  - Other tasks remain visible
```

## Technical Details

### DataView Tag Structure

**Note-level tags (file.tags):**
- Includes frontmatter tags: `tags: [archive]`
- Includes inline tags: `#archive`
- Available at page level via `page.file.tags`
- Accessed via DataView `.where()` method

**Task-level tags (task.tags):**
- Tags on the task line: `- [ ] Task #skip`
- Available at task level via `dvTask.tags`
- Checked per-task during processing

### Case-Insensitive Comparison

Both exclusion types use case-insensitive comparison:
```typescript
const normalized = tag.replace(/^#+/, '');
return normalizedTag.toLowerCase() === normalizedExcluded.toLowerCase();
```

**Why?**
- User-friendly: `#Archive` matches `#archive`
- Consistent with Obsidian's tag behavior
- Prevents duplicate exclusions

### Performance

**Note-level filtering:**
- Applied at page level via DataView `.where()`
- Filters before loading tasks
- Very efficient (fewer pages to process)

**Task-level filtering:**
- Applied per-task during processing
- Checked after page-level filters
- Minimal overhead (simple array check)

## Files Modified

### 1. `src/settings.ts`
- Split `exclusions.tags` into `noteTags` and `taskTags`
- Updated type definitions and comments
- Updated DEFAULT_SETTINGS

### 2. `src/services/dataviewService.ts`
- Added `isTaskExcludedByTag()` method
- Updated page filtering to use `noteTags`
- Added task-level filter for `taskTags`
- Updated logging to show both counts

### 3. `src/views/exclusionsModal.ts`
- Updated header description
- Split tags into two sections
- Added `showNoteTagSuggest()` and `showTaskTagSuggest()`
- Updated add menu with clarifying text

### 4. `src/main.ts`
- Added migration logic in `loadSettings()`
- Auto-converts old `tags` to `noteTags`
- Initializes empty `taskTags` array

## User Experience

### Before
```
Manage exclusions
Exclude tags, folders, or notes from task searches.

Tags: #archive, #skip, #template
Folders: Old Projects
Notes: Template.md

[Add...]
  🏷️ Tag
  📁 Folder
  📄 Note
```

### After
```
Manage exclusions
Exclude items from task searches.

Tags in notes: Excludes ALL tasks in notes with these tags
Tags in tasks: Excludes ONLY specific tasks with these tags

Tags in notes: #archive, #template
Tags in tasks: #skip, #ignore
Folders: Old Projects
Notes: Template.md

[Add...]
  🏷️ Tag in notes (exclude all tasks in note)
  🏷️ Tag in tasks (exclude specific tasks)
  📁 Folder
  📄 Note
```

## Testing

**Test Case 1: Note-level exclusion**
```
Given: Note "Archive.md" with frontmatter tags: [archive]
  - [ ] Task 1
  - [ ] Task 2
And: noteTags = ["#archive"]
When: Refresh tasks
Then: 0 tasks from "Archive.md" appear
```

**Test Case 2: Task-level exclusion**
```
Given: Note "Active.md"
  - [ ] Important task
  - [ ] Skip this #skip
  - [ ] Another task
And: taskTags = ["#skip"]
When: Refresh tasks
Then: 2 tasks appear (Important task, Another task)
And: 1 task excluded (Skip this)
```

**Test Case 3: Mixed exclusion**
```
Given: Note "Archive.md" with tags: [archive]
  - [ ] Old task
  - [ ] Another old task
And: Note "Active.md"
  - [ ] Do this
  - [ ] Skip this #skip
And: noteTags = ["#archive"], taskTags = ["#skip"]
When: Refresh tasks
Then: 1 task appears (Do this)
And: 2 tasks excluded from "Archive.md"
And: 1 task excluded from "Active.md"
```

**Test Case 4: Case-insensitive**
```
Given: Note with #Archive (capital A)
And: noteTags = ["#archive"] (lowercase)
When: Refresh tasks
Then: Note is excluded (case-insensitive match)
```

**Test Case 5: Migration**
```
Given: Old settings with tags = ["#archive", "#skip"]
When: Plugin loads
Then: settings.exclusions.noteTags = ["#archive", "#skip"]
And: settings.exclusions.taskTags = []
And: Old behavior preserved
```

## Console Logs

**Before:**
```
[Task Chat] DataView JavaScript API exclusions: 3 tag(s), 1 folder(s), 1 note(s)
[Task Chat] Total tasks from DataView: 654 tasks
```

**After:**
```
[Task Chat] DataView JavaScript API exclusions: 2 note tag(s), 1 task tag(s), 1 folder(s), 1 note(s)
[Task Chat] Total tasks from DataView (filtered with .where(), 5 exclusion(s)): 654 tasks
```

## Benefits Summary

| Aspect | Before (Single tags) | After (noteTags + taskTags) |
|--------|---------------------|----------------------------|
| **Granularity** | Note-level only | Note-level AND task-level |
| **Control** | All or nothing | Fine-grained selection |
| **Clarity** | Ambiguous scope | Clear distinction |
| **Use Cases** | Limited | Flexible |
| **UX** | Confusing | Intuitive |
| **Migration** | N/A | Automatic |

## Conclusion

The split between note-level and task-level tag exclusions provides:

✅ **Better UX** - Clear distinction in UI  
✅ **More Control** - Exclude at note or task level  
✅ **Flexible** - Supports multiple use cases  
✅ **Intuitive** - Matches user mental model  
✅ **Backward Compatible** - Auto-migration preserves behavior  

**User feedback addressed:** 
> "We should distinguish between them. For tags, we could introduce labels such as 'tags in tasks' and 'tags in nodes.' We should separate them."

✅ **Implemented exactly as requested!**
