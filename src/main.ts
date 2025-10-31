import {
    Plugin,
    WorkspaceLeaf,
    Notice,
    TFile,
    TFolder,
    moment,
} from "obsidian";
import { SettingsTab } from "./views/settingsTab";
import { PluginSettings, DEFAULT_SETTINGS } from "./settings";
import { Task, TaskFilter } from "./models/task";
import { TaskIndexService } from "./services/tasks/taskIndexService";
import { ChatView, CHAT_VIEW_TYPE } from "./views/chatView";
import { FilterModal } from "./views/filterModal";
import { SessionManager } from "./views/sessionManager";
import { ModelProviderService } from "./services/ai/modelProviderService";
import { PricingService } from "./services/ai/pricingService";
import { StopWords } from "./utils/stopWords";
import { Logger } from "./utils/logger";

export default class TaskChatPlugin extends Plugin {
    settings: PluginSettings;
    private allTasks: Task[] = [];
    private chatView: ChatView | null = null;
    sessionManager: SessionManager;
    private taskCount = 0;
    private taskCountLastUpdated = 0;
    private autoRefreshInterval: number | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();

        // Initialize logger with settings
        Logger.initialize(this.settings);
        Logger.info("Loading Task Chat plugin");

        // Initialize session manager
        this.sessionManager = new SessionManager();
        this.sessionManager.loadFromData(this.settings.sessionData);

