import { Task } from "../models/task";

/**
 * Service for searching and matching tasks based on queries
 */
export class TaskSearchService {
    /**
     * Search tasks by text query with fuzzy matching
     */
    static searchTasks(
        tasks: Task[],
        query: string,
        maxResults: number = 20,
    ): Task[] {
        if (!query || query.trim() === "") {
            return tasks;
        }

        const normalizedQuery = query.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/);

        // Score each task based on relevance
        const scoredTasks = tasks.map((task) => {
            const taskText = task.text.toLowerCase();
            let score = 0;

            // Exact match gets highest score
            if (taskText.includes(normalizedQuery)) {
                score += 100;
            }

            // Check for individual word matches
            queryWords.forEach((word) => {
                if (word.length < 2) return; // Skip very short words

                if (taskText.includes(word)) {
                    score += 10;
                }

                // Check folder match
                if (task.folder && task.folder.toLowerCase().includes(word)) {
                    score += 5;
                }

                // Check tags match
                task.tags.forEach((tag) => {
                    if (tag.toLowerCase().includes(word)) {
                        score += 5;
                    }
                });
            });

            // Boost incomplete tasks
            if (task.statusCategory !== "completed") {
                score += 2;
            }

            // Boost high priority tasks
            if (task.priority === "high") {
                score += 3;
            } else if (task.priority === "medium") {
                score += 1;
            }

            // Boost tasks with due dates
            if (task.dueDate) {
                score += 2;
            }

            return { task, score };
        });

        // Filter tasks with score > 0 and sort by score
        return scoredTasks
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map((item) => item.task);
    }

    /**
     * Extract keywords from user query
     */
    static extractKeywords(query: string): string[] {
        // Remove common words
        const stopWords = new Set([
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "from",
            "as",
            "is",
            "was",
            "are",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "should",
            "could",
            "can",
            "may",
            "might",
            "must",
            "shall",
            "what",
            "which",
            "who",
            "when",
            "where",
            "why",
            "how",
            "my",
            "me",
            "i",
            "you",
            "we",
            "they",
            "them",
            "their",
            "our",
            "show",
            "find",
            "get",
            "list",
            "tell",
            "give",
            "task",
            "tasks",
            "如何",
            "怎么",
            "什么",
            "哪些",
            "是否",
            "可以",
            "能否",
            "需要",
        ]);

        const words = query
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, " ") // Keep alphanumeric and Chinese characters
            .split(/\s+/)
            .filter((word) => word.length > 1 && !stopWords.has(word));

        return [...new Set(words)]; // Remove duplicates
    }

    /**
     * Check if query is asking about task search/finding
     */
    static isSearchQuery(query: string): boolean {
        const searchKeywords = [
            "find",
            "search",
            "look",
            "show",
            "list",
            "get",
            "where",
            "找",
            "查找",
            "搜索",
            "显示",
            "列出",
            "哪里",
            "在哪",
        ];

        const lowerQuery = query.toLowerCase();
        return searchKeywords.some((keyword) => lowerQuery.includes(keyword));
    }

    /**
     * Check if query is asking about priorities/recommendations
     */
    static isPriorityQuery(query: string): boolean {
        const priorityKeywords = [
            "priority",
            "important",
            "urgent",
            "first",
            "next",
            "should",
            "recommend",
            "suggest",
            "focus",
            "优先",
            "重要",
            "紧急",
            "先",
            "下一个",
            "应该",
            "建议",
            "推荐",
            "专注",
        ];

        const lowerQuery = query.toLowerCase();
        return priorityKeywords.some((keyword) => lowerQuery.includes(keyword));
    }

    /**
     * Extract priority level from query
     * Returns priority level (high, medium, low, none) or null
     */
    static extractPriorityFromQuery(query: string): string | null {
        const lowerQuery = query.toLowerCase();

        // Check for priority 1 / p1 / high / 高
        if (/priority\s*1|p1|优先级\s*1|\bp1\b|high|highest|高/i.test(query)) {
            return "high";
        }

        // Check for priority 2 / p2 / medium / 中
        if (/priority\s*2|p2|优先级\s*2|\bp2\b|medium|med|中/i.test(query)) {
            return "medium";
        }

        // Check for priority 3 / p3 / low / 低
        if (/priority\s*3|p3|优先级\s*3|\bp3\b|low|低/i.test(query)) {
            return "low";
        }

        // Check for priority 4 / p4 / none / 无
        if (/priority\s*4|p4|优先级\s*4|\bp4\b|none|无/i.test(query)) {
            return "none";
        }

        return null;
    }

    /**
     * Search tasks by priority
     */
    static searchByPriority(tasks: Task[], priority: string): Task[] {
        return tasks.filter((task) => task.priority === priority);
    }

    /**
     * Check if query is asking about due dates
     */
    static isDueDateQuery(query: string): boolean {
        const dueDateKeywords = [
            "due",
            "deadline",
            "overdue",
            "today",
            "tomorrow",
            "this week",
            "next week",
            "截止",
            "到期",
            "今天",
            "明天",
            "本周",
            "下周",
        ];

        const lowerQuery = query.toLowerCase();
        return dueDateKeywords.some((keyword) => lowerQuery.includes(keyword));
    }

    /**
     * Extract due date filter from query
     * Returns: 'today', 'overdue', 'week', or null
     */
    static extractDueDateFilter(query: string): string | null {
        const lowerQuery = query.toLowerCase();

        // Check for overdue
        if (/overdue|过期|逾期/.test(lowerQuery)) {
            return "overdue";
        }

        // Check for today
        if (/\btoday\b|今天/.test(lowerQuery)) {
            return "today";
        }

        // Check for tomorrow
        if (/\btomorrow\b|明天/.test(lowerQuery)) {
            return "tomorrow";
        }

        // Check for this week
        if (/this week|本周/.test(lowerQuery)) {
            return "week";
        }

        return null;
    }

    /**
     * Filter tasks by due date
     */
    static filterByDueDate(tasks: Task[], filter: string): Task[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return tasks.filter((task) => {
            if (!task.dueDate) return false;

            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            switch (filter) {
                case "overdue":
                    return dueDate < today;

                case "today":
                    return dueDate.getTime() === today.getTime();

                case "tomorrow": {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return dueDate.getTime() === tomorrow.getTime();
                }

                case "week": {
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    return dueDate >= today && dueDate <= weekEnd;
                }

                default:
                    return false;
            }
        });
    }

    /**
     * Analyze query intent
     */
    static analyzeQueryIntent(query: string): {
        isSearch: boolean;
        isPriority: boolean;
        isDueDate: boolean;
        keywords: string[];
        extractedPriority: string | null;
        extractedDueDateFilter: string | null;
    } {
        return {
            isSearch: this.isSearchQuery(query),
            isPriority: this.isPriorityQuery(query),
            isDueDate: this.isDueDateQuery(query),
            keywords: this.extractKeywords(query),
            extractedPriority: this.extractPriorityFromQuery(query),
            extractedDueDateFilter: this.extractDueDateFilter(query),
        };
    }
}
