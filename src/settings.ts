import { SessionData } from "./models/task";

// Priority mapping type: Fixed numeric keys (1-4), customizable string values
export type PriorityMapping = Record<1 | 2 | 3 | 4, string[]>;

// Sort criterion type for multi-criteria sorting
export type SortCriterion =
    | "relevance"
    | "dueDate"
    | "priority"
    | "created"
    | "alphabetical"
    | "auto";

export interface PluginSettings {
    // AI Provider Settings
    aiProvider: "openai" | "anthropic" | "openrouter" | "ollama";
    // Separate API keys for each provider
    openaiApiKey: string;
    anthropicApiKey: string;
    openrouterApiKey: string;
    model: string;
    apiEndpoint: string;
    temperature: number; // AI temperature (0.0-2.0, lower = more consistent)
    // Cached available models per provider
    availableModels: {
        openai: string[];
        anthropic: string[];
        openrouter: string[];
        ollama: string[];
    };

    // Cached pricing data (fetched from APIs)
    pricingCache: {
        data: Record<string, { input: number; output: number }>;
        lastUpdated: number; // timestamp
    };

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

    // Default Chat Mode (three-mode system)
    defaultChatMode: "simple" | "smart" | "chat"; // Default mode for new sessions. Simple=free, Smart=AI expansion, Chat=full AI
    currentChatMode: "simple" | "smart" | "chat"; // Current session's chat mode (persists in data.json across reloads, resets on new session)
    queryLanguages: string[]; // Languages for semantic keyword expansion (e.g., ["English", "中文"])

    // Task Display Settings
    maxDirectResults: number; // Max tasks to show directly without AI (no token cost)
    maxTasksForAI: number; // Max tasks to send to AI for analysis (more context = better response)
    maxRecommendations: number; // Max tasks AI should recommend (manageable list for user)
    relevanceThreshold: number; // Minimum relevance score (0-100) for keyword matching. Lower = more results. Use 0 for adaptive (recommended).

    // Sort settings - Multi-criteria sorting per mode
    // LEGACY: Single-criterion sorting (kept for backward compatibility, but deprecated)
    taskSortBySimple:
        | "relevance"
        | "dueDate"
        | "priority"
        | "created"
        | "alphabetical"; // Simple Search sort
    taskSortBySmart:
        | "relevance"
        | "dueDate"
        | "priority"
        | "created"
        | "alphabetical"; // Smart Search sort
    taskSortByChat:
        | "auto"
        | "relevance"
        | "dueDate"
        | "priority"
        | "created"
        | "alphabetical"; // Task Chat sort (includes "auto")
    taskSortDirection: "asc" | "desc"; // asc = low to high, desc = high to low

    // NEW: Multi-criteria sorting (ordered array of sort criteria)
    // Each mode can have multiple sort criteria applied in order (primary, secondary, tertiary, etc.)
    // Example: ["relevance", "dueDate", "priority"] = sort by relevance first, then dueDate for ties, then priority
    taskSortOrderSimple: SortCriterion[]; // Simple Search multi-criteria sort order
    taskSortOrderSmart: SortCriterion[]; // Smart Search multi-criteria sort order
    taskSortOrderChat: SortCriterion[]; // Task Chat display sort order
    taskSortOrderChatAI: SortCriterion[]; // Task Chat AI context sort order (what order to send tasks to AI)

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
    openaiApiKey: "",
    anthropicApiKey: "",
    openrouterApiKey: "",
    model: "gpt-4o-mini",
    apiEndpoint: "https://api.openai.com/v1/chat/completions",
    temperature: 0.1, // Low temperature for consistent, deterministic responses
    availableModels: {
        openai: [],
        anthropic: [],
        openrouter: [],
        ollama: [],
    },
    pricingCache: {
        data: {},
        lastUpdated: 0,
    },

    // DataView Settings
    dataviewKeys: {
        dueDate: "due",
        createdDate: "created",
        completedDate: "completed",
        priority: "p",
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
        1: ["1", "p1", "high"],
        2: ["2", "p2", "medium"],
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

    // Default Chat Mode
    defaultChatMode: "simple", // Default to free mode for new sessions
    currentChatMode: "simple", // Current session's chat mode (stored in data.json)
    queryLanguages: ["English", "中文"], // Default: English and Chinese

    // Task Display Settings
    maxDirectResults: 20, // Direct results have no token cost, can be higher
    maxTasksForAI: 30, // More context helps AI give better recommendations
    maxRecommendations: 20, // Keep final list manageable for user
    relevanceThreshold: 30, // Minimum relevance score (0-100). Lower = more results. 0 = adaptive.

    // LEGACY: Single-criterion sorting (kept for backward compatibility)
    taskSortBySimple: "relevance", // Simple Search: relevance (keyword-based)
    taskSortBySmart: "relevance", // Smart Search: relevance (AI keywords)
    taskSortByChat: "auto", // Task Chat: auto (AI-driven)
    taskSortDirection: "asc", // asc = earliest/lowest first (good for overdue/high priority)

    // NEW: Multi-criteria sorting - Smart defaults for each mode
    // Simple Search: relevance first (keyword matching), then due date (urgency), then priority
    taskSortOrderSimple: ["relevance", "dueDate", "priority"],
    // Smart Search: relevance first (AI-expanded keywords), then due date, then priority
    taskSortOrderSmart: ["relevance", "dueDate", "priority"],
    // Task Chat Display: auto (AI-driven), then due date, then priority
    taskSortOrderChat: ["auto", "relevance", "dueDate", "priority"],
    // Task Chat AI Context: relevance first (most relevant to query), then priority (importance), then due date (urgency)
    // This order helps AI understand what's most relevant AND urgent
    taskSortOrderChatAI: ["relevance", "dueDate", "priority"],

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
