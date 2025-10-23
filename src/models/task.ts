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
    // For vague queries: operator-based (e.g., "<= today" includes overdue)
    operator?: "<" | "<=" | ">" | ">=" | "=" | "between";
    date?: string; // Primary date: "today", "tomorrow", "end-of-week", etc.

    // For specific range queries: start/end dates (legacy support)
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
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    model: string;
    provider: "openai" | "anthropic" | "openrouter" | "ollama";
    isEstimated: boolean; // true for Ollama (no real token counts), false for API providers
    directSearchReason?: string; // Explanation why direct search was used (when model === "none")
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
    isVague?: boolean; // Indicates generic/vague query (e.g., "What should I do?")

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
