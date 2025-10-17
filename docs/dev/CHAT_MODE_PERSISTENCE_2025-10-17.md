# Chat Mode Persistence Logic (2025-10-17)

## Problem

Previously, when a user created a new session, the chat interface would inherit the chat mode from the previous session instead of resetting to the default chat mode configured in settings.

**Expected behavior**:
1. New session → loads default chat mode from settings
2. Mode override in chat → remembered within current session
3. Plugin reload → restores last used mode for current session
4. New session again → resets to default

**Actual behavior (before fix)**:
- Mode override persisted across sessions
- New sessions inherited the previous session's mode
- Default chat mode setting was effectively ignored

---

## Solution

Implemented a two-setting system:

1. **`defaultChatMode`** (user-facing in settings)
   - User's default preference for new sessions
   - Shown in Settings → Task Chat → Default chat mode
   - Never changes unless user modifies it in settings

2. **`currentChatMode`** (stored in data.json)
   - Last used chat mode in current session
   - Persists in data.json across plugin reloads
   - Resets to `defaultChatMode` when creating new session
   - Not shown in settings UI (internal only)

---

## Implementation Details

### 1. View Initialization (`onOpen`)

When the chat view opens, restore the last used mode from the current session:

```typescript
async onOpen(): Promise<void> {
    // ...
    
    // Initialize chat mode from last used (stored in settings.currentChatMode in data.json)
    // If currentChatMode matches defaultChatMode, use null (meaning "use default")
    // Otherwise, it's an override from the current session
    if (this.plugin.settings.currentChatMode && 
        this.plugin.settings.currentChatMode !== this.plugin.settings.defaultChatMode) {
        this.searchModeOverride = this.plugin.settings.currentChatMode;
    } else {
        this.searchModeOverride = null; // Use default
    }
    
    // ...
}
```

**Logic**:
- If `currentChatMode` equals `defaultChatMode` → no override (use default)
- If `currentChatMode` differs → user had overridden, restore that override
- `searchModeOverride` is used throughout to determine effective mode

---

### 2. Mode Change Handler

When user changes mode in the dropdown, save to `searchMode` for persistence:

```typescript
this.searchModeSelect.addEventListener("change", async () => {
    const value = this.searchModeSelect?.value as "simple" | "smart" | "chat";
    
    // If user selects the default mode, clear the override
    if (value === this.plugin.settings.defaultChatMode) {
        this.searchModeOverride = null;
    } else {
        this.searchModeOverride = value;
    }
    
    // Save to settings.currentChatMode (persists in data.json for current session)
    this.plugin.settings.currentChatMode = value;
    await this.plugin.saveSettings();
    
    console.log(`[Task Chat] Chat mode changed to: ${value}`);
});
```

**Logic**:
- User selects mode in dropdown
- If it matches default → clear override (use default)
- Otherwise → set override to selected value
- Save to `currentChatMode` in data.json for persistence across reloads

---

### 3. New Session Creation

When creating a new session, reset to default:

```typescript
private async createNewSession(): Promise<void> {
    // ... check if session is empty ...
    
    // Create new session
    const newSession = this.plugin.sessionManager.createSession();
    
    // Reset chat mode to default for new session
    this.searchModeOverride = null;
    this.plugin.settings.currentChatMode = this.plugin.settings.defaultChatMode;
    await this.plugin.saveSettings();
    
    // Update dropdown to reflect default mode
    this.updateSearchModeOptions();
    
    // ...
    
    console.log(
        `[Task Chat] New session created, chat mode reset to default: ${this.plugin.settings.defaultChatMode}`,
    );
}
```

**Logic**:
- Clear override → will use default
- Set `currentChatMode` to `defaultChatMode` → syncs state in data.json
- Update dropdown → shows default mode
- Log confirmation

---

### 4. Dropdown Display

The dropdown always shows the current effective mode:

```typescript
public updateSearchModeOptions(): void {
    // ... create options ...
    
    // Set to current setting (or override if one exists)
    const currentMode =
        this.searchModeOverride || this.plugin.settings.defaultChatMode;
    this.searchModeSelect.value = currentMode;
    
    console.log(`[Task Chat] Chat mode dropdown updated: ${currentMode}`);
}
```

**Logic**:
- If override exists → show override
- Otherwise → show default
- This ensures dropdown always reflects effective mode

---

## Behavior Examples

### Example 1: Normal Workflow

1. **User sets default**: Settings → Default chat mode: "Smart Search"
2. **Opens plugin**: Dropdown shows "Smart Search" (from default)
3. **Overrides to "Task Chat"**: Dropdown changes to "Task Chat", saved to `currentChatMode` in data.json
4. **Sends queries**: Uses "Task Chat" mode
5. **Reloads plugin**: Dropdown shows "Task Chat" (restored from `currentChatMode` in data.json)
6. **Creates new session**: Dropdown resets to "Smart Search" (from default)
7. **Sends queries**: Uses "Smart Search" mode

---

### Example 2: Per-Session Override

1. **Default**: "Simple Search"
2. **Session 1**: User overrides to "Task Chat"
   - `currentChatMode` = "Task Chat" (saved in data.json)
   - Dropdown shows "Task Chat"
