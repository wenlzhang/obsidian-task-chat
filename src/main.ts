import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { SettingsTab } from "./settingsTab";
import { PluginSettings, DEFAULT_SETTINGS } from "./settings";
import { Task, TaskFilter } from "./models/task";
import { DataviewService } from "./services/dataviewService";
import { TaskFilterService } from "./services/taskFilterService";
import { ChatView, CHAT_VIEW_TYPE } from "./views/chatView";
import { FilterModal } from "./views/filterModal";

export default class TaskChatPlugin extends Plugin {
    settings: PluginSettings;
    private allTasks: Task[] = [];
    private chatView: ChatView | null = null;

    async onload(): Promise<void> {
        console.log("Loading Task Chat plugin");

        await this.loadSettings();

        // Check if DataView is available
        if (!DataviewService.isDataviewEnabled(this.app)) {
            console.warn("DataView plugin is not enabled");
            new Notice(
                "Task Chat requires the DataView plugin. Please install and enable it.",
                10000,
            );
        }

        // Register the chat view
        this.registerView(CHAT_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
            this.chatView = new ChatView(leaf, this);
            return this.chatView;
        });

        // Add ribbon icon
        this.addRibbonIcon("messages-square", "Task Chat", () => {
            this.activateView();
        });

        // Add command to open chat view
        this.addCommand({
            id: "open-task-chat",
            name: "Open Task Chat",
            callback: () => {
                this.activateView();
            },
        });

        // Add command to refresh tasks
        this.addCommand({
            id: "refresh-tasks",
            name: "Refresh tasks",
            callback: async () => {
                await this.refreshTasks();
                new Notice("Tasks refreshed");
            },
        });

        // Add settings tab
        this.addSettingTab(new SettingsTab(this.app, this));

        // Load tasks on startup
        this.app.workspace.onLayoutReady(async () => {
            await this.refreshTasks();

            // Auto-open sidebar if enabled
            if (this.settings.autoOpenSidebar) {
                await this.activateView();
            }
        });

        // Listen for file changes to refresh tasks
        this.registerEvent(
            this.app.vault.on("modify", () => {
                // Debounce task refresh
                this.debouncedRefreshTasks();
            }),
        );

        this.registerEvent(
            this.app.vault.on("create", () => {
                this.debouncedRefreshTasks();
            }),
        );

        this.registerEvent(
            this.app.vault.on("delete", () => {
                this.debouncedRefreshTasks();
            }),
        );
    }

    onunload(): void {
        console.log("Unloading Task Chat plugin");
        this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    /**
     * Activate the chat view
     */
    async activateView(): Promise<void> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(CHAT_VIEW_TYPE);

        if (leaves.length > 0) {
            // View already exists, reveal it
            leaf = leaves[0];
        } else {
            // Create new view in right sidebar
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: CHAT_VIEW_TYPE,
                    active: true,
                });
                leaf = rightLeaf;
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Refresh all tasks from DataView
     */
    async refreshTasks(): Promise<void> {
        try {
            this.allTasks = await DataviewService.parseTasksFromDataview(
                this.app,
                this.settings,
            );

            // Update chat view with all tasks
            if (this.chatView) {
                this.chatView.updateTasks(this.allTasks);
            }
        } catch (error) {
            console.error("Error refreshing tasks:", error);
            new Notice("Failed to refresh tasks");
        }
    }

    private refreshTimeout: NodeJS.Timeout | null = null;

    /**
     * Debounced refresh to avoid excessive updates
     */
    private debouncedRefreshTasks(): void {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        this.refreshTimeout = setTimeout(() => {
            this.refreshTasks();
        }, 2000);
    }

    /**
     * Get all tasks
     */
    getAllTasks(): Task[] {
        return this.allTasks;
    }

    /**
     * Get filtered tasks
     */
    getFilteredTasks(filter: TaskFilter): Task[] {
        return TaskFilterService.filterTasks(this.allTasks, filter);
    }

    /**
     * Open filter modal
     */
    openFilterModal(onSubmit: (filter: TaskFilter) => void): void {
        const currentFilter = this.chatView
            ? this.chatView["currentFilter"] || {}
            : {};

        new FilterModal(
            this.app,
            this.allTasks,
            currentFilter,
            onSubmit,
        ).open();
    }
}
