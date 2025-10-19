import { Task } from "../models/task";
import { TaskFilterService } from "./taskFilterService";
import { TextSplitter } from "./textSplitter";
import { StopWords } from "./stopWords";
import { PropertyRecognitionService } from "./propertyRecognitionService";
import { PluginSettings } from "../settings";

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
        const filteredWords = StopWords.filterStopWords(words);

        // Log stop word filtering (for consistency with AI mode)
        if (words.length !== filteredWords.length) {
            console.log(
                `[Task Chat] Keywords after stop word filtering: ${words.length} → ${filteredWords.length}`,
            );
            console.log(
                `[Task Chat] Removed stop words: [${words.filter((w) => !filteredWords.includes(w)).join(", ")}]`,
            );
        }

        // IMPORTANT: Return ALL keywords (including overlaps) for filtering
        // Overlapping keywords will be deduplicated later ONLY for scoring
        // This ensures broad recall (find more tasks) while maintaining accurate scoring
        return filteredWords;
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
     * @deprecated Use PropertyRecognitionService.detectPropertiesSimple() instead
     * Kept for backward compatibility but delegates to PropertyRecognitionService
     */
    static isPriorityQuery(query: string, settings: PluginSettings): boolean {
        return PropertyRecognitionService.detectPropertiesSimple(
            query,
            settings,
        ).hasPriority;
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
     * @deprecated Use PropertyRecognitionService.detectPropertiesSimple() instead
     * Kept for backward compatibility but delegates to PropertyRecognitionService
     */
    static isDueDateQuery(query: string, settings: PluginSettings): boolean {
        return PropertyRecognitionService.detectPropertiesSimple(
            query,
            settings,
        ).hasDueDate;
    }

    /**
     * Extract due date filter from query using PropertyRecognitionService
     * Returns: 'today', 'overdue', 'week', 'tomorrow', 'next-week', 'future', 'any', or specific date
     *
     * @param query User's search query
     * @param settings Plugin settings (for user-configured terms)
     */
    static extractDueDateFilter(
        query: string,
        settings: PluginSettings,
    ): string | null {
        const lowerQuery = query.toLowerCase();
        const combined =
            PropertyRecognitionService.getCombinedPropertyTerms(settings);

        // Helper to check if any term matches
        const hasAnyTerm = (terms: string[]) => {
            return terms.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            );
        };

        // Check for specific time periods (highest priority - most specific)
        if (hasAnyTerm(combined.dueDate.overdue)) {
            return "overdue";
        }

        if (hasAnyTerm(combined.dueDate.future)) {
            return "future";
        }

        if (hasAnyTerm(combined.dueDate.today)) {
            return "today";
        }

        if (hasAnyTerm(combined.dueDate.tomorrow)) {
            return "tomorrow";
        }

        if (hasAnyTerm(combined.dueDate.thisWeek)) {
            return "week";
        }

        if (hasAnyTerm(combined.dueDate.nextWeek)) {
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
        // Uses general terms from PropertyRecognitionService (user + internal)
        if (hasAnyTerm(combined.dueDate.general)) {
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
            const beforePriority = filteredTasks.length;
            filteredTasks = filteredTasks.filter(
                (task) => task.priority === filters.priority,
            );
            console.log(
                `[Task Chat] Priority filter (${filters.priority}): ${beforePriority} → ${filteredTasks.length} tasks`,
            );
        }

        // Apply due date filter
        if (filters.dueDate) {
            const beforeDueDate = filteredTasks.length;
            filteredTasks = this.filterByDueDate(
                filteredTasks,
                filters.dueDate,
            );
            console.log(
                `[Task Chat] Due date filter (${filters.dueDate}): ${beforeDueDate} → ${filteredTasks.length} tasks`,
            );
        }

        // Apply status filter
        if (filters.status) {
            const beforeStatus = filteredTasks.length;
            filteredTasks = filteredTasks.filter(
                (task) => task.statusCategory === filters.status,
            );
            console.log(
                `[Task Chat] Status filter (${filters.status}): ${beforeStatus} → ${filteredTasks.length} tasks`,
            );
        }

        // Apply folder filter
        if (filters.folder) {
            const beforeFolder = filteredTasks.length;
            const folderLower = filters.folder.toLowerCase();
            filteredTasks = filteredTasks.filter(
                (task) =>
                    task.folder &&
                    task.folder.toLowerCase().includes(folderLower),
            );
            console.log(
                `[Task Chat] Folder filter (${filters.folder}): ${beforeFolder} → ${filteredTasks.length} tasks`,
            );
        }

        // Apply tag filters
        if (filters.tags && filters.tags.length > 0) {
            const beforeTags = filteredTasks.length;
            filteredTasks = filteredTasks.filter((task) => {
                const taskTagsLower = task.tags.map((t) => t.toLowerCase());
                return filters.tags!.some((filterTag) =>
                    taskTagsLower.some((taskTag) =>
                        taskTag.includes(filterTag.toLowerCase()),
                    ),
                );
            });
            console.log(
                `[Task Chat] Tag filter (${filters.tags.join(", ")}): ${beforeTags} → ${filteredTasks.length} tasks`,
            );
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
     * @param query User's search query
     * @param settings Plugin settings (for property term recognition)
     */
    static analyzeQueryIntent(
        query: string,
        settings: PluginSettings,
    ): {
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
        const extractedDueDateFilter = this.extractDueDateFilter(
            query,
            settings,
        );
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

        // Use PropertyRecognitionService for property detection (eliminates hardcoded duplicates)
        const propertyHints = PropertyRecognitionService.detectPropertiesSimple(
            query,
            settings,
        );

        return {
            isSearch: this.isSearchQuery(query),
            isPriority: propertyHints.hasPriority,
            isDueDate: propertyHints.hasDueDate,
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
     * Deduplicate keywords with optional logging
     * Helper to avoid code duplication across scoring methods
     */
    private static deduplicateWithLogging(
        keywords: string[],
        label: string,
    ): string[] {
        const deduplicated = this.deduplicateOverlappingKeywords(keywords);

        if (keywords.length !== deduplicated.length) {
            console.log(
                `[Task Chat] Deduplicated ${label}: ${keywords.length} → ${deduplicated.length}`,
            );
            const removed = keywords.filter((k) => !deduplicated.includes(k));
            if (removed.length > 0 && removed.length <= 10) {
                // Only show removed keywords if not too many
                console.log(
                    `[Task Chat] Removed overlaps: [${removed.join(", ")}]`,
                );
            }
        }

        return deduplicated;
    }

    /**
     * Remove overlapping/substring keywords to avoid double-counting
     * Example: ["如何", "如", "何", "开发", "开", "发"] → ["如何", "开发"]
     */
    private static deduplicateOverlappingKeywords(
        keywords: string[],
    ): string[] {
        // Sort by length (longest first) to prioritize multi-character words
        const sorted = [...keywords].sort((a, b) => b.length - a.length);
        const deduplicated: string[] = [];

        for (const keyword of sorted) {
            // Check if this keyword is a substring of any already-kept keyword
            const isSubstring = deduplicated.some((kept) =>
                kept.includes(keyword),
            );

            // Keep this keyword only if it's not a substring of a longer keyword
            if (!isSubstring) {
                deduplicated.push(keyword);
            }
        }

        return deduplicated;
    }

    /**
     * Calculate relevance score based on keyword matching
     * @param taskText - Lowercase task text
     * @param coreKeywords - Core keywords from query (pre-expansion, deduplicated)
     * @param allKeywords - All keywords including core + semantic equivalents (deduplicated)
     * @param settings - Plugin settings with user-configurable coefficients
     * @returns Score: 0-1.4 typical (0.2 × coreWeight + 1.0 × allWeight, adjustable by user)
     */
    private static calculateRelevanceScore(
        taskText: string,
        coreKeywords: string[],
        allKeywords: string[],
        settings: import("../settings").PluginSettings,
    ): number {
        // Count core keyword matches
        const coreKeywordsMatched = coreKeywords.filter((coreKw) =>
            taskText.includes(coreKw.toLowerCase()),
        ).length;

        // Count ALL keyword matches (including core keywords)
        const allKeywordsMatched = allKeywords.filter((kw) =>
            taskText.includes(kw.toLowerCase()),
        ).length;

        // Calculate ratios - BOTH relative to totalCore
        const totalCore = Math.max(coreKeywords.length, 1); // Avoid division by zero

        const coreMatchRatio = coreKeywordsMatched / totalCore;
        const allKeywordsRatio = allKeywordsMatched / totalCore; // Also divided by totalCore!

        // Apply user-configurable core bonus + hardcoded base weight (1.0)
        // Core bonus is configurable (default: 0.2), base weight is always 1.0
        return (
            coreMatchRatio * settings.relevanceCoreWeight +
            allKeywordsRatio * 1.0 // Hardcoded: all keywords base weight is always 1.0
        );
    }

    /**
     * Calculate due date score based on time ranges
     * Uses moment (from Obsidian) for reliable date comparisons
     * @param dueDate - Task due date string (YYYY-MM-DD format)
     * @param settings - Plugin settings with user-configurable coefficients
     * @returns Score: User-configurable (defaults: 1.5 overdue, 1.0 within 7 days, 0.5 within month, 0.2 later, 0.1 none)
     */
    private static calculateDueDateScore(
        dueDate: string | undefined,
        settings: import("../settings").PluginSettings,
    ): number {
        // No due date = user-configurable score (default: 0.1)
        if (!dueDate) return settings.dueDateNoneScore;

        // Use moment for reliable date comparisons (from Obsidian)
        const { moment } = window as any;
        if (!moment) {
            console.warn(
                "[Task Chat] moment not available, skipping due date score",
            );
            return settings.dueDateNoneScore;
        }

        const today = moment().startOf("day");
        const taskDueDate = moment(dueDate).startOf("day");

        // Calculate difference in days
        const diffDays = taskDueDate.diff(today, "days");

        // Score based on time ranges (all user-configurable)
        if (diffDays < 0) {
            return settings.dueDateOverdueScore; // Past due (most urgent)
        } else if (diffDays <= 7) {
            return settings.dueDateWithin7DaysScore; // Due within 7 days
        } else if (diffDays <= 30) {
            return settings.dueDateWithin1MonthScore; // Due within 1 month
        } else if (diffDays > 30) {
            return settings.dueDateLaterScore; // Due after 1 month
        } else {
            return settings.dueDateNoneScore; // Fallback
        }
    }

    /**
     * Calculate priority score
     * @param priority - Task priority (1=highest, 2=high, 3=medium, 4=low)
     * @param settings - Plugin settings with user-configurable coefficients
     * @returns Score: User-configurable (defaults: 1.0 for P1, 0.75 P2, 0.5 P3, 0.2 P4, 0.1 none)
     */
    private static calculatePriorityScore(
        priority: number | undefined,
        settings: import("../settings").PluginSettings,
    ): number {
        if (!priority) return settings.priorityNoneScore;

        switch (priority) {
            case 1:
                return settings.priorityP1Score; // Highest priority
            case 2:
                return settings.priorityP2Score; // High priority
            case 3:
                return settings.priorityP3Score; // Medium priority
            case 4:
                return settings.priorityP4Score; // Low priority
            default:
                return settings.priorityNoneScore;
        }
    }

    /**
     * Calculate status score
     * @param statusCategory - Task status category (open, completed, inProgress, cancelled, other)
     * @param settings - Plugin settings with user-configurable coefficients
     * @returns Score: User-configurable (defaults: 1.0 open, 0.75 inProgress, 0.2 completed, 0.1 cancelled, 0.5 other)
     */
    private static calculateStatusScore(
        statusCategory: string | undefined,
        settings: import("../settings").PluginSettings,
    ): number {
        if (!statusCategory) return settings.statusOpenScore; // Default to open

        switch (statusCategory.toLowerCase()) {
            case "completed":
                return settings.statusCompletedScore;
            case "inprogress":
            case "in-progress":
                return settings.statusInProgressScore;
            case "open":
                return settings.statusOpenScore;
            case "cancelled":
                return settings.statusCancelledScore;
            case "other":
            default:
                return settings.statusOtherScore;
        }
    }

    /**
     * Comprehensive weighted scoring system for all search modes (Simple, Smart, Task Chat)
     * Combines keyword relevance, due date urgency, priority importance, and status
     *
     * SCORING COMPONENTS:
     * 1. Keyword Relevance (user-configurable coefficient, default: 20)
     *    Formula: coreRatio × 0.2 + allKeywordsRatio × 1.0
     *    Where BOTH ratios are divided by totalCore:
     *    - coreRatio = coreMatched / totalCore
     *    - allKeywordsRatio = allMatched / totalCore
     *
     * 2. Due Date Score (user-configurable coefficient, default: 4)
     *    - Past due: 1.5 (most urgent)
     *    - Within 7 days: 1.0
     *    - Within 1 month: 0.5
     *    - After 1 month: 0.2
     *    - No due date: 0.1
     *
     * 3. Priority Score (user-configurable coefficient, default: 1)
     *    - Priority 1: 1.0 (highest)
     *    - Priority 2: 0.75
     *    - Priority 3: 0.5
     *    - Priority 4: 0.2
     *    - No priority: 0.1
     *
     * 4. Status Score (user-configurable coefficient, default: 1)
     *    - Completed: 0.2
     *    - In Progress: 0.75
     *    - Open: 1.0
     *    - Cancelled: 0.1
     *    - Other: 0.5
     *
     * WEIGHTED FORMULA:
     * finalScore = (relevanceScore × relevCoeff) + (dueDateScore × dateCoeff × activation) + (priorityScore × priorCoeff × activation) + (statusScore × statusCoeff × activation)
     *
     * @param tasks - Tasks to score
     * @param keywords - All keywords (core + semantic equivalents for Smart/Chat, same as core for Simple)
     * @param coreKeywords - Original core keywords from query
     * @param queryHasKeywords - Whether keywords exist in query
     * @param queryHasDueDate - Whether due date filter exists in query
     * @param queryHasPriority - Whether priority filter exists in query
     * @param queryHasStatus - Whether status filter exists in query
     * @param sortCriteria - User's sort settings to detect which properties to weight
     * @param relevCoeff - Relevance coefficient (default: 20)
     * @param dateCoeff - Due date coefficient (default: 4)
     * @param priorCoeff - Priority coefficient (default: 1)
     * @param statusCoeff - Status coefficient (default: 1)
     * @param settings - Plugin settings with user-configurable sub-coefficients
     * @returns Array of {task, score, relevanceScore, dueDateScore, priorityScore, statusScore} sorted by final weighted score
     */
    static scoreTasksComprehensive(
        tasks: Task[],
        keywords: string[],
        coreKeywords: string[],
        queryHasKeywords: boolean,
        queryHasDueDate: boolean,
        queryHasPriority: boolean,
        queryHasStatus: boolean,
        sortCriteria: string[],
        relevCoeff: number = 20,
        dateCoeff: number = 4,
        priorCoeff: number = 1,
        statusCoeff: number = 1,
        settings: import("../settings").PluginSettings,
    ): Array<{
        task: Task;
        score: number;
        relevanceScore: number;
        dueDateScore: number;
        priorityScore: number;
        statusScore: number;
    }> {
        // Deduplicate overlapping keywords
        const deduplicatedKeywords = this.deduplicateWithLogging(
            keywords,
            "keywords",
        );
        const deduplicatedCoreKeywords = this.deduplicateWithLogging(
            coreKeywords,
            "core keywords",
        );

        // Determine coefficients based on query and sort settings
        const dueDateInSort = sortCriteria.includes("dueDate");
        const priorityInSort = sortCriteria.includes("priority");
        const statusInSort = sortCriteria.includes("status");

        // Coefficient activation logic:
        // - Relevance: ONLY active when query has keywords (sort order doesn't activate it)
        // - Due date/Priority/Status: active if in query OR sort (these are task properties that always exist)
        // Note: Without keywords, all relevance scores = 0, but activating coefficient inflates maxScore
        const relevanceCoefficient = queryHasKeywords ? 1.0 : 0.0; // Fixed: removed || relevanceInSort
        const dueDateCoefficient = queryHasDueDate || dueDateInSort ? 1.0 : 0.0;
        const priorityCoefficient =
            queryHasPriority || priorityInSort ? 1.0 : 0.0;
        const statusCoefficient = queryHasStatus || statusInSort ? 1.0 : 0.0;

        console.log(
            `[Task Chat] ========== COMPREHENSIVE SCORING CONFIGURATION ==========`,
        );
        console.log(
            `[Task Chat] User coefficients - relevance: ${relevCoeff}, dueDate: ${dateCoeff}, priority: ${priorCoeff}, status: ${statusCoeff}`,
        );
        console.log(
            `[Task Chat] Core keywords: ${deduplicatedCoreKeywords.length} [${deduplicatedCoreKeywords.join(", ")}]`,
        );
        console.log(
            `[Task Chat] Expanded keywords: ${deduplicatedKeywords.length}`,
        );
        console.log(
            `[Task Chat] Query filters - dueDate: ${queryHasDueDate}, priority: ${queryHasPriority}, status: ${queryHasStatus}`,
        );
        console.log(
            `[Task Chat] Sort criteria includes - dueDate: ${dueDateInSort}, priority: ${priorityInSort}, status: ${statusInSort}`,
        );
        console.log(
            `[Task Chat] Active coefficients - relevance: ${relevanceCoefficient * relevCoeff} (query has keywords: ${queryHasKeywords}), dueDate: ${dueDateCoefficient * dateCoeff}, priority: ${priorityCoefficient * priorCoeff}, status: ${statusCoefficient * statusCoeff}`,
        );
        console.log(
            `[Task Chat] ============================================================`,
        );

        const scored = tasks.map((task) => {
            const taskText = task.text.toLowerCase();

            // ========== COMPONENT 1: KEYWORD RELEVANCE ==========
            const relevanceScore = this.calculateRelevanceScore(
                taskText,
                deduplicatedCoreKeywords,
                deduplicatedKeywords,
                settings,
            );

            // ========== COMPONENT 2: DUE DATE SCORE ==========
            const dueDateScore = this.calculateDueDateScore(
                task.dueDate,
                settings,
            );

            // ========== COMPONENT 3: PRIORITY SCORE ==========
            const priorityScore = this.calculatePriorityScore(
                task.priority,
                settings,
            );

            // ========== COMPONENT 4: STATUS SCORE ==========
            const statusScore = this.calculateStatusScore(
                task.statusCategory,
                settings,
            );

            // ========== WEIGHTED FINAL SCORE ==========
            // Use user-configurable coefficients (defaults: 20, 4, 1, 1)
            // All components now conditional based on query content:
            // Relevance: applied with relevCoeff if keywords exist in query/settings
            // Due date: applied with dateCoeff if exists in query/settings
            // Priority: applied with priorCoeff if exists in query/settings
            // Status: applied with statusCoeff if exists in query/settings
            const finalScore =
                relevanceScore * relevCoeff * relevanceCoefficient +
                dueDateScore * dateCoeff * dueDateCoefficient +
                priorityScore * priorCoeff * priorityCoefficient +
                statusScore * statusCoeff * statusCoefficient;

            return {
                task,
                score: finalScore,
                relevanceScore,
                dueDateScore,
                priorityScore,
                statusScore,
            };
        });

        // Sort by final weighted score (highest first)
        const sorted = scored.sort((a, b) => b.score - a.score);

        // Log top 5 scores for debugging
        console.log(
            `[Task Chat] ========== TOP 5 SCORED TASKS (Comprehensive) ==========`,
        );
        sorted.slice(0, 5).forEach((item, index) => {
            console.log(
                `[Task Chat] #${index + 1}: "${item.task.text.substring(0, 50)}${item.task.text.length > 50 ? "..." : ""}"`,
            );
            console.log(
                `[Task Chat]   - Relevance: ${item.relevanceScore.toFixed(2)} (× ${relevCoeff * relevanceCoefficient} = ${(item.relevanceScore * relevCoeff * relevanceCoefficient).toFixed(1)})`,
            );
            console.log(
                `[Task Chat]   - Due Date: ${item.dueDateScore.toFixed(2)} (× ${dateCoeff * dueDateCoefficient} = ${(item.dueDateScore * dateCoeff * dueDateCoefficient).toFixed(1)})`,
            );
            console.log(
                `[Task Chat]   - Priority: ${item.priorityScore.toFixed(2)} (× ${priorCoeff * priorityCoefficient} = ${(item.priorityScore * priorCoeff * priorityCoefficient).toFixed(1)})`,
            );
            console.log(
                `[Task Chat]   - Status: ${item.statusScore.toFixed(2)} (× ${statusCoeff * statusCoefficient} = ${(item.statusScore * statusCoeff * statusCoefficient).toFixed(1)})`,
            );
            console.log(
                `[Task Chat]   - FINAL SCORE: ${item.score.toFixed(1)}`,
            );
        });
        console.log(
            `[Task Chat] ==============================================================`,
        );

        return sorted;
    }
}
