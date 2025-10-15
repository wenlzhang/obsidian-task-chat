# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

