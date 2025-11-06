import { App, Modal, moment } from "obsidian";
import { TaskFilter } from "../models/task";
import { Task } from "../models/task";
import {
    FolderSuggestModal,
    TagSuggestModal,
    NoteSuggestModal,
} from "../utils/suggestModals";
import TaskChatPlugin from "../main";

/**
 * Enhanced Filter Modal with two sections:
 * 1. Task inclusion (folders, tags, notes)
 * 2. Task properties (due date, priority, status categories)
 *
 * Note: Text search is handled by Simple Search/Smart Search/Task Chat modes
 */
export class FilterModal extends Modal {
    private filter: TaskFilter;
    private onSubmit: (_filter: TaskFilter) => void;
    private allTasks: Task[];
    private plugin: TaskChatPlugin;
    private listContainers: {
        folders?: HTMLElement;
        noteTags?: HTMLElement;
        taskTags?: HTMLElement;
        notes?: HTMLElement;
    } = {};

    constructor(
        app: App,
        plugin: TaskChatPlugin,
        allTasks: Task[],
        currentFilter: TaskFilter,
        onSubmit: (_filter: TaskFilter) => void,
    ) {
        super(app);
        this.plugin = plugin;
        this.allTasks = allTasks;
        this.filter = { ...currentFilter };
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("task-chat-filter-modal");

        // Header
        contentEl.createEl("h2", { text: "Filter tasks" });

        // Description with documentation link
        const headerDesc = contentEl.createDiv({
            cls: "task-chat-filter-modal-desc",
        });
        headerDesc.createSpan({
            text: "Focus on specific tasks using filters. ",
        });
        headerDesc.createEl("a", {
            cls: "setting-inline-link",
            text: "Learn more about filtering.",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/FILTERING.md",
        });

        // SECTION 1: Task Inclusion (Folders, Tags, Notes)
        this.renderTaskInclusionSection(contentEl);

        // SECTION 2: Task Properties (Due Date, Priority, Status)
        this.renderTaskPropertiesSection(contentEl);

        // Action Buttons
        this.renderActionButtons(contentEl);
    }

    /**
     * Section 1: Task inclusion (folders, tags, notes)
     */
    private renderTaskInclusionSection(container: HTMLElement): void {
        const section = container.createDiv("task-chat-filter-section");
        section.createEl("h3", {
            text: "Folders, tags, and notes",
            cls: "task-chat-filter-section-title",
        });

        const desc = section.createDiv({
            cls: "task-chat-filter-section-desc",
        });
        desc.createSpan({
            text: "Include tasks from specific folders, tags, or notes. Tasks match if they meet ",
        });
        desc.createEl("strong", { text: "ANY" });
        desc.createSpan({
            text: " of these criteria (OR logic). Leave empty to include all.",
        });
        desc.createEl("br");
        desc.createEl("br");
        desc.createEl("strong", { text: "Tags in notes" });
        desc.createSpan({
            text: ": Include ALL tasks in notes with these tags",
        });
        desc.createEl("br");
        desc.createEl("strong", { text: "Tags in tasks" });
        desc.createSpan({
            text: ": Include ONLY specific tasks with these tags",
        });

        // Folders
        this.renderInclusionRow(
            section,
            "📁 Folders",
            "folder",
            this.filter.folders || [],
        );

        // Tags in notes
        this.renderInclusionRow(
            section,
            "🏷 Tags in notes",
            "noteTag",
            this.filter.noteTags || [],
        );

        // Tags in tasks
        this.renderInclusionRow(
            section,
            "☑️ Tags in tasks",
            "taskTag",
            this.filter.taskTags || [],
        );

        // Notes
        this.renderInclusionRow(
            section,
            "📄 Notes",
            "note",
            this.filter.notes || [],
        );
    }

    /**
     * Render a single inclusion row with label, items, and add button
     */
    private renderInclusionRow(
        container: HTMLElement,
        label: string,
        type: "folder" | "noteTag" | "taskTag" | "note",
        items: string[],
    ): void {
        const row = container.createDiv("task-chat-filter-inclusion-row");

        // Label (left side)
        const _labelEl = row.createDiv({
            cls: "task-chat-filter-inclusion-label",
            text: label,
        });

        // Items container (middle)
        const itemsContainer = row.createDiv({
            cls: "task-chat-filter-inclusion-items",
        });

        // Store reference for later updates
        const containerKey =
            type === "folder"
                ? "folders"
                : type === "noteTag"
                  ? "noteTags"
                  : type === "taskTag"
                    ? "taskTags"
                    : "notes";
        this.listContainers[containerKey] = itemsContainer;

        // Render items
        this.renderInclusionItems(itemsContainer, type, items);

        // Add button (right side)
        const addBtn = row.createEl("button", {
            text: "Add...",
            cls: "task-chat-filter-add-button",
        });

        addBtn.addEventListener("click", () => {
            this.showInclusionSuggest(type, itemsContainer);
        });
    }

