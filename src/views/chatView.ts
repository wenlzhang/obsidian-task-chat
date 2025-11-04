import {
    ItemView,
    WorkspaceLeaf,
    Notice,
    MarkdownRenderer,
    setIcon,
} from "obsidian";
import { Task, ChatMessage, TaskFilter } from "../models/task";
import { AIService } from "../services/ai/aiService";
import { NavigationService } from "../utils/navigationService";
import { SessionModal } from "./sessionModal";
import { getCurrentProviderConfig } from "../settings";
import TaskChatPlugin from "../main";
import { Logger } from "../utils/logger";
import { AIError } from "../services/warnings/errorHandler";
import { cleanWarningsFromContent } from "../services/warnings/warningService";
import { ErrorMessageService } from "../services/warnings/errorMessageService";
import { MetadataService } from "./metadataService";
import { TaskIndexWarningService } from "../services/warnings/taskIndexWarningService";
import { TaskIndexService } from "../services/tasks/taskIndexService";
import { DATACORE_POLLING } from "../utils/constants";

export const CHAT_VIEW_TYPE = "task-chat-view";

export class ChatView extends ItemView {
    private plugin: TaskChatPlugin;
    private currentTasks: Task[] = [];
    private currentFilter: TaskFilter = {};
    private filteredTaskCount = 0; // Track count for current filter
    private messagesEl: HTMLElement;
    private inputEl: HTMLTextAreaElement;
    private sendButtonEl: HTMLButtonElement;
    private filterStatusEl: HTMLElement;
    private filterButtonEl: HTMLButtonElement | null = null;
    private dataviewWarningEl: HTMLElement | null = null;
    private isProcessing = false;
    private typingIndicator: HTMLElement | null = null;
    private chatModeSelect: HTMLSelectElement | null = null;
    private chatModeOverride: "simple" | "smart" | "chat" | null = null; // null = use setting, otherwise override
    private abortController: AbortController | null = null; // For canceling AI requests
    private streamingMessageEl: HTMLElement | null = null; // Current streaming message element
    private streamingWrapperEl: HTMLElement | null = null; // Wrapper for streaming message (includes header)
    private tokenEstimateEl: HTMLElement | null = null; // Token estimate display
    private isStartupPolling = false; // Track if we're polling during startup for large vaults

    constructor(leaf: WorkspaceLeaf, plugin: TaskChatPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return CHAT_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Task chat";
    }

    getIcon(): string {
        return "messages-square";
    }

    async onOpen(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass("task-chat-container");

        // Load last session or create new
        const session = this.plugin.sessionManager.getOrCreateCurrentSession(
            this.plugin.settings.maxSessions,
        );

        // Initialize chat mode from last used (stored in settings.currentChatMode in data.json)
        // If currentChatMode matches defaultChatMode, use null (meaning "use default")
        // Otherwise, it's an override from the current session
        if (
            this.plugin.settings.currentChatMode &&
            this.plugin.settings.currentChatMode !==
                this.plugin.settings.defaultChatMode
        ) {
            this.chatModeOverride = this.plugin.settings.currentChatMode;
        } else {
            this.chatModeOverride = null; // Use default
        }

        // RESTORE: Load persisted filter from settings (if any)
        // This allows filters to survive Obsidian restarts
        this.currentFilter = { ...this.plugin.settings.currentFilter };

        // Update task count with current filter (respects inclusions/exclusions)
        this.filteredTaskCount = await this.plugin.getFilteredTaskCount(
            this.currentFilter,
        );

        // Full task list will be fetched lazily when user sends a query
        this.currentTasks = []; // Empty initially, populated on query

        this.renderView();
        await this.renderMessages();

        // Poll for API readiness and update status
        // This ensures the status updates once the API is ready
        this.startWarningPolling();
    }

    /**
     * Poll for Datacore initialization and update status
     * Continues polling until Datacore.initialized === true or timeout
     *
     * IMPROVED LOGIC:
     * - Polls until datacore.initialized === true (not just API available)
     * - Longer timeout (2 minutes) for large vaults with 50,000+ tasks
     * - Updates count immediately when initialized
     * - Stops polling once initialized (regardless of task count)
     */
    private startWarningPolling(): void {
        let pollCount = 0;

        // Mark that we're in startup polling phase
        this.isStartupPolling = true;

        Logger.debug(
            `Starting Datacore initialization polling (max ${(DATACORE_POLLING.MAX_POLLS * DATACORE_POLLING.INTERVAL_MS) / 1000}s)...`,
        );

        const pollInterval = setInterval(() => {
            void (async () => {
                pollCount++;

                // Check if Datacore is initialized (finished indexing)
                const isReady = TaskIndexService.isAPIReady();
                const isAvailable = TaskIndexService.isDatacoreAvailable();

                // Always update warning status to reflect current state
                this.renderDatacoreWarning();

                // If Datacore just became initialized, update task count
                if (isReady && this.isStartupPolling) {
                    Logger.debug(
                        `Datacore initialized after ${pollCount} polls (${(pollCount * DATACORE_POLLING.INTERVAL_MS) / 1000}s)`,
                    );

                    // Update task count now that indexing is complete
                    this.filteredTaskCount =
                        await this.plugin.getFilteredTaskCount(
                            this.currentFilter,
                        );
                    this.updateFilterStatus();

                    // Force immediate warning update
                    this.renderDatacoreWarning();

                    // Show success message
                    await this.addSystemMessage(
                        `Task indexing ready (Datacore). Found ${this.filteredTaskCount} task${this.filteredTaskCount === 1 ? "" : "s"}.`,
                    );

                    // Stop polling - we're done!
                    clearInterval(pollInterval);
                    this.isStartupPolling = false;
                    return;
                }

                // Stop polling if not available (user needs to install Datacore)
                if (!isAvailable) {
                    Logger.warn(
                        "Datacore not available. Stopping polling. Please install Datacore plugin.",
                    );
                    await this.addSystemMessage(
                        `Task indexing not available - please install Datacore`,
                    );
                    clearInterval(pollInterval);
                    this.isStartupPolling = false;
                    return;
                }

                // Stop polling if timeout reached
                if (pollCount >= DATACORE_POLLING.MAX_POLLS) {
                    Logger.warn(
                        `Datacore still indexing after ${(DATACORE_POLLING.MAX_POLLS * DATACORE_POLLING.INTERVAL_MS) / 1000}s timeout. Large vault may need more time. Stopping polling.`,
                    );
                    await this.addSystemMessage(
                        `Datacore is still indexing (large vault detected). Task count will update when ready.`,
                    );
                    clearInterval(pollInterval);
                    this.isStartupPolling = false;
                    return;
                }

                // Log progress every N polls
                if (pollCount % DATACORE_POLLING.LOG_INTERVAL === 0) {
                    Logger.debug(
                        `Still waiting for Datacore initialization... (${(pollCount * DATACORE_POLLING.INTERVAL_MS) / 1000}s elapsed)`,
                    );
                }
            })();
        }, DATACORE_POLLING.INTERVAL_MS);
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }

