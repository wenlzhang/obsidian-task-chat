# Session Management Guide (v0.0.5)

## Overview

Task Chat now supports full session management, allowing you to organize your conversations into separate sessions. Each session maintains its own chat history and survives Obsidian restarts.

## Features

### 1. **Multiple Chat Sessions**
- Create unlimited chat sessions
- Each session has independent chat history
- Sessions persist across Obsidian restarts
- Switch between sessions anytime

### 2. **Auto-Save & Auto-Load**
- All sessions automatically saved to `data.json`
- Last session automatically loads on startup
- No manual save needed

### 3. **Session Metadata**
- Auto-generated names (e.g., "Chat Jan 14, 22:30")
- Message count per session
- Last updated timestamp
- Creation date

## UI Components

### Buttons

**'+ New'** - Create a new chat session
- Highlighted with accent color
- Starts fresh conversation
- Previous session preserved

**'Refresh tasks'** - Reload tasks from vault
- Updates task list
- Useful after creating new tasks

**'Clear chat'** - Clear current session
- Empties messages in current session
- Session itself remains in list
- Can switch back later

**'Filter tasks'** - Open filter modal
- Apply filters to task list
- Filters apply to current session

**'Sessions'** - Toggle session list
- Shows all saved sessions
- Click to expand/collapse

### Session List

When you click "Sessions", you see:

```
┌────────────────────────────────────┐
│ Chat Jan 14, 22:30        ⚫ 5 msgs│ ← Active
│   Jan 14, 2025                    │
│                                [×] │
├────────────────────────────────────┤
│ Chat Jan 14, 20:15          12 msgs│
│   Jan 14, 2025                    │
│                                [×] │
├────────────────────────────────────┤
│ Chat Jan 13, 18:45           8 msgs│
│   Jan 13, 2025                    │
│                                [×] │
└────────────────────────────────────┘
```

**Active Session**: Highlighted with accent border
**Click Session**: Switch to that session
**Click [×]**: Delete session (with confirmation)

## Usage Examples

### Starting a New Chat

1. Click **'+ New'** button
2. System message: "New session created: Chat Jan 14, 22:30"
3. Start chatting about different topic

**Use Cases**:
- Different projects
- Different time periods
- Different task categories
- Separate work contexts

### Switching Sessions

1. Click **'Sessions'** button
2. Session list appears
3. Click on session name
4. Chat loads that session's history
5. List auto-closes

### Deleting Old Sessions

1. Click **'Sessions'** button
2. Find session to delete
3. Click **[×]** button
4. Confirm deletion
5. Session permanently removed

### Clearing Current Chat

1. Click **'Clear chat'** button
2. Messages cleared from current session
3. Session still exists in list
4. Can continue chatting in cleared session

## Data Storage

### Location

All session data stored in:
```
.obsidian/plugins/task-chat/data.json
```

### Structure

```json
{
  "sessionData": {
    "sessions": [
      {
        "id": "session_1705262400_abc123",
        "name": "Chat Jan 14, 22:30",
        "messages": [...],
        "createdAt": 1705262400000,
        "updatedAt": 1705265000000,
        "filter": {...}
      }
    ],
    "currentSessionId": "session_1705262400_abc123",
    "lastSessionId": "session_1705262400_abc123"
  }
}
```

### Fields

- **id**: Unique session identifier
- **name**: Display name (auto-generated or custom)
- **messages**: Array of chat messages
- **createdAt**: Unix timestamp of creation
- **updatedAt**: Unix timestamp of last change
- **filter**: Optional task filter for session
- **currentSessionId**: Active session
- **lastSessionId**: Most recently used session

## Persistence Behavior

### On Startup

1. Plugin loads settings from `data.json`
2. SessionManager initializes from saved data
3. Last session automatically loaded
4. Chat history appears immediately

### During Use

1. Every message automatically saved
2. Session switches automatically saved
3. New sessions automatically saved
4. Deletions automatically saved

### On Restart

1. All sessions preserved
2. Last active session loads
3. No data loss

