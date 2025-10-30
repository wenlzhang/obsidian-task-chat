import { App, Modal, Menu } from "obsidian";
import TaskChatPlugin from "../main";
import {
    FolderSuggestModal,
    TagSuggestModal,
    NoteSuggestModal,
} from "../utils/suggestModals";

/**
 * Allows users to exclude tags, folders, and notes from task searches
 */
export class ExclusionsModal extends Modal {
    plugin: TaskChatPlugin;

    constructor(app: App, plugin: TaskChatPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("task-chat-exclusions-modal");

        // Header
        contentEl.createEl("h2", { text: "Manage exclusions" });
        const descEl = contentEl.createEl("p", {
            cls: "task-chat-exclusions-description",
        });
        descEl.createSpan({
            text: "Exclude tasks from searches by tags, folders, or notes.",
        });
        descEl.createEl("br");
        descEl.createEl("br");
        descEl.createEl("strong", { text: "Tags in notes" });
        descEl.createSpan({
            text: ": Excludes ALL tasks in notes with these tags",
        });
        descEl.createEl("br");
        descEl.createEl("strong", { text: "Tags in tasks" });
        descEl.createSpan({
            text: ": Excludes ONLY specific tasks with these tags",
        });

        // Exclusions list container
        const listContainer = contentEl.createDiv({
            cls: "task-chat-exclusions-list",
        });

        this.renderExclusionsList(listContainer);

        // Add button
        const addButtonContainer = contentEl.createDiv({
            cls: "task-chat-exclusions-add-container",
        });

        const addButton = addButtonContainer.createEl("button", {
            text: "Add...",
            cls: "task-chat-exclusions-add-button",
        });

        addButton.addEventListener("click", (e) => {
            this.showAddMenu(e, listContainer);
        });
    }

    private renderExclusionsList(container: HTMLElement) {
        container.empty();

        const hasAnyExclusions =
            (this.plugin.settings.exclusions.noteTags?.length || 0) +
                (this.plugin.settings.exclusions.taskTags?.length || 0) +
                (this.plugin.settings.exclusions.folders?.length || 0) +
                (this.plugin.settings.exclusions.notes?.length || 0) >
            0;

        if (!hasAnyExclusions) {
            container.createDiv({
                text: "No patterns specified",
                cls: "task-chat-exclusions-empty",
            });
            return;
        }

        // Render Note Tags section
        this.renderExclusionSection(
            container,
            "Tags in notes",
            this.plugin.settings.exclusions.noteTags || [],
            "NoteTag",
        );

        // Render Task Tags section
        this.renderExclusionSection(
            container,
            "Tags in tasks",
            this.plugin.settings.exclusions.taskTags || [],
            "TaskTag",
        );

        // Render Folders section
        this.renderExclusionSection(
            container,
            "Folders",
            this.plugin.settings.exclusions.folders || [],
            "Folder",
        );

        // Render Notes section
        this.renderExclusionSection(
            container,
            "Notes",
            this.plugin.settings.exclusions.notes || [],
            "Note",
        );
    }

    private renderExclusionSection(
        container: HTMLElement,
        sectionTitle: string,
        items: string[],
        type: string,
    ) {
        if (items.length === 0) {
            return; // Don't show empty sections
        }

        const sectionRow = container.createDiv({
            cls: "task-chat-exclusion-row",
        });

        // Section label (left side)
        const label = sectionRow.createDiv({
            cls: "task-chat-exclusion-label",
            text: sectionTitle,
        });

        // Items container (right side)
        const itemsContainer = sectionRow.createDiv({
            cls: "task-chat-exclusion-items",
        });

        // Render each item as a badge
        items.forEach((value) => {
            const badge = itemsContainer.createDiv({
                cls: "task-chat-exclusion-badge",
            });

            // For notes, show only filename.md instead of full path
            let displayText = value || "(Root)";
            if (type === "Note" && value) {
                // Extract just the filename with extension
                const filename = value.split("/").pop() || value;
                displayText = filename.endsWith(".md")
                    ? filename
                    : `${filename}.md`;
            }

            const text = badge.createSpan({
                cls: "task-chat-exclusion-badge-text",
                text: displayText,
            });

            const removeBtn = badge.createEl("button", {
                cls: "task-chat-exclusion-badge-remove",
                text: "×",
            });

            removeBtn.addEventListener("click", async () => {
                await this.removeExclusion(type, value);
                this.renderExclusionsList(container);
            });
        });
    }

