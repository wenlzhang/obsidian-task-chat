# Task Indexing with Datacore

**Learn how Task Chat indexes and queries tasks using the Datacore API.**

## Overview

Task Chat uses the **Datacore** plugin as its primary and only supported task indexing API. Datacore provides high-performance task indexing that is 2-10x faster than alternatives, with advanced query capabilities and efficient caching.

**Why Datacore?**
- ⚡ **2-10x faster** than Dataview
- 🔍 **Advanced filtering** at API level
- 💾 **Efficient caching** for repeated queries
- 🎯 **Native indexing** optimized for performance
- 📊 **API-level filtering** reduces memory usage

## Quick Start

### 1. Install Datacore

**Required:** Datacore must be installed for Task Chat to function.

1. Open Obsidian Settings → Community Plugins
2. Browse and search for "Datacore"
3. Install [Datacore](https://github.com/blacksmithgu/datacore)
4. Enable the Datacore plugin
5. **Restart Obsidian** (important for first-time setup)

### 2. Verify Installation

Task Chat automatically detects and uses Datacore:

1. Open Task Chat view (click chat icon in left sidebar)
2. Check the status indicator at top of chat:
   - ✓ **"Using Datacore (ready)"** - Working correctly
   - ⚠️ **"Datacore is indexing..."** - Wait a few seconds
   - ❌ **"Datacore not available"** - Install and enable Datacore

## Configuration

### Automatic Detection

Task Chat automatically detects and uses Datacore when it's installed and enabled. **No manual configuration needed!**

**Startup process:**
1. Task Chat loads and waits for Datacore to initialize
2. Datacore indexes your vault (first time only)
3. Task Chat detects Datacore is ready
4. Chat interface becomes available

### Field Name Configuration

Configure task property field names in Settings → Datacore Integration:

- **Due date field**: Default `due`
- **Created date field**: Default `created`
- **Completed date field**: Default `completion`
- **Priority field**: Default `p`

**These fields map to your Datacore inline field syntax:**
```markdown
- [ ] Task text [due::2025-11-10] [p::1]
```

## Performance Benefits

### When Performance Matters

Fast task indexing improves:

**Chat response time:**
- Faster task retrieval
- AI gets context quicker
- More responsive interface

**Filter changes:**
- Instant updates
- No lag when adjusting filters
- Smooth user experience

**View switching:**
- Faster loading
- Quick task count updates
- Seamless transitions

**Large vaults:**
- Handles 5000+ tasks easily
- No performance degradation
- Consistent response times

## Troubleshooting

### Datacore Not Available

**Symptom:** Warning message says "Task indexing API not available" or "Datacore not available"

**Solutions:**

1. **Install Datacore:**
   - Open **Settings → Community plugins → Browse**
   - Search for "Datacore"
   - Install and enable
   - **Restart Obsidian** (required!)

2. **Verify installation:**
   - Go to **Settings → Community plugins**
   - Ensure Datacore appears in the list
   - Ensure the toggle is enabled (blue)

3. **Check for conflicts:**
   - Disable other task plugins temporarily
   - Test if Datacore works alone
   - Re-enable plugins one by one

### No Tasks Found

**Symptom:** "Datacore is active, but no tasks were found in your vault"

**Solutions:**

1. **Wait for indexing:**
   - First-time indexing takes a few seconds
   - Status shows ⚠️ "Datacore is indexing..."
   - Warning auto-disappears when complete

2. **Check task syntax:**
   - Tasks must use checkbox syntax: `- [ ] Task`
   - Ensure proper spacing after checkbox
   - Examples:
     ```markdown
     - [ ] My task (✓ correct)
     - []Task (✗ wrong - no space)
     - [ ]Task (✗ wrong - no space after bracket)
     ```

3. **Verify you have tasks:**
   - Create a test task in any note
   - Click refresh button in Task Chat
   - Check if task appears

4. **Check exclusions:**
   - Go to **Settings → Task Filtering → Manage exclusions**
   - Ensure you haven't excluded all folders/notes
   - Remove unnecessary exclusions

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

## Related Documentation

- [Filtering Guide](FILTERING.md) - Learn about task filtering and exclusions
- [Settings Guide](SETTINGS_GUIDE.md) - Complete plugin settings reference
- [README](../README.md) - Plugin overview and features

## Feedback

Found an issue or have a suggestion? [Open an issue on GitHub](https://github.com/wenlzhang/obsidian-task-chat/issues).
