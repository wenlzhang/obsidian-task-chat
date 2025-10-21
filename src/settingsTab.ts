import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import TaskChatPlugin from "./main";
import { ModelProviderService } from "./services/modelProviderService";
import { PricingService } from "./services/pricingService";
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

        containerEl.createEl("h2", { text: "Task Chat settings" });

        // ========================================
        // UNDERSTANDING SETTINGS OVERVIEW
        // ========================================
        const overviewBox = containerEl.createDiv({
            cls: "task-chat-info-box",
        });
        overviewBox.innerHTML = `
            <h3 style="margin-top: 0;">📚 Understanding Settings</h3>
            <p><strong>👉 Start with Defaults:</strong> All settings are pre-configured with recommended values. Most users don't need to change anything!</p>
            
            <h4>How Settings Affect Your Results:</h4>
            <ol style="margin-left: 20px;">
                <li><strong>Filtering:</strong> Determines which tasks appear in results
                    <ul>
                        <li>Stop words: Removes generic keywords (the, task, work, etc.)</li>
                        <li>Quality filter: Keeps tasks above a comprehensive score threshold</li>
                        <li>Minimum relevance: Requires keyword match quality (optional)</li>
                    </ul>
                </li>
                <li><strong>Scoring:</strong> Calculates task importance
                    <ul>
                        <li>Relevance coefficient (R×20): Keyword match weight</li>
                        <li>Due date coefficient (D×4): Urgency weight</li>
                        <li>Priority coefficient (P×1): Importance weight</li>
                        <li>Status coefficient (S×1): Status weight</li>
                        <li>Sub-coefficients: Fine-tune specific scores</li>
                    </ul>
                </li>
                <li><strong>Sorting:</strong> Orders tasks for display
                    <ul>
                        <li>Primary: Comprehensive score (R + D + P + S)</li>
                        <li>Tiebreakers: Additional criteria for equal scores</li>
                    </ul>
                </li>
                <li><strong>Display:</strong> How many tasks to show
                    <ul>
                        <li>Simple/Smart Search: Direct display (fast, free)</li>
                        <li>Task Chat: AI analysis (comprehensive, uses tokens)</li>
                    </ul>
                </li>
            </ol>
            
            <h4>The Processing Pipeline:</h4>
            <p style="margin-left: 20px; font-family: monospace; font-size: 12px;">
                Query → Parse → DataView Filter → Quality Filter → Minimum Relevance → Score → Sort → Display/AI Analysis
            </p>
            
            <h4>Key Settings Groups:</h4>
            <ul style="margin-left: 20px;">
                <li><strong>Property Terms & Stop Words:</strong> Improve keyword recognition</li>
                <li><strong>Quality Filter:</strong> Balance result count vs quality</li>
                <li><strong>Scoring Coefficients:</strong> Weight importance of different factors</li>
                <li><strong>Sort Order:</strong> Prioritize criteria for equal scores</li>
                <li><strong>Task Display:</strong> Control result count per mode</li>
            </ul>
            
            <h4>Recommended Workflow:</h4>
            <ol style="margin-left: 20px;">
                <li>✅ <strong>Start with defaults</strong> - Try queries first!</li>
                <li>🔍 If results are too broad → Increase quality filter (10-30%)</li>
                <li>🎯 If urgent tasks overwhelm keywords → Add minimum relevance (20-40%)</li>
                <li>⚖️ If urgency/priority doesn't match expectations → Adjust coefficients</li>
                <li>🛑 If generic words match everything → Add custom stop words</li>
            </ol>
            
            <p style="margin-top: 10px;"><strong>💡 Tip:</strong> Each setting shows its impact in the description. Check the README for detailed explanations and examples!</p>
        `;

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

        // User-Configurable Property Terms Section
        containerEl.createEl("h4", { text: "Custom property terms" });

        const propertyTermsInfo = containerEl.createEl("div", {
            cls: "setting-item-description",
        });
        propertyTermsInfo.createEl("p", {
            text: "Add your own terms for task properties (priority, due date, status). These combine with built-in terms for enhanced recognition across all search modes. The system uses a three-layer approach:",
        });
        const layersList = propertyTermsInfo.createEl("ol");
        layersList.createEl("li", {
            text: "Your custom terms (highest priority)",
        });
        layersList.createEl("li", {
            text: "Built-in multi-language mappings (fallback)",
        });
        layersList.createEl("li", {
            text: "AI semantic expansion (broadest coverage)",
        });

        new Setting(containerEl)
            .setName("Priority terms")
            .setDesc(
                "Your custom terms for priority (e.g., 'priority, important, urgent'). These combine with built-in terms (priority, important, urgent, etc.) for better recognition in all modes. Leave empty to use only built-in terms.",
            )
            .addTextArea((text) =>
                text
                    .setPlaceholder("priority, important, urgent")
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
                "Your custom terms for due dates (e.g., 'due, deadline, scheduled'). These combine with built-in terms (due, deadline, scheduled, etc.) for better recognition in all modes. Leave empty to use only built-in terms.",
            )
            .addTextArea((text) =>
                text
                    .setPlaceholder("due, deadline, scheduled")
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
                "Your custom terms for task status (e.g., 'done, completed, in progress'). These combine with built-in terms (status, done, completed, etc.) for better recognition in all modes. Leave empty to use only built-in terms.",
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

        // Stop Words Section
        containerEl.createEl("h3", { text: "Stop words" });

        const stopWordsInfo = containerEl.createEl("div", {
            cls: "setting-item-description",
        });
        stopWordsInfo.createEl("p", {
            text: "Stop words are common words filtered out during search to improve relevance. Your custom stop words combine with ~100 built-in stop words (including 'the', 'a', 'task', 'work', etc.). Used in all modes: Simple Search, Smart Search, Task Chat.",
        });

        // Show count of internal stop words
        const internalCount = StopWords.getInternalStopWords().length;
        stopWordsInfo.createEl("p", {
            text: `Built-in stop words: ${internalCount} words.`,
            cls: "mod-muted",
        });

        new Setting(containerEl)
            .setName("Custom stop words")
            .setDesc(
                "Additional stop words specific to your workflow or language. These combine with built-in stop words to filter out unwanted keywords. Example: 'project, task' for domain-specific or additional language terms. Comma-separated list.",
            )
            .addTextArea((text) =>
                text
                    .setPlaceholder("project, task")
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

        new Setting(containerEl)
            .setName("Minimum relevance score")
            .setDesc(
                `Requires tasks to have a minimum keyword relevance score. Set to 0 to disable (default).

📊 MAXIMUM VALUE: The theoretical maximum relevance score is (Core bonus + 1.0).
• Current maximum: ${((this.plugin.settings.relevanceCoreWeight + 1.0) * 100).toFixed(0)}% (based on your core bonus of ${this.plugin.settings.relevanceCoreWeight.toFixed(2)})
• With default core bonus (0.2): maximum is 120%
• If you change "Core keyword match bonus" below, update this value accordingly

⚠️ This is an ADDITIONAL filter applied AFTER the quality filter above.

Use this when:
• You want to exclude tasks with weak keyword matches, even if they have high urgency/priority
• Example: Low relevance + overdue + P1 = might pass quality filter, but blocked by this

Recommended values:
• 0%: Disabled (default) - only comprehensive score filtering applies
• 20-30%: Moderate - requires reasonable keyword match
• 40-60%: Strict - requires strong keyword match
• 70%+: Very strict - requires near-perfect keyword match
• 100%+: Extremely strict - requires perfect match with core keyword bonus

💡 Tip: Leave at 0% unless you're getting urgent tasks with weak keyword relevance.`,
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

        new Setting(containerEl)
            .setName("Status weight")
            .setDesc(
                `How much task status affects score (1-20). Default: 1.
                
Higher value = status matters more.

Examples:
• 1: Standard (recommended)
• 5: Status very important
• 10-20: Status dominates scoring`,
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
        const maxScoreTitle = maxScoreDisplay.createEl("p");
        maxScoreTitle.innerHTML =
            "<strong>📈 Maximum Possible Score (with current coefficients):</strong>";

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
                <strong>Max Score: ${maxScore.toFixed(1)} points</strong><br/>
                <span style="font-size: 0.9em; opacity: 0.8;">
                Relevance: ${relevPart.toFixed(1)} + 
                Due Date: ${datePart.toFixed(1)} + 
                Priority: ${priorPart.toFixed(1)} + 
                Status: ${statusPart.toFixed(1)}
                </span>
            `;
        };

        // Initial display
        this.updateMaxScoreDisplay();

        // Advanced Scoring Coefficients Section
        containerEl.createEl("h3", { text: "Advanced scoring coefficients" });

        containerEl.createDiv({ cls: "task-chat-info-box" }).innerHTML = `
            <p><strong>🔧 Fine-Grained Scoring Control (Optional)</strong></p>
            <p>These settings control scoring at a detailed level within each factor. 
            <strong>Most users don't need to change these</strong> - the main coefficients above are sufficient.</p>
            <p>Advanced users can fine-tune how each specific level (e.g., "overdue" vs "due within 7 days") 
            affects scoring.</p>
        `;

        // Relevance Sub-Coefficients
        containerEl.createEl("h4", { text: "Relevance sub-coefficients" });

        new Setting(containerEl)
            .setName("Core keyword match bonus")
            .setDesc(
                "Additional bonus for matching core keywords (0.0-1.0). Default: 0.2. " +
                    "Core keywords are original extracted keywords from your query, before semantic expansion. " +
                    "Set to 0 to treat all keywords equally (pure semantic search). " +
                    "Higher values prioritize exact query matches over semantic equivalents. " +
                    "Combined with the relevance coefficient above, this fine-tunes keyword matching.\n\n" +
                    "⚠️ IMPORTANT: Changing this value affects:\n" +
                    "• Maximum relevance score: (This value + 1.0)\n" +
                    "• Quality filter calculations (uses this + 1.0 for max score)\n" +
                    "• Minimum relevance score maximum (auto-updates when you change this)",
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
        containerEl.createEl("h4", { text: "Due date sub-coefficients" });

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
        containerEl.createEl("h4", { text: "Priority sub-coefficients" });

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
        containerEl.createEl("h4", { text: "Status scores" });

        const statusScoreNote = containerEl.createDiv({
            cls: "setting-item-description task-chat-info-box",
        });
        statusScoreNote.innerHTML = `
            <p><strong>ℹ️ Status scores are now configured in the Status Mapping section above.</strong></p>
            <p>Each status category (open, completed, in progress, etc.) has its own score that you can customize. Scroll up to the "Status mapping" section to manage categories and their scores.</p>
        `;

        // Reset Buttons Section
        containerEl.createEl("h4", { text: "Reset coefficients to defaults" });

        containerEl.createDiv({ cls: "task-chat-info-box" }).innerHTML = `
            <p>Use these buttons to quickly reset coefficient values to their recommended defaults.</p>
        `;

        // Reset all advanced coefficients
        new Setting(containerEl)
            .setName("Reset all advanced coefficients")
            .setDesc(
                "Reset all sub-coefficients to defaults: relevance (core bonus: 0.2), " +
                    "due date (overdue: 1.5, 7days: 1.0, month: 0.5, later: 0.2, none: 0.1), " +
                    "priority (P1: 1.0, P2: 0.75, P3: 0.5, P4: 0.2, none: 0.1), " +
                    "status (completed: 1.0, in-progress: 0.75, open: 0.5, cancelled: 0.2, other: 0.1).",
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
            .setDesc(
                "Reset main coefficient weights to defaults: Relevance: 20, Due Date: 4, Priority: 1, Status: 1.",
            )
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

        // Reset status categories
        new Setting(containerEl)
            .setName("Reset status categories")
            .setDesc(
                "Reset all status categories (symbols, scores, names) to defaults: Open, Completed, In Progress, Cancelled, Other.",
            )
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

        // DataView Status and Troubleshooting Info
        const dataviewInfoBox = containerEl.createDiv({
            cls: "setting-item-description task-chat-info-box",
        });

        dataviewInfoBox.createEl("strong", {
            text: "💡 DataView Status & Troubleshooting",
        });
        dataviewInfoBox.createEl("br");
        dataviewInfoBox.createEl("br");

        dataviewInfoBox.appendText(
            "If searches return 0 results but you have tasks in your vault:",
        );
        dataviewInfoBox.createEl("br");

        const troubleshootingList = dataviewInfoBox.createEl("ul", {
            cls: "task-chat-troubleshooting-list",
        });

        troubleshootingList.createEl("li", {
            text: "⏱️ DataView may still be indexing - wait 10-30 seconds and click Refresh tasks",
        });
        troubleshootingList.createEl("li", {
            text: "⚙️ DataView index delay may be too long - go to DataView settings and reduce 'Index delay' from default 2000ms to 500ms",
        });
        troubleshootingList.createEl("li", {
            text: "✅ Verify task syntax - tasks must use proper Markdown format (e.g., - [ ] Task name)",
        });
        troubleshootingList.createEl("li", {
            text: "🔄 Check DataView is enabled - go to Community Plugins and ensure DataView is enabled",
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

        // Status Categories (Dynamic)
        containerEl.createEl("h3", { text: "Status categories" });

        const statusCategoriesDesc = containerEl.createDiv({
            cls: "setting-item-description task-chat-info-box",
        });
        statusCategoriesDesc.innerHTML = `
            <p><strong>📋 Flexible Status Categories</strong></p>
            <p>Define custom status categories with their checkbox symbols and scores. You can add categories like "Important", "Bookmark", "Waiting", etc.</p>
            <p><strong>Protected categories (cannot be deleted):</strong></p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li><strong>Fully locked (displayName + symbols locked):</strong>
                    <ul style="margin-left: 20px; margin-top: 3px;">
                        <li><strong>Open:</strong> Default Markdown open task (space character)</li>
                        <li><strong>Other:</strong> Catches all unassigned symbols automatically</li>
                    </ul>
                </li>
                <li><strong>Partially locked (displayName + symbols can be modified):</strong>
                    <ul style="margin-left: 20px; margin-top: 3px;">
                        <li><strong>Completed:</strong> Finished tasks</li>
                        <li><strong>In progress:</strong> Tasks being worked on</li>
                        <li><strong>Cancelled:</strong> Abandoned tasks</li>
                    </ul>
                </li>
            </ul>
            <p><strong>Field descriptions:</strong></p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li><strong>Category key:</strong> Internal identifier (e.g., "important", "tendency"). No spaces or special characters. camelCase recommended. Editable for custom categories.</li>
                <li><strong>Display name:</strong> Human-readable name shown in UI (sentence case recommended).</li>
                <li><strong>Symbols:</strong> Checkbox characters that map to this category (comma-separated, e.g., "x,X" or "!,I,b").</li>
                <li><strong>Score:</strong> Weight for scoring (0.0-1.0, higher = more important).</li>
            </ul>
            <p><strong>💡 Tips:</strong></p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li>Compatible with <a href="https://github.com/wenlzhang/obsidian-task-marker">Task Marker</a> and similar plugins.</li>
                <li>For proper status symbol display, use a compatible theme like <a href="https://github.com/kepano/obsidian-minimal">Minimal</a>.</li>
            </ul>
        `;

        // Add column headers
        const headerDiv = containerEl.createDiv();
        headerDiv.style.cssText =
            "display: grid; grid-template-columns: 120px 150px 1fr 120px 60px; gap: 8px; padding: 8px 12px; font-weight: 600; font-size: 12px; color: var(--text-muted); border-bottom: 1px solid var(--background-modifier-border); margin-top: 12px;";
        headerDiv.createDiv({ text: "Category key" });
        headerDiv.createDiv({ text: "Display name" });
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
                            };

                        await this.plugin.saveSettings();
                        this.display(); // Refresh UI
                        new Notice(`Added new category: Custom ${categoryNum}`);
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
     * Render a single status category with all its settings in horizontal grid layout
     */
    private renderStatusCategory(
        containerEl: HTMLElement,
        categoryKey: string,
        config: { symbols?: string[]; score?: number; displayName?: string },
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

        // Identify protected categories using helper functions
        const isProtectedCategory = isStatusCategoryProtected(categoryKey);
        const isFullyLocked = isStatusCategoryFullyLocked(categoryKey);

        // Create horizontal grid row
        const rowDiv = containerEl.createDiv();
        rowDiv.style.cssText =
            "display: grid; grid-template-columns: 120px 150px 1fr 120px 60px; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--background-modifier-border); align-items: center;";

        // Category key (editable for custom categories only)
        const keyInput = rowDiv.createEl("input", { type: "text" });
        keyInput.value = categoryKey;

        if (isProtectedCategory) {
            keyInput.disabled = true;
            keyInput.title = "Protected category key cannot be changed";
            keyInput.style.cssText =
                "opacity: 0.6; padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); cursor: not-allowed;";
        } else {
            // Custom categories: allow editing key
            keyInput.style.cssText =
                "padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;";
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
            nameInput.style.cssText =
                "opacity: 0.6; padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; cursor: not-allowed;";
            if (categoryKey === "open") {
                nameInput.title =
                    "Default open task category, display name locked";
            } else if (categoryKey === "other") {
                nameInput.title =
                    "Default catch-all category, display name locked";
            }
        } else {
            nameInput.style.cssText =
                "padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;";
            nameInput.addEventListener("change", async () => {
                this.plugin.settings.taskStatusMapping[
                    categoryKey
                ].displayName = nameInput.value || categoryKey;
                await this.plugin.saveSettings();
            });
        }

        // Symbols (locked only for fully locked categories: open, other)
        const symbolsInput = rowDiv.createEl("input", { type: "text" });
        symbolsInput.value = symbols.join(",");

        if (isFullyLocked) {
            symbolsInput.disabled = true;
            symbolsInput.style.cssText =
                "opacity: 0.6; padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; cursor: not-allowed;";
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
            symbolsInput.style.cssText =
                "padding: 4px 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;";
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
        const scoreContainer = rowDiv.createDiv();
        scoreContainer.style.cssText =
            "display: flex; align-items: center; gap: 4px;";

        const scoreInput = scoreContainer.createEl("input", {
            type: "range",
            attr: {
                min: "0",
                max: "1",
                step: "0.05",
            },
        });
        scoreInput.value = score.toString();
        scoreInput.style.cssText = "flex: 1; min-width: 60px;";

        const scoreLabel = scoreContainer.createEl("span");
        scoreLabel.textContent = score.toFixed(2);
        scoreLabel.style.cssText =
            "font-size: 11px; color: var(--text-muted); min-width: 32px;";

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

            disabledBtn.style.cssText =
                "padding: 2px 8px; opacity: 0.3; cursor: not-allowed;";
        } else {
            const removeBtn = rowDiv.createEl("button", {
                text: "✕",
                cls: "mod-warning",
            });
            removeBtn.title = `Remove ${displayName}`;
            removeBtn.style.cssText = "padding: 2px 8px; font-size: 14px;";
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
            text: "Select which properties to include in sorting. With user-configurable coefficients, weights determine importance (not order). Order only matters for breaking rare ties when tasks have identical final scores. Use ✕ to remove and + to add criteria.",
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

        // Important note about coefficients
        this.sortByContainerEl.createDiv({
            cls: "task-chat-info-box",
        }).innerHTML = `
            <p><strong>⚠️ Important: Multi-Criteria Sorting with User Coefficients</strong></p>
            <p>Since you can now configure coefficient values (Relevance, Due Date, Priority), 
            <strong>property ORDER is less important</strong>. The <strong>COEFFICIENT VALUES</strong> 
            determine importance, not the sort order.</p>
            <p><strong>Example:</strong></p>
            <ul>
                <li>Relevance coefficient: 20 → Gets 20× weight in final score</li>
                <li>Due Date coefficient: 4 → Gets 4× weight in final score</li>
                <li>Priority coefficient: 1 → Gets 1× weight in final score</li>
                <li>Status coefficient: 1 → Gets 1× weight in final score</li>
            </ul>
            <p>Tasks are scored as: <code>(Relevance × 20) + (Due Date × 4) + (Priority × 1) + (Status × 1)</code></p>
            <p><strong>Below settings control:</strong> Which properties to INCLUDE in scoring (not their importance).
            Use coefficient sliders above to control how much each property matters.</p>
        `;

        // Unified sort settings (tag-based UI)
        const sortSetting = new Setting(this.sortByContainerEl)
            .setName("Task sort order")
            .setDesc(
                "Relevance is always first and cannot be removed. Click ✕ to remove other criteria. Coefficients (R×20, D×4, P×1) determine importance, not order.",
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
