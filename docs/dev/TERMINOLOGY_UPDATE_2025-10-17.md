# Terminology Update: "Search Mode" → "Default Chat Mode" (2025-10-17)

## Summary

Updated terminology throughout the codebase from "search mode" to "chat mode" and clarified that the setting represents the "default chat mode" (with per-query override capability).

---

## Rationale

### Why "Chat Mode" instead of "Search Mode"?
- **More accurate**: The mode controls the entire chat behavior, not just search
- **User-centric**: Users are "chatting" with their tasks, not just "searching"
- **Consistent**: Aligns with "Task Chat" product name

### Why "Default Chat Mode"?
- **Clearer**: Makes it explicit that this is the default setting
- **Accurate**: Users can override it per-query in the chat interface
- **Better UX**: Sets expectations that the setting controls new sessions

---

## Changes Made

### 1. Settings Interface (`settings.ts`)

**Added**:
```typescript
defaultChatMode: "simple" | "smart" | "chat"; // Default mode for new sessions
```

**Deprecated** (kept for migration):
```typescript
searchMode: "simple" | "smart" | "chat"; // DEPRECATED: renamed to defaultChatMode
```

**Migration** (`main.ts`):
```typescript
// Migrate searchMode to defaultChatMode (renamed for clarity)
if (!this.settings.defaultChatMode && this.settings.searchMode) {
    console.log("Migrating searchMode to defaultChatMode");
    this.settings.defaultChatMode = this.settings.searchMode;
    await this.saveSettings();
}
```

---

### 2. Settings Tab UI (`settingsTab.ts`)

**Before**:
```
Setting: "Search mode"
Description: "Choose how Task Chat processes your queries..."
```

**After**:
```
Setting: "Default chat mode"
Description: "Sets the default mode for new chat sessions. You can always 
override this per-query using the dropdown in the chat interface..."
```

**Info Box Title**:
- Before: "ℹ️ Search mode comparison"
- After: "ℹ️ Chat mode comparison"

**Code Changes**:
- `this.plugin.settings.searchMode` → `this.plugin.settings.defaultChatMode`
- `searchMode` variable → `defaultChatMode` variable

---

### 3. Chat View Interface (`chatView.ts`)

**UI Labels**:
- Group label: "Search mode" → "Chat mode"
- Icon: 🔍 → 💬
- Console logs: "Search mode changed" → "Chat mode changed"

**Code Changes**:
- `searchMode` variable → `chatMode` variable  
- `usedSearchMode` → `usedChatMode`
- `settings.searchMode` → `settings.defaultChatMode`
- `effectiveSettings.searchMode` → `effectiveSettings.defaultChatMode`

**Comments**:
- "Apply search mode override" → "Apply chat mode override"
- "Get the search mode that was used" → "Get the chat mode that was used"

---

### 4. AI Service (`aiService.ts`)

**Code Changes**:
- `const searchMode = settings.searchMode` → `const chatMode = settings.defaultChatMode`
- All `searchMode` variable references → `chatMode`

**Comments**:
- "Parse query based on search mode" → "Parse query based on chat mode"

---

### 5. README Documentation

**Section Titles**:
- "Three Search Modes" → "Three Chat Modes"
- "Understanding search modes" → "Understanding chat modes"

**Control Labels**:
- "Group 2: Search Mode" → "Group 2: Chat Mode"
- "Search mode dropdown" → "Chat mode dropdown"
- "Choose search mode" → "Choose chat mode"

**Settings References**:
- "Settings → Task Chat → Search mode" → "Settings → Task Chat → Default chat mode"

**Added Clarifications**:
- "Set your default in settings, override per-query in chat"
- "The default chat mode (configured in settings) is used for all new sessions"
- "You can override it per-query using the dropdown in the chat interface"
- "Selection overrides your default for the current query only"

---

## Behavior Documentation

### Default Chat Mode Setting

**Location**: Settings → Task Chat → Default chat mode

**Purpose**: Sets the default mode for all new chat sessions

