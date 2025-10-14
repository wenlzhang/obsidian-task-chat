import { App, PluginSettingTab, Setting } from "obsidian";
import TaskChatPlugin from "./main";

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
            .setDesc("Select your AI provider")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("openai", "OpenAI")
                    .addOption("anthropic", "Anthropic")
                    .addOption("openrouter", "OpenRouter")
                    .addOption("ollama", "Ollama (Local)")
                    .setValue(this.plugin.settings.aiProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.aiProvider = value as any;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to update endpoint
                    }),
            );

        new Setting(containerEl)
            .setName("API key")
            .setDesc("Your AI provider API key (not needed for Ollama)")
            .addText((text) =>
                text
                    .setPlaceholder("sk-...")
                    .setValue(this.plugin.settings.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.apiKey = value;
                        await this.plugin.saveSettings();
                    })
                    .then((text) => {
                        text.inputEl.type = "password";
                    }),
            );

        new Setting(containerEl)
            .setName("Model")
            .setDesc(
                "AI model to use (e.g., gpt-4o-mini, claude-3-5-sonnet-20241022, llama3.2)",
            )
            .addText((text) =>
                text
                    .setPlaceholder("gpt-4o-mini")
                    .setValue(this.plugin.settings.model)
                    .onChange(async (value) => {
                        this.plugin.settings.model = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("API endpoint")
            .setDesc("API endpoint URL")
            .addText((text) =>
                text
                    .setPlaceholder(
                        "https://api.openai.com/v1/chat/completions",
                    )
                    .setValue(this.plugin.settings.apiEndpoint)
                    .onChange(async (value) => {
                        this.plugin.settings.apiEndpoint = value;
                        await this.plugin.saveSettings();
                    }),
            );

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
            .setDesc("Choose the language for AI responses")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("auto", "Auto (match user input)")
                    .addOption("english", "English")
                    .addOption("chinese", "Chinese (中文)")
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
                    .setPlaceholder("priority")
                    .setValue(this.plugin.settings.dataviewKeys.priority)
                    .onChange(async (value) => {
                        this.plugin.settings.dataviewKeys.priority = value;
                        await this.plugin.saveSettings();
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
            text: `Total cost: $${totalCost}`,
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
}
