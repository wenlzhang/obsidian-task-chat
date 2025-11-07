import { App, Modal } from "obsidian";
import { ChatSession } from "../models/task";
import TaskChatPlugin from "../main";
import { ConfirmModal } from "../utils/confirmModal";

/**
 * Modal for managing chat sessions
 */
export class SessionModal extends Modal {
    private plugin: TaskChatPlugin;

    private onSessionSelect: (_sessionId: string) => void;
    private selectionMode = false;
    private selectedSessionIds: Set<string> = new Set();

    constructor(
        app: App,
        plugin: TaskChatPlugin,
        onSessionSelect: (_sessionId: string) => void,
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
        contentEl.createEl("h2", { text: "Chat sessions" });

        const sessions = this.plugin.sessionManager.getAllSessions();
        const currentSession = this.plugin.sessionManager.getCurrentSession();

        if (sessions.length === 0) {
            contentEl.createEl("p", {
                text: 'No sessions yet. Click "new" to create one.',
                cls: "task-chat-empty-sessions",
            });
            return;
        }

        // Session count and bulk actions
        const headerEl = contentEl.createDiv("task-chat-session-header");
        const countEl = headerEl.createEl("p", {
            cls: "task-chat-session-count",
        });
        countEl.createEl("span", {
            text: `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`,
        });

        const actionsEl = headerEl.createDiv("task-chat-session-actions");

        // Selection mode button (toggles between Select and Delete Selected)
        const selectBtn = actionsEl.createEl("button", {
            text: this.selectionMode
                ? this.selectedSessionIds.size > 0
                    ? `Delete Selected (${this.selectedSessionIds.size})`
                    : "Cancel"
                : "Select",
            cls: this.selectionMode
                ? this.selectedSessionIds.size > 0
                    ? "task-chat-delete-selected-button"
                    : "task-chat-cancel-button"
                : "task-chat-select-button",
        });
        selectBtn.addEventListener("click", () => {
            if (this.selectionMode) {
                // Delete selected sessions
                if (this.selectedSessionIds.size > 0) {
                    this.deleteSelectedSessions();
                } else {
                    // Cancel selection mode
                    this.selectionMode = false;
                    this.selectedSessionIds.clear();
                    this.onOpen();
                }
            } else {
                // Enter selection mode
                this.selectionMode = true;
                this.selectedSessionIds.clear();
                this.onOpen();
            }
        });

        // Delete all button
        const deleteAllBtn = actionsEl.createEl("button", {
            text: "Delete all",
            cls: "task-chat-delete-all-button",
        });
        deleteAllBtn.addEventListener("click", () => {
            this.deleteAllSessions();
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

        // Checkbox for selection mode
        if (this.selectionMode) {
            const checkboxWrapper = itemEl.createDiv(
                "task-chat-session-checkbox-wrapper",
            );
            const checkbox = checkboxWrapper.createEl("input", {
                type: "checkbox",
                cls: "task-chat-session-checkbox",
            });
            checkbox.checked = this.selectedSessionIds.has(session.id);
            checkbox.addEventListener("change", (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    this.selectedSessionIds.add(session.id);
                } else {
                    this.selectedSessionIds.delete(session.id);
                }
                this.onOpen(); // Refresh to update button text
            });
        }

        // Session content wrapper
        const contentWrapper = itemEl.createDiv("task-chat-session-content");

        // Session name and info
        const infoWrapper = contentWrapper.createDiv(
            "task-chat-session-info-wrapper",
        );

        infoWrapper.createEl("div", {
            text: session.name,
            cls: "task-chat-session-name",
        });

        const date = new Date(session.updatedAt);

        // Only show user messages count (exclude system messages)
        const userMessageCount = session.messages.filter(
            (msg) => msg.role === "user" || msg.role === "assistant",
        ).length;

        infoWrapper.createEl("div", {
            text: `${userMessageCount} message${userMessageCount !== 1 ? "s" : ""} • ${this.formatDate(date)}`,
            cls: "task-chat-session-meta",
        });

        // Click handler - different behavior in selection mode
        if (this.selectionMode) {
            contentWrapper.addEventListener("click", () => {
                // Toggle selection
                if (this.selectedSessionIds.has(session.id)) {
                    this.selectedSessionIds.delete(session.id);
                } else {
                    this.selectedSessionIds.add(session.id);
                }
                this.onOpen(); // Refresh to update checkbox and button
            });
        } else {
            contentWrapper.addEventListener("click", () => {
                this.onSessionSelect(session.id);
                this.close();
            });
        }

        // Delete button (hide in selection mode)
        if (!this.selectionMode) {
            const deleteBtn = itemEl.createEl("button", {
                text: "×",
                cls: "task-chat-session-delete",
            });

            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteSession(session);
            });
        }
    }

    private deleteSession(session: ChatSession): void {
        const messageCount = session.messages.filter(
            (msg) => msg.role === "user" || msg.role === "assistant",
        ).length;

        const confirmMessage =
            messageCount > 0
                ? `Delete "${session.name}" with ${messageCount} message${messageCount !== 1 ? "s" : ""}?`
                : `Delete empty session "${session.name}"?`;

        new ConfirmModal(
            this.app,
            "Delete session",
            confirmMessage,
            "Delete",
            "Cancel",
            () => {
                this.plugin.sessionManager.deleteSession(session.id);
                void this.plugin.saveSettings();

                // Refresh modal content
                this.onOpen();

                // Trigger callback if we deleted current session
                const newCurrent =
                    this.plugin.sessionManager.getCurrentSession();
                if (newCurrent) {
                    this.onSessionSelect(newCurrent.id);
                }
            },
            undefined,
            true, // dangerous = true (delete action)
        ).open();
    }

    private deleteSelectedSessions(): void {
        const sessions = this.plugin.sessionManager.getAllSessions();
        const selectedSessions = sessions.filter((s) =>
            this.selectedSessionIds.has(s.id),
        );

        const totalMessages = selectedSessions.reduce((sum, session) => {
            return (
                sum +
                session.messages.filter(
                    (msg) => msg.role === "user" || msg.role === "assistant",
                ).length
            );
        }, 0);

        const confirmMessage =
            totalMessages > 0
                ? `Delete ${selectedSessions.length} selected session${selectedSessions.length !== 1 ? "s" : ""} (${totalMessages} total messages)?\n\nThis action cannot be undone.`
                : `Delete ${selectedSessions.length} selected session${selectedSessions.length !== 1 ? "s" : ""}?`;

        new ConfirmModal(
            this.app,
            "Delete selected sessions",
            confirmMessage,
            "Delete",
            "Cancel",
            () => {
                // Delete selected sessions
                selectedSessions.forEach((session) => {
                    this.plugin.sessionManager.deleteSession(session.id);
                });
                void this.plugin.saveSettings();

                // Exit selection mode
                this.selectionMode = false;
                this.selectedSessionIds.clear();

                // Refresh modal content
                this.onOpen();

                // Trigger callback if we deleted current session
                const newCurrent =
                    this.plugin.sessionManager.getCurrentSession();
                if (newCurrent) {
                    this.onSessionSelect(newCurrent.id);
                }
            },
            undefined,
            true, // dangerous = true (delete action)
        ).open();
    }

    private deleteAllSessions(): void {
        const sessions = this.plugin.sessionManager.getAllSessions();
        const totalMessages = sessions.reduce((sum, session) => {
            return (
                sum +
                session.messages.filter(
                    (msg) => msg.role === "user" || msg.role === "assistant",
                ).length
            );
        }, 0);

        const confirmMessage =
            totalMessages > 0
                ? `Delete all ${sessions.length} sessions (${totalMessages} total messages)?\n\nThis action cannot be undone.`
                : `Delete all ${sessions.length} empty sessions?`;

        new ConfirmModal(
            this.app,
            "Delete all sessions",
            confirmMessage,
            "Delete all",
            "Cancel",
            () => {
                // Delete all sessions
                sessions.forEach((session) => {
                    this.plugin.sessionManager.deleteSession(session.id);
                });
                void this.plugin.saveSettings();

                // Create a new session automatically
                const newSession =
                    this.plugin.sessionManager.getOrCreateCurrentSession(
                        this.plugin.settings.maxSessions,
                    );
                this.onSessionSelect(newSession.id);

                // Close modal after deleting all
                this.close();
            },
            undefined,
            true, // dangerous = true (delete action)
        ).open();
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
