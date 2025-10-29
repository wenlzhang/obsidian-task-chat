# Task Chat: Auto-Refresh and Filter Persistence Improvements

## Issues Identified

### 1. **No Auto-Refresh on Settings Changes**
- **Problem**: When exclusion settings are changed (folders, tags, notes), tasks don't automatically refresh
- **Root Cause**: `ExclusionsModal` and `SettingsTab` call `saveSettings()` but NOT `refreshTasks()`
- **Impact**: Users must manually click refresh button after changing exclusions

### 2. **Filter State Not Persisted**
- **Problem**: Chat interface filters (folders, tags, notes) don't persist across Obsidian restarts
- **Root Cause**: `currentFilter` exists in chatView but not saved to settings
- **Impact**: Users lose their filter configuration on restart

### 3. **Initial Load Shows 0 Tasks**
- **Problem**: On Obsidian restart, task list shows 0 until manual refresh
- **Root Cause**: Timing issue - `refreshTasks()` may run before DataView is fully ready
- **Impact**: Poor UX - users think plugin is broken

### 4. **Poor Zero Tasks Messaging**
- **Problem**: When 0 tasks shown, no explanation of why (exclusions/inclusions/filters)
- **Root Cause**: No diagnostic information in UI
- **Impact**: Users don't know how to fix the issue

### 5. **No Conflict Warnings**
- **Problem**: Exclusions (settings) vs Inclusions (chat filters) conflicts not surfaced
- **Root Cause**: No validation or warning system
- **Impact**: Confusing behavior when filters contradict each other

---

## Implementation Plan

### Fix 1: Auto-Refresh on Exclusion Changes

**File**: `src/views/exclusionsModal.ts`

Add `refreshTasks()` call after saving:

```typescript
private async removeExclusion(type: string, value: string) {
    // ... existing removal logic ...
    await this.plugin.saveSettings();

    // AUTO-REFRESH: Trigger task refresh
    await this.plugin.refreshTasks();
    new Notice("Exclusions updated - tasks refreshed");
}

private showAddMenu(e: MouseEvent, listContainer: HTMLElement) {
    // After each addition:
    await this.plugin.saveSettings();
    this.renderExclusionsList(listContainer);

    // AUTO-REFRESH: Trigger task refresh
    await this.plugin.refreshTasks();
    new Notice(`Exclusion added - tasks refreshed`);
}
```

**Changes Needed**:
- Line 193: Add `await this.plugin.refreshTasks()` + notice
- Line 242: Add `await this.plugin.refreshTasks()` + notice
- Line 258: Add `await this.plugin.refreshTasks()` + notice
- Line 274: Add `await this.plugin.refreshTasks()` + notice
- Line 291: Add `await this.plugin.refreshTasks()` + notice

---

### Fix 2: Persist Chat Interface Filters

**File**: `src/settings.ts`

Update `currentFilter` to be actively used (remove DEPRECATED comment):

```typescript
export interface PluginSettings {
    // ... other settings ...

    // Chat interface filter state (persists across restarts)
    // Applied via filter icon in chat interface
    currentFilter: TaskFilter;
}
```

**File**: `src/views/chatView.ts`

Load and save filter state:

```typescript
async onOpen() {
    // ... existing code ...

    // RESTORE: Load persisted filter from settings
    this.currentFilter = { ...this.plugin.settings.currentFilter };

    // AUTO-APPLY: If filter exists, apply it
    if (this.hasActiveFilter()) {
        const filtered = await this.plugin.filterTasks(
            this.plugin.allTasks,
            this.currentFilter,
        );
        this.updateTasks(filtered, this.currentFilter);
    }
}

async applyFilters(filter: TaskFilter) {
    this.currentFilter = filter;

    // PERSIST: Save filter to settings
    this.plugin.settings.currentFilter = { ...filter };
    await this.plugin.saveSettings();

    // ... rest of existing logic ...
}

async resetFilters() {
    this.currentFilter = {};

    // PERSIST: Clear filter from settings
    this.plugin.settings.currentFilter = {};
    await this.plugin.saveSettings();

    // ... rest of existing logic ...
}
```

---

### Fix 3: Reliable Initial Load

**File**: `src/main.ts`

Improve DataView readiness detection:

