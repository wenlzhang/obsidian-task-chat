# Task Indexing APIs

**Learn how Task Chat indexes and queries tasks using Datacore or Dataview.**

## Overview

Task Chat requires a task indexing API to discover and query tasks in your Obsidian vault. It supports two APIs:

| API | Performance | Availability | Recommendation |
|-----|-------------|--------------|----------------|
| **Datacore** | 2-10x faster | Requires plugin | Recommended (auto-detects) |
| **Dataview** | Standard | Requires plugin | Fallback if Datacore unavailable |

Both APIs provide the same filtering features and capabilities - the only difference is performance.

## Quick Start

1. **Install a task indexing plugin:**
   - **Recommended:** Install [Datacore](https://github.com/blacksmithgu/datacore) for best performance
   - **Alternative:** Install [Dataview](https://github.com/blacksmithgu/obsidian-dataview) (standard performance)

2. **Task Chat will automatically detect and use the available API**
   - Default setting is "Auto (prefer Datacore)" which uses the fastest available API
   - No additional configuration needed

3. **Verify it's working:**
   - Open Task Chat view
   - Check the status line at the top showing active API and task count

## Configuration

### Accessing Settings

1. Go to **Settings → Task Chat → Task indexing**
2. Find the **Task indexing API** dropdown

### Available Options

#### Auto (prefer Datacore)

```
Behavior:
- Checks if Datacore is installed and enabled
- Falls back to Dataview if Datacore is unavailable
- Automatically uses the fastest available option
```

**When to use:** Most users should use this setting. It provides the best performance automatically.

#### Datacore only

```
Behavior:
- Only uses Datacore
- Shows warning if Datacore is not available
```

**When to use:** If you want to ensure you're using Datacore or get explicit warnings if it's unavailable.

#### Dataview only

```
Behavior:
- Only uses Dataview
- Shows warning if Dataview is not available
```

**When to use:** If you prefer Dataview or need to troubleshoot issues specific to Datacore.

## Performance Comparison

### Datacore Performance Benefits

Datacore offers **2-10x faster** task querying compared to Dataview:

| Vault Size | Datacore | Dataview | Improvement |
|------------|----------|----------|-------------|
| Small (100-500 tasks) | ~50ms | ~100ms | 2x faster |
| Medium (500-2000 tasks) | ~100ms | ~500ms | 5x faster |
| Large (2000+ tasks) | ~200ms | ~1000ms+ | 5-10x faster |

**Why is Datacore faster?**
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

**Symptom:** Warning message says "Task indexing API not available" or "Datacore/Dataview is active, but no tasks were found in your vault"

**Solutions:**

1. **Install a task indexing plugin:**
   - Install [Datacore](https://github.com/blacksmithgu/datacore) (recommended) or
   - Install [Dataview](https://github.com/blacksmithgu/obsidian-dataview)
   - Restart Obsidian after installation

2. **Enable the plugin:**
   - Go to **Settings → Community plugins**
   - Ensure Datacore or Dataview is enabled
   - Click the refresh button in Task Chat

3. **Wait for indexing:**
   - First-time indexing can take a few seconds for large vaults
   - The warning will auto-disappear once indexing completes

4. **Check your task syntax:**
   - Tasks must use Obsidian checkbox syntax: `- [ ] Task`
   - Ensure proper spacing after the checkbox
   - Example: `- [ ] My task` (correct) vs `- []Task` (wrong)

### Switching Between APIs

**How to switch:**

1. Go to **Settings → Task Chat → Task indexing**
2. Select a different API from the dropdown
3. Click the **Refresh** button in Task Chat view
4. Tasks will reload using the new API

**Warning messages:**
- If you select an API that's not available, you'll see a warning notice
- Auto mode will show a notice if it falls back to Dataview

### API Not Detecting After Installation

**If you just installed Datacore or Dataview:**

1. **Restart Obsidian** - Required for new plugins to load
2. **Wait a few seconds** - Allow time for initial indexing
3. **Check plugin status** - Ensure the plugin is enabled in Settings → Community plugins
4. **Click Refresh** - Use the refresh button in Task Chat view

### Performance Issues

**If task loading is slow:**

1. **Check which API is active:**
   - Look at the status line in Task Chat view
   - If using Dataview and have Datacore installed, switch to Auto mode

2. **Consider switching to Datacore:**
   - Install Datacore if not already installed
   - Set API to "Auto (prefer Datacore)" or "Datacore only"
   - Click Refresh to reload tasks

3. **Check vault size:**
   - Very large vaults (5000+ tasks) may need a few seconds for initial loading
   - Subsequent loads should be much faster due to caching

## Advanced Topics

### How Task Chat Queries Tasks

Both APIs use similar query approaches:

**Datacore:**
```javascript
// Uses native Datacore @task queries
@task where [filters...]
```

**Dataview:**
```javascript
// Uses Dataview JavaScript API
dv.pages("source-filters").file.tasks
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

Both APIs cache task data for performance:

- **Datacore:** Native caching with automatic invalidation
- **Dataview:** Built-in caching with file watching

**When cache is invalidated:**
- When you modify a note with tasks
- When you create/delete notes
- When you change file metadata (frontmatter)

**Manual cache refresh:**
- Click the Refresh button in Task Chat view
- Restart Obsidian
- Disable and re-enable the indexing plugin

## Related Documentation

- [Filtering Guide](FILTERING.md) - Learn about task filtering and exclusions
- [Settings Guide](SETTINGS_GUIDE.md) - Complete plugin settings reference
- [README](../README.md) - Plugin overview and features

## Feedback

Found an issue or have a suggestion? [Open an issue on GitHub](https://github.com/wenlzhang/obsidian-task-chat/issues).
