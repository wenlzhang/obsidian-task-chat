# Per-Mode Sort Settings (2025-10-17)

## Summary

Implemented **per-mode sort settings** so each chat mode (Simple Search, Smart Search, Task Chat) remembers its own sort preference. When users switch between modes, the appropriate sort setting is automatically loaded.

---

## Problem Statement

**Before**: Single global `taskSortBy` setting applied to all modes
- When user switched chat modes, sort setting stayed the same
- Not optimal: Different modes benefit from different sort methods
- User had to manually change sort each time they switched modes

**After**: Each mode has its own sort setting
- Simple Search → `taskSortBySimple` (default: relevance)
- Smart Search → `taskSortBySmart` (default: relevance)
- Task Chat → `taskSortByChat` (default: auto)
- Automatically loads the appropriate sort when mode changes

---

## Changes Made

### 1. Settings Schema

**New Fields** (`src/settings.ts`):
```typescript
// Per-mode sort preferences
taskSortBySimple: "relevance" | "dueDate" | "priority" | "created" | "alphabetical";
taskSortBySmart: "relevance" | "dueDate" | "priority" | "created" | "alphabetical";
taskSortByChat: "auto" | "relevance" | "dueDate" | "priority" | "created" | "alphabetical";
taskSortBy: "auto" | ... ; // DEPRECATED: For migration only
```

**Default Values**:
```typescript
taskSortBySimple: "relevance",  // Best for keyword searches
taskSortBySmart: "relevance",   // Best for AI-expanded keywords
taskSortByChat: "auto",         // AI-driven intelligent sorting
```

---

### 2. Migration Logic

**File**: `src/main.ts` → `loadSettings()`

```typescript
// Migrate taskSortBy to per-mode sort settings
if (
    this.settings.taskSortBy &&
    (!this.settings.taskSortBySimple ||
        !this.settings.taskSortBySmart ||
        !this.settings.taskSortByChat)
) {
    console.log("Migrating taskSortBy to per-mode sort settings");
    const oldSort = this.settings.taskSortBy;

    // Initialize with sensible defaults based on old value
    if (!this.settings.taskSortBySimple) {
        this.settings.taskSortBySimple =
            oldSort === "auto" ? "relevance" : oldSort;
    }
    if (!this.settings.taskSortBySmart) {
        this.settings.taskSortBySmart =
            oldSort === "auto" ? "relevance" : oldSort;
    }
    if (!this.settings.taskSortByChat) {
        this.settings.taskSortByChat = oldSort;
    }

    await this.saveSettings();
}
```

**Migration Behavior**:
- If user had `auto`: Simple/Smart get `relevance`, Chat gets `auto`
- If user had any other sort: All modes get that sort
- Runs once on first load after update

---

### 3. Helper Method

**File**: `src/main.ts`

```typescript
/**
 * Get the sort setting for a specific chat mode
 */
getSortByForMode(
    mode: "simple" | "smart" | "chat",
): "auto" | "relevance" | "dueDate" | "priority" | "created" | "alphabetical" {
    switch (mode) {
        case "simple":
            return this.settings.taskSortBySimple;
        case "smart":
            return this.settings.taskSortBySmart;
        case "chat":
            return this.settings.taskSortByChat;
    }
}
```

**Purpose**: Centralized way to get the correct sort setting for any mode

---

### 4. AI Service Updates

**File**: `src/services/aiService.ts`

**Get Mode-Specific Sort**:
```typescript
// Determine current chat mode
const chatMode = settings.defaultChatMode;

// Get mode-specific sort setting
let modeSortBy: string;
switch (chatMode) {
    case "simple":
        modeSortBy = settings.taskSortBySimple;
        break;
    case "smart":
        modeSortBy = settings.taskSortBySmart;
        break;
    case "chat":
        modeSortBy = settings.taskSortByChat;
        break;
}
```

**Use Mode-Specific Sort**:
```typescript
// Instead of: settings.taskSortBy === "auto"
if (modeSortBy === "auto") { ... }

// Instead of: settings.taskSortBy === "relevance"
if (modeSortBy === "relevance") { ... }

// Pass to TaskSortService
TaskSortService.sortTasks(tasks, {
    ...settings,
    taskSortBy: modeSortBy as any,
});
```

