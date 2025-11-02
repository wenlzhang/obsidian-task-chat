# Task Indexing API

**Learn how Task Chat indexes and queries tasks using Datacore.**

## Overview

Task Chat requires a task indexing API to discover and query tasks in your Obsidian vault. Task Chat uses the **Datacore** plugin for high-performance task indexing.

## Quick Start

1. **Install the Datacore plugin:**
   - Install [Datacore](https://github.com/blacksmithgu/datacore) from the Obsidian Community Plugins

2. **Task Chat will automatically detect and use Datacore**
   - No additional configuration needed

3. **Verify it's working:**
   - Open Task Chat view
   - Check the status line at the top showing active API and task count

## Configuration

Task Chat automatically detects and uses Datacore when it's installed and enabled. No manual configuration is required.

If Datacore is not available, Task Chat will show a warning message prompting you to install it.

## Performance Benefits

### Why Datacore?

Datacore provides high-performance task indexing:

| Vault Size | Typical Performance |
|------------|---------------------|
| Small (100-500 tasks) | ~50ms |
| Medium (500-2000 tasks) | ~100ms |
| Large (2000+ tasks) | ~200ms |

**Why Datacore is fast:**
- Native indexing optimized for performance
- Efficient query execution
- Better caching mechanisms
- Optimized for large vaults

### When Performance Matters

Fast task indexing improves:
- **Chat response time** - AI gets task context faster
- **Filter changes** - Instant updates when changing filters
- **View switching** - Faster loading when opening Task Chat
- **Startup time** - Quicker initial task loading

## Troubleshooting

### No Tasks Found Warning

**Symptom:** Warning message says "Task indexing API not available" or "Datacore is active, but no tasks were found in your vault"

**Solutions:**

1. **Install the Datacore plugin:**
   - Install [Datacore](https://github.com/blacksmithgu/datacore) from Community Plugins
   - Restart Obsidian after installation

2. **Enable the plugin:**
   - Go to **Settings → Community plugins**
   - Ensure Datacore is enabled
   - Click the refresh button in Task Chat

3. **Wait for indexing:**
   - First-time indexing can take a few seconds for large vaults
   - The warning will auto-disappear once indexing completes

4. **Check your task syntax:**
   - Tasks must use Obsidian checkbox syntax: `- [ ] Task`
   - Ensure proper spacing after the checkbox
   - Example: `- [ ] My task` (correct) vs `- []Task` (wrong)

### API Not Detecting After Installation

**If you just installed Datacore:**

1. **Restart Obsidian** - Required for new plugins to load
2. **Wait a few seconds** - Allow time for initial indexing
3. **Check plugin status** - Ensure the plugin is enabled in Settings → Community plugins
4. **Click Refresh** - Use the refresh button in Task Chat view

### Performance Issues

**If task loading is slow:**

1. **Check vault size:**
   - Very large vaults (5000+ tasks) may need a few seconds for initial loading
   - Subsequent loads should be much faster due to caching

2. **Verify Datacore is enabled:**
   - Look at the status line in Task Chat view
   - Ensure Datacore is active and running

## Advanced Topics

### How Task Chat Queries Tasks

Datacore uses native query syntax:

```javascript
// Uses native Datacore @task queries
@task where [filters...]
```

**Filtering stages:**
1. **Source filtering** (API level): Folders, note tags, notes
2. **Exclusions** (API level): Excluded folders, tags, notes
3. **Property filtering** (post-query): Due dates, priorities, statuses
4. **Task tag filtering** (post-query): Task-level tags

### Filter Performance

**Filters applied at API level (fastest):**
- Folder filters
- Note-level tag filters
- Specific note filters
- Exclusions

**Filters applied post-query (slower):**
- Task-level tag filters
- Priority filters
- Due date filters
- Status filters

**Performance tip:** Use folder and note-level tag filters when possible, as they're much faster than task-level filters.

### Caching Behavior

Datacore caches task data for optimal performance:

- **Native caching** with automatic invalidation
- **File watching** for real-time updates

**When cache is invalidated:**
- When you modify a note with tasks
- When you create/delete notes
- When you change file metadata (frontmatter)

**Manual cache refresh:**
- Click the Refresh button in Task Chat view
- Restart Obsidian
- Disable and re-enable Datacore

## Related Documentation

- [Filtering Guide](FILTERING.md) - Learn about task filtering and exclusions
- [Settings Guide](SETTINGS_GUIDE.md) - Complete plugin settings reference
- [README](../README.md) - Plugin overview and features

## Feedback

Found an issue or have a suggestion? [Open an issue on GitHub](https://github.com/wenlzhang/obsidian-task-chat/issues).
