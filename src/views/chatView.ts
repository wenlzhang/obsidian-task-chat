import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from "obsidian";
import { Task, ChatMessage, TaskFilter } from "../models/task";
import { AIService } from "../services/aiService";
import { NavigationService } from "../services/navigationService";
import { DataviewService } from "../services/dataviewService";
import { SessionModal } from "./sessionModal";
import { getCurrentProviderConfig } from "../settings";
import TaskChatPlugin from "../main";
import { Logger } from "../utils/logger";

export const CHAT_VIEW_TYPE = "task-chat-view";

export class ChatView extends ItemView {
    private plugin: TaskChatPlugin;
    private currentTasks: Task[] = [];
    private currentFilter: TaskFilter = {};
    private messagesEl: HTMLElement;
    private inputEl: HTMLTextAreaElement;
    private sendButtonEl: HTMLButtonElement;
    private filterStatusEl: HTMLElement;
    private dataviewWarningEl: HTMLElement | null = null;
    private isProcessing: boolean = false;
    private typingIndicator: HTMLElement | null = null;
    private chatModeSelect: HTMLSelectElement | null = null;
    private chatModeOverride: "simple" | "smart" | "chat" | null = null; // null = use setting, otherwise override
    private abortController: AbortController | null = null; // For canceling AI requests
    private streamingMessageEl: HTMLElement | null = null; // Current streaming message element
    private providerSelectEl: HTMLSelectElement | null = null; // Provider dropdown
    private modelSelectEl: HTMLSelectElement | null = null; // Model dropdown
    private tokenEstimateEl: HTMLElement | null = null; // Token estimate display

    constructor(leaf: WorkspaceLeaf, plugin: TaskChatPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return CHAT_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Task Chat";
    }

    getIcon(): string {
        return "messages-square";
    }

    async onOpen(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass("task-chat-container");

        // Load last session or create new
        const session = this.plugin.sessionManager.getOrCreateCurrentSession();

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

        this.renderView();
        await this.renderMessages();
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }

