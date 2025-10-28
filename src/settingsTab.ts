import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import TaskChatPlugin from "./main";
import { ModelProviderService } from "./services/modelProviderService";
import { PricingService } from "./services/pricingService";
import { TaskPropertyService } from "./services/taskPropertyService";
import {
    DEFAULT_SETTINGS,
    isStatusCategoryProtected,
    isStatusCategoryFullyLocked,
    PROTECTED_STATUS_CATEGORIES,
} from "./settings";
import { StopWords } from "./services/stopWords";
import { Logger } from "./utils/logger";
import {
    generateModelValidationWarning,
    generateModelListNotLoadedInfo,
} from "./services/warningService";
import { ExclusionsModal } from "./views/exclusionsModal";

export class SettingsTab extends PluginSettingTab {
    plugin: TaskChatPlugin;
    private sortBySetting: Setting | null = null;
    private sortByContainerEl: HTMLElement | null = null;
    private updateMaxScoreDisplay?: () => void;

    constructor(app: App, plugin: TaskChatPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ========================================
        // UNDERSTANDING SETTINGS OVERVIEW
        // ========================================
        // AI Provider
        new Setting(containerEl).setName("AI provider").setHeading();

        const aiProviderInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        aiProviderInfo.createEl("p", {
            text: "Choose your AI provider and configure API key, model selection, and connection settings.",
        });
        const p = aiProviderInfo.createEl("p");
        p.createEl("a", {
            text: "→ Learn more about AI provider setup",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SETTINGS_GUIDE.md#1-ai-provider",
        });

        new Setting(containerEl)
            .setName("Provider")
            .setDesc(
                "Select your AI provider. Each provider has different requirements and capabilities.",
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("openai", "OpenAI")
                    .addOption("anthropic", "Anthropic")
                    .addOption("openrouter", "OpenRouter")
                    .addOption("ollama", "Ollama (Local)")
                    .setValue(this.plugin.settings.aiProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.aiProvider = value as any;
                        // Auto-configure provider defaults
                        await this.configureProviderDefaults(value);
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show provider-specific settings
                    }),
            );

        // Show API key only for cloud providers
        if (this.plugin.settings.aiProvider !== "ollama") {
            const currentApiKey = this.getCurrentApiKey();

            new Setting(containerEl)
                .setName("API key")
                .setDesc(this.getApiKeyDescription())
                .addText((text) =>
                    text
                        .setPlaceholder(this.getApiKeyPlaceholder())
                        .setValue(currentApiKey)
                        .onChange(async (value) => {
                            this.setCurrentApiKey(value);
                            await this.plugin.saveSettings();
                        })
                        .then((text) => {
                            text.inputEl.type = "password";
                        }),
                );
        }

