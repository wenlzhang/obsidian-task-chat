import { App, Modal, Menu, Notice } from "obsidian";
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
        contentEl.createEl("p", {
            text: "Exclude tags, folders, or notes from task searches. Tasks in excluded items will not appear in results.",
            cls: "task-chat-exclusions-description",
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
            (this.plugin.settings.exclusions.tags?.length || 0) +
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

        // Render Tags section
        this.renderExclusionSection(
            container,
            "Tags",
            this.plugin.settings.exclusions.tags || [],
            "Tag",
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

            const text = badge.createSpan({
                cls: "task-chat-exclusion-badge-text",
                text: value || "(Root)",
            });

            const removeBtn = badge.createEl("button", {
                cls: "task-chat-exclusion-badge-remove",
                text: "×",
            });

            removeBtn.addEventListener("click", async () => {
                await this.removeExclusion(type, value);
                this.renderExclusionsList(container);
                new Notice(`Removed ${type}: ${value}`);
            });
        });
    }

    private async removeExclusion(type: string, value: string) {
        switch (type) {
            case "Tag":
                this.plugin.settings.exclusions.tags =
                    this.plugin.settings.exclusions.tags.filter(
                        (t) => t !== value,
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
    }

    private showAddMenu(e: MouseEvent, listContainer: HTMLElement) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("🏷️ Tag")
                .setIcon("tag")
                .onClick(() => {
                    this.showTagSuggest(listContainer);
                });
        });

        menu.addItem((item) => {
            item.setTitle("📁 Folder")
                .setIcon("folder")
                .onClick(() => {
                    this.showFolderSuggest(listContainer);
                });
        });

        menu.addItem((item) => {
            item.setTitle("📄 Note")
                .setIcon("file")
                .onClick(() => {
                    this.showNoteSuggest(listContainer);
                });
        });

        menu.showAtMouseEvent(e);
    }

    private showTagSuggest(listContainer: HTMLElement) {
        const modal = new TagSuggestModal(this.app, async (tag) => {
            if (!this.plugin.settings.exclusions.tags.includes(tag)) {
                this.plugin.settings.exclusions.tags.push(tag);
                await this.plugin.saveSettings();
                this.renderExclusionsList(listContainer);
                new Notice(`Excluded tag: ${tag}`);
            } else {
                new Notice(`Tag ${tag} is already excluded`);
            }
        });

        modal.open();
    }

    private showFolderSuggest(listContainer: HTMLElement) {
        const modal = new FolderSuggestModal(this.app, async (folder) => {
            if (!this.plugin.settings.exclusions.folders.includes(folder)) {
                this.plugin.settings.exclusions.folders.push(folder);
                await this.plugin.saveSettings();
                this.renderExclusionsList(listContainer);
                new Notice(
                    `Excluded folder: ${folder === "/" ? "(root)" : folder}`,
                );
            } else {
                new Notice(`Folder ${folder} is already excluded`);
            }
        });

        modal.open();
    }

    private showNoteSuggest(listContainer: HTMLElement) {
        const modal = new NoteSuggestModal(this.app, async (file) => {
            const notePath = file.path;
            if (!this.plugin.settings.exclusions.notes.includes(notePath)) {
                this.plugin.settings.exclusions.notes.push(notePath);
                await this.plugin.saveSettings();
                this.renderExclusionsList(listContainer);
                new Notice(`Excluded note: ${notePath}`);
            } else {
                new Notice(`Note ${notePath} is already excluded`);
            }
        });

        modal.open();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
