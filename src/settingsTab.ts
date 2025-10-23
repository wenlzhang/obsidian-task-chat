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
        const overviewBox = containerEl.createDiv({
            cls: "task-chat-info-box",
        });
        overviewBox.innerHTML = `
            <p><strong>👉 Start with Defaults:</strong> Most settings are pre-configured with recommended values. Most users don't need to change anything!</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/README.md#settings">→ Learn more about settings and how they affect your results</a></p>
        `;

        // AI Provider Settings
        containerEl.createEl("h2", { text: "AI provider" });

        new Setting(containerEl)
            .setName("AI provider")
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
                        this.configureProviderDefaults(value);
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

        const modelSetting = new Setting(containerEl)
            .setName("Model")
            .setDesc(this.getModelDescription());

        // Add dropdown for model selection
        modelSetting.addDropdown((dropdown) => {
            const availableModels = this.getAvailableModels();

            if (availableModels.length === 0) {
                dropdown.addOption("", "Loading models...");
            } else {
                availableModels.forEach((model) => {
                    dropdown.addOption(model, model);
                });
            }

            dropdown
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                });
        });

        // Add refresh button to reload models
        modelSetting.addButton((button) =>
            button
                .setButtonText("Refresh")
                .setTooltip("Fetch latest available models")
                .onClick(async () => {
                    button.setButtonText("Loading...");
                    button.setDisabled(true);
                    await this.refreshModels();
                    button.setButtonText("Refresh");
                    button.setDisabled(false);
                    this.display(); // Refresh UI to show new models
                }),
        );

        // Add model info based on provider
        const modelInfo = containerEl.createDiv({
            cls: "setting-item-description model-info-display",
        });
        modelInfo.innerHTML = this.getModelInfo();

        // Add Test Connection button
        const testConnectionSetting = new Setting(containerEl)
            .setName("Test connection")
            .setDesc(
                "Verify that your API key and model are working correctly",
            );

        testConnectionSetting.addButton((button) =>
            button
                .setButtonText("Test Connection")
                .setTooltip("Verify API configuration")
                .onClick(async () => {
                    button.setButtonText("Testing...");
                    button.setDisabled(true);

                    const result = await this.testConnection();

                    button.setButtonText("Test Connection");
                    button.setDisabled(false);

                    // Show result below the button
                    this.showConnectionTestResult(containerEl, result);
                }),
        );

        new Setting(containerEl)
            .setName("Temperature")
            .setDesc(
                "Controls AI response randomness (0.0-2.0). Lower values (e.g., 0.1) produce consistent, focused responses. Higher values (e.g., 1.0) produce more creative, varied responses. Default: 0.1 for consistency.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 2, 0.1)
                    .setValue(this.plugin.settings.temperature)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.temperature = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Max response length")
            .setDesc(
                "Maximum length of AI responses in Task Chat mode. Dependent on model capabilities. Higher = more detailed but slower and more expensive. Lower = faster and cheaper but may miss details. Recommended: 2000 (balanced), 4000 (detailed), 1000 (concise). Only affects Task Chat responses, not query parsing.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(500, 64000, 100)
                    .setValue(this.plugin.settings.maxTokensChat)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxTokensChat = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("API endpoint")
            .setDesc(this.getEndpointDescription())
            .addText((text) =>
                text
                    .setPlaceholder(this.getEndpointPlaceholder())
                    .setValue(this.plugin.settings.apiEndpoint)
                    .onChange(async (value) => {
                        this.plugin.settings.apiEndpoint = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Add provider-specific setup instructions
        if (this.plugin.settings.aiProvider === "ollama") {
            const ollamaInfo = containerEl.createDiv({
                cls: "ollama-setup-info",
            });
            ollamaInfo.innerHTML = `
                <strong>Ollama setup:</strong><br>
                1. Install Ollama from <a href="https://ollama.com" target="_blank">ollama.com</a><br>
                2. Pull a model: <code>ollama pull llama3.2</code> (or mistral, phi3, etc.)<br>
                3. Start server with CORS: <code>OLLAMA_ORIGINS="app://obsidian.md*" ollama serve</code><br>
                4. On macOS app: <code>launchctl setenv OLLAMA_ORIGINS "app://obsidian.md*"</code> then restart Ollama<br>
                5. On Windows: <code>$env:OLLAMA_ORIGINS="app://obsidian.md*"; ollama serve</code><br>
                <br>
                <strong>Available models:</strong> llama3.2, llama3.1, mistral, phi3, gemma2, qwen2.5, and more at <a href="https://ollama.com/library" target="_blank">ollama.com/library</a>
            `;
        }

        // Chat Settings
        containerEl.createEl("h2", { text: "Task chat" });

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
        containerEl.createEl("h2", { text: "Chat mode" });

        new Setting(containerEl)
            .setName("Default chat mode")
            .setDesc(
                "Sets the default mode for new chat sessions. You can always override this per-query using the dropdown in the chat interface. Simple Search is free and fast. Smart Search uses AI to expand keywords (very low cost). Task Chat provides full AI analysis and recommendations (higher cost).",
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
        modeComparisonInfo.innerHTML = `
            <p><strong>ℹ️ Search mode comparison:</strong> Simple (free, regex-based), Smart (AI keyword expansion), Task Chat (full AI analysis).</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SEARCH_MODES.md">→ Learn more about search modes</a></p>
        `;

        // Semantic Expansion
        containerEl.createEl("h2", { text: "Semantic expansion" });

        const semanticExpansionInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        semanticExpansionInfo.innerHTML = `
            <p>Configure keyword expansion and custom property terms.</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SEMANTIC_EXPANSION.md">→ Learn more about semantic expansion</a></p>
        `;

        new Setting(containerEl)
            .setName("Enable semantic expansion")
            .setDesc(
                "Expand keywords with semantic equivalents across configured languages. Example: 'develop' → 'build', 'create'. Improves recall but increases token usage.",
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
            .setName("Max keyword expansions")
            .setDesc(
                "Maximum variations per keyword per language. Default: 5. Higher values improve recall but increase token usage.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 15, 1)
                    .setValue(this.plugin.settings.maxKeywordExpansions)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxKeywordExpansions = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Priority terms")
            .setDesc(
                "Custom priority terms (e.g., 'priority, urgent'). Combines with built-in terms.",
            )
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
            .setDesc(
                "Custom due date terms (e.g., 'due, deadline'). Combines with built-in terms.",
            )
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
            .setDesc(
                "Custom status terms (e.g., 'done, completed, in progress'). Combines with built-in terms.",
            )
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
        containerEl.createEl("h2", { text: "Smart search & Task chat" });

        const aiEnhancementInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        aiEnhancementInfo.innerHTML = `
            <p><strong>🤖 AI features (automatic in Smart Search & Task Chat):</strong> Keyword expansion, property recognition, typo correction.</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SEMANTIC_EXPANSION.md">→ Learn more about semantic expansion</a></p>
        `;

        new Setting(containerEl)
            .setName("Max tasks for AI analysis")
            .setDesc(
                "Maximum tasks to send to AI in Task Chat mode. Default: 100. Higher values provide better context but increase token usage.",
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
                "Display query interpretation in Task Chat mode (detected language, typo corrections, property recognition).",
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
            .setDesc(
                "Show AI responses as they're generated (like ChatGPT). Works with all providers.",
            )
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

        // DataView Settings
        containerEl.createEl("h2", { text: "DataView integration" });

        const dataviewInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        dataviewInfo.innerHTML = `
            <p>Configure task property field names.</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/README.md#dataview-integration">→ Learn more about DataView integration and troubleshooting</a></p>
        `;

        new Setting(containerEl)
            .setName("Due date field")
            .setDesc("DataView field name for due dates")
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
            .setDesc("DataView field name for creation dates")
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
            .setDesc("DataView field name for completion dates")
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
            .setDesc("DataView field name for priority")
            .addText((text) =>
                text
                    .setPlaceholder("p")
                    .setValue(this.plugin.settings.dataviewKeys.priority)
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewKeys.priority = value;
                        await this.plugin.saveSettings();
                    }),
            );

        containerEl.createDiv({
            text: "Define which DataView values map to each priority level. Separate multiple values with commas. Supports inline fields like [p::1].",
            cls: "setting-item-description",
        });

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
        containerEl.createEl("h2", { text: "Status category" });

        const statusCategoriesDesc = containerEl.createDiv({
            cls: "setting-item-description",
        });
        statusCategoriesDesc.innerHTML = `
            <p>Define custom categories with checkbox symbols, scores, and query aliases. Protected: Open, Completed, In Progress, Cancelled, Other.</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/STATUS_CATEGORIES.md">→ Learn more about status categories and score vs order</a></p>
        `;

        // Validate status orders and show warnings if duplicates found
        const validation = TaskPropertyService.validateStatusOrders(
            this.plugin.settings.taskStatusMapping,
        );

        if (!validation.valid) {
            const warningBox = containerEl.createDiv({
                cls: "task-chat-warning-box",
            });

            const warningTitle = warningBox.createEl("div", {
                cls: "task-chat-warning-title",
            });
            warningTitle.innerHTML = "⚠️ Duplicate Sort Orders Detected";

            for (const warning of validation.warnings) {
                const warningText = warningBox.createEl("p", {
                    cls: "task-chat-warning-message",
                });
                warningText.textContent = warning;
            }

            const warningExplanation = warningBox.createEl("p", {
                cls: "task-chat-warning-explanation",
            });
            warningExplanation.textContent =
                "When multiple categories have the same order number, sorting by status becomes unpredictable. Click 'Auto-Fix' to automatically renumber categories with proper gaps (10, 20, 30...).";

            new Setting(warningBox)
                .setName("Auto-Fix Duplicates")
                .setDesc(
                    "Automatically renumber all categories to remove conflicts",
                )
                .addButton((button) =>
                    button
                        .setButtonText("Auto-Fix Now")
                        .setCta()
                        .onClick(async () => {
                            this.plugin.settings.taskStatusMapping =
                                TaskPropertyService.autoFixStatusOrders(
                                    this.plugin.settings.taskStatusMapping,
                                );
                            await this.plugin.saveSettings();
                            new Notice(
                                "Status orders fixed! Categories renumbered with gaps (10, 20, 30...)",
                            );
                            this.display(); // Refresh UI
                        }),
                );
        }

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
                    .setButtonText("+ Add Category")
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
        containerEl.createEl("h2", { text: "Task filtering" });

        const filteringInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        filteringInfo.innerHTML = `
            <p>Control which tasks appear in results.</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/README.md#task-filtering">→ Learn more about filtering options</a></p>
        `;

        new Setting(containerEl)
            .setName("Relevance score")
            .setDesc(
                `Minimum keyword relevance score (0 = disabled). Current max: ${((this.plugin.settings.relevanceCoreWeight + 1.0) * 100).toFixed(0)}%. Use to exclude tasks with weak keyword matches regardless of task properties.`,
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
                `Filter strictness (0-100%). 0% = adaptive (recommended), higher = fewer but higher-quality results.`,
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

        // Task scoring
        containerEl.createEl("h2", { text: "Task scoring" });

        const scoringInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        scoringInfo.innerHTML = `
            <p><strong>📊 Task scoring:</strong> Control how much each factor (relevance, due date, priority, status) affects task scores.</p>
            <p><a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SCORING_SYSTEM.md">→ Learn more about the scoring system</a></p>
        `;

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

            maxScoreValue.innerHTML = `
                <strong>📈 Max score: ${maxScore.toFixed(1)} points</strong> 
                (R: ${relevPart.toFixed(1)} + D: ${datePart.toFixed(1)} + P: ${priorPart.toFixed(1)} + S: ${statusPart.toFixed(1)})
            `;
        };

        // Initial display
        this.updateMaxScoreDisplay();

        // Advanced Scoring Coefficients Section
        containerEl.createEl("h3", { text: "Advanced scoring coefficients" });

        const advancedScoringInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        advancedScoringInfo.innerHTML = `
            <p><strong>🔧 Advanced:</strong> Fine-tune specific score components (optional). Most users don't need to change these.</p>
        `;

        // Relevance Sub-Coefficients
        containerEl.createEl("h3", { text: "Relevance sub-coefficients" });

        new Setting(containerEl)
            .setName("Core keyword match bonus")
            .setDesc(
                "Bonus for exact keyword matches (0.0-1.0). Default: 0.2. Set to 0 for pure semantic search. Affects max relevance score: (value + 1.0).",
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
        containerEl.createEl("h3", { text: "Due date sub-coefficients" });

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
        containerEl.createEl("h3", { text: "Priority sub-coefficients" });

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

        // Status Sub-Coefficients - MOVED TO STATUS MAPPING
        containerEl.createEl("h3", { text: "Status scores" });

        const statusScoreNote = containerEl.createDiv({
            cls: "setting-item-description task-chat-info-box",
        });
        statusScoreNote.innerHTML = `
            <p>Each status category (open, completed, in progress, etc.) has its own score that you can customize. Scroll up to the "Status category" section to manage categories and their scores.</p>
        `;

        // Reset Buttons Section
        containerEl.createEl("h3", { text: "Reset coefficients to defaults" });

        // Reset all advanced coefficients
        new Setting(containerEl)
            .setName("Reset all advanced coefficients")
            .setDesc(
                "Reset all sub-coefficients (relevance, due date, priority, status) to defaults.",
            )
            .addButton((button) =>
                button
                    .setButtonText("Reset All Advanced")
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
                        new Notice(
                            "All advanced coefficients reset to defaults",
                        );
                        this.display(); // Refresh UI
                    }),
            );

        // Reset main coefficients
        new Setting(containerEl)
            .setName("Reset main coefficients")
            .setDesc("Reset weights to defaults (R:20, D:4, P:1, S:1).")
            .addButton((button) =>
                button
                    .setButtonText("Reset Main Coefficients")
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
                        new Notice("Main coefficients reset to defaults");
                        // Update max score display
                        if (this.updateMaxScoreDisplay) {
                            this.updateMaxScoreDisplay();
                        }
                        this.display(); // Refresh UI
                    }),
            );

        // Reset relevance sub-coefficients
        new Setting(containerEl)
            .setName("Reset relevance core bonus")
            .setDesc("Reset core keyword match bonus to 0.2.")
            .addButton((button) =>
                button.setButtonText("Reset Core Bonus").onClick(async () => {
                    this.plugin.settings.relevanceCoreWeight =
                        DEFAULT_SETTINGS.relevanceCoreWeight;
                    await this.plugin.saveSettings();
                    new Notice(
                        "Core keyword match bonus reset to default (0.2)",
                    );
                    this.display();
                }),
            );

        // Reset due date sub-coefficients
        new Setting(containerEl)
            .setName("Reset due date sub-coefficients")
            .setDesc("Reset all time-range scores to defaults.")
            .addButton((button) =>
                button.setButtonText("Reset Due Date").onClick(async () => {
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
                    new Notice("Due date sub-coefficients reset to defaults");
                    this.display();
                }),
            );

        // Reset priority sub-coefficients
        new Setting(containerEl)
            .setName("Reset priority sub-coefficients")
            .setDesc("Reset all priority level scores to defaults.")
            .addButton((button) =>
                button.setButtonText("Reset Priority").onClick(async () => {
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
                    new Notice("Priority sub-coefficients reset to defaults");
                    this.display();
                }),
            );

        // Reset status category
        new Setting(containerEl)
            .setName("Reset status category")
            .setDesc("Reset all status categories to defaults.")
            .addButton((button) =>
                button.setButtonText("Reset Status").onClick(async () => {
                    this.plugin.settings.taskStatusMapping = JSON.parse(
                        JSON.stringify(DEFAULT_SETTINGS.taskStatusMapping),
                    );
                    await this.plugin.saveSettings();
                    new Notice("Status categories reset to defaults");
                    this.display();
                }),
            );

        // Task Display
        containerEl.createEl("h2", { text: "Task display" });

        // Store the container for this setting so we can refresh it
        // Create a dedicated div to hold the sort setting (prevents scroll issues when refreshed)
        this.sortByContainerEl = containerEl.createDiv(
            "task-chat-sort-container",
        );
        this.renderSortBySetting();

        new Setting(containerEl)
            .setName("Max direct results")
            .setDesc(
                "Maximum tasks to show in Simple Search mode (no token cost). Default: 20.",
            )
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

        containerEl.createEl("h2", { text: "Advanced" });

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

        // Pricing Information
        containerEl.createEl("h3", { text: "Pricing data" });

        const lastUpdate = PricingService.getTimeSinceUpdate(
            this.plugin.settings.pricingCache.lastUpdated,
        );
        const modelCount = Object.keys(
            this.plugin.settings.pricingCache.data,
        ).length;

        const pricingInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });
        pricingInfo.innerHTML = `<p>${modelCount} models cached, updated ${lastUpdate}</p>`;

        new Setting(containerEl)
            .setName("Refresh pricing")
            .setDesc("Update pricing data from OpenRouter API")
            .addButton((button) =>
                button.setButtonText("Refresh Now").onClick(async () => {
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

                    button.setButtonText("Refresh Now");
                    button.setDisabled(false);
                }),
            );

        // Usage Statistics
        containerEl.createEl("h3", { text: "Usage statistics" });

        const totalTokens =
            this.plugin.settings.totalTokensUsed.toLocaleString();
        const totalCost = this.plugin.settings.totalCost.toFixed(4);

        const statsContainer = containerEl.createDiv({
            cls: "setting-item-description",
        });
        statsContainer.innerHTML = `<p>Total: ${totalTokens} tokens, $${totalCost}</p>`;

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
            console.error(
                `[Task Chat] Invalid config for category: ${categoryKey}`,
            );
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
                    "Default Markdown open task (space character), cannot be changed";
                symbolsInput.placeholder = "(space)";
            } else if (categoryKey === "other") {
                symbolsInput.title =
                    "Catches all unassigned symbols automatically, no manual symbols needed";
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

        // Order field with effective order display
        const effectiveOrder = TaskPropertyService.getStatusOrder(
            categoryKey,
            this.plugin.settings,
        );
        const orderDesc =
            order !== undefined
                ? `Sort priority (1=highest). Controls task order when sorting by status. Current effective order: ${effectiveOrder}. Leave empty for smart defaults.`
                : `Sort priority (1=highest). Controls task order when sorting by status. Currently using default: ${effectiveOrder}. Built-in: open=1, inProgress=2, completed=6, cancelled=7. Custom=8.`;

        new Setting(advancedFields)
            .setName("Sort order")
            .setDesc(orderDesc)
            .addText((text) => {
                text.setPlaceholder("e.g., 3")
                    .setValue(order !== undefined ? String(order) : "")
                    .onChange(async (value) => {
                        const parsed = value.trim()
                            ? parseInt(value.trim())
                            : undefined;
                        if (value.trim() && (isNaN(parsed!) || parsed! < 1)) {
                            text.setValue(
                                order !== undefined ? String(order) : "",
                            );
                            new Notice(
                                "Order must be a positive number (1 or higher)",
                            );
                            return;
                        }
                        this.plugin.settings.taskStatusMapping[
                            categoryKey
                        ].order = parsed;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = "80px";
            });

        // Description field
        new Setting(advancedFields)
            .setName("Description")
            .setDesc(
                `Category description for AI prompts. Helps AI understand this category's meaning in Smart Search and Task Chat. Leave empty for smart defaults.`,
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
                `Comma-separated terms for recognition in Smart Search and Task Chat (e.g., "urgent, critical"). Add terms in multiple languages for multilingual support!`,
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
                textarea.inputEl.style.minHeight = "60px";
            });
    }

    /**
     * Configure provider-specific defaults
     */
    private configureProviderDefaults(provider: string): void {
        switch (provider) {
            case "openai":
                if (
                    !this.plugin.settings.apiEndpoint ||
                    this.plugin.settings.apiEndpoint.includes("anthropic") ||
                    this.plugin.settings.apiEndpoint.includes("openrouter") ||
                    this.plugin.settings.apiEndpoint.includes("localhost") ||
                    this.plugin.settings.apiEndpoint.includes("11434")
                ) {
                    this.plugin.settings.apiEndpoint =
                        "https://api.openai.com/v1/chat/completions";
                }
                if (
                    this.plugin.settings.model.includes("claude") ||
                    this.plugin.settings.model.includes("llama") ||
                    this.plugin.settings.model.includes("mistral")
                ) {
                    this.plugin.settings.model = "gpt-4o-mini";
                }
                break;
            case "anthropic":
                if (
                    !this.plugin.settings.apiEndpoint ||
                    this.plugin.settings.apiEndpoint.includes("openai") ||
                    this.plugin.settings.apiEndpoint.includes("openrouter") ||
                    this.plugin.settings.apiEndpoint.includes("localhost") ||
                    this.plugin.settings.apiEndpoint.includes("11434")
                ) {
                    this.plugin.settings.apiEndpoint =
                        "https://api.anthropic.com/v1/messages";
                }
                if (
                    this.plugin.settings.model.includes("gpt") ||
                    this.plugin.settings.model.includes("llama") ||
                    this.plugin.settings.model.includes("mistral")
                ) {
                    this.plugin.settings.model = "claude-3-5-sonnet-20241022";
                }
                break;
            case "openrouter":
                if (
                    !this.plugin.settings.apiEndpoint ||
                    this.plugin.settings.apiEndpoint.includes("openai") ||
                    this.plugin.settings.apiEndpoint.includes("anthropic") ||
                    this.plugin.settings.apiEndpoint.includes("localhost") ||
                    this.plugin.settings.apiEndpoint.includes("11434")
                ) {
                    this.plugin.settings.apiEndpoint =
                        "https://openrouter.ai/api/v1/chat/completions";
                }
                break;
            case "ollama":
                if (
                    !this.plugin.settings.apiEndpoint ||
                    this.plugin.settings.apiEndpoint.includes("openai") ||
                    this.plugin.settings.apiEndpoint.includes("anthropic") ||
                    this.plugin.settings.apiEndpoint.includes("openrouter")
                ) {
                    this.plugin.settings.apiEndpoint =
                        "http://localhost:11434/api/chat";
                }
                if (
                    this.plugin.settings.model.includes("gpt") ||
                    this.plugin.settings.model.includes("claude")
                ) {
                    this.plugin.settings.model = "llama3.2";
                }
                break;
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
     * Get model description based on provider
     */
    private getModelDescription(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return "OpenAI model to use. GPT-4o-mini is cost-effective and fast.";
            case "anthropic":
                return "Claude model to use. Claude 3.5 Sonnet offers excellent performance.";
            case "openrouter":
                return "Any model available on OpenRouter. Check openrouter.ai/models for the full list.";
            case "ollama":
                return "Local model name. Must be pulled first with 'ollama pull <model>'.";
            default:
                return "AI model to use";
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
     * Get current API key for selected provider
     */
    private getCurrentApiKey(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return this.plugin.settings.openaiApiKey || "";
            case "anthropic":
                return this.plugin.settings.anthropicApiKey || "";
            case "openrouter":
                return this.plugin.settings.openrouterApiKey || "";
            default:
                return "";
        }
    }

    /**
     * Set current API key for selected provider
     */
    private setCurrentApiKey(value: string): void {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                this.plugin.settings.openaiApiKey = value;
                break;
            case "anthropic":
                this.plugin.settings.anthropicApiKey = value;
                break;
            case "openrouter":
                this.plugin.settings.openrouterApiKey = value;
                break;
        }
    }

    /**
     * Get available models for current provider
     */
    private getAvailableModels(): string[] {
        const provider = this.plugin.settings.aiProvider;
        const cached = this.plugin.settings.availableModels[provider];

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
     * Refresh models from provider API
     */
    private async refreshModels(): Promise<void> {
        const provider = this.plugin.settings.aiProvider;
        const apiKey = this.getCurrentApiKey();

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
                        this.plugin.settings.apiEndpoint,
                    );
                    break;
            }

            if (models.length > 0) {
                this.plugin.settings.availableModels[provider] = models;
                await this.plugin.saveSettings();
                new Notice(`Loaded ${models.length} models`);
            } else {
                new Notice("No models found. Using defaults.");
            }
        } catch (error) {
            console.error("Error refreshing models:", error);
            new Notice("Failed to fetch models. Using defaults.");
        }
    }

    /**
     * Get model info text
     */
    private getModelInfo(): string {
        const models = this.getAvailableModels();
        const count = models.length;

        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return `<strong>${count} OpenAI models available</strong> - Click "Refresh" to fetch latest from API`;
            case "anthropic":
                return `<strong>${count} Claude models available</strong> - Latest models from Anthropic`;
            case "openrouter":
                return `<strong>${count} models available</strong> - Click "Refresh" to fetch from OpenRouter. Visit <a href="https://openrouter.ai/models" target="_blank">openrouter.ai/models</a> for details.`;
            case "ollama":
                return `<strong>${count} models found</strong> - Click "Refresh" to detect installed local models. Install more at <a href="https://ollama.com/library" target="_blank">ollama.com/library</a>`;
            default:
                return "";
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
        const model = this.plugin.settings.model;

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
                        this.plugin.settings.apiEndpoint,
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
        this.sortByContainerEl.createEl("h3", {
            text: "Multi-criteria sorting",
        });

        const sortingInfo = this.sortByContainerEl.createDiv({
            cls: "setting-item-description",
        });
        sortingInfo.innerHTML = `
            <p>Select sorting criteria for tiebreaking. <a href="https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/SORTING_SYSTEM.md">→ Learn more</a></p>
        `;

        // Unified sort settings (tag-based UI)
        const sortSetting = new Setting(this.sortByContainerEl)
            .setName("Task sort order")
            .setDesc(
                "Relevance is always first. Click ✕ to remove other criteria.",
            );

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

        // Add helpful note
        sortSetting.descEl.createEl("div", {
            text: "💡 Default: Relevance, Due date, Priority",
            cls: "setting-item-description",
        });
    }

    /**
     * Refresh the sort tasks by setting when search mode changes
     */
    refreshSortBySetting(): void {
        if (!this.sortByContainerEl) return;

        // Clear the container and re-render (keeps position in settings list)
        this.sortByContainerEl.empty();
        this.renderSortBySetting();

        console.log(
            `[Task Chat] Sort settings refreshed: Default chat mode = ${this.plugin.settings.defaultChatMode}`,
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
}