    /**
     * Render the chat view
     */
    private renderView(): void {
        this.contentEl.empty();

        // Header
        const headerEl = this.contentEl.createDiv("task-chat-header");
        headerEl.createEl("h4", { text: "Task Chat" });

        // Filter status
        this.filterStatusEl = this.contentEl.createDiv(
            "task-chat-filter-status",
        );
        this.updateFilterStatus();

        // Dataview warning banner (persistent)
        this.renderDataviewWarning();

        // Button controls - grouped logically
        const controlsEl = this.contentEl.createDiv("task-chat-controls");

        // Group 1: Session management
        const sessionGroup = controlsEl.createDiv("task-chat-button-group");

        const newSessionBtn = sessionGroup.createEl("button", {
            text: "New",
            cls: "task-chat-new-session-btn",
        });
        newSessionBtn.addEventListener("click", () => this.createNewSession());

        const clearBtn = sessionGroup.createEl("button", { text: "Clear" });
        clearBtn.addEventListener("click", () => this.clearChat());

        const sessionsBtn = sessionGroup.createEl("button", {
            text: "Sessions",
        });
        sessionsBtn.addEventListener("click", () => this.openSessionModal());

        // Group 2: Chat mode (compact dropdown only)
        const chatModeGroup = controlsEl.createDiv("task-chat-button-group");
        const chatModeContainer = chatModeGroup.createDiv(
            "task-chat-chat-mode",
        );

        // Just the dropdown with an icon prefix
        chatModeContainer.createSpan({
            text: "💬",
            cls: "task-chat-chat-mode-icon",
        });

        this.chatModeSelect = chatModeContainer.createEl("select", {
            cls: "task-chat-chat-mode-select",
        });

        // Populate options
        this.updateChatModeOptions();

        this.chatModeSelect.addEventListener("change", async () => {
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
        });

        // Group 3: Task management
        const taskGroup = controlsEl.createDiv("task-chat-button-group");

        const filterBtn = taskGroup.createEl("button", {
            text: "Filter",
        });
        filterBtn.addEventListener("click", () => this.openFilterModal());

        const refreshBtn = taskGroup.createEl("button", {
            text: "Refresh",
        });
        refreshBtn.addEventListener("click", () => this.refreshTasks());

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
            placeholder: "Ask about your tasks...",
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

        // Control bar (provider + model dropdowns + send button on one line)
        const toolbarEl = inputContainerEl.createDiv("task-chat-input-toolbar");

        // Provider selector
        const providerContainer = toolbarEl.createDiv(
            "task-chat-provider-selector",
        );
        providerContainer.createSpan({
            text: "🤖",
            cls: "task-chat-provider-icon",
        });

        const providerSelect = providerContainer.createEl("select", {
            cls: "task-chat-provider-dropdown",
        });
        providerSelect.createEl("option", {
            value: "openai",
            text: "OpenAI",
        });
        providerSelect.createEl("option", {
            value: "anthropic",
            text: "Anthropic",
        });
        providerSelect.createEl("option", {
            value: "openrouter",
            text: "OpenRouter",
        });
        providerSelect.createEl("option", {
            value: "ollama",
            text: "Ollama",
        });
        providerSelect.value = this.plugin.settings.aiProvider;

        providerSelect.addEventListener("change", async () => {
            this.plugin.settings.aiProvider = providerSelect.value as any;
            await this.plugin.saveSettings();
            this.updateModelSelector();
        });

        // Model selector
        const modelContainer = toolbarEl.createDiv("task-chat-model-selector");
        const modelSelect = modelContainer.createEl("select", {
            cls: "task-chat-model-dropdown",
        });

        // Store reference for updates
        this.providerSelectEl = providerSelect;
        this.modelSelectEl = modelSelect;

        // Initialize model selector
        this.updateModelSelector();

        modelSelect.addEventListener("change", async () => {
            const providerConfig =
                this.plugin.settings.providerConfigs[
                    this.plugin.settings.aiProvider
                ];
            providerConfig.model = modelSelect.value;
            await this.plugin.saveSettings();
        });

        // Send button (on same line as provider/model)
        this.sendButtonEl = toolbarEl.createEl("button", {
            text: "Send",
            cls: "task-chat-send-button",
        });

        this.sendButtonEl.addEventListener("click", () => {
            if (this.isProcessing) {
                this.stopGeneration();
            } else {
                this.sendMessage();
            }
        });

        // Initial welcome message
        const messages = this.plugin.sessionManager.getCurrentMessages();
        if (messages.length === 0) {
            // Note: addSystemMessage is async but we don't await here as it's called from constructor
            // Message will render asynchronously
            this.addSystemMessage(
                "Welcome to Task Chat! I can help you manage and analyze your tasks. Ask me anything about your tasks, and I'll provide recommendations.",
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
            this.currentFilter.text ||
            (this.currentFilter.folders &&
                this.currentFilter.folders.length > 0) ||
            (this.currentFilter.priorities &&
                this.currentFilter.priorities.length > 0) ||
            this.currentFilter.dueDateRange ||
            (this.currentFilter.completionStatus &&
                this.currentFilter.completionStatus !== "all");

        if (hasFilters) {
            this.filterStatusEl.createEl("strong", {
                text: "Active filters: ",
            });

            const filterParts: string[] = [];

            if (this.currentFilter.text) {
                filterParts.push(`Text: "${this.currentFilter.text}"`);
            }

            if (
                this.currentFilter.folders &&
                this.currentFilter.folders.length > 0
            ) {
                filterParts.push(
                    `Folders: ${this.currentFilter.folders.join(", ")}`,
                );
            }

            if (
                this.currentFilter.priorities &&
                this.currentFilter.priorities.length > 0
            ) {
                filterParts.push(
                    `Priorities: ${this.currentFilter.priorities.join(", ")}`,
                );
            }

            if (
                this.currentFilter.completionStatus &&
                this.currentFilter.completionStatus !== "all"
            ) {
                filterParts.push(
                    `Status: ${this.currentFilter.completionStatus}`,
                );
            }

            this.filterStatusEl.createSpan({ text: filterParts.join(" | ") });
        } else {
            this.filterStatusEl.createSpan({
                text: `Showing all tasks (${this.currentTasks.length})`,
            });
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
     * Update chat mode dropdown options - always shows all three modes
     * Public method so it can be called when settings change
     */
    public updateChatModeOptions(): void {
        if (!this.chatModeSelect) return;

        this.chatModeSelect.empty();

        // Create all three mode options
        this.chatModeSelect.createEl("option", {
            value: "simple",
            text: "Simple Search",
        });
        this.chatModeSelect.createEl("option", {
            value: "smart",
            text: "Smart Search",
        });
        this.chatModeSelect.createEl("option", {
            value: "chat",
            text: "Task Chat",
        });

        // Set to current setting (or override if one exists)
        const currentMode =
            this.chatModeOverride || this.plugin.settings.defaultChatMode;
        this.chatModeSelect.value = currentMode;

        Logger.debug(`Chat mode dropdown updated: ${currentMode}`);
    }

    /**
     * Render Dataview status banner with helpful information
     * Shows different messages based on Dataview state:
     * - Not installed/enabled: Installation instructions
     * - Enabled but 0 tasks: Indexing status and troubleshooting tips
     */
    private renderDataviewWarning(): void {
        const isDataviewEnabled = DataviewService.isDataviewEnabled(this.app);
        const taskCount = this.currentTasks.length;

        // Case 1: Dataview is enabled and has tasks - no warning needed
        if (isDataviewEnabled && taskCount > 0) {
            if (this.dataviewWarningEl) {
                this.dataviewWarningEl.remove();
                this.dataviewWarningEl = null;
            }
            return;
        }

        // Create or update warning banner
        if (!this.dataviewWarningEl) {
            this.dataviewWarningEl = this.contentEl.createDiv(
                "task-chat-dataview-warning",
            );
        } else {
            this.dataviewWarningEl.empty();
        }

        // Case 2: Dataview is not enabled
        if (!isDataviewEnabled) {
            const warningIcon = this.dataviewWarningEl.createSpan({
                cls: "task-chat-warning-icon",
                text: "⚠️ ",
            });

            const warningText = this.dataviewWarningEl.createSpan({
                cls: "task-chat-warning-text",
            });

            warningText.createEl("strong", {
                text: "Dataview plugin required: ",
            });

            warningText.appendText(
                "This plugin requires the Dataview plugin to function. Please install and enable it from the Community Plugins settings, then click Refresh tasks.",
            );
            return;
        }

        // Case 3: Dataview is enabled but 0 tasks found
        // This could mean indexing is in progress or delay is too long
        const infoIcon = this.dataviewWarningEl.createSpan({
            cls: "task-chat-info-icon",
            text: "ℹ️ ",
        });

        const infoText = this.dataviewWarningEl.createSpan({
            cls: "task-chat-info-text",
        });

        infoText.createEl("strong", {
            text: "Dataview is enabled but no tasks found: ",
        });

        infoText.appendText(
            "If you have tasks in your vault, this usually means Dataview is still indexing your files or the index delay is too long. ",
        );

        infoText.createEl("br");
        infoText.createEl("br");

        infoText.appendText("📋 Troubleshooting steps:");
        infoText.createEl("br");
        infoText.appendText(
            "1️⃣ Wait 10-30 seconds for Dataview to finish indexing",
        );
        infoText.createEl("br");
        infoText.appendText(
            "2️⃣ Check Dataview settings → Reduce 'Index delay' (default: 2000ms, try: 500ms)",
        );
        infoText.createEl("br");
        infoText.appendText("3️⃣ Click the Refresh tasks button above");
        infoText.createEl("br");
        infoText.appendText(
            "4️⃣ Verify tasks exist in your vault with proper syntax (e.g., - [ ] Task)",
        );
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
        if (
            !message.parsedQuery ||
            !this.plugin.settings.aiEnhancement.showAIUnderstanding
        ) {
            return null;
        }

        const ai = message.parsedQuery.aiUnderstanding;
        const parts: string[] = [];

        // Don't show mode here - it's already shown in token usage section

        // Language (only if not English)
        // AI now returns full language name directly (e.g., "Chinese", "Swedish")
        if (
            ai?.detectedLanguage &&
            ai.detectedLanguage !== "en" &&
            ai.detectedLanguage !== "English"
        ) {
            parts.push(`Lang: ${ai.detectedLanguage}`);
        }

        // Typo corrections (if any)
        if (ai?.correctedTypos && ai.correctedTypos.length > 0) {
            parts.push(`✏️ ${ai.correctedTypos.length} typo(s)`);
        }

        // Confidence (only if low/medium)
        if (ai?.confidence !== undefined) {
            const percent = Math.round(ai.confidence * 100);
            if (percent < 70) {
                const emoji = percent < 50 ? "⚠️" : "📊";
                parts.push(`${emoji} ${percent}%`);
            }
        }

        return parts.length > 0 ? parts.join(" • ") : null;
    }

    /**
     * Get keyword expansion summary for display
     * Shows core keywords, expanded keywords, and expansion stats
     * Note: Keywords are already clean (deduplicated + stop words filtered) from extraction/AI
     */
    private getKeywordExpansionSummary(message: ChatMessage): string | null {
        const query = message.parsedQuery;
        if (!query) return null;

        const parts: string[] = [];

        // Core keywords (already clean from extraction/AI)
        // Simple Search: extractKeywords() already deduplicated + filtered
        // Smart Search/Task Chat: AI returns clean keywords per explicit prompt instructions
        if (query.coreKeywords && query.coreKeywords.length > 0) {
            parts.push(`🔑 Core: ${query.coreKeywords.join(", ")}`);
        }

        // Expanded keywords (if semantic expansion was used)
        // AI returns expanded keywords already deduplicated per prompt instructions
        if (
            query.expansionMetadata?.enabled &&
            query.keywords &&
            query.keywords.length > query.coreKeywords.length
        ) {
            // Find expanded-only keywords (not in core)
            // Both arrays already clean, no need to deduplicate again
            const expandedOnly = query.keywords.filter(
                (k: string) => !query.coreKeywords.includes(k),
            );
            if (expandedOnly.length > 0) {
                parts.push(`🤖 Semantic: ${expandedOnly.join(", ")}`);
            }
        }

        // Expansion stats
        if (query.expansionMetadata) {
            const meta = query.expansionMetadata;
            if (meta.enabled) {
                parts.push(
                    `📈 Expansion: ${meta.coreKeywordsCount} core → ${meta.totalKeywords} total`,
                );
            }
        }

        return parts.length > 0 ? parts.join("\n") : null;
    }

    /**
     * Render AI understanding box (deprecated - now shown in metadata line)
     * Kept for backward compatibility but does nothing
     */
    private renderAIUnderstanding(
        container: HTMLElement,
        message: ChatMessage,
    ): void {
        // AI understanding is now shown compactly in the metadata line
        // This method is kept for backward compatibility but does nothing
        return;
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
            // Fallback for legacy messages
            roleName = message.role === "assistant" ? "Task Chat" : "System";
        }
        headerEl.createEl("strong", { text: roleName });
        headerEl.createEl("span", {
            text: new Date(message.timestamp).toLocaleTimeString(),
            cls: "task-chat-message-time",
        });

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

        Logger.debug(`Message content rendered, checking for links...`);
        const messageLinks = contentEl.querySelectorAll("a");
        Logger.debug(
            `- Found ${messageLinks.length} link elements in message content`,
        );
        messageLinks.forEach((link, i) => {
            Logger.debug(
                `  Message link ${i + 1}: href="${link.getAttribute("href")}", class="${link.className}", text="${link.textContent}"`,
            );
        });

        // Add click tracking for message content
        contentEl.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            Logger.debug(`Click in message content:`, {
                tagName: target.tagName,
                className: target.className,
                textContent: target.textContent?.substring(0, 50),
                href: target.getAttribute("href"),
                dataHref: target.getAttribute("data-href"),
            });

            // Handle clicks on links
            if (target.tagName === "A") {
                e.preventDefault();
                this.handleLinkClick(target as HTMLAnchorElement, contextPath);
            }
        });

        // AI Understanding box (Phase 3: UI Feedback)
        this.renderAIUnderstanding(messageEl, message);

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

                Logger.debug(`- Rendering complete, checking for links...`);
                const links = taskContentEl.querySelectorAll("a");
                Logger.debug(`- Found ${links.length} link elements`);
                links.forEach((link, i) => {
                    Logger.debug(
                        `  Link ${i + 1}: href="${link.getAttribute("href")}", class="${link.className}", text="${link.textContent}"`,
                    );
                });

                // Add click handlers for links in task content
                taskContentEl.addEventListener("click", (e) => {
                    const target = e.target as HTMLElement;
                    Logger.debug(`Click detected in task ${taskNumber}:`, {
                        tagName: target.tagName,
                        className: target.className,
                        textContent: target.textContent,
                        href: target.getAttribute("href"),
                        dataHref: target.getAttribute("data-href"),
                    });

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
                    NavigationService.navigateToTask(this.app, task);
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
        if (message.tokenUsage && this.plugin.settings.showTokenUsage) {
            const usageEl = this.messagesEl.createDiv("task-chat-token-usage");

            const parts: string[] = [];

            // Show mode name first
            if (message.role === "simple") {
                parts.push("Mode: Simple Search");
            } else if (message.role === "smart") {
                parts.push("Mode: Smart Search");
            } else if (message.role === "chat") {
                parts.push("Mode: Task Chat");
            } else {
                // Legacy message handling
                parts.push(
                    `Mode: ${message.role === "assistant" ? "Task Chat" : "System"}`,
                );
            }

            // Determine if AI was used
            const isSimpleSearch = message.tokenUsage.model === "none";
            // Show model info if we have a model (even if token count is 0 due to streaming issues)
            const hasModelInfo =
                message.tokenUsage.model && message.tokenUsage.model !== "none";

            // Show model and token details when AI was used (parsing or analysis)
            if (hasModelInfo) {
                // Show provider and model
                if (message.tokenUsage.provider === "ollama") {
                    // Ollama: Show "Model: ollama/modelname"
                    parts.push(`Ollama: ${message.tokenUsage.model}`);
                } else {
                    // OpenAI/Anthropic/OpenRouter: Show "Provider modelname"
                    const providerName =
                        message.tokenUsage.provider === "openai"
                            ? "OpenAI"
                            : message.tokenUsage.provider === "anthropic"
                              ? "Anthropic"
                              : "OpenRouter";
                    parts.push(`${providerName}: ${message.tokenUsage.model}`);
                }

                // Token count with details (always show, even if 0)
                const tokenStr = message.tokenUsage.isEstimated ? "~" : "";
                const totalTokens = message.tokenUsage.totalTokens || 0;
                const promptTokens = message.tokenUsage.promptTokens || 0;
                const completionTokens =
                    message.tokenUsage.completionTokens || 0;
                parts.push(
                    `${tokenStr}${totalTokens.toLocaleString()} tokens (${promptTokens.toLocaleString()} in, ${completionTokens.toLocaleString()} out)`,
                );

                // Cost information (always show)
                if (message.tokenUsage.provider === "ollama") {
                    parts.push("Free (local)");
                } else {
                    // For online models, always show cost (even if $0)
                    const cost = message.tokenUsage.estimatedCost || 0;
                    if (cost === 0) {
                        parts.push("$0.00");
                    } else if (cost < 0.01) {
                        parts.push(`~$${cost.toFixed(4)}`);
                    } else {
                        parts.push(`~$${cost.toFixed(2)}`);
                    }
                }
            } else if (isSimpleSearch) {
                // Simple Search: No AI used
                parts.push("$0.00");
            }

            // Add AI understanding summary to metadata line (compact format)
            const aiSummary = this.getAIUnderstandingSummary(message);
            if (aiSummary) {
                parts.push(aiSummary);
            }

            usageEl.createEl("small", {
                text: "📊 " + parts.join(" • "),
            });

            // Add copy button to token usage line for assistant/system messages
            if (message.role !== "user") {
                this.addCopyButton(usageEl, message);
            }
        }

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

            navigator.clipboard.writeText(textToCopy);
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

        Logger.debug(`handleLinkClick called:`, {
            href,
            class: linkClass,
            sourcePath,
        });

        if (!href) {
            Logger.debug(`No href found, ignoring click`);
            return;
        }

        // Handle tags (#tag)
        if (linkClass.contains("tag")) {
            Logger.debug(`Opening tag search for: ${href}`);
            // Use Obsidian's search for tags
            (this.app as any).internalPlugins
                .getPluginById("global-search")
                .instance.openGlobalSearch(`tag:${href.replace("#", "")}`);
            return;
        }

        // Handle internal links ([[Note]])
        if (linkClass.contains("internal-link")) {
            Logger.debug(`Opening internal link: ${href}`);
            // Use Obsidian's built-in method to open links
            this.app.workspace.openLinkText(href, sourcePath, false);
            return;
        }

        // Handle external links (https://...)
        if (
            linkClass.contains("external-link") ||
            href.startsWith("http://") ||
            href.startsWith("https://")
        ) {
            Logger.debug(`Opening external link: ${href}`);
            window.open(href, "_blank");
            return;
        }

        // Fallback: try to open as internal link
        Logger.debug(`Fallback: attempting to open as internal link: ${href}`);
        this.app.workspace.openLinkText(href, sourcePath, false);
    }

    /**
     * Public method for sending message from command system
     * Called when user triggers the "Send chat message" command
     */
    public sendMessageFromCommand(): void {
        // Focus input first to ensure proper context
        this.inputEl.focus();
        // Trigger send
        this.sendMessage();
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
        this.inputEl.value = "";
        this.updateTokenCounter(); // Reset token counter to 0 after clearing input
        this.inputEl.disabled = true;
        this.sendButtonEl.disabled = false; // Keep enabled so user can click to stop
        this.sendButtonEl.setText("Stop");
        this.sendButtonEl.addClass("task-chat-stop-button");

        // Create abort controller for canceling request
        this.abortController = new AbortController();

        // Add user message
        const userMessage: ChatMessage = {
            role: "user",
            content: message,
            timestamp: Date.now(),
        };

        this.plugin.sessionManager.addMessage(userMessage);
        await this.renderMessages();
        await this.plugin.saveSettings();

        // Show typing indicator (or create streaming element if streaming enabled)
        const useStreaming = this.plugin.settings.aiEnhancement.enableStreaming;

        if (useStreaming) {
            // Create streaming message element instead of typing indicator
            const streamingWrapper = this.messagesEl.createDiv({
                cls: "task-chat-message task-chat-message-ai",
            });

            // Add header with mode name (determine from chat mode override or settings)
            const usedChatMode =
                this.chatModeOverride || this.plugin.settings.defaultChatMode;
            const headerEl = streamingWrapper.createDiv(
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
            this.streamingMessageEl = streamingWrapper.createDiv({
                cls: "task-chat-message-content task-chat-streaming",
            });
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        } else {
            this.showTypingIndicator();
        }

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
                          MarkdownRenderer.renderMarkdown(
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
            const result = await AIService.sendMessage(
                this.plugin.app,
                message,
                this.currentTasks,
                this.plugin.sessionManager.getCurrentMessages(),
                effectiveSettings,
                onStream, // Pass streaming callback
                this.abortController?.signal, // Pass abort signal
            );

            // Update total usage in settings
            if (result.tokenUsage) {
                this.plugin.settings.totalTokensUsed +=
                    result.tokenUsage.totalTokens;
                this.plugin.settings.totalCost +=
                    result.tokenUsage.estimatedCost;
                await this.plugin.saveSettings();
            }

            // Clean up streaming element or hide typing indicator
            if (useStreaming && this.streamingMessageEl) {
                this.streamingMessageEl.remove();
                this.streamingMessageEl = null;
            } else {
                this.hideTypingIndicator();
            }

            // Get the chat mode that was used (from override or settings)
            const usedChatMode =
                this.chatModeOverride || this.plugin.settings.defaultChatMode;

            // Handle direct results (Simple Search or Smart Search)
            if (result.directResults) {
                const directMessage: ChatMessage = {
                    role: usedChatMode as "simple" | "smart",
                    content: `Found ${result.directResults.length} matching task(s):`,
                    timestamp: Date.now(),
                    recommendedTasks: result.directResults,
                    tokenUsage: result.tokenUsage,
                    parsedQuery: result.parsedQuery,
                };

                this.plugin.sessionManager.addMessage(directMessage);
                await this.renderMessages();
                await this.plugin.saveSettings();
            } else {
                // Add AI analysis response (Task Chat mode)
                const aiMessage: ChatMessage = {
                    role: "chat",
                    content: result.response,
                    timestamp: Date.now(),
                    recommendedTasks: result.recommendedTasks,
                    tokenUsage: result.tokenUsage,
                    parsedQuery: result.parsedQuery,
                };

                this.plugin.sessionManager.addMessage(aiMessage);
                await this.renderMessages();
                await this.plugin.saveSettings();
            }
        } catch (error) {
            // Clean up streaming element or hide typing indicator on error
            if (useStreaming && this.streamingMessageEl) {
                this.streamingMessageEl.remove();
                this.streamingMessageEl = null;
            } else {
                this.hideTypingIndicator();
            }
            Logger.error("Error sending message:", error);
            new Notice(error.message || "Failed to get AI response");

            const errorMessage: ChatMessage = {
                role: "system",
                content: `Error: ${error.message || "Failed to get AI response"}`,
                timestamp: Date.now(),
            };

            this.plugin.sessionManager.addMessage(errorMessage);
            await this.renderMessages();
            await this.plugin.saveSettings();
        } finally {
            this.isProcessing = false;
            this.inputEl.disabled = false;
            this.sendButtonEl.disabled = false;
            this.sendButtonEl.setText("Send");
            this.sendButtonEl.removeClass("task-chat-stop-button");
            this.abortController = null;
            this.streamingMessageEl = null;
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

        // Hide typing indicator
        this.hideTypingIndicator();

        // Reset UI state
        this.isProcessing = false;
        this.inputEl.disabled = false;
        this.sendButtonEl.disabled = false;
        this.sendButtonEl.setText("Send");
        this.sendButtonEl.removeClass("task-chat-stop-button");
        this.streamingMessageEl = null;
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

        this.plugin.sessionManager.addMessage(message);
        await this.renderMessages();
        this.plugin.saveSettings();
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
        this.plugin.saveSettings();
    }

    /**
     * Refresh tasks
     */
    private async refreshTasks(): Promise<void> {
        await this.plugin.refreshTasks();
        this.updateTasks(this.plugin.getAllTasks(), this.currentFilter);
        new Notice("Tasks refreshed");
    }

    /**
     * Open filter modal
     */
    private openFilterModal(): void {
        this.plugin.openFilterModal((filter) => {
            this.setFilter(filter);
        });
    }

    /**
     * Update tasks displayed in chat
     */
    updateTasks(tasks: Task[], filter: TaskFilter = {}): void {
        this.currentTasks = tasks;
        this.currentFilter = filter;
        this.updateFilterStatus();
        this.renderDataviewWarning(); // Update warning banner status
    }

    /**
     * Set filter and update tasks
     */
    async setFilter(filter: TaskFilter): Promise<void> {
        this.currentFilter = filter;
        const filteredTasks = this.plugin.getFilteredTasks(filter);
        this.updateTasks(filteredTasks, filter);

        await this.addSystemMessage(
            `Filter applied. Now showing ${filteredTasks.length} task(s).`,
        );
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
        const newSession = this.plugin.sessionManager.createSession();

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
            async (sessionId: string) => {
                this.plugin.sessionManager.switchSession(sessionId);
                await this.renderMessages();
                this.plugin.saveSettings();
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
     * Update model selector dropdown based on current provider
     */
    private updateModelSelector(): void {
        if (!this.modelSelectEl) return;

        const provider = this.plugin.settings.aiProvider;
        const providerConfig = this.plugin.settings.providerConfigs[provider];
        const availableModels = providerConfig.availableModels;

        // Clear existing options
        this.modelSelectEl.empty();

        // Add available models
        if (availableModels && availableModels.length > 0) {
            availableModels.forEach((model) => {
                const option = this.modelSelectEl!.createEl("option", {
                    value: model,
                    text: model,
                });
            });
        } else {
            // Show loading/default message if no models cached
            this.modelSelectEl.createEl("option", {
                value: providerConfig.model,
                text: providerConfig.model || "Loading models...",
            });
        }

        // Set current model as selected
        this.modelSelectEl.value = providerConfig.model;
    }

    /**
     * Update token counter based on current input
     * Shows: "X / Y tokens" where X is estimated input tokens, Y is max tokens limit
     */
    private updateTokenCounter(): void {
        if (!this.tokenEstimateEl) return;

        const text = this.inputEl.value;
        const providerConfig = getCurrentProviderConfig(this.plugin.settings);

        // Rough token estimation: ~4 characters per token (conservative estimate)
        // This is approximate - actual tokenization varies by model
        const estimatedTokens = Math.ceil(text.length / 4);
        const maxTokens = providerConfig.maxTokens;

        // Update display with current/max format
        this.tokenEstimateEl.setText(
            `${estimatedTokens} / ${maxTokens} tokens`,
        );

        // Add warning class if approaching limit (80% of max)
        if (estimatedTokens > maxTokens * 0.8) {
            this.tokenEstimateEl.addClass("task-chat-token-warning");
        } else {
            this.tokenEstimateEl.removeClass("task-chat-token-warning");
        }
    }
}
