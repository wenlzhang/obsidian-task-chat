import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import TaskChatPlugin from "./main";
import { ModelProviderService } from "./services/modelProviderService";
import { PricingService } from "./services/pricingService";

export class SettingsTab extends PluginSettingTab {
    plugin: TaskChatPlugin;

    constructor(app: App, plugin: TaskChatPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Task Chat settings" });

        // AI Provider Settings
        containerEl.createEl("h3", { text: "AI provider" });

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
        containerEl.createEl("h3", { text: "Chat" });

        new Setting(containerEl)
            .setName("Max chat history")
            .setDesc("Maximum number of messages to keep in chat history")
            .addText((text) =>
                text
                    .setPlaceholder("50")
                    .setValue(String(this.plugin.settings.maxChatHistory))
                    .onChange(async (value) => {
                        const num = parseInt(value);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.maxChatHistory = num;
                            await this.plugin.saveSettings();
                        }
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
            .setName("Response language")
            .setDesc(
                "Choose the language for AI responses. Use 'Auto' to match user input language. For multi-language support, configure 'Query languages for semantic search' below.",
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
                        .setPlaceholder("e.g., Always respond in Spanish")
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
            .setName("AI query understanding (query parsing only)")
            .setDesc(
                "Use AI to understand your queries (~$0.0001/query). Improves semantic understanding and multilingual support. When disabled, uses free regex-based parsing. Note: AI task analysis is always available and automatic regardless of this setting - it triggers based on query complexity and result count.",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useAIQueryParsing)
                    .onChange(async (value) => {
                        this.plugin.settings.useAIQueryParsing = value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Info section about AI Task Analysis
        containerEl.createDiv("task-chat-info-box", (el) => {
            el.createEl("div", {
                text: "ℹ️ About AI Task Analysis",
                cls: "task-chat-info-box-title",
            });

            el.createEl("div", {
                text: "AI task analysis is ALWAYS AVAILABLE and works automatically regardless of the query parsing setting above. It intelligently decides when to use AI based on:",
                cls: "task-chat-info-box-description",
            });

            const list = el.createEl("ul");
            list.createEl("li", {
                text: "Query complexity (2+ filter types = AI analysis)",
            });
            list.createEl("li", {
                text: `Result count (>${this.plugin.settings.maxDirectResults} results = AI analysis)`,
            });
            list.createEl("li", {
                text: "Simple queries with few results use direct search (no cost)",
            });

            el.createEl("div", {
                text: "Cost: ~$0.002 per AI analysis. You can control when it triggers by adjusting 'Max direct results' below.",
                cls: "task-chat-info-box-cost",
            });
        });

        new Setting(containerEl)
            .setName("Query languages for semantic search")
            .setDesc(
                "Languages to use for semantic keyword expansion and AI response. Requires 'AI query understanding' to be enabled. When 'Response language' is set to 'Auto', the AI will detect and respond in the language from this list that matches your query. When you search in one language, keywords are automatically translated to all configured languages for better cross-language matching. Examples: English, Español. Separate with commas.",
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

        // Task Display Settings Section
        containerEl.createEl("h3", { text: "Task Display" });

        new Setting(containerEl)
            .setName("Max direct results")
            .setDesc(
                "Maximum tasks to show without using AI (no token cost). Default: 20. Simple queries like 'overdue tasks' show results directly.",
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

        new Setting(containerEl)
            .setName("Max tasks for AI analysis")
            .setDesc(
                "Maximum tasks to send to AI for analysis. Default: 30. More context helps AI give better recommendations but increases token usage.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(5, 100, 5)
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
            .setName("Sort tasks by")
            .setDesc(
                'Field to sort tasks by. "AI Relevance" keeps search-ranked order (useful for keyword searches).',
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("relevance", "AI Relevance")
                    .addOption("dueDate", "Due Date")
                    .addOption("priority", "Priority")
                    .addOption("created", "Created Date")
                    .addOption("alphabetical", "Alphabetical")
                    .setValue(this.plugin.settings.taskSortBy)
                    .onChange(async (value) => {
                        this.plugin.settings.taskSortBy = value as any;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Sort direction")
            .setDesc(
                'Sort order: "Ascending" shows earliest dates/highest priorities first (good for overdue/urgent tasks). "Descending" shows latest dates/lowest priorities first.',
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("asc", "Ascending (Early→Late, 1→4, A→Z)")
                    .addOption("desc", "Descending (Late→Early, 4→1, Z→A)")
                    .setValue(this.plugin.settings.taskSortDirection)
                    .onChange(async (value) => {
                        this.plugin.settings.taskSortDirection = value as any;
                        await this.plugin.saveSettings();
                    }),
            );

        containerEl.createEl("h3", { text: "Advanced" });

        new Setting(containerEl)
            .setName("System prompt")
            .setDesc("System prompt for the AI assistant (advanced)")
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
            );

        // DataView Settings
        containerEl.createEl("h3", { text: "DataView integration" });

        containerEl.createDiv({
            text: "Configure how task properties are read from DataView. These settings should match your task metadata fields.",
            cls: "setting-item-description",
        });

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

        // Priority Mapping
        containerEl.createEl("h3", { text: "Priority mapping" });

        containerEl.createDiv({
            text: "Define which DataView values map to each priority level. Separate multiple values with commas. Supports inline fields like [p::1].",
            cls: "setting-item-description",
        });

        new Setting(containerEl)
            .setName("Priority 1 (highest) values")
            .setDesc("Values that indicate priority 1 (e.g., 1, p1, high)")
            .addText((text) =>
                text
                    .setPlaceholder("1, p1, high, highest")
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
                    .setPlaceholder("2, p2, medium, med")
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

        // Pricing Information
        containerEl.createEl("h3", { text: "Pricing data" });

        const pricingInfo = containerEl.createDiv({
            cls: "setting-item-description",
        });

        const lastUpdate = PricingService.getTimeSinceUpdate(
            this.plugin.settings.pricingCache.lastUpdated,
        );
        const modelCount = Object.keys(
            this.plugin.settings.pricingCache.data,
        ).length;

        pricingInfo.createEl("p", {
            text: `Pricing database: ${modelCount} models cached`,
        });
        pricingInfo.createEl("p", {
            text: `Last updated: ${lastUpdate}`,
        });
        pricingInfo.createEl("p", {
            text: "Pricing is fetched from OpenRouter API daily and includes all major providers (OpenAI, Anthropic, etc.)",
            cls: "setting-item-description",
        });

        new Setting(containerEl)
            .setName("Refresh pricing")
            .setDesc("Manually update pricing data from OpenRouter API")
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

        const statsContainer = containerEl.createDiv({
            cls: "setting-item-description",
        });

        const totalTokens =
            this.plugin.settings.totalTokensUsed.toLocaleString();
        const totalCost = this.plugin.settings.totalCost.toFixed(4);

        statsContainer.createEl("p", {
            text: `Total tokens used: ${totalTokens}`,
        });
        statsContainer.createEl("p", {
            text: `Total cost: $${totalCost} (based on real-time API pricing)`,
        });

        new Setting(containerEl)
            .setName("Reset statistics")
            .setDesc("Clear all usage statistics and cost tracking")
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
     * Get model placeholder based on provider
     */
    private getModelPlaceholder(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return "gpt-4o-mini";
            case "anthropic":
                return "claude-3-5-sonnet-20241022";
            case "openrouter":
                return "openai/gpt-4o-mini";
            case "ollama":
                return "llama3.2";
            default:
                return "Enter model name";
        }
    }

    /**
     * Get model suggestions based on provider
     */
    private getModelSuggestions(): string {
        switch (this.plugin.settings.aiProvider) {
            case "openai":
                return `<strong>Popular models:</strong>
                    <ul style="margin: 4px 0; padding-left: 20px;">
                        <li><code>gpt-4o-mini</code> - Fast, affordable, great for most tasks</li>
                        <li><code>gpt-4o</code> - More capable, better reasoning</li>
                        <li><code>gpt-4-turbo</code> - Previous generation, still powerful</li>
                    </ul>`;
            case "anthropic":
                return `<strong>Popular models:</strong>
                    <ul style="margin: 4px 0; padding-left: 20px;">
                        <li><code>claude-3-5-sonnet-20241022</code> - Latest, most capable</li>
                        <li><code>claude-3-haiku-20240307</code> - Fast and affordable</li>
                        <li><code>claude-3-opus-20240229</code> - Most powerful (expensive)</li>
                    </ul>`;
            case "openrouter":
                return `<strong>Access models from multiple providers:</strong>
                    <ul style="margin: 4px 0; padding-left: 20px;">
                        <li><code>openai/gpt-4o-mini</code> - OpenAI's affordable model</li>
                        <li><code>anthropic/claude-3.5-sonnet</code> - Claude's latest</li>
                        <li><code>meta-llama/llama-3.1-70b-instruct</code> - Open source</li>
                    </ul>
                    Visit <a href="https://openrouter.ai/models" target="_blank">openrouter.ai/models</a> for the complete list.`;
            case "ollama":
                return `<strong>Popular local models (pull with <code>ollama pull &lt;model&gt;</code>):</strong>
                    <ul style="margin: 4px 0; padding-left: 20px;">
                        <li><code>llama3.2</code> - Meta's latest (3B or 1B, very fast)</li>
                        <li><code>llama3.1</code> - More capable (8B, 70B, 405B)</li>
                        <li><code>mistral</code> - Excellent performance (7B)</li>
                        <li><code>phi3</code> - Microsoft's efficient model</li>
                        <li><code>qwen2.5</code> - Strong multilingual support</li>
                    </ul>
                    Browse all models at <a href="https://ollama.com/library" target="_blank">ollama.com/library</a>`;
            default:
                return "";
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
                return (
                    this.plugin.settings.openaiApiKey ||
                    this.plugin.settings.apiKey ||
                    ""
                );
            case "anthropic":
                return (
                    this.plugin.settings.anthropicApiKey ||
                    this.plugin.settings.apiKey ||
                    ""
                );
            case "openrouter":
                return (
                    this.plugin.settings.openrouterApiKey ||
                    this.plugin.settings.apiKey ||
                    ""
                );
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
        // Also update legacy field for backward compatibility
        this.plugin.settings.apiKey = value;
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
}
