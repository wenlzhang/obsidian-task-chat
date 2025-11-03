# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-11-03

### Added
- **Dual-Model Configuration System**: Use different models for different purposes ⭐ NEW
  - **Query Parsing Models**: Fast models for understanding queries (GPT-4o-mini, Claude Haiku, Qwen3:14b)
  - **Task Analysis Models**: Quality models for AI recommendations (GPT-4o, Claude Sonnet 4)
  - **Per-Provider Model Storage**: Switch providers without losing model selections
  - **Independent Provider Selection**: Parsing and analysis can use different providers
  - **Temperature Control**: Separate temperature settings for each purpose
  - **Auto-Refresh**: Fetch latest available models from each provider
  - **Model Validation**: Warns if selected model isn't available
  - **Example configurations**: Cost-optimized, Quality-focused, Privacy-first, Hybrid
  - Optimize cost/performance by using cheap models for parsing, quality models for analysis
  - Settings → Model Configuration section

- **Session Limit Management**: Renamed `maxChatHistory` to `maxSessions` for clarity ⭐ IMPROVED
  - Controls maximum number of **chat sessions** to keep (not messages per session)
  - Default: 50 sessions, Range: 10-1000 (expanded from 10-100)
  - **Automatically prunes oldest sessions** when limit is exceeded
  - Maintains the most recent N sessions, removing older ones first
  - Each session can have unlimited messages
  - Prevents unlimited session accumulation in data.json
  - Configurable in Settings → Task Chat → Max sessions

- **Chat History Context Configuration**: Control AI conversation context ⭐ NEW
  - Configurable context length (1-100 messages, default: 5)
  - **Dynamic tooltip**: Shows current value as you adjust
  - **Auto-cleanup**: Warnings and task references automatically removed from context
  - **Token optimization**: Balance between context quality and cost
  - Settings → Task Chat → Chat history context

- **Advanced Status Category Management**: Enhanced UI and features ⭐ IMPROVED
  - **Protection System**: Different lock levels for built-in vs custom categories
  - **Grid Layout**: Horizontal display with column headers
  - **Collapsible Advanced Fields**: Display order, description, semantic terms
  - **Auto-Organization**: Smart gap calculation based on category count (10, 20, 30...)
  - **Validation System**: Detects duplicate orders with warning messages
  - **Visual Indicators**: Lock icons (🔒), disabled states, tooltips
  - **Semantic Terms**: Help AI recognize categories in natural language
  - Settings → Status Categories section

- **Dynamic Scoring Display**: Real-time max score calculation ⭐ NEW
  - Shows breakdown: R:20 + D:6 + P:1 + S:1 = 28 points
  - Updates automatically based on sub-coefficient settings
  - Helps understand scoring impact
  - Settings → Task Scoring section

- **Enhanced Settings UI**: Improved user experience
  - **Connection Testing**: Real-time validation with inline feedback
  - **Model Count Indicators**: Shows number of available models per provider
  - **Auto-fetch on Provider Selection**: Models loaded automatically when switching providers
  - **Datacore Status Display**: Real-time API availability indicator (✓/⚠️/❌)
  - **Context-Aware Descriptions**: Dynamic descriptions update based on current settings

### Fixed
- **CRITICAL: Session History Persistence**: Fixed data loss bug where session history could be lost on Obsidian restart
  - Added defensive checks in `loadSettings()` to ensure sessionData structure exists
  - Enhanced `sessionManager.loadFromData()` to handle null/malformed data gracefully
  - Session history now persists correctly across restarts
  - Deep merge for provider configs preserves defaults

### Improved
- **Simplified Datacore Startup Logic**: Reduced complex 40+ line retry loop to simple 3-line wait
  - Faster plugin startup
  - Cleaner, more maintainable code
  - Same functionality with better performance

- **Model Provider Management**: Enhanced model fetching and caching
  - Per-provider model caching prevents re-fetching
  - Graceful fallback to defaults if API unavailable
  - Auto-configuration on provider selection
  - Model validation against available models