## Comparison with Other Plugins

### Like Copilot

- Multiple chat sessions ✓
- Auto-save functionality ✓
- Session switching ✓
- Persistent history ✓

### Like Smart Connections

- Named sessions ✓
- Session metadata ✓
- Delete old conversations ✓
- Auto-load last chat ✓

### Unique Features

- Task-specific filtering per session
- Token usage tracking per session
- Task navigation from any session

## Best Practices

### Organization

**By Project**:
```
- "Website Redesign Tasks"
- "Q1 Planning"
- "Bug Fixes"
```

**By Time**:
```
- "Week of Jan 14"
- "Sprint 23"
- "Monthly Review"
```

**By Category**:
```
- "High Priority Items"
- "Long-term Goals"
- "Quick Wins"
```

### Maintenance

**Keep Active Sessions**:
- Delete completed project sessions
- Archive old sessions
- Rename sessions for clarity

**Session Limits**:
- No hard limit on session count
- Consider performance with 50+ sessions
- Delete unused sessions regularly

## Keyboard Shortcuts

Currently no keyboard shortcuts for session management. Consider requesting:
- Cmd/Ctrl+N: New session
- Cmd/Ctrl+Shift+S: Open session list
- Cmd/Ctrl+W: Close/clear current session

## Troubleshooting

### Sessions Not Persisting

**Problem**: Sessions disappear after restart

**Solutions**:
1. Check `data.json` permissions
2. Verify plugin folder exists
3. Check for file system errors
4. Try restarting Obsidian

### Can't See Old Messages

**Problem**: Chat history empty

**Solutions**:
1. Check if correct session is active
2. Look in session list for other sessions
3. Verify `data.json` has message data
4. Check console for errors

### Session List Not Updating

**Problem**: New sessions don't appear

**Solutions**:
1. Click away and reopen list
2. Restart plugin
3. Check browser console for errors

### Delete Confirmation Not Working

**Problem**: Can't delete sessions

**Solutions**:
1. Check browser allows confirms
2. Try clicking × button again
3. Manually delete from settings if needed

## API for Developers

### SessionManager Methods

```typescript
// Create new session
createSession(name?: string): ChatSession

// Get session
getSession(id: string): ChatSession | undefined

// Get current session
getCurrentSession(): ChatSession | null

// Switch session
switchSession(id: string): ChatSession | null

// Update session
updateSession(id: string, updates: Partial<ChatSession>): void

// Delete session
deleteSession(id: string): void

// Get all sessions
getAllSessions(): ChatSession[]

// Add message to current session
addMessage(message: ChatMessage): void

// Clear current session messages
clearCurrentSession(): void
```

### Events

No custom events yet. Consider subscribing to:
- Plugin save events
- View render events

## Future Enhancements

### Planned

1. **Session Renaming**: Click to rename sessions
2. **Session Search**: Search across all sessions
3. **Session Export**: Export session to markdown
4. **Session Import**: Import previous sessions
5. **Session Tags**: Tag sessions for organization
6. **Session Merging**: Combine multiple sessions

### Requested

- Keyboard shortcuts
- Session templates
- Bulk operations
- Session analytics
- Cross-vault sessions

## Migration from v0.0.4

### Automatic

- Plugin automatically creates first session
- No manual migration needed
- Old behavior preserved

### What Changes

- Chat history now in sessions
- Clear chat keeps session
- New buttons in UI

### What Stays Same

- Task filtering
- AI responses
- Token tracking
- All other features

## Summary

Session management brings professional chat organization to Task Chat:

✓ **Multiple Sessions**: Organize by project, time, or category
✓ **Auto-Persistence**: Never lose chat history again
✓ **Easy Switching**: One click to change contexts
✓ **Clean UI**: Copilot-style session management
✓ **Auto-Load**: Last session loads on startup
✓ **Safe Deletion**: Confirmation before removing
✓ **Metadata**: See message count and dates
✓ **Zero Config**: Works out of the box

Start using sessions today to organize your task conversations!
