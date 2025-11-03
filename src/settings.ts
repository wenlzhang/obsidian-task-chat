import { SessionData, TaskFilter } from "./models/task";

// Priority mapping type: Fixed numeric keys (1-4), customizable string values
export type PriorityMapping = Record<1 | 2 | 3 | 4, string[]>;

// Status mapping type: Fixed status categories, customizable string values
export type StatusMapping = {
    open: string[];
    inProgress: string[];
    completed: string[];
    cancelled: string[];
};

// Sort criterion type for multi-criteria sorting
// "relevance" is always first and cannot be removed (primary sort)
// Other criteria serve as tiebreakers for tasks with equal scores
export type SortCriterion =
    | "relevance"
    | "dueDate"
    | "priority"
    | "status"
    | "created"
    | "alphabetical";

// Protected status categories that cannot be deleted
// These are core categories needed for consistent task management
export const PROTECTED_STATUS_CATEGORIES = {
    // Fully locked - cannot modify displayName, symbols, or delete
    FULLY_LOCKED: ["open", "other"] as readonly string[],
    // Partially locked - can modify displayName and symbols, but cannot delete
    DELETABLE_LOCKED: [
        "completed",
        "inProgress",
        "cancelled",
    ] as readonly string[],
} as const;

// Helper to check if a category is protected from deletion
export function isStatusCategoryProtected(categoryKey: string): boolean {
    return (
        (
            PROTECTED_STATUS_CATEGORIES.FULLY_LOCKED as readonly string[]
        ).includes(categoryKey) ||
        (
            PROTECTED_STATUS_CATEGORIES.DELETABLE_LOCKED as readonly string[]
        ).includes(categoryKey)
    );
}

// Helper to check if a category is fully locked (displayName and symbols cannot be modified)
export function isStatusCategoryFullyLocked(categoryKey: string): boolean {
    return (
        PROTECTED_STATUS_CATEGORIES.FULLY_LOCKED as readonly string[]
    ).includes(categoryKey);
}

// AI Provider configuration type - each provider has its own settings
export interface ProviderConfig {
    apiKey: string;
    model: string;
    apiEndpoint: string;
    temperature: number; // 0.0-2.0, lower = more consistent, recommended 0.1 for JSON output
    maxTokens: number; // Max tokens for response generation (OpenAI/Anthropic: max_tokens, Ollama: num_predict)
    contextWindow: number; // Context window size (Ollama: num_ctx, others: informational only)
    availableModels: string[]; // Cached list of available models
}

// Helper to get current provider's configuration
export function getCurrentProviderConfig(
    settings: PluginSettings,
): ProviderConfig {
    return settings.providerConfigs[settings.aiProvider];
}

// Helper to update current provider's configuration
export function updateCurrentProviderConfig(
    settings: PluginSettings,
    updates: Partial<ProviderConfig>,
): void {
    Object.assign(settings.providerConfigs[settings.aiProvider], updates);
}

// Helper to get provider and model for a specific purpose
export function getProviderForPurpose(
    settings: PluginSettings,
    purpose: "parsing" | "analysis",
): {
    provider: "openai" | "anthropic" | "openrouter" | "ollama";
    model: string;
    temperature: number;
} {
    const provider =
        purpose === "parsing"
            ? settings.parsingProvider
            : settings.analysisProvider;
    const temperature =
        purpose === "parsing"
            ? settings.parsingTemperature
            : settings.analysisTemperature;

    // Get model from per-provider storage
    const purposeModels =
        purpose === "parsing"
            ? settings.parsingModels
            : settings.analysisModels;
    const purposeModel = purposeModels?.[provider];

    // Use per-provider model if set, otherwise fall back to provider's default model
    const model =
        purposeModel && purposeModel.trim() !== ""
            ? purposeModel
            : settings.providerConfigs[provider].model;

    return { provider, model, temperature };
}

// Helper to get provider config for a specific purpose
export function getProviderConfigForPurpose(
    settings: PluginSettings,
    purpose: "parsing" | "analysis",
): ProviderConfig {
    const { provider } = getProviderForPurpose(settings, purpose);
    return settings.providerConfigs[provider];
}