    /**
     * Render the chat view
     */
    private renderView(): void {
        this.contentEl.empty();

        // Status bar
        const statusEl = this.contentEl.createDiv("task-chat-status");
        this.filterStatusEl = statusEl.createSpan({
            cls: "task-chat-filter-status",
        });
        this.updateFilterStatus();

        // Datacore warning element (initially null, created when needed)
        // WARNING: Never hide this - it provides critical information about why searches return 0 results
        this.dataviewWarningEl = null;

        // Check and render Datacore status immediately
        this.renderDatacoreWarning();

        // Button controls - grouped logically
        const controlsEl = this.contentEl.createDiv("task-chat-controls");

        // Group 1: Session management
        const sessionGroup = controlsEl.createDiv("task-chat-button-group");

        const newSessionBtn = sessionGroup.createEl("button", {
            text: "New",
            cls: "task-chat-new-session-btn",
        });
        newSessionBtn.addEventListener("click", () => {
            void this.createNewSession();
        });

        const clearBtn = sessionGroup.createEl("button", { text: "Clear" });
        clearBtn.addEventListener("click", () => {
            void this.clearChat();
        });

        const sessionsBtn = sessionGroup.createEl("button", {
            text: "Sessions",
        });
        sessionsBtn.addEventListener("click", () => this.openSessionModal());

        // Group 2: Chat mode (compact dropdown only)
        const chatModeGroup = controlsEl.createDiv("task-chat-button-group");
        const chatModeContainer = chatModeGroup.createDiv(
            "task-chat-chat-mode",
        );

        // Dropdown with icon inside option text
        this.chatModeSelect = chatModeContainer.createEl("select", {
            cls: "task-chat-chat-mode-select",
        });

        // Populate options
        this.updateChatModeOptions();

        this.chatModeSelect.addEventListener("change", () => {
            void (async () => {
                const value = this.chatModeSelect?.value as
                    | "simple"
                    | "smart"
                    | "chat";

                // If user selects the default mode, clear the override
                if (value === this.plugin.settings.defaultChatMode) {
                    this.chatModeOverride = null;
                } else {
                    this.chatModeOverride = value;
                }

                // Save to settings.currentChatMode (persists in data.json for current session)
                this.plugin.settings.currentChatMode = value;
                await this.plugin.saveSettings();

                Logger.debug(`Chat mode changed to: ${value}`);
            })();
        });

        // Group 3: Filter controls
        const filterGroup = controlsEl.createDiv("task-chat-button-group");

        this.filterButtonEl = filterGroup.createEl("button", {
            cls: "task-chat-filter-btn",
        });
        // Add filter icon using setIcon (Lucide icon)
        const filterIcon = this.filterButtonEl.createSpan({
            cls: "task-chat-button-icon",
        });
        setIcon(filterIcon, "filter");
        this.filterButtonEl.createSpan({
            text: "Filter",
            cls: "task-chat-button-text",
        });

        this.filterButtonEl.addEventListener("click", () =>
            this.openFilterModal(),
        );

        // Update filter button style based on active state
        this.updateFilterButtonState();

        // Group 4: Task refresh
        const refreshGroup = controlsEl.createDiv("task-chat-button-group");

        const refreshBtn = refreshGroup.createEl("button", {
            text: "Refresh",
        });
        refreshBtn.addEventListener("click", () => {
            void this.refreshTaskCount();
        });

        // Messages container
        this.messagesEl = this.contentEl.createDiv("task-chat-messages");
        // Note: Messages will be rendered by onOpen() which calls renderMessages() with proper await

        // Input area
        const inputContainerEl = this.contentEl.createDiv(
            "task-chat-input-container",
        );

        // Input wrapper with token counter overlay
        const inputWrapperEl = inputContainerEl.createDiv(
            "task-chat-input-wrapper",
        );

        this.inputEl = inputWrapperEl.createEl("textarea", {
            placeholder: "Chat with your tasks...",
            attr: {
                rows: "3",
            },
        });

        // Token counter overlay (top-right inside input box)
        const tokenCounterOverlay = inputWrapperEl.createDiv(
            "task-chat-token-counter-overlay",
        );
        tokenCounterOverlay.setText("0 tokens");
        this.tokenEstimateEl = tokenCounterOverlay;

        // Update token count on input
        this.inputEl.addEventListener("input", () => {
            this.updateTokenCounter();
        });

        // Note: Hotkey for sending messages is now handled by the command system
        // Users can customize the hotkey in Settings → Hotkeys → "Send chat message"

        // Control bar (model config button + send button on same line)
        const toolbarEl = inputContainerEl.createDiv("task-chat-input-toolbar");

        // Model configuration button (left side)
        const modelConfigBtn = toolbarEl.createEl("button", {
            cls: "task-chat-model-config-button",
        });
        modelConfigBtn.createSpan({
            text: "⚙️",
            cls: "task-chat-model-config-icon",
        });
        modelConfigBtn.createSpan({
            text: "Models",
            cls: "task-chat-model-config-text",
        });
        modelConfigBtn.addEventListener("click", () => {
            // @ts-ignore
            this.app.setting.open();
            // @ts-ignore
            this.app.setting.openTabById("task-chat");
            new Notice("Navigate to model configuration");
        });

        // Send button (right side)
        this.sendButtonEl = toolbarEl.createEl("button", {
            text: "Send",
            cls: "task-chat-send-button",
        });

        this.sendButtonEl.addEventListener("click", () => {
            if (this.isProcessing) {
                this.stopGeneration();
            } else {
                void this.sendMessage();
            }
        });

        // Initial welcome message
        const messages = this.plugin.sessionManager.getCurrentMessages();
        if (messages.length === 0) {
            // Note: addSystemMessage is async but we don't await here as it's called from constructor
            // Message will render asynchronously
            void this.addSystemMessage(
                "Welcome to Task Chat! I can help you manage and analyze your tasks. Ask me anything about your tasks!",
            );
        }
    }

    /**
     * Update filter status display
     */
    private updateFilterStatus(): void {
        if (!this.filterStatusEl) return;

        this.filterStatusEl.empty();

        const hasFilters =
            (this.currentFilter.folders &&
                this.currentFilter.folders.length > 0) ||
            (this.currentFilter.noteTags &&
                this.currentFilter.noteTags.length > 0) ||
            (this.currentFilter.taskTags &&
                this.currentFilter.taskTags.length > 0) ||
            (this.currentFilter.notes && this.currentFilter.notes.length > 0) ||
            (this.currentFilter.priorities &&
                this.currentFilter.priorities.length > 0) ||
            (this.currentFilter.taskStatuses &&
                this.currentFilter.taskStatuses.length > 0) ||
            this.currentFilter.dueDateRange;

        // Always show task count first (uses current filter with inclusions/exclusions)
        this.filterStatusEl.createSpan({
            text: `Found ${this.filteredTaskCount} task${this.filteredTaskCount === 1 ? "" : "s"}`,
            cls: "task-chat-filter-count",
        });

        if (hasFilters) {
            // Add separator
            this.filterStatusEl.createSpan({
                text: " | ",
                cls: "task-chat-filter-separator",
            });

            // Add filter icon and label
            const filterLabel = this.filterStatusEl.createEl("strong");
            const filterIcon = filterLabel.createSpan({
                cls: "task-chat-filter-status-icon",
            });
            setIcon(filterIcon, "filter");
            filterLabel.createSpan({
                text: " Active filters: ",
            });

            const filterParts: string[] = [];

            if (
                this.currentFilter.folders &&
                this.currentFilter.folders.length > 0
            ) {
                filterParts.push(
                    `Folders (${this.currentFilter.folders.length})`,
                );
            }

            if (
                this.currentFilter.noteTags &&
                this.currentFilter.noteTags.length > 0
            ) {
                filterParts.push(
                    `Note Tags (${this.currentFilter.noteTags.length})`,
                );
            }

            if (
                this.currentFilter.taskTags &&
                this.currentFilter.taskTags.length > 0
            ) {
                filterParts.push(
                    `Task Tags (${this.currentFilter.taskTags.length})`,
                );
            }

            if (
                this.currentFilter.notes &&
                this.currentFilter.notes.length > 0
            ) {
                filterParts.push(`Notes (${this.currentFilter.notes.length})`);
            }

            if (
                this.currentFilter.priorities &&
                this.currentFilter.priorities.length > 0
            ) {
                filterParts.push(
                    `Priorities (${this.currentFilter.priorities.length})`,
                );
            }

            if (
                this.currentFilter.taskStatuses &&
                this.currentFilter.taskStatuses.length > 0
            ) {
                filterParts.push(
                    `Statuses (${this.currentFilter.taskStatuses.length})`,
                );
            }

            if (this.currentFilter.dueDateRange) {
                filterParts.push(`Due Date Range`);
            }

            this.filterStatusEl.createSpan({ text: filterParts.join(", ") });
        }
    }

    /**
     * Update filter button visual state based on whether filters are active
     */
    private updateFilterButtonState(): void {
        if (!this.filterButtonEl) return;

        const hasFilters =
            (this.currentFilter.folders &&
                this.currentFilter.folders.length > 0) ||
            (this.currentFilter.noteTags &&
                this.currentFilter.noteTags.length > 0) ||
            (this.currentFilter.taskTags &&
                this.currentFilter.taskTags.length > 0) ||
            (this.currentFilter.notes && this.currentFilter.notes.length > 0) ||
            (this.currentFilter.priorities &&
                this.currentFilter.priorities.length > 0) ||
            (this.currentFilter.taskStatuses &&
                this.currentFilter.taskStatuses.length > 0) ||
            this.currentFilter.dueDateRange;

        if (hasFilters) {
            this.filterButtonEl.addClass("task-chat-filter-btn-active");
        } else {
            this.filterButtonEl.removeClass("task-chat-filter-btn-active");
        }
    }

    /**
     * Get current chat mode override value
     * Returns null if using default, otherwise returns the override mode
     */
    public getChatModeOverride(): "simple" | "smart" | "chat" | null {
        return this.chatModeOverride;
    }

    /**
     * Get current filter state
     * Used by plugin to re-apply filters after task refresh
     */
    public getCurrentFilter(): TaskFilter {
        return this.currentFilter;
    }