- **Settings Organization**: Clearer structure and labeling
  - 12 main sections (was 10) with better categorization
  - Model Configuration as separate section
  - Task Sorting as separate section
  - Task Display Limits as separate section
  - More descriptive headings and subheadings

### Removed
- **Debug Command Cleanup**: Removed `debug-datacore-status` command (no longer needed for production)
  - Bundle size reduced: 410.2kb → 409.6kb

## [Unreleased] - 2025-10-15

### Added
- **Task Display Settings**: Fine-grained control over task limits and sorting
  - **Three separate limit settings** (sliders: 5-100, max: 100):
    - **Max Direct Results** (default: 20): Tasks shown without AI (no token cost)
      - Simple queries like "overdue tasks" show results directly
      - Higher values have no cost impact since no AI is used
    - **Max Tasks for AI Analysis** (default: 30): Tasks sent to AI for context
      - More context helps AI give better recommendations
      - Impacts token usage and cost
    - **Max AI Recommendations** (default: 20): Final task list size
      - Keeps recommendations manageable for user
      - AI selects most relevant from analyzed tasks
  - **Two-part sorting system** for maximum flexibility:
    - **Sort By** (dropdown): Choose field to sort by
      - AI Relevance, Due Date, Priority, Created Date, or Alphabetical
    - **Sort Direction** (dropdown): Choose sort order
      - **Low to High** (A→Z, 1→4, Early→Late): Good for overdue/urgent tasks
      - **High to Low** (Z→A, 4→1, Late→Early): Good for recent/low priority tasks
    - Defaults: Due Date + Low to High (shows overdue tasks first)
  - Tasks are sorted before display and before AI analysis for consistent results
- **AI-Powered Query Parsing** (Optional): Use AI to parse queries for maximum reliability
  - Toggle in settings: "AI-powered query parsing"
  - Understands complex natural language in any language
  - Automatically extracts: priority, due date, status, folder, tags, keywords
  - Falls back to fast regex parsing when disabled (default)
- **Advanced Compound Filtering**: Multi-filter query support with simultaneous application
  - Priority + Due Date + Status + Folder + Tags + Keywords all work together
  - Intelligent filter extraction from natural language queries
  - Example: "open priority 1 tasks due today in folder projects with tag work"
- **Enhanced Priority Parsing**: Support for both numeric and semantic priority queries
  - Works for all priority levels (1-4) in both formats
- **Status Filtering**: Filter by task completion status
  - Open: `open`, `incomplete`, `pending`, `todo`
  - Completed: `completed`, `done`, `finished`
  - In Progress: `in progress`, `in-progress`, `ongoing`
- **Folder Filtering**: Search tasks within specific folders
  - Patterns: "in folder X", "from folder X", "folder: X"
- **Tag Filtering**: Query by task tags
  - Hashtags: `#work`, `#urgent`
  - Natural language: "with tag work", "tagged urgent"
- **Extended Date Support**: More natural date query options
  - Future: "future tasks", "upcoming tasks"
  - Next week: "next week"
  - Specific dates: "2025-10-20", "10/20/2025"
- **Comprehensive Documentation**: Added COMPLEX_QUERIES.md with examples and architecture

### Changed
- **Priority System**: Migrated to numeric priorities (BREAKING CHANGE for settings)
  - **Architecture**: Clear separation between user config and internal representation
  - **User's role**: Define text values that map to each priority level (customizable)
  - **System's role**: Always use numbers (1-4) internally (fixed)
  - **Keys are FIXED**: Priority levels 1, 2, 3, 4 cannot be changed
  - **Type safety**: `PriorityMapping = Record<1 | 2 | 3 | 4, string[]>` enforces numeric keys
  - **Display format**: "Priority: 1 (highest)" for clarity