```typescript
async onload(): Promise<void> {
    await this.loadSettings();

    // ... other initialization ...

    // Wait for workspace to be ready AND DataView to be available
    this.app.workspace.onLayoutReady(async () => {
        // IMPROVED: Poll for DataView availability
        await this.waitForDataView();

        // Now safe to load tasks
        await this.refreshTasks();

        // Auto-open sidebar if enabled
        if (this.settings.autoOpenSidebar) {
            this.activateView();
        }
    });
}

/**
 * Wait for DataView plugin to be fully loaded and ready
 * Polls every 500ms for up to 10 seconds
 */
private async waitForDataView(maxAttempts = 20): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        if (DataviewService.isDataviewEnabled(this.app)) {
            const api = DataviewService.getAPI(this.app);
            if (api && api.pages) {
                Logger.debug("DataView API ready");
                return;
            }
        }

        Logger.debug(`Waiting for DataView... (attempt ${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    Logger.warn("DataView not available after waiting - tasks may not load");
}
```

---

### Fix 4: Comprehensive Zero Tasks Messaging

**File**: `src/views/chatView.ts`

Add diagnostic information when 0 tasks:

```typescript
private renderZeroTasksMessage(container: HTMLElement) {
    container.empty();

    const messageEl = container.createDiv("task-chat-zero-tasks");
    messageEl.createEl("h3", { text: "No tasks found" });

    // Check active filters
    const hasInclusion Filters = this.hasActiveFilter();
    const hasExclusions = this.hasActiveExclusions();

    if (hasInclusionFilters || hasExclusions) {
        const helpEl = messageEl.createDiv("task-chat-zero-tasks-help");
        helpEl.createEl("p", {
            text: "This could be due to your filter settings:"
        });

        const listEl = helpEl.createEl("ul");

        // Show active inclusion filters
        if (hasInclusionFilters) {
            listEl.createEl("li", {
                text: `✓ Chat Filters Active (${this.getFilterSummary()})`,
            });

            const resetBtn = listEl.createEl("button", {
                text: "Reset Chat Filters",
                cls: "mod-cta",
            });
            resetBtn.addEventListener("click", () => this.resetFilters());
        }

        // Show active exclusions
        if (hasExclusions) {
            const exclusionSummary = this.getExclusionSummary();
            listEl.createEl("li", {
                text: `✗ Exclusion Rules Active (${exclusionSummary})`,
            });

            const settingsBtn = listEl.createEl("button", {
                text: "Open Exclusion Settings",
            });
            settingsBtn.addEventListener("click", () => {
                // Open settings to exclusions section
                const setting = (this.app as any).setting;
                setting.open();
                setting.openTabById(this.plugin.manifest.id);
            });
        }

        // Explain conflict resolution
        if (hasInclusionFilters && hasExclusions) {
            const noteEl = helpEl.createDiv("task-chat-conflict-note");
            noteEl.createEl("strong", {
                text: "⚠️ Note: "
            });
            noteEl.appendText(
                "Exclusion rules take priority over inclusion filters. " +
                "If a task matches both, it will be excluded."
            );
        }
    } else {
        messageEl.createEl("p", {
            text: "You have no tasks in your vault, or DataView is not enabled.",
        });
    }

    // Show DataView status
    if (!DataviewService.isDataviewEnabled(this.app)) {
        const warningEl = messageEl.createDiv("task-chat-dataview-warning");
        warningEl.createEl("strong", { text: "⚠️ DataView Not Enabled" });
        warningEl.createEl("p", {
            text: "This plugin requires the DataView plugin to be installed and enabled.",
        });
    }
}

private hasActiveExclusions(): boolean {
    const ex = this.plugin.settings.exclusions;
    return !!(
        (ex.noteTags && ex.noteTags.length > 0) ||
        (ex.taskTags && ex.taskTags.length > 0) ||
        (ex.folders && ex.folders.length > 0) ||
        (ex.notes && ex.notes.length > 0)
    );
}

private getExclusionSummary(): string {
    const ex = this.plugin.settings.exclusions;
    const parts: string[] = [];

    if (ex.noteTags && ex.noteTags.length > 0) {
        parts.push(`${ex.noteTags.length} note tag(s)`);
    }
    if (ex.taskTags && ex.taskTags.length > 0) {
        parts.push(`${ex.taskTags.length} task tag(s)`);
    }
    if (ex.folders && ex.folders.length > 0) {
        parts.push(`${ex.folders.length} folder(s)`);
    }
    if (ex.notes && ex.notes.length > 0) {
        parts.push(`${ex.notes.length} note(s)`);
    }

    return parts.join(", ");
}
```

---

### Fix 5: Conflict Detection and Warnings

**File**: `src/services/taskFilterService.ts`

Add conflict detection:

```typescript
/**
 * Detect conflicts between inclusion filters and exclusion rules
 * Returns array of warning messages
 */
export function detectFilterConflicts(
    inclusionFilters: {
        folders?: string[];
        noteTags?: string[];
        taskTags?: string[];
        notes?: string[];
    },
    exclusionRules: {
        folders?: string[];
        noteTags?: string[];
        taskTags?: string[];
        notes?: string[];
    }
): string[] {
    const warnings: string[] = [];

    // Check folder conflicts
    if (inclusionFilters.folders && exclusionRules.folders) {
        const overlap = inclusionFilters.folders.filter(f =>
            exclusionRules.folders!.some(ef =>
                f.startsWith(ef) || ef.startsWith(f)
            )
        );
        if (overlap.length > 0) {
            warnings.push(
                `⚠️ Folder Conflict: ${overlap.join(", ")} - ` +
                `Tasks from these folders are excluded by settings`
            );
        }
    }

    // Check note tag conflicts
    if (inclusionFilters.noteTags && exclusionRules.noteTags) {
        const overlap = inclusionFilters.noteTags.filter(t =>
            exclusionRules.noteTags!.includes(t)
        );
        if (overlap.length > 0) {
            warnings.push(
                `⚠️ Note Tag Conflict: ${overlap.join(", ")} - ` +
                `Notes with these tags are excluded by settings`
            );
        }
    }

    // Check task tag conflicts
    if (inclusionFilters.taskTags && exclusionRules.taskTags) {
        const overlap = inclusionFilters.taskTags.filter(t =>
            exclusionRules.taskTags!.includes(t)
        );
        if (overlap.length > 0) {
            warnings.push(
                `⚠️ Task Tag Conflict: ${overlap.join(", ")} - ` +
                `Tasks with these tags are excluded by settings`
            );
        }
    }

    return warnings;
}
```

**File**: `src/views/chatView.ts`

Show warnings when applying filters:

```typescript
async applyFilters(filter: TaskFilter) {
    this.currentFilter = filter;

    // DETECT CONFLICTS
    const warnings = detectFilterConflicts(
        {
            folders: filter.folders,
            noteTags: filter.noteTags,
            taskTags: filter.taskTags,
            notes: filter.notes,
        },
        this.plugin.settings.exclusions
    );

    // SHOW WARNINGS
    if (warnings.length > 0) {
        const warningMsg = warnings.join("\n");
        new Notice(warningMsg, 8000); // Show for 8 seconds
        Logger.warn("Filter conflicts detected:", warnings);
    }

    // ... rest of existing logic ...
}
```

---

## Testing Checklist

### Auto-Refresh Testing
- [ ] Change exclusion folders → tasks auto-refresh
- [ ] Change exclusion note tags → tasks auto-refresh
- [ ] Change exclusion task tags → tasks auto-refresh
- [ ] Change exclusion notes → tasks auto-refresh
- [ ] Notice shown after each change

### Filter Persistence Testing
- [ ] Apply folder filter → restart Obsidian → filter still active
- [ ] Apply tag filter → restart Obsidian → filter still active
- [ ] Apply multiple filters → restart Obsidian → all filters active
- [ ] Reset filters → restart Obsidian → no filters active

### Initial Load Testing
- [ ] Restart Obsidian → tasks load automatically (not 0)
- [ ] Disable DataView → restart → warning shown
- [ ] Enable DataView → restart → tasks load
- [ ] Check console for "DataView API ready" message

### Zero Tasks Messaging
- [ ] Apply filter with no matches → helpful message shown
- [ ] Enable exclusions that block all tasks → exclusion info shown
- [ ] Combine conflicting filters → conflict warning shown
- [ ] Click "Reset Chat Filters" button → filters reset
- [ ] Click "Open Exclusion Settings" button → settings open

### Conflict Detection Testing
- [ ] Include folder + exclude same folder → warning shown
- [ ] Include tag + exclude same tag → warning shown
- [ ] Multiple conflicts → all warnings shown
- [ ] No conflicts → no warnings

---

## Priority Order for Implementation

1. **Fix 1** (Auto-refresh) - **HIGH PRIORITY** - Most annoying for users
2. **Fix 3** (Initial load) - **HIGH PRIORITY** - Makes plugin seem broken
3. **Fix 2** (Filter persistence) - **MEDIUM PRIORITY** - Convenience feature
4. **Fix 4** (Zero tasks messaging) - **MEDIUM PRIORITY** - Helps users understand
5. **Fix 5** (Conflict warnings) - **LOW PRIORITY** - Nice to have

---

## Notes

- **Exclusions always win**: Settings-level exclusions take priority over chat-level inclusions
- **OR logic preserved**: Multiple inclusion filters use OR (not AND) as implemented
- **Backwards compatible**: Changes don't break existing functionality
- **Performance**: Auto-refresh adds minimal overhead (tasks already cached)

