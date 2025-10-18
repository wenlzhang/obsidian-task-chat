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
    maxTokensChat: number; // Max tokens for Task Chat AI responses (300-4000, higher = longer responses)
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

    // Semantic Expansion Settings (Smart Search & Task Chat modes)
    maxKeywordExpansions: number; // Max semantic variations per keyword (e.g., 10). Total = maxKeywordExpansions * number of languages
    enableSemanticExpansion: boolean; // Enable/disable semantic keyword expansion

    // Task Display Settings
    maxDirectResults: number; // Max tasks to show directly without AI (no token cost)
    maxTasksForAI: number; // Max tasks to send to AI for analysis (more context = better response)
    maxRecommendations: number; // Max tasks AI should recommend (manageable list for user)
    qualityFilterStrength: number; // Quality filter strength (0.0-1.0, shown as 0-100%). 0 = adaptive (auto-adjusts), higher = stricter filtering.

    // Scoring Coefficients - Main Weights
    relevanceCoefficient: number; // Weight for keyword relevance (default: 20)
    dueDateCoefficient: number; // Weight for due date urgency (default: 4)
    priorityCoefficient: number; // Weight for task priority (default: 1)

    // Scoring Sub-Coefficients - Fine-grained Control
    // Relevance Sub-Coefficients
    relevanceCoreWeight: number; // Weight for core keyword matches (default: 0.2)

    // Due Date Sub-Coefficients
    dueDateOverdueScore: number; // Score for overdue tasks (default: 1.5)
    dueDateWithin7DaysScore: number; // Score for due within 7 days (default: 1.0)
    dueDateWithin1MonthScore: number; // Score for due within 1 month (default: 0.5)
    dueDateLaterScore: number; // Score for due after 1 month (default: 0.2)
    dueDateNoneScore: number; // Score for no due date (default: 0.1)

    // Priority Sub-Coefficients
    priorityP1Score: number; // Score for priority 1 (highest) (default: 1.0)
    priorityP2Score: number; // Score for priority 2 (high) (default: 0.75)
    priorityP3Score: number; // Score for priority 3 (medium) (default: 0.5)
    priorityP4Score: number; // Score for priority 4 (low) (default: 0.2)
    priorityNoneScore: number; // Score for no priority (default: 0.1)

    // Sort settings - Multi-criteria sorting per mode
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
    maxTokensChat: 2000, // Default to 2000 tokens to match user's preference and provide more detailed responses by default
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
        completedDate: "completion",
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
        "You are a task management assistant for Obsidian. Your role is to help users find, prioritize, and manage their EXISTING tasks.",
    responseLanguage: "auto",
    customLanguageInstruction: "Respond in the same language as the user query",

    // Default Chat Mode
    defaultChatMode: "simple", // Default to free mode for new sessions
    currentChatMode: "simple", // Current session's chat mode (stored in data.json)
    queryLanguages: ["English", "中文"], // Default: English and Chinese

    // Semantic Expansion Settings
    maxKeywordExpansions: 5, // Max semantic variations per keyword per language (conservative default)
    enableSemanticExpansion: true, // Enable semantic expansion by default

    // Task Display Settings
    maxDirectResults: 20, // Direct results have no token cost, can be higher
    maxTasksForAI: 100, // Increased from 30 to 100: more context = better recommendations, especially with semantic expansion (small token cost increase)
    maxRecommendations: 20, // Keep final list manageable for user
    qualityFilterStrength: 0.0, // Quality filter (0.0-1.0, shown as 0-100%). 0 = adaptive (recommended), higher = stricter.

    // Scoring Coefficients - Main Weights
    relevanceCoefficient: 20, // Keyword relevance weight (relevance score × 20)
    dueDateCoefficient: 4, // Due date urgency weight (due date score × 4)
    priorityCoefficient: 1, // Task priority weight (priority score × 1)

    // Scoring Sub-Coefficients - Fine-grained Control
    // Relevance Sub-Coefficients
    relevanceCoreWeight: 0.2, // Core keyword bonus (0-1 range, default: 0.2)

    // Due Date Sub-Coefficients (0-2 range)
    dueDateOverdueScore: 1.5, // Overdue tasks (most urgent)
    dueDateWithin7DaysScore: 1.0, // Due within 7 days
    dueDateWithin1MonthScore: 0.5, // Due within 1 month
    dueDateLaterScore: 0.2, // Due after 1 month
    dueDateNoneScore: 0.1, // No due date

    // Priority Sub-Coefficients (0-1 range)
    priorityP1Score: 1.0, // Priority 1 (highest)
    priorityP2Score: 0.75, // Priority 2 (high)
    priorityP3Score: 0.5, // Priority 3 (medium)
    priorityP4Score: 0.2, // Priority 4 (low)
    priorityNoneScore: 0.1, // No priority

    // Multi-criteria sorting - Smart defaults for each mode
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
