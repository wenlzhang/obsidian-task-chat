import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from "obsidian";
import { Task, ChatMessage, TaskFilter } from "../models/task";
import { AIService } from "../services/aiService";
import { NavigationService } from "../services/navigationService";
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
    private isProcessing: boolean = false;

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

        // Button controls - grouped logically
        const controlsEl = this.contentEl.createDiv("task-chat-controls");

        // Session group
        const sessionGroup = controlsEl.createDiv("task-chat-button-group");

        const newSessionBtn = sessionGroup.createEl("button", {
            text: "+ New",
            cls: "task-chat-new-session-btn",
        });
        newSessionBtn.addEventListener("click", () => this.createNewSession());

        const sessionsBtn = sessionGroup.createEl("button", {
            text: "Sessions",
        });
        sessionsBtn.addEventListener("click", () => this.openSessionModal());

        // Task management group
        const taskGroup = controlsEl.createDiv("task-chat-button-group");

        const filterBtn = taskGroup.createEl("button", {
            text: "Filter tasks",
        });
        filterBtn.addEventListener("click", () => this.openFilterModal());

        const refreshBtn = taskGroup.createEl("button", {
            text: "Refresh tasks",
        });
        refreshBtn.addEventListener("click", () => this.refreshTasks());

        const clearBtn = taskGroup.createEl("button", { text: "Clear chat" });
        clearBtn.addEventListener("click", () => this.clearChat());

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
     * Render a single message
     */
    private renderMessage(message: ChatMessage): void {
        const messageEl = this.messagesEl.createDiv(
            `task-chat-message task-chat-message-${message.role}`,
        );

        // Message header
        const headerEl = messageEl.createDiv("task-chat-message-header");
        const roleName =
            message.role === "user"
                ? "You"
                : message.role === "assistant"
                  ? "AI"
                  : "System";
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

            const taskListEl = tasksEl.createEl("ol");

            message.recommendedTasks.forEach((task, index) => {
                const taskItemEl = taskListEl.createEl("li");

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

            if (message.tokenUsage.totalTokens > 0) {
                parts.push(
                    `${message.tokenUsage.totalTokens.toLocaleString()} tokens`,
                );
                parts.push(
                    `(${message.tokenUsage.promptTokens.toLocaleString()} in, ${message.tokenUsage.completionTokens.toLocaleString()} out)`,
                );

                if (message.tokenUsage.estimatedCost > 0) {
                    const cost = message.tokenUsage.estimatedCost;
                    if (cost < 0.01) {
                        parts.push(`~$${cost.toFixed(4)}`);
                    } else {
                        parts.push(`~$${cost.toFixed(3)}`);
                    }
                }
            } else {
                parts.push("Direct search - no API cost");
            }

            usageEl.createEl("small", { text: parts.join(" • ") });
        }
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

        try {
            // Get AI response or direct results
            const result = await AIService.sendMessage(
                message,
                this.currentTasks,
                this.plugin.sessionManager.getCurrentMessages(),
                this.plugin.settings,
            );

            // Update total usage in settings
            if (result.tokenUsage) {
                this.plugin.settings.totalTokensUsed +=
                    result.tokenUsage.totalTokens;
                this.plugin.settings.totalCost +=
                    result.tokenUsage.estimatedCost;
                await this.plugin.saveSettings();
            }

            // Handle direct results (no AI used)
            if (result.directResults) {
                const directMessage: ChatMessage = {
                    role: "system",
                    content: `Found ${result.directResults.length} matching task(s) (no AI processing needed):`,
                    timestamp: Date.now(),
                    recommendedTasks: result.directResults,
                    tokenUsage: result.tokenUsage,
                };

                this.plugin.sessionManager.addMessage(directMessage);
                this.renderMessages();
                await this.plugin.saveSettings();
            } else {
                // Add AI response
                const aiMessage: ChatMessage = {
                    role: "assistant",
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
    private createNewSession(): void {
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
        this.renderMessages();
        this.addSystemMessage(
            `New session created: ${newSession.name}. How can I help you?`,
        );
        this.plugin.saveSettings();
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
