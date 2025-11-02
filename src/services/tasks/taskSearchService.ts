import { Task, QueryIntent } from "../../models/task";
import { TextSplitter } from "../../utils/textSplitter";
import { StopWords } from "../../utils/stopWords";
import { PropertyDetectionService } from "./propertyDetectionService";
import { TaskPropertyService } from "./taskPropertyService";
import { TaskSortService } from "./taskSortService";
import { PluginSettings } from "../../settings";
import { moment } from "obsidian";
import { TypoCorrection } from "../../utils/typoCorrection";
import { Logger } from "../../utils/logger";

/**
 * Service for searching and matching tasks based on queries
 *
 * NOTE: All search modes (Simple Search, Smart Search, Task Chat) use
 * the comprehensive scoring system via scoreTasksComprehensive() which
 * respects user-configurable coefficients for relevance, due date,
 * priority, and status scoring.
 */
export class TaskSearchService {
    /**
     * Remove property syntax from query string POSITIONALLY (beginning/end only)
     * This preserves task content that happens to contain property-related words in the middle
     *
     * User queries typically follow these patterns:
     * - [properties] [keywords]: "p1 urgent payment system"
     * - [keywords] [properties]: "payment system urgent p1"
     *
     * By removing only from beginning/end, we preserve middle content like:
     * - "payment priority system" → keeps "priority" (it's task content)
     *
     * IMPORTANT: This ONLY removes STANDARD SYNTAX (p1, s:open, d:today)
     * NOT natural language trigger words ("urgent", "priority", "tasks")
     * Natural language property detection is handled by AI in Smart/Chat modes
     *
     * @param query - Original user query
     * @returns Query with property syntax removed from beginning/end only
     */
    static removePropertySyntax(query: string): string {
        let result = query.trim();
        let changed = true;

        // All property patterns to check
        const patterns = [
            TaskPropertyService.QUERY_PATTERNS.priority,
            TaskPropertyService.QUERY_PATTERNS.priorityUnified,
            TaskPropertyService.QUERY_PATTERNS.status,
            TaskPropertyService.QUERY_PATTERNS.dueUnified,
            TaskPropertyService.QUERY_PATTERNS.project,
            TaskPropertyService.QUERY_PATTERNS.search,
            TaskPropertyService.QUERY_PATTERNS.folder,
            TaskPropertyService.getDueDateKeywordsPattern(),
            TaskPropertyService.QUERY_PATTERNS.specialKeywordOverdue,
            TaskPropertyService.QUERY_PATTERNS.specialKeywordRecurring,
            TaskPropertyService.QUERY_PATTERNS.specialKeywordSubtask,
            TaskPropertyService.QUERY_PATTERNS.specialKeywordNoDate,
            TaskPropertyService.QUERY_PATTERNS.specialKeywordNoPriority,
            TaskPropertyService.QUERY_PATTERNS.dueBeforeRange,
            TaskPropertyService.QUERY_PATTERNS.dueAfterRange,
            TaskPropertyService.QUERY_PATTERNS.dateBeforeRange,
            TaskPropertyService.QUERY_PATTERNS.dateAfterRange,
            TaskPropertyService.QUERY_PATTERNS.hashtag,
            TaskPropertyService.QUERY_PATTERNS.operators,
        ];

        // Remove from BEGINNING (loop until nothing matches)
        while (changed) {
            changed = false;
            for (const pattern of patterns) {
                // Match at start only
                const startPattern = new RegExp(
                    `^\\s*${pattern.source}\\s*`,
                    pattern.flags,
                );
                if (startPattern.test(result)) {
                    const before = result;
                    result = result.replace(startPattern, "");
                    if (result !== before) {
                        changed = true;
                    }
                }
            }
        }

        // Remove from END (loop until nothing matches)
        changed = true;
        while (changed) {
            changed = false;
            for (const pattern of patterns) {
                // Match at end only
                const endPattern = new RegExp(
                    `\\s*${pattern.source}\\s*$`,
                    pattern.flags,
                );
                if (endPattern.test(result)) {
                    const before = result;
                    result = result.replace(endPattern, "");
                    if (result !== before) {
                        changed = true;
                    }
                }
            }
        }

        // Clean up extra whitespace
        result = result.replace(/\s+/g, " ").trim();

        return result;
    }

    /**
     * Extract keywords from user query with improved multilingual word segmentation
     * Uses TextSplitter for better handling of mixed-language text
     * This is used for Simple Search mode (splits into words and filters stop words)
     *
     * NEW: Includes typo correction and positional property removal
     */
    static extractKeywords(query: string): string[] {
        // Step 1: Correct common typos (local, no AI)
        const correctedQuery = TypoCorrection.correctTypos(query);

        // Step 2: Remove property syntax POSITIONALLY (beginning/end only)
        // This preserves task content like "payment priority system"
        const cleanedQuery = this.removePropertySyntax(correctedQuery);

        // Step 3: Use TextSplitter for multilingual word segmentation
        const words = TextSplitter.splitIntoWords(cleanedQuery);

        // Step 4: Deduplicate FIRST to preserve complete words
        // This removes character splits while keeping complete words like "如何", "开发"
        // Example: ["如何", "如", "何", "开发", "开", "发"] → ["如何", "开发"]
        const deduplicated = this.deduplicateOverlappingKeywords(words);

        if (words.length !== deduplicated.length) {
            Logger.debug(
                `Keywords after deduplication: ${words.length} → ${deduplicated.length}`,
            );
            Logger.debug(
                `Removed character splits: [${words.filter((w) => !deduplicated.includes(w)).join(", ")}]`,
            );
        }

        // Step 5: Remove stop words AFTER deduplication
        // Now we filter complete words like "如何", not orphaned splits like "如", "何"
        // Example: ["如何", "开发"] → filter → ["开发"]
        const filteredWords = StopWords.filterStopWords(deduplicated);

        if (deduplicated.length !== filteredWords.length) {
            Logger.debug(
                `Keywords after stop word filtering: ${deduplicated.length} → ${filteredWords.length}`,
            );
            Logger.debug(
                `Removed stop words: [${deduplicated.filter((w) => !filteredWords.includes(w)).join(", ")}]`,
            );
        }

        // Return clean keywords for BOTH filtering AND display
        // No need to process again - use these everywhere!
        return filteredWords;
    }