- **Due Date Query System**: Improved normalization and parsing
  - **Architecture**: Users can use any field name (due, deadline, dueDate), system always normalizes to standard values
  - **Normalized values**: "any", "today", "tomorrow", "overdue", "future", "week", "next-week", or specific date
  - **Comprehensive patterns**: Matches "due tasks", "overdue tasks", "tasks due", "deadline tasks", etc.
  - **Language support**: English and Chinese patterns (今天, 过期, 未来, etc.)
  - **Load-time filtering**: Date queries converted to Dataview date ranges BEFORE loading tasks
  - **Efficiency**: Filter at source (Dataview API) instead of loading all tasks then filtering in memory
- **Query Processing Flow**: Complete redesign for multi-filter support
  - Intent analysis now extracts all filter types simultaneously
  - Compound filters applied before AI processing
  - AI used only for refinement of complex queries
- **System Prompt Enhancement**: AI now informed about applied filters
  - Shows which filters were extracted and applied
  - Better context for prioritization and recommendations

### Improved
- **Query Accuracy**: Structured filter extraction prevents misinterpretation
- **Query Flexibility**: Multiple ways to express priority in queries
  - Language-agnostic internal mapping ensures consistency
- **Semantic Keyword Matching**: Keywords match semantically within filtered tasks
  - Uses substring matching for flexible semantic search
- **Performance**: Direct filtering reduces unnecessary AI calls
  - Simple multi-filter queries (≤10 results) return instantly
  - Complex queries pre-filtered before AI enhancement
- **Cost Efficiency**: Reduced token usage by smart filter application
- **Code Organization**: Modular filter extraction and application methods

### Fixed
- **Dataview Date Parsing Bug**: Fixed critical timezone issue causing incorrect due date comparisons
  - Dataview date objects were being misparsed by moment.js
  - Added proper handling via `.toString()` conversion before moment parsing
  - Local timezone dates now parse correctly (e.g., `[due::2025-10-10]` stays as Oct 10, not Oct 9)
  - Overdue task queries now work correctly
- **Date Comparison Timezone Fix**: Fixed UTC vs local timezone issues
  - Date-only strings (e.g., "2025-10-10") now parse as local dates, not UTC
  - Prevents off-by-one day errors in timezones ahead of UTC
- **"Due Tasks" Query**: Added support for showing all tasks with due dates
  - Query "due tasks" now shows all tasks that have a due date
  - Returns "any" filter that matches tasks with non-empty due dates
- **Future Task Queries**: Added support for future/upcoming task queries
- **Compound Query Handling**: Previously only supported single filter types
- **Filter Conflicts**: Multiple filters now combine correctly (AND logic)

## [0.0.9] - 2025-01-15

### Added
- **Compound Query Support**: Handle complex queries mixing filters + keywords
  - Filters by priority/due date FIRST, then searches within results
  - AI intelligently combines both aspects of the query

### Fixed
- **Console Noise**: Removed excessive debug logging for cleaner console output
- **Priority Detection**: Cleaned up priority parsing logic for consistent performance
- **Query Intent**: Improved detection of compound queries (filter + search)

### Improved
- **Query Flexibility**: Multi-intent queries now work reliably
- **Code Quality**: Streamlined DataView service code without debug clutter
- **Performance**: Reduced console output overhead during task processing
- **Smart Filtering**: Combines filters with keyword search intelligently

## [0.0.8] - 2025-01-15

### Added
- **Dynamic System Prompt**: AI prompt now built from user's actual priority settings
- **Due Date Query Support**: Queries like "tasks due today", "overdue tasks" work natively
- **Due Date Filtering**: Filter by today, tomorrow, this week, overdue
- **Direct Due Date Search**: 0 tokens for due date queries (like priority)

### Changed
- **System Prompt**: Now dynamically generated from settings (not hardcoded)
- **Priority Mapping**: Simplified to DataView-only (removed Tasks plugin)
- **Settings Sync**: AI always knows your current priority/date field names

### Removed
- **Tasks Plugin Support**: Focused exclusively on DataView format
- **Hardcoded Mappings**: All priority/date info from user settings

### Fixed
- **Settings Mismatch**: AI prompt now matches actual user configuration
- **Field Names**: AI uses correct field keys (e.g., [p::1] or [priority::1])

