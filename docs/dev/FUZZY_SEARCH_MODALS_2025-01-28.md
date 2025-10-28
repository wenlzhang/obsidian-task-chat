# Fuzzy Search Modals for Exclusions

**Date:** 2025-01-28  
**Status:** ✅ Complete

## User Feedback

The user pointed out that when adding exclusions (folders, tags, notes), we should use Obsidian's native search/suggest API instead of plain text inputs or dropdowns. This provides a much better user experience with fuzzy search and autocomplete.

**User's request:**
> "What I meant was that when we try to add folders, tags, and notes, we can always use the Obsidian API—this pop-up feature—to search for folders, tags, and notes instead of manually typing, which is not very convenient."

## What Was Changed

### Before (Inconvenient)
- **Tags**: Plain text input with no suggestions
- **Folders**: Non-searchable dropdown
- **Notes**: Non-searchable dropdown

### After (Convenient)
- **Tags**: `FuzzySuggestModal` with all vault tags, searchable
- **Folders**: `FuzzySuggestModal` with all vault folders, searchable
- **Notes**: `FuzzySuggestModal` with all vault notes, searchable (prioritizes recent files)

## Implementation

### New File: `src/utils/suggestModals.ts`

Created three `FuzzySuggestModal` classes:

#### 1. FolderSuggestModal
```typescript
export class FolderSuggestModal extends FuzzySuggestModal<string> {
    constructor(app: App, private onChooseFolder: (folder: string) => void) {
        super(app);
        this.setPlaceholder("Type to search folders...");
    }
    
    getItems(): string[] {
        // Returns all folders in vault, including root "/"
    }
    
    getItemText(folder: string): string {
        return folder === "/" ? "/ (root)" : folder;
    }
    
    onChooseItem(folder: string, evt: MouseEvent | KeyboardEvent): void {
        this.onChooseFolder(folder);
    }
}
```

**Features:**
- Includes root folder option: `/`
- Extracts all unique folder paths from vault
- Sorts alphabetically
- Fuzzy search built-in

#### 2. TagSuggestModal
```typescript
export class TagSuggestModal extends FuzzySuggestModal<string> {
    constructor(app: App, private onChooseTag: (tag: string) => void) {
        super(app);
        this.setPlaceholder("Type to search tags...");
    }
    
    getItems(): string[] {
        // Returns all tags from vault
    }
}
```

