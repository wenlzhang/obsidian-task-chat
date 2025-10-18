import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import TaskChatPlugin from "./main";
import { ModelProviderService } from "./services/modelProviderService";
import { PricingService } from "./services/pricingService";
import { DEFAULT_SETTINGS } from "./settings";

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

        // Mode comparison section
        containerEl.createDiv("task-chat-info-box", (el) => {
            el.createEl("div", {
                text: "ℹ️ Chat mode comparison",
                cls: "task-chat-info-box-title",
            });

            // Simple Search mode
            el.createEl("div", {
                text: "Simple Search:",
                cls: "task-chat-info-box-subtitle",
            });
            const simpleList = el.createEl("ul");
            simpleList.createEl("li", {
                text: "Keyword matching: Regex-based (stop words removed)",
            });
            simpleList.createEl("li", {
                text: "AI usage: None",
            });
            simpleList.createEl("li", {
                text: "Sorting: By user preference (relevance, due date, priority, etc.)",
            });
            simpleList.createEl("li", {
                text: "Cost: Free (no AI used)",
            });
            simpleList.createEl("li", {
                text: "Best for: Quick searches, simple filters, cost-free operation",
            });

            // Smart Search mode
            el.createEl("div", {
                text: "Smart Search:",
                cls: "task-chat-info-box-subtitle",
            });
            const smartList = el.createEl("ul");
            smartList.createEl("li", {
                text: "Keyword matching: AI-expanded multilingual synonyms",
            });
            smartList.createEl("li", {
                text: "AI usage: Keyword expansion only",
            });
            smartList.createEl("li", {
                text: "Sorting: By user preference (relevance, due date, priority, etc.)",
            });
            smartList.createEl("li", {
                text: "Cost: Very low (AI expands search keywords)",
            });
            smartList.createEl("li", {
                text: "Best for: Multilingual searches, broader results, semantic matching",
            });

            // Task Chat mode
            el.createEl("div", {
                text: "Task Chat:",
                cls: "task-chat-info-box-subtitle",
            });
            const chatList = el.createEl("ul");
            chatList.createEl("li", {
                text: "Keyword matching: AI-expanded multilingual synonyms",
            });
            chatList.createEl("li", {
                text: "AI usage: Keyword expansion + Analysis + Recommendations",
            });
            chatList.createEl("li", {
                text: "Sorting: By user preference + Auto mode available (AI-driven)",
            });
            chatList.createEl("li", {
                text: "Cost: Higher (AI analyzes tasks and provides insights)",
            });
            chatList.createEl("li", {
                text: "Best for: Complex queries, task prioritization, AI insights",
            });
        });

        new Setting(containerEl)
            .setName("Query languages for semantic search")
            .setDesc(
                "Languages to use for semantic keyword expansion and AI response. Used by Smart Search and Task Chat modes. When 'Response language' is set to 'Auto', the AI will detect and respond in the language from this list that matches your query. When you search in one language, semantic equivalents are automatically generated in all configured languages for better cross-language matching. Examples: English, Español. Separate with commas.",
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

        // Semantic Expansion Settings
        containerEl.createEl("h4", { text: "Semantic expansion" });
        containerEl.createEl("p", {
            text: "Control how AI expands keywords for better task matching in Smart Search and Task Chat modes. Expansion multiplies keywords across configured languages to find tasks written in any language.",
            cls: "setting-item-description",
        });

        new Setting(containerEl)
            .setName("Enable semantic expansion")
            .setDesc(
                "Enable AI-powered semantic keyword expansion. When enabled, each keyword is expanded with semantic equivalents across all configured languages. Example: 'develop' → 'develop', '开发', 'build', 'create', 'implement', 'utveckla', etc. This is NOT translation but direct cross-language semantic equivalence generation. Improves recall but may increase token usage.",
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
            .setName("Max keyword expansions per language")
            .setDesc(
                "Maximum semantic variations to generate per keyword per language. Default: 5. Total keywords = (max expansions × number of languages). Example: 5 expansions × 2 languages = 10 keywords per core keyword. Higher values improve recall but increase AI token usage.",
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

        // Task Display Settings Section
        containerEl.createEl("h3", { text: "Task display" });

        new Setting(containerEl)
            .setName("Quality filter")
            .setDesc(
                `Controls task filtering strictness (0-100%). Higher = fewer but higher-quality results.

Score calculation: relevance×20 + dueDate×4 + priority×1 (max: 31 points)

Filter levels:
• 0%: Adaptive (recommended) - auto-adjusts based on query complexity
• 1-25%: Permissive - broad matching, more results
• 26-50%: Balanced - moderate quality filtering
• 51-75%: Strict - only strong matches
• 76-100%: Very strict - near-perfect matches only

💡 Tip: Start with 0% (adaptive) and increase if you get too many results.`,
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

        // Scoring Coefficients Section
        containerEl.createEl("h3", { text: "Scoring coefficients" });

        containerEl.createDiv({ cls: "task-chat-info-box" }).innerHTML = `
            <p><strong>📊 Control Scoring Weights</strong></p>
            <p>Adjust how much each factor affects task scores. All search modes use these coefficients.</p>
            <p><strong>Score Formula:</strong> (Relevance × R) + (Due Date × D) + (Priority × P)</p>
        `;

        new Setting(containerEl)
            .setName("Relevance weight")
            .setDesc(
                `How much keyword matching affects score (1-50). Default: 20.
                
Higher value = keyword relevance matters more.

Examples:
• 10: Balanced with other factors
• 20: Standard (recommended)
• 30-50: Keyword matching very important`,
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
                `How much due date urgency affects score (1-20). Default: 4.
                
Higher value = urgency matters more.

Examples:
• 2: Due dates less important
• 4: Standard (recommended)
• 8-20: Urgent tasks heavily prioritized`,
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
                `How much task priority affects score (1-20). Default: 1.
                
Higher value = priority matters more.

Examples:
• 1: Standard (recommended)
• 5: Priority very important
• 10-20: Priority dominates scoring`,
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

        // Max Score Display
        const maxScoreDisplay = containerEl.createDiv({
            cls: "task-chat-info-box",
        });
        const maxScoreTitle = maxScoreDisplay.createEl("p");
        maxScoreTitle.innerHTML =
            "<strong>📈 Maximum Possible Score (with current coefficients):</strong>";

        const maxScoreValue = maxScoreDisplay.createEl("p", {
            cls: "task-chat-max-score-value",
        });

        // Helper to update display
        this.updateMaxScoreDisplay = () => {
            const maxScore =
                1.2 * this.plugin.settings.relevanceCoefficient +
                1.5 * this.plugin.settings.dueDateCoefficient +
                1.0 * this.plugin.settings.priorityCoefficient;
            const relevPart = 1.2 * this.plugin.settings.relevanceCoefficient;
            const datePart = 1.5 * this.plugin.settings.dueDateCoefficient;
            const priorPart = 1.0 * this.plugin.settings.priorityCoefficient;

            maxScoreValue.innerHTML = `
                <strong>Max Score: ${maxScore.toFixed(1)} points</strong><br/>
                <span style="font-size: 0.9em; opacity: 0.8;">
                Relevance: ${relevPart.toFixed(1)} + 
                Due Date: ${datePart.toFixed(1)} + 
                Priority: ${priorPart.toFixed(1)}
                </span>
            `;
        };

        // Initial display
        this.updateMaxScoreDisplay();

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
                "Maximum tasks to send to AI for analysis in Task Chat mode. " +
                    "Default: 100 (increased from 30 to provide better context). " +
                    "Higher values help AI see important tasks with due dates/priorities that may rank outside top 30. " +
                    "Token cost impact: 30→$0.0006, 100→$0.0015 per query (gpt-4o-mini). " +
                    "Recommended: 100 for comprehensive results, 50 for balanced, 30 for minimal cost.",
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

        // Store the container for this setting so we can refresh it
        // Create a dedicated div to hold the sort setting (prevents scroll issues when refreshed)
        this.sortByContainerEl = containerEl.createDiv(
            "task-chat-sort-container",
        );
        this.renderSortBySetting();

        containerEl.createEl("h3", { text: "Advanced" });

        new Setting(containerEl)
            .setName("System prompt")
            .setDesc(
                "Customize the AI's base behavior and personality. This sets the tone and style - technical task management instructions are automatically appended. Default: 'You are a task management assistant for Obsidian. Your role is to help users find, prioritize, and manage their EXISTING tasks.'",
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

        this.sortByContainerEl.createEl("p", {
            text: "Configure how tasks are sorted for each mode. Tasks are sorted by the first criterion, then by the second criterion for ties, and so on. Use ↑↓ to reorder, ✕ to remove, and + to add criteria.",
            cls: "setting-item-description",
        });

        // Sort behavior explanation box
        const explanationBox = this.sortByContainerEl.createDiv({
            cls: "task-chat-info-box",
        });

        explanationBox.createEl("div", {
            text: "How sort criteria work:",
            cls: "task-chat-info-box-title",
        });

        const explanationList = explanationBox.createEl("ul");

        explanationList.createEl("li").innerHTML =
            "<strong>Relevance:</strong> Best matches first (based on keyword similarity scores, 100 = perfect match, 0 = no match)";

        explanationList.createEl("li").innerHTML =
            "<strong>Priority:</strong> Highest priority first (internal values 1→2→3→4, where 1 is highest and maps to your priority settings like 'high', 'urgent', etc.)";

        explanationList.createEl("li").innerHTML =
            "<strong>Due date:</strong> Most urgent first (overdue → today → tomorrow → future; tasks without due dates appear last)";

        explanationList.createEl("li").innerHTML =
            "<strong>Created date:</strong> Newest first (recently created tasks appear before older ones)";

        explanationList.createEl("li").innerHTML =
            "<strong>Alphabetical:</strong> Standard A → Z order (case-insensitive natural sorting)";

        explanationBox.createEl("div", {
            text: "Note: Sort directions are automatically optimized for each criterion to provide the most intuitive results. For example, Priority 1 (highest) always appears before Priority 4 (lowest), regardless of other settings.",
            cls: "task-chat-info-box-description",
        });

        // Simple Search multi-criteria sort
        this.renderMultiCriteriaSortSetting(
            "Simple Search (Filter & Display)",
            "Multi-criteria sort order for Simple Search mode. Default: Relevance → Due date → Priority.",
            "taskSortOrderSimple",
            false, // no "auto" option
        );

        // Smart Search multi-criteria sort
        this.renderMultiCriteriaSortSetting(
            "Smart Search (Filter & Display)",
            "Multi-criteria sort order for Smart Search mode. Relevance is always first and cannot be removed or moved. Default: Relevance → Due date → Priority.",
            "taskSortOrderSmart",
            false, // no "auto" option
            true, // relevance must be first
        );

        // Task Chat AI Context multi-criteria sort
        this.renderMultiCriteriaSortSetting(
            "Task Chat (Filter & AI Context)",
            "Multi-criteria sort order for sending tasks to AI. Relevance is always first and cannot be removed or moved. This can differ from display order. Default: Relevance → Due date → Priority (shows AI the most relevant and urgent tasks first).",
            "taskSortOrderChatAI",
            false, // no "auto" option (will be resolved before sending to AI)
            true, // relevance must be first
        );

        // Task Chat Display multi-criteria sort
        this.renderMultiCriteriaSortSetting(
            "Task Chat (Display)",
            "Multi-criteria sort order for displaying results in Task Chat mode. Default: Auto → Relevance → Due date → Priority.",
            "taskSortOrderChat",
            true, // has "auto" option
        );
    }

    /**
     * Render a multi-criteria sort setting with add/remove/reorder controls
     */
    private renderMultiCriteriaSortSetting(
        name: string,
        description: string,
        settingKey: keyof import("./settings").PluginSettings,
        allowAuto: boolean,
        requireRelevanceFirst = false, // NEW: Make relevance always first and non-removable
    ): void {
        const containerEl = this.sortByContainerEl;
        if (!containerEl) return;

        // Create setting container
        const setting = new Setting(containerEl)
            .setName(name)
            .setDesc(description);

        // Create a container for the sort criteria list
        const criteriaContainer = containerEl.createDiv({
            cls: "task-chat-sort-criteria-container",
        });

        const renderCriteria = () => {
            criteriaContainer.empty();

            let sortOrder = this.plugin.settings[
                settingKey
            ] as import("./settings").SortCriterion[];

            // Ensure relevance is first if required
            if (requireRelevanceFirst) {
                const relevanceIndex = sortOrder.indexOf("relevance");
                if (relevanceIndex === -1) {
                    // Add relevance at the beginning if it doesn't exist
                    sortOrder = ["relevance", ...sortOrder];
                    (this.plugin.settings as any)[settingKey] = sortOrder;
                    this.plugin.saveSettings();
                } else if (relevanceIndex !== 0) {
                    // Move relevance to the beginning if it's not already there
                    sortOrder = [
                        "relevance",
                        ...sortOrder.filter((c) => c !== "relevance"),
                    ];
                    (this.plugin.settings as any)[settingKey] = sortOrder;
                    this.plugin.saveSettings();
                }
            }

            // Render each criterion with controls
            sortOrder.forEach((criterion, index) => {
                const criterionDiv = criteriaContainer.createDiv({
                    cls: "task-chat-sort-criterion",
                });

                // Order indicator
                criterionDiv.createSpan({
                    text: `${index + 1}.`,
                    cls: "task-chat-sort-order",
                });

                // Criterion name
                const displayName = this.getCriterionDisplayName(criterion);
                criterionDiv.createSpan({
                    text: displayName,
                    cls: "task-chat-sort-name",
                });

                // Control buttons container
                const buttonsDiv = criterionDiv.createDiv({
                    cls: "task-chat-sort-buttons",
                });

                // Move up button (disabled for relevance when it must be first)
                const isRelevanceFirst =
                    requireRelevanceFirst &&
                    criterion === "relevance" &&
                    index === 0;
                if (index > 0 && !isRelevanceFirst) {
                    buttonsDiv
                        .createEl("button", { text: "↑", cls: "mod-cta" })
                        .addEventListener("click", async () => {
                            const newOrder = [...sortOrder];
                            [newOrder[index - 1], newOrder[index]] = [
                                newOrder[index],
                                newOrder[index - 1],
                            ];
                            (this.plugin.settings as any)[settingKey] =
                                newOrder;
                            await this.plugin.saveSettings();
                            renderCriteria();
                        });
                }

                // Move down button
                if (index < sortOrder.length - 1) {
                    buttonsDiv
                        .createEl("button", { text: "↓", cls: "mod-cta" })
                        .addEventListener("click", async () => {
                            const newOrder = [...sortOrder];
                            [newOrder[index], newOrder[index + 1]] = [
                                newOrder[index + 1],
                                newOrder[index],
                            ];
                            (this.plugin.settings as any)[settingKey] =
                                newOrder;
                            await this.plugin.saveSettings();
                            renderCriteria();
                        });
                }

                // Remove button (only if more than 1 criterion, and not relevance when required first)
                const canRemove = sortOrder.length > 1 && !isRelevanceFirst;
                if (canRemove) {
                    buttonsDiv
                        .createEl("button", {
                            text: "✕",
                            cls: "mod-warning",
                        })
                        .addEventListener("click", async () => {
                            const newOrder = sortOrder.filter(
                                (_, i) => i !== index,
                            );
                            (this.plugin.settings as any)[settingKey] =
                                newOrder;
                            await this.plugin.saveSettings();
                            renderCriteria();
                        });
                }
            });

            // Add criterion button and dropdown
            const addContainer = criteriaContainer.createDiv({
                cls: "task-chat-sort-add-container",
            });

            const availableCriteria = this.getAvailableCriteria(
                sortOrder,
                allowAuto,
            );

            if (availableCriteria.length > 0) {
                const dropdown = addContainer.createEl("select", {
                    cls: "dropdown",
                });

                dropdown.createEl("option", {
                    text: "Add criterion...",
                    value: "",
                });

                availableCriteria.forEach((criterion) => {
                    dropdown.createEl("option", {
                        text: this.getCriterionDisplayName(criterion),
                        value: criterion,
                    });
                });

                const addButton = addContainer.createEl("button", {
                    text: "+",
                    cls: "mod-cta",
                });

                addButton.addEventListener("click", async () => {
                    const selectedValue = dropdown.value;
                    if (selectedValue && selectedValue !== "") {
                        const newOrder = [
                            ...sortOrder,
                            selectedValue as import("./settings").SortCriterion,
                        ];
                        (this.plugin.settings as any)[settingKey] = newOrder;
                        await this.plugin.saveSettings();
                        renderCriteria();
                    }
                });
            }
        };

        renderCriteria();
    }

    /**
     * Get display name for a sort criterion
     */
    private getCriterionDisplayName(
        criterion: import("./settings").SortCriterion,
    ): string {
        switch (criterion) {
            case "auto":
                return "Auto (AI-driven)";
            case "relevance":
                return "Relevance";
            case "dueDate":
                return "Due date";
            case "priority":
                return "Priority";
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
        allowAuto: boolean,
    ): import("./settings").SortCriterion[] {
        const allCriteria: import("./settings").SortCriterion[] = [
            "relevance",
            "dueDate",
            "priority",
            "created",
            "alphabetical",
        ];

        if (allowAuto) {
            allCriteria.unshift("auto");
        }

        return allCriteria.filter((c) => !currentOrder.includes(c));
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
}
