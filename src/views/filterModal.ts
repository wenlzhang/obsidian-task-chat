import { App, Modal, Setting, moment } from "obsidian";
import { TaskFilter } from "../models/task";
import { TaskFilterService } from "../services/taskFilterService";
import { Task } from "../models/task";

export class FilterModal extends Modal {
    private filter: TaskFilter;
    private onSubmit: (filter: TaskFilter) => void;
    private allTasks: Task[];

    constructor(
        app: App,
        allTasks: Task[],
        currentFilter: TaskFilter,
        onSubmit: (filter: TaskFilter) => void,
    ) {
        super(app);
        this.allTasks = allTasks;
        this.filter = { ...currentFilter };
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Filter tasks" });

        // Text filter
        new Setting(contentEl)
            .setName("Search text")
            .setDesc("Filter tasks by text content")
            .addText((text) =>
                text
                    .setPlaceholder("Enter search text")
                    .setValue(this.filter.text || "")
                    .onChange((value) => {
                        this.filter.text = value;
                    }),
            );

        // Folder filter
        const folders = TaskFilterService.getUniqueFolders(this.allTasks);
        if (folders.length > 0) {
            const folderSetting = new Setting(contentEl)
                .setName("Folders")
                .setDesc("Filter by folders (comma-separated)");

            folderSetting.addText((text) => {
                text.setPlaceholder("folder1, folder2")
                    .setValue(
                        this.filter.folders
                            ? this.filter.folders.join(", ")
                            : "",
                    )
                    .onChange((value) => {
                        this.filter.folders = value
                            .split(",")
                            .map((f) => f.trim())
                            .filter((f) => f.length > 0);
                    });
            });

            folderSetting.descEl.createDiv({
                text: `Available: ${folders.join(", ")}`,
                cls: "setting-item-description",
            });
        }

        // Priority filter
        const priorities = TaskFilterService.getUniquePriorities(this.allTasks);
        if (priorities.length > 0) {
            const prioritySetting = new Setting(contentEl)
                .setName("Priorities")
                .setDesc("Filter by priorities");

            priorities.forEach((priority) => {
                prioritySetting.addToggle((toggle) =>
                    toggle
                        .setValue(
                            this.filter.priorities?.includes(priority) || false,
                        )
                        .onChange((value) => {
                            if (!this.filter.priorities) {
                                this.filter.priorities = [];
                            }

                            if (value) {
                                if (
                                    !this.filter.priorities.includes(priority)
                                ) {
                                    this.filter.priorities.push(priority);
                                }
                            } else {
                                this.filter.priorities =
                                    this.filter.priorities.filter(
                                        (p) => p !== priority,
                                    );
                            }
                        })
                        .then((toggle) => {
                            toggle.toggleEl.insertAdjacentText(
                                "beforebegin",
                                `${priority} `,
                            );
                        }),
                );
            });
        }

        // Completion status filter
        new Setting(contentEl)
            .setName("Completion status")
            .setDesc("Filter by completion status")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("all", "All")
                    .addOption("completed", "Completed")
                    .addOption("incomplete", "Incomplete")
                    .setValue(this.filter.completionStatus || "all")
                    .onChange((value) => {
                        this.filter.completionStatus = value as
                            | "completed"
                            | "incomplete"
                            | "all";
                    }),
            );

        // Task status filter
        const statuses = TaskFilterService.getUniqueStatusCategories(
            this.allTasks,
        );
        if (statuses.length > 0) {
            const statusSetting = new Setting(contentEl)
                .setName("Task statuses")
                .setDesc("Filter by task status categories");

            statuses.forEach((status) => {
                statusSetting.addToggle((toggle) =>
                    toggle
                        .setValue(
                            this.filter.taskStatuses?.includes(status) || false,
                        )
                        .onChange((value) => {
                            if (!this.filter.taskStatuses) {
                                this.filter.taskStatuses = [];
                            }

                            if (value) {
                                if (
                                    !this.filter.taskStatuses.includes(status)
                                ) {
                                    this.filter.taskStatuses.push(status);
                                }
                            } else {
                                this.filter.taskStatuses =
                                    this.filter.taskStatuses.filter(
                                        (s) => s !== status,
                                    );
                            }
                        })
                        .then((toggle) => {
                            toggle.toggleEl.insertAdjacentText(
                                "beforebegin",
                                `${status} `,
                            );
                        }),
                );
            });
        }

        // Due date range filter
        contentEl.createEl("h3", { text: "Due date range" });

        new Setting(contentEl)
            .setName("Start date")
            .setDesc("Filter tasks due on or after this date (YYYY-MM-DD)")
            .addText((text) =>
                text
                    .setPlaceholder("YYYY-MM-DD")
                    .setValue(this.filter.dueDateRange?.start || "")
                    .onChange((value) => {
                        if (!this.filter.dueDateRange) {
                            this.filter.dueDateRange = {};
                        }
                        this.filter.dueDateRange.start = value || undefined;
                    }),
            );

        new Setting(contentEl)
            .setName("End date")
            .setDesc("Filter tasks due on or before this date (YYYY-MM-DD)")
            .addText((text) =>
                text
                    .setPlaceholder("YYYY-MM-DD")
                    .setValue(this.filter.dueDateRange?.end || "")
                    .onChange((value) => {
                        if (!this.filter.dueDateRange) {
                            this.filter.dueDateRange = {};
                        }
                        this.filter.dueDateRange.end = value || undefined;
                    }),
            );

        // Quick date filters
        const quickDateContainer = contentEl.createDiv("quick-date-filters");
        quickDateContainer.createEl("h4", { text: "Quick filters" });

        const buttonContainer =
            quickDateContainer.createDiv("button-container");

        const addQuickFilter = (label: string, days: number) => {
            const btn = buttonContainer.createEl("button", { text: label });
            btn.addEventListener("click", () => {
                const today = moment().startOf("day");
                const endDate = moment().add(days, "days").endOf("day");

                if (!this.filter.dueDateRange) {
                    this.filter.dueDateRange = {};
                }

                this.filter.dueDateRange.start = today.format("YYYY-MM-DD");
                this.filter.dueDateRange.end = endDate.format("YYYY-MM-DD");

                this.onOpen(); // Refresh the modal
            });
        };

        addQuickFilter("Today", 0);
        addQuickFilter("This week", 7);
        addQuickFilter("This month", 30);

        // Buttons
        const buttonEl = contentEl.createDiv("modal-button-container");

        const clearBtn = buttonEl.createEl("button", { text: "Clear filters" });
        clearBtn.addEventListener("click", () => {
            this.filter = {};
            this.onOpen(); // Refresh the modal
        });

        const cancelBtn = buttonEl.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
        });

        const applyBtn = buttonEl.createEl("button", {
            text: "Apply",
            cls: "mod-cta",
        });
        applyBtn.addEventListener("click", () => {
            this.onSubmit(this.filter);
            this.close();
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