    /**
     * Render inclusion items as badges
     */
    private renderInclusionItems(
        container: HTMLElement,
        type: "folder" | "noteTag" | "taskTag" | "note",
        items: string[],
    ): void {
        container.empty();

        if (items.length === 0) {
            container.createDiv({
                text: "All",
                cls: "task-chat-filter-inclusion-empty",
            });
            return;
        }

        items.forEach((value) => {
            const badge = container.createDiv({
                cls: "task-chat-filter-inclusion-badge",
            });

            // Display name (for notes, show filename.md only)
            let displayText = value;
            if (type === "note") {
                // Extract just the filename with extension
                const filename = value.split("/").pop() || value;
                displayText = filename.endsWith(".md")
                    ? filename
                    : `${filename}.md`;
            }

            badge.createSpan({
                cls: "task-chat-filter-inclusion-badge-text",
                text: displayText,
                attr: { title: type === "note" ? (value ?? null) : null }, // Show full path on hover for notes
            });

            const removeBtn = badge.createEl("button", {
                cls: "task-chat-filter-inclusion-badge-remove",
                text: "×",
            });

            removeBtn.addEventListener("click", () => {
                this.removeInclusion(type, value);
            });
        });
    }

    /**
     * Remove an inclusion item
     */
    private removeInclusion(
        type: "folder" | "noteTag" | "taskTag" | "note",
        value: string,
    ): void {
        switch (type) {
            case "folder":
                this.filter.folders = (this.filter.folders || []).filter(
                    (f) => f !== value,
                );
                // listContainers.folders is guaranteed to exist after renderInclusionRow
                if (this.listContainers.folders) {
                    this.renderInclusionItems(
                        this.listContainers.folders,
                        type,
                        this.filter.folders,
                    );
                }
                break;
            case "noteTag":
                this.filter.noteTags = (this.filter.noteTags || []).filter(
                    (t) => t !== value,
                );
                // listContainers.noteTags is guaranteed to exist after renderInclusionRow
                if (this.listContainers.noteTags) {
                    this.renderInclusionItems(
                        this.listContainers.noteTags,
                        type,
                        this.filter.noteTags,
                    );
                }
                break;
            case "taskTag":
                this.filter.taskTags = (this.filter.taskTags || []).filter(
                    (t) => t !== value,
                );
                // listContainers.taskTags is guaranteed to exist after renderInclusionRow
                if (this.listContainers.taskTags) {
                    this.renderInclusionItems(
                        this.listContainers.taskTags,
                        type,
                        this.filter.taskTags,
                    );
                }
                break;
            case "note":
                this.filter.notes = (this.filter.notes || []).filter(
                    (n) => n !== value,
                );
                // listContainers.notes is guaranteed to exist after renderInclusionRow
                if (this.listContainers.notes) {
                    this.renderInclusionItems(
                        this.listContainers.notes,
                        type,
                        this.filter.notes,
                    );
                }
                break;
        }
    }

    /**
     * Show suggestion modal for adding inclusion items
     */
    private showInclusionSuggest(
        type: "folder" | "noteTag" | "taskTag" | "note",
        listContainer: HTMLElement,
    ): void {
        switch (type) {
            case "folder":
                {
                    const modal = new FolderSuggestModal(this.app, (folder) => {
                        if (!this.filter.folders) {
                            this.filter.folders = [];
                        }
                        if (!this.filter.folders.includes(folder)) {
                            this.filter.folders.push(folder);
                            this.renderInclusionItems(
                                listContainer,
                                type,
                                this.filter.folders,
                            );
                        }
                    });
                    modal.open();
                }
                break;

            case "noteTag":
                {
                    const modal = new TagSuggestModal(this.app, (tag) => {
                        if (!this.filter.noteTags) {
                            this.filter.noteTags = [];
                        }
                        if (!this.filter.noteTags.includes(tag)) {
                            this.filter.noteTags.push(tag);
                            this.renderInclusionItems(
                                listContainer,
                                type,
                                this.filter.noteTags,
                            );
                        }
                    });
                    modal.open();
                }
                break;

            case "taskTag":
                {
                    const modal = new TagSuggestModal(this.app, (tag) => {
                        if (!this.filter.taskTags) {
                            this.filter.taskTags = [];
                        }
                        if (!this.filter.taskTags.includes(tag)) {
                            this.filter.taskTags.push(tag);
                            this.renderInclusionItems(
                                listContainer,
                                type,
                                this.filter.taskTags,
                            );
                        }
                    });
                    modal.open();
                }
                break;

            case "note":
                {
                    const modal = new NoteSuggestModal(this.app, (file) => {
                        const notePath = file.path;
                        if (!this.filter.notes) {
                            this.filter.notes = [];
                        }
                        if (!this.filter.notes.includes(notePath)) {
                            this.filter.notes.push(notePath);
                            this.renderInclusionItems(
                                listContainer,
                                type,
                                this.filter.notes,
                            );
                        }
                    });
                    modal.open();
                }
                break;
        }
    }

