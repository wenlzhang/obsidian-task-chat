export interface Task {
    id: string;
    text: string;
    status: string;
    statusCategory: TaskStatusCategory;
    createdDate?: string;
    completedDate?: string;
    dueDate?: string;
    priority?: string;
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
}

export interface ChatContext {
    messages: ChatMessage[];
    filteredTasks: Task[];
    currentFilter: TaskFilter;
}