export interface PluginSettings {
    // AI Provider Settings
    // Note: aiProvider is the "default" provider shown in main settings tab
    // Actual parsing uses parsingProvider, actual analysis uses analysisProvider
    aiProvider: "openai" | "anthropic" | "openrouter" | "ollama";

    // Per-provider configurations
    // These store DEFAULT settings for each provider (API key, endpoint, default model, etc.)
    // When parsingModel or analysisModel is empty, falls back to provider's default model
    providerConfigs: {
        openai: ProviderConfig;
        anthropic: ProviderConfig;
        openrouter: ProviderConfig;
        ollama: ProviderConfig;
    };

    // Model Purpose Configuration
    // Use different models for query parsing vs task analysis
    // Benefits: Cost optimization, performance tuning
    parsingProvider: "openai" | "anthropic" | "openrouter" | "ollama";
    parsingTemperature: number; // Temperature for query parsing
    analysisProvider: "openai" | "anthropic" | "openrouter" | "ollama";
    analysisTemperature: number; // Temperature for task analysis

    // Per-provider model selections (stores user's last selected model for each provider)
    // When empty string, falls back to providerConfigs[provider].model
    parsingModels: {
        openai: string;
        anthropic: string;
        openrouter: string;
        ollama: string;
    };
    analysisModels: {
        openai: string;
        anthropic: string;
        openrouter: string;
        ollama: string;
    };

    // Cached pricing data (fetched from APIs)
    pricingCache: {
        data: Record<string, { input: number; output: number }>;
        lastUpdated: number; // timestamp
    };

    // Datacore Settings
    datacoreKeys: {
        dueDate: string;
        createdDate: string;
        completedDate: string;
        priority: string;
    };

    // Task Status Mapping (flexible categories)
    // Each category maps checkbox symbols to a score, display name, and aliases
    // NEW: Optional order, description, and terms fields for advanced customization
    taskStatusMapping: Record<
        string,
        {
            symbols: string[];
            score: number;
            displayName: string;
            aliases: string; // Comma-separated aliases for querying (no spaces)
            order?: number; // Sort order (1=highest priority, lower appears first). Optional: uses smart defaults if not set
            description?: string; // Description for AI prompts (helps AI understand category meaning). Optional: uses defaults for built-in categories
            terms?: string; // Semantic terms for recognition (comma-separated). Optional: uses multilingual defaults for built-in categories
        }
    >;

    // Priority Mapping (numeric keys 1-4, customizable string values)
    datacorePriorityMapping: PriorityMapping;

    // Status Value Mapping (fixed status categories, customizable string values)
    // Maps natural language terms to status categories for query recognition
    datacoreStatusMapping: StatusMapping;

    // Date Formats
    dateFormats: {
        due: string;
        created: string;
        completed: string;
    };

    // Chat Settings
    maxSessions: number; // Maximum number of chat sessions to keep (older sessions are automatically deleted)
    chatHistoryContextLength: number; // Number of recent messages to send to AI as context (affects tokens and behavior)
    showTaskCount: boolean;
    autoOpenSidebar: boolean;
    autoRefreshTaskCount: boolean; // Auto-refresh task count at regular intervals
    autoRefreshTaskCountInterval: number; // Auto-refresh interval in seconds (default: 60)
    systemPrompt: string;
    responseLanguage: "auto" | "english" | "chinese" | "custom";
    customLanguageInstruction: string;

    // Default Chat Mode (three-mode system)
    defaultChatMode: "simple" | "smart" | "chat"; // Default mode for new sessions. Simple=free, Smart=AI expansion, Chat=full AI
    currentChatMode: "simple" | "smart" | "chat"; // Current session's chat mode (persists in data.json across reloads, resets on new session)
    queryLanguages: string[]; // Languages for semantic keyword expansion (e.g., ["English", "中文"])

    // Semantic Expansion Settings (Smart Search & Task Chat modes)
    expansionsPerLanguage: number; // Semantic equivalents to generate per keyword per language (e.g., 5). Total per keyword = expansionsPerLanguage × number of languages
    enableSemanticExpansion: boolean; // Enable/disable semantic keyword expansion

