# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