    /**
     * Section 2: Task properties (due date, priority, status)
     */
    private renderTaskPropertiesSection(container: HTMLElement): void {
        const section = container.createDiv("task-chat-filter-section");
        section.createEl("h3", {
            text: "Task properties",
            cls: "task-chat-filter-section-title",
        });

        // Add description with AND logic explanation
        const desc = section.createDiv({
            cls: "task-chat-filter-section-desc",
        });
        desc.createSpan({
            text: "Filter by task properties. Tasks must match ",
        });
        desc.createEl("strong", { text: "ALL" });
        desc.createSpan({
            text: " selected property criteria (AND logic). Leave empty for no filtering.",
        });

        // Due Date Range
        this.renderDueDateRange(section);

        // Priority
        this.renderPriority(section);

        // Status Categories
        this.renderStatusCategories(section);
    }

    /**
     * Render due date range filter with HTML5 date inputs
     */
    private renderDueDateRange(container: HTMLElement): void {
        const dueDateSection = container.createDiv(
            "task-chat-filter-subsection",
        );
        dueDateSection.createEl("h4", { text: "📅 due date range" });

        const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const startInputId = `task-chat-filter-date-start-${uniqueSuffix}`;
        const endInputId = `task-chat-filter-date-end-${uniqueSuffix}`;

        const dateRow = dueDateSection.createDiv("task-chat-filter-date-row");

        const startLabel = dateRow.createEl("label", {
            text: "Start",
            cls: "task-chat-filter-date-label",
        });
        startLabel.setAttr("for", startInputId);

        const startInput = dateRow.createEl("input", {
            cls: "task-chat-filter-date-input",
            attr: {
                id: startInputId,
                type: "date",
            },
        });
        startInput.value = this.filter.dueDateRange?.start || "";
        startInput.addEventListener("change", () => {
            if (!this.filter.dueDateRange) {
                this.filter.dueDateRange = {};
            }
            this.filter.dueDateRange.start = startInput.value || undefined;
        });

        const endLabel = dateRow.createEl("label", {
            text: "End",
            cls: "task-chat-filter-date-label",
        });
        endLabel.setAttr("for", endInputId);

        const endInput = dateRow.createEl("input", {
            cls: "task-chat-filter-date-input",
            attr: {
                id: endInputId,
                type: "date",
            },
        });
        endInput.value = this.filter.dueDateRange?.end || "";
        endInput.addEventListener("change", () => {
            if (!this.filter.dueDateRange) {
                this.filter.dueDateRange = {};
            }
            this.filter.dueDateRange.end = endInput.value || undefined;
        });

        // Quick date filters
        const quickFiltersContainer = dueDateSection.createDiv(
            "task-chat-filter-quick-dates",
        );
        quickFiltersContainer.createEl("span", {
            text: "Date",
            cls: "task-chat-filter-quick-dates-label",
        });

        const addQuickFilter = (
            label: string,
            getRange: () => { start: string; end: string },
        ) => {
            const btn = quickFiltersContainer.createEl("button", {
                text: label,
                cls: "task-chat-filter-quick-date-btn",
            });
            btn.addEventListener("click", () => {
                const range = getRange();

                if (!this.filter.dueDateRange) {
                    this.filter.dueDateRange = {};
                }

                this.filter.dueDateRange.start = range.start;
                this.filter.dueDateRange.end = range.end;

                this.onOpen(); // Refresh the modal
            });
        };

        // Today: start and end of today
        addQuickFilter("Today", () => {
            const today = moment().startOf("day");
            return {
                start: today.format("YYYY-MM-DD"),
                end: today.format("YYYY-MM-DD"),
            };
        });

        // This week: start of week (Monday) to end of week (Sunday)
        addQuickFilter("This week", () => {
            const startOfWeek = moment().startOf("week");
            const endOfWeek = moment().endOf("week");
            return {
                start: startOfWeek.format("YYYY-MM-DD"),
                end: endOfWeek.format("YYYY-MM-DD"),
            };
        });

        // This month: start of month to end of month
        addQuickFilter("This month", () => {
            const startOfMonth = moment().startOf("month");
            const endOfMonth = moment().endOf("month");
            return {
                start: startOfMonth.format("YYYY-MM-DD"),
                end: endOfMonth.format("YYYY-MM-DD"),
            };
        });

        // This year: start of year to end of year
        addQuickFilter("This year", () => {
            const startOfYear = moment().startOf("year");
            const endOfYear = moment().endOf("year");
            return {
                start: startOfYear.format("YYYY-MM-DD"),
                end: endOfYear.format("YYYY-MM-DD"),
            };
        });
    }