    // User-Configurable Property Terms (used across all modes)
    // These combine with internal mappings for enhanced recognition
    userPropertyTerms: {
        priority: string[]; // User's terms for priority (e.g., ["优先级", "重要", "urgent"])
        dueDate: string[]; // User's terms for due date (e.g., ["截止日期", "期限", "deadline"])
        status: string[]; // User's terms for status (e.g., ["状态", "进度", "完成"])
    };

    // User-Configurable Stop Words (used across all modes)
    // These combine with internal stop words for enhanced filtering
    // Used in: Simple Search, Smart Search, Task Chat, AI parsing, AI responses
    userStopWords: string[]; // User's additional stop words (e.g., ["项目", "project", "mitt"])

    // AI Enhancement Settings (Natural Language Understanding & Typo Correction)
    // AI is used for two purposes:
    // 1. Keyword semantic expansion (for better recall)
    // 2. Property concept recognition (converting natural language to structured format)
    // Standard syntax (P1, s:open, overdue) skips AI entirely
    aiEnhancement: {
        showAIUnderstanding: boolean; // Show AI understanding box in Task Chat (what AI understood and how properties were converted)
        enableStreaming: boolean; // Enable streaming AI responses (show text as it's generated, like ChatGPT)
    };

    // Task Display Settings
    maxDirectResults: number; // Max tasks to show directly without AI (no token cost)
    maxTasksForAI: number; // Max tasks to send to AI for analysis (more context = better response)
    maxRecommendations: number; // Max tasks AI should recommend (manageable list for user)

    // Quality and Relevance Filtering (applied at API level for efficiency)
    // These filters remove tasks BEFORE creating Task objects, improving performance
    qualityFilterStrength: number; // Quality filter threshold (0.0-1.0, shown as 0-100%). 0 = disabled, higher = stricter. Filters based on due date + priority + status scores (NOT relevance).
    minimumRelevanceScore: number; // Minimum relevance score for keyword matches (0.0-2.0, shown as 0-200%). 0 = disabled (default). Only applied when query contains keywords. Max = relevanceCoreWeight + 1.0.

    // Task Filtering Settings - Exclusions
    exclusions: {
        noteTags: string[]; // Note-level tags: exclude ALL tasks in notes with these tags (e.g., "#archive", "#template")
        taskTags: string[]; // Task-level tags: exclude ONLY specific tasks with these tags (e.g., "#skip", "#ignore")
        folders: string[]; // Folders to exclude (e.g., "Templates", "Archive")
        notes: string[]; // Specific notes to exclude (e.g., "Daily Note Template.md")
    };

    // Task Filtering Settings - Status-based Exclusions
    // Applied at Datacore query level (before Task object creation) for maximum performance
    hideCompletedTasks: boolean; // Hide completed tasks from all searches and filters (default: true). Provides significant performance boost in large vaults.

    // Scoring Coefficients - Main Weights
    relevanceCoefficient: number; // Weight for keyword relevance (default: 20)
    dueDateCoefficient: number; // Weight for due date urgency (default: 4)
    priorityCoefficient: number; // Weight for task priority (default: 1)
    statusCoefficient: number; // Weight for task status (default: 1)

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

    // Sort settings - Unified multi-criteria sorting for all modes
    // Relevance is always first (weighted by coefficients)
    // Additional criteria serve as tiebreakers for tasks with identical scores
    // Default: ["relevance", "dueDate", "priority"] works for all use cases
    // Note: Coefficients (R×20, D×4, P×1) determine importance, not order!
    taskSortOrder: SortCriterion[];

    // Usage Tracking
    totalTokensUsed: number;
    totalCost: number;
    showTokenUsage: boolean;

    // Advanced Settings
    enableDebugLogging: boolean; // Enable detailed console logging for debugging (default: false)

    // Session Data
    sessionData: SessionData;

    // Chat interface filter state - persists across Obsidian restarts
    // Applied via the filter icon in the chat interface
    currentFilter: TaskFilter;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    // AI Provider Settings
    aiProvider: "openai",