        // Check if task indexing API is available
        if (!TaskIndexService.isAnyAPIAvailable(this.app)) {
            Logger.warn(
                "No task indexing API available (Datacore or Dataview required)",
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
                await this.refreshTaskCount();
                new Notice("Tasks refreshed");
            },
        });

        // Add command to send chat message
        // Users can bind this to their preferred hotkey in Settings → Hotkeys
        this.addCommand({
            id: "send-chat-message",
            name: "Send chat message",
            checkCallback: (checking: boolean) => {
                // Only available when chat view is active
                const leaves =
                    this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
                if (leaves.length > 0 && this.chatView) {
                    if (!checking) {
                        this.chatView.sendMessageFromCommand();
                    }
                    return true;
                }
                return false;
            },
        });

        // Add command to add active note to filter
        this.addCommand({
            id: "add-active-note-to-filter",
            name: "Add active note to filter",
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                // Only available if there's an active markdown file
                if (activeFile && activeFile.extension === "md") {
                    if (!checking) {
                        this.addNoteToFilter(activeFile.path);
                    }
                    return true;
                }
                return false;
            },
        });

        // Register file menu event for adding notes to filter (right-click context menu)
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                if (file instanceof TFolder) {
                    // This is a folder
                    menu.addItem((item) => {
                        item.setTitle("Add to Task Chat filter")
                            .setIcon("filter")
                            .onClick(() => {
                                this.addFolderToFilter(file.path);
                            });
                    });
                } else if (file instanceof TFile && file.extension === "md") {
                    // This is a markdown file
                    menu.addItem((item) => {
                        item.setTitle("Add to Task Chat filter")
                            .setIcon("filter")
                            .onClick(() => {
                                this.addNoteToFilter(file.path);
                            });
                    });
                }
            }),
        );

        // Add settings tab
        this.addSettingTab(new SettingsTab(this.app, this));

        // Load tasks on startup
        this.app.workspace.onLayoutReady(async () => {
            // CRITICAL: Wait for task indexing API to be fully ready before loading tasks
            await this.waitForTaskIndexAPI();

            // Give API extra time to finish initial indexing
            // Datacore/Dataview may report "ready" but still be indexing
            Logger.info("Waiting for API to complete initial indexing...");
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // OPTIMIZATION: Don't load full task list on startup!
            // Only get task count (20-30x faster, no memory waste)
            // Full task list will be queried on-demand when user sends query
            Logger.info("Getting task count on startup (lightweight)...");
            await this.updateTaskCount();
            Logger.info(
                `Startup complete. Task count: ${this.taskCount} (exclusions applied)`,
            );

            // Note: this.allTasks remains empty until first query
            // This saves memory and startup time for large vaults

            // Start auto-refresh if enabled
            if (this.settings.autoRefreshTaskCount) {
                this.startAutoRefreshTaskCount();
                Logger.info(
                    `Auto-refresh started (interval: ${this.settings.autoRefreshTaskCountInterval}s)`,
                );
            }

            // Auto-open sidebar if enabled
            if (this.settings.autoOpenSidebar) {
                await this.activateView();
            }
        });

        // File change listeners removed - we rely on DataCore/DataView APIs
        // If they haven't detected changes, our queries return the same results anyway
    }

    onunload(): void {
        Logger.info("Unloading Task Chat plugin");
        this.stopAutoRefreshTaskCount();
        this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
    }

    async loadSettings(): Promise<void> {
        const loadedData = await this.loadData();

        // Deep merge: Start with defaults
        this.settings = Object.assign({}, DEFAULT_SETTINGS);

        // Then merge loaded data, but do DEEP merge for providerConfigs
        if (loadedData) {
            // Merge top-level settings
            Object.assign(this.settings, loadedData);

            // Deep merge provider configs to preserve defaults
            if (loadedData.providerConfigs) {
                for (const provider of [
                    "openai",
                    "anthropic",
                    "openrouter",
                    "ollama",
                ] as const) {
                    if (loadedData.providerConfigs[provider]) {
                        // Merge loaded config with defaults for this provider
                        this.settings.providerConfigs[provider] = Object.assign(
                            {},
                            DEFAULT_SETTINGS.providerConfigs[provider],
                            loadedData.providerConfigs[provider],
                        );
                    }
                }
            }
        }

        // Ensure exclusions structure exists with all required fields
        if (!this.settings.exclusions) {
            this.settings.exclusions = {
                noteTags: [],
                taskTags: [],
                folders: [],
                notes: [],
            };
        } else {
            // Ensure new fields exist (for existing settings)
            if (!this.settings.exclusions.noteTags) {
                this.settings.exclusions.noteTags = [];
            }
            if (!this.settings.exclusions.taskTags) {
                this.settings.exclusions.taskTags = [];
            }
            if (!this.settings.exclusions.folders) {
                this.settings.exclusions.folders = [];
            }
            if (!this.settings.exclusions.notes) {
                this.settings.exclusions.notes = [];
            }
        }

        // Initialize user stop words (combines with internal stop words)
        StopWords.setUserStopWords(this.settings.userStopWords || []);

        // Auto-load models if not already cached
        this.loadModelsInBackground();
    }

    /**
     * Load models and pricing in background without blocking startup
     */
    private async loadModelsInBackground(): Promise<void> {
        // Wait a bit for the plugin to fully initialize
        setTimeout(async () => {
            const provider = this.settings.aiProvider;
            const providerConfig = this.settings.providerConfigs[provider];
            const cached = providerConfig.availableModels;

            // Auto-refresh pricing if stale (older than 24 hours)
            if (
                PricingService.shouldRefreshPricing(
                    this.settings.pricingCache.lastUpdated,
                )
            ) {
                Logger.debug(
                    "Pricing cache is stale, refreshing in background...",
                );
                try {
                    const pricing =
                        await PricingService.fetchPricingFromOpenRouter();
                    if (Object.keys(pricing).length > 0) {
                        this.settings.pricingCache.data = pricing;
                        this.settings.pricingCache.lastUpdated = Date.now();
                        await this.saveSettings();
                        Logger.debug(
                            `Updated pricing for ${Object.keys(pricing).length} models`,
                        );
                    }
                } catch (error) {
                    Logger.warn(
                        "Failed to refresh pricing, using cached/embedded rates",
                        error,
                    );
                }
            }

            // Only load models if cache is empty
            if (!cached || cached.length === 0) {
                Logger.debug(`Loading ${provider} models in background...`);
                try {
                    let models: string[] = [];

                    switch (provider) {
                        case "openai":
                            if (providerConfig.apiKey) {
                                models =
                                    await ModelProviderService.fetchOpenAIModels(
                                        providerConfig.apiKey,
                                    );
                            } else {
                                models =
                                    ModelProviderService.getDefaultOpenAIModels();
                            }
                            break;
                        case "anthropic":
                            models =
                                ModelProviderService.getDefaultAnthropicModels();
                            break;
                        case "openrouter":
                            if (providerConfig.apiKey) {
                                models =
                                    await ModelProviderService.fetchOpenRouterModels(
                                        providerConfig.apiKey,
                                    );
                            } else {
                                models =
                                    ModelProviderService.getDefaultOpenRouterModels();
                            }
                            break;
                        case "ollama":
                            models =
                                await ModelProviderService.fetchOllamaModels(
                                    providerConfig.apiEndpoint,
                                );
                            break;
                    }

                    if (models.length > 0) {
                        providerConfig.availableModels = models;
                        await this.saveSettings();
                        Logger.debug(
                            `Loaded ${models.length} ${provider} models`,
                        );
                    }
                } catch (error) {
                    Logger.error("Error loading models in background:", error);
                }
            }

            // Refresh pricing if needed (older than 24 hours)
            if (
                PricingService.shouldRefreshPricing(
                    this.settings.pricingCache.lastUpdated,
                )
            ) {
                Logger.debug(
                    "Pricing cache is stale, refreshing from OpenRouter API...",
                );
                try {
                    const pricing =
                        await PricingService.fetchPricingFromOpenRouter();
                    if (Object.keys(pricing).length > 0) {
                        this.settings.pricingCache.data = pricing;
                        this.settings.pricingCache.lastUpdated = Date.now();
                        await this.saveSettings();
                        Logger.debug(
                            `Updated pricing for ${Object.keys(pricing).length} models`,
                        );
                    }
                } catch (error) {
                    Logger.error("Error refreshing pricing:", error);
                }
            } else {
                Logger.debug(
                    `Pricing cache is fresh (updated ${PricingService.getTimeSinceUpdate(this.settings.pricingCache.lastUpdated)})`,
                );
            }
        }, 2000); // Wait 2 seconds after startup
    }

    async saveSettings(): Promise<void> {
        // Save session data before persisting
        if (this.sessionManager) {
            this.settings.sessionData = this.sessionManager.exportData();
        }
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
     * Refresh chat view chat mode dropdown when default chat mode changes
     */
    refreshChatViewChatMode(): void {
        if (this.chatView) {
            // If user hasn't overridden (using default), sync currentChatMode to new default
            const isUsingDefault = this.chatView.getChatModeOverride() === null;
            if (isUsingDefault) {
                this.settings.currentChatMode = this.settings.defaultChatMode;
                this.saveSettings();
            }

            this.chatView.updateChatModeOptions();
        }
    }

    /**
     * Wait for task indexing API (Datacore or Dataview) to be fully loaded and ready
     * Polls every 500ms for up to 10 seconds
     */
    private async waitForTaskIndexAPI(maxAttempts = 20): Promise<void> {
        const success = await TaskIndexService.waitForAPI(
            this.app,
            this.settings,
            maxAttempts,
        );

        if (!success) {
            Logger.warn(
                "Task indexing API not available after waiting 10 seconds - tasks may not load correctly",
            );
            new Notice(
                "Task indexing API not detected. Please install Datacore or Dataview plugin.",
                5000,
            );
        }
    }

    /**
     * Refresh task count and invalidate cache
     * OPTIMIZATION: Doesn't load full task list (expensive)
     * Just updates count and clears cache for next query
     *
     * @param updateChatView - If true, update the chat view count (default: true)
     * @param options - Optional configuration for refresh behavior
     */
    /**
     * Refresh task count (lightweight operation)
     * Does NOT reload full task list - just updates count
     * Preserves cache for efficiency
     */
    async refreshTaskCount(
        updateChatView = true,
        options?: { showSystemMessage?: boolean; context?: string },
    ): Promise<void> {
        try {
            // Check if task indexing API is available
            if (!TaskIndexService.isAnyAPIAvailable(this.app)) {
                Logger.warn("No task indexing API available");
                return;
            }

            // OPTIMIZATION: Don't invalidate cache unnecessarily!
            // DataView/DataCore maintain their own indexes and will return fresh data
            // Cache invalidation is pointless and prevents warm cache benefits

            Logger.info(
                "Refreshing task count (cache preserved for efficiency)",
            );

            // Update chat view if it exists and updateChatView is true
            if (updateChatView && this.chatView) {
                // Get current filter
                const currentFilter = this.chatView.getCurrentFilter();

                // Update task count at top of chat view (lightweight!)
                const taskCount =
                    await this.getFilteredTaskCount(currentFilter);
                this.chatView.updateTaskCount(taskCount);

                // Clear cached tasks in chatView (lazy reload on next query)
                this.chatView.updateTasks([], currentFilter);

                // Optionally show system message
                if (options?.showSystemMessage) {
                    const message = options.context
                        ? `${options.context} Found ${taskCount} task${taskCount === 1 ? "" : "s"}.`
                        : `Tasks refreshed. Found ${taskCount} task${taskCount === 1 ? "" : "s"}.`;
                    await this.chatView.addSystemMessage(message);
                }

                Logger.debug(
                    `Task count updated: ${taskCount} (cache invalidated, will reload on next query)`,
                );
            }
        } catch (error) {
            Logger.error("Error refreshing tasks:", error);
            new Notice("Failed to refresh tasks");
        }
    }

    /**
     * Get all tasks
     */
    getAllTasks(): Task[] {
        return this.allTasks;
    }

    /**
     * Get filtered tasks using DataView API
     * Applies chat interface filters (inclusion) on top of exclusions
     */
    async getFilteredTasks(filter: TaskFilter): Promise<Task[]> {
        // Check if filter is empty (no filters applied at all)
        const hasAnyFilter =
            (filter.folders && filter.folders.length > 0) ||
            (filter.noteTags && filter.noteTags.length > 0) ||
            (filter.taskTags && filter.taskTags.length > 0) ||
            (filter.notes && filter.notes.length > 0) ||
            (filter.priorities && filter.priorities.length > 0) ||
            filter.dueDateRange ||
            (filter.taskStatuses && filter.taskStatuses.length > 0);

        // If no filters at all, return all tasks directly (already has exclusions applied)
        if (!hasAnyFilter) {
            return this.allTasks;
        }

        // Use shared utility methods from TaskIndexService (avoids code duplication)
        const propertyFilters = TaskIndexService.buildPropertyFilters(filter);
        const inclusionFilters = TaskIndexService.buildInclusionFilters(filter);

        // Use task indexing API with both property and inclusion filters
        const tasks = await TaskIndexService.parseTasksFromIndex(
            this.app,
            this.settings,
            undefined,
            propertyFilters,
            inclusionFilters,
        );

        return tasks;
    }

    /**
     * Open filter modal
     */
    openFilterModal(
        allTasks: Task[],
        currentFilter: TaskFilter,
        onSubmit: (filter: TaskFilter) => void,
    ): void {
        new FilterModal(
            this.app,
            this,
            allTasks,
            currentFilter,
            onSubmit,
        ).open();
    }

    /**
     * Add a note to the filter and update the chat view
     */
    async addNoteToFilter(notePath: string): Promise<void> {
        // Get current filter from settings
        const currentFilter = this.settings.currentFilter || {};

        // Initialize notes array if it doesn't exist
        if (!currentFilter.notes) {
            currentFilter.notes = [];
        }

        // Check if note is already in filter
        if (currentFilter.notes.includes(notePath)) {
            new Notice("Note is already in filter");
            return;
        }

        // Add note to filter
        currentFilter.notes.push(notePath);

        // Update the filter in chat view if it exists
        if (this.chatView) {
            await this.chatView.setFilter(currentFilter);

            // Show success message with note name
            const fileName = notePath.split("/").pop() || notePath;
            new Notice(`Added "${fileName}" to Task Chat filter`);

            // Activate the chat view to show the updated filter
            await this.activateView();
        } else {
            // If chat view doesn't exist, just save the filter to settings
            this.settings.currentFilter = { ...currentFilter };
            await this.saveSettings();

            const fileName = notePath.split("/").pop() || notePath;
            new Notice(
                `Added "${fileName}" to filter. Open Task Chat to see results.`,
            );
        }
    }

    /**
     * Add a folder to the filter and update the chat view
     */
    async addFolderToFilter(folderPath: string): Promise<void> {
        // Get current filter from settings
        const currentFilter = this.settings.currentFilter || {};

        // Initialize folders array if it doesn't exist
        if (!currentFilter.folders) {
            currentFilter.folders = [];
        }

        // Check if folder is already in filter
        if (currentFilter.folders.includes(folderPath)) {
            new Notice("Folder is already in filter");
            return;
        }

        // Add folder to filter
        currentFilter.folders.push(folderPath);

        // Update the filter in chat view if it exists
        if (this.chatView) {
            await this.chatView.setFilter(currentFilter);

            // Show success message with folder name
            const folderName = folderPath.split("/").pop() || folderPath;
            new Notice(`Added folder "${folderName}" to Task Chat filter`);

            // Activate the chat view to show the updated filter
            await this.activateView();
        } else {
            // If chat view doesn't exist, just save the filter to settings
            this.settings.currentFilter = { ...currentFilter };
            await this.saveSettings();

            const folderName = folderPath.split("/").pop() || folderPath;
            new Notice(
                `Added folder "${folderName}" to filter. Open Task Chat to see results.`,
            );
        }
    }

    /**
     * Get cached task count
     */
    getTaskCount(): number {
        return this.taskCount;
    }

    /**
     * Get last updated timestamp for task count
     */
    getTaskCountLastUpdated(): number {
        return this.taskCountLastUpdated;
    }

    /**
     * Update task count with current filter
     * This is a lightweight operation (20-30x faster than full refresh)
     *
     * @param filter - Optional filter to apply
     */
    async updateTaskCount(filter?: TaskFilter): Promise<number> {
        try {
            const startTime = moment().valueOf();
            const count = await this.getFilteredTaskCount(filter || {});
            this.taskCount = count;
            this.taskCountLastUpdated = moment().valueOf();

            // Update UI if ChatView is open
            if (this.chatView) {
                this.chatView.updateTaskCount(count);
            }

            const elapsed = moment().valueOf() - startTime;
            Logger.debug(`Task count updated: ${count} (took ${elapsed}ms)`);
            return count;
        } catch (error) {
            Logger.error("Error updating task count:", error);
            return 0;
        }
    }

    /**
     * Get filtered task count using DataView/DataCore API
     * Lightweight method that only counts, doesn't create Task objects
     * Uses shared utilities from TaskIndexService
     */
    async getFilteredTaskCount(filter: TaskFilter): Promise<number> {
        // Use shared utility methods from TaskIndexService (avoids code duplication)
        const propertyFilters = TaskIndexService.buildPropertyFilters(filter);
        const inclusionFilters = TaskIndexService.buildInclusionFilters(filter);

        // Call lightweight count API
        return await TaskIndexService.getTaskCount(
            this.app,
            this.settings,
            propertyFilters,
            inclusionFilters,
        );
    }

    /**
     * Start auto-refresh task count interval
     */
    startAutoRefreshTaskCount(): void {
        if (this.autoRefreshInterval) {
            Logger.debug("Auto-refresh already running");
            return;
        }

        const intervalMs = this.settings.autoRefreshTaskCountInterval * 1000;

        Logger.info(
            `Starting auto-refresh task count (interval: ${this.settings.autoRefreshTaskCountInterval}s)`,
        );

        this.autoRefreshInterval = window.setInterval(async () => {
            try {
                // OPTIMIZATION: Don't load full task list!
                // Just update count (lightweight, 20-30x faster)
                const previousCount = this.taskCount;

                // No cache invalidation needed - DataView/DataCore maintain their own indexes
                // Preserving cache improves performance for rapid repeated queries

                // Update task count in UI (silent, no system message)
                const filter = this.chatView?.getCurrentFilter() || {};
                await this.updateTaskCount(filter);

                // Log if count changed
                const newCount = this.taskCount;
                if (newCount !== previousCount) {
                    Logger.info(
                        `Auto-refresh: Task count changed from ${previousCount} to ${newCount}`,
                    );
                } else {
                    Logger.debug(
                        `Auto-refresh completed (${newCount} tasks, no change)`,
                    );
                }
            } catch (error) {
                Logger.error("Auto-refresh failed:", error);
            }
        }, intervalMs);
    }

    /**
     * Stop auto-refresh task count interval
     */
    stopAutoRefreshTaskCount(): void {
        if (this.autoRefreshInterval) {
            window.clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            Logger.info("Stopped auto-refresh task count");
        }
    }
}
