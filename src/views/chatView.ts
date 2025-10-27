import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from "obsidian";
import { Task, ChatMessage, TaskFilter } from "../models/task";
import { AIService } from "../services/aiService";
import { NavigationService } from "../services/navigationService";
import { DataviewService } from "../services/dataviewService";
import { SessionModal } from "./sessionModal";
import { getCurrentProviderConfig } from "../settings";
import TaskChatPlugin from "../main";
import { Logger } from "../utils/logger";
import { AIError } from "../utils/errorHandler";
import { cleanWarningsFromContent } from "../services/warningService";

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

        // Status bar
        const statusEl = this.contentEl.createDiv("task-chat-status");
        this.filterStatusEl = statusEl.createSpan({
            cls: "task-chat-filter-status",
        });
        this.updateFilterStatus();

        // DataView warning element (created but hidden by default)
        this.dataviewWarningEl = this.contentEl.createDiv(
            "task-chat-dataview-warning",
        );
        this.dataviewWarningEl.hide();

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

        // Model configuration display (below input area)
        this.renderModelPurposeConfig();

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
     * Render Model Configuration display
     * Shows current parsing and analysis models in a compact format
     */
    private renderModelPurposeConfig(): void {
        const configEl = this.contentEl.createDiv(
            "task-chat-model-purpose-config",
        );

        // Compact single-line display
        const configRow = configEl.createDiv("task-chat-model-config-compact");

        // Icon
        configRow.createSpan({
            text: "⚙️",
            cls: "task-chat-config-icon",
        });

        // Parsing model
        const parsingProvider = this.plugin.settings.parsingProvider;
        const parsingModel =
            this.plugin.settings.parsingModel ||
            this.plugin.settings.providerConfigs[parsingProvider].model;

        const parsingText = configRow.createSpan({
            cls: "task-chat-model-compact-label",
        });
        parsingText.setText(
            `Parser: ${parsingProvider}/${parsingModel.length > 15 ? parsingModel.substring(0, 12) + "..." : parsingModel}`,
        );

        // Analysis model
        const analysisProvider = this.plugin.settings.analysisProvider;
        const analysisModel =
            this.plugin.settings.analysisModel ||
            this.plugin.settings.providerConfigs[analysisProvider].model;

        const analysisText = configRow.createSpan({
            cls: "task-chat-model-compact-label",
        });
        analysisText.setText(
            `Analysis: ${analysisProvider}/${analysisModel.length > 15 ? analysisModel.substring(0, 12) + "..." : analysisModel}`,
        );

        // Settings link button
        const settingsBtn = configRow.createEl("button", {
            text: "⚙️ Settings",
            cls: "task-chat-settings-link-btn",
        });
        settingsBtn.addEventListener("click", () => {
            // @ts-ignore - app.setting exists but not in types
            this.app.setting.open();
            // @ts-ignore
            this.app.setting.openTabById("task-chat");
            new Notice("Opening Settings → Model configuration");
        });
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

                // Build expansion line with vertical bar separators (like AI Query line)
                // Show "X core → Y expansion" (not "total") since this line is about expansion
                const expansionParts: string[] = [
                    `${meta.coreKeywordsCount} core → ${expandedOnly} semantic`,
                ];

                // Add per-keyword-per-language count (shortened format) - calculated from EXPANDED only
                expansionParts.push(`${actualPerCoreLang}/core/lang`);

                // Add languages if available
                if (meta.languagesUsed && meta.languagesUsed.length > 0) {
                    expansionParts.push(meta.languagesUsed.join(", "));
                }

                parts.push(`📈 Expansion: ${expansionParts.join(" | ")}`);
            } else if (!hasResults) {
                // Expansion disabled - mention this for 0 results
                parts.push("📈 Expansion: disabled");
            }
        }

        // AI Query Understanding (compact single-line format with grouped sections)
        // Format: Due, Priority, Status | Lang | other mappings | Confidence
        // Only show if enabled and AI understanding data exists
        if (
            this.plugin.settings.aiEnhancement.showAIUnderstanding &&
            query.aiUnderstanding
        ) {
            const ai = query.aiUnderstanding;
            const groups: string[] = [];

            // Group 1: Core properties (Due, Priority, Status)
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

            // Group 3: Language
            if (ai.detectedLanguage) {
                groups.push(`Lang=${ai.detectedLanguage}`);
            }

            // Group 4: Confidence
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

        // Display structured error if present (API/parser/analysis failures)
        // Show BEFORE recommended tasks so users see the error first
        if (message.error) {
            const errorEl = messageEl.createDiv({
                cls: "task-chat-api-error",
            });

            // Make error message more specific based on error type
            let errorTitle = message.error.message;
            if (errorTitle.includes("analysis")) {
                errorTitle = "AI parser failed";
            }

            errorEl.createEl("div", {
                cls: "task-chat-api-error-header",
                text: `⚠️ ${errorTitle}`,
            });

            const detailsEl = errorEl.createDiv({
                cls: "task-chat-api-error-details",
            });

            if (message.error.model) {
                detailsEl.createEl("div", {
                    text: `Model: ${message.error.model}`,
                });
            }

            detailsEl.createEl("div", {
                text: `Error: ${message.error.details}`,
            });

            if (message.error.solution) {
                const solutionEl = detailsEl.createEl("div", {
                    cls: "task-chat-api-error-solution",
                });
                solutionEl.createEl("strong", { text: "💡 Solutions: " });

                // Split solution by newlines and create list
                const solutions = message.error.solution
                    .split("\n")
                    .filter((s: string) => s.trim());
                if (solutions.length > 1) {
                    const listEl = solutionEl.createEl("ol");
                    solutions.forEach((solution: string) => {
                        listEl.createEl("li", {
                            text: solution.replace(/^\d+\.\s*/, ""),
                        });
                    });
                } else {
                    solutionEl.createSpan({ text: message.error.solution });
                }
            }

            if (message.error.fallbackUsed) {
                const fallbackEl = detailsEl.createEl("div", {
                    cls: "task-chat-api-error-fallback",
                });
                fallbackEl.createEl("strong", { text: "✓ Fallback" });

                // Split fallback message by period for multi-line display
                const fallbackMessages = message.error.fallbackUsed
                    .split(". ")
                    .filter((s: string) => s.trim())
                    .map(
                        (s: string) => s.trim() + (s.endsWith(".") ? "" : "."),
                    );

                if (fallbackMessages.length > 1) {
                    fallbackMessages.forEach((msg: string) => {
                        fallbackEl.createEl("div", { text: msg });
                    });
                } else {
                    fallbackEl.createSpan({ text: message.error.fallbackUsed });
                }
            }

            if (message.error.docsLink) {
                const docsEl = detailsEl.createEl("div", {
                    cls: "task-chat-api-error-docs",
                });
                docsEl.createEl("strong", { text: "📖 Documentation: " });
                docsEl.createEl("a", {
                    text: "Troubleshooting Guide",
                    href: message.error.docsLink,
                });
            }
        }

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
        // Show metadata even when error occurs (use error.model as fallback)
        if (
            (message.tokenUsage || message.error) &&
            this.plugin.settings.showTokenUsage
        ) {
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

            // If error occurred without tokenUsage, show error model info
            if (!message.tokenUsage && message.error && message.error.model) {
                parts.push(`Model: ${message.error.model}`);
                parts.push("Language: Unknown");
                usageEl.createEl("small", { text: parts.join(" · ") });
                return; // Skip rest of processing since no tokenUsage
            }

            // From here, message.tokenUsage is guaranteed to exist
            if (!message.tokenUsage) {
                return; // Safety check
            }

            // Determine if AI was used
            const isSimpleSearch = message.tokenUsage.model === "none";
            // Show model info if we have a model (even if token count is 0 due to streaming issues)
            const hasModelInfo =
                message.tokenUsage.model && message.tokenUsage.model !== "none";

            // Show model and token details when AI was used (parsing or analysis)
            if (hasModelInfo) {
                // Smart model display logic
                // Simple/Smart Search: Show parsing model only
                // Task Chat: Show parsing and analysis separately if different, or once if same
                const isTaskChatMode = message.role === "chat";
                const hasParsingModel =
                    message.tokenUsage.parsingModel &&
                    message.tokenUsage.parsingProvider;
                const hasAnalysisModel =
                    message.tokenUsage.analysisModel &&
                    message.tokenUsage.analysisProvider;
                const modelsSame =
                    hasParsingModel &&
                    hasAnalysisModel &&
                    message.tokenUsage.parsingModel ===
                        message.tokenUsage.analysisModel &&
                    message.tokenUsage.parsingProvider ===
                        message.tokenUsage.analysisProvider;

                // Helper to format provider name
                const formatProvider = (
                    provider: "openai" | "anthropic" | "openrouter" | "ollama",
                ): string => {
                    if (provider === "ollama") return "Ollama";
                    if (provider === "openai") return "OpenAI";
                    if (provider === "anthropic") return "Anthropic";
                    return "OpenRouter";
                };

                // Show model info based on mode and configuration
                if (!isTaskChatMode || !hasParsingModel || modelsSame) {
                    // Simple/Smart Search OR Task Chat with same model for both
                    // For Simple/Smart: use parsing model, For Task Chat with same: use either
                    const displayModel = hasParsingModel
                        ? message.tokenUsage.parsingModel
                        : message.tokenUsage.model;
                    const displayProvider = hasParsingModel
                        ? message.tokenUsage.parsingProvider!
                        : message.tokenUsage.provider;

                    if (displayProvider === "ollama") {
                        parts.push(`Ollama: ${displayModel}`);
                    } else {
                        const providerName = formatProvider(displayProvider);
                        parts.push(`${providerName}: ${displayModel}`);
                    }
                } else {
                    // Task Chat with different models for parsing and analysis
                    // Show both models separately with concise format
                    if (hasParsingModel) {
                        const parsingProviderName = formatProvider(
                            message.tokenUsage.parsingProvider!,
                        );
                        parts.push(
                            `${parsingProviderName}: ${message.tokenUsage.parsingModel} (parser)`,
                        );
                    }
                    if (hasAnalysisModel) {
                        const analysisProviderName = formatProvider(
                            message.tokenUsage.analysisProvider!,
                        );
                        parts.push(
                            `${analysisProviderName}: ${message.tokenUsage.analysisModel} (analysis)`,
                        );
                    }
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
     * Clean warnings from chat history messages before sending to AI
     * NOTE: This creates a cleaned COPY for AI context only.
     * Original messages in chat history remain unchanged (warnings stay visible in UI).
     */
    private cleanWarningsFromHistory(messages: ChatMessage[]): ChatMessage[] {
        return messages.map((msg) => ({
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
            // Clean warnings from history before sending to AI (warnings stay in UI)
            const cleanedHistory = this.cleanWarningsFromHistory(
                this.plugin.sessionManager.getCurrentMessages(),
            );

            const result = await AIService.sendMessage(
                this.plugin.app,
                message,
                this.currentTasks,
                cleanedHistory, // Send cleaned history to AI
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
                // Build informative message, especially for 0 results
                let content = `Found ${result.directResults.length} matching task(s):`;

                // For 0 results, add helpful context about what was searched
                if (result.directResults.length === 0 && result.parsedQuery) {
                    const query = result.parsedQuery;
                    const searchDetails: string[] = [];

                    // Show what was searched for
                    if (query.coreKeywords && query.coreKeywords.length > 0) {
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
                        searchDetails.push(`Tags: ${query.tags.join(", ")}`);
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

                        // Suggest troubleshooting
                        content += `\n\n**Tip:** Check the expansion details below to see what was searched. You may want to:\n- Verify the keywords are relevant to your tasks\n- Check if you have tasks in your vault matching these terms\n- Try simpler or different search terms`;
                    }
                }

                const directMessage: ChatMessage = {
                    role: usedChatMode as "simple" | "smart",
                    content: content, // Keep warnings in chat history for UI display
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
                    content: result.response, // Keep warnings in chat history for UI display
                    timestamp: Date.now(),
                    recommendedTasks: result.recommendedTasks,
                    tokenUsage: result.tokenUsage,
                    parsedQuery: result.parsedQuery,
                    error: result.error, // Include error if this is a fallback result
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

            // Check if this is a structured AIError
            const isAIError = error instanceof AIError;
            const errorMsg = error?.message || "Failed to get AI response";

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
