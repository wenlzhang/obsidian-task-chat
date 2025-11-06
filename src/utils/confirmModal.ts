import { App, Modal } from "obsidian";

/**
 * Reusable confirmation modal for Obsidian
 * Provides a better UX than native confirm() dialogs
 */
export class ConfirmModal extends Modal {
    private title: string;
    private message: string;
    private confirmText: string;
    private cancelText: string;
    private onConfirm: () => void;
    private onCancel?: () => void;
    private dangerous: boolean;

    constructor(
        app: App,
        title: string,
        message: string,
        confirmText: string = "Confirm",
        cancelText: string = "Cancel",
        onConfirm: () => void,
        onCancel?: () => void,
        dangerous: boolean = false,
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.confirmText = confirmText;
        this.cancelText = cancelText;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
        this.dangerous = dangerous;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("task-chat-confirm-modal");

        // Title
        contentEl.createEl("h2", { text: this.title });

        // Message
        const messageEl = contentEl.createDiv("task-chat-confirm-message");
        // Support multi-line messages
        const lines = this.message.split("\n");
        lines.forEach((line, index) => {
            if (index > 0) {
                messageEl.createEl("br");
            }
            messageEl.appendText(line);
        });

        // Buttons container
        const buttonContainer = contentEl.createDiv(
            "task-chat-confirm-buttons",
        );

        // Cancel button
        const cancelBtn = buttonContainer.createEl("button", {
            text: this.cancelText,
        });
        cancelBtn.addEventListener("click", () => {
            this.close();
            if (this.onCancel) {
                this.onCancel();
            }
        });

        // Confirm button
        const confirmBtn = buttonContainer.createEl("button", {
            text: this.confirmText,
            cls: "mod-cta",
        });
        if (this.dangerous) {
            confirmBtn.addClass("mod-warning");
        }
        confirmBtn.addEventListener("click", () => {
            this.close();
            this.onConfirm();
        });

        // Focus confirm button by default
        confirmBtn.focus();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