    /**
     * Update chat mode dropdown options - always shows all three modes
     * Public method so it can be called when settings change
     */
    public updateChatModeOptions(): void {
        if (!this.chatModeSelect) return;

        this.chatModeSelect.empty();

        // Create all three mode options without icons (icon only on button)
        this.chatModeSelect.createEl("option", {
            value: "simple",
            text: "Simple search",
        });
        this.chatModeSelect.createEl("option", {
            value: "smart",
            text: "Smart search",
        });
        this.chatModeSelect.createEl("option", {
            value: "chat",
            text: "Task chat",
        });

        // Set to current setting (or override if one exists)
        const currentMode =
            this.chatModeOverride || this.plugin.settings.defaultChatMode;
        this.chatModeSelect.value = currentMode;

        Logger.debug(`Chat mode dropdown updated: ${currentMode}`);
    }

    /**
     * Render Dataview status banner with helpful information
     * Uses centralized DataViewWarningService for consistent messaging
     *
     * CRITICAL: This warning should ALWAYS be shown when there are issues.
     * Never hide it - users need to know why they're getting 0 results.
     *
     * Shows different messages based on Dataview state:
     * - Not installed/enabled: Installation instructions
     * - Enabled but indexing: Wait for indexing to complete
     * - Enabled but 0 tasks: Troubleshooting tips
     */
    private renderDatacoreWarning(): void {
        // Use filteredTaskCount instead of currentTasks.length
        // currentTasks is empty until user sends a query (lazy loading)
        // but filteredTaskCount is updated on startup and when API becomes ready
        const taskCount = this.filteredTaskCount;

        // Check task indexing API status using centralized service
        // Pass filter and settings for detailed diagnostic information
        const warning = TaskIndexWarningService.checkAPIStatus(
            this.app,
            this.plugin.settings,
            taskCount,
            this.currentFilter,
            this.isStartupPolling, // Pass startup polling flag for better messaging
        );

        // Remove existing warning if everything is ready
        if (warning.type === "ready") {
            if (this.dataviewWarningEl) {
                this.dataviewWarningEl.remove();
                this.dataviewWarningEl = null;
            }
            return;
        }

        // Create warning banner if it doesn't exist
        if (!this.dataviewWarningEl) {
            // Insert at the top of content, after header and status bar
            const headerEl = this.contentEl.querySelector(".task-chat-header");
            const statusEl = this.contentEl.querySelector(".task-chat-status");

            this.dataviewWarningEl = this.contentEl.createDiv(
                "task-chat-dataview-warning",
            );

            // Move warning to top (after header and status)
            if (statusEl && statusEl.nextSibling) {
                this.contentEl.insertBefore(
                    this.dataviewWarningEl,
                    statusEl.nextSibling,
                );
            }
        }

        // Render warning using centralized service
        TaskIndexWarningService.renderWarning(
            this.dataviewWarningEl,
            this.app,
            this.plugin.settings,
            taskCount,
            this.currentFilter,
            this.isStartupPolling, // Pass startup polling flag for better messaging
        );

        Logger.debug(`[Datacore Warning] ${warning.type}: ${warning.message}`);
    }