---

### 5. Settings Tab UI

**File**: `src/settingsTab.ts` → `renderSortBySetting()`

**Before** (1 dropdown):
```
Sort tasks by: [Dropdown with conditional "Auto" option]
```

**After** (3 separate dropdowns):
```
Sort for Simple Search: [Dropdown: relevance, dueDate, priority, ...]
Sort for Smart Search:  [Dropdown: relevance, dueDate, priority, ...]
Sort for Task Chat:     [Dropdown: auto, relevance, dueDate, priority, ...]
```

**Benefits**:
- Clear, explicit control over each mode
- No confusion about which mode uses which sort
- Auto option only shown for Task Chat (mode-appropriate)

---

## User Experience

### Scenario 1: Default User

**Behavior**:
1. User installs plugin (fresh install)
2. Gets optimal defaults for each mode:
   - Simple Search: relevance ✓
   - Smart Search: relevance ✓
   - Task Chat: auto ✓

### Scenario 2: Mode Switching

**Behavior**:
1. User is in Simple Search mode (sort: relevance)
2. User switches to Task Chat mode
3. **Automatically loads** Task Chat sort (auto) ✓
4. User switches back to Simple Search
5. **Automatically loads** Simple Search sort (relevance) ✓

**No manual adjustment needed!**

### Scenario 3: Custom Preferences

**Behavior**:
1. User prefers due date sorting in Simple Search
2. User goes to Settings → Task Display
3. Sets "Sort for Simple Search" to "Due date"
4. Sets "Sort for Task Chat" to "Priority"
5. Each mode now remembers custom preference ✓

### Scenario 4: Existing User (Migration)

**Behavior**:
1. User had `taskSortBy: "dueDate"` (old single setting)
2. Plugin updates
3. Migration runs automatically:
   - taskSortBySimple: "dueDate"
   - taskSortBySmart: "dueDate"
   - taskSortByChat: "dueDate"
4. **Preserves user's preference** ✓
5. User can now customize per-mode if desired

---

## Technical Details

### Data Flow

```
User switches mode in chat
    ↓
chatView determines effective mode
    ↓
AIService.sendMessage() called with settings
    ↓
AIService determines chatMode from settings.defaultChatMode
    ↓
AIService gets modeSortBy from appropriate field
    ↓
Tasks sorted using mode-specific sort setting
    ↓
Results displayed
```

### Settings Storage

**In data.json**:
```json
{
  "taskSortBySimple": "relevance",
  "taskSortBySmart": "relevance",
  "taskSortByChat": "auto",
  "taskSortBy": "auto",  // DEPRECATED: kept for backward compat
  ...
}
```

### Mode-Sort Mapping

| Mode | Setting Field | Default | Options |
|------|--------------|---------|---------|
| Simple Search | `taskSortBySimple` | `relevance` | relevance, dueDate, priority, created, alphabetical |
| Smart Search | `taskSortBySmart` | `relevance` | relevance, dueDate, priority, created, alphabetical |
| Task Chat | `taskSortByChat` | `auto` | **auto**, relevance, dueDate, priority, created, alphabetical |

**Note**: "auto" is exclusive to Task Chat mode

---

## Benefits

### 1. **Better User Experience**
- Each mode uses optimal sort by default
- Switching modes feels intelligent
- No manual adjustment needed

### 2. **Flexibility**
- Users can customize per-mode
- Each mode independent
- Remembers preferences across sessions

### 3. **Mode-Appropriate Defaults**
| Mode | Why This Default |
|------|------------------|
| Simple Search (relevance) | Keyword-based, best-match-first makes sense |
| Smart Search (relevance) | AI-expanded keywords, relevance still optimal |
| Task Chat (auto) | AI-driven, intelligent context-aware sorting |

### 4. **Backward Compatible**
- Migration preserves existing user settings
- Old `taskSortBy` field kept for compatibility
- Smooth upgrade experience

---

## Implementation Notes

### Why Three Separate Fields?