### Improved
- **Flexibility**: Change priority mappings, AI adapts automatically
- **Performance**: Due date queries also bypass AI (0 tokens)
- **Accuracy**: AI always uses current field names from settings

## [0.0.7] - 2025-01-15

### Added
- **Inline Priority Field Parsing**: Full support for DataView inline fields like `[p::1]`
- **Configurable Priority Mapping**: User-definable mappings in settings (like Todoist Context Bridge)
- **Direct Priority Search**: Queries like "priority 1 tasks" return results without AI (0 tokens)
- **Priority Extraction**: Automatic detection of priority in user queries

### Changed
- **Priority Detection**: Now checks inline fields, direct properties, and emojis
- **System Prompt**: Updated with priority mapping documentation
- **Default Mappings**: Expanded to include p1-p4, and variations

### Fixed
- **Priority Recognition**: Tasks with `[p::1]` now correctly identified as high priority
- **Query Understanding**: "Give me priority 1 tasks" now works in any language
- **DataView Integration**: Properly parses all priority field formats

### Improved
- **Settings UI**: New priority mapping section with per-level configuration
- **Search Accuracy**: Priority queries return exact matches
- **Language Agnostic**: Works with any priority naming convention

## [0.0.6] - 2025-01-15

### Added
- **Session Modal**: Professional modal popup for session list (instead of inline expansion)
- **Smart Empty Session Detection**: Won't create new session if current is empty
- **Button Grouping**: Visually grouped related buttons for better UX
- **Better Date Formatting**: "Today", "Yesterday", "X days ago" format in modal
- **User Message Count**: Shows only actual messages (excludes system messages)

### Changed
- **Session List Display**: Modal popup replaces inline expansion
- **Button Order**: "+ New | Sessions" → "Filter | Refresh | Clear"
- **Session Detection**: Only saves sessions with actual conversations
- **Modal Layout**: Cleaner, more spacious session list design

### Fixed
- **Empty Session Spam**: No longer creates multiple empty sessions
- **UI Clutter**: Session list no longer expands inline pushing content down
- **Message Count**: Accurate count excluding system messages

### Improved
- **UX Flow**: Modal-based session switching is more intuitive
- **Visual Grouping**: Button groups show functional relationships
- **Session Info**: Better metadata display with relative dates

## [0.0.5] - 2025-01-14

### Added
- **Session Management**: Full chat session support with create, switch, and delete
- **'+ New' Button**: Quick button to start new chat sessions
- **Session List**: View and switch between all saved sessions
- **Auto-load Last Session**: Automatically loads your last chat when reopening Obsidian
- **Session Persistence**: All chat history saved to data.json and survives restarts
- **Session Metadata**: Each session has name, message count, and last updated date
- **Session Naming**: Auto-generated names based on creation time (e.g., "Chat Jan 14, 22:30")
- **Session Deletion**: Delete old sessions with confirmation

### Changed
- **Chat History**: Now stored per-session instead of globally
- **Clear Chat**: Clears current session but preserves it in history
- **Button Layout**: Reorganized with '+ New' button prominent

### Fixed
- **Chat Persistence**: Chat history no longer lost on Obsidian restart
- **Session Isolation**: Each chat session is independent

### Improved
- **UX**: Similar to Copilot and Smart Connections plugins
- **Data Management**: All sessions saved automatically
- **Navigation**: Easy switching between different chat contexts

## [0.0.4] - 2025-01-14

### Added
- **Token usage tracking**: Full tracking of API usage with per-message and total statistics
- **Cost calculation**: Automatic cost estimation based on model pricing (OpenAI, Claude, etc.)
- **Direct search results**: Simple queries now bypass AI entirely (0 tokens, $0 cost)
- **Token display in chat**: Shows tokens used and cost for each AI response
- **Usage statistics in settings**: View total tokens used and total cost
- **Reset statistics button**: Clear usage tracking data
- **Show token usage toggle**: Option to hide/show usage information