    /**
     * Render priority filter with toggles
     */
    private renderPriority(container: HTMLElement): void {
        // Show all possible priorities (1, 2, 3, 4, none)
        // Use "none" string to match TaskPropertyService.PRIORITY_VALUES.none
        const allPriorities = ["1", "2", "3", "4", "none"];

        const prioritySection = container.createDiv(
            "task-chat-filter-subsection",
        );
        prioritySection.createEl("h4", { text: "🎯 priorities" });

        const priorityContainer = prioritySection.createDiv(
            "task-chat-filter-toggles",
        );

        allPriorities.forEach((priority) => {
            const toggleRow = priorityContainer.createDiv(
                "task-chat-filter-toggle-row",
            );

            const checkbox = toggleRow.createEl("input", {
                type: "checkbox",
                cls: "task-chat-filter-checkbox",
            });
            checkbox.checked =
                this.filter.priorities?.includes(priority) || false;

            checkbox.addEventListener("change", () => {
                if (!this.filter.priorities) {
                    this.filter.priorities = [];
                }

                if (checkbox.checked) {
                    if (!this.filter.priorities.includes(priority)) {
                        this.filter.priorities.push(priority);
                    }
                } else {
                    this.filter.priorities = this.filter.priorities.filter(
                        (p) => p !== priority,
                    );
                }
            });

            toggleRow.createSpan({
                text: priority,
                cls: "task-chat-filter-toggle-label",
            });
        });
    }

    /**
     * Render status categories filter with toggles
     * Shows all configured status categories with their display names
     */
    private renderStatusCategories(container: HTMLElement): void {
        // Get all configured status categories from settings
        const statusMapping = this.plugin.settings.taskStatusMapping;
        let allStatuses = Object.keys(statusMapping);

        // Filter out "completed" if hideCompletedTasks is enabled
        if (this.plugin.settings.hideCompletedTasks) {
            allStatuses = allStatuses.filter((key) => key !== "completed");
        }

        if (allStatuses.length === 0) {
            return; // No status categories configured
        }

        const statusSection = container.createDiv(
            "task-chat-filter-subsection",
        );
        statusSection.createEl("h4", { text: "✓ task status" });

        const statusContainer = statusSection.createDiv(
            "task-chat-filter-toggles",
        );

        allStatuses.forEach((statusKey) => {
            const toggleRow = statusContainer.createDiv(
                "task-chat-filter-toggle-row",
            );

            const checkbox = toggleRow.createEl("input", {
                type: "checkbox",
                cls: "task-chat-filter-checkbox",
            });
            checkbox.checked =
                this.filter.taskStatuses?.includes(statusKey) || false;

            checkbox.addEventListener("change", () => {
                if (!this.filter.taskStatuses) {
                    this.filter.taskStatuses = [];
                }

                if (checkbox.checked) {
                    if (!this.filter.taskStatuses.includes(statusKey)) {
                        this.filter.taskStatuses.push(statusKey);
                    }
                } else {
                    this.filter.taskStatuses = this.filter.taskStatuses.filter(
                        (s) => s !== statusKey,
                    );
                }
            });

            // Show display name from settings
            const displayName =
                statusMapping[statusKey].displayName || statusKey;
            toggleRow.createSpan({
                text: displayName,
                cls: "task-chat-filter-toggle-label",
            });
        });
    }

    /**
     * Render action buttons (Clear, Cancel, Apply)
     */
    private renderActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv("task-chat-filter-buttons");

        const clearBtn = buttonContainer.createEl("button", {
            text: "Clear filters",
            cls: "task-chat-filter-button-clear",
        });
        clearBtn.addEventListener("click", () => {
            this.filter = {};
            this.onOpen(); // Refresh the modal
        });

        const cancelBtn = buttonContainer.createEl("button", {
            text: "Cancel",
            cls: "task-chat-filter-button-cancel",
        });
        cancelBtn.addEventListener("click", () => {
            this.close();
        });

        const applyBtn = buttonContainer.createEl("button", {
            text: "Apply",
            cls: "task-chat-filter-button-apply mod-cta",
        });
        applyBtn.addEventListener("click", () => {
            console.debug(
                "[FilterModal] Applying filter:",
                JSON.stringify(this.filter, null, 2),
            );
            this.onSubmit(this.filter);
            this.close();
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
