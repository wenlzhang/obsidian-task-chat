import { App, Modal } from "obsidian";
import { ChatSession } from "../models/task";
import TaskChatPlugin from "../main";

/**
 * Modal for managing chat sessions
 */
export class SessionModal extends Modal {
    private plugin: TaskChatPlugin;
    private onSessionSelect: (sessionId: string) => void;

    constructor(
        app: App,
        plugin: TaskChatPlugin,
        onSessionSelect: (sessionId: string) => void,
    ) {
        super(app);
        this.plugin = plugin;
        this.onSessionSelect = onSessionSelect;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("task-chat-session-modal");

        // Title
        contentEl.createEl("h2", { text: "Chat Sessions" });

        const sessions = this.plugin.sessionManager.getAllSessions();
        const currentSession = this.plugin.sessionManager.getCurrentSession();

        if (sessions.length === 0) {
            contentEl.createEl("p", {
                text: 'No sessions yet. Click "+ New" to create one.',
                cls: "task-chat-empty-sessions",
            });
            return;
        }

        // Session count
        const countEl = contentEl.createEl("p", {
            cls: "task-chat-session-count",
        });
        countEl.createEl("span", {
            text: `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`,
        });

        // Session list
        const listContainer = contentEl.createDiv(
            "task-chat-session-list-container",
        );
        const listEl = listContainer.createEl("ul", {
            cls: "task-chat-session-items",
        });

        sessions.forEach((session) => {
            this.renderSessionItem(listEl, session, currentSession);
        });
    }

    private renderSessionItem(
        listEl: HTMLUListElement,
        session: ChatSession,
        currentSession: ChatSession | null,
    ): void {
        const itemEl = listEl.createEl("li", {
            cls: "task-chat-session-item",
        });

        if (currentSession && session.id === currentSession.id) {
            itemEl.addClass("task-chat-session-active");
        }

        // Session content wrapper
        const contentWrapper = itemEl.createDiv("task-chat-session-content");

        // Session name and info
        const infoWrapper = contentWrapper.createDiv(
            "task-chat-session-info-wrapper",
        );

        const nameEl = infoWrapper.createEl("div", {
            text: session.name,
            cls: "task-chat-session-name",
        });

        const date = new Date(session.updatedAt);
        const messageCount = session.messages.length;

        // Only show user messages count (exclude system messages)
        const userMessageCount = session.messages.filter(
            (msg) => msg.role === "user" || msg.role === "assistant",
        ).length;

        infoWrapper.createEl("div", {
            text: `${userMessageCount} message${userMessageCount !== 1 ? "s" : ""} • ${this.formatDate(date)}`,
            cls: "task-chat-session-meta",
        });

        // Click handler for selection
        contentWrapper.addEventListener("click", () => {
            this.onSessionSelect(session.id);
            this.close();
        });

        // Delete button
        const deleteBtn = itemEl.createEl("button", {
            text: "×",
            cls: "task-chat-session-delete",
        });

        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.deleteSession(session);
        });
    }

    private deleteSession(session: ChatSession): void {
        const messageCount = session.messages.filter(
            (msg) => msg.role === "user" || msg.role === "assistant",
        ).length;

        const confirmMessage =
            messageCount > 0
                ? `Delete "${session.name}" with ${messageCount} message${messageCount !== 1 ? "s" : ""}?`
                : `Delete empty session "${session.name}"?`;

        if (confirm(confirmMessage)) {
            this.plugin.sessionManager.deleteSession(session.id);
            this.plugin.saveSettings();

            // Refresh modal content
            this.onOpen();

            // Trigger callback if we deleted current session
            const newCurrent = this.plugin.sessionManager.getCurrentSession();
            if (newCurrent) {
                this.onSessionSelect(newCurrent.id);
            }
        }
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            // Today - show time
            return date.toLocaleTimeString("default", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        } else if (diffDays === 1) {
            return "Yesterday";
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString("default", {
                month: "short",
                day: "numeric",
            });
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