    // Per-provider configurations
    providerConfigs: {
        openai: {
            apiKey: "",
            model: "gpt-4o-mini",
            apiEndpoint: "https://api.openai.com/v1/chat/completions",
            temperature: 0.1,
            maxTokens: 8000,
            contextWindow: 128000, // gpt-4o-mini context window (informational)
            availableModels: [],
        },
        anthropic: {
            apiKey: "",
            model: "claude-sonnet-4",
            apiEndpoint: "https://api.anthropic.com/v1/messages",
            temperature: 0.1,
            maxTokens: 8000,
            contextWindow: 200000, // Claude Sonnet context window (informational)
            availableModels: [],
        },
        openrouter: {
            apiKey: "",
            model: "openai/gpt-4o-mini",
            apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
            temperature: 0.1,
            maxTokens: 8000,
            contextWindow: 128000, // Varies by model (informational)
            availableModels: [],
        },
        ollama: {
            apiKey: "", // Not needed for Ollama but kept for consistency
            model: "qwen3:14b",
            apiEndpoint: "http://localhost:11434/api/chat",
            temperature: 0.1,
            maxTokens: 8000,
            contextWindow: 64000, // Ollama num_ctx parameter (actively used)
            availableModels: [],
        },
    },

    // Model Purpose Configuration
    parsingProvider: "openai",
    parsingTemperature: 0.1,
    analysisProvider: "openai",
    analysisTemperature: 0.1,

    // Per-provider model selections (empty string = use provider's default model)
    parsingModels: {
        openai: "gpt-4o-mini",
        anthropic: "claude-sonnet-4",
        openrouter: "openai/gpt-4o-mini",
        ollama: "qwen3:14b",
    },
    analysisModels: {
        openai: "gpt-4o-mini",
        anthropic: "claude-sonnet-4",
        openrouter: "openai/gpt-4o-mini",
        ollama: "qwen3:14b",
    },

    pricingCache: {
        data: {},
        lastUpdated: 0,
    },

    // Datacore Settings
    datacoreKeys: {
        dueDate: "due",
        createdDate: "created",
        completedDate: "completion",
        priority: "p",
    },

    // Task Status Mapping (flexible - users can add/remove custom categories)
    // Protected categories (cannot be deleted):
    // 1. Fully locked (displayName + symbols locked):
    //    - "open": Default Markdown open task (space character)
    //    - "other": Catches all unassigned symbols automatically
    // 2. Partially locked (displayName + symbols can be modified, but cannot delete):
    //    - "completed": Finished tasks
    //    - "inProgress": Tasks currently being worked on
    //    - "cancelled": Abandoned/cancelled tasks
    // Users can add custom categories (e.g., "important", "bookmark", "waiting")
    taskStatusMapping: {
        open: {
            symbols: [" "],
            score: 1.0,
            displayName: "Open",
            aliases: "open,todo",
        },
        completed: {
            symbols: ["x", "X"],
            score: 0.2,
            displayName: "Completed",
            aliases: "completed,done,finished,closed",
        },
        inProgress: {
            symbols: ["/"],
            score: 0.75,
            displayName: "In Progress",
            aliases: "inprogress,in-progress,wip,doing",
        },
        cancelled: {
            symbols: ["-"],
            score: 0.1,
            displayName: "Cancelled",
            aliases: "cancelled,canceled,abandoned,dropped",
        },
        other: {
            symbols: [],
            score: 0.5,
            displayName: "Other",
            aliases: "other",
        },
    },

    // Priority Mapping (Todoist-style)
    // Keys: FIXED numeric levels (1=highest, 2=high, 3=medium, 4=low)
    // Values: CUSTOMIZABLE strings that map to each level
    // Example: User can add "高" to level 1, then [p::高] will be treated as priority 1
    // System always uses numbers (1-4) internally for comparisons and filtering
    datacorePriorityMapping: {
        1: ["1", "p1", "high"],
        2: ["2", "p2", "medium"],
        3: ["3", "p3", "low"],
        4: ["4", "p4", "none"],
    },

    // Status Value Mapping
    // Keys: FIXED status categories (open, inProgress, completed, cancelled)
    // Values: CUSTOMIZABLE strings that map to each category
    // Example: User can add "待办" to open, then "待办" in query will filter for open tasks
    // This is separate from taskStatusMapping which maps checkbox symbols
    // This maps natural language terms to status categories for query recognition
    datacoreStatusMapping: {
        open: ["open", "todo"],
        inProgress: ["inprogress", "doing", "wip"],
        completed: ["done", "finished", "completed", "closed"],
        cancelled: ["cancelled", "canceled", "abandoned", "dropped"],
    },

