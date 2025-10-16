import { SessionData } from "./models/task";

// Priority mapping type: Fixed numeric keys (1-4), customizable string values
export type PriorityMapping = Record<1 | 2 | 3 | 4, string[]>;

export interface PluginSettings {
    // AI Provider Settings
    aiProvider: "openai" | "ollama";
    apiKey: string;
    model: string;
    apiEndpoint: string;
    temperature: number; // AI temperature (0.0-2.0, lower = more consistent)

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

    // Priority Mapping (numeric keys 1-4, customizable string values)
    dataviewPriorityMapping: PriorityMapping;

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
    useAIQueryParsing: boolean; // Use AI to parse queries for better accuracy
    queryLanguages: string[]; // Languages for semantic keyword expansion (e.g., ["English", "中文"])

    // Task Display Settings
    maxDirectResults: number; // Max tasks to show directly without AI (no token cost)
    maxTasksForAI: number; // Max tasks to send to AI for analysis (more context = better response)
    maxRecommendations: number; // Max tasks AI should recommend (manageable list for user)
    taskSortBy:
        | "relevance"
        | "dueDate"
        | "priority"
        | "created"
        | "alphabetical";
    taskSortDirection: "asc" | "desc"; // asc = low to high, desc = high to low

    // Usage Tracking
    totalTokensUsed: number;
    totalCost: number;
    showTokenUsage: boolean;

    // Session Data
    sessionData: SessionData;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    // AI Provider Settings
    aiProvider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
    apiEndpoint: "https://api.openai.com/v1/chat/completions",
    temperature: 0.1, // Low temperature for consistent, deterministic responses

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

    // Priority Mapping (Todoist-style)
    // Keys: FIXED numeric levels (1=highest, 2=high, 3=medium, 4=low)
    // Values: CUSTOMIZABLE strings that map to each level
    // Example: User can add "高" to level 1, then [p::高] will be treated as priority 1
    // System always uses numbers (1-4) internally for comparisons and filtering
    dataviewPriorityMapping: {
        1: ["1", "p1", "high", "highest"],
        2: ["2", "p2", "medium", "med"],
        3: ["3", "p3", "low"],
        4: ["4", "p4", "none"],
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
        "You are a task assistant for Obsidian. Focus ONLY on existing tasks from the vault. Do not create new content or provide generic advice. Help users find, prioritize, and manage their actual tasks. Reference tasks using [TASK_X] IDs. Be concise and actionable.",
    responseLanguage: "auto",
    customLanguageInstruction: "Respond in the same language as the user query",
    useAIQueryParsing: false, // Disabled by default (uses fast regex parsing)
    queryLanguages: ["English", "中文"], // Default: English and Chinese

    // Task Display Settings
    maxDirectResults: 20, // Direct results have no token cost, can be higher
    maxTasksForAI: 30, // More context helps AI give better recommendations
    maxRecommendations: 20, // Keep final list manageable for user
    taskSortBy: "dueDate", // Sort by due date
    taskSortDirection: "asc", // asc = earliest/lowest first (good for overdue/high priority)

    // Usage Tracking
    totalTokensUsed: 0,
    totalCost: 0,
    showTokenUsage: true,

    // Session Data
    sessionData: {
        sessions: [],
        currentSessionId: null,
        lastSessionId: null,
    },
};
