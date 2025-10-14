import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { Task, ChatMessage, TaskFilter } from "../models/task";
import { AIService } from "../services/aiService";
import { NavigationService } from "../services/navigationService";
import TaskChatPlugin from "../main";

export const CHAT_VIEW_TYPE = "task-chat-view";

export class ChatView extends ItemView {
    private plugin: TaskChatPlugin;
    private chatMessages: ChatMessage[] = [];
    private currentTasks: Task[] = [];
    private currentFilter: TaskFilter = {};
    private containerEl: HTMLElement;
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
        this.containerEl = this.contentEl;
        this.containerEl.empty();
        this.containerEl.addClass("task-chat-container");

        this.renderView();
    }

    async onClose(): Promise<void> {
        this.containerEl.empty();
    }

    /**
     * Render the chat view
     */
    private renderView(): void {
        this.containerEl.empty();

        // Header
        const headerEl = this.containerEl.createDiv("task-chat-header");
        headerEl.createEl("h4", { text: "Task Chat" });

        // Filter status
        this.filterStatusEl = this.containerEl.createDiv(
            "task-chat-filter-status",
        );
        this.updateFilterStatus();

        // Filter controls
        const controlsEl = this.containerEl.createDiv("task-chat-controls");

        const refreshBtn = controlsEl.createEl("button", {
            text: "Refresh tasks",
        });
        refreshBtn.addEventListener("click", () => this.refreshTasks());

        const clearBtn = controlsEl.createEl("button", { text: "Clear chat" });
        clearBtn.addEventListener("click", () => this.clearChat());

        const filterBtn = controlsEl.createEl("button", {
            text: "Filter tasks",
        });
        filterBtn.addEventListener("click", () => this.openFilterModal());

        // Messages container
        this.messagesEl = this.containerEl.createDiv("task-chat-messages");
        this.renderMessages();

        // Input area
        const inputContainerEl = this.containerEl.createDiv(
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
        if (this.chatMessages.length === 0) {
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
     * Render all messages
     */
    private renderMessages(): void {
        if (!this.messagesEl) return;

        this.messagesEl.empty();

        this.chatMessages.forEach((message) => {
            this.renderMessage(message);
        });

        // Scroll to bottom
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

            const taskListEl = tasksEl.createEl("ul");

            message.recommendedTasks.forEach((task) => {
                const taskItemEl = taskListEl.createEl("li");
                taskItemEl.createEl("span", {
                    text: task.text,
                    cls: "task-chat-task-text",
                });

                const navBtn = taskItemEl.createEl("button", {
                    text: "→",
                    cls: "task-chat-nav-button",
                });

                navBtn.addEventListener("click", () => {
                    NavigationService.navigateToTask(this.app, task);
                });
            });
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

        this.chatMessages.push(userMessage);
        this.renderMessages();

        try {
            // Get AI response
            const result = await AIService.sendMessage(
                message,
                this.currentTasks,
                this.chatMessages,
                this.plugin.settings,
            );

            // Add AI response
            const aiMessage: ChatMessage = {
                role: "assistant",
                content: result.response,
                timestamp: Date.now(),
                recommendedTasks: result.recommendedTasks,
            };

            this.chatMessages.push(aiMessage);
            this.renderMessages();

            // Trim chat history if needed
            if (
                this.chatMessages.length > this.plugin.settings.maxChatHistory
            ) {
                this.chatMessages = this.chatMessages.slice(
                    -this.plugin.settings.maxChatHistory,
                );
            }
        } catch (error) {
            console.error("Error sending message:", error);
            new Notice(error.message || "Failed to get AI response");

            const errorMessage: ChatMessage = {
                role: "system",
                content: `Error: ${error.message || "Failed to get AI response"}`,
                timestamp: Date.now(),
            };

            this.chatMessages.push(errorMessage);
            this.renderMessages();
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
    private addSystemMessage(content: string): void {
        const message: ChatMessage = {
            role: "system",
            content: content,
            timestamp: Date.now(),
        };

        this.chatMessages.push(message);
        this.renderMessages();
    }

    /**
     * Clear chat history
     */
    private clearChat(): void {
        this.chatMessages = [];
        this.renderMessages();
        this.addSystemMessage(
            "Chat cleared. How can I help you with your tasks?",
        );
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
}