    /**
     * Render all chat messages
     */
    private async renderMessages(): Promise<void> {
        this.messagesEl.empty();

        const messages = this.plugin.sessionManager.getCurrentMessages();

        // Render messages sequentially to ensure proper async handling
        for (const message of messages) {
            await this.renderMessage(message);
        }

        // Auto-scroll to bottom
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    /**
     * Show typing indicator
     */
    private showTypingIndicator(): void {
        if (this.typingIndicator) {
            return;
        }

        // Determine what text to show based on current mode
        const currentMode =
            this.chatModeOverride || this.plugin.settings.currentChatMode;
        let indicatorText: string;

        if (currentMode === "simple") {
            indicatorText = "Simple Search";
        } else if (currentMode === "smart") {
            indicatorText = "Smart Search";
        } else {
            indicatorText = "Task Chat";
        }

        this.typingIndicator = this.messagesEl.createDiv(
            "task-chat-message task-chat-message-assistant task-chat-typing",
        );

        const headerEl = this.typingIndicator.createDiv(
            "task-chat-message-header",
        );

        headerEl.createEl("strong", { text: indicatorText });

        const contentEl = this.typingIndicator.createDiv(
            "task-chat-message-content",
        );
        const dotsEl = contentEl.createDiv("task-chat-typing-dots");
        dotsEl.createSpan({ cls: "task-chat-typing-dot" });
        dotsEl.createSpan({ cls: "task-chat-typing-dot" });
        dotsEl.createSpan({ cls: "task-chat-typing-dot" });

        // Auto-scroll to bottom
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    /**
     * Hide typing indicator
     */
    private hideTypingIndicator(): void {
        if (this.typingIndicator) {
            this.typingIndicator.remove();
            this.typingIndicator = null;
        }
    }

    /**
     * Get compact AI understanding summary for metadata line
     * Returns a short string with key info (language, confidence, typos)
     */
    private getAIUnderstandingSummary(message: ChatMessage): string | null {
        // Show for all message types if they have parsedQuery (Smart Search, Task Chat)
        // Note: Natural language and typo info are now shown in the AI Query line below
        // This compact summary is intentionally minimal to avoid duplication
        if (
            !message.parsedQuery ||
            !this.plugin.settings.aiEnhancement.showAIUnderstanding
        ) {
            return null;
        }

        // Currently empty - all AI understanding info is shown in detailed AI Query line
        // Keep this method for future compact metadata if needed
        return null;
    }

    /**
     * Get keyword expansion summary for display
     * Shows core keywords, expanded keywords, and expansion stats
     * Note: Keywords are already clean (deduplicated + stop words filtered) from extraction/AI
     * IMPORTANT: Always return info when available, even with 0 results (helps user debug)
     */
    private getKeywordExpansionSummary(message: ChatMessage): string | null {
        const query = message.parsedQuery;
        if (!query) {
            // No parsed query available
            return null;
        }

        const parts: string[] = [];
        const hasResults =
            message.recommendedTasks && message.recommendedTasks.length > 0;

        // Core keywords (already clean from extraction/AI)
        // Simple Search: extractKeywords() already deduplicated + filtered
        // Smart Search/Task Chat: AI returns clean keywords per explicit prompt instructions
        if (query.coreKeywords && query.coreKeywords.length > 0) {
            const keywordList = query.coreKeywords.join(", ");
            // Always show keywords, even with 0 results (helps debug)
            parts.push(`🔑 Core: ${keywordList}`);
        } else if (!hasResults && message.role !== "user") {
            // No core keywords extracted - show this info for 0 results
            parts.push("🔑 Core: (none extracted)");
        }

        // Expanded keywords (if semantic expansion was used)
        // AI returns expanded keywords already deduplicated per prompt instructions
        if (query.expansionMetadata?.enabled) {
            if (
                query.keywords &&
                query.keywords.length > (query.coreKeywords?.length || 0)
            ) {
                // Find expanded-only keywords (not in core)
                // Both arrays already clean, no need to deduplicate again
                const expandedOnly = query.keywords.filter(
                    (k: string) =>
                        !query.coreKeywords || !query.coreKeywords.includes(k),
                );
                if (expandedOnly.length > 0) {
                    // Show ALL expanded keywords (no limit)
                    // User wants to see all semantic variations for debugging
                    const keywordDisplay = expandedOnly.join(", ");
                    parts.push(`🤖 Semantic: ${keywordDisplay}`);
                }
            } else if (!hasResults) {
                // Expansion enabled but no expanded keywords - show this for 0 results
                parts.push(
                    "🤖 Semantic: (expansion enabled but no keywords generated)",
                );
            }
        }

        // Expansion stats - always show if metadata exists, even with 0 results
        if (query.expansionMetadata) {
            const meta = query.expansionMetadata;
            if (meta.enabled) {
                // Show expansion statistics in compact format with vertical bars
                // Example: "4 core → 27 expansion | 3/core/lang | English, 中文"

                // Calculate ACTUAL per-core-per-lang from EXPANDED keywords (not total, not user setting)
                // expandedOnly = semantic/expanded keywords (excluding core)
                const expandedOnly =
                    meta.totalKeywords - meta.coreKeywordsCount;
                const numLanguages = meta.languagesUsed?.length || 1;
                const numCore = meta.coreKeywordsCount || 0;
                const denominator = numCore > 0 ? numCore * numLanguages : 0;
                const actualPerCoreLangValue =
                    denominator > 0 ? expandedOnly / denominator : 0;
                const actualPerCoreLang = actualPerCoreLangValue.toFixed(1);

                // Build expansion line
                // Format: "X core → Y semantic, Z.Z/core/lang | Language1, Language2"
                let expansionLine = `${meta.coreKeywordsCount} core → ${expandedOnly} semantic, ${actualPerCoreLang}/core/lang`;

                // Add languages if available (comma-separated between multiple languages)
                if (meta.languagesUsed && meta.languagesUsed.length > 0) {
                    expansionLine += ` | ${meta.languagesUsed.join(", ")}`;
                }

                parts.push(`📈 Expansion: ${expansionLine}`);
            } else if (!hasResults) {
                // Expansion disabled - mention this for 0 results
                parts.push("📈 Expansion: disabled");
            }
        }

        // AI Query Understanding (compact single-line format with grouped sections)
        // Order: Task Properties → Typos → Natural Language → Language → Confidence
        // Only show if enabled and AI understanding data exists
        if (
            this.plugin.settings.aiEnhancement.showAIUnderstanding &&
            query.aiUnderstanding
        ) {
            const ai = query.aiUnderstanding;
            const groups: string[] = [];

            // Group 1: Core task properties (Due, Priority, Status)
            const coreProps: string[] = [];
            if (ai.semanticMappings?.dueDate) {
                coreProps.push(`Due=${ai.semanticMappings.dueDate}`);
            }
            if (ai.semanticMappings?.priority) {
                coreProps.push(`Priority=${ai.semanticMappings.priority}`);
            }
            if (ai.semanticMappings?.status) {
                coreProps.push(`Status=${ai.semanticMappings.status}`);
            }
            if (coreProps.length > 0) {
                groups.push(coreProps.join(", "));
            }

            // Group 2: Other semantic mappings (folder, tag, etc.)
            if (ai.semanticMappings) {
                const otherMappings = Object.entries(ai.semanticMappings)
                    .filter(
                        ([key]) =>
                            !["priority", "dueDate", "status"].includes(key),
                    )
                    .map(([key, value]) => `${key}=${value}`);
                if (otherMappings.length > 0) {
                    groups.push(otherMappings.join(", "));
                }
            }

            // Group 3: Typo Corrections (count only, not details)
            if (ai.correctedTypos && ai.correctedTypos.length > 0) {
                groups.push(`Typos: ${ai.correctedTypos.length}`);
            }

            // Group 4: Natural Language + Language (comma-separated)
            const nlAndLang: string[] = [];
            if (ai.naturalLanguageUsed !== undefined) {
                const nlLabel = ai.naturalLanguageUsed ? "NL" : "Syntax";
                nlAndLang.push(nlLabel);
            }
            if (ai.detectedLanguage) {
                nlAndLang.push(`${ai.detectedLanguage}`);
            }
            if (nlAndLang.length > 0) {
                groups.push(nlAndLang.join(", "));
            }

            // Group 5: Confidence
            if (ai.confidence !== undefined) {
                const conf = Math.round(ai.confidence * 100);
                let level = "High";
                if (ai.confidence < 0.5) level = "Low";
                else if (ai.confidence < 0.7) level = "Medium";
                groups.push(`Confidence=${level} (${conf}%)`);
            }

            if (groups.length > 0) {
                parts.push(`🔍 AI Query: ${groups.join(" | ")}`);
            }
        }

        return parts.length > 0 ? parts.join("\n") : null;
    }

    /**
     * Render a single message
     */
    private async renderMessage(message: ChatMessage): Promise<void> {
        const messageEl = this.messagesEl.createDiv(
            `task-chat-message task-chat-message-${message.role}`,
        );

        // Message header
        const headerEl = messageEl.createDiv("task-chat-message-header");

        // Map message roles to display names
        let roleName: string;
        if (message.role === "user") {
            roleName = "You";
        } else if (message.role === "simple") {
            roleName = "Simple Search";
        } else if (message.role === "smart") {
            roleName = "Smart Search";
        } else if (message.role === "chat") {
            roleName = "Task Chat";
        } else {
            roleName = "System";
        }
        headerEl.createEl("strong", { text: roleName });
        headerEl.createEl("span", {
            text: new Date(message.timestamp).toLocaleTimeString(),
            cls: "task-chat-message-time",
        });

        // Display structured error if present (API/parser/analysis failures)
        // Show FIRST, before all content, for immediate visibility
        if (message.error) {
            ErrorMessageService.renderError(messageEl, message.error);
        }

        // Message content
        const contentEl = messageEl.createDiv("task-chat-message-content");

        // Use MarkdownRenderer to enable internal links, tags, and proper markdown in AI responses
        // Use the source path of the first recommended task if available for context
        // Otherwise use the active file's path for proper link resolution
        const contextPath =
            message.recommendedTasks && message.recommendedTasks.length > 0
                ? message.recommendedTasks[0].sourcePath
                : this.app.workspace.getActiveFile()?.path || "";

        Logger.debug(
            `Rendering message content (${message.content.length} chars) with context: ${contextPath}`,
        );

        await MarkdownRenderer.renderMarkdown(
            message.content,
            contentEl,
            contextPath,
            this,
        );

        // Enable hover preview for internal links in message content
        this.enableHoverPreview(contentEl, contextPath);

        // Add click handler for message content links
        contentEl.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;

            // Handle clicks on links
            if (target.tagName === "A") {
                e.preventDefault();
                this.handleLinkClick(target as HTMLAnchorElement, contextPath);
            }
        });

        // Recommended tasks
        if (message.recommendedTasks && message.recommendedTasks.length > 0) {
            const tasksEl = messageEl.createDiv("task-chat-recommended-tasks");
            tasksEl.createEl("strong", { text: "Recommended tasks:" });

            const taskListEl = tasksEl.createDiv("task-chat-task-list");

            // Use for...of instead of forEach to properly handle async rendering
            for (
                let index = 0;
                index < message.recommendedTasks.length;
                index++
            ) {
                const task = message.recommendedTasks[index];
                const taskItemEl = taskListEl.createDiv("task-chat-task-item");

                // Add task number as separate element
                const taskNumber = index + 1;
                const numberEl = taskItemEl.createSpan("task-chat-task-number");
                numberEl.textContent = `${taskNumber}.`;

                // Create a container for the task markdown
                const taskContentEl = taskItemEl.createDiv(
                    "task-chat-task-content",
                );

                // Render task with markdown task syntax for theme support
                // Pass task.sourcePath to enable internal links, block links, tags, and hover preview
                // MUST await to ensure links are properly registered by Obsidian
                const taskMarkdown = `- [${task.status}] ${task.text}`;

                Logger.debug(
                    `Rendering task ${taskNumber}: ${task.text.substring(0, 50)}...`,
                );
                Logger.debug(`- Source path: ${task.sourcePath}`);
                Logger.debug(
                    `- Task markdown: ${taskMarkdown.substring(0, 100)}...`,
                );

                await MarkdownRenderer.renderMarkdown(
                    taskMarkdown,
                    taskContentEl,
                    task.sourcePath,
                    this,
                );

                // Enable hover preview for internal links in task content
                this.enableHoverPreview(taskContentEl, task.sourcePath);

                // Add click handlers for links in task content
                taskContentEl.addEventListener("click", (e) => {
                    const target = e.target as HTMLElement;

                    // Handle clicks on links
                    if (target.tagName === "A") {
                        e.preventDefault();
                        this.handleLinkClick(
                            target as HTMLAnchorElement,
                            task.sourcePath,
                        );
                    }
                });

                const navBtn = taskItemEl.createEl("button", {
                    text: "→",
                    cls: "task-chat-nav-button",
                });

                navBtn.addEventListener("click", () => {
                    void NavigationService.navigateToTask(this.app, task);
                });
            }
        }

        // AI Understanding: Keyword expansion info (show after tasks, before token usage)
        // Shows core keywords for all modes, expanded keywords + stats for Smart Search & Task Chat
        // Moved outside messageEl so border-left doesn't extend to it
        const keywordSummary = this.getKeywordExpansionSummary(message);
        if (keywordSummary) {
            const keywordEl = this.messagesEl.createDiv(
                "task-chat-keyword-expansion",
            );
            keywordEl.createEl("small", {
                text: keywordSummary,
                cls: "task-chat-keyword-summary",
            });
        }

        // Token usage display - moved outside messageEl so border-left doesn't extend to it
        // CRITICAL: Show metadata when error occurs OR when showTokenUsage is enabled
        // This ensures users ALWAYS see parser/analysis failures with troubleshooting info
        if (
            message.error ||
            (message.tokenUsage && this.plugin.settings.showTokenUsage)
        ) {
            const usageEl = this.messagesEl.createDiv("task-chat-token-usage");

            // Use MetadataService to format metadata (centralized logic)
            const metadataText = MetadataService.formatMetadata(
                message,
                this.plugin.settings,
            );

            // Log what's being displayed for debugging
            if (message.tokenUsage) {
                Logger.debug(
                    `[Metadata Display] Cost values - estimatedCost: $${message.tokenUsage.estimatedCost?.toFixed(6) || "N/A"}, ` +
                        `parsingCost: $${message.tokenUsage.parsingCost?.toFixed(6) || "N/A"}, ` +
                        `analysisCost: $${message.tokenUsage.analysisCost?.toFixed(6) || "N/A"}`,
                );
                Logger.debug(
                    `[Metadata Display] Token counts - total: ${message.tokenUsage.totalTokens}, ` +
                        `prompt: ${message.tokenUsage.promptTokens}, ` +
                        `completion: ${message.tokenUsage.completionTokens}`,
                );
                Logger.debug(
                    `[Metadata Display] Displayed text: "${metadataText}"`,
                );
            }

            if (metadataText) {
                // Add AI understanding summary to metadata line (compact format)
                const aiSummary = this.getAIUnderstandingSummary(message);
                const finalText = aiSummary
                    ? metadataText.replace("📊 ", "📊 ") + " • " + aiSummary
                    : metadataText;

                usageEl.createEl("small", { text: finalText });

                // Add copy button to token usage line for assistant/system messages
                if (message.role !== "user") {
                    this.addCopyButton(usageEl, message);
                }
            } else {
                // If no metadata to show, remove the empty div
                usageEl.remove();
            }
        }

        // Display parser error warning if parsing failed
        if (
            message.parsedQuery?._parserError &&
            message.parsedQuery?._parserModel
        ) {
            const errorEl = messageEl.createDiv({
                cls: "task-chat-parser-error",
            });

            errorEl.createEl("div", {
                cls: "task-chat-parser-error-header",
                text: "⚠️ AI Query Parser Failed",
            });

            const detailsEl = errorEl.createDiv({
                cls: "task-chat-parser-error-details",
            });

            detailsEl.createEl("div", {
                text: `Model: ${message.parsedQuery._parserModel}`,
            });

            // Parse error message and solution (format: "error | solution")
            const errorParts = message.parsedQuery._parserError.split(" | ");
            const errorMessage = errorParts[0];
            const solution = errorParts.length > 1 ? errorParts[1] : null;

            detailsEl.createEl("div", {
                text: `Error: ${errorMessage}`,
            });

            if (solution) {
                const solutionEl = detailsEl.createEl("div", {
                    cls: "task-chat-parser-error-solution",
                });
                solutionEl.createEl("strong", { text: "💡 Solution: " });
                solutionEl.createSpan({ text: solution });
            }

            // Check if we have semantic expansion metadata to determine what actually happened
            const hasSemanticExpansion =
                message.parsedQuery?.expansionMetadata?.enabled &&
                message.parsedQuery?.expansionMetadata?.totalKeywords > 0;

            let fallbackText = "";
            if (hasSemanticExpansion) {
                // AI parsing succeeded before the error - we have expanded keywords
                fallbackText = `✓ Semantic expansion succeeded (${message.parsedQuery.expansionMetadata.totalKeywords} keywords from ${message.parsedQuery.expansionMetadata.coreKeywordsCount} core). Using AI-filtered results.`;
            } else {
                // AI parsing failed completely - using Simple Search fallback
                fallbackText =
                    "✓ Using fallback: Simple Search mode (regex + character-level keywords)";
            }

            detailsEl.createEl("div", {
                cls: "task-chat-parser-error-fallback",
                text: fallbackText,
            });
        }

        // Error display moved to before recommended tasks (see line ~787)

        // Add copy button below message for user messages
        if (message.role === "user") {
            this.addCopyButton(messageEl, message);
        }
    }