3. **Reloads plugin**: Still shows "Task Chat" (restored from data.json)
4. **Creates new session**:
   - `currentChatMode` = "Simple Search" (reset to default)
   - Dropdown resets to "Simple Search"
5. **Session 2**: User keeps "Simple Search"
   - No override needed

---

### Example 3: Matching Default

1. **Default**: "Task Chat"
2. **Opens plugin**: Dropdown shows "Task Chat"
   - `searchModeOverride` = null (no override needed)
3. **Changes to "Simple Search"**: 
   - `searchModeOverride` = "Simple Search"
   - `currentChatMode` = "Simple Search" (saved in data.json)
4. **Changes back to "Task Chat"**:
   - `searchModeOverride` = null (matches default)
   - `currentChatMode` = "Task Chat" (saved in data.json)

---

## State Transitions

### Settings State

```
┌─────────────────────────────────────────┐
│ defaultChatMode: "simple"               │ ← User's default preference
│ currentChatMode: "chat"                 │ ← Last used in current session (in data.json)
└─────────────────────────────────────────┘
```

### View State

```
┌─────────────────────────────────────────┐
│ searchModeOverride: "chat" | null       │ ← null = use default
└─────────────────────────────────────────┘
```

### Effective Mode Calculation

```typescript
effectiveMode = searchModeOverride || defaultChatMode
```

---

## Flow Diagrams

### View Open Flow

```
Plugin starts/View opens
    ↓
Load currentChatMode from data.json
    ↓
currentChatMode == defaultChatMode?
    ├─ Yes → searchModeOverride = null
    └─ No → searchModeOverride = currentChatMode
    ↓
Update dropdown (shows effective mode)
```

### Mode Change Flow

```
User selects mode in dropdown
    ↓
value == defaultChatMode?
    ├─ Yes → searchModeOverride = null
    └─ No → searchModeOverride = value
    ↓
Save currentChatMode = value (to data.json)
    ↓
Persist settings
```

### New Session Flow

```
User clicks "New Session"
    ↓
Create session
    ↓
Reset: searchModeOverride = null
Reset: currentChatMode = defaultChatMode (in data.json)
    ↓
Save settings
    ↓
Update dropdown (shows default)
```

---

## Benefits

### 1. **Predictable Behavior** ✓
- New sessions always start with default mode
- Current session mode persists across reloads
- Clear separation between default and current

### 2. **User Control** ✓
- Default can be set once in settings
- Per-session override is easy and intuitive
- Mode choice persists across reloads

### 3. **Maintains State** ✓
- Reload plugin → keeps current session's mode
- New session → resets to default
- No confusion about which mode is active

### 4. **Efficient Use of Settings** ✓
- Repurposed `searchMode` (was deprecated)
- No new settings fields needed
- Clean migration path

---

## Technical Notes

### Why Two Settings?

**Option A** (rejected): Store per-session modes
- Complex: Need to store mode for each session
- Overkill: Most users use same mode within a session

**Option B** (chosen): Store global "last used" mode
- Simple: One value for current session
- Intuitive: Persists in data.json across reloads
- Resets on new session

### Why `currentChatMode` is Internal

`currentChatMode` is not shown in the settings UI because:
1. **Automatic**: Managed by the chat interface
2. **Persists in data.json**: Survives plugin reloads
3. **Not a preference**: Just tracks current session state
4. **User-facing is `defaultChatMode`**: That's the preference

### Migration Compatibility

Existing users have `searchMode` already set:
1. First load: `searchMode` migrated to both `defaultChatMode` and `currentChatMode`
2. Then: `currentChatMode` stores current session state in data.json
3. Works seamlessly with no data loss

---

## Testing Checklist

- [ ] **New session uses default mode**
  - Set default to "Smart Search" in settings
  - Create new session
  - Verify dropdown shows "Smart Search"

- [ ] **Override persists across reload**
  - Override to "Task Chat"
  - Reload plugin (Ctrl+R)
  - Verify dropdown still shows "Task Chat"

- [ ] **New session resets to default**
  - Override to "Task Chat"
  - Create new session
  - Verify dropdown resets to default mode

- [ ] **Changing default updates new sessions**
  - Change default to "Task Chat" in settings
  - Create new session
  - Verify dropdown shows "Task Chat"

- [ ] **Override cleared when selecting default**
  - Default is "Simple Search"
  - Override to "Task Chat"
  - Change back to "Simple Search"
  - Verify `searchModeOverride` is null

- [ ] **Session switch doesn't affect mode**
  - Override to "Task Chat"
  - Switch to different session
  - Switch back
  - Verify mode is still "Task Chat"

---

## Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `src/settings.ts` | Updated `searchMode` comment | Clarify internal use |
| `src/views/chatView.ts` | Added initialization logic | Restore mode on open |
| `src/views/chatView.ts` | Updated change handler | Persist mode changes |
| `src/views/chatView.ts` | Updated `createNewSession` | Reset to default |

---

## Summary

**Problem**: New sessions inherited previous session's mode instead of using default

**Solution**: Added `currentChatMode` to track "last used mode in current session" (stored in data.json)

**Behavior**:
- `defaultChatMode` = user's default preference (set in settings)
- `currentChatMode` = last used mode (stored in data.json, persists across reloads)
- New session = reset to default
- Reload = restore last used from data.json

**Result**: Intuitive, predictable behavior that respects both user preferences and current session state.