**Features:**
- Extracts tags from file metadata cache
- Includes tags from frontmatter
- Normalizes tags (adds # if missing)
- Fuzzy search built-in

#### 3. NoteSuggestModal
```typescript
export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
    constructor(app: App, private onChooseNote: (note: TFile) => void) {
        super(app);
        this.setPlaceholder("Type to search notes...");
    }
    
    getItems(): TFile[] {
        // Returns all markdown files, recent first
    }
}
```

**Features:**
- Gets all markdown files
- Prioritizes recently opened files
- Shows full path for context
- Fuzzy search built-in

### Updated: `src/views/exclusionsModal.ts`

Replaced the old input methods with new suggest modals:

**Before:**
```typescript
private showTagInput(listContainer: HTMLElement) {
    // ~50 lines of modal creation, text input, buttons, etc.
}

private showFolderInput(listContainer: HTMLElement) {
    // ~45 lines of modal creation, dropdown, buttons, etc.
}

private showNoteInput(listContainer: HTMLElement) {
    // ~40 lines of modal creation, dropdown, buttons, etc.
}
```

**After:**
```typescript
private showTagSuggest(listContainer: HTMLElement) {
    const modal = new TagSuggestModal(this.app, async (tag) => {
        if (!this.plugin.settings.exclusions.tags.includes(tag)) {
            this.plugin.settings.exclusions.tags.push(tag);
            await this.plugin.saveSettings();
            this.renderExclusionsList(listContainer);
            new Notice(`Excluded tag: ${tag}`);
        } else {
            new Notice(`Tag ${tag} is already excluded`);
        }
    });
    modal.open();
}

private showFolderSuggest(listContainer: HTMLElement) {
    const modal = new FolderSuggestModal(this.app, async (folder) => {
        // Similar pattern...
    });
    modal.open();
}

private showNoteSuggest(listContainer: HTMLElement) {
    const modal = new NoteSuggestModal(this.app, async (file) => {
        // Similar pattern...
    });
    modal.open();
}
```

**Code reduction:**
- Tags: ~50 lines → ~10 lines (80% reduction)
- Folders: ~45 lines → ~12 lines (73% reduction)
- Notes: ~40 lines → ~12 lines (70% reduction)
- Total: ~135 lines → ~34 lines (75% reduction!)

## User Experience Improvements

### Tag Selection

**Before:**
1. Click "Add..." → "Tag"
2. See modal with text input
3. Type tag name manually
4. Click "Add" button
5. ❌ No suggestions, no autocomplete

**After:**
1. Click "Add..." → "Tag"
2. Fuzzy search modal appears
3. Start typing (e.g., "todo")
4. See matching tags: `#todo`, `#todolist`, `#ToDoDataview`
5. Press Enter or click to select
6. ✅ Instant, searchable, autocomplete

### Folder Selection

**Before:**
1. Click "Add..." → "Folder"
2. See modal with dropdown
3. Open dropdown
4. Scroll through unsearchable list
5. Click folder
6. Click "Add" button
7. ❌ No search, hard to find folders

**After:**
1. Click "Add..." → "Folder"
2. Fuzzy search modal appears
3. Start typing (e.g., "ext")
4. See matching: `002-External vault`, `002-External vault/0022-Link`
5. Press Enter or click to select
6. ✅ Instant search, easy to find

### Note Selection

**Before:**
1. Click "Add..." → "Note"
2. See modal with dropdown
3. Open dropdown
4. Scroll through hundreds of notes
5. Click note
6. Click "Add" button
7. ❌ No search, very inconvenient

**After:**
1. Click "Add..." → "Note"
2. Fuzzy search modal appears
3. Start typing (e.g., "ifttt")
4. See matching: `[[2024-06-02_IFTTT AI]]`
5. Recent files shown first
6. Press Enter or click to select
7. ✅ Super fast, prioritizes recent files

## Technical Details

### Obsidian FuzzySuggestModal

All three modals extend Obsidian's `FuzzySuggestModal<T>`:

```typescript
export abstract class FuzzySuggestModal<T> extends Modal {
    abstract getItems(): T[];
    abstract getItemText(item: T): string;
    abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;
}
```

**Built-in features:**
- ✅ Fuzzy search algorithm
- ✅ Keyboard navigation (↑/↓, Enter, Esc)
- ✅ Mouse selection
- ✅ Search highlighting
- ✅ Performance optimized
- ✅ Native Obsidian styling

### Data Sources

**FolderSuggestModal:**
- `app.vault.getAllLoadedFiles()` - All files and folders
- Filter for folders using `file.parent`
- Extract unique paths
- Add root folder "/"

**TagSuggestModal:**
- `app.vault.getMarkdownFiles()` - All markdown files
- `app.metadataCache.getFileCache(file)` - File metadata
- Extract from `cache.tags` (inline tags)
- Extract from `cache.frontmatter.tags` (YAML tags)
- Normalize (ensure # prefix)

**NoteSuggestModal:**
- `app.vault.getMarkdownFiles()` - All markdown files
- `app.workspace.getLastOpenFiles()` - Recent files
- Prioritize recent files at top
- Show full path for context

## Advantages

### User Benefits

✅ **Faster** - Type and search instantly  
✅ **Easier** - No scrolling through long lists  
✅ **Intuitive** - Familiar Obsidian UX  
✅ **Smart** - Fuzzy matching (typo-tolerant)  
✅ **Efficient** - Keyboard-friendly  
✅ **Organized** - Recent files prioritized  

### Developer Benefits

✅ **Less code** - 75% reduction (135 → 34 lines)  
✅ **Maintainable** - Obsidian handles the UI  
✅ **Reusable** - Modals can be used elsewhere  
✅ **Type-safe** - Generic type parameter `<T>`  
✅ **Native** - Uses official Obsidian APIs  
✅ **Tested** - Obsidian's modal is battle-tested  

### Code Quality

✅ **Separation of concerns** - Suggest logic in separate file  
✅ **Single responsibility** - Each modal does one thing  
✅ **DRY** - No duplicated modal code  
✅ **Clean** - Callback pattern for actions  
✅ **Consistent** - All three use same pattern  

## Comparison with Manual Approaches

| Approach | Code | Search | Keyboard | Fuzzy | Performance |
|----------|------|--------|----------|-------|-------------|
| Text input | 50 lines | ❌ None | ⚠️ Basic | ❌ No | ✅ Fast |
| Dropdown | 45 lines | ❌ None | ⚠️ Limited | ❌ No | ⚠️ Slow (many items) |
| FuzzySuggestModal | 10 lines | ✅ Yes | ✅ Full | ✅ Yes | ✅ Optimized |

## User Workflow Example

**Adding a folder exclusion:**

```
User: Click "Add..." → "Folder"
System: Opens FolderSuggestModal

Modal shows:
┌─────────────────────────────────┐
│ Type to search folders...       │
├─────────────────────────────────┤
│ /                               │
│ 002-External vault              │
│ 120-Periodic note               │
│ 300-Tool                        │
│ 800-Topic inbox                 │
│ ...                             │
└─────────────────────────────────┘

User: Types "bad"
Modal filters:
┌─────────────────────────────────┐
│ bad                             │
├─────────────────────────────────┤
│ 800-Topic inbox/Badminton tra...│
└─────────────────────────────────┘

User: Presses Enter
System: Adds folder to exclusions
Notice: "Excluded folder: 800-Topic inbox/Badminton training"
Modal: Closes
Main modal: Updates to show new exclusion
```

## Code Structure

```
src/
├── utils/
│   └── suggestModals.ts        (NEW)
│       ├── FolderSuggestModal
│       ├── TagSuggestModal
│       └── NoteSuggestModal
└── views/
    └── exclusionsModal.ts       (UPDATED)
        ├── showTagSuggest()     (simplified)
        ├── showFolderSuggest()  (simplified)
        └── showNoteSuggest()    (simplified)
```

## Testing

**Manual testing scenarios:**

1. **Tag search**
   - Open modal → Add Tag
   - Type partial tag name
   - Verify fuzzy matching works
   - Select tag
   - Verify it appears in list

2. **Folder search**
   - Open modal → Add Folder
   - Type partial folder name
   - Verify nested folders appear
   - Select folder
   - Verify it appears in list

3. **Note search**
   - Open modal → Add Note
   - Type partial note name
   - Verify recent files appear first
   - Select note
   - Verify full path appears in list

4. **Duplicate handling**
   - Try adding same item twice
   - Verify notice: "already excluded"

5. **Keyboard navigation**
   - Use ↑/↓ to navigate
   - Use Enter to select
   - Use Esc to cancel

## Future Enhancements

Possible improvements:

1. **Multi-select** - Add multiple items at once
2. **Regex patterns** - Support pattern matching
3. **Quick filters** - "Show only recent", "Show only nested"
4. **Preview** - Show folder contents or note preview
5. **Icons** - Show folder/note icons in modal
6. **Groups** - Group by folder structure or date

## Conclusion

The new fuzzy search modals provide a dramatically better user experience for adding exclusions. By leveraging Obsidian's native `FuzzySuggestModal`, we:

- ✅ Reduced code by 75%
- ✅ Improved UX significantly
- ✅ Made the feature keyboard-friendly
- ✅ Added fuzzy search capabilities
- ✅ Followed Obsidian's design patterns
- ✅ Made the code more maintainable

**Status:** ✅ Production ready  
**User benefit:** Much faster and easier to add exclusions  
**Developer benefit:** Clean, simple, reusable code