    /**
     * Add copy button to a container element
     */
    private addCopyButton(container: HTMLElement, message: ChatMessage): void {
        const copyBtn = container.createEl("button", {
            cls: "task-chat-copy-button",
            attr: {
                "aria-label": "Copy message",
            },
        });
        copyBtn.addEventListener("click", () => {
            let textToCopy = message.content;

            // Include recommended tasks if present (with markdown status)
            if (
                message.recommendedTasks &&
                message.recommendedTasks.length > 0
            ) {
                textToCopy += "\n\nRecommended tasks:\n";
                message.recommendedTasks.forEach((task, index) => {
                    textToCopy += `${index + 1}. - [${task.status}] ${task.text}\n`;
                });
            }

            void navigator.clipboard.writeText(textToCopy);
            new Notice("Message copied to clipboard");
        });
    }

    /**
     * Handle link clicks for internal links, tags, and external URLs
     */
    private handleLinkClick(link: HTMLAnchorElement, sourcePath: string): void {
        const href =
            link.getAttribute("href") || link.getAttribute("data-href");
        const linkClass = link.className;

        if (!href) {
            return;
        }

        // Handle tags (#tag)
        if (linkClass.contains("tag")) {
            // Use Obsidian's search for tags
            (this.app as any).internalPlugins
                .getPluginById("global-search")
                .instance.openGlobalSearch(`tag:${href.replace("#", "")}`);
            return;
        }

        // Handle internal links ([[Note]])
        if (linkClass.contains("internal-link")) {
            // Use Obsidian's built-in method to open links
            void this.app.workspace.openLinkText(href, sourcePath, false);
            return;
        }

        // Handle external links (https://...)
        if (
            linkClass.contains("external-link") ||
            href.startsWith("http://") ||
            href.startsWith("https://")
        ) {
            window.open(href, "_blank");
            return;
        }

        // Fallback: try to open as internal link
        void this.app.workspace.openLinkText(href, sourcePath, false);
    }

    /**
     * Public method for sending message from command system
     * Called when user triggers the "Send chat message" command
     */
    public sendMessageFromCommand(): void {
        // Focus input first to ensure proper context
        this.inputEl.focus();
        // Trigger send
        void this.sendMessage();
    }

    /**
     * Clean warnings from chat history messages before sending to AI
     * NOTE: This creates a cleaned COPY for AI context only.
     * Original messages in chat history remain unchanged (warnings stay visible in UI).
     *
     * Filters out:
     * - Error messages with status codes (API errors)
     * - Cleans warning blocks from content of remaining messages
     */
    private cleanWarningsFromHistory(messages: ChatMessage[]): ChatMessage[] {
        return messages
            .filter((msg) => {
                // Exclude error messages with status codes (API errors like 400, 401, 429, 500)
                // These are technical errors not relevant to AI conversation context
                if (msg.error?.statusCode) {
                    return false;
                }
                return true;
            })
            .map((msg) => ({
                ...msg,
                content: this.removeWarningsFromContent(msg.content),
            }));
    }

    /**
     * Remove warning blocks from content
     * Used by cleanWarningsFromHistory to strip warnings when sending to AI
     */
    private removeWarningsFromContent(content: string): string {
        // Use the centralized cleanup function
        return cleanWarningsFromContent(content);
    }