**Alternative Considered**: Store as object
```typescript
taskSortByMode: {
    simple: "relevance",
    smart: "relevance",
    chat: "auto"
}
```

**Why Rejected**:
- Harder to migrate
- More complex settings UI
- Obsidian settings API works better with flat structure

**Chosen Approach**: Three flat fields
```typescript
taskSortBySimple: "relevance",
taskSortBySmart: "relevance",
taskSortByChat: "auto",
```

**Benefits**:
- Simple migration
- Easy UI binding
- Clear in data.json

### Why Keep `taskSortBy`?

- **Migration**: Needed to detect old settings
- **Compatibility**: If any code still references it
- **Fallback**: Safety net during transition
- **Future**: Can remove in later version

---

## Testing Checklist

### Basic Functionality
- [ ] **Fresh install**
  - taskSortBySimple defaults to "relevance"
  - taskSortBySmart defaults to "relevance"
  - taskSortByChat defaults to "auto"

- [ ] **Mode switching**
  - Switch Simple → Task Chat → loads "auto" sort
  - Switch Task Chat → Simple → loads "relevance" sort
  - Switch Smart → Task Chat → loads appropriate sort

### Settings UI
- [ ] **Three dropdowns visible**
  - "Sort for Simple Search" exists
  - "Sort for Smart Search" exists
  - "Sort for Task Chat" exists

- [ ] **Auto option**
  - Task Chat dropdown has "Auto" option
  - Simple Search dropdown does NOT have "Auto"
  - Smart Search dropdown does NOT have "Auto"

- [ ] **Changes save**
  - Change Simple Search sort → saves to taskSortBySimple
  - Change Smart Search sort → saves to taskSortBySmart
  - Change Task Chat sort → saves to taskSortByChat
  - Reload plugin → settings persist

### Sorting Behavior
- [ ] **Simple Search mode**
  - Uses taskSortBySimple setting
  - Respects custom user preference
  - Relevance sorting works with keywords

- [ ] **Smart Search mode**
  - Uses taskSortBySmart setting
  - Respects custom user preference
  - Relevance sorting works with AI keywords

- [ ] **Task Chat mode**
  - Uses taskSortByChat setting
  - Auto mode works (relevance for keywords, dueDate otherwise)
  - Other modes work as expected

### Migration
- [ ] **Existing user (auto)**
  - Old: taskSortBy = "auto"
  - After migration:
    - taskSortBySimple = "relevance"
    - taskSortBySmart = "relevance"
    - taskSortByChat = "auto"

- [ ] **Existing user (dueDate)**
  - Old: taskSortBy = "dueDate"
  - After migration:
    - taskSortBySimple = "dueDate"
    - taskSortBySmart = "dueDate"
    - taskSortByChat = "dueDate"

---

## Files Modified

| File | Changes |
|------|---------|
| `src/settings.ts` | Added 3 new fields, kept deprecated taskSortBy |
| `src/main.ts` | Added migration logic, getSortByForMode() method |
| `src/services/aiService.ts` | Uses modeSortBy based on chatMode |
| `src/settingsTab.ts` | Renders 3 separate sort dropdowns |

**Total Lines Changed**: ~150 lines

---

## Future Improvements

### Potential Enhancements

1. **Visual Indicator**
   - Show current mode's sort in chat interface
   - Example: "📊 Sorting: Relevance (Simple Search mode)"

2. **Quick Toggle**
   - Add button to quickly change current mode's sort
   - Without going to settings

3. **Smart Recommendations**
   - Suggest sort based on query type
   - Example: "Try sorting by due date for time-based queries"

4. **Per-Session Override**
   - Allow temporary sort override within session
   - Resets to mode default on new session

---

## Summary

✅ **Implemented**: Per-mode sort settings
✅ **Migration**: Automatic, preserves user preferences  
✅ **UI**: Three clear, separate dropdowns
✅ **Behavior**: Automatic mode-aware sorting
✅ **Build**: Success, no errors

**Result**: Each chat mode now has its own sort preference that automatically loads when you switch modes. Users get optimal defaults and can customize each mode independently.

**User Benefit**: More intelligent, context-aware sorting without manual adjustment.
