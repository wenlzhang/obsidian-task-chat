import type { ParsedQuery } from "../services/ai/aiQueryParserService";
import type { StructuredError } from "../services/warnings/errorHandler";

export interface Task {
    id: string;
    text: string;
    status: string;
    statusCategory: TaskStatusCategory;
    createdDate?: string;
    completedDate?: string;
    dueDate?: string;
    priority?: number; // 1=highest, 2=high, 3=medium, 4=low, 0=none
    tags: string[]; // Task-level tags (from task line itself, e.g., "- [ ] Task #urgent")
    noteTags?: string[]; // Note-level tags (from frontmatter/inline in note, e.g., note has "#project")
    sourcePath: string;
    lineNumber: number;
    originalText: string;
    folder?: string;

    // PERFORMANCE OPTIMIZATION: Cached scores from API-level filtering
    // These are populated during API-level quality/relevance filtering to avoid
    // redundant calculation at JS-level scoring. Optional - only present when
    // API-level filtering was performed with thresholds enabled.
    _cachedScores?: {
        relevance?: number; // Relevance score (0-2+) from keyword matching
        dueDate?: number; // Due date score (0-1.5) from urgency
        priority?: number; // Priority score (0-1.0) from importance
        status?: number; // Status score (0-1.0) from workflow state
        finalScore?: number; // Final weighted score (sum of all components with coefficients applied)
    };
}

export interface TaskFilter {
    // Section 1: Task inclusion (folders, tags, notes)
    folders?: string[]; // Folders to include (if empty, include all)
    noteTags?: string[]; // Note-level tags to include (e.g., "#project")
    taskTags?: string[]; // Task-level tags to include (e.g., "#urgent")
    notes?: string[]; // Specific notes to include (file paths)

    // Section 2: Task properties
    priorities?: string[]; // Priorities to include (e.g., ["1", "2"])
    dueDateRange?: DateRange; // Due date range filter
    taskStatuses?: string[]; // Status categories to include (e.g., ["open", "inProgress"])
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
    parsedQuery?: ParsedQuery; // ParsedQuery with aiUnderstanding metadata (for AI enhancement display)
    error?: StructuredError; // Structured error information (for displaying API/analysis errors in chat UI)
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

    // Enhanced tracking for multi-layer calculation methods
    // Token source tracking
    tokenSource?: "actual" | "estimated"; // Whether tokens came from API or were estimated
    parsingTokenSource?: "actual" | "estimated"; // Token source for parsing phase
    analysisTokenSource?: "actual" | "estimated"; // Token source for analysis phase

    // Cost calculation method tracking
    costMethod?:
        | "actual" // Cost from provider API (e.g., OpenRouter Generation API)
        | "calculated" // Calculated from API tokens + pricing data
        | "estimated"; // Calculated from estimated tokens + pricing data
    parsingCostMethod?: "actual" | "calculated" | "estimated";
    analysisCostMethod?: "actual" | "calculated" | "estimated";

    // Pricing source tracking
    pricingSource?: "openrouter" | "embedded"; // Whether pricing came from OpenRouter API or internal fallback
    parsingPricingSource?: "openrouter" | "embedded";
    analysisPricingSource?: "openrouter" | "embedded";
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
