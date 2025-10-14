export interface PluginSettings {
    // AI Provider Settings
    aiProvider: "openai" | "anthropic" | "openrouter" | "ollama";
    apiKey: string;
    model: string;
    apiEndpoint: string;

    // DataView Settings
    dataviewKeys: {
        dueDate: string;
        createdDate: string;
        completedDate: string;
        priority: string;
    };

    // Task Status Mapping
    taskStatusMapping: Record<string, string[]>;
    taskStatusDisplayNames: Record<string, string>;

    // Priority Mapping
    dataviewPriorityMapping: Record<string, string[]>;

    // Date Formats
    dateFormats: {
        due: string;
        created: string;
        completed: string;
    };

    // Chat Settings
    maxChatHistory: number;
    showTaskCount: boolean;
    autoOpenSidebar: boolean;
    systemPrompt: string;
    responseLanguage: "auto" | "english" | "chinese" | "custom";
    customLanguageInstruction: string;

    // Usage Tracking
    totalTokensUsed: number;
    totalCost: number;
    showTokenUsage: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    // AI Provider Settings
    aiProvider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
    apiEndpoint: "https://api.openai.com/v1/chat/completions",

    // DataView Settings
    dataviewKeys: {
        dueDate: "due",
        createdDate: "created",
        completedDate: "completed",
        priority: "priority",
    },

    // Task Status Mapping (matching Tasks plugin defaults)
    taskStatusMapping: {
        open: [" ", ""],
        completed: ["x", "X"],
        inProgress: ["/", "~"],
        cancelled: ["-"],
        other: [],
    },

    taskStatusDisplayNames: {
        open: "Open",
        completed: "Completed",
        inProgress: "In progress",
        cancelled: "Cancelled",
        other: "Other",
    },

    // Priority Mapping
    dataviewPriorityMapping: {
        high: ["high", "High", "HIGH", "1"],
        medium: ["medium", "Medium", "MEDIUM", "2"],
        low: ["low", "Low", "LOW", "3"],
        none: ["none", "None", "NONE", "4"],
    },

    // Date Formats
    dateFormats: {
        due: "YYYY-MM-DD",
        created: "YYYY-MM-DD",
        completed: "YYYY-MM-DD",
    },

    // Chat Settings
    maxChatHistory: 50,
    showTaskCount: true,
    autoOpenSidebar: false,
    systemPrompt:
        "You are a task assistant for Obsidian. Focus ONLY on existing tasks from the vault. Do not create new content or provide generic advice. Help users find, prioritize, and manage their actual tasks. Reference tasks using [TASK_X] IDs.  Be concise and actionable.",
    responseLanguage: "auto",
    customLanguageInstruction: "Respond in the same language as the user query",

    // Usage Tracking
    totalTokensUsed: 0,
    totalCost: 0,
    showTokenUsage: true,
};
