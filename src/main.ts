import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { SettingsTab } from "./settingsTab";
import { PluginSettings, DEFAULT_SETTINGS } from "./settings";
import { Task, TaskFilter } from "./models/task";
import { DataviewService } from "./services/dataviewService";
import { TaskFilterService } from "./services/taskFilterService";
import { ChatView, CHAT_VIEW_TYPE } from "./views/chatView";
import { FilterModal } from "./views/filterModal";
import { SessionManager } from "./services/sessionManager";
import { ModelProviderService } from "./services/modelProviderService";
import { PricingService } from "./services/pricingService";
import { StopWords } from "./services/stopWords";

export default class TaskChatPlugin extends Plugin {
    settings: PluginSettings;
    private allTasks: Task[] = [];
    private chatView: ChatView | null = null;
    sessionManager: SessionManager;

    async onload(): Promise<void> {
        console.log("Loading Task Chat plugin");

        await this.loadSettings();

        // Initialize session manager
        this.sessionManager = new SessionManager();
        this.sessionManager.loadFromData(this.settings.sessionData);

        // Check if DataView is available
        if (!DataviewService.isDataviewEnabled(this.app)) {
            console.warn("DataView plugin is not enabled");
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
        const loadedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

        // Migrate old settings structure to new per-provider configuration
        if (loadedData) {
            this.migrateOldSettings(loadedData);
        }

        // Initialize user stop words (combines with internal stop words)
        StopWords.setUserStopWords(this.settings.userStopWords || []);

        // Auto-load models if not already cached
        this.loadModelsInBackground();
    }

    /**
     * Migrate old settings structure to new per-provider configuration
     * This ensures backward compatibility when users update the plugin
     */
    private migrateOldSettings(loadedData: any): void {
        // Check if old settings exist (before per-provider config was added)
        if (loadedData.openaiApiKey !== undefined) {
            console.log(
                "[Task Chat] Migrating old settings to per-provider configuration...",
            );

            // Migrate OpenAI settings
            if (loadedData.openaiApiKey) {
                this.settings.providerConfigs.openai.apiKey =
                    loadedData.openaiApiKey;
            }
            if (loadedData.aiProvider === "openai") {
                if (loadedData.model)
                    this.settings.providerConfigs.openai.model =
                        loadedData.model;
                if (loadedData.apiEndpoint)
                    this.settings.providerConfigs.openai.apiEndpoint =
                        loadedData.apiEndpoint;
                if (loadedData.temperature !== undefined)
                    this.settings.providerConfigs.openai.temperature =
                        loadedData.temperature;
                if (loadedData.maxTokensChat !== undefined)
                    this.settings.providerConfigs.openai.maxTokens =
                        loadedData.maxTokensChat;
            }

            // Migrate Anthropic settings
            if (loadedData.anthropicApiKey) {
                this.settings.providerConfigs.anthropic.apiKey =
                    loadedData.anthropicApiKey;
            }
            if (loadedData.aiProvider === "anthropic") {
                if (loadedData.model)
                    this.settings.providerConfigs.anthropic.model =
                        loadedData.model;
                if (loadedData.apiEndpoint)
                    this.settings.providerConfigs.anthropic.apiEndpoint =
                        loadedData.apiEndpoint;
                if (loadedData.temperature !== undefined)
                    this.settings.providerConfigs.anthropic.temperature =
                        loadedData.temperature;
                if (loadedData.maxTokensChat !== undefined)
                    this.settings.providerConfigs.anthropic.maxTokens =
                        loadedData.maxTokensChat;
            }

            // Migrate OpenRouter settings
            if (loadedData.openrouterApiKey) {
                this.settings.providerConfigs.openrouter.apiKey =
                    loadedData.openrouterApiKey;
            }
            if (loadedData.aiProvider === "openrouter") {
                if (loadedData.model)
                    this.settings.providerConfigs.openrouter.model =
                        loadedData.model;
                if (loadedData.apiEndpoint)
                    this.settings.providerConfigs.openrouter.apiEndpoint =
                        loadedData.apiEndpoint;
                if (loadedData.temperature !== undefined)
                    this.settings.providerConfigs.openrouter.temperature =
                        loadedData.temperature;
                if (loadedData.maxTokensChat !== undefined)
                    this.settings.providerConfigs.openrouter.maxTokens =
                        loadedData.maxTokensChat;
            }

            // Migrate Ollama settings
            if (loadedData.aiProvider === "ollama") {
                if (loadedData.model)
                    this.settings.providerConfigs.ollama.model =
                        loadedData.model;
                if (loadedData.apiEndpoint)
                    this.settings.providerConfigs.ollama.apiEndpoint =
                        loadedData.apiEndpoint;
                if (loadedData.temperature !== undefined)
                    this.settings.providerConfigs.ollama.temperature =
                        loadedData.temperature;
                if (loadedData.maxTokensChat !== undefined)
                    this.settings.providerConfigs.ollama.maxTokens =
                        loadedData.maxTokensChat;
            }

            // Migrate available models
            if (loadedData.availableModels) {
                if (loadedData.availableModels.openai) {
                    this.settings.providerConfigs.openai.availableModels =
                        loadedData.availableModels.openai;
                }
                if (loadedData.availableModels.anthropic) {
                    this.settings.providerConfigs.anthropic.availableModels =
                        loadedData.availableModels.anthropic;
                }
                if (loadedData.availableModels.openrouter) {
                    this.settings.providerConfigs.openrouter.availableModels =
                        loadedData.availableModels.openrouter;
                }
                if (loadedData.availableModels.ollama) {
                    this.settings.providerConfigs.ollama.availableModels =
                        loadedData.availableModels.ollama;
                }
            }

            // Save migrated settings
            this.saveSettings();
            console.log("[Task Chat] Migration completed successfully");
        }
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
                console.log(
                    "[Task Chat] Pricing cache is stale, refreshing in background...",
                );
                try {
                    const pricing =
                        await PricingService.fetchPricingFromOpenRouter();
                    if (Object.keys(pricing).length > 0) {
                        this.settings.pricingCache.data = pricing;
                        this.settings.pricingCache.lastUpdated = Date.now();
                        await this.saveSettings();
                        console.log(
                            `[Task Chat] Updated pricing for ${Object.keys(pricing).length} models`,
                        );
                    }
                } catch (error) {
                    console.warn(
                        "[Task Chat] Failed to refresh pricing, using cached/embedded rates",
                        error,
                    );
                }
            }

            // Only load models if cache is empty
            if (!cached || cached.length === 0) {
                console.log(`Loading ${provider} models in background...`);
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
                        console.log(
                            `Loaded ${models.length} ${provider} models`,
                        );
                    }
                } catch (error) {
                    console.error("Error loading models in background:", error);
                }
            }

            // Refresh pricing if needed (older than 24 hours)
            if (
                PricingService.shouldRefreshPricing(
                    this.settings.pricingCache.lastUpdated,
                )
            ) {
                console.log(
                    "Pricing cache is stale, refreshing from OpenRouter API...",
                );
                try {
                    const pricing =
                        await PricingService.fetchPricingFromOpenRouter();
                    if (Object.keys(pricing).length > 0) {
                        this.settings.pricingCache.data = pricing;
                        this.settings.pricingCache.lastUpdated = Date.now();
                        await this.saveSettings();
                        console.log(
                            `Updated pricing for ${Object.keys(pricing).length} models`,
                        );
                    }
                } catch (error) {
                    console.error("Error refreshing pricing:", error);
                }
            } else {
                console.log(
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
     * Refresh all tasks from DataView
     */
    async refreshTasks(): Promise<void> {
        try {
            // Check if DataView is enabled
            if (!DataviewService.isDataviewEnabled(this.app)) {
                console.warn("DataView plugin is not enabled");
                return;
            }

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
