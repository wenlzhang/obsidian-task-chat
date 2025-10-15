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
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    recommendedTasks?: Task[];
    tokenUsage?: TokenUsage;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    model: string;
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