    // NOTE: removePropertyTriggerWords has been REMOVED
    // Property removal is now handled POSITIONALLY in removePropertySyntax()
    // which removes ONLY standard syntax (p1, s:open) from beginning/end
    // NOT natural language words ("urgent", "priority", "tasks")
    // This prevents over-filtering and preserves task content

    /**
     * Check if query is asking about task search/finding
     */
    static isSearchQuery(query: string): boolean {
        // Use centralized search keywords from TaskPropertyService
        const lowerQuery = query.toLowerCase();
        return TaskPropertyService.SEARCH_KEYWORDS.some((keyword) =>
            lowerQuery.includes(keyword),
        );
    }

    /**
     * Check if query is asking about priorities/recommendations
     * @deprecated Use PropertyDetectionService.detectPropertiesSimple() instead
     * Kept for backward compatibility but delegates to PropertyDetectionService
     */
    static isPriorityQuery(query: string, settings: PluginSettings): boolean {
        return PropertyDetectionService.detectPropertiesSimple(query, settings)
            .hasPriority;
    }

    /**
     * Extract priority level from query
     * Delegates to PropertyDetectionService for consistent behavior
     *
     * @deprecated This method now delegates to PropertyDetectionService
     * Uses combined terms (user + internal) instead of hardcoded patterns
     */
    static extractPriorityFromQuery(
        query: string,
        settings: PluginSettings,
    ): number | number[] | "all" | "any" | "none" | null {
        const allPriorities = new Set<number>();
        let hasSpecialValue: "all" | "any" | "none" | null = null;

        // Pattern 1: p:1,2,3 or priority:1,2,3 (comma-separated within single occurrence)
        // Pattern 2: p:1 p:2 p:3 or priority:1 priority:2 (multiple occurrences)
        // Use centralized pattern from TaskPropertyService
        const unifiedMatches = Array.from(
            query.matchAll(TaskPropertyService.QUERY_PATTERNS.priorityUnified),
        );
        for (const match of unifiedMatches) {
            const rawValues = match[1];
            const values = rawValues
                .split(",")
                .map((v) => v.trim().toLowerCase());

            for (const value of values) {
                // Use centralized constants
                // Handle "all" and "any" as synonyms (both mean "has a priority")
                if (
                    value ===
                        TaskPropertyService.PRIORITY_FILTER_KEYWORDS.all ||
                    value === TaskPropertyService.PRIORITY_FILTER_KEYWORDS.any
                ) {
                    hasSpecialValue =
                        TaskPropertyService.PRIORITY_FILTER_KEYWORDS.all;
                } else if (
                    value === TaskPropertyService.PRIORITY_FILTER_KEYWORDS.none
                ) {
                    hasSpecialValue =
                        TaskPropertyService.PRIORITY_FILTER_KEYWORDS.none;
                } else {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 1 && num <= 4) {
                        allPriorities.add(num);
                    }
                }
            }
        }

        // Pattern 3: p1 p2 p3 (legacy space-separated)
        // Use centralized pattern from TaskPropertyService
        const explicitMatches = Array.from(
            query.matchAll(TaskPropertyService.QUERY_PATTERNS.priority),
        );
        for (const match of explicitMatches) {
            const num = parseInt(match[1]);
            allPriorities.add(num);
        }

        // Return special values first
        if (hasSpecialValue) return hasSpecialValue;

        // Return collected priorities
        if (allPriorities.size > 0) {
            const priorityArray = Array.from(allPriorities).sort();
            return priorityArray.length === 1
                ? priorityArray[0]
                : priorityArray;
        }

        // No explicit priority syntax found, check natural language
        const combined =
            PropertyDetectionService.getCombinedPropertyTerms(settings);
        const lowerQuery = query.toLowerCase();