    // Date Formats
    dateFormats: {
        due: "YYYY-MM-DD",
        created: "YYYY-MM-DD",
        completed: "YYYY-MM-DD",
    },

    // Chat Settings
    maxSessions: 50, // Maximum number of sessions to keep (older sessions auto-deleted)
    chatHistoryContextLength: 5, // Number of messages sent to AI as context (balance between context and token cost)
    showTaskCount: true,
    autoOpenSidebar: false,
    autoRefreshTaskCount: false, // Disabled by default
    autoRefreshTaskCountInterval: 60, // 60 seconds
    systemPrompt:
        "You are a task management assistant for Obsidian. Your role is to help users find, prioritize, and manage their EXISTING tasks.",
    responseLanguage: "auto",
    customLanguageInstruction: "Respond in the same language as the user query",

    // Default Chat Mode
    defaultChatMode: "simple", // Default to free mode for new sessions
    currentChatMode: "simple", // Current session's chat mode (stored in data.json)
    queryLanguages: ["English"], // Default: English only (most users are monolingual)

    // Semantic Expansion Settings
    expansionsPerLanguage: 5, // Semantic equivalents per keyword per language (3 is optimal for cost/speed/recall balance)
    enableSemanticExpansion: true, // Enable semantic expansion by default

    // User-Configurable Property Terms
    userPropertyTerms: {
        priority: [], // User can add: ["优先级", "重要", "紧急"]
        dueDate: [], // User can add: ["截止日期", "期限", "到期"]
        status: [], // User can add: ["状态", "完成", "进度"]
    },

    // User-Configurable Stop Words
    userStopWords: [], // User can add domain-specific or language-specific stop words

    // AI Enhancement Settings (Natural Language Understanding & Typo Correction)
    // AI active in Smart Search and Task Chat for keyword expansion + property recognition
    aiEnhancement: {
        showAIUnderstanding: true, // Show AI understanding box in Task Chat (how properties were recognized/converted)
        enableStreaming: true, // Enable streaming responses by default (better UX, feels more responsive)
    },

    // Task Display Settings
    maxDirectResults: 20, // Direct results have no token cost, can be higher
    maxTasksForAI: 100, // Increased from 30 to 100: more context = better recommendations, especially with semantic expansion (small token cost increase)
    maxRecommendations: 20, // Keep final list manageable for user

    // Quality and Relevance Filtering (API-level filters)
    qualityFilterStrength: 0.0, // Quality filter threshold (0.0-1.0, shown as 0-100%). 0 = disabled (default), higher = stricter. Based on task properties only.
    minimumRelevanceScore: 0.0, // Minimum relevance score (0.0-2.0, shown as 0-200%). 0 = disabled (default). Only applied when keywords present.

    // Task Filtering Settings - Exclusions
    exclusions: {
        noteTags: [], // No note-level tags excluded by default
        taskTags: [], // No task-level tags excluded by default
        folders: [], // No folders excluded by default
        notes: [], // No notes excluded by default
    },

    // Task Filtering Settings - Status-based Exclusions
    hideCompletedTasks: true, // Hide completed tasks by default (performance optimization for large vaults)

    // Scoring Coefficients - Main Weights
    relevanceCoefficient: 20, // Keyword relevance weight (relevance score × 20)
    dueDateCoefficient: 4, // Due date urgency weight (due date score × 4)
    priorityCoefficient: 1, // Task priority weight (priority score × 1)
    statusCoefficient: 1, // Task status weight (status score × 1)

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

    // Unified multi-criteria sorting for all modes
    // Relevance always first (weighted by coefficients: R×20, D×4, P×1, S×1)
    // Due date, priority, and status serve as tiebreakers for tasks with equal weighted scores
    // This single setting works perfectly for Simple Search, Smart Search, and Task Chat
    taskSortOrder: ["relevance", "dueDate", "priority", "status"],

    // Usage Tracking
    totalTokensUsed: 0,
    totalCost: 0,
    showTokenUsage: true,

    // Advanced Settings
    enableDebugLogging: false, // Disabled by default for production use

    // Session Data
    sessionData: {
        sessions: [],
        currentSessionId: null,
        lastSessionId: null,
    },

    // Current Filter State (empty by default)
    currentFilter: {},
};
