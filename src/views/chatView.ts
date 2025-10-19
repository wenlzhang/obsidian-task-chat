import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from "obsidian";
import { Task, ChatMessage, TaskFilter } from "../models/task";
import { AIService } from "../services/aiService";
import { NavigationService } from "../services/navigationService";
import { DataviewService } from "../services/dataviewService";
import { SessionModal } from "./sessionModal";
import TaskChatPlugin from "../main";

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
        this.renderMessages();
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

        // DataView warning banner (persistent)
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

            console.log(`[Task Chat] Chat mode changed to: ${value}`);
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
        this.renderMessages();

        // Input area
        const inputContainerEl = this.contentEl.createDiv(
            "task-chat-input-container",
        );

        this.inputEl = inputContainerEl.createEl("textarea", {
            placeholder: "Ask about your tasks...",
            attr: {
                rows: "3",
            },
        });

        this.inputEl.addEventListener("keydown", (e) => {
            // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) sends message
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendButtonEl = inputContainerEl.createEl("button", {
            text: "Send (Cmd/Ctrl+Enter)",
        });

        this.sendButtonEl.addEventListener("click", () => this.sendMessage());

        // Initial welcome message
        const messages = this.plugin.sessionManager.getCurrentMessages();
        if (messages.length === 0) {
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

        console.log(`[Task Chat] Chat mode dropdown updated: ${currentMode}`);
    }

    /**
     * Render DataView status banner with helpful information
     * Shows different messages based on DataView state:
     * - Not installed/enabled: Installation instructions
     * - Enabled but 0 tasks: Indexing status and troubleshooting tips
     */
    private renderDataviewWarning(): void {
        const isDataviewEnabled = DataviewService.isDataviewEnabled(this.app);
        const taskCount = this.currentTasks.length;

        // Case 1: DataView is enabled and has tasks - no warning needed
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

        // Case 2: DataView is not enabled
        if (!isDataviewEnabled) {
            const warningIcon = this.dataviewWarningEl.createSpan({
                cls: "task-chat-warning-icon",
                text: "⚠️ ",
            });

            const warningText = this.dataviewWarningEl.createSpan({
                cls: "task-chat-warning-text",
            });

            warningText.createEl("strong", {
                text: "DataView plugin required: ",
            });

            warningText.appendText(
                "This plugin requires the DataView plugin to function. Please install and enable it from the Community Plugins settings, then click Refresh tasks.",
            );
            return;
        }

        // Case 3: DataView is enabled but 0 tasks found
        // This could mean indexing is in progress or delay is too long
        const infoIcon = this.dataviewWarningEl.createSpan({
            cls: "task-chat-info-icon",
            text: "ℹ️ ",
        });

        const infoText = this.dataviewWarningEl.createSpan({
            cls: "task-chat-info-text",
        });

        infoText.createEl("strong", {
            text: "DataView is enabled but no tasks found: ",
        });

        infoText.appendText(
            "If you have tasks in your vault, this usually means DataView is still indexing your files or the index delay is too long. ",
        );

        infoText.createEl("br");
        infoText.createEl("br");

        infoText.appendText("📋 Troubleshooting steps:");
        infoText.createEl("br");
        infoText.appendText(
            "1️⃣ Wait 10-30 seconds for DataView to finish indexing",
        );
        infoText.createEl("br");
        infoText.appendText(
            "2️⃣ Check DataView settings → Reduce 'Index delay' (default: 2000ms, try: 500ms)",
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
    private renderMessages(): void {
        this.messagesEl.empty();

        const messages = this.plugin.sessionManager.getCurrentMessages();
        messages.forEach((message: ChatMessage) => {
            this.renderMessage(message);
        });

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
     * Render a single message
     */
    private renderMessage(message: ChatMessage): void {
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

        // Simple markdown rendering for bold and code
        let html = message.content;
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/`(.*?)`/g, "<code>$1</code>");
        html = html.replace(/\n/g, "<br>");

        contentEl.innerHTML = html;

        // Recommended tasks
        if (message.recommendedTasks && message.recommendedTasks.length > 0) {
            const tasksEl = messageEl.createDiv("task-chat-recommended-tasks");
            tasksEl.createEl("strong", { text: "Recommended tasks:" });

            const taskListEl = tasksEl.createDiv("task-chat-task-list");

            message.recommendedTasks.forEach((task, index) => {
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
                const taskMarkdown = `- [${task.status}] ${task.text}`;
                MarkdownRenderer.renderMarkdown(
                    taskMarkdown,
                    taskContentEl,
                    "",
                    this,
                );

                const navBtn = taskItemEl.createEl("button", {
                    text: "→",
                    cls: "task-chat-nav-button",
                });

                navBtn.addEventListener("click", () => {
                    NavigationService.navigateToTask(this.app, task);
                });
            });
        }

        // Token usage display
        if (message.tokenUsage && this.plugin.settings.showTokenUsage) {
            const usageEl = messageEl.createDiv("task-chat-token-usage");

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
            const hasAIAnalysis = message.tokenUsage.totalTokens > 0;

            // Show model and token details when AI was used (parsing or analysis)
            if (hasAIAnalysis) {
                // Show provider and model for non-Ollama services
                if (message.tokenUsage.provider !== "ollama") {
                    const providerName =
                        message.tokenUsage.provider === "openai"
                            ? "OpenAI"
                            : message.tokenUsage.provider === "anthropic"
                              ? "Anthropic"
                              : "OpenRouter";
                    parts.push(`${providerName} ${message.tokenUsage.model}`);
                } else {
                    parts.push(`Model: ${message.tokenUsage.model}`);
                }

                // Token count with details
                const tokenStr = message.tokenUsage.isEstimated ? "~" : "";
                parts.push(
                    `${tokenStr}${message.tokenUsage.totalTokens.toLocaleString()} tokens (${message.tokenUsage.promptTokens.toLocaleString()} in, ${message.tokenUsage.completionTokens.toLocaleString()} out)`,
                );
            }

            // Cost information
            if (message.tokenUsage.provider === "ollama") {
                parts.push("Free (local)");
            } else if (isSimpleSearch) {
                parts.push("$0");
            } else if (message.tokenUsage.estimatedCost > 0) {
                const cost = message.tokenUsage.estimatedCost;
                if (cost < 0.01) {
                    parts.push(`~$${cost.toFixed(4)}`);
                } else {
                    parts.push(`~$${cost.toFixed(2)}`);
                }
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
     * Send a message to AI
     */
    private async sendMessage(): Promise<void> {
        const message = this.inputEl.value.trim();

        if (!message || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.inputEl.value = "";
        this.inputEl.disabled = true;
        this.sendButtonEl.disabled = true;

        // Add user message
        const userMessage: ChatMessage = {
            role: "user",
            content: message,
            timestamp: Date.now(),
        };

        this.plugin.sessionManager.addMessage(userMessage);
        this.renderMessages();
        await this.plugin.saveSettings();

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Apply chat mode override if user selected different mode
            const effectiveSettings = { ...this.plugin.settings };
            if (this.chatModeOverride !== null) {
                effectiveSettings.defaultChatMode = this.chatModeOverride;
                console.log(
                    `[Task Chat] Using overridden chat mode: ${this.chatModeOverride}`,
                );
            }

            // Get AI response or direct results
            const result = await AIService.sendMessage(
                this.plugin.app,
                message,
                this.currentTasks,
                this.plugin.sessionManager.getCurrentMessages(),
                effectiveSettings,
            );

            // Update total usage in settings
            if (result.tokenUsage) {
                this.plugin.settings.totalTokensUsed +=
                    result.tokenUsage.totalTokens;
                this.plugin.settings.totalCost +=
                    result.tokenUsage.estimatedCost;
                await this.plugin.saveSettings();
            }

            // Hide typing indicator
            this.hideTypingIndicator();

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
                };

                this.plugin.sessionManager.addMessage(directMessage);
                this.renderMessages();
                await this.plugin.saveSettings();
            } else {
                // Add AI analysis response (Task Chat mode)
                const aiMessage: ChatMessage = {
                    role: "chat",
                    content: result.response,
                    timestamp: Date.now(),
                    recommendedTasks: result.recommendedTasks,
                    tokenUsage: result.tokenUsage,
                };

                this.plugin.sessionManager.addMessage(aiMessage);
                this.renderMessages();
                await this.plugin.saveSettings();
            }
        } catch (error) {
            // Hide typing indicator on error
            this.hideTypingIndicator();
            console.error("Error sending message:", error);
            new Notice(error.message || "Failed to get AI response");

            const errorMessage: ChatMessage = {
                role: "system",
                content: `Error: ${error.message || "Failed to get AI response"}`,
                timestamp: Date.now(),
            };

            this.plugin.sessionManager.addMessage(errorMessage);
            this.renderMessages();
            await this.plugin.saveSettings();
        } finally {
            this.isProcessing = false;
            this.inputEl.disabled = false;
            this.sendButtonEl.disabled = false;
            this.inputEl.focus();
        }
    }

    /**
     * Add a system message
     */
    addSystemMessage(content: string): void {
        const message: ChatMessage = {
            role: "system",
            content: content,
            timestamp: Date.now(),
        };

        this.plugin.sessionManager.addMessage(message);
        this.renderMessages();
        this.plugin.saveSettings();
    }

    /**
     * Clear chat history
     */
    private clearChat(): void {
        this.plugin.sessionManager.clearCurrentSession();
        this.renderMessages();
        this.addSystemMessage(
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
    setFilter(filter: TaskFilter): void {
        this.currentFilter = filter;
        const filteredTasks = this.plugin.getFilteredTasks(filter);
        this.updateTasks(filteredTasks, filter);

        this.addSystemMessage(
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

        this.renderMessages();
        this.addSystemMessage(
            `New session created: ${newSession.name}. How can I help you?`,
        );

        console.log(
            `[Task Chat] New session created, chat mode reset to default: ${this.plugin.settings.defaultChatMode}`,
        );
    }

    /**
     * Open session list modal
     */
    private openSessionModal(): void {
        const modal = new SessionModal(
            this.app,
            this.plugin,
            (sessionId: string) => {
                this.plugin.sessionManager.switchSession(sessionId);
                this.renderMessages();
                this.plugin.saveSettings();
            },
        );
        modal.open();
    }
}