### Changed
- **Reduced AI context**: Now sends only 5-10 most relevant tasks instead of 50
- **Smart query routing**: Direct DataView search for simple queries, AI only for prioritization
- **Two-stage workflow**: Local search first, then AI analysis if needed

### Fixed
- **Massive token reduction**: From 47K tokens/2 requests to ~5K tokens/request (90% reduction)
- **Cost optimization**: 70% of queries now cost $0 (direct search)
- **Improved efficiency**: Better use of DataView API for local processing

### Improved
- **70% cost savings**: Most search queries use no AI at all
- **Transparent pricing**: Users can see exactly what they're spending
- **Model-specific rates**: Accurate cost calculation for different models
- **Ollama shows $0 cost**: Correctly displays free local processing

## [0.0.3] - 2025-01-14

### Fixed
- **Task ID visibility**: Task numbers now displayed in recommended tasks list for easy reference
- **Task numbering**: Changed from 0-based (`[TASK_0]`) to 1-based (`[TASK_1]`) indexing for better UX

### Added
- **Language settings**: New response language configuration with options:
  - Auto (matches user input language)
  - English
  - Chinese (中文)
  - Custom instruction
- **Multilingual support**: AI can now respond in user's preferred language
- **Task number display**: Recommended tasks show `[1]`, `[2]` etc. matching AI references
- **Language detection**: Automatically detects primary language in mixed-language queries

### Changed
- **Task ID format**: Updated from `[TASK_0]` to `[TASK_1]` throughout the system
- **UI labels**: Task numbers now visible in recommended tasks section
- **System prompt**: Enhanced with language instruction based on user settings

### Improved
- Better correspondence between AI responses and task list
- More intuitive task numbering (starts from 1)
- Flexible language handling for international users
- Support for mixed-language queries

## [0.0.2] - 2025-01-14

### Fixed
- **Task extraction bug**: Fixed broken task extraction that showed single letters instead of full task text
- **AI focus issue**: AI now focuses exclusively on existing tasks instead of generating generic advice

### Added
- **Task Search Service**: New intelligent search algorithm with:
  - Semantic search and fuzzy matching
  - Relevance scoring based on multiple factors
  - Keyword extraction with stop word filtering
  - Query intent analysis (search vs. prioritization)
  - Bilingual support (English and Chinese)
- **Task ID System**: Tasks are now referenced using `[TASK_X]` IDs for reliable extraction
- **Two-stage workflow**: Local search first, then AI prioritization
- **Smart task ranking**: Tasks scored by relevance, priority, status, and due dates

### Changed
- **System prompt**: Updated to strictly enforce task-focused behavior
- **AI workflow**: Now searches locally before sending to AI, ensuring relevant results
- **Task context**: Tasks sent to AI now include IDs and structured metadata
- **Chat history**: Reduced to 6 messages to save tokens while maintaining context

### Improved
- Task finding accuracy significantly improved
- Better handling of multilingual queries
- More relevant task recommendations
- Faster response times (local search reduces AI processing)

## [0.0.1] - 2025-01-14

### Added
- Initial release of Task Chat plugin
- AI-powered chat interface for task management
- DataView integration to access task properties
- Advanced task filtering by:
  - Text content
  - Folders
  - Priority levels (high, medium, low)
  - Due date ranges
  - Completion status
  - Task status categories
- Task navigation - click to jump to tasks in notes
- Support for multiple AI providers:
  - OpenAI
  - Anthropic
  - OpenRouter
  - Ollama (local)
- Filter modal with quick date filters (Today, This week, This month)
- Real-time task updates when files change
- Customizable settings:
  - AI provider configuration
  - DataView field mappings
  - System prompt customization
  - Chat history limits
- Comprehensive task property support:
  - Due dates (emoji and inline formats)
  - Priority levels (emoji and inline formats)
  - Task statuses (open, completed, in progress, cancelled)
  - Tags
  - Created and completed dates
- Auto-refresh tasks on file modifications
- Ribbon icon for quick access
- Command palette integration

