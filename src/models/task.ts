export interface Task {
    id: string;
    text: string;
    status: string;
    statusCategory: TaskStatusCategory;
    createdDate?: string;
    completedDate?: string;
    dueDate?: string;
    priority?: number; // 1=highest, 2=high, 3=medium, 4=low, 0=none
    tags: string[];
    sourcePath: string;
    lineNumber: number;
    originalText: string;
    folder?: string;
}

export interface TaskFilter {
    text?: string;
    folders?: string[];
    priorities?: string[];
    dueDateRange?: DateRange;
    completionStatus?: "completed" | "incomplete" | "all";
    taskStatuses?: string[];
}

export interface DateRange {
    start?: string;
    end?: string;
}

export type TaskStatusCategory = string;

export interface ChatMessage {
    role: "user" | "assistant" | "system" | "simple" | "smart" | "chat"; // assistant/system for legacy, simple/smart/chat for three-mode system
    content: string;
    timestamp: number;
    recommendedTasks?: Task[];
    tokenUsage?: TokenUsage;
    parsedQuery?: any; // ParsedQuery with aiUnderstanding metadata (for AI enhancement display)
    error?: any; // Structured error information (for displaying API/analysis errors in chat UI)
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    model: string; // Represents analysis model (or single model when same)
    provider: "openai" | "anthropic" | "openrouter" | "ollama";
    isEstimated: boolean; // true for Ollama (no real token counts), false for API providers
    directSearchReason?: string; // Explanation why direct search was used (when model === "none")

    // Separate tracking for parsing and analysis models
    parsingModel?: string; // Model used for query parsing
    parsingProvider?: "openai" | "anthropic" | "openrouter" | "ollama"; // Provider for parsing
    analysisModel?: string; // Model used for task analysis
    analysisProvider?: "openai" | "anthropic" | "openrouter" | "ollama"; // Provider for analysis
    parsingTokens?: number; // Tokens used for parsing only
    analysisTokens?: number; // Tokens used for analysis only
    parsingCost?: number; // Cost for parsing only
    analysisCost?: number; // Cost for analysis only
}

export interface ChatContext {
    messages: ChatMessage[];
    filteredTasks: Task[];
    currentFilter: TaskFilter;
}

export interface ChatSession {
    id: string;
    name: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    filter?: TaskFilter;
}

export interface SessionData {
    sessions: ChatSession[];
    currentSessionId: string | null;
    lastSessionId: string | null;
}

/**
 * Query intent analysis result from regex parsing (Simple Search) or AI parsing (Smart/Chat)
 * Supports multi-value properties and date ranges
 */
export interface QueryIntent {
    // Query analysis flags
    isSearch: boolean;
    isPriority: boolean;
    isDueDate: boolean;
    hasMultipleFilters: boolean;

    // Content keywords for semantic matching
    keywords: string[];

    // Property filters - support both single and multi-value
    extractedPriority: number | number[] | null; // Single: 1, Multi: [1, 2, 3]
    extractedDueDateFilter: string | null; // Simple date filter: "today", "overdue", "+5d"
    extractedDueDateRange: DateRange | null; // Date range: "before 2025-12-31", "after 2025-01-01", "from X to Y"
    extractedStatus: string | string[] | null; // Single: "open", Multi: ["open", "inProgress"]

    // Other filters
    extractedFolder: string | null;
    extractedTags: string[];
}