        new Setting(containerEl)
            .setName("API endpoint")
            .setDesc(this.getEndpointDescription())
            .addText((text) =>
                text
                    .setPlaceholder(this.getEndpointPlaceholder())
                    .setValue(this.getCurrentProviderConfig().apiEndpoint)
                    .onChange(async (value) => {
                        this.getCurrentProviderConfig().apiEndpoint = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Add Test Connection button
        const testConnectionSetting = new Setting(containerEl)
            .setName("Connection")
            .setDesc(
                "Verify that your API key and model are working correctly",
            );

        testConnectionSetting.addButton((button) =>
            button
                .setButtonText("Test connection")
                .setTooltip("Verify API configuration")
                .onClick(async () => {
                    button.setButtonText("Testing...");
                    button.setDisabled(true);

                    const result = await this.testConnection();

                    button.setButtonText("Test connection");
                    button.setDisabled(false);

                    // Show result below the button
                    this.showConnectionTestResult(containerEl, result);
                }),
        );

        const tokenSetting = new Setting(containerEl)
            .setName("Max response tokens")
            .setDesc(
                "Maximum tokens for AI response generation. Affects BOTH Smart Search query parsing AND Task Chat responses.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(2000, 64000, 100)
                    .setValue(this.getCurrentProviderConfig().maxTokens)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.getCurrentProviderConfig().maxTokens = value;
                        await this.plugin.saveSettings();
                    }),
            );
        tokenSetting.descEl.createEl("br");
        tokenSetting.descEl.createEl("a", {
            text: "→ Learn more about max tokens and performance tuning",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/AI_PROVIDER_CONFIGURATION.md#-max-response-tokens",
        });

        const contextSetting = new Setting(containerEl)
            .setName("Context window")
            .setDesc("Increase if you get 'context length exceeded' errors.")
            .addSlider((slider) =>
                slider
                    .setLimits(64000, 2000000, 1000)
                    .setValue(this.getCurrentProviderConfig().contextWindow)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.getCurrentProviderConfig().contextWindow = value;
                        await this.plugin.saveSettings();
                    }),
            );
        contextSetting.descEl.createEl("br");
        contextSetting.descEl.createEl("a", {
            text: "→ Learn more about context window and troubleshooting",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/AI_PROVIDER_CONFIGURATION.md#-context-window",
        });

        // Model configuration subsection
        new Setting(containerEl).setName("Model configuration").setHeading();

        const modelConfigDesc = containerEl.createDiv({
            cls: "setting-item-description",
        });
        modelConfigDesc.createEl("p", {
            text: "Use different AI models for query parsing (Smart Search & Task Chat) and task analysis (Task Chat only) to optimize costs and performance.",
        });
        const modelConfigLink = modelConfigDesc.createEl("p");
        modelConfigLink.createEl("a", {
            text: "→ Learn more about model configuration",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/MODEL_CONFIGURATION.md",
        });

        // Parsing Model Configuration
        const parsingProviderSetting = new Setting(containerEl)
            .setName("Query parsing provider")
            .setDesc(
                "Provider for AI query parsing (Smart Search & Task Chat).",
            );

        parsingProviderSetting.addDropdown((dropdown) => {
            dropdown
                .addOption("openai", "OpenAI")
                .addOption("anthropic", "Anthropic")
                .addOption("openrouter", "OpenRouter")
                .addOption("ollama", "Ollama (Local)")
                .setValue(this.plugin.settings.parsingProvider)
                .onChange(async (value) => {
                    const newProvider = value as
                        | "openai"
                        | "anthropic"
                        | "openrouter"
                        | "ollama";
                    this.plugin.settings.parsingProvider = newProvider;
                    // Keep the current parsingModel - it persists across provider switches
                    // If user hasn't selected a model (empty string), getProviderForPurpose() will use provider's default
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to update model dropdown
                });
        });

        const parsingModelSetting = new Setting(containerEl)
            .setName("Query parsing model")
            .setDesc(this.getParsingModelDescription());

        // Add dropdown for parsing model selection
        parsingModelSetting.addDropdown((dropdown) => {
            const parsingProvider = this.plugin.settings.parsingProvider;
            const availableModels =
                this.getAvailableModelsForProvider(parsingProvider);
            const defaultModel =
                this.plugin.settings.providerConfigs[parsingProvider].model;

            if (availableModels.length === 0) {
                // No models cached - show default model
                dropdown.addOption(defaultModel, `${defaultModel} (default)`);
            } else {
                availableModels.forEach((model: string) => {
                    dropdown.addOption(model, model);
                });
            }

            // Use per-provider model storage (new approach) or fall back to provider's default
            const currentModel =
                this.plugin.settings.parsingModels?.[parsingProvider] ||
                defaultModel;
            dropdown.setValue(currentModel).onChange(async (value) => {
                // Store model selection per provider
                if (!this.plugin.settings.parsingModels) {
                    this.plugin.settings.parsingModels = {
                        openai: "",
                        anthropic: "",
                        openrouter: "",
                        ollama: "",
                    };
                }
                this.plugin.settings.parsingModels[parsingProvider] = value;
                await this.plugin.saveSettings();

                // Validate model selection
                this.validateModel(parsingProvider, value, "parsing");
            });
        });

        // Add refresh button for parsing models
        parsingModelSetting.addButton((button) =>
            button
                .setButtonText("Refresh")
                .setTooltip("Fetch latest available models")
                .onClick(async () => {
                    button.setButtonText("Loading...");
                    button.setDisabled(true);
                    await this.refreshModelsForProvider(
                        this.plugin.settings.parsingProvider,
                    );
                    button.setButtonText("Refresh");
                    button.setDisabled(false);
                    this.display(); // Refresh UI to show new models
                }),
        );

        // Add model count info for parsing
        const parsingModelInfo = containerEl.createDiv({
            cls: "setting-item-description model-info-display",
        });
        const parsingModelsCount = this.getAvailableModelsForProvider(
            this.plugin.settings.parsingProvider,
        ).length;
        if (parsingModelsCount > 0) {
            parsingModelInfo.setText(
                `${parsingModelsCount} models available - Click 'Refresh' to fetch from ${this.plugin.settings.parsingProvider}`,
            );
        } else {
            parsingModelInfo.setText(
                "Click 'Refresh' to fetch available models",
            );
        }

        // Parsing Temperature
        new Setting(containerEl)
            .setName("Query parsing temperature")
            .setDesc(
                "Temperature for query parsing (0.0-2.0). Lower = consistent, focused. Recommended: low values, e.g., 0.1 for reliable JSON output.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 2, 0.1)
                    .setValue(this.plugin.settings.parsingTemperature)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.parsingTemperature = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Analysis Model Configuration
        const analysisProviderSetting = new Setting(containerEl)
            .setName("Task analysis provider")
            .setDesc("Provider for AI task analysis (Task Chat mode only).");

        analysisProviderSetting.addDropdown((dropdown) => {
            dropdown
                .addOption("openai", "OpenAI")
                .addOption("anthropic", "Anthropic")
                .addOption("openrouter", "OpenRouter")
                .addOption("ollama", "Ollama (Local)")
                .setValue(this.plugin.settings.analysisProvider)
                .onChange(async (value) => {
                    const newProvider = value as
                        | "openai"
                        | "anthropic"
                        | "openrouter"
                        | "ollama";
                    this.plugin.settings.analysisProvider = newProvider;
                    // Keep the current analysisModel - it persists across provider switches
                    // If user hasn't selected a model (empty string), getProviderForPurpose() will use provider's default
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to update model dropdown
                });
        });

        const analysisModelSetting = new Setting(containerEl)
            .setName("Task analysis model")
            .setDesc(this.getAnalysisModelDescription());

        // Add dropdown for analysis model selection
        analysisModelSetting.addDropdown((dropdown) => {
            const analysisProvider = this.plugin.settings.analysisProvider;
            const availableModels =
                this.getAvailableModelsForProvider(analysisProvider);
            const defaultModel =
                this.plugin.settings.providerConfigs[analysisProvider].model;

            if (availableModels.length === 0) {
                // No models cached - show default model
                dropdown.addOption(defaultModel, `${defaultModel} (default)`);
            } else {
                availableModels.forEach((model: string) => {
                    dropdown.addOption(model, model);
                });
            }

            // Use per-provider model storage (new approach) or fall back to provider's default
            const currentModel =
                this.plugin.settings.analysisModels?.[analysisProvider] ||
                defaultModel;
            dropdown.setValue(currentModel).onChange(async (value) => {
                // Store model selection per provider
                if (!this.plugin.settings.analysisModels) {
                    this.plugin.settings.analysisModels = {
                        openai: "",
                        anthropic: "",
                        openrouter: "",
                        ollama: "",
                    };
                }
                this.plugin.settings.analysisModels[analysisProvider] = value;
                await this.plugin.saveSettings();

                // Validate model selection
                this.validateModel(analysisProvider, value, "analysis");
            });
        });

        // Add refresh button for analysis models
        analysisModelSetting.addButton((button) =>
            button
                .setButtonText("Refresh")
                .setTooltip("Fetch latest available models")
                .onClick(async () => {
                    button.setButtonText("Loading...");
                    button.setDisabled(true);
                    await this.refreshModelsForProvider(
                        this.plugin.settings.analysisProvider,
                    );
                    button.setButtonText("Refresh");
                    button.setDisabled(false);
                    this.display(); // Refresh UI to show new models
                }),
        );

        // Add model count info for analysis
        const analysisModelInfo = containerEl.createDiv({
            cls: "setting-item-description model-info-display",
        });
        const analysisModelsCount = this.getAvailableModelsForProvider(
            this.plugin.settings.analysisProvider,
        ).length;
        if (analysisModelsCount > 0) {
            analysisModelInfo.setText(
                `${analysisModelsCount} models available - Click 'Refresh' to fetch from ${this.plugin.settings.analysisProvider}`,
            );
        } else {
            analysisModelInfo.setText(
                "Click 'Refresh' to fetch available models",
            );
        }

        // Analysis Temperature
        new Setting(containerEl)
            .setName("Task analysis temperature")
            .setDesc(
                "Temperature for task analysis (0.0-2.0). Lower = consistent, higher = creative.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 2, 0.1)
                    .setValue(this.plugin.settings.analysisTemperature)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.analysisTemperature = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Chat Settings
        new Setting(containerEl).setName("Task chat").setHeading();

        const taskChatInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        taskChatInfo.createEl("p", {
            text: "Configure chat interface behavior, history length, response tokens, and temperature.",
        });
        const p3 = taskChatInfo.createEl("p");
        p3.createEl("a", {
            text: "→ Learn more about task chat settings",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SETTINGS_GUIDE.md#2-task-chat",
        });

        new Setting(containerEl)
            .setName("Max chat history")
            .setDesc(
                "Maximum number of messages to keep in chat history (10-200)",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(10, 200, 10)
                    .setValue(this.plugin.settings.maxChatHistory)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxChatHistory = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Add detailed setting for chat history context length
        const chatContextSetting = new Setting(containerEl)
            .setName("Chat history context length")
            .setDesc(
                `Number of recent messages to send to AI as context (1-100). Default: 5. Current: ${this.plugin.settings.chatHistoryContextLength}`,
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 100, 1)
                    .setValue(this.plugin.settings.chatHistoryContextLength)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.chatHistoryContextLength = value;
                        await this.plugin.saveSettings();
                        // Update description to show current value
                        chatContextSetting.setDesc(
                            `Number of recent messages to send to AI as context (1-100). Default: 5. Current: ${value}`,
                        );
                    }),
            );

        // Add detailed explanation below the slider
        const chatContextInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        chatContextInfo.createEl("p", {
            text: "More history = higher token cost.",
        });
        const chatContextLink = chatContextInfo.createEl("p");
        chatContextLink.createEl("a", {
            text: "→ Learn more about chat history context",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/CHAT_HISTORY_CONTEXT.md",
        });

        new Setting(containerEl)
            .setName("Show task count")
            .setDesc("Show the number of tasks in the filter status")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showTaskCount)
                    .onChange(async (value) => {
                        this.plugin.settings.showTaskCount = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Auto-open sidebar")
            .setDesc("Automatically open the Task Chat sidebar on startup")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autoOpenSidebar)
                    .onChange(async (value) => {
                        this.plugin.settings.autoOpenSidebar = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Chat mode
        new Setting(containerEl).setName("Chat mode").setHeading();

        new Setting(containerEl)
            .setName("Default chat mode")
            .setDesc(
                "Sets the default mode for new chat sessions. You can always override this in the chat interface.",
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("simple", "Simple Search - Free")
                    .addOption("smart", "Smart Search - AI keyword expansion")
                    .addOption("chat", "Task Chat - Full AI assistant")
                    .setValue(this.plugin.settings.defaultChatMode)
                    .onChange(async (value: "simple" | "smart" | "chat") => {
                        this.plugin.settings.defaultChatMode = value;
                        await this.plugin.saveSettings();

                        // Update settings tab sort dropdown and description
                        this.refreshSortBySetting();

                        // Update chat view chat mode dropdown
                        this.plugin.refreshChatViewChatMode();
                    }),
            );

        // Mode comparison - link to documentation
        const modeComparisonInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        const p4 = modeComparisonInfo.createEl("p");
        p4.createEl("strong", { text: "Chat mode comparison:" });
        p4.appendText(
            " Simple (free, regex-based), Smart (AI keyword expansion), Task Chat (full AI analysis).",
        );
        const p5 = modeComparisonInfo.createEl("p");
        p5.createEl("a", {
            text: "→ Learn more about chat modes",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/CHAT_MODES.md",
        });

        // Semantic Expansion
        new Setting(containerEl).setName("Semantic expansion").setHeading();

        const semanticExpansionInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        semanticExpansionInfo.createEl("p", {
            text: "Configure keyword expansion and custom property terms.",
        });
        const p6 = semanticExpansionInfo.createEl("p");
        p6.createEl("a", {
            text: "→ Learn more about semantic expansion",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SEMANTIC_EXPANSION.md",
        });

        new Setting(containerEl)
            .setName("Enable semantic expansion")
            .setDesc(
                "Expand keywords with semantic equivalents across configured languages. Improves recall but increases token usage.",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableSemanticExpansion)
                    .onChange(async (value) => {
                        this.plugin.settings.enableSemanticExpansion = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Query language")
            .setDesc(
                "Languages for keyword semantic expansion. Used by Smart Search and Task Chat modes. Examples: English, Español. Separate with commas.",
            )
            .addTextArea((text) =>
                text
                    .setPlaceholder("English")
                    .setValue(this.plugin.settings.queryLanguages.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.queryLanguages = value
                            .split(",")
                            .map((lang) => lang.trim())
                            .filter((lang) => lang.length > 0);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.rows = 2;
                        text.inputEl.cols = 50;
                    }),
            );

        new Setting(containerEl)
            .setName("Keyword expansions")
            .setDesc(
                "Variations per keyword per language. Default: 5. Higher values improve recall but increase token usage.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 25, 1)
                    .setValue(this.plugin.settings.expansionsPerLanguage)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.expansionsPerLanguage = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Dataview task properties")
            .setClass("setting-subsection-heading");

        new Setting(containerEl)
            .setName("Priority terms")
            .setDesc("Custom priority terms. Combines with built-in terms.")
            .addTextArea((text) =>
                text
                    .setPlaceholder("priority, urgent")
                    .setValue(
                        this.plugin.settings.userPropertyTerms.priority.join(
                            ", ",
                        ),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.userPropertyTerms.priority = value
                            .split(",")
                            .map((term) => term.trim())
                            .filter((term) => term.length > 0);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.rows = 2;
                        text.inputEl.cols = 50;
                    }),
            );

        new Setting(containerEl)
            .setName("Due date terms")
            .setDesc("Custom due date terms. Combines with built-in terms.")
            .addTextArea((text) =>
                text
                    .setPlaceholder("due, deadline")
                    .setValue(
                        this.plugin.settings.userPropertyTerms.dueDate.join(
                            ", ",
                        ),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.userPropertyTerms.dueDate = value
                            .split(",")
                            .map((term) => term.trim())
                            .filter((term) => term.length > 0);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.rows = 2;
                        text.inputEl.cols = 50;
                    }),
            );

        new Setting(containerEl)
            .setName("Status terms")
            .setDesc("Custom status terms. Combines with built-in terms.")
            .addTextArea((text) =>
                text
                    .setPlaceholder("done, completed, in progress")
                    .setValue(
                        this.plugin.settings.userPropertyTerms.status.join(
                            ", ",
                        ),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.userPropertyTerms.status = value
                            .split(",")
                            .map((term) => term.trim())
                            .filter((term) => term.length > 0);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.rows = 2;
                        text.inputEl.cols = 50;
                    }),
            );

        // Smart search & Task chat
        new Setting(containerEl)
            .setName("Smart search & Task chat")
            .setHeading();

        new Setting(containerEl)
            .setName("Max tasks for AI analysis")
            .setDesc(
                "Maximum tasks to send to AI in Task Chat mode. Default: 100. Higher values increase token usage.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(10, 500, 10)
                    .setValue(this.plugin.settings.maxTasksForAI)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxTasksForAI = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Max AI recommendations")
            .setDesc(
                "Maximum tasks AI should recommend. Default: 20. Keeps the final task list manageable.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(5, 100, 5)
                    .setValue(this.plugin.settings.maxRecommendations)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxRecommendations = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Response language")
            .setDesc(
                "Language for AI responses. 'Auto' matches user input language.",
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("auto", "Auto (match user input)")
                    .addOption("english", "English")
                    .addOption("custom", "Custom instruction")
                    .setValue(this.plugin.settings.responseLanguage)
                    .onChange(async (value) => {
                        this.plugin.settings.responseLanguage = value as any;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show/hide custom instruction
                    }),
            );

        // Show custom language instruction if custom is selected
        if (this.plugin.settings.responseLanguage === "custom") {
            new Setting(containerEl)
                .setName("Custom language instruction")
                .setDesc("Specify how the AI should choose response language")
                .addText((text) =>
                    text
                        .setPlaceholder("e.g., Always respond in English")
                        .setValue(
                            this.plugin.settings.customLanguageInstruction,
                        )
                        .onChange(async (value) => {
                            this.plugin.settings.customLanguageInstruction =
                                value;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        new Setting(containerEl)
            .setName("Show AI understanding")
            .setDesc(
                "Display query interpretation in Task Chat mode (detected language,property recognition).",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.settings.aiEnhancement.showAIUnderstanding,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.aiEnhancement.showAIUnderstanding =
                            value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Show token usage")
            .setDesc("Display API usage and cost information in chat")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showTokenUsage)
                    .onChange(async (value) => {
                        this.plugin.settings.showTokenUsage = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Enable streaming responses")
            .setDesc("Show AI responses as they're generated (like ChatGPT).")
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.settings.aiEnhancement.enableStreaming,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.aiEnhancement.enableStreaming =
                            value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Dataview Settings
        new Setting(containerEl).setName("Dataview integration").setHeading();

        new Setting(containerEl)
            .setName("Dataview task properties")
            .setClass("setting-subsection-heading");

        const dataviewInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        dataviewInfo.createEl("p", {
            text: "Configure task property field namess.",
        });
        const dataviewLink = dataviewInfo.createEl("p");
        dataviewLink.createEl("a", {
            text: "→ Learn more about Dataview integration",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SETTINGS_GUIDE.md#5-dataview-integration",
        });

        new Setting(containerEl)
            .setName("Due date field")
            .setDesc("Dataview field name for due dates")
            .addText((text) =>
                text
                    .setPlaceholder("due")
                    .setValue(this.plugin.settings.dataviewKeys.dueDate)
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewKeys.dueDate = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Created date field")
            .setDesc("Dataview field name for creation dates")
            .addText((text) =>
                text
                    .setPlaceholder("created")
                    .setValue(this.plugin.settings.dataviewKeys.createdDate)
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewKeys.createdDate = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Completed date field")
            .setDesc("Dataview field name for completion dates")
            .addText((text) =>
                text
                    .setPlaceholder("completed")
                    .setValue(this.plugin.settings.dataviewKeys.completedDate)
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewKeys.completedDate = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Priority field")
            .setDesc("Dataview field name for priority")
            .addText((text) =>
                text
                    .setPlaceholder("p")
                    .setValue(this.plugin.settings.dataviewKeys.priority)
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewKeys.priority = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Priority mapping")
            .setDesc(
                "Define which priority values map to each priority level. Separate multiple values with commas. Supports inline fields like [p::1]",
            )
            .setClass("setting-subsection-heading");

        new Setting(containerEl)
            .setName("Priority 1 (highest) values")
            .setDesc("Values that indicate priority 1 (e.g., 1, p1, high)")
            .addText((text) =>
                text
                    .setPlaceholder("1, p1, high")
                    .setValue(
                        this.plugin.settings.dataviewPriorityMapping[1].join(
                            ", ",
                        ),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewPriorityMapping[1] = value
                            .split(",")
                            .map((v) => v.trim())
                            .filter((v) => v);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.addClass("priority-mapping-input");
                    }),
            );

        new Setting(containerEl)
            .setName("Priority 2 (high) values")
            .setDesc("Values that indicate priority 2 (e.g., 2, p2, medium)")
            .addText((text) =>
                text
                    .setPlaceholder("2, p2, medium")
                    .setValue(
                        this.plugin.settings.dataviewPriorityMapping[2].join(
                            ", ",
                        ),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewPriorityMapping[2] = value
                            .split(",")
                            .map((v) => v.trim())
                            .filter((v) => v);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.addClass("priority-mapping-input");
                    }),
            );

        new Setting(containerEl)
            .setName("Priority 3 (medium) values")
            .setDesc("Values that indicate priority 3 (e.g., 3, p3, low)")
            .addText((text) =>
                text
                    .setPlaceholder("3, p3, low")
                    .setValue(
                        this.plugin.settings.dataviewPriorityMapping[3].join(
                            ", ",
                        ),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewPriorityMapping[3] = value
                            .split(",")
                            .map((v) => v.trim())
                            .filter((v) => v);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.addClass("priority-mapping-input");
                    }),
            );

        new Setting(containerEl)
            .setName("Priority 4 (low) values")
            .setDesc("Values that indicate priority 4 (e.g., 4, p4, none)")
            .addText((text) =>
                text
                    .setPlaceholder("4, p4, none")
                    .setValue(
                        this.plugin.settings.dataviewPriorityMapping[4].join(
                            ", ",
                        ),
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewPriorityMapping[4] = value
                            .split(",")
                            .map((v) => v.trim())
                            .filter((v) => v);
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.addClass("priority-mapping-input");
                    }),
            );

        // Status Category
        new Setting(containerEl).setName("Status category").setHeading();

        const statusCategoriesDesc = containerEl.createDiv({
            cls: "setting-item-description",
        });
        statusCategoriesDesc.createEl("p", {
            text: "Define custom categories with checkbox symbols, scores, and query aliases. Protected: Open, Completed, In Progress, Cancelled, Other.",
        });
        const p9 = statusCategoriesDesc.createEl("p");
        p9.createEl("a", {
            text: "→ Learn more about status categories and score vs order",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/STATUS_CATEGORIES.md",
        });

        // Validate status orders and show warnings if duplicates found
        const validation = TaskPropertyService.validateStatusOrders(
            this.plugin.settings.taskStatusMapping,
        );

        // Calculate dynamic gap for auto-organize based on category count
        const categoryCount = Object.keys(
            this.plugin.settings.taskStatusMapping,
        ).length;
        const dynamicGap = Math.max(10, Math.ceil(100 / categoryCount));

        // Show warning messages if duplicates exist
        if (!validation.valid) {
            const warningBox = containerEl.createDiv({
                cls: "task-chat-warning-box",
            });
            warningBox.style.marginBottom = "16px";

            for (const warning of validation.warnings) {
                const warningText = warningBox.createEl("p", {
                    cls: "task-chat-warning-message",
                });
                warningText.textContent = "⚠️ " + warning;
                warningText.style.marginBottom = "4px";
            }
        }

        // Auto-organize button (always visible, but styled differently based on validation)
        const organizeSetting = new Setting(containerEl)
            .setName("Auto-organize display order")
            .setDesc(
                `Automatically renumber all categories with consistent gaps. With ${categoryCount} categories, will use gaps of ${dynamicGap} (e.g., ${dynamicGap}, ${dynamicGap * 2}, ${dynamicGap * 3}...). Note: Display order determines visual order, not task importance.`,
            )
            .addButton((button) => {
                button
                    .setButtonText(
                        validation.valid ? "Organize now" : "Fix duplicates",
                    )
                    .onClick(async () => {
                        this.plugin.settings.taskStatusMapping =
                            TaskPropertyService.autoFixStatusOrders(
                                this.plugin.settings.taskStatusMapping,
                            );
                        await this.plugin.saveSettings();
                        new Notice(
                            `Display order organized! Categories renumbered with gaps of ${dynamicGap}.`,
                        );
                        this.display(); // Refresh UI
                    });

                // Style button based on validation state
                if (!validation.valid) {
                    button.setWarning(); // Red/warning style when duplicates exist
                }
            });

        organizeSetting.settingEl.style.marginBottom = "20px";

        // Add column headers
        const headerDiv = containerEl.createDiv({
            cls: "task-chat-status-header",
        });
        headerDiv.createDiv({ text: "Category key" });
        headerDiv.createDiv({ text: "Display name" });
        headerDiv.createDiv({ text: "Query aliases" });
        headerDiv.createDiv({ text: "Symbols" });
        headerDiv.createDiv({ text: "Score" });
        headerDiv.createDiv({ text: "" }); // For remove button

        // Render all existing categories
        const categories = Object.entries(
            this.plugin.settings.taskStatusMapping,
        );
        for (const [categoryKey, config] of categories) {
            this.renderStatusCategory(containerEl, categoryKey, config);
        }

        // Add new category button
        new Setting(containerEl)
            .setName("Add status category")
            .setDesc("Create a new custom status category")
            .addButton((button) =>
                button
                    .setButtonText("Add category")
                    .setCta()
                    .onClick(async () => {
                        // Generate unique category name
                        let categoryNum = 1;
                        let newCategoryKey = `custom${categoryNum}`;
                        while (
                            this.plugin.settings.taskStatusMapping[
                                newCategoryKey
                            ]
                        ) {
                            categoryNum++;
                            newCategoryKey = `custom${categoryNum}`;
                        }

                        // Add new category with defaults
                        this.plugin.settings.taskStatusMapping[newCategoryKey] =
                            {
                                symbols: [],
                                score: 0.5,
                                displayName: `Custom ${categoryNum}`,
                                aliases: `custom${categoryNum}`,
                            };

                        await this.plugin.saveSettings();
                        this.display(); // Refresh UI
                        new Notice(`Added new category: Custom ${categoryNum}`);
                    }),
            );

        // Task filtering
        new Setting(containerEl).setName("Task filtering").setHeading();

        const filteringInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        filteringInfo.createEl("p", {
            text: "Control which tasks appear in results.",
        });
        const p10 = filteringInfo.createEl("p");
        p10.createEl("a", {
            text: "→ Learn more about filtering options",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SETTINGS_GUIDE.md#7-task-filtering",
        });

        new Setting(containerEl)
            .setName("Relevance score")
            .setDesc(
                `Minimum keyword relevance score (0 = disabled). Current max: ${((this.plugin.settings.relevanceCoreWeight + 1.0) * 100).toFixed(0)}%. Use to exclude tasks with weak keyword matches.`,
            )
            .addSlider((slider) => {
                // Dynamic maximum based on actual max relevance score
                const maxRelevanceScore =
                    this.plugin.settings.relevanceCoreWeight + 1.0;
                const sliderMax = Math.ceil(maxRelevanceScore * 100);

                return slider
                    .setLimits(0, sliderMax, 1)
                    .setValue(this.plugin.settings.minimumRelevanceScore * 100)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.minimumRelevanceScore =
                            value / 100;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Quality filter")
            .setDesc(
                `Filter strictness (0-100%). 0% = adaptive, higher = fewer but higher-quality results.`,
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 100, 1)
                    .setValue(this.plugin.settings.qualityFilterStrength * 100)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.qualityFilterStrength =
                            value / 100;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Custom stop words")
            .setDesc(
                `Custom stop words to filter out (combines with ${StopWords.getInternalStopWords().length} built-in). Comma-separated.`,
            )
            .addTextArea((text) =>
                text
                    .setPlaceholder("task")
                    .setValue(this.plugin.settings.userStopWords.join(", "))
                    .onChange(async (value) => {
                        this.plugin.settings.userStopWords = value
                            .split(",")
                            .map((term) => term.trim())
                            .filter((term) => term.length > 0);
                        // Update StopWords class immediately
                        StopWords.setUserStopWords(
                            this.plugin.settings.userStopWords,
                        );
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.rows = 3;
                        text.inputEl.cols = 50;
                    }),
            );

        // Exclusions (Tags, Folders, Notes)
        const exclusionsInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        exclusionsInfo.createEl("p", {
            text: "Exclude tasks from searches by tags, folders, or notes. Exclusions are applied when tasks are loaded from your vault.",
        });
        exclusionsInfo.createEl("p", {
            text: "• Tags: Exclude tasks with specific tags (task-level or note-level)",
        });
        exclusionsInfo.createEl("p", {
            text: "• Folders: Exclude all tasks in specific folders (including subfolders)",
        });
        exclusionsInfo.createEl("p", {
            text: "• Notes: Exclude all tasks in specific notes",
        });
        const exclusionsLink = exclusionsInfo.createEl("p");
        exclusionsLink.createEl("a", {
            text: "→ Learn more about task exclusions",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/EXCLUSIONS.md",
        });

        new Setting(containerEl)
            .setName("Manage exclusions")
            .setDesc(
                "Click to open the exclusions manager. After adding exclusions, click 'Refresh' in the chat to update task counts.",
            )
            .addButton((button) => {
                button
                    .setButtonText("Manage...")
                    .setCta()
                    .onClick(() => {
                        new ExclusionsModal(this.app, this.plugin).open();
                    });
            });

        // Task scoring
        new Setting(containerEl).setName("Task scoring").setHeading();

        // Main weights
        new Setting(containerEl)
            .setName("Main weights")
            .setClass("setting-subsection-heading");

        const mainWeightsInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        mainWeightsInfo.createEl("p", {
            text: "Control how each factor (relevance, due date, priority, status) contributes to task scores.",
        });
        const mainWeightsLink = mainWeightsInfo.createEl("p");
        mainWeightsLink.createEl("a", {
            text: "→ Learn more about scoring weights",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SCORING_SYSTEM.md",
        });

        new Setting(containerEl)
            .setName("Relevance weight")
            .setDesc(
                `Keyword matching importance (1-50). Default: 20. Higher = more keyword-focused.`,
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 50, 1)
                    .setValue(this.plugin.settings.relevanceCoefficient)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.relevanceCoefficient = value;
                        await this.plugin.saveSettings();
                        this.updateMaxScoreDisplay?.();
                    }),
            );

        new Setting(containerEl)
            .setName("Due date weight")
            .setDesc(
                `Urgency importance (1-20). Default: 4. Higher = more urgency-focused.`,
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 20, 1)
                    .setValue(this.plugin.settings.dueDateCoefficient)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.dueDateCoefficient = value;
                        await this.plugin.saveSettings();
                        this.updateMaxScoreDisplay?.();
                    }),
            );

        new Setting(containerEl)
            .setName("Priority weight")
            .setDesc(
                `Priority importance (1-20). Default: 1. Higher = more priority-focused.`,
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 20, 1)
                    .setValue(this.plugin.settings.priorityCoefficient)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.priorityCoefficient = value;
                        await this.plugin.saveSettings();
                        this.updateMaxScoreDisplay?.();
                    }),
            );

        new Setting(containerEl)
            .setName("Status weight")
            .setDesc(
                `Status importance (1-20). Default: 1. Higher = more status-focused.`,
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 20, 1)
                    .setValue(this.plugin.settings.statusCoefficient)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.statusCoefficient = value;
                        await this.plugin.saveSettings();
                        this.updateMaxScoreDisplay?.();
                    }),
            );

        // Max Score Display
        const maxScoreDisplay = containerEl.createDiv({
            cls: "task-chat-info-box",
        });
        const maxScoreValue = maxScoreDisplay.createEl("p", {
            cls: "task-chat-max-score-value",
        });

        // Helper to update display
        this.updateMaxScoreDisplay = () => {
            // Calculate dynamic maximums from user's sub-coefficient settings
            const maxRelevanceScore =
                this.plugin.settings.relevanceCoreWeight + 1.0;
            const maxDueDateScore = Math.max(
                this.plugin.settings.dueDateOverdueScore,
                this.plugin.settings.dueDateWithin7DaysScore,
                this.plugin.settings.dueDateWithin1MonthScore,
                this.plugin.settings.dueDateLaterScore,
                this.plugin.settings.dueDateNoneScore,
            );
            const maxPriorityScore = Math.max(
                this.plugin.settings.priorityP1Score,
                this.plugin.settings.priorityP2Score,
                this.plugin.settings.priorityP3Score,
                this.plugin.settings.priorityP4Score,
                this.plugin.settings.priorityNoneScore,
            );
            const maxStatusScore = Math.max(
                ...Object.values(this.plugin.settings.taskStatusMapping).map(
                    (config) => config.score,
                ),
            );

            const maxScore =
                maxRelevanceScore * this.plugin.settings.relevanceCoefficient +
                maxDueDateScore * this.plugin.settings.dueDateCoefficient +
                maxPriorityScore * this.plugin.settings.priorityCoefficient +
                maxStatusScore * this.plugin.settings.statusCoefficient;
            const relevPart =
                maxRelevanceScore * this.plugin.settings.relevanceCoefficient;
            const datePart =
                maxDueDateScore * this.plugin.settings.dueDateCoefficient;
            const priorPart =
                maxPriorityScore * this.plugin.settings.priorityCoefficient;
            const statusPart =
                maxStatusScore * this.plugin.settings.statusCoefficient;

            maxScoreValue.textContent = `Max score: ${maxScore.toFixed(1)} points (R: ${relevPart.toFixed(1)} + D: ${datePart.toFixed(1)} + P: ${priorPart.toFixed(1)} + S: ${statusPart.toFixed(1)})`;
        };

        // Initial display
        this.updateMaxScoreDisplay();

        // Relevance Sub-Coefficients
        new Setting(containerEl)
            .setName("Relevance sub-coefficients")
            .setClass("setting-subsection-heading");

        new Setting(containerEl)
            .setName("Core keyword match bonus")
            .setDesc(
                "Bonus for exact keyword matches (0.0-1.0). Default: 0.2. Set to 0 for pure semantic search.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.relevanceCoreWeight)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.relevanceCoreWeight = value;
                        await this.plugin.saveSettings();
                        // Refresh settings tab to update minimum relevance slider max value
                        this.display();
                    }),
            );

        // Due Date Sub-Coefficients
        new Setting(containerEl)
            .setName("Due date sub-coefficients")
            .setClass("setting-subsection-heading");

        new Setting(containerEl)
            .setName("Overdue tasks")
            .setDesc(
                "Score for overdue tasks (0.0-10.0). Default: 1.5 (most urgent).",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 10, 0.1)
                    .setValue(this.plugin.settings.dueDateOverdueScore)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.dueDateOverdueScore = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Due within 7 days")
            .setDesc(
                "Score for tasks due within 7 days (0.0-1.0). Default: 1.0.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.dueDateWithin7DaysScore)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.dueDateWithin7DaysScore = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Due within 1 month")
            .setDesc(
                "Score for tasks due within 1 month (0.0-1.0). Default: 0.5.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.dueDateWithin1MonthScore)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.dueDateWithin1MonthScore = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Due later (after 1 month)")
            .setDesc(
                "Score for tasks due after 1 month (0.0-1.0). Default: 0.2.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.dueDateLaterScore)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.dueDateLaterScore = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("No due date")
            .setDesc(
                "Score for tasks with no due date (0.0-1.0). Default: 0.1.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.dueDateNoneScore)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.dueDateNoneScore = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Priority Sub-Coefficients
        new Setting(containerEl)
            .setName("Priority sub-coefficients")
            .setClass("setting-subsection-heading");

        new Setting(containerEl)
            .setName("Priority 1 (Highest)")
            .setDesc("Score for priority 1 tasks (0.0-1.0). Default: 1.0.")
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.priorityP1Score)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.priorityP1Score = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Priority 2 (High)")
            .setDesc("Score for priority 2 tasks (0.0-1.0). Default: 0.75.")
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.priorityP2Score)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.priorityP2Score = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Priority 3 (Medium)")
            .setDesc("Score for priority 3 tasks (0.0-1.0). Default: 0.5.")
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.priorityP3Score)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.priorityP3Score = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Priority 4 (Low)")
            .setDesc("Score for priority 4 tasks (0.0-1.0). Default: 0.2.")
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.priorityP4Score)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.priorityP4Score = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("No priority")
            .setDesc(
                "Score for tasks with no priority set (0.0-1.0). Default: 0.1.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.05)
                    .setValue(this.plugin.settings.priorityNoneScore)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.priorityNoneScore = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Status Sub-Coefficients
        new Setting(containerEl)
            .setName("Status sub-coefficients")
            .setClass("setting-subsection-heading");

        const statusScoreNote = containerEl.createDiv({
            cls: "setting-item-description task-chat-info-box",
        });
        statusScoreNote.createEl("p", {
            text: 'Each status category has its own coefficient. Scroll up to the "Status category" section to manage coefficients.',
        });

        // Reset Buttons Section
        new Setting(containerEl)
            .setName("Reset coefficients to defaults")
            .setClass("setting-subsection-heading");

        // Reset main coefficients
        new Setting(containerEl)
            .setName("Reset all main weights")
            .setDesc(
                "Reset all main weights to defaults (R:20, D:4, P:1, S:1).",
            )
            .addButton((button) =>
                button
                    .setButtonText("Reset all main weights")
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings.relevanceCoefficient =
                            DEFAULT_SETTINGS.relevanceCoefficient;
                        this.plugin.settings.dueDateCoefficient =
                            DEFAULT_SETTINGS.dueDateCoefficient;
                        this.plugin.settings.priorityCoefficient =
                            DEFAULT_SETTINGS.priorityCoefficient;
                        this.plugin.settings.statusCoefficient =
                            DEFAULT_SETTINGS.statusCoefficient;
                        await this.plugin.saveSettings();
                        new Notice("All main weights reset to defaults");
                        // Update max score display
                        if (this.updateMaxScoreDisplay) {
                            this.updateMaxScoreDisplay();
                        }
                        this.display(); // Refresh UI
                    }),
            );

        // Reset all advanced coefficients
        new Setting(containerEl)
            .setName("Reset all sub-coefficients")
            .setDesc(
                "Reset all sub-coefficients (relevance, due date, priority, status) to defaults.",
            )
            .addButton((button) =>
                button
                    .setButtonText("Reset all sub-coefficients")
                    .setWarning()
                    .onClick(async () => {
                        // Relevance
                        this.plugin.settings.relevanceCoreWeight =
                            DEFAULT_SETTINGS.relevanceCoreWeight;
                        // Due date
                        this.plugin.settings.dueDateOverdueScore =
                            DEFAULT_SETTINGS.dueDateOverdueScore;
                        this.plugin.settings.dueDateWithin7DaysScore =
                            DEFAULT_SETTINGS.dueDateWithin7DaysScore;
                        this.plugin.settings.dueDateWithin1MonthScore =
                            DEFAULT_SETTINGS.dueDateWithin1MonthScore;
                        this.plugin.settings.dueDateLaterScore =
                            DEFAULT_SETTINGS.dueDateLaterScore;
                        this.plugin.settings.dueDateNoneScore =
                            DEFAULT_SETTINGS.dueDateNoneScore;
                        // Priority
                        this.plugin.settings.priorityP1Score =
                            DEFAULT_SETTINGS.priorityP1Score;
                        this.plugin.settings.priorityP2Score =
                            DEFAULT_SETTINGS.priorityP2Score;
                        this.plugin.settings.priorityP3Score =
                            DEFAULT_SETTINGS.priorityP3Score;
                        this.plugin.settings.priorityP4Score =
                            DEFAULT_SETTINGS.priorityP4Score;
                        this.plugin.settings.priorityNoneScore =
                            DEFAULT_SETTINGS.priorityNoneScore;
                        // Status - reset entire taskStatusMapping
                        this.plugin.settings.taskStatusMapping = JSON.parse(
                            JSON.stringify(DEFAULT_SETTINGS.taskStatusMapping),
                        );
                        await this.plugin.saveSettings();
                        new Notice("All sub-coefficients reset to defaults");
                        this.display(); // Refresh UI
                    }),
            );

        // Reset relevance sub-coefficients
        new Setting(containerEl)
            .setName("Reset relevance core keyword match bonus")
            .setDesc(
                "Reset relevance core keyword match bonus to default (0.2).",
            )
            .addButton((button) =>
                button
                    .setButtonText("Reset relevance core keyword match bonus")
                    .onClick(async () => {
                        this.plugin.settings.relevanceCoreWeight =
                            DEFAULT_SETTINGS.relevanceCoreWeight;
                        await this.plugin.saveSettings();
                        new Notice(
                            "Relevance core keyword match bonus reset to default (0.2)",
                        );
                        this.display();
                    }),
            );

        // Reset due date sub-coefficients
        new Setting(containerEl)
            .setName("Reset due date sub-coefficients")
            .setDesc("Reset due date sub-coefficients to defaults.")
            .addButton((button) =>
                button
                    .setButtonText("Reset due date sub-coefficients")
                    .onClick(async () => {
                        this.plugin.settings.dueDateOverdueScore =
                            DEFAULT_SETTINGS.dueDateOverdueScore;
                        this.plugin.settings.dueDateWithin7DaysScore =
                            DEFAULT_SETTINGS.dueDateWithin7DaysScore;
                        this.plugin.settings.dueDateWithin1MonthScore =
                            DEFAULT_SETTINGS.dueDateWithin1MonthScore;
                        this.plugin.settings.dueDateLaterScore =
                            DEFAULT_SETTINGS.dueDateLaterScore;
                        this.plugin.settings.dueDateNoneScore =
                            DEFAULT_SETTINGS.dueDateNoneScore;
                        await this.plugin.saveSettings();
                        new Notice(
                            "Due date sub-coefficients reset to defaults",
                        );
                        this.display();
                    }),
            );

        // Reset priority sub-coefficients
        new Setting(containerEl)
            .setName("Reset priority sub-coefficients")
            .setDesc("Reset all priority sub-coefficients to defaults.")
            .addButton((button) =>
                button
                    .setButtonText("Reset priority sub-coefficients")
                    .onClick(async () => {
                        this.plugin.settings.priorityP1Score =
                            DEFAULT_SETTINGS.priorityP1Score;
                        this.plugin.settings.priorityP2Score =
                            DEFAULT_SETTINGS.priorityP2Score;
                        this.plugin.settings.priorityP3Score =
                            DEFAULT_SETTINGS.priorityP3Score;
                        this.plugin.settings.priorityP4Score =
                            DEFAULT_SETTINGS.priorityP4Score;
                        this.plugin.settings.priorityNoneScore =
                            DEFAULT_SETTINGS.priorityNoneScore;
                        await this.plugin.saveSettings();
                        new Notice(
                            "Priority sub-coefficients reset to defaults",
                        );
                        this.display();
                    }),
            );

        // Reset status category
        new Setting(containerEl)
            .setName("Reset status category")
            .setDesc("Reset all status categories to defaults.")
            .addButton((button) =>
                button
                    .setButtonText("Reset status category")
                    .onClick(async () => {
                        this.plugin.settings.taskStatusMapping = JSON.parse(
                            JSON.stringify(DEFAULT_SETTINGS.taskStatusMapping),
                        );
                        await this.plugin.saveSettings();
                        new Notice("Status categories reset to defaults");
                        this.display();
                    }),
            );

        // Task Display
        new Setting(containerEl).setName("Task display").setHeading();

        const taskDisplayInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        taskDisplayInfo.createEl("p", {
            text: "Configure result limits, sorting order, and display preferences.",
        });
        const p11 = taskDisplayInfo.createEl("p");
        p11.createEl("a", {
            text: "→ Learn more about task display options",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SETTINGS_GUIDE.md#9-task-display",
        });

        // Store the container for this setting so we can refresh it
        // Create a dedicated div to hold the sort setting (prevents scroll issues when refreshed)
        this.sortByContainerEl = containerEl.createDiv(
            "task-chat-sort-container",
        );
        this.renderSortBySetting();

        new Setting(containerEl)
            .setName("Max direct results")
            .setDesc("Maximum tasks to show in Simple Search mode.")
            .addSlider((slider) =>
                slider
                    .setLimits(5, 100, 5)
                    .setValue(this.plugin.settings.maxDirectResults)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxDirectResults = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl).setName("Advanced").setHeading();

        const advancedInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        advancedInfo.createEl("p", {
            text: "Advanced settings for system prompts and pricing data management.",
        });
        const p12 = advancedInfo.createEl("p");
        p12.createEl("a", {
            text: "→ Learn more about advanced settings",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SETTINGS_GUIDE.md#10-advanced",
        });

        new Setting(containerEl)
            .setName("System prompt")
            .setDesc(
                "Customize AI behavior and personality. Internally, technical instructions are automatically appended.",
            )
            .addTextArea((text) =>
                text
                    .setPlaceholder("Enter system prompt")
                    .setValue(this.plugin.settings.systemPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.systemPrompt = value;
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.rows = 4;
                        text.inputEl.cols = 50;
                    }),
            )
            .addButton((button) =>
                button
                    .setButtonText("Reset to default")
                    .setTooltip(
                        "Reset to the recommended system prompt optimized for task management",
                    )
                    .onClick(async () => {
                        this.plugin.settings.systemPrompt =
                            DEFAULT_SETTINGS.systemPrompt;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh settings to show reset value
                        new Notice("System prompt reset to default");
                    }),
            );

        // Debug Logging
        new Setting(containerEl)
            .setName("Enable debug logging")
            .setDesc(
                "Show detailed logs in developer console for troubleshooting. " +
                    "When enabled, logs include search operations, AI requests, task scoring, and filtering details. " +
                    "Note: This may impact performance and should only be enabled when debugging issues. " +
                    "To view logs, open developer console (Ctrl+Shift+I / Cmd+Option+I).",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableDebugLogging)
                    .onChange(async (value) => {
                        this.plugin.settings.enableDebugLogging = value;
                        // Immediately reinitialize logger with new setting
                        Logger.initialize(this.plugin.settings);
                        await this.plugin.saveSettings();
                        new Notice(
                            value
                                ? "Debug logging enabled. Check developer console for logs."
                                : "Debug logging disabled",
                        );
                    }),
            );

        // Pricing Information
        new Setting(containerEl)
            .setName("Pricing data")
            .setClass("setting-subsection-heading");

        const lastUpdate = PricingService.getTimeSinceUpdate(
            this.plugin.settings.pricingCache.lastUpdated,
        );
        const modelCount = Object.keys(
            this.plugin.settings.pricingCache.data,
        ).length;

        const pricingInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        pricingInfo.createEl("p", {
            text: `${modelCount} models cached, updated ${lastUpdate}`,
        });

        new Setting(containerEl)
            .setName("Refresh pricing")
            .setDesc("Update pricing data from OpenRouter API")
            .addButton((button) =>
                button.setButtonText("Refresh now").onClick(async () => {
                    button.setButtonText("Updating...");
                    button.setDisabled(true);

                    try {
                        const pricing =
                            await PricingService.fetchPricingFromOpenRouter();
                        if (Object.keys(pricing).length > 0) {
                            this.plugin.settings.pricingCache.data = pricing;
                            this.plugin.settings.pricingCache.lastUpdated =
                                Date.now();
                            await this.plugin.saveSettings();
                            new Notice(
                                `Updated pricing for ${Object.keys(pricing).length} models`,
                            );
                            this.display(); // Refresh UI
                        } else {
                            new Notice("Failed to fetch pricing data");
                        }
                    } catch (error) {
                        new Notice("Error updating pricing: " + error.message);
                    }

                    button.setButtonText("Refresh now");
                    button.setDisabled(false);
                }),
            );

        // Usage Statistics
        new Setting(containerEl)
            .setName("Usage statistics")
            .setClass("setting-subsection-heading");

        const totalTokens =
            this.plugin.settings.totalTokensUsed.toLocaleString();
        const totalCost = this.plugin.settings.totalCost.toFixed(4);

        const statsContainer = containerEl.createDiv({
            cls: "setting-item-description",
        });
        statsContainer.createEl("p", {
            text: `Total: ${totalTokens} tokens, $${totalCost}`,
        });

        new Setting(containerEl)
            .setName("Reset statistics")
            .setDesc("Clear usage statistics and cost tracking")
            .addButton((button) =>
                button.setButtonText("Reset").onClick(async () => {
                    this.plugin.settings.totalTokensUsed = 0;
                    this.plugin.settings.totalCost = 0;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show updated stats
                }),
            );
    }

    /**
     * Render a single status category with all its settings in horizontal grid layout
     */
    private renderStatusCategory(
        containerEl: HTMLElement,
        categoryKey: string,
        config: {
            symbols?: string[];
            score?: number;
            displayName?: string;
            aliases?: string;
            order?: number;
            description?: string;
            terms?: string;
        },
    ): void {
        // Defensive check: ensure config has required properties
        if (!config) {
            Logger.error(`Invalid config for category: ${categoryKey}`);
            return;
        }

        // Set defaults for missing properties
        const symbols = Array.isArray(config.symbols) ? config.symbols : [];
        const displayName = config.displayName || categoryKey;
        const score = typeof config.score === "number" ? config.score : 0.5;
        const aliases = config.aliases || categoryKey.toLowerCase();
        const order = config.order;
        const description = config.description;
        const terms = config.terms;

        // Identify protected categories using helper functions
        const isProtectedCategory = isStatusCategoryProtected(categoryKey);
        const isFullyLocked = isStatusCategoryFullyLocked(categoryKey);

        // Create horizontal grid row
        const rowDiv = containerEl.createDiv({
            cls: "task-chat-status-row",
        });

        // Category key (editable for custom categories only)
        const keyInput = rowDiv.createEl("input", { type: "text" });
        keyInput.value = categoryKey;

        if (isProtectedCategory) {
            keyInput.disabled = true;
            keyInput.title = "Protected category key cannot be changed";
            keyInput.classList.add(
                "task-chat-status-input",
                "task-chat-status-input-disabled",
            );
        } else {
            // Custom categories: allow editing key
            keyInput.classList.add("task-chat-status-input");
            keyInput.addEventListener("change", async () => {
                const newKey = keyInput.value.trim();
                if (
                    newKey &&
                    newKey !== categoryKey &&
                    !this.plugin.settings.taskStatusMapping[newKey]
                ) {
                    // Rename the category key
                    this.plugin.settings.taskStatusMapping[newKey] = {
                        symbols: symbols,
                        score: score,
                        displayName: displayName,
                        aliases: aliases,
                    };
                    delete this.plugin.settings.taskStatusMapping[categoryKey];
                    await this.plugin.saveSettings();
                    this.display(); // Refresh UI
                } else {
                    keyInput.value = categoryKey; // Reset if invalid
                    if (!newKey) {
                        new Notice("Category key cannot be empty");
                    } else if (this.plugin.settings.taskStatusMapping[newKey]) {
                        new Notice("Category key already exists");
                    }
                }
            });
        }

        // Display name (locked only for fully locked categories: open, other)
        const nameInput = rowDiv.createEl("input", { type: "text" });
        nameInput.value = displayName;
        nameInput.placeholder = "Display name";

        if (isFullyLocked) {
            nameInput.disabled = true;
            nameInput.classList.add(
                "task-chat-status-input",
                "task-chat-status-input-disabled",
            );
            if (categoryKey === "open") {
                nameInput.title =
                    "Default open task category, display name locked";
            } else if (categoryKey === "other") {
                nameInput.title =
                    "Default catch-all category, display name locked";
            }
        } else {
            nameInput.classList.add("task-chat-status-input");
            nameInput.addEventListener("change", async () => {
                this.plugin.settings.taskStatusMapping[
                    categoryKey
                ].displayName = nameInput.value || categoryKey;
                await this.plugin.saveSettings();
            });
        }

        // Aliases (comma-separated query names)
        const aliasesInput = rowDiv.createEl("input", { type: "text" });
        aliasesInput.value = aliases;
        aliasesInput.placeholder = "e.g., wip,doing";
        aliasesInput.title =
            "Comma-separated aliases for querying (NO SPACES). Example: completed,done,finished";
        aliasesInput.classList.add("task-chat-status-input");
        aliasesInput.addEventListener("change", async () => {
            const value = aliasesInput.value.trim();
            this.plugin.settings.taskStatusMapping[categoryKey].aliases =
                value || categoryKey.toLowerCase();
            await this.plugin.saveSettings();
        });

        // Symbols (locked only for fully locked categories: open, other)
        const symbolsInput = rowDiv.createEl("input", { type: "text" });
        symbolsInput.value = symbols.join(",");

        if (isFullyLocked) {
            symbolsInput.disabled = true;
            symbolsInput.classList.add(
                "task-chat-status-input",
                "task-chat-status-input-disabled",
            );
            if (categoryKey === "open") {
                symbolsInput.title =
                    "Default Markdown open task, cannot be changed";
                symbolsInput.placeholder = "(space)";
            } else if (categoryKey === "other") {
                symbolsInput.title =
                    "Catches all unassigned symbols automatically";
                symbolsInput.placeholder = "(auto)";
            }
        } else {
            symbolsInput.classList.add("task-chat-status-input");
            symbolsInput.placeholder = "e.g., x,X or !,I,b";
            symbolsInput.addEventListener("change", async () => {
                this.plugin.settings.taskStatusMapping[categoryKey].symbols =
                    symbolsInput.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter((v) => v);
                await this.plugin.saveSettings();
            });
        }

        // Score slider (0-1 range)
        const scoreContainer = rowDiv.createDiv({
            cls: "task-chat-status-score-container",
        });

        const scoreInput = scoreContainer.createEl("input", {
            type: "range",
            attr: {
                min: "0",
                max: "1",
                step: "0.05",
            },
        });
        scoreInput.value = score.toString();
        scoreInput.classList.add("task-chat-status-score-slider");

        const scoreLabel = scoreContainer.createEl("span", {
            cls: "task-chat-status-score-label",
        });
        scoreLabel.textContent = score.toFixed(2);

        scoreInput.addEventListener("input", async () => {
            const value = parseFloat(scoreInput.value);
            scoreLabel.textContent = value.toFixed(2);
            this.plugin.settings.taskStatusMapping[categoryKey].score = value;
            await this.plugin.saveSettings();
        });

        // Remove button (disabled for all protected categories)
        if (isProtectedCategory) {
            const disabledBtn = rowDiv.createEl("button", {
                text: "✕",
            });
            disabledBtn.disabled = true;

            // Provide specific messages for different protected categories
            if (categoryKey === "open") {
                disabledBtn.title =
                    "Cannot delete: Default open task category (required)";
            } else if (categoryKey === "other") {
                disabledBtn.title =
                    "Cannot delete: Default catch-all category (required)";
            } else if (
                (
                    PROTECTED_STATUS_CATEGORIES.DELETABLE_LOCKED as readonly string[]
                ).includes(categoryKey)
            ) {
                disabledBtn.title = `Cannot delete: Core category "${displayName}" (required for consistent task management)`;
            } else {
                disabledBtn.title = "Cannot delete this protected category";
            }

            disabledBtn.classList.add("task-chat-status-btn-disabled");
        } else {
            const removeBtn = rowDiv.createEl("button", {
                text: "✕",
                cls: "mod-warning",
            });
            removeBtn.title = `Remove ${displayName}`;
            removeBtn.classList.add("task-chat-status-btn-remove");
            removeBtn.addEventListener("click", async () => {
                if (
                    confirm(
                        `Remove "${displayName}" category?\n\nThis will affect how tasks with these symbols are scored.`,
                    )
                ) {
                    delete this.plugin.settings.taskStatusMapping[categoryKey];
                    await this.plugin.saveSettings();
                    this.display(); // Refresh UI
                    new Notice(`Removed category: ${displayName}`);
                }
            });
        }

        // Advanced fields (optional - collapsible)
        const advancedContainer = containerEl.createDiv({
            cls: "task-chat-status-advanced",
        });

        const advancedHeader = advancedContainer.createDiv({
            cls: "task-chat-status-advanced-header",
        });

        const expandIcon = advancedHeader.createSpan({ text: "⚙️" });
        advancedHeader.createSpan({
            text: "Advanced (optional - order, description, terms)",
            cls: "setting-item-name",
        });

        const advancedFields = advancedContainer.createDiv();
        advancedFields.style.display = "none"; // Initially collapsed

        advancedHeader.addEventListener("click", () => {
            if (advancedFields.style.display === "none") {
                advancedFields.style.display = "block";
            } else {
                advancedFields.style.display = "none";
            }
        });

        // Display order field (not the same as score!)
        const effectiveOrder = TaskPropertyService.getStatusOrder(
            categoryKey,
            this.plugin.settings,
        );
        const orderDesc =
            order !== undefined
                ? `Display order for visual ordering (lower number = appears first). Currently: ${effectiveOrder}.`
                : `Display order for visual ordering (lower number = appears first). Currently: ${effectiveOrder}.`;

        const orderSetting = new Setting(advancedFields)
            .setName("Display order")
            .setDesc(orderDesc)
            .setTooltip(
                "This is a relative number - only the ORDER matters, not the actual values.",
            );

        // Add slider for easier adjustment
        orderSetting.addSlider((slider) => {
            slider
                .setLimits(1, 100, 1)
                .setValue(order || effectiveOrder)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.taskStatusMapping[categoryKey].order =
                        value;
                    await this.plugin.saveSettings();
                });
            slider.sliderEl.style.width = "200px";
        });

        // Add clear button to reset to default
        orderSetting.addButton((button) =>
            button
                .setButtonText("Use default")
                .setTooltip("Clear custom priority and use smart default")
                .onClick(async () => {
                    this.plugin.settings.taskStatusMapping[categoryKey].order =
                        undefined;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show new effective order
                    new Notice(
                        `Reset "${displayName}" display order to default`,
                    );
                }),
        );

        // Description field
        new Setting(advancedFields)
            .setName("Description")
            .setDesc(
                `Helps AI understand category meaning in Smart Search and Task Chat. Leave empty for smart defaults.`,
            )
            .addTextArea((textarea) => {
                textarea
                    .setPlaceholder(
                        "e.g., High-priority urgent tasks requiring immediate attention",
                    )
                    .setValue(description || "")
                    .onChange(async (value) => {
                        this.plugin.settings.taskStatusMapping[
                            categoryKey
                        ].description = value.trim() || undefined;
                        await this.plugin.saveSettings();
                    });
                textarea.inputEl.style.width = "100%";
                textarea.inputEl.style.minHeight = "60px";
            });

        // Terms field
        new Setting(advancedFields)
            .setName("Semantic terms")
            .setDesc(
                `Comma-separated terms for recognition in Smart Search and Task Chat (e.g., "urgent, critical").`,
            )
            .addTextArea((textarea) => {
                textarea
                    .setPlaceholder("e.g., urgent,critical")
                    .setValue(terms || "")
                    .onChange(async (value) => {
                        this.plugin.settings.taskStatusMapping[
                            categoryKey
                        ].terms = value.trim() || undefined;
                        await this.plugin.saveSettings();
                    });
                textarea.inputEl.style.width = "100%";
            });
    }

    /**
     * Configure provider-specific default settings
     * Ensures model, endpoint, and other settings are properly initialized
     */
    private async configureProviderDefaults(provider: string): Promise<void> {
        const providerConfig = this.getCurrentProviderConfig();
        const defaults =
            DEFAULT_SETTINGS.providerConfigs[
                provider as keyof typeof DEFAULT_SETTINGS.providerConfigs
            ];

        // Ensure endpoint is set (critical for Ollama!)
        if (!providerConfig.apiEndpoint) {
            providerConfig.apiEndpoint = defaults.apiEndpoint;
            Logger.info(
                `Set default endpoint for ${provider}: ${defaults.apiEndpoint}`,
            );
        }

        // Ensure model is set
        if (!providerConfig.model) {
            providerConfig.model = defaults.model;
            Logger.info(`Set default model for ${provider}: ${defaults.model}`);
        }

        // Ensure temperature is set
        if (providerConfig.temperature === undefined) {
            providerConfig.temperature = defaults.temperature;
        }

        // Ensure maxTokens is set
        if (!providerConfig.maxTokens) {
            providerConfig.maxTokens = defaults.maxTokens;
        }

        // Ensure contextWindow is set
        if (!providerConfig.contextWindow) {
            providerConfig.contextWindow = defaults.contextWindow;
        }

        // For Ollama, automatically try to fetch available models
        if (provider === "ollama") {
            try {
                Logger.info(
                    `Fetching Ollama models from ${providerConfig.apiEndpoint}...`,
                );
                const models = await ModelProviderService.fetchOllamaModels(
                    providerConfig.apiEndpoint,
                );
                if (models.length > 0) {
                    providerConfig.availableModels = models;
                    Logger.info(`Found ${models.length} Ollama models`);

                    // Set first available model if current model is from another provider
                    const currentModel = providerConfig.model;
                    if (!models.includes(currentModel)) {
                        providerConfig.model = models[0];
                        Logger.info(
                            `Switched to available model: ${models[0]}`,
                        );
                    }
                } else {
                    Logger.warn("No Ollama models found");
                }
            } catch (error) {
                Logger.error("Could not auto-fetch Ollama models:", error);
            }
        }
    }

    /**
     * Get API key description based on provider
     */
    private getApiKeyDescription(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return "Get your API key from platform.openai.com/api-keys";
            case "anthropic":
                return "Get your API key from console.anthropic.com/settings/keys";
            case "openrouter":
                return "Get your API key from openrouter.ai/keys";
            default:
                return "Your AI provider API key";
        }
    }

    /**
     * Get API key placeholder based on provider
     */
    private getApiKeyPlaceholder(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return "sk-...";
            case "anthropic":
                return "sk-ant-...";
            case "openrouter":
                return "sk-or-...";
            default:
                return "Enter your API key";
        }
    }

    /**
     * Get parsing model description based on parsing provider
     */
    private getParsingModelDescription(): string {
        switch (this.plugin.settings.parsingProvider) {
            case "openai":
                return "Model for AI query parsing. GPT-4o-mini is recommended for fast, cost-effective, and JSON parsing.";
            case "anthropic":
                return "Model for AI query parsing. Claude Sonnet 4 is recommended for quality parsing.";
            case "openrouter":
                return "Model for AI query parsing. Use any OpenAI or Anthropic model via OpenRouter.";
            case "ollama":
                return "Local model for query parsing.";
            default:
                return "Model for AI query parsing.";
        }
    }

    /**
     * Get analysis model description based on analysis provider
     */
    private getAnalysisModelDescription(): string {
        switch (this.plugin.settings.analysisProvider) {
            case "openai":
                return "Model for task analysis in Task Chat. GPT-4o-mini is recommended for high-quality insights.";
            case "anthropic":
                return "Model for task analysis in Task Chat. Claude Sonnet 4 is recommended for comprehensive analysis.";
            case "openrouter":
                return "Model for task analysis in Task Chat. Use any model via OpenRouter.";
            case "ollama":
                return "Local model for task analysis.";
            default:
                return "Model for task analysis in Task Chat.";
        }
    }

    /**
     * Get endpoint description based on provider
     */
    private getEndpointDescription(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return "OpenAI API endpoint. Use default unless using a proxy or custom deployment.";
            case "anthropic":
                return "Anthropic API endpoint. Use default unless using a proxy.";
            case "openrouter":
                return "OpenRouter API endpoint. Use default value.";
            case "ollama":
                return "Ollama server endpoint. Default is http://localhost:11434/api/chat";
            default:
                return "API endpoint URL";
        }
    }

    /**
     * Get endpoint placeholder based on provider
     */
    private getEndpointPlaceholder(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return "https://api.openai.com/v1/chat/completions";
            case "anthropic":
                return "https://api.anthropic.com/v1/messages";
            case "openrouter":
                return "https://openrouter.ai/api/v1/chat/completions";
            case "ollama":
                return "http://localhost:11434/api/chat";
            default:
                return "Enter API endpoint";
        }
    }

    /**
     * Get current provider configuration
     */
    private getCurrentProviderConfig() {
        return this.plugin.settings.providerConfigs[
            this.plugin.settings.aiProvider
        ];
    }

    /**
     * Get current API key for selected provider
     */
    private getCurrentApiKey(): string {
        return this.getCurrentProviderConfig().apiKey || "";
    }

    /**
     * Set current API key for selected provider
     */
    private setCurrentApiKey(value: string): void {
        this.getCurrentProviderConfig().apiKey = value;
    }

    /**
     * Get available models for current provider
     */
    private getAvailableModels(): string[] {
        const provider = this.plugin.settings.aiProvider;
        const providerConfig = this.getCurrentProviderConfig();
        const cached = providerConfig.availableModels;

        // Return cached models if available
        if (cached && cached.length > 0) {
            return cached;
        }

        // Return default models as fallback
        switch (provider) {
            case "openai":
                return ModelProviderService.getDefaultOpenAIModels();
            case "anthropic":
                return ModelProviderService.getDefaultAnthropicModels();
            case "openrouter":
                return ModelProviderService.getDefaultOpenRouterModels();
            case "ollama":
                return ModelProviderService.getDefaultOllamaModels();
            default:
                return [];
        }
    }

    /**
     * Get available models for a specific provider (not just current)
     */
    private getAvailableModelsForProvider(provider: string): string[] {
        const providerConfig =
            this.plugin.settings.providerConfigs[
                provider as keyof typeof this.plugin.settings.providerConfigs
            ];
        const cached = providerConfig?.availableModels;

        if (cached && cached.length > 0) {
            return cached;
        }

        // Return default models based on provider
        switch (provider) {
            case "openai":
                return ModelProviderService.getDefaultOpenAIModels();
            case "anthropic":
                return ModelProviderService.getDefaultAnthropicModels();
            case "openrouter":
                return ModelProviderService.getDefaultOpenRouterModels();
            case "ollama":
                return ModelProviderService.getDefaultOllamaModels();
            default:
                return [];
        }
    }

    /**
     * Refresh models for a specific provider
     */
    private async refreshModelsForProvider(provider: string): Promise<void> {
        const providerConfig =
            this.plugin.settings.providerConfigs[
                provider as keyof typeof this.plugin.settings.providerConfigs
            ];
        const apiKey = providerConfig?.apiKey || "";

        try {
            let models: string[] = [];

            switch (provider) {
                case "openai":
                    if (!apiKey) {
                        new Notice("Please set OpenAI API key first");
                        return;
                    }
                    new Notice("Fetching OpenAI models...");
                    models =
                        await ModelProviderService.fetchOpenAIModels(apiKey);
                    break;

                case "anthropic":
                    new Notice("Loading Anthropic models...");
                    models =
                        await ModelProviderService.fetchAnthropicModels(apiKey);
                    break;

                case "openrouter":
                    if (!apiKey) {
                        new Notice("Please set OpenRouter API key first");
                        return;
                    }
                    new Notice("Fetching OpenRouter models...");
                    models =
                        await ModelProviderService.fetchOpenRouterModels(
                            apiKey,
                        );
                    break;

                case "ollama":
                    new Notice("Fetching local Ollama models...");
                    models = await ModelProviderService.fetchOllamaModels(
                        providerConfig.apiEndpoint,
                    );
                    break;
            }

            if (models.length > 0) {
                providerConfig.availableModels = models;
                await this.plugin.saveSettings();
                new Notice(`Loaded ${models.length} models for ${provider}`);
            } else {
                new Notice("No models found. Using defaults.");
            }
        } catch (error) {
            Logger.error(`Error refreshing models for ${provider}:`, error);
            new Notice(
                `Failed to fetch models for ${provider}. Using defaults.`,
            );
        }
    }

    /**
     * Test connection to AI provider
     */
    private async testConnection(): Promise<{
        success: boolean;
        message: string;
    }> {
        const provider = this.plugin.settings.aiProvider;
        const apiKey = this.getCurrentApiKey();
        const model = this.getCurrentProviderConfig().model;

        // Validate inputs
        if (provider !== "ollama" && !apiKey) {
            return {
                success: false,
                message: "Please enter an API key first",
            };
        }

        if (!model) {
            return {
                success: false,
                message: "Please select a model first",
            };
        }

        try {
            switch (provider) {
                case "openai":
                    return await ModelProviderService.testOpenAIConnection(
                        apiKey,
                        model,
                    );

                case "anthropic":
                    return await ModelProviderService.testAnthropicConnection(
                        apiKey,
                        model,
                    );

                case "openrouter":
                    return await ModelProviderService.testOpenRouterConnection(
                        apiKey,
                        model,
                    );

                case "ollama":
                    return await ModelProviderService.testOllamaConnection(
                        this.getCurrentProviderConfig().apiEndpoint,
                        model,
                    );

                default:
                    return {
                        success: false,
                        message: "Unknown provider",
                    };
            }
        } catch (error) {
            return {
                success: false,
                message: `Test failed: ${error.message || "Unknown error"}`,
            };
        }
    }

    /**
     * Show connection test result with visual feedback
     */
    private showConnectionTestResult(
        containerEl: HTMLElement,
        result: { success: boolean; message: string },
    ): void {
        // Remove any existing test result
        const existingResult = containerEl.querySelector(
            ".connection-test-result",
        );
        if (existingResult) {
            existingResult.remove();
        }

        // Create result message element with appropriate class
        const statusClass = result.success ? "success" : "error";
        const resultEl = containerEl.createDiv({
            cls: `connection-test-result ${statusClass}`,
        });

        resultEl.setText(result.message);

        // Insert after the test connection setting
        const testConnectionSetting = Array.from(
            containerEl.querySelectorAll(".setting-item"),
        ).find((el) => el.textContent?.includes("Test connection"));

        if (testConnectionSetting) {
            testConnectionSetting.after(resultEl);
        }

        // Also show a notice
        new Notice(result.message, 5000);
    }

    /**
     * Render per-mode sort settings with multi-criteria support
     */
    private renderSortBySetting(): void {
        if (!this.sortByContainerEl) return;

        // Header with explanation
        new Setting(this.sortByContainerEl)
            .setName("Multi-criteria sorting")
            .setClass("setting-subsection-heading");

        const sortingInfo = this.sortByContainerEl.createDiv({
            cls: "setting-item-description",
        });
        const p13 = sortingInfo.createEl("p");
        p13.appendText("Select sorting criteria for tiebreaking. ");
        p13.createEl("a", {
            text: "→ Learn more about task sorting",
            href: "https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SORTING_SYSTEM.md",
        });

        // Unified sort settings (tag-based UI)
        const sortSetting = new Setting(this.sortByContainerEl)
            .setName("Task sort order")
            .setDesc("Relevance is always first.");

        // Create container for tag badges
        const tagsContainer = sortSetting.controlEl.createDiv({
            cls: "task-chat-sort-tags-container",
        });

        const renderTags = () => {
            tagsContainer.empty();

            const sortOrder = this.plugin.settings.taskSortOrder;

            // Render each criterion as a badge/tag
            sortOrder.forEach((criterion, index) => {
                const isRelevance = criterion === "relevance";
                const tag = tagsContainer.createEl("span", {
                    cls: isRelevance
                        ? "task-chat-sort-tag task-chat-sort-tag-locked"
                        : "task-chat-sort-tag",
                });

                // Criterion name
                tag.createSpan({
                    text: this.getCriterionDisplayName(criterion),
                    cls: "task-chat-sort-tag-text",
                });

                // Lock icon for relevance, remove button for others
                if (isRelevance) {
                    tag.createSpan({
                        text: "🔒",
                        cls: "task-chat-sort-tag-icon",
                    });
                } else {
                    const removeBtn = tag.createEl("button", {
                        text: "✕",
                        cls: "task-chat-sort-tag-remove",
                    });
                    removeBtn.addEventListener("click", async (e) => {
                        e.preventDefault();
                        const newOrder = sortOrder.filter(
                            (c) => c !== criterion,
                        );
                        this.plugin.settings.taskSortOrder = newOrder;
                        await this.plugin.saveSettings();
                        renderTags();
                    });
                }
            });

            // Add dropdown for adding new criteria
            const availableCriteria = this.getAvailableCriteria(sortOrder);
            if (availableCriteria.length > 0) {
                const addContainer = tagsContainer.createEl("span", {
                    cls: "task-chat-sort-tag task-chat-sort-tag-add",
                });

                const dropdown = addContainer.createEl("select", {
                    cls: "dropdown",
                });

                dropdown.createEl("option", {
                    text: "+ Add criterion",
                    value: "",
                });

                availableCriteria.forEach((criterion) => {
                    dropdown.createEl("option", {
                        text: this.getCriterionDisplayName(criterion),
                        value: criterion,
                    });
                });

                dropdown.addEventListener("change", async (e) => {
                    const selected = (e.target as HTMLSelectElement).value;
                    if (
                        selected &&
                        selected !== "" &&
                        !sortOrder.includes(
                            selected as import("./settings").SortCriterion,
                        )
                    ) {
                        const newOrder = [
                            ...sortOrder,
                            selected as import("./settings").SortCriterion,
                        ];
                        this.plugin.settings.taskSortOrder = newOrder;
                        await this.plugin.saveSettings();
                        renderTags();
                    }
                });
            }
        };

        renderTags();
    }

    /**
     * Refresh the sort tasks by setting when search mode changes
     */
    refreshSortBySetting(): void {
        if (!this.sortByContainerEl) return;

        // Clear the container and re-render (keeps position in settings list)
        this.sortByContainerEl.empty();
        this.renderSortBySetting();

        Logger.debug(
            `Sort settings refreshed: Default chat mode = ${this.plugin.settings.defaultChatMode}`,
        );
    }

    /**
     * Get display name for a sort criterion
     */
    private getCriterionDisplayName(
        criterion: import("./settings").SortCriterion,
    ): string {
        switch (criterion) {
            case "relevance":
                return "Relevance";
            case "dueDate":
                return "Due date";
            case "priority":
                return "Priority";
            case "status":
                return "Status";
            case "created":
                return "Created date";
            case "alphabetical":
                return "Alphabetical";
            default:
                return criterion;
        }
    }

    /**
     * Get available criteria that aren't already in the sort order
     */
    private getAvailableCriteria(
        currentOrder: import("./settings").SortCriterion[],
    ): import("./settings").SortCriterion[] {
        const allCriteria: import("./settings").SortCriterion[] = [
            "relevance",
            "dueDate",
            "priority",
            "status",
            "created",
            "alphabetical",
        ];

        return allCriteria.filter((c) => !currentOrder.includes(c));
    }

    /**
     * Validate model selection and show warning if model not in available list
     * @param provider Provider name
     * @param model Model name to validate
     * @param purpose "parsing" or "analysis"
     */
    private validateModel(
        provider: string,
        model: string,
        purpose: "parsing" | "analysis",
    ): void {
        // Empty model is OK (uses provider default)
        if (!model || model.trim() === "") {
            return;
        }

        const availableModels = this.getAvailableModelsForProvider(provider);

        // No models cached yet - show info notice
        if (availableModels.length === 0) {
            new Notice(generateModelListNotLoadedInfo(provider), 5000);
            Logger.debug(`Model validation: No cached models for ${provider}`);
            return;
        }

        // Check if model is in available list
        if (!availableModels.includes(model)) {
            new Notice(
                generateModelValidationWarning(model, provider, purpose),
                8000,
            );
            Logger.warn(
                `Model validation: ${model} not found in ${provider} models (${purpose})`,
            );
        } else {
            Logger.debug(
                `Model validation: ${model} found in ${provider} models (${purpose}) ✓`,
            );
        }
    }
}