    /**
     * Send a message to AI
     */
    private async sendMessage(): Promise<void> {
        const message = this.inputEl.value.trim();

        if (!message || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.sendButtonEl.disabled = false; // Keep enabled so user can click to stop
        this.sendButtonEl.setText("Stop");
        this.sendButtonEl.addClass("task-chat-stop-button");

        // Create abort controller for canceling request
        this.abortController = new AbortController();

        // Add user message to session FIRST (sync, no await)
        const userMessage: ChatMessage = {
            role: "user",
            content: message,
            timestamp: Date.now(),
        };
        this.plugin.sessionManager.addMessage(
            userMessage,
            this.plugin.settings.maxSessions,
        );

        // Clear input AFTER adding to session
        this.inputEl.value = "";
        this.updateTokenCounter();
        this.inputEl.disabled = false; // Keep input enabled for better UX
        this.inputEl.placeholder = "Processing...";

        // Render user message directly to DOM (sync, no await)
        // This shows the message immediately without blocking
        await this.renderMessage(userMessage);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        // Show typing indicator IMMEDIATELY (sync, no await)
        const useStreaming = this.plugin.settings.aiEnhancement.enableStreaming;
        const usedChatMode =
            this.chatModeOverride || this.plugin.settings.defaultChatMode;

        if (useStreaming) {
            // Create streaming message element instead of typing indicator
            this.streamingWrapperEl = this.messagesEl.createDiv({
                cls: "task-chat-message task-chat-message-ai",
            });

            // Add header with mode name
            const headerEl = this.streamingWrapperEl.createDiv(
                "task-chat-message-header",
            );
            let modeName: string;
            if (usedChatMode === "simple") {
                modeName = "Simple Search";
            } else if (usedChatMode === "smart") {
                modeName = "Smart Search";
            } else {
                modeName = "Task Chat";
            }
            headerEl.createEl("strong", { text: modeName });
            headerEl.createEl("span", {
                text: new Date().toLocaleTimeString(),
                cls: "task-chat-message-time",
            });

            // Create content div for streaming text
            this.streamingMessageEl = this.streamingWrapperEl.createDiv({
                cls: "task-chat-message-content task-chat-streaming",
            });
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        } else {
            this.showTypingIndicator();
        }

        // Save settings in background (non-blocking)
        this.plugin
            .saveSettings()
            .catch((err) => Logger.error("Failed to save settings:", err));

        try {
            // Apply chat mode override if user selected different mode
            const effectiveSettings = { ...this.plugin.settings };
            if (this.chatModeOverride !== null) {
                effectiveSettings.defaultChatMode = this.chatModeOverride;
                Logger.debug(
                    `Using overridden chat mode: ${this.chatModeOverride}`,
                );
            }

            // Create streaming callback
            let streamedContent = "";
            const onStream = useStreaming
                ? (chunk: string) => {
                      streamedContent += chunk;
                      if (this.streamingMessageEl) {
                          this.streamingMessageEl.empty();
                          // Remove streaming class before rendering to avoid dots overlapping content
                          this.streamingMessageEl.removeClass(
                              "task-chat-streaming",
                          );
                          void MarkdownRenderer.renderMarkdown(
                              streamedContent,
                              this.streamingMessageEl,
                              "",
                              this.plugin,
                          );
                          // Re-add streaming class for dots animation
                          this.streamingMessageEl.addClass(
                              "task-chat-streaming",
                          );
                          // Auto-scroll to bottom
                          this.messagesEl.scrollTop =
                              this.messagesEl.scrollHeight;
                      }
                  }
                : undefined;

            // Get AI response or direct results
            // Clean warnings from history before sending to AI (warnings stay in UI)
            const cleanedHistory = this.cleanWarningsFromHistory(
                this.plugin.sessionManager.getCurrentMessages(),
            );

            // OPTIMIZATION: Don't pre-load tasks!
            // AIService will query API directly with complete filter set
            // This ensures we only load tasks that match criteria (memory efficient)
            // Pass empty array - AIService will handle loading with filters
            this.currentTasks = [];

            // DEBUG: Log current filter being passed to AIService
            if (effectiveSettings.enableDebugLogging) {
                Logger.debug(
                    "[ChatView] Sending query to AIService with currentFilter:",
                    JSON.stringify(this.currentFilter, null, 2),
                );
                Logger.debug(
                    "[ChatView] Current tasks count:",
                    this.currentTasks.length,
                );
            }

            const result = await AIService.sendMessage(
                this.plugin.app,
                message,
                this.currentTasks,
                cleanedHistory, // Send cleaned history to AI
                effectiveSettings,
                this.currentFilter, // Pass current filter to preserve it
                onStream, // Pass streaming callback
                this.abortController?.signal, // Pass abort signal
            );

            // CRITICAL: Check if aborted after AI call
            // If user clicked stop, don't render any results
            if (this.abortController?.signal.aborted) {
                Logger.debug("Search was aborted, skipping result rendering");
                return; // Exit early, finally block will clean up
            }

            // Update total usage in settings
            if (result.tokenUsage) {
                const tu = result.tokenUsage;

                // Log detailed cost breakdown
                if (
                    tu.parsingCost !== undefined &&
                    tu.analysisCost !== undefined
                ) {
                    Logger.debug(
                        `[Cost Breakdown] Parsing: ${tu.parsingModel} (${tu.parsingProvider}) = $${tu.parsingCost.toFixed(6)} | ` +
                            `Analysis: ${tu.analysisModel} (${tu.analysisProvider}) = $${tu.analysisCost.toFixed(6)} | ` +
                            `Total: $${tu.estimatedCost.toFixed(6)}`,
                    );
                } else {
                    Logger.debug(
                        `[Cost Breakdown] Single model: ${tu.model} (${tu.provider}) = $${tu.estimatedCost.toFixed(6)}`,
                    );
                }

                this.plugin.settings.totalTokensUsed += tu.totalTokens;
                this.plugin.settings.totalCost += tu.estimatedCost;

                // Save settings in background (non-blocking)
                this.plugin
                    .saveSettings()
                    .catch((err) =>
                        Logger.error("Failed to save settings:", err),
                    );

                Logger.debug(
                    `[Cost Accumulation] Added $${tu.estimatedCost.toFixed(6)}, ` +
                        `New total: $${this.plugin.settings.totalCost.toFixed(6)}`,
                );
            }

            // Clean up streaming element or hide typing indicator
            if (useStreaming) {
                if (this.streamingWrapperEl) {
                    this.streamingWrapperEl.remove();
                    this.streamingWrapperEl = null;
                }
                if (this.streamingMessageEl) {
                    this.streamingMessageEl = null;
                }
            } else {
                this.hideTypingIndicator();
            }

            // Get the chat mode that was used (from override or settings)
            const usedChatMode =
                this.chatModeOverride || this.plugin.settings.defaultChatMode;

            // Handle direct results (Simple Search or Smart Search)
            if (result.directResults) {
                // Build informative message, especially for 0 results
                let content = `Found ${result.directResults.length} matching task(s):`;

                // For 0 results, check task indexing API status and add warning if needed
                if (result.directResults.length === 0) {
                    // IMPORTANT: Check if task indexing API might be the issue
                    // We use currentTasks.length (total tasks from API) NOT directResults.length
                    // If currentTasks.length > 0, API has tasks → 0 results is a SEARCH/FILTER issue, not API
                    // If currentTasks.length === 0, API has no tasks → check if it's not enabled or indexing
                    // This ensures API warnings ONLY show when it's truly an API issue
                    const taskIndexWarning =
                        TaskIndexWarningService.checkAPIStatus(
                            this.app,
                            this.plugin.settings,
                            this.currentTasks.length, // Total tasks from API
                            this.currentFilter,
                        );

                    // Only show warning if it's a critical API issue (not-enabled)
                    // "no-tasks" warnings during search are not shown here (they show in the main banner)
                    // This prevents showing API warnings for search/filter issues
                    if (
                        taskIndexWarning &&
                        taskIndexWarning.type === "not-enabled"
                    ) {
                        content = `⚠️ **${taskIndexWarning.message}**\n\n${taskIndexWarning.details || ""}\n\n`;

                        if (
                            taskIndexWarning.suggestions &&
                            taskIndexWarning.suggestions.length > 0
                        ) {
                            content += "**Troubleshooting steps:**\n";
                            taskIndexWarning.suggestions.forEach(
                                (suggestion: string, index: number) => {
                                    content += `${index + 1}. ${suggestion}\n`;
                                },
                            );
                        }

                        content += `\n---\n\nFound ${result.directResults.length} matching task(s):`;
                    }

                    // Add search details if query was parsed
                    if (result.parsedQuery) {
                        const query = result.parsedQuery;
                        const searchDetails: string[] = [];

                        // Show what was searched for
                        if (
                            query.coreKeywords &&
                            query.coreKeywords.length > 0
                        ) {
                            searchDetails.push(
                                `Keywords: ${query.coreKeywords.join(", ")}`,
                            );
                        }
                        if (query.priority) {
                            searchDetails.push(`Priority: ${query.priority}`);
                        }
                        if (query.dueDate) {
                            searchDetails.push(`Due: ${query.dueDate}`);
                        }
                        if (query.status) {
                            searchDetails.push(`Status: ${query.status}`);
                        }
                        if (query.tags && query.tags.length > 0) {
                            searchDetails.push(
                                `Tags: ${query.tags.join(", ")}`,
                            );
                        }
                        if (query.folder) {
                            searchDetails.push(`Folder: ${query.folder}`);
                        }

                        if (searchDetails.length > 0) {
                            content += `\n\n**Searched for:**\n${searchDetails.join(" | ")}`;

                            // Add expansion info if available
                            if (
                                query.expansionMetadata?.enabled &&
                                query.expansionMetadata.totalKeywords > 0
                            ) {
                                // Calculate ACTUAL per-core-per-lang from expanded (semantic) keywords
                                const meta = query.expansionMetadata;
                                const expandedOnly =
                                    meta.totalKeywords - meta.coreKeywordsCount;
                                const numLanguages =
                                    meta.languagesUsed?.length || 1;
                                const numCore = meta.coreKeywordsCount || 0;
                                const denominator =
                                    numCore > 0 ? numCore * numLanguages : 0;
                                const actualPerCoreLangValue =
                                    denominator > 0
                                        ? expandedOnly / denominator
                                        : 0;
                                const actualPerCoreLang =
                                    actualPerCoreLangValue.toFixed(1);

                                const languages =
                                    meta.languagesUsed &&
                                    meta.languagesUsed.length > 0
                                        ? meta.languagesUsed.join(", ")
                                        : "English";
                                content += `\n\n**Note:** Semantic expansion generated ${expandedOnly} semantic keywords (${actualPerCoreLang}/core/lang) from ${meta.coreKeywordsCount} core across ${languages}, but no tasks matched any of them. See details below.`;
                            }

                            // Suggest troubleshooting (only if not already shown in API warning)
                            if (
                                !taskIndexWarning ||
                                taskIndexWarning.type !== "not-enabled"
                            ) {
                                content += `\n\n**Tip:** Check the expansion details below to see what was searched. You may want to:\n- Verify the keywords are relevant to your tasks\n- Check if you have tasks in your vault matching these terms\n- Try simpler or different search terms`;
                            }
                        }
                    }
                }

                const directMessage: ChatMessage = {
                    role: usedChatMode as "simple" | "smart",
                    content: content, // Keep warnings in chat history for UI display
                    timestamp: Date.now(),
                    recommendedTasks: result.directResults,
                    tokenUsage: result.tokenUsage,
                    parsedQuery: result.parsedQuery,
                    error: result.error, // Include error info for parser failures
                };

                this.plugin.sessionManager.addMessage(
                    directMessage,
                    this.plugin.settings.maxSessions,
                );

                // Render message directly to DOM (non-blocking)
                await this.renderMessage(directMessage);
                this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

                // Save settings in background
                this.plugin
                    .saveSettings()
                    .catch((err) =>
                        Logger.error("Failed to save settings:", err),
                    );
            } else {
                // Add AI analysis response (Task Chat mode)
                const aiMessage: ChatMessage = {
                    role: "chat",
                    content: result.response, // Keep warnings in chat history for UI display
                    timestamp: Date.now(),
                    recommendedTasks: result.recommendedTasks,
                    tokenUsage: result.tokenUsage,
                    parsedQuery: result.parsedQuery,
                    error: result.error, // Include error if this is a fallback result
                };

                this.plugin.sessionManager.addMessage(
                    aiMessage,
                    this.plugin.settings.maxSessions,
                );

                // Render message directly to DOM (non-blocking)
                await this.renderMessage(aiMessage);
                this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

                // Save settings in background
                this.plugin
                    .saveSettings()
                    .catch((err) =>
                        Logger.error("Failed to save settings:", err),
                    );
            }
        } catch (error) {
            // Clean up streaming element or hide typing indicator on error
            if (useStreaming) {
                if (this.streamingWrapperEl) {
                    this.streamingWrapperEl.remove();
                    this.streamingWrapperEl = null;
                }
                if (this.streamingMessageEl) {
                    this.streamingMessageEl = null;
                }
            } else {
                this.hideTypingIndicator();
            }
            // Check if this was a user cancellation (not an actual error)
            const errorMsg =
                (error as Error)?.message || "Failed to get AI response";
            const isCancellation =
                errorMsg.includes("cancelled by user") ||
                errorMsg.includes("aborted");

            if (isCancellation) {
                // User cancelled - this is expected, no error message needed
                Logger.debug("Search cancelled by user");
                // Don't show error message or notice
                return; // Exit early, finally block will clean up
            }

            // Real error occurred
            Logger.error("Error sending message:", error);

            // Check if this is a structured AIError
            const isAIError = error instanceof AIError;

            // Show brief notice
            new Notice(errorMsg);

            // Create error message for chat history
            const errorMessage: ChatMessage = {
                role: "system",
                content: isAIError
                    ? `⚠️ ${error.structured.message}: ${error.structured.details}`
                    : `Error: ${errorMsg}`,
                timestamp: Date.now(),
                error: isAIError ? error.structured : undefined, // Attach structured error for UI display
            };

            this.plugin.sessionManager.addMessage(
                errorMessage,
                this.plugin.settings.maxSessions,
            );

            // Render error message directly to DOM (non-blocking)
            await this.renderMessage(errorMessage);
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

            // Save settings in background
            this.plugin
                .saveSettings()
                .catch((err) => Logger.error("Failed to save settings:", err));
        } finally {
            this.isProcessing = false;
            this.inputEl.disabled = false;
            this.inputEl.placeholder = "Chat with your tasks..."; // Restore original placeholder
            this.sendButtonEl.disabled = false;
            this.sendButtonEl.setText("Send");
            this.sendButtonEl.removeClass("task-chat-stop-button");
            this.abortController = null;
            this.streamingMessageEl = null;
            this.streamingWrapperEl = null;
            this.inputEl.focus();
        }
    }

    /**
     * Stop AI generation
     */
    private stopGeneration(): void {
        if (this.abortController) {
            Logger.debug("Stopping AI generation...");
            this.abortController.abort();
            this.abortController = null;
        }

        // CRITICAL: Clean up ALL visual indicators immediately
        // Remove typing indicator (non-streaming mode)
        this.hideTypingIndicator();

        // Remove streaming elements (streaming mode)
        if (this.streamingWrapperEl) {
            this.streamingWrapperEl.remove();
            this.streamingWrapperEl = null;
        }
        if (this.streamingMessageEl) {
            this.streamingMessageEl = null;
        }

        // Reset UI state
        this.isProcessing = false;
        this.inputEl.disabled = false;
        this.inputEl.placeholder = "Chat with your tasks..."; // Restore original placeholder
        this.sendButtonEl.disabled = false;
        this.sendButtonEl.setText("Send");
        this.sendButtonEl.removeClass("task-chat-stop-button");
        this.inputEl.focus();

        new Notice("AI generation stopped");
    }

    /**
     * Add a system message
     */
    async addSystemMessage(content: string): Promise<void> {
        const message: ChatMessage = {
            role: "system",
            content: content,
            timestamp: Date.now(),
        };

        this.plugin.sessionManager.addMessage(
            message,
            this.plugin.settings.maxSessions,
        );
        await this.renderMessages();
        await this.plugin.saveSettings();
    }

    /**
     * Clear chat history
     */
    private async clearChat(): Promise<void> {
        this.plugin.sessionManager.clearCurrentSession();
        await this.renderMessages();
        await this.addSystemMessage(
            "Chat cleared. How can I help you with your tasks?",
        );
        await this.plugin.saveSettings();
    }

    /**
     * Refresh task count (lightweight, 20-30x faster than full refresh!)
     */
    /**
     * Refresh task count (lightweight operation)
     * Updates count without loading full task list
     */
    private async refreshTaskCount(): Promise<void> {
        // Update task count with current filter (respects inclusions/exclusions)
        this.filteredTaskCount = await this.plugin.getFilteredTaskCount(
            this.currentFilter,
        );

        // Update display
        this.updateFilterStatus();

        // CRITICAL: Update warning banner immediately after count update
        // This ensures warning disappears when tasks are now available
        this.renderDatacoreWarning();

        // No cache invalidation needed - next query will fetch fresh data from API
        // Preserving cache improves performance for rapid repeated queries

        // Show system message about refresh
        await this.addSystemMessage(
            `Task count refreshed. Found ${this.filteredTaskCount} task${this.filteredTaskCount === 1 ? "" : "s"}.`,
        );

        new Notice("Task count refreshed");
    }

    /**
     * Open filter modal
     */
    private openFilterModal(): void {
        this.plugin.openFilterModal(
            this.currentTasks,
            this.currentFilter,
            (filter) => {
                void this.setFilter(filter);
            },
        );
    }

    /**
     * Update tasks displayed in chat
     */
    updateTasks(tasks: Task[], filter: TaskFilter = {}): void {
        this.currentTasks = tasks;
        this.currentFilter = filter;
        this.updateFilterStatus();
        this.updateFilterButtonState();
        this.renderDatacoreWarning(); // Update warning banner status
    }

    /**
     * Update task count display (lightweight)
     * Called when task count changes without needing full task list
     */
    updateTaskCount(count: number): void {
        this.filteredTaskCount = count;
        this.updateFilterStatus(); // Refresh the display with new count
    }

    /**
     * Set filter and update tasks
     */
    async setFilter(filter: TaskFilter): Promise<void> {
        // Check for conflicts between filter and exclusions
        const conflicts: string[] = [];
        const exclusions = this.plugin.settings.exclusions;

        if (exclusions) {
            // Check folder conflicts
            if (
                filter.folders &&
                filter.folders.length > 0 &&
                exclusions.folders &&
                exclusions.folders.length > 0
            ) {
                const conflictingFolders = filter.folders.filter((folder) =>
                    exclusions.folders!.some(
                        (excluded) =>
                            folder.startsWith(excluded) ||
                            excluded.startsWith(folder),
                    ),
                );
                if (conflictingFolders.length > 0) {
                    conflicts.push(
                        `Folders: ${conflictingFolders.join(", ")} (already excluded in settings)`,
                    );
                }
            }

            // Check note tag conflicts
            if (
                filter.noteTags &&
                filter.noteTags.length > 0 &&
                exclusions.noteTags &&
                exclusions.noteTags.length > 0
            ) {
                const conflictingNoteTags = filter.noteTags.filter((tag) => {
                    const normalizedTag = tag.replace(/^#+/, "").toLowerCase();
                    return exclusions.noteTags!.some(
                        (excluded) =>
                            excluded.replace(/^#+/, "").toLowerCase() ===
                            normalizedTag,
                    );
                });
                if (conflictingNoteTags.length > 0) {
                    conflicts.push(
                        `Note tags: ${conflictingNoteTags.join(", ")} (already excluded in settings)`,
                    );
                }
            }

            // Check task tag conflicts
            if (
                filter.taskTags &&
                filter.taskTags.length > 0 &&
                exclusions.taskTags &&
                exclusions.taskTags.length > 0
            ) {
                const conflictingTaskTags = filter.taskTags.filter((tag) => {
                    const normalizedTag = tag.replace(/^#+/, "").toLowerCase();
                    return exclusions.taskTags!.some(
                        (excluded) =>
                            excluded.replace(/^#+/, "").toLowerCase() ===
                            normalizedTag,
                    );
                });
                if (conflictingTaskTags.length > 0) {
                    conflicts.push(
                        `Task tags: ${conflictingTaskTags.join(", ")} (already excluded in settings)`,
                    );
                }
            }

            // Check note conflicts
            if (
                filter.notes &&
                filter.notes.length > 0 &&
                exclusions.notes &&
                exclusions.notes.length > 0
            ) {
                const conflictingNotes = filter.notes.filter((note) =>
                    exclusions.notes!.includes(note),
                );
                if (conflictingNotes.length > 0) {
                    conflicts.push(
                        `Notes: ${conflictingNotes.map((n) => n.split("/").pop()).join(", ")} (already excluded in settings)`,
                    );
                }
            }
        }

        // Show warning if conflicts detected
        if (conflicts.length > 0) {
            const warningMessage = `⚠️ Filter-Exclusion Conflict:\n${conflicts.join("\n")}\n\nThese items are excluded in settings and won't appear in results. To include them, remove them from exclusions in the settings tab.`;
            new Notice(warningMessage, 8000);
            await this.addSystemMessage(
                `Warning: Some filtered items are also excluded in settings. They won't appear in results. Check exclusions in settings tab.`,
            );
        }

        this.currentFilter = filter;

        // Update task count with new filter (respects inclusions/exclusions)
        // Skip count update if Datacore is still indexing to avoid performance issues
        if (TaskIndexService.isAPIReady()) {
            const startTime = Date.now();
            Logger.info(
                "[Filter Apply] Starting task count update with filter:",
                filter,
            );

            this.filteredTaskCount =
                await this.plugin.getFilteredTaskCount(filter);

            const elapsed = Date.now() - startTime;
            Logger.info(
                `[Filter Apply] Task count update completed: ${this.filteredTaskCount} tasks (${elapsed}ms)`,
            );

            if (elapsed > 2000) {
                Logger.warn(
                    `[Filter Apply] SLOW OPERATION: Task count took ${elapsed}ms (>2s). Check console for detailed timing.`,
                );
            }
        } else {
            // Datacore is still indexing, defer count update
            Logger.debug(
                "Filter applied but Datacore is indexing. Deferring count update.",
            );
            this.filteredTaskCount = 0;
        }

        // Clear cached tasks so they're reloaded with new filter on next query
        this.currentTasks = [];

        // Update UI
        this.updateFilterStatus();
        this.updateFilterButtonState();

        // PERSIST: Save filter to settings so it survives Obsidian restarts
        // This provides better UX - users don't lose their filter configuration
        this.plugin.settings.currentFilter = { ...filter };
        await this.plugin.saveSettings();
        Logger.debug("Filter persisted to settings:", filter);

        // Determine if filters are being applied or cleared
        const hasFilters =
            (filter.folders && filter.folders.length > 0) ||
            (filter.noteTags && filter.noteTags.length > 0) ||
            (filter.taskTags && filter.taskTags.length > 0) ||
            (filter.notes && filter.notes.length > 0) ||
            (filter.priorities && filter.priorities.length > 0) ||
            (filter.taskStatuses && filter.taskStatuses.length > 0) ||
            filter.dueDateRange;

        // Show appropriate message based on indexing status
        if (!TaskIndexService.isAPIReady()) {
            await this.addSystemMessage(
                hasFilters
                    ? "Filter applied. Task count will update after Datacore finishes indexing."
                    : "Filter cleared. Task count will update after Datacore finishes indexing.",
            );
        } else if (hasFilters) {
            await this.addSystemMessage(
                `Filter applied. Found ${this.filteredTaskCount} task${this.filteredTaskCount === 1 ? "" : "s"}.`,
            );
        } else {
            // Filter was cleared
            await this.addSystemMessage(
                `Filter cleared. Found ${this.filteredTaskCount} task${this.filteredTaskCount === 1 ? "" : "s"}.`,
            );
        }
    }

    /**
     * Create a new session
     */
    private async createNewSession(): Promise<void> {
        // Check if current session is empty (only has welcome message)
        const currentMessages = this.plugin.sessionManager.getCurrentMessages();
        const isEmptySession =
            currentMessages.length <= 1 &&
            currentMessages.every((msg) => msg.role === "system");

        if (isEmptySession) {
            // Reuse current session instead of creating new one
            new Notice("Current session is empty, continuing in this session");
            return;
        }

        // Create new session only if current has actual conversation
        const newSession = this.plugin.sessionManager.createSession(
            undefined,
            this.plugin.settings.maxSessions,
        );

        // Reset chat mode to default for new session
        this.chatModeOverride = null;
        this.plugin.settings.currentChatMode =
            this.plugin.settings.defaultChatMode;
        await this.plugin.saveSettings();

        // Update dropdown to reflect default mode
        this.updateChatModeOptions();

        await this.renderMessages();
        await this.addSystemMessage(
            `New session created: ${newSession.name}. How can I help you?`,
        );

        Logger.debug(
            `New session created, chat mode reset to default: ${this.plugin.settings.defaultChatMode}`,
        );
    }

    /**
     * Open the session management modal
     */
    openSessionModal(): void {
        const modal = new SessionModal(
            this.app,
            this.plugin,
            (sessionId: string) => {
                void (async () => {
                    this.plugin.sessionManager.switchSession(sessionId);
                    await this.renderMessages();
                    await this.plugin.saveSettings();
                })();
            },
        );
        modal.open();
    }

    /**
     * Enable Obsidian's native hover preview for internal links
     * This works with both the core Page Preview plugin and third-party plugins like Hover Editor
     * @param containerEl - The container element containing rendered links
     * @param sourcePath - The source file path for link resolution context
     */
    private enableHoverPreview(
        containerEl: HTMLElement,
        sourcePath: string,
    ): void {
        // Find all internal links (not tags or external links)
        const internalLinks = containerEl.querySelectorAll("a.internal-link");

        internalLinks.forEach((link) => {
            const linkEl = link as HTMLAnchorElement;

            // Add mouseover event listener to trigger Obsidian's hover preview
            linkEl.addEventListener("mouseover", (event: MouseEvent) => {
                // Get the link target from data-href attribute (preferred) or href
                const linktext =
                    linkEl.getAttribute("data-href") ||
                    linkEl.getAttribute("href") ||
                    "";

                // Trigger Obsidian's native hover-link event
                // This enables integration with Page Preview (Cmd/Ctrl+hover) and Hover Editor plugins
                this.app.workspace.trigger("hover-link", {
                    event,
                    source: CHAT_VIEW_TYPE,
                    hoverParent: this,
                    targetEl: linkEl,
                    linktext: linktext,
                    sourcePath: sourcePath,
                });
            });
        });
    }

    /**
     * Update token counter based on current input
     * Shows: "X tokens" where X is estimated input tokens
     */
    private updateTokenCounter(): void {
        if (!this.tokenEstimateEl) return;

        const text = this.inputEl.value;

        // Estimate tokens (roughly 4 characters per token for English, less for CJK)
        // This is a rough estimate - actual tokenization is more complex
        const estimatedTokens = Math.ceil(text.length / 3.5);

        // Update display - show only input token count
        this.tokenEstimateEl.setText(
            `${estimatedTokens} token${estimatedTokens === 1 ? "" : "s"}`,
        );

        // Add warning class if approaching limit (80% of max)
        const providerConfig = getCurrentProviderConfig(this.plugin.settings);
        const maxTokens = providerConfig.maxTokens;
        if (estimatedTokens > maxTokens * 0.8) {
            this.tokenEstimateEl.addClass("task-chat-token-warning");
        } else {
            this.tokenEstimateEl.removeClass("task-chat-token-warning");
        }
    }
}