    private async removeExclusion(type: string, value: string) {
        switch (type) {
            case "NoteTag":
                this.plugin.settings.exclusions.noteTags =
                    this.plugin.settings.exclusions.noteTags.filter(
                        (t: string) => t !== value,
                    );
                break;
            case "TaskTag":
                this.plugin.settings.exclusions.taskTags =
                    this.plugin.settings.exclusions.taskTags.filter(
                        (t: string) => t !== value,
                    );
                break;
            case "Folder":
                this.plugin.settings.exclusions.folders =
                    this.plugin.settings.exclusions.folders.filter(
                        (f) => f !== value,
                    );
                break;
            case "Note":
                this.plugin.settings.exclusions.notes =
                    this.plugin.settings.exclusions.notes.filter(
                        (n) => n !== value,
                    );
                break;
        }
        await this.plugin.saveSettings();

        // AUTO-REFRESH: Trigger task refresh after removing exclusion
        await this.plugin.refreshTasks();
    }

    private showAddMenu(e: MouseEvent, listContainer: HTMLElement) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("📁 Folders")
                .setIcon("folder")
                .onClick(() => {
                    this.showFolderSuggest(listContainer);
                });
        });

        menu.addItem((item) => {
            item.setTitle("🏷 Tags in notes")
                .setIcon("tag")
                .onClick(() => {
                    this.showNoteTagSuggest(listContainer);
                });
        });

        menu.addItem((item) => {
            item.setTitle("☑️ Tags in tasks")
                .setIcon("tag")
                .onClick(() => {
                    this.showTaskTagSuggest(listContainer);
                });
        });

        menu.addItem((item) => {
            item.setTitle("📄 Notes")
                .setIcon("file")
                .onClick(() => {
                    this.showNoteSuggest(listContainer);
                });
        });

        menu.showAtMouseEvent(e);
    }

    private showNoteTagSuggest(listContainer: HTMLElement) {
        const modal = new TagSuggestModal(this.app, async (tag) => {
            // Ensure noteTags array exists
            if (!this.plugin.settings.exclusions.noteTags) {
                this.plugin.settings.exclusions.noteTags = [];
            }
            if (!this.plugin.settings.exclusions.noteTags.includes(tag)) {
                this.plugin.settings.exclusions.noteTags.push(tag);
                await this.plugin.saveSettings();
                this.renderExclusionsList(listContainer);

                // AUTO-REFRESH: Trigger task refresh after adding exclusion
                await this.plugin.refreshTasks();
            }
        });

        modal.open();
    }

    private showTaskTagSuggest(listContainer: HTMLElement) {
        const modal = new TagSuggestModal(this.app, async (tag) => {
            // Ensure taskTags array exists
            if (!this.plugin.settings.exclusions.taskTags) {
                this.plugin.settings.exclusions.taskTags = [];
            }
            if (!this.plugin.settings.exclusions.taskTags.includes(tag)) {
                this.plugin.settings.exclusions.taskTags.push(tag);
                await this.plugin.saveSettings();
                this.renderExclusionsList(listContainer);

                // AUTO-REFRESH: Trigger task refresh after adding exclusion
                await this.plugin.refreshTasks();
            }
        });

        modal.open();
    }

    private showFolderSuggest(listContainer: HTMLElement) {
        const modal = new FolderSuggestModal(this.app, async (folder) => {
            // Ensure folders array exists
            if (!this.plugin.settings.exclusions.folders) {
                this.plugin.settings.exclusions.folders = [];
            }
            if (!this.plugin.settings.exclusions.folders.includes(folder)) {
                this.plugin.settings.exclusions.folders.push(folder);
                await this.plugin.saveSettings();
                this.renderExclusionsList(listContainer);

                // AUTO-REFRESH: Trigger task refresh after adding exclusion
                await this.plugin.refreshTasks();
            }
        });

        modal.open();
    }

    private showNoteSuggest(listContainer: HTMLElement) {
        const modal = new NoteSuggestModal(this.app, async (file) => {
            const notePath = file.path;
            // Ensure notes array exists
            if (!this.plugin.settings.exclusions.notes) {
                this.plugin.settings.exclusions.notes = [];
            }
            if (!this.plugin.settings.exclusions.notes.includes(notePath)) {
                this.plugin.settings.exclusions.notes.push(notePath);
                await this.plugin.saveSettings();
                this.renderExclusionsList(listContainer);

                // AUTO-REFRESH: Trigger task refresh after adding exclusion
                await this.plugin.refreshTasks();
            }
        });

        modal.open();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
