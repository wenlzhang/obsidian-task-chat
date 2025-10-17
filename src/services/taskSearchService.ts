import { Task } from "../models/task";
import { TaskFilterService } from "./taskFilterService";
import { TextSplitter } from "./textSplitter";
import { StopWords } from "./stopWords";

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

            // Boost high priority tasks (1=highest, 2=high, 3=medium, 4=low)
            if (task.priority === 1) {
                score += 3;
            } else if (task.priority === 2) {
                score += 2;
            } else if (task.priority === 3) {
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
     * Extract keywords from user query with improved multilingual word segmentation
     * Uses TextSplitter for better handling of mixed-language text
     */
    static extractKeywords(query: string): string[] {
        // First, remove filter-related phrases from the query
        let cleanedQuery = query;

        // Remove priority phrases
        cleanedQuery = cleanedQuery.replace(
            /priority\s*(?:is\s*|=\s*)?[1-4]|p[1-4]|优先级\s*(?:为|是)?\s*[1-4]/gi,
            "",
        );
        cleanedQuery = cleanedQuery.replace(
            /high(?:est)?\s*priority|medium\s*priority|low\s*priority/gi,
            "",
        );
        cleanedQuery = cleanedQuery.replace(
            /高优先级|最高优先级|中优先级|普通优先级|低优先级|无优先级/g,
            "",
        );

        // Remove due date phrases
        cleanedQuery = cleanedQuery.replace(
            /due\s*(?:today|tomorrow|this\s*week|next\s*week)?|overdue|今天|明天|本周|下周|过期/gi,
            "",
        );

        // Remove status phrases
        cleanedQuery = cleanedQuery.replace(
            /(?:open|completed|done|finished|in\s*progress|未完成|完成|已完成|进行中)/gi,
            "",
        );

        // Remove tag indicators
        cleanedQuery = cleanedQuery.replace(/#\w+/g, "");
        cleanedQuery = cleanedQuery.replace(
            /(?:with|tagged|having)\s*tags?/gi,
            "",
        );

        // Remove folder indicators
        cleanedQuery = cleanedQuery.replace(/(?:in|from)\s+folder/gi, "");

        // Use TextSplitter for multilingual word segmentation
        const words = TextSplitter.splitIntoWords(cleanedQuery);

        // Remove stop words using shared service (consistent with AI mode)
        return StopWords.filterStopWords(words);
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
     * Returns numeric priority (1=highest, 2=high, 3=medium, 4=low) or null
     */
    static extractPriorityFromQuery(query: string): number | null {
        const lowerQuery = query.toLowerCase();

        // Priority 1 (highest/high)
        // Numeric: priority 1, p1, 优先级1, 优先级为1, 优先级是1
        // Semantic: high priority, highest priority, 高优先级, 最高优先级
        if (
            /(priority\s*(?:is\s*|=\s*)?1|p1|优先级\s*(?:为|是)?\s*1|\bp1\b)/i.test(
                query,
            ) ||
            /(high(?:est)?\s*priority|priority\s*(?:is\s*)?high(?:est)?)/i.test(
                query,
            ) ||
            /(高优先级|最高优先级|高\s*优先级|最高\s*优先级)/i.test(query)
        ) {
            return 1;
        }

        // Priority 2 (medium/normal)
        // Numeric: priority 2, p2, 优先级2
        // Semantic: medium priority, normal priority, 中优先级, 普通优先级
        if (
            /(priority\s*(?:is\s*|=\s*)?2|p2|优先级\s*(?:为|是)?\s*2|\bp2\b)/i.test(
                query,
            ) ||
            /(medium|normal)\s*priority|priority\s*(?:is\s*)?(medium|normal)/i.test(
                query,
            ) ||
            /(中优先级|普通优先级|中\s*优先级|普通\s*优先级)/i.test(query)
        ) {
            return 2;
        }

        // Priority 3 (low)
        // Numeric: priority 3, p3, 优先级3
        // Semantic: low priority, 低优先级
        if (
            /(priority\s*(?:is\s*|=\s*)?3|p3|优先级\s*(?:为|是)?\s*3|\bp3\b)/i.test(
                query,
            ) ||
            /low\s*priority|priority\s*(?:is\s*)?low/i.test(query) ||
            /(低优先级|低\s*优先级)/i.test(query)
        ) {
            return 3;
        }

        // Priority 4 (none/no priority)
        // Numeric: priority 4, p4, 优先级4
        // Semantic: no priority, 无优先级
        if (
            /(priority\s*(?:is\s*|=\s*)?4|p4|优先级\s*(?:为|是)?\s*4|\bp4\b)/i.test(
                query,
            ) ||
            /no\s*priority|priority\s*(?:is\s*)?none/i.test(query) ||
            /(无优先级|无\s*优先级)/i.test(query)
        ) {
            return 4;
        }

        return null;
    }

    /**
     * Search tasks by priority
     */
    static searchByPriority(tasks: Task[], priority: number): Task[] {
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
            "future",
            "upcoming",
            "today",
            "tomorrow",
            "this week",
            "next week",
            "截止",
            "到期",
            "过期",
            "未来",
            "将来",
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
     * Returns: 'today', 'overdue', 'week', 'tomorrow', 'next-week', 'future', 'any', or specific date
     */
    static extractDueDateFilter(query: string): string | null {
        const lowerQuery = query.toLowerCase();

        // Check for overdue (highest priority) - comprehensive patterns
        if (
            /(overdue|过期|逾期|已过期|past\s+due|late|延期)/.test(lowerQuery)
        ) {
            return "overdue";
        }

        // Check for future tasks
        if (/(future|upcoming|未来|将来|以后)/.test(lowerQuery)) {
            return "future";
        }

        // Check for today - comprehensive patterns
        if (
            /(today|今天|今日|due\s+today|today'?s?\s+tasks?)/.test(lowerQuery)
        ) {
            return "today";
        }

        // Check for tomorrow
        if (/(tomorrow|明天|due\s+tomorrow)/.test(lowerQuery)) {
            return "tomorrow";
        }

        // Check for this week
        if (/(this\s+week|本周|本周内)/.test(lowerQuery)) {
            return "week";
        }

        // Check for next week
        if (/(next\s+week|下周|下周内)/.test(lowerQuery)) {
            return "next-week";
        }

        // Check for specific date patterns (YYYY-MM-DD, MM-DD, etc.)
        const datePatterns = [
            /\b(\d{4}-\d{2}-\d{2})\b/, // YYYY-MM-DD
            /\b(\d{2}\/\d{2}\/\d{4})\b/, // MM/DD/YYYY
            /\b(\d{4}\/\d{2}\/\d{2})\b/, // YYYY/MM/DD
        ];

        for (const pattern of datePatterns) {
            const match = lowerQuery.match(pattern);
            if (match) {
                return match[1]; // Return the specific date
            }
        }

        // Check for generic "due" or "has due date" (tasks WITH a due date)
        // Match various forms: "due tasks", "tasks due", "with deadline", etc.
        if (
            /(^due$|^due\s+tasks?$|^tasks?\s+due$|^scheduled\s+tasks?$|^tasks?\s+with\s+due|^tasks?\s+with\s+deadline|^deadline\s+tasks?|^has\s+due|^有截止日期|^有期限|^带截止日期)/i.test(
                lowerQuery,
            )
        ) {
            return "any";
        }

        return null;
    }

    /**
     * Filter tasks by due date
     */
    static filterByDueDate(tasks: Task[], filter: string): Task[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Special case: "any" means any task WITH a due date
        if (filter === "any") {
            return tasks.filter(
                (task) =>
                    task.dueDate !== undefined &&
                    task.dueDate !== null &&
                    task.dueDate !== "",
            );
        }

        return tasks.filter((task) => {
            if (!task.dueDate) return false;

            // Parse date in local timezone by adding explicit time
            // If the date is just "2025-10-10", treat it as local date not UTC
            let dueDate: Date;
            if (task.dueDate.includes("T") || task.dueDate.includes(" ")) {
                // Has time component, parse as-is
                dueDate = new Date(task.dueDate);
            } else {
                // Date only (e.g., "2025-10-10"), parse as local date
                const parts = task.dueDate.split("-");
                dueDate = new Date(
                    parseInt(parts[0]),
                    parseInt(parts[1]) - 1,
                    parseInt(parts[2]),
                );
            }
            dueDate.setHours(0, 0, 0, 0);

            switch (filter) {
                case "overdue":
                    return dueDate < today;

                case "future":
                    return dueDate > today;

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

                case "next-week": {
                    const nextWeekStart = new Date(today);
                    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
                    const nextWeekEnd = new Date(today);
                    nextWeekEnd.setDate(nextWeekEnd.getDate() + 14);
                    return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
                }

                default:
                    // Try to match specific date
                    try {
                        const targetDate = new Date(filter);
                        targetDate.setHours(0, 0, 0, 0);
                        if (!isNaN(targetDate.getTime())) {
                            return dueDate.getTime() === targetDate.getTime();
                        }
                    } catch (e) {
                        // Invalid date format
                    }
                    return false;
            }
        });
    }

    /**
     * Extract status filter from query
     */
    static extractStatusFromQuery(query: string): string | null {
        const lowerQuery = query.toLowerCase();

        // Check for completed/done tasks - no word boundaries for Chinese
        if (/(completed|done|finished|完成|已完成)/i.test(query)) {
            return "completed";
        }

        // Check for open/incomplete tasks
        if (/(open|incomplete|pending|todo|未完成|待办)/i.test(query)) {
            return "open";
        }

        // Check for in-progress tasks
        if (/(in[\s-]?progress|ongoing|进行中|正在做)/i.test(query)) {
            return "inProgress";
        }

        return null;
    }

    /**
     * Extract folder filter from query
     */
    static extractFolderFromQuery(query: string): string | null {
        const lowerQuery = query.toLowerCase();

        // Match patterns like "in folder X", "from folder X", "folder X"
        const folderPatterns = [
            /(?:in|from|under)\s+(?:folder|directory)\s+["']?([^"'\s,]+)["']?/i,
            /(?:folder|directory)[:\s]+["']?([^"'\s,]+)["']?/i,
            /文件夹[：:"']?([^"'\s,]+)/i,
        ];

        for (const pattern of folderPatterns) {
            const match = query.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Extract tags from query
     */
    static extractTagsFromQuery(query: string): string[] {
        const tags: string[] = [];

        // Match #tag patterns
        const hashtagPattern = /#([\w-]+)/g;
        let match;
        while ((match = hashtagPattern.exec(query)) !== null) {
            tags.push(match[1]);
        }

        // Match "with tag X" or "tagged X" patterns
        const tagPatterns = [
            /(?:with|having|tagged)\s+tag[s]?\s+["']?([^"'\s,]+)["']?/gi,
            /标签[：:"']?([^"'\s,]+)/gi,
        ];

        for (const pattern of tagPatterns) {
            let tagMatch;
            while ((tagMatch = pattern.exec(query)) !== null) {
                if (tagMatch[1]) {
                    tags.push(tagMatch[1].trim());
                }
            }
        }

        return [...new Set(tags)]; // Remove duplicates
    }

    /**
     * Apply compound filters to tasks
     */
    static applyCompoundFilters(
        tasks: Task[],
        filters: {
            priority?: number | null;
            dueDate?: string | null;
            status?: string | null;
            folder?: string | null;
            tags?: string[];
            keywords?: string[];
        },
    ): Task[] {
        let filteredTasks = [...tasks];

        // Apply priority filter
        if (filters.priority) {
            filteredTasks = filteredTasks.filter(
                (task) => task.priority === filters.priority,
            );
        }

        // Apply due date filter
        if (filters.dueDate) {
            filteredTasks = this.filterByDueDate(
                filteredTasks,
                filters.dueDate,
            );
        }

        // Apply status filter
        if (filters.status) {
            filteredTasks = filteredTasks.filter(
                (task) => task.statusCategory === filters.status,
            );
        }

        // Apply folder filter
        if (filters.folder) {
            const folderLower = filters.folder.toLowerCase();
            filteredTasks = filteredTasks.filter(
                (task) =>
                    task.folder &&
                    task.folder.toLowerCase().includes(folderLower),
            );
        }

        // Apply tag filters
        if (filters.tags && filters.tags.length > 0) {
            filteredTasks = filteredTasks.filter((task) => {
                const taskTagsLower = task.tags.map((t) => t.toLowerCase());
                return filters.tags!.some((filterTag) =>
                    taskTagsLower.some((taskTag) =>
                        taskTag.includes(filterTag.toLowerCase()),
                    ),
                );
            });
        }

        // Apply keyword search (semantic matching - ANY keyword matches)
        if (filters.keywords && filters.keywords.length > 0) {
            console.log(
                `[Task Chat] Filtering ${filteredTasks.length} tasks with keywords: [${filters.keywords.join(", ")}]`,
            );

            const matchedTasks: Task[] = [];
            filteredTasks.forEach((task) => {
                const taskText = task.text.toLowerCase();
                // Match if ANY keyword appears in the task text (substring match)
                const matched = filters.keywords!.some((keyword) => {
                    const keywordLower = keyword.toLowerCase();
                    return taskText.includes(keywordLower);
                });
                if (matched) {
                    matchedTasks.push(task);
                }
            });

            filteredTasks = matchedTasks;

            console.log(
                `[Task Chat] After keyword filtering: ${filteredTasks.length} tasks remain`,
            );
        }

        return filteredTasks;
    }

    /**
     * Analyze query intent with comprehensive filter extraction
     */
    static analyzeQueryIntent(query: string): {
        isSearch: boolean;
        isPriority: boolean;
        isDueDate: boolean;
        keywords: string[];
        extractedPriority: number | null;
        extractedDueDateFilter: string | null;
        extractedStatus: string | null;
        extractedFolder: string | null;
        extractedTags: string[];
        hasMultipleFilters: boolean;
    } {
        const extractedPriority = this.extractPriorityFromQuery(query);
        const extractedDueDateFilter = this.extractDueDateFilter(query);
        const extractedStatus = this.extractStatusFromQuery(query);
        const extractedFolder = this.extractFolderFromQuery(query);
        const extractedTags = this.extractTagsFromQuery(query);
        const keywords = this.extractKeywords(query);

        // Count how many filters are present
        const filterCount =
            (extractedPriority ? 1 : 0) +
            (extractedDueDateFilter ? 1 : 0) +
            (extractedStatus ? 1 : 0) +
            (extractedFolder ? 1 : 0) +
            (extractedTags.length > 0 ? 1 : 0) +
            (keywords.length > 0 ? 1 : 0);

        return {
            isSearch: this.isSearchQuery(query),
            isPriority: this.isPriorityQuery(query),
            isDueDate: this.isDueDateQuery(query),
            keywords,
            extractedPriority,
            extractedDueDateFilter,
            extractedStatus,
            extractedFolder,
            extractedTags,
            hasMultipleFilters: filterCount > 1,
        };
    }

    /**
     * Score tasks by relevance to keywords
     * Returns array of {task, score} sorted by score (highest first)
     * Used for both direct search and AI analysis
     */
    static scoreTasksByRelevance(
        tasks: Task[],
        keywords: string[],
    ): Array<{ task: Task; score: number }> {
        const scored = tasks.map((task) => {
            const taskText = task.text.toLowerCase();
            let score = 0;

            // Penalize very short generic tasks (likely test/placeholder tasks)
            if (task.text.trim().length < 10) {
                score -= 50;
            }

            keywords.forEach((keyword) => {
                const keywordLower = keyword.toLowerCase();

                // Exact match gets highest score
                if (taskText === keywordLower) {
                    score += 100;
                }
                // Task contains the exact keyword
                else if (taskText.includes(keywordLower)) {
                    // Higher bonus for keyword at start of task
                    if (taskText.startsWith(keywordLower)) {
                        score += 20;
                    } else {
                        score += 15;
                    }
                }
            });

            // More generous bonus for matching multiple keywords
            const matchingKeywords = keywords.filter((kw) =>
                taskText.includes(kw.toLowerCase()),
            ).length;
            score += matchingKeywords * 8;

            // Slight bonus for medium-length tasks (more descriptive, not too verbose)
            if (task.text.length >= 20 && task.text.length < 100) {
                score += 5;
            }

            return { task, score };
        });

        // Sort by score (highest first)
        return scored.sort((a, b) => b.score - a.score);
    }

    /**
     * Sort tasks by keyword relevance
     * Used when user explicitly selects "Relevance" sorting
     */
    static sortByKeywordRelevance(tasks: Task[], keywords: string[]): Task[] {
        const sorted = this.scoreTasksByRelevance(tasks, keywords);
        return sorted.map((item) => item.task);
    }
}
