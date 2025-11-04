# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.1.0] - 2025-11-04

### Changes

- refactor: improve code formatting and organization
- refactor: simplify type coercion and default parameters
- Update README.md
- Update README.md
- docs: update plugin description and development credits
- docs: streamline settings documentation and remove redundant content
- docs: update model configuration documentation
- docs: simplify readme and documentation
- feat: implement dual-model AI system and enhance session management
- feat: improve session management and fix history persistence
- feat: implement chat history pruning to limit session size
- fix: improve session data handling and startup reliability
- refactor: centralize property pattern handling for query parsing
- feat: improve status value handling in task queries
- feat: improve status and date filtering logic
- feat: enhance task status logging and polling intervals
- refactor: centralize status category to symbol conversion
- feat: add status category to symbol conversion in task queries
- feat: add date keyword filtering support for Datacore queries
- feat: support configurable field names in datacore queries
- feat: enhance task status filtering with exclusion support
- feat: add debug logging for task filtering system
- feat: optimize task filtering by moving filters into Datacore query
- feat: improve Datacore integration and error handling
- feat: optimize task filtering performance with Datacore
- refactor: optimize task date filtering and status matching
- refactor: remove Dataview dependency and simplify task indexing
- docs: migrate from Dataview to Datacore for task indexing
- refactor: consolidate task sorting logic into TaskSortService
- feat: add JavaScript-level task scoring and sorting
- feat: improve task result limiting and scoring consistency
- refactor: optimize task scoring and filtering architecture
- feat: optimize task processing with early limiting and score caching
- perf: optimize task filtering and scoring with vectorization
- feat: add task identifier generation for Datacore tasks
- feat: optimize task search pipeline with integrated result limiting
- refactor: streamline task scoring and sorting pipeline
- perf: optimize task scoring with caching and single-pass matching
- feat: improve task search consistency and documentation
- feat: improve task relevance scoring consistency
- refactor: optimize task search quality filtering architecture
- refactor: optimize task quality filtering and remove unused code
- feat: optimize task filtering with API-level quality and relevance checks
- refactor: optimize task filtering performance with API-level filters
- feat: optimize task search performance with API-level filtering
- fix: improve task counting reliability for large vaults
- feat: improve task indexing reliability for large vaults
- fix: improve task priority regex and warning banner updates
- perf: optimize startup and logging performance
- perf: optimize chat message handling and UI responsiveness
- feat: add abort functionality to AI query processing
- feat: improve chat input UX during message processing
- fix: expand priority filter types in property filters
- refactor: reorganize file structure and error handling
- refactor: consolidate task search scoring into comprehensive system
- refactor: reorganize codebase into domain-driven structure
- refactor: reorganize services into logical subdirectories
- chore: update development configuration and cleanup docs
- docs: remove debug and implementation docs
- refactor: consolidate field extraction and filtering logic
- feat: enhance task field detection with multiple aliases
- feat: add "any" as synonym for "all" in priority filtering
- refactor: standardize task filter constants and patterns
- feat: improve task status filtering and error handling
- style: improve code formatting and line wrapping
- feat: improve cost parsing and exclusions handling
- perf: optimize task refresh with caching and reduced invalidation
- perf: optimize task loading to reduce memory usage and startup time
- feat: improve task indexing and refresh reliability
- feat: enhance task refresh feedback and API switching
- refactor: simplify task counting logic by removing redundant recursion
- refactor: use moment.js for timestamp calculations
- feat: optimize task indexing with lightweight count API
- feat: add note and folder filtering via context menu
- refactor: streamline settings UI text and layout
- refactor: remove debug logging and clean up task indexing code
- feat: improve task indexing and warning system reliability
- feat: reorganize and improve Dataview integration settings
- feat: enhance filter documentation and UI clarity
- feat: improve task indexing API selection and file display
- feat: improve task filtering logic for complex queries
- fix: improve Dataview source filtering and inclusion logic
- refactor: optimize Datacore query building and remove debug logs
- feat: improve Datacore task queries and add diagnostics
- refactor: improve Datacore query construction and logging
- refactor: improve Datacore query building and filtering logic
- perf: optimize task filtering by moving filters to API level
- refactor: migrate from Dataview to task index service
- feat: enhance property filter merging for task queries
- fix: preserve folder and tag filters during property-based task queries
- feat: improve task detection logic for Datacore integration
- fix: resolve task duplication in Datacore query results
- refactor: consolidate field extraction logic and improve task filtering
- chore: remove local Claude AI settings file
- refactor: align Datacore service with official API spec
- feat: add support for Datacore plugin as task indexing API
- feat: improve date filter UI and menu organization
- style: update status filter heading text
- refactor: clean up debug logging and improve UI styling
- feat: optimize query parsing and improve UI labels
- refactor: simplify task filtering and improve documentation
- feat: improve task refresh logic to prevent redundant updates
- feat: improve DataView initialization and filter persistence
- feat: auto-refresh tasks when exclusions are modified
- feat: improve task filtering with OR logic between page and task filters
- feat: improve task filtering and debug logging in DataviewService
- feat: improve task processing to handle nested subtasks
- feat: improve task filtering and add detailed debug logging
- feat: improve task filtering and debug logging
- feat: optimize task filtering performance and UX
- feat: improve task filtering using DataView API
- feat: improve task filtering with DataView API integration
- feat: improve filter UI and task refresh behavior
- feat: improve task filtering UI and behavior
- feat: enhance task filtering with improved UI and persistence
- feat: enhance task filtering with tags and notes support
- style: improve expansion stats formatting in chat view
- feat: streamline metadata display and usage statistics
- feat: improve cost tracking metadata formatting
- feat: enhance cost tracking transparency and metadata display
- feat: improve token and cost tracking accuracy
- feat: enhance token usage tracking and cost calculation
- feat: enhance token and cost tracking with detailed metadata
- refactor: consolidate token usage and cost calculation into PricingService
- feat: improve OpenRouter token usage and cost tracking
- feat: enhance token usage and cost tracking accuracy
- refactor: remove inline style from settings tab
- refactor: reorganize settings tab layout and reset buttons
- refactor: streamline pricing and usage settings UI
- feat: improve settings UI clarity and organization
- feat: streamline settings descriptions for better clarity
- refactor: improve settings UI layout and descriptions
- refactor: improve settings tab UI and layout consistency
- docs: reorganize documentation sections for better flow
- style: improve code formatting in exclusions modal
- feat: improve task exclusion UI clarity and wording
- feat: enhance task exclusion system with separate note and task tags
- feat: add task exclusion system for filtering unwanted tasks
- refactor: improve exclusions modal with suggest modals
- feat: add task exclusion system for tags, folders and notes
- style: standardize UI text and remove emojis from settings
- feat: simplify chat view interface and remove emojis
- docs: add privacy documentation and enhance debug logging
- Clean up dev docs
- refactor: simplify settings UI text and remove redundant elements
- refactor: improve settings UI text formatting
- refactor: remove unused imports and deprecated code
- refactor: simplify settings descriptions for better readability
- refactor: improve settings tab layout and organization
- Create TERMINOLOGY_CONSISTENCY_ANALYSIS_2025-01-28.md
- fix: correct API provider selection and cost tracking
- feat: improve token usage cost display for mixed model scenarios
- feat: improve chat view UI layout and button styling
- feat: improve Dataview plugin messaging and error handling
- feat: improve DataView warning handling and visibility
- feat: enhance chat UI and query parsing fallback
- feat: improve error handling and metadata display
- feat: improve error handling and metadata display
- feat: simplify error handling and metadata display
- feat: enhance error handling with HTTP status codes
- feat: store model selections per provider instead of globally
- feat: improve error handling and display for Task Chat parser failures
- style: improve code formatting and line wrapping
- feat: improve error handling and metadata display for AI chat
- feat: improve error handling and usage metrics display
- feat: improve error handling and model info display
- style: improve formatting and readability of token usage display
- feat: improve token usage display for failed task analysis
- feat: improve error message formatting and model info display
- feat: streamline semantic expansion configuration
- refactor: update default Ollama model configuration
- feat: improve model info display and token usage tracking
- feat: improve chat mode UI and provider switching behavior
- feat: streamline model configuration UI in chat view
- feat: redesign model configuration UI and improve usage tracking
- feat: improve model configuration UI and validation
- docs: enhance model configuration documentation and UI
- feat: enhance model configuration with purpose-specific settings
- feat: use analysis-specific model config for AI services
- feat: improve model configuration and temperature handling
- feat: improve model configuration with separate settings for parsing and analysis
- feat: separate parsing and analysis model tracking
- docs: add troubleshooting guide for "No Results Found" errors
- feat: track nx token pricing forével
- feat: improve semantic search reliability and language handling
- feat: improve semantic search diagnostic display
- feat: improve keyword extraction and search result clarity
- feat: enhance semantic expansion and error display
- feat: improve error display in chat interface
- refactor: improve AI query understanding display format
- feat: improve UI clarity and streamline AI understanding display
- feat: improve status category ordering system
- style: improve code formatting and readability
- docs: reorganize model documentation for better clarity
- feat: improve error handling with enhanced fallback messaging
- refactor: consolidate error handling for AI services
- feat: enhance error handling and display in chat UI
- docs: add comprehensive troubleshooting guide for AI query parser
- feat: enhance error handling and fallback for AI query parsing
- feat: enhance keyword extraction with atomic splitting rules
- feat: enhance multilingual keyword expansion algorithm
- feat: improve multilingual query parsing with clearer examples
- feat: improve model selection and error handling
- feat: improve error messaging and code formatting
- feat: improve chat history management and error handling
- feat: enhance language handling and task recommendations
- style: improve clarity of prompt documentation
- feat: enhance due date normalization with granular time windows
- feat: improve due date sorting criteria description
- feat: improve multilingual priority and status recognition
- docs: add critical documentation for property vs keyword handling
- feat: improve query parsing with strict JSON rules and examples
- refactor: improve task query parsing prompt clarity
- feat: improve query parsing format and examples
- feat: improve task property recognition in query parser
- feat: enhance multilingual property recognition in task queries
- style: standardize "Dataview" capitalization across codebase
- feat: improve query parser prompt for better semantic search
- feat: optimize keyword processing for search accuracy
- feat: improve keyword display in search results UI
- style: refine chat UI spacing and borders
- feat: improve chat message UI and fix model info display
- feat: improve token usage display and estimation
- style: adjust keyword expansion spacing and visibility
- feat: improve language handling and UI consistency
- feat: enhance token usage tracking and UI feedback
- feat: implement real-time streaming for all AI providers
- feat: add performance tuning guide and model selection docs
- feat: add configurable model parameters with documentation
- refactor: improve Ollama API integration and error handling
- feat: enhance Ollama API integration with robust error handling
- feat: improve AI model error handling and user feedback
- perf: increase max tokens for AI query responses
- feat: improve JSON parsing reliability and error handling
- refactor: improve settings management and Ollama integration
- feat: complete plugin submission requirements
- refactor: simplify logging messages in task search service
- refactor: standardize logging using Logger utility
- refactor: migrate logging to centralized Logger utility
- feat: implement centralized logging system
- feat: improve settings UI security and code organization
- feat: add command for sending chat messages with customizable hotkey
- feat: add multi-select deletion for chat sessions
- feat: enhance chat UI and session management
- feat: add common prepositions to stop words list
- refactor: remove token pricing module and update typo corrections
- feat: improve property detection and keyword extraction
- feat: update model IDs and pricing to 2025 rates with new Claude Sonnet 4 and GPT-4o series
- refactor: migrate settings to per-provider configuration structure
- docs: reorganize README and improve query syntax documentation
- docs: update settings documentation links and add section descriptions
- docs: simplify README and reorganize into focused documentation sections
- refactor: remove model filtering to support all OpenAI model types and add new model series
- feat: add status to task sort order and refine sort tag UI styling
- refactor: improve settings tab labels and organization for better clarity
- refactor: replace HTML headings with Obsidian's setHeading API in settings tab
- refactor: replace text input with slider for max chat history and improve headings hierarchy
- refactor: simplify settings UI text and descriptions for better clarity
- refactor: move status category input styles from inline to CSS classes
- refactor: simplify settings UI by moving detailed explanations to docs
- refactor: reorganize settings tab sections and improve descriptions
- refactor: reorganize settings tab with improved section headings and descriptions
- refactor: move detailed settings documentation to external markdown files
- docs: add scoring system and search modes documentation
- feat: implement auto-assigned status order and add score vs order explanation UI
- feat: add status order validation and auto-fix for duplicate sort priorities
- feat: add support for filtering tasks by past time periods (yesterday, last-week, last-month, last-year)
- refactor: centralize date matching logic and add support for month/year filters
- feat: add support for filtering tasks by tomorrow, future, week and next-week dates
- feat: add streaming response support with cancellation for AI providers
- feat: implement multi-value support for priority, due date, and status filters in task search
- feat: add unified syntax for priority and due date filters with all/none support
- refactor: move AI understanding display from box to compact metadata line format
- refactor: consolidate due date terms and generate regex pattern dynamically for multilingual support
- refactor: enhance keyword cleaning to better handle AI-expanded property terms
- feat: optimize AI query parsing with property pre-extraction and syntax cleanup
- fix: handle invalid status values with error messages and null checks for status mappings
- refactor: use centralized status pattern from TaskPropertyService for query matching
- fix: improve status query parsing and add null value handling for task status resolution
- feat: add status value resolution for aliases, symbols, and category names in query parsing
- feat: optimize property trigger word detection with smart positional filtering
- feat: add CJK character detection and language-aware keyword deduplication
- refactor: rename prompt and query parser service files to include ai prefix
- refactor: centralize task property constants and standardize field names across services
- docs: centralize hardcoded values for task search and date patterns
- refactor: centralize property terms and constants in TaskPropertyService
- refactor: switch status inference to use category keys instead of display names
- refactor: delegate date and status mapping to TaskPropertyService for consistent behavior
- refactor: move task comparison logic to TaskPropertyService to respect user settings
- refactor: rename parseTodoistSyntax to parseStandardQuerySyntax and improve pattern matching
- refactor: optimize query parsing with two-stage property extraction
- docs: remove AI NLU implementation phases documentation
- refactor: simplify query parser prompt to focus on semantic concept recognition
- feat: add AI understanding metadata and multilingual natural language parsing to query parser
- docs: add AI-enhanced natural language query documentation with multilingual support
- docs: add support for mixing status categories and symbols in filters
- feat: unify task status filtering with flexible s: syntax and aliases
- feat: add status and symbol filters with Todoist-style syntax support
- docs: remove time-based filtering support and clarify date-only limitations
- docs: add comprehensive query syntax documentation with Todoist and DataView support
- feat: add relative date parsing and property validation in query system
- feat: add natural language dates and Todoist syntax support with chrono-node
- docs: add date range extraction and structured logging with test coverage
- docs: revise implementation guide after discovering existing simple search functionality
- docs: expand testing requirements and add test framework section
- docs: add unified query system architecture and implementation guide
- docs: clarify status vs priority disambiguation in query parsing
- style: fix capitalization of "In Progress" status label for consistency
- docs: enhance task status mapping with intelligent protection model and dynamic term inference
- feat: enhance task status mapping with protected categories and improved UI
- refactor: streamline task status UI with grid layout and simplified symbol defaults
- fix: add defensive checks for task status config properties and provide default values
- feat: support dynamic task status categories with custom recognition terms
- refactor: consolidate task status configuration into unified mapping structure
- feat: add task status mapping UI with configurable character inputs
- feat: add multi-value property filters and date range support for task search
- feat: add multi-language support for property recognition in task queries
- feat: expand task status support to include cancelled state and multilingual terms
- feat: enhance status handling with expanded keywords and smart sorting
- feat: add status-based task scoring and sorting
- fix: update task reference format in AI responses to use bold markdown
- refactor: improve task reference handling with original indices tracking
- docs: clarify task reference numbering rules and examples in AI prompt
- feat: add hover preview support for internal links in chat messages
- fix: make message rendering async to properly handle markdown and links
- docs: add DataView troubleshooting tips and optimize indexing instructions
- feat: add comprehensive settings overview with visual guide and auto-refresh on relevance weight change
- feat: add user-configurable stop words with internal word list integration
- fix: filter stop words from core keywords before semantic expansion to prevent token waste
- fix: use visual field for task text and exclude generic task words from search
- refactor: optimize task hierarchy flattening using DataView's expand() API with fallback
- refactor: improve task filtering to handle nested tasks independently
- refactor: optimize task filtering by using DataView API for property filters
- refactor: use PropertyRecognitionService for due date terms and add filter logging
- refactor: delegate property detection to PropertyRecognitionService to remove hardcoded terms
- refactor: consolidate priority and status mapping logic into PromptBuilderService
- feat: add user-configurable property terms for enhanced query parsing
- feat: add semantic property term recognition across languages for task queries
- refactor: clarify task recommendation targets and limits in AI prompt
- refactor: clarify task recommendation instructions and filtering context in AI prompt
- fix: prevent relevance scoring activation from sort order to avoid filtering all tasks when no keywords present
- feat: increase task recommendation ratio from 60% to 80% for more comprehensive results
- feat: enhance task recommendation targets based on available task count
- fix: only apply minimum task safety in adaptive mode and respect user filters
- feat: redesign task sort order UI with interactive tag-based interface
- refactor: unify task sorting with single weighted criteria system
- refactor: calculate max score based on active scoring components instead of query type
- feat: adapt task scoring and filtering based on query type (keywords/properties/mixed)
- fix: calculate max score dynamically using user's sub-coefficient settings instead of hardcoded values
- fix: calculate max relevance score dynamically based on user's core weight setting
- feat: add minimum relevance score filter for task matching
- refactor: simplify keyword scoring by removing redundant all-keywords weight parameter
- feat: add coefficient reset buttons and improve scoring documentation
- feat: add advanced scoring coefficients with granular control over relevance, due dates, and priority
- refactor: remove redundant scoreTasksByRelevance method in favor of comprehensive scoring system
- feat: add configurable scoring coefficients for task ranking with real-time max score display
- feat: implement quality filter with adaptive scoring thresholds for task search
- refactor: rename relevanceThreshold to qualityFilterStrength and improve UI clarity
- refactor: update task scoring to 0-31 scale with weighted relevance, due date and priority factors
- refactor: simplify scoring system with core and all-keywords ratios
- feat: implement comprehensive weighted task scoring with relevance, due date and priority factors
- refactor: improve task recommendation logic with better prioritization and filtering rules
- feat: auto-expand AI task recommendations when too few are returned for large task sets
- feat: increase AI task context limit and add debug logging for task sorting
- docs: clarify metadata parsing rules and DataView syntax handling in prompt builder
- feat: respect user-configured status names and priority labels in AI task context
- refactor: remove unused fallback task recommendation logic and improve logging
- refactor: improve task metadata extraction and sorting logic for better reliability
- feat: add configurable max response length for AI chat responses
- feat: increase max_tokens to 1000 for full semantic expansion support in query parsing
- docs: add comprehensive guide for semantic expansion feature in Smart Search and Task Chat modes
- docs: clarify semantic expansion as cross-language equivalence generation instead of translation
- docs: improve cross-language semantic expansion instructions and error reporting
- feat: add language detection and validation for Swedish keywords in query parser
- docs: clarify keyword expansion formula and add detailed examples
- feat: implement three-part query parsing with configurable semantic expansion
- feat: improve Chinese keyword search with deduplication and stop word refinements
- fix: deduplicate sort criteria when resolving auto sort order
- refactor: clarify sort settings labels and reorder Task Chat settings for better grouping
- refactor: remove legacy single-criterion task sorting in favor of multi-criteria system
- refactor: move prompt building logic to dedicated PromptBuilderService
- feat: simplify system prompt and add reset button to settings
- feat: add comprehensive date formats, status mapping, and recommendation limits to AI system prompt
- feat: add dynamic sort order explanation based on user configuration
- feat: add task ordering guidelines to AI system prompt
- feat: apply default sorting to unfiltered task results using dueDate for auto criterion
- refactor: implement smart internal sort directions for task criteria
- feat: implement multi-criteria task sorting with customizable order per mode
- feat: add auto-refresh pricing cache and update model rates for October 2025
- refactor: implement mode-specific task sorting with separate settings per chat mode
- refactor: simplify task metadata format and update default settings
- refactor: rename search mode to chat mode for consistency and clarity
- refactor: remove legacy API key and deprecated settings code
- style: format code and align line breaks for better readability
- refactor: rename searchMode to currentChatMode for chat mode persistence in data.json
- feat: sync chat mode between sessions and persist overrides in settings
- refactor: rename searchMode to defaultChatMode with per-query override support
- fix: align user message copy button with response copy button by adjusting right padding to 10px
- refactor: improve chat message layout and copy button positioning
- refactor: simplify pricing display and improve chat message UI layout
- fix: normalize custom chat roles to standard OpenAI API roles when building message history
- docs: add three search modes with clear cost and feature breakdown
- refactor: migrate useAIQueryParsing to three-mode search system (simple/smart/chat)
- feat: add stop word filtering to improve query parsing accuracy
- refactor: improve search mode UI and logging clarity throughout app
- feat: add direct search mode to bypass AI query parsing
- feat: improve search quality by adjusting thresholds for semantic expansion
- refactor: simplify UI controls and labels for better usability
- fix: prevent scroll jump when refreshing sort settings by using dedicated container
- feat: implement adaptive quality filtering and improve task sorting logic
- feat: add separate task sorting settings for AI-enabled and AI-disabled modes
- feat: add per-query search mode toggle between AI and direct search
- refactor: move task relevance scoring from AIService to TaskSearchService
- feat: add auto sorting mode with context-aware task ordering for AI and direct search
- refactor: update relevance sorting to be user-controlled instead of automatic for keyword searches
- feat: add adaptive relevance threshold with user-configurable base for keyword matching
- docs: clarify AI query parsing vs task analysis features in settings and docs
- docs: add comprehensive feature documentation and usage examples to README
- feat: implement intelligent three-tier search system with cost optimization
- feat: add detailed direct search explanations and improve multilingual keyword extraction
- feat: add robust JSON extraction and reasoning tag cleanup for AI responses
- feat: add provider-specific model pricing lookup with OpenRouter format support
- feat: add Anthropic API support with provider-specific API key handling
- feat: add dynamic model pricing from OpenRouter API with daily updates
- feat: add connection testing for AI model providers with visual feedback
- feat: add multi-provider support with per-provider API keys and model management
- refactor: replace DataView notice with persistent warning banner in chat view
- feat: add strict task relevance constraints to AI system prompt
- feat: add temperature control for AI responses with consistent task references
- refactor: simplify task recommendation system by removing time-based context and complexity assessment
- feat: replace task references in AI responses with sequential task numbers
- feat: add time-aware task recommendations and preserve task reference order in AI responses
- fix: simplify message send shortcut to only use Cmd/Ctrl+Enter
- feat: enhance language handling by integrating query languages with response settings
- refactor: move copy button SVG from innerHTML to CSS background-image
- feat: add copy button to chat messages and improve Enter key handling
- refactor: replace ordered list with custom task numbering and styling
- refactor: enhance task relevance filtering with compound scoring system
- feat: add animated typing indicator when AI is processing response
- feat: render recommended tasks with markdown formatting and numbered list
- feat: add task display settings with sorting and limit controls
- fix: timezone handling and date parsing in Dataview task queries
- feat: migrate priority system to numeric values and add AI-powered query parsing
- feat: add support for future/upcoming task queries and fix Chinese text matching
- feat: implement advanced compound filtering with multi-filter query support
- feat: add dynamic priority mapping and due date filtering with zero-token search
- feat: redesign session management with professional modal and improved UX
- feat: add multi-session chat management with persistence and UI controls
- feat: add token usage tracking and cost optimization with direct search results
- feat: add multilingual support and 1-based task numbering with visible IDs
- feat: implement intelligent task search with semantic matching and ID-based referencing
- feat: initial release of Task Chat plugin with AI-powered task management
- Initial commit

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