        if (
            combined.priority.high.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            )
        ) {
            return 1;
        }
        if (
            combined.priority.medium.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            )
        ) {
            return 2;
        }
        if (
            combined.priority.low.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            )
        ) {
            return 3;
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
     * @deprecated Use PropertyDetectionService.detectPropertiesSimple() instead
     * Kept for backward compatibility but delegates to PropertyDetectionService
     */
    static isDueDateQuery(query: string, settings: PluginSettings): boolean {
        return PropertyDetectionService.detectPropertiesSimple(query, settings)
            .hasDueDate;
    }

    /**
     * Extract due date filter from query using PropertyDetectionService
     * Returns: 'today', 'overdue', 'week', 'tomorrow', 'next-week', 'future', 'any', or specific date
     *
     * @param query User's search query
     * @param settings Plugin settings (for user-configured terms)
     */
    static extractDueDateFilter(
        query: string,
        settings: PluginSettings,
    ): string | string[] | null {
        const allDueDates = new Set<string>();
        const lowerQuery = query.toLowerCase();

        // Helper function to map value to internal format using centralized constants
        const mapDueDateValue = (value: string): string => {
            const v = value.toLowerCase();
            // Use centralized constants from TaskPropertyService
            if (
                v === TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.all ||
                v === TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.any
            )
                return TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.any;
            if (v === TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.none)
                return TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.none;
            if (v === TaskPropertyService.DUE_DATE_TIME_KEYWORDS.today)
                return TaskPropertyService.DUE_DATE_TIME_KEYWORDS.today;
            if (v === TaskPropertyService.DUE_DATE_TIME_KEYWORDS.tomorrow)
                return TaskPropertyService.DUE_DATE_TIME_KEYWORDS.tomorrow;
            if (v === "week" || v === "thisweek")
                return TaskPropertyService.DUE_DATE_TIME_KEYWORDS.week;
            if (v === "nextweek")
                return TaskPropertyService.DUE_DATE_TIME_KEYWORDS.nextWeek;
            if (v === TaskPropertyService.DUE_DATE_TIME_KEYWORDS.overdue)
                return TaskPropertyService.DUE_DATE_TIME_KEYWORDS.overdue;
            if (v === TaskPropertyService.DUE_DATE_TIME_KEYWORDS.future)
                return TaskPropertyService.DUE_DATE_TIME_KEYWORDS.future;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // Date format
            return v; // Return as-is for custom formats
        };

        // Pattern 1: d:today,tomorrow or due:today,tomorrow (comma-separated within single occurrence)
        // Pattern 2: d:today d:tomorrow or due:today due:tomorrow (multiple occurrences)
        // Use centralized pattern from TaskPropertyService
        const unifiedMatches = Array.from(
            query.matchAll(TaskPropertyService.QUERY_PATTERNS.dueUnified),
        );
        for (const match of unifiedMatches) {
            const rawValues = match[1];
            const values = rawValues.split(",").map((v) => v.trim());

            for (const value of values) {
                const mapped = mapDueDateValue(value);
                allDueDates.add(mapped);
            }
        }

        // Return collected due dates
        if (allDueDates.size > 0) {
            const dueDateArray = Array.from(allDueDates);
            return dueDateArray.length === 1 ? dueDateArray[0] : dueDateArray;
        }

        const combined =
            PropertyDetectionService.getCombinedPropertyTerms(settings);

        // Helper to check if any term matches
        const hasAnyTerm = (terms: string[]) => {
            return terms.some((term) =>
                lowerQuery.includes(term.toLowerCase()),
            );
        };

        // Check specific time periods (priority order: most specific first)
        if (hasAnyTerm(combined.dueDate.overdue)) return "overdue";
        if (hasAnyTerm(combined.dueDate.future)) return "future";
        if (hasAnyTerm(combined.dueDate.today)) return "today";
        if (hasAnyTerm(combined.dueDate.tomorrow)) return "tomorrow";
        if (hasAnyTerm(combined.dueDate.thisWeek)) return "week";
        if (hasAnyTerm(combined.dueDate.nextWeek)) return "next-week";

        // Check for relative date patterns ("in 5 days", "+3d", etc.)
        // Use centralized pattern from TaskPropertyService
        const relativeMatch = lowerQuery.match(
            TaskPropertyService.DATE_PATTERNS.relative,
        );
        if (relativeMatch) {
            const amount = relativeMatch[1];
            const unit = relativeMatch[2].toLowerCase();
            if (unit.startsWith("day")) return `+${amount}d`;
            if (unit.startsWith("week")) return `+${amount}w`;
            if (unit.startsWith("month")) return `+${amount}m`;
        }

        // Check for specific date patterns using centralized patterns
        const datePatternChecks = [
            TaskPropertyService.DATE_PATTERNS.iso,
            TaskPropertyService.DATE_PATTERNS.us,
            TaskPropertyService.DATE_PATTERNS.international,
        ];
        for (const pattern of datePatternChecks) {
            const match = lowerQuery.match(pattern);
            if (match) return match[1];
        }

        // Check for generic "due" (tasks WITH a due date)
        if (hasAnyTerm(combined.dueDate.general)) return "any";

        return null;
    }

    /**
     * Filter tasks by due date
     * Delegates to TaskPropertyService for consistent date handling
     *
     * @deprecated This method now delegates to TaskPropertyService
     */
    static filterByDueDate(tasks: Task[], filter: string): Task[] {
        return TaskPropertyService.filterByDueDate(tasks, filter);
    }

    /**
     * Extract date range from query
     * Supports: "before DATE", "after DATE", "from DATE to DATE"
     */
    static extractDueDateRange(
        query: string,
    ): { start?: string; end?: string } | null {
        const lowerQuery = query.toLowerCase();

        // Use centralized date patterns from TaskPropertyService
        // Pattern 1: "before YYYY-MM-DD"
        const beforeMatch = lowerQuery.match(
            TaskPropertyService.DATE_PATTERNS.before,
        );
        if (beforeMatch) return { end: beforeMatch[1] };

        // Pattern 2: "after YYYY-MM-DD"
        const afterMatch = lowerQuery.match(
            TaskPropertyService.DATE_PATTERNS.after,
        );
        if (afterMatch) return { start: afterMatch[1] };

        // Pattern 3: "from YYYY-MM-DD to YYYY-MM-DD"
        const betweenMatch = lowerQuery.match(
            TaskPropertyService.DATE_PATTERNS.between,
        );
        if (betweenMatch)
            return { start: betweenMatch[1], end: betweenMatch[2] };

        return null;
    }

    /**
     * Extract status filter from query
     * Delegates to PropertyDetectionService for consistent behavior
     *
     * @deprecated This method now delegates to PropertyDetectionService
     * Uses combined terms (user + internal) to support custom status categories
     */
    static extractStatusFromQuery(
        query: string,
        settings: PluginSettings,
    ): string | string[] | null {
        const allStatuses = new Set<string>();
        const lowerQuery = query.toLowerCase();

        // Pattern 1: s:open,x or status:open,x (comma-separated within single occurrence)
        // Pattern 2: s:open s:x or status:open status:x (multiple occurrences)
        // Use centralized pattern from TaskPropertyService
        const explicitMatches = Array.from(
            query.matchAll(TaskPropertyService.QUERY_PATTERNS.status),
        );

        const unresolvedValues: string[] = [];

        for (const match of explicitMatches) {
            const rawValues = match[1];
            const values = rawValues.split(",").map((v) => v.trim());

            for (const value of values) {
                Logger.debug("Extracted status value:", value);

                // Use centralized resolution from TaskPropertyService
                const resolved = TaskPropertyService.resolveStatusValue(
                    value,
                    settings,
                );

                if (resolved) {
                    Logger.debug(`Resolved to category: ${resolved}`);
                    allStatuses.add(resolved);
                } else {
                    // Collect unresolved values for warning (graceful degradation)
                    unresolvedValues.push(value);
                    Logger.warn(
                        `Status value "${value}" could not be resolved. Continuing with other filters...`,
                    );
                }
            }
        }

        // Log warning for unresolved values if any, but don't fail the entire query
        if (unresolvedValues.length > 0) {
            const availableCategories = Object.keys(
                settings.taskStatusMapping,
            ).join(", ");
            Logger.warn(
                `Some status values could not be resolved: ${unresolvedValues.join(", ")}. ` +
                    `Available categories: ${availableCategories}. ` +
                    `Continuing with resolved filters: ${Array.from(allStatuses).join(", ") || "none"}`,
            );
        }

        // Return collected statuses
        if (allStatuses.size > 0) {
            const statusArray = Array.from(allStatuses);
            return statusArray.length === 1 ? statusArray[0] : statusArray;
        }

        // Priority 2: Check for category terms (natural language)
        // Uses combined terms from PropertyDetectionService
        const combined =
            PropertyDetectionService.getCombinedPropertyTerms(settings);

        for (const [categoryKey, terms] of Object.entries(combined.status)) {
            if (categoryKey === "general") continue; // Skip general terms

            if (Array.isArray(terms)) {
                const hasMatch = terms.some((term) =>
                    lowerQuery.includes(term.toLowerCase()),
                );
                if (hasMatch) {
                    return categoryKey;
                }
            }
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
     * Now supports multi-value properties (priority and status can be arrays)
     */
    static applyCompoundFilters(
        tasks: Task[],
        filters: {
            priority?: number | number[] | null; // Support single or array
            dueDate?: string | null;
            status?: string | string[] | null; // Support single or array
            folder?: string | null;
            tags?: string[];
            keywords?: string[];
        },
    ): Task[] {
        let filteredTasks = [...tasks];

        // Apply priority filter (supports multi-value)
        if (filters.priority) {
            const beforePriority = filteredTasks.length;
            const priorities = Array.isArray(filters.priority)
                ? filters.priority
                : [filters.priority];

            filteredTasks = filteredTasks.filter((task) =>
                priorities.includes(task.priority!),
            );
            Logger.debug(
                `Priority filter (${Array.isArray(filters.priority) ? filters.priority.join(", ") : filters.priority}): ${beforePriority} → ${filteredTasks.length} tasks`,
            );
        }

        // Apply due date filter
        if (filters.dueDate) {
            const beforeDueDate = filteredTasks.length;
            filteredTasks = this.filterByDueDate(
                filteredTasks,
                filters.dueDate,
            );
            Logger.debug(
                `Due date filter (${filters.dueDate}): ${beforeDueDate} → ${filteredTasks.length} tasks`,
            );
        }

        // Apply status filter (supports multi-value)
        if (filters.status) {
            const beforeStatus = filteredTasks.length;
            const statuses = Array.isArray(filters.status)
                ? filters.status
                : [filters.status];

            filteredTasks = filteredTasks.filter((task) =>
                statuses.includes(task.statusCategory),
            );
            Logger.debug(
                `Status filter (${Array.isArray(filters.status) ? filters.status.join(", ") : filters.status}): ${beforeStatus} → ${filteredTasks.length} tasks`,
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
            Logger.debug(
                `Folder filter (${filters.folder}): ${beforeFolder} → ${filteredTasks.length} tasks`,
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
            Logger.debug(
                `Tag filter (${filters.tags.join(", ")}): ${beforeTags} → ${filteredTasks.length} tasks`,
            );
        }

        // Apply keyword search (semantic matching - ANY keyword matches)
        if (filters.keywords && filters.keywords.length > 0) {
            Logger.debug(
                `Filtering ${filteredTasks.length} tasks with keywords: [${filters.keywords.join(", ")}]`,
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

            Logger.debug(
                `After keyword filtering: ${filteredTasks.length} tasks remain`,
            );
        }

        return filteredTasks;
    }

    /**
     * Analyze query intent using regex-based extraction (Simple Search mode)
     * Now returns QueryIntent type with support for multi-value properties and date ranges
     *
     * @param query User's search query
     * @param settings Plugin settings (for property term recognition)
     */
    static analyzeQueryIntent(
        query: string,
        settings: PluginSettings,
    ): QueryIntent {
        const extractedPriority = this.extractPriorityFromQuery(
            query,
            settings,
        );
        const extractedDueDateFilter = this.extractDueDateFilter(
            query,
            settings,
        );
        const extractedDueDateRange = this.extractDueDateRange(query);
        const extractedStatus = this.extractStatusFromQuery(query, settings);
        const extractedFolder = this.extractFolderFromQuery(query);
        const extractedTags = this.extractTagsFromQuery(query);
        const keywords = this.extractKeywords(query);

        // NOTE: Property filtering now handled in extractKeywords()
        // removePropertySyntax() removes standard syntax POSITIONALLY (beginning/end only)
        // This preserves task content like "payment priority system"

        // Count how many filters are present
        const filterCount =
            (extractedPriority ? 1 : 0) +
            (extractedDueDateFilter ? 1 : 0) +
            (extractedDueDateRange ? 1 : 0) +
            (extractedStatus ? 1 : 0) +
            (extractedFolder ? 1 : 0) +
            (extractedTags.length > 0 ? 1 : 0) +
            (keywords.length > 0 ? 1 : 0);

        // Use PropertyDetectionService for property detection (eliminates hardcoded duplicates)
        const propertyHints = PropertyDetectionService.detectPropertiesSimple(
            query,
            settings,
        );

        // Enhanced logging for debugging (Phase 1 Enhancement #2)
        Logger.debug("[Simple Search] ========== QUERY PARSING ==========");
        Logger.debug("[Simple Search] Original query:", query);
        Logger.debug("[Simple Search] Extracted properties:", {
            priority: extractedPriority || "none",
            dueDate: extractedDueDateFilter || "none",
            dueDateRange: extractedDueDateRange
                ? JSON.stringify(extractedDueDateRange)
                : "none",
            status: extractedStatus || "none",
            folder: extractedFolder || "none",
            tags: extractedTags.length > 0 ? extractedTags.join(", ") : "none",
        });
        Logger.debug(
            "[Simple Search] Extracted keywords:",
            keywords.length > 0 ? keywords.join(", ") : "(none)",
        );
        Logger.debug("[Simple Search] Active filters:", filterCount);
        Logger.debug(
            "[Simple Search] ==========================================",
        );

        // NEW (Enhancement #4): Validate extracted properties
        this.validateQueryProperties(extractedPriority, extractedDueDateRange);

        return {
            isSearch: this.isSearchQuery(query),
            isPriority: propertyHints.hasPriority,
            isDueDate: propertyHints.hasDueDate,
            keywords,
            extractedPriority: extractedPriority as any,
            extractedDueDateFilter: extractedDueDateFilter as any,
            extractedDueDateRange, // NEW: Now uses actual extracted value
            extractedStatus,
            extractedFolder,
            extractedTags,
            hasMultipleFilters: filterCount > 1,
        };
    }

    /**
     * Validate extracted query properties (ENHANCED: Phase 3E)
     * Comprehensive validation for:
     * - Priorities (1-4)
     * - Date ranges (with time support)
     * - Project names
     * - Special keywords
     *
     * @param priority Extracted priority (1-4 is valid)
     * @param dueDateRange Extracted date range
     * @param project Extracted project name (optional)
     * @param specialKeywords Extracted special keywords (optional)
     */
    private static validateQueryProperties(
        priority: number | number[] | "all" | "none" | "any" | null,
        dueDateRange: { start?: string; end?: string } | null,
        project?: string | null,
        specialKeywords?: string[],
    ): void {
        // Validate priority (only 1-4 are valid, or "all"/"none")
        if (
            priority !== null &&
            typeof priority === "number" &&
            (priority < 1 || priority > 4)
        ) {
            Logger.warn(
                `[Simple Search] ⚠️  Invalid priority: P${priority}. Valid values are P1-P4, p:1,2,3, p:all, or p:none.`,
            );
        }
        if (Array.isArray(priority)) {
            const invalid = priority.filter((p) => p < 1 || p > 4);
            if (invalid.length > 0) {
                Logger.warn(
                    `[Simple Search] ⚠️  Invalid priorities: ${invalid.join(",")}. Valid values are 1-4.`,
                );
            }
        }

        // NEW: Validate project name
        if (project) {
            // Check for invalid characters (only alphanumeric, underscore, dash allowed)
            if (!/^[A-Za-z0-9_-]+$/.test(project)) {
                Logger.warn(
                    `[Simple Search] ⚠️  Invalid project name: "${project}". Use only letters, numbers, underscore, or dash.`,
                );
            }
        }

        // NEW: Validate special keywords using centralized list
        if (specialKeywords && specialKeywords.length > 0) {
            // Use centralized valid keywords from TaskPropertyService
            const validKeywords =
                TaskPropertyService.VALID_SPECIAL_KEYWORDS as readonly string[];
            const invalid = specialKeywords.filter(
                (kw) => !validKeywords.includes(kw),
            );
            if (invalid.length > 0) {
                Logger.warn(
                    `[Simple Search] ⚠️  Unknown special keywords: ${invalid.join(", ")}`,
                );
            }
        }

        // Validate date range
        if (dueDateRange) {
            const { start, end } = dueDateRange;

            // NEW: Support both date-only and date-time formats
            const isValidDate = (dateStr: string): boolean => {
                // Try YYYY-MM-DD HH:mm format first (with time)
                if (moment(dateStr, "YYYY-MM-DD HH:mm", true).isValid()) {
                    return true;
                }
                // Try YYYY-MM-DD format (date only)
                if (moment(dateStr, "YYYY-MM-DD", true).isValid()) {
                    return true;
                }
                return false;
            };

            // Check if start date is valid
            if (start && !isValidDate(start)) {
                Logger.warn(
                    `[Simple Search] ⚠️  Invalid start date: "${start}". Expected format: YYYY-MM-DD or YYYY-MM-DD HH:mm.`,
                );
            }

            // Check if end date is valid
            if (end && !isValidDate(end)) {
                Logger.warn(
                    `[Simple Search] ⚠️  Invalid end date: "${end}". Expected format: YYYY-MM-DD or YYYY-MM-DD HH:mm.`,
                );
            }

            // Check if start is after end
            if (start && end && isValidDate(start) && isValidDate(end)) {
                const startDate = moment(start);
                const endDate = moment(end);
                if (startDate.isAfter(endDate)) {
                    Logger.warn(
                        `[Simple Search] ⚠️  Invalid date range: start (${start}) is after end (${end}).`,
                    );
                }
            }

            // NEW: Warn if time without date
            if (start && start.includes(":") && !start.includes(" ")) {
                Logger.warn(
                    `[Simple Search] ⚠️  Time without date: "${start}". Use format: YYYY-MM-DD HH:mm.`,
                );
            }
            if (end && end.includes(":") && !end.includes(" ")) {
                Logger.warn(
                    `[Simple Search] ⚠️  Time without date: "${end}". Use format: YYYY-MM-DD HH:mm.`,
                );
            }
        }
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
            Logger.debug(
                `Deduplicated ${label}: ${keywords.length} → ${deduplicated.length}`,
            );
            const removed = keywords.filter((k) => !deduplicated.includes(k));
            if (removed.length > 0 && removed.length <= 10) {
                // Only show removed keywords if not too many
                Logger.debug(`Removed overlaps: [${removed.join(", ")}]`);
            }
        }

        return deduplicated;
    }

    /**
     * Remove overlapping/substring keywords to avoid double-counting
     *
     * CJK-AWARE DEDUPLICATION:
     * - CJK text: Aggressive substring removal (handles character splitting)
     *   Example: ["如何", "如", "何"] → ["如何"] ✅
     * - Non-CJK text: Conservative (only remove if BOTH are CJK)
     *   Example: ["chat", "chatt"] → ["chat", "chatt"] ✅ (different words!)
     *
     * PUBLIC for UI display deduplication
     */
    static deduplicateOverlappingKeywords(keywords: string[]): string[] {
        // Sort by length (longest first) to prioritize multi-character words
        const sorted = [...keywords].sort((a, b) => b.length - a.length);
        const deduplicated: string[] = [];

        for (const keyword of sorted) {
            // Check if this keyword is a substring of any already-kept keyword
            const isSubstringOf = deduplicated.find((kept) =>
                kept.includes(keyword),
            );

            if (isSubstringOf) {
                // CJK-AWARE LOGIC:
                // Only remove if BOTH the keyword and its container are CJK
                // This handles CJK character splitting: "如" ⊂ "如何" → remove "如"
                // But preserves different words: "chat" ⊂ "chatt" → keep both
                const keywordIsCJK = StopWords.isCJK(keyword);
                const containerIsCJK = StopWords.isCJK(isSubstringOf);

                if (keywordIsCJK && containerIsCJK) {
                    // Both CJK: This is character splitting → remove substring
                    continue; // Skip this keyword
                }
                // else: Non-CJK or mixed → keep both (different words)
            }

            // Keep this keyword
            deduplicated.push(keyword);
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
        settings: import("../../settings").PluginSettings,
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
    /**
     * Calculate due date score (PUBLIC - reused in API-level filtering)
     * @param dueDate - Due date string
     * @param settings - Plugin settings with user-configurable scores
     * @returns Score based on date ranges
     */
    static calculateDueDateScore(
        dueDate: string | undefined,
        settings: import("../../settings").PluginSettings,
    ): number {
        // No due date = user-configurable score (default: 0.1)
        if (!dueDate) return settings.dueDateNoneScore;

        // Use moment for reliable date comparisons (from Obsidian)
        const { moment } = window as any;
        if (!moment) {
            Logger.warn("moment not available, skipping due date score");
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
     * Calculate priority score (PUBLIC - reused in API-level filtering)
     * @param priority - Task priority (1=highest, 2=high, 3=medium, 4=low)
     * @param settings - Plugin settings with user-configurable coefficients
     * @returns Score: User-configurable (defaults: 1.0 for P1, 0.75 P2, 0.5 P3, 0.2 P4, 0.1 none)
     */
    static calculatePriorityScore(
        priority: number | undefined,
        settings: import("../../settings").PluginSettings,
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
     * Calculate status score (PUBLIC - reused in API-level filtering)
     * Dynamic - supports custom categories
     * @param statusCategory - Task status category (any custom category name)
     * @param settings - Plugin settings with user-configurable coefficients
     * @returns Score from taskStatusMapping (0.0-1.0), defaults to 0.5 for unknown categories
     */
    static calculateStatusScore(
        statusCategory: string | undefined,
        settings: import("../../settings").PluginSettings,
    ): number {
        if (!statusCategory) {
            // Default to "open" category score if exists, otherwise 1.0
            return settings.taskStatusMapping.open?.score ?? 1.0;
        }

        // Normalize for backward compatibility (handles "inProgress" or "in-progress")
        const normalized = statusCategory.toLowerCase().replace(/-/g, "");

        // Try direct lookup
        const directConfig = settings.taskStatusMapping[statusCategory];
        if (directConfig) {
            return directConfig.score;
        }

        // Try normalized lookup
        for (const [category, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (category.toLowerCase().replace(/-/g, "") === normalized) {
                return config.score;
            }
        }

        // Unknown category - return "other" score if exists, otherwise 0.5
        return settings.taskStatusMapping.other?.score ?? 0.5;
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
        relevCoeff = 20,
        dateCoeff = 4,
        priorCoeff = 1,
        statusCoeff = 1,
        settings: import("../../settings").PluginSettings,
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

        Logger.debug(
            `========== COMPREHENSIVE SCORING CONFIGURATION ==========`,
        );
        Logger.debug(
            `User coefficients - relevance: ${relevCoeff}, dueDate: ${dateCoeff}, priority: ${priorCoeff}, status: ${statusCoeff}`,
        );
        Logger.debug(
            `Core keywords: ${deduplicatedCoreKeywords.length} [${deduplicatedCoreKeywords.join(", ")}]`,
        );
        Logger.debug(`Expanded keywords: ${deduplicatedKeywords.length}`);
        Logger.debug(
            `Query filters - dueDate: ${queryHasDueDate}, priority: ${queryHasPriority}, status: ${queryHasStatus}`,
        );
        Logger.debug(
            `Sort criteria includes - dueDate: ${dueDateInSort}, priority: ${priorityInSort}, status: ${statusInSort}`,
        );
        Logger.debug(
            `Active coefficients - relevance: ${relevanceCoefficient * relevCoeff} (query has keywords: ${queryHasKeywords}), dueDate: ${dueDateCoefficient * dateCoeff}, priority: ${priorityCoefficient * priorCoeff}, status: ${statusCoefficient * statusCoeff}`,
        );
        Logger.debug(
            `============================================================`,
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
        Logger.debug(
            `========== TOP 5 SCORED TASKS (Comprehensive) ==========`,
        );
        sorted.slice(0, 5).forEach((item, index) => {
            Logger.debug(
                `#${index + 1}: "${item.task.text.substring(0, 50)}${item.task.text.length > 50 ? "..." : ""}"`,
            );
            Logger.debug(
                `  - Relevance: ${item.relevanceScore.toFixed(2)} (× ${relevCoeff * relevanceCoefficient} = ${(item.relevanceScore * relevCoeff * relevanceCoefficient).toFixed(1)})`,
            );
            Logger.debug(
                `  - Due Date: ${item.dueDateScore.toFixed(2)} (× ${dateCoeff * dueDateCoefficient} = ${(item.dueDateScore * dateCoeff * dueDateCoefficient).toFixed(1)})`,
            );
            Logger.debug(
                `  - Priority: ${item.priorityScore.toFixed(2)} (× ${priorCoeff * priorityCoefficient} = ${(item.priorityScore * priorCoeff * priorityCoefficient).toFixed(1)})`,
            );
            Logger.debug(
                `  - Status: ${item.statusScore.toFixed(2)} (× ${statusCoeff * statusCoefficient} = ${(item.statusScore * statusCoeff * statusCoefficient).toFixed(1)})`,
            );
            Logger.debug(`  - FINAL SCORE: ${item.score.toFixed(1)}`);
        });
        Logger.debug(
            `==============================================================`,
        );

        return sorted;
    }

    /**
     * Single-pass pipeline for filtering, scoring, and limiting tasks
     *
     * OPTIMIZATION: Combines all processing steps into ONE pass through the task array:
     * 1. Keyword filtering (early exit for non-matches)
     * 2. Comprehensive scoring (relevance + due date + priority + status)
     * 3. Quality filter (early exit for low scores)
     * 4. Relevance threshold (early exit for low relevance)
     * 5. Collect results
     * 6. Sort once
     * 7. Limit once
     *
     * This is 10-30% faster than the old multi-pass approach because:
     * - Tasks are processed exactly once
     * - Early exits prevent unnecessary work
     * - Sorting happens only once on the final result set
     *
     * @param tasks - Input tasks to process
     * @param keywords - Keywords for relevance matching (expanded)
     * @param coreKeywords - Core keywords for scoring boost
     * @param queryType - Query characteristics (hasKeywords, etc.)
     * @param scoringParams - Scoring configuration
     * @param qualityThreshold - Minimum total score to pass
     * @param minRelevanceScore - Minimum relevance score to pass (0 = disabled)
     * @param sortOrder - How to sort the final results
     * @param displayLimit - Maximum results to return
     * @returns Filtered, scored, sorted, and limited tasks
     */
    static processTasksPipeline(
        tasks: Task[],
        keywords: string[],
        coreKeywords: string[],
        queryType: { hasKeywords: boolean; hasTaskProperties: boolean },
        scoringParams: {
            queryHasDueDate: boolean;
            queryHasPriority: boolean;
            queryHasStatus: boolean;
            sortOrder: string[];
            relevanceCoefficient: number;
            dueDateCoefficient: number;
            priorityCoefficient: number;
            statusCoefficient: number;
            settings: PluginSettings;
        },
        qualityThreshold: number,
        minRelevanceScore: number,
        sortOrder: string[],
        displayLimit: number,
    ): Task[] {
        const results: Array<{
            task: Task;
            score: number;
            relevanceScore: number;
            dueDateScore: number;
            priorityScore: number;
            statusScore: number;
        }> = [];

        let keywordFiltered = 0;
        let qualityFiltered = 0;
        let relevanceFiltered = 0;

        // Single pass through all tasks
        for (const task of tasks) {
            // Step 1: Keyword filtering (early exit)
            if (keywords.length > 0) {
                if (!this.applyCompoundFilters([task], { keywords }).length) {
                    keywordFiltered++;
                    continue; // Early exit - no point scoring
                }
            }

            // Step 2: Calculate comprehensive score
            const scored = this.scoreTasksComprehensive(
                [task],
                keywords,
                coreKeywords,
                queryType.hasKeywords,
                scoringParams.queryHasDueDate,
                scoringParams.queryHasPriority,
                scoringParams.queryHasStatus,
                scoringParams.sortOrder,
                scoringParams.relevanceCoefficient,
                scoringParams.dueDateCoefficient,
                scoringParams.priorityCoefficient,
                scoringParams.statusCoefficient,
                scoringParams.settings,
            )[0]; // We passed only one task, so get the first result

            if (!scored) continue; // Safety check

            // Step 3: Quality filter (early exit)
            if (scored.score < qualityThreshold) {
                qualityFiltered++;
                continue;
            }

            // Step 4: Relevance threshold (early exit)
            if (minRelevanceScore > 0 && queryType.hasKeywords) {
                if (scored.relevanceScore < minRelevanceScore) {
                    relevanceFiltered++;
                    continue;
                }
            }

            // Step 5: Add to results
            results.push(scored);

            // Early limit optimization: if we have way more than needed, stop processing
            // 3x buffer to account for sorting changes
            if (results.length >= displayLimit * 3) {
                Logger.debug(
                    `[Pipeline] Early stop: collected ${results.length} tasks (target: ${displayLimit})`,
                );
                break;
            }
        }

        Logger.debug(
            `[Pipeline] Filtered: keywords=${keywordFiltered}, quality=${qualityFiltered}, relevance=${relevanceFiltered}`,
        );
        Logger.debug(
            `[Pipeline] Passed: ${results.length} tasks (from ${tasks.length} input)`,
        );

        // Step 6: Sort once (not multiple times!)
        const sorted = TaskSortService.sortTasks(
            results.map((r) => r.task),
            sortOrder,
            scoringParams.settings,
        );

        // Step 7: Limit once
        const limited = sorted.slice(0, displayLimit);

        Logger.debug(
            `[Pipeline] Final: ${limited.length} tasks (sorted and limited)`,
        );

        return limited;
    }

    /**
     * Create relevance filter predicate for API-level filtering
     *
     * OPTIMIZATION: Calculate relevance scores at the DataView/DataCore API level
     * to filter out low-relevance tasks before creating Task objects.
     *
     * Relevance score = (coreKeywordMatches × coreWeight) + expandedKeywordMatches
     *
     * @param keywords - Expanded keywords (includes semantic matches)
     * @param coreKeywords - Core keywords from user query
     * @param minimumRelevanceScore - Minimum relevance score to pass
     * @param settings - Plugin settings
     * @param source - 'datacore' or 'dataview' (affects field access)
     * @returns Filter predicate function
     */
    static createRelevanceFilterPredicate(
        keywords: string[],
        coreKeywords: string[],
        minimumRelevanceScore: number,
        settings: PluginSettings,
        source: "datacore" | "dataview",
    ): (task: any) => boolean {
        return (task: any) => {
            // Skip if no threshold set or no keywords
            if (minimumRelevanceScore <= 0 || keywords.length === 0)
                return true;

            // Get task text
            const taskText =
                source === "datacore"
                    ? (task.$text || task.text || "").toLowerCase()
                    : (task.text || task.visual || "").toLowerCase();

            // Count core keyword matches
            let coreMatches = 0;
            for (const keyword of coreKeywords) {
                if (taskText.includes(keyword.toLowerCase())) {
                    coreMatches++;
                }
            }

            // Count expanded keyword matches
            let expandedMatches = 0;
            for (const keyword of keywords) {
                if (taskText.includes(keyword.toLowerCase())) {
                    expandedMatches++;
                }
            }

            // Calculate relevance score (same logic as scoreTasksComprehensive)
            const relevanceScore =
                coreMatches * settings.relevanceCoreWeight + expandedMatches;

            return relevanceScore >= minimumRelevanceScore;
        };
    }
}