**Options**:
1. **Simple Search** - Free keyword search (no AI)
2. **Smart Search** - AI keyword expansion (~$0.0001)
3. **Task Chat** - Full AI assistant (~$0.0021)

**Default**: Simple Search (free)

---

### Per-Query Override

**Location**: Chat interface dropdown (top controls)

**Purpose**: Temporarily override the default mode for the current query

**Behavior**:
- Changes mode for current query only
- Does NOT change your default setting
- Next query returns to default mode

**Icon**: 💬 (chat bubble)

---

## Migration Path

### For Users

**Automatic Migration**:
1. Old `searchMode` setting → copied to `defaultChatMode`
2. No user action required
3. No data loss
4. Existing sessions continue to work

**UI Changes**:
- Settings label updated to "Default chat mode"
- Chat interface label updated to "Chat mode"
- Descriptions now clarify default vs override behavior

---

### For Developers

**Code Pattern - Before**:
```typescript
const mode = settings.searchMode;
if (mode === "simple") { ... }
```

**Code Pattern - After**:
```typescript
const mode = settings.defaultChatMode;
if (mode === "simple") { ... }
```

**Variable Naming**:
- ✅ `defaultChatMode` - for the settings field
- ✅ `chatMode` - for local variables
- ✅ `usedChatMode` - for tracking which mode was used
- ❌ `searchMode` - deprecated

---

## Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `src/settings.ts` | Added `defaultChatMode`, deprecated `searchMode` | Interface definition |
| `src/main.ts` | Added migration logic | Automatic upgrade |
| `src/settingsTab.ts` | Updated labels and variable names | Settings UI |
| `src/views/chatView.ts` | Updated labels, icon, variable names | Chat interface |
| `src/services/aiService.ts` | Updated variable names | Core logic |
| `README.md` | Updated all terminology | User documentation |

---

## Benefits

### 1. **Clearer Communication** ✓
- "Chat mode" is more intuitive than "search mode"
- "Default" clarifies that it can be overridden
- Aligns with product name "Task Chat"

### 2. **Better UX** ✓
- Users understand they're setting a default
- Expectation that per-query override is possible
- Clear relationship between settings and UI

### 3. **Accurate Terminology** ✓
- Mode controls entire chat behavior, not just search
- Reflects the conversational nature of the plugin
- Consistent naming throughout codebase

### 4. **Maintained Compatibility** ✓
- Automatic migration for existing users
- No breaking changes
- Old settings still work during migration

---

## Testing Checklist

- [ ] Settings tab shows "Default chat mode" label
- [ ] Chat interface shows "Chat mode" dropdown with 💬 icon
- [ ] Dropdown shows all three modes
- [ ] Default mode is applied to new sessions
- [ ] Per-query override works correctly
- [ ] Override doesn't change default setting
- [ ] Migration from `searchMode` to `defaultChatMode` works
- [ ] Console logs show "chat mode" terminology
- [ ] Token usage displays correct mode names
- [ ] README documentation is updated
- [ ] Settings descriptions are accurate

---

## Documentation Updates

### Settings Tab
- Setting name: "Default chat mode"
- Description explains default behavior and per-query override
- Info box title: "Chat mode comparison"

### Chat Interface
- Dropdown label visual: 💬 icon
- Dropdown purpose: Override default per-query
- Console logs: "Chat mode changed to: X"

### README
- All "search mode" → "chat mode"
- Added clarification about default vs override
- Updated configuration instructions
- Updated troubleshooting section

---

## Summary

**What Changed**:
- "Search mode" → "Chat mode" (more accurate)
- "searchMode" → "defaultChatMode" (clarifies it's the default)
- Added documentation explaining default + override behavior

**Why**:
- Clearer communication
- Better UX
- More accurate terminology

**Impact**:
- No breaking changes
- Automatic migration
- Better user understanding

**Result**:
- Users understand they're setting a default
- Users know they can override per-query
- Terminology is consistent and intuitive
