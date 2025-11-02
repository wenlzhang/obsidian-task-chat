import { App } from "obsidian";
import { Task, TaskStatusCategory } from "../../models/task";
import { PluginSettings } from "../../settings";
import { TaskPropertyService } from "./taskPropertyService";
import { TaskFilterService } from "./taskFilterService";
import { TaskSearchService } from "./taskSearchService";
import { Logger } from "../../utils/logger";

/**
 * Service for integrating with Datacore plugin to fetch tasks
 * Datacore is the successor to Dataview with 2-10x better performance
 *
 * Architecture mirrors DataviewService for consistency
 */
export class DatacoreService {
    /**
     * Check if Datacore plugin is enabled and available
     */
    static isDatacoreEnabled(): boolean {
        const dc = (window as any).datacore;
        return dc !== undefined && typeof dc.query === "function";
    }

    /**
     * Get Datacore API
     */
    static getAPI(): any {
        if (!this.isDatacoreEnabled()) {
            return null;
        }

        return (window as any).datacore;
    }

    /**
     * Map a Datacore task status symbol to status category
     * Delegates to TaskPropertyService for consistent behavior
     */
    static mapStatusToCategory(
        symbol: string | undefined,
        settings: PluginSettings,
    ): TaskStatusCategory {
        return TaskPropertyService.mapStatusToCategory(symbol, settings);
    }

    /**
     * Map a Datacore priority value to internal numeric priority
     * Delegates to TaskPropertyService for consistent behavior
     */
    static mapPriority(
        value: any,
        settings: PluginSettings,
    ): number | undefined {
        return TaskPropertyService.mapPriority(value, settings);
    }

    /**
     * Format date to consistent string format
     * Delegates to TaskPropertyService for consistent behavior
     */
    static formatDate(date: any, format?: string): string | undefined {
        return TaskPropertyService.formatDate(date, format);
    }

    /**
     * Get field value from Datacore task
     * Datacore API docs: https://github.com/blacksmithgu/datacore/blob/master/datacore.api.md
     *
     * Task fields per API docs:
     * - $completed: boolean
     * - $status: string (task status marker)
     * - $text: string
     * - $tags: string[]
     * - $file: string (source file path)
     * - $elements: MarkdownListItem[] (subtasks)
     * - $links: Link[]
     *
     * Additional fields may include custom properties and inline fields
     */
    private static getFieldValue(
        dcTask: any,
        fieldKey: string,
        text: string,
        settings: PluginSettings,
    ): any {
        // Delegate to unified extraction method in TaskPropertyService
        return TaskPropertyService.getUnifiedFieldValue(
            dcTask,
            fieldKey,
            text,
            settings,
            "datacore",
        );
    }

    /**
     * Check if an item is actually a task (has checkbox) vs a regular list item
     *
     * Per Datacore API docs (https://blacksmithgu.github.io/datacore/data/blocks):
     * - Tasks have $type === "task"
     * - List items have $type === "list"
     *
     * IMPORTANT: Accept ALL tasks with $type="task" even if they have:
     * - Empty $text (some tasks have custom status symbols but no text)
     * - Custom $status symbols (-, >, ?, /, !, b, I, p, c, d, f, etc.)
     */
    private static isValidTask(task: any): boolean {
        if (!task) return false;

        // CRITICAL: Check $type FIRST (Datacore's definitive indicator)
        // Accept ALL items with $type="task" regardless of text content
        if (typeof task.$type !== "undefined") {
            return task.$type === "task";
        }

        // Fallback checks for items without $type (backwards compatibility)

        // Check if there's an explicit 'task' boolean property (Dataview compatibility)
        if (typeof task.task === "boolean") {
            return task.task === true;
        }

        // Check if it has $status field (tasks have this, list items don't)
        if (
            typeof task.$status === "undefined" &&
            typeof task.status === "undefined"
        ) {
            return false;
        }

        // Accept if has $status (even with empty text)
        return true;
    }

    /**
     * Process a single Datacore task
     * Converts Datacore task format to internal Task model
     * Uses fields from API docs: $text, $status, $file, $completed, $tags, etc.
     */
    static processDatacoreTask(
        dcTask: any,
        settings: PluginSettings,
        index: number,
        filePath: string = "",
        pageTags: string[] = [],
    ): Task | null {
        if (!this.isValidTask(dcTask)) {
            return null;
        }

        // Extract path (use $file per API docs)
        const path = filePath || dcTask.$file || dcTask.file || "";

        // Use $text for task text (Datacore's built-in field)
        const text = dcTask.$text || dcTask.text || "";
        // Use $status for task status marker (not $symbol)
        const status = dcTask.$status || dcTask.status || "";
        const line = dcTask.$line || dcTask.line || 0;
        const statusCategory = this.mapStatusToCategory(status, settings);

        // Extract folder from path
        const folder = path.includes("/")
            ? path.substring(0, path.lastIndexOf("/"))
            : "";

        // Handle priority using unified field extraction
        let priority;

        // Check Datacore built-in priority first
        let priorityValue = dcTask.$priority;

        // Check ALL possible priority field names (not just user's configured one)
        if (priorityValue === undefined) {
            const priorityFields =
                TaskPropertyService.getAllPriorityFieldNames(settings);
            for (const fieldName of priorityFields) {
                priorityValue = this.getFieldValue(
                    dcTask,
                    fieldName,
                    text,
                    settings,
                );
                if (priorityValue !== undefined) break;
            }
        }

        if (priorityValue !== undefined) {
            priority = this.mapPriority(priorityValue, settings);
        } else if (text) {
            // Fallback to emoji-based priority (Tasks plugin format)
            for (const [emoji, priorityLevel] of Object.entries(
                TaskPropertyService.PRIORITY_EMOJI_MAP,
            )) {
                if (text.includes(emoji)) {
                    priority = priorityLevel;
                    break;
                }
            }
        }

        // Handle dates using unified field extraction
        let dueDate, createdDate, completedDate;

        // Due date - check Datacore locations
        let dueDateValue = dcTask.$due;
        // Check ALL possible due date field names (not just user's configured one)
        if (dueDateValue === undefined) {
            const dueDateFields =
                TaskPropertyService.getAllDueDateFieldNames(settings);
            for (const fieldName of dueDateFields) {
                dueDateValue = this.getFieldValue(
                    dcTask,
                    fieldName,
                    text,
                    settings,
                );
                if (dueDateValue !== undefined) break;
            }
        }
        if (dueDateValue) {
            dueDate = this.formatDate(dueDateValue, settings.dateFormats.due);
        }

        // Created date - check Datacore locations
        let createdDateValue = dcTask.$created;
        if (createdDateValue === undefined) {
            createdDateValue = this.getFieldValue(
                dcTask,
                settings.dataviewKeys.createdDate,
                text,
                settings,
            );
        }
        if (createdDateValue) {
            createdDate = this.formatDate(
                createdDateValue,
                settings.dateFormats.created,
            );
        }

        // Completed date - check Datacore locations
        let completedDateValue = dcTask.$completion;
        if (completedDateValue === undefined) {
            completedDateValue = this.getFieldValue(
                dcTask,
                settings.dataviewKeys.completedDate,
                text,
                settings,
            );
        }
        if (completedDateValue) {
            completedDate = this.formatDate(
                completedDateValue,
                settings.dateFormats.completed,
            );
        }

        // Handle tags
        let tags: string[] = [];
        if (Array.isArray(dcTask.$tags)) {
            tags = dcTask.$tags;
        } else if (Array.isArray(dcTask.tags)) {
            tags = dcTask.tags;
        }

        const taskId = `datacore-${path}-${line}-${text.substring(0, 20)}-${index}`;

        const task = {
            id: taskId,
            text: text,
            status: status,
            statusCategory: statusCategory,
            createdDate: createdDate,
            completedDate: completedDate,
            dueDate: dueDate,
            priority: priority,
            tags: tags, // Task-level tags
            noteTags: pageTags, // Note-level tags
            sourcePath: path,
            lineNumber: line,
            originalText: text,
            folder: folder,
        };

        return task;
    }

    /**
     * Build comprehensive Datacore query with correct syntax
     * Per official Datacore documentation (blacksmithgu.github.io/datacore):
     *
     * ARCHITECTURE:
     * - SOURCE filters (folders, notes, note tags, task tags): OR logic across all
     * - EXCLUSIONS: AND logic (all exclusions applied)
     * - TASK PROPERTIES (due, priority, status): Post-query with AND logic
     *
     * DATACORE SYNTAX:
     * - @task - matches all tasks
     * - path("folder") - matches files in folder (FOLDERS only)
     * - childof(@page and path("Note")) - matches tasks in specific page (NOTES)
     * - childof(@page and #tag) - matches tasks in pages with tag (NOTE TAGS)
     * - #tag - matches tasks with tag (TASK TAGS)
     * - !(...) - negation for exclusions
     * - and / or - logical operators
     *
     * QUERY STRUCTURE:
     * @task
     * and !path("excludedFolder")
     * and !childof(@page and path("excludedNote"))
     * and !childof(@page and #excludedNoteTag)
     * and !#excludedTaskTag
     * and (path("folder") or childof(@page and path("note")) or childof(@page and #noteTag) or #taskTag)
     */
    private static buildDatacoreQuery(
        settings: PluginSettings,
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
    ): string {
        const queryParts: string[] = ["@task"];

        // ========================================
        // EXCLUSIONS (AND logic - all applied)
        // ========================================

        // Exclude folders
        if (
            settings.exclusions.folders &&
            settings.exclusions.folders.length > 0
        ) {
            for (const folder of settings.exclusions.folders) {
                queryParts.push(`!path("${folder}")`);
            }
        }

        // Exclude specific notes (tasks in these specific pages)
        if (settings.exclusions.notes && settings.exclusions.notes.length > 0) {
            for (const note of settings.exclusions.notes) {
                // Extract just the filename without path or extension
                // Datacore uses $name which is the filename only (no path, no extension)
                const fileName =
                    TaskFilterService.normalizePathForDatacore(note);
                queryParts.push(`!childof(@page and $name = "${fileName}")`);
            }
        }

        // Exclude note-level tags (tasks in pages with these tags)
        if (
            settings.exclusions.noteTags &&
            settings.exclusions.noteTags.length > 0
        ) {
            for (const tag of settings.exclusions.noteTags) {
                const normalizedTag = TaskFilterService.normalizeTag(tag);
                queryParts.push(`!childof(@page and #${normalizedTag})`);
            }
        }

        // Exclude task-level tags (tasks with these tags)
        if (
            settings.exclusions.taskTags &&
            settings.exclusions.taskTags.length > 0
        ) {
            for (const tag of settings.exclusions.taskTags) {
                const normalizedTag = TaskFilterService.normalizeTag(tag);
                queryParts.push(`!#${normalizedTag}`);
            }
        }

        // ========================================
        // INCLUSIONS (OR logic - at least one must match)
        // ========================================

        const inclusionConditions: string[] = [];

        // Include folders
        if (inclusionFilters?.folders && inclusionFilters.folders.length > 0) {
            for (const folder of inclusionFilters.folders) {
                inclusionConditions.push(`path("${folder}")`);
            }
        }

        // Include specific notes (tasks in these specific pages)
        if (inclusionFilters?.notes && inclusionFilters.notes.length > 0) {
            for (const note of inclusionFilters.notes) {
                // Extract just the filename without path or extension
                // Datacore uses $name which is the filename only (no path, no extension)
                const fileName =
                    TaskFilterService.normalizePathForDatacore(note);
                inclusionConditions.push(
                    `childof(@page and $name = "${fileName}")`,
                );
            }
        }

        // Include note-level tags (tasks in pages with these tags)
        if (
            inclusionFilters?.noteTags &&
            inclusionFilters.noteTags.length > 0
        ) {
            for (const tag of inclusionFilters.noteTags) {
                const normalizedTag = TaskFilterService.normalizeTag(tag);
                inclusionConditions.push(
                    `childof(@page and #${normalizedTag})`,
                );
            }
        }

        // Include task-level tags (tasks with these tags)
        if (
            inclusionFilters?.taskTags &&
            inclusionFilters.taskTags.length > 0
        ) {
            for (const tag of inclusionFilters.taskTags) {
                const normalizedTag = TaskFilterService.normalizeTag(tag);
                inclusionConditions.push(`#${normalizedTag}`);
            }
        }

        // Add inclusion conditions with OR logic
        if (inclusionConditions.length > 0) {
            const inclusionQuery = inclusionConditions.join(" or ");
            queryParts.push(`(${inclusionQuery})`);
        }

        const query = queryParts.join(" and ");
        Logger.debug(`Datacore query (folders/tags only): ${query}`);
        return query;
    }

    /**
     * Build task filter function (post-query filtering)
     * Mirrors DataviewService.buildTaskFilter approach
     */
    private static buildTaskFilter(
        propertyFilters: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: { start?: string; end?: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        settings: PluginSettings,
    ): ((dcTask: any) => boolean) | null {
        // Delegate to unified filter building method in TaskPropertyService
        return TaskPropertyService.buildUnifiedTaskFilter(
            propertyFilters,
            settings,
            "datacore",
        );
    }

    /**
     * Parse all tasks from Datacore with optional filtering
     * Main entry point - mirrors DataviewService.parseTasksFromDataview()
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param dateFilter - Optional date filter (legacy parameter for compatibility)
     * @param propertyFilters - Optional property filters (priority, dueDate, status)
     * @param inclusionFilters - Optional inclusion filters (folders, tags, notes)
     * @param qualityThreshold - Optional quality score threshold for API-level filtering
     * @param keywords - Optional keywords for relevance filtering (expanded keywords)
     * @param coreKeywords - Optional core keywords for relevance boost
     * @param minimumRelevanceScore - Optional minimum relevance score threshold
     */
    static async parseTasksFromDatacore(
        app: App,
        settings: PluginSettings,
        dateFilter?: string,
        propertyFilters?: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: { start?: string; end?: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
        qualityThreshold?: number,
        keywords?: string[],
        coreKeywords?: string[],
        minimumRelevanceScore?: number,
    ): Promise<Task[]> {
        const datacoreApi = this.getAPI();
        if (!datacoreApi) {
            Logger.warn("Datacore API not available");
            return [];
        }

        const tasks: Task[] = [];

        try {
            // Build query for folder/tag filtering (basic query level)
            const query = this.buildDatacoreQuery(settings, inclusionFilters);

            // Build property filter function (uses existing unified filter logic)
            // This will be applied at API level using .filter() for better performance
            const taskFilter = propertyFilters
                ? this.buildTaskFilter(propertyFilters, settings)
                : null;

            // Execute query to get all tasks (including subtasks)
            let results = await datacoreApi.query(query);

            if (!results || results.length === 0) {
                return tasks;
            }

            // ========================================
            // API-LEVEL PROPERTY FILTERING
            // Apply property filters (priority, due date, status) at API level
            // This prevents filtered-out tasks from ever becoming Task objects
            // ========================================
            if (taskFilter) {
                const beforeFilter = results.length;
                results = results.filter(taskFilter);
                Logger.debug(
                    `[Datacore] Property filter: ${beforeFilter} → ${results.length} tasks`,
                );

                if (results.length === 0) {
                    Logger.debug(
                        "[Datacore] No tasks remaining after property filters",
                    );
                    return tasks;
                }
            }

            // ========================================
            // API-LEVEL QUALITY FILTERING
            // Apply quality filter (due date + priority + status scores) at API level
            // This prevents low-quality tasks from ever becoming Task objects
            // ========================================
            if (qualityThreshold !== undefined && qualityThreshold > 0) {
                const beforeQuality = results.length;
                const qualityFilter =
                    TaskSearchService.createQualityFilterPredicate(
                        settings,
                        qualityThreshold,
                        "datacore",
                    );
                results = results.filter(qualityFilter);
                Logger.debug(
                    `[Datacore] Quality filter (threshold: ${qualityThreshold.toFixed(2)}): ${beforeQuality} → ${results.length} tasks`,
                );

                if (results.length === 0) {
                    Logger.debug(
                        "[Datacore] No tasks remaining after quality filter",
                    );
                    return tasks;
                }
            }

            // ========================================
            // API-LEVEL RELEVANCE FILTERING
            // Apply relevance filter (keyword matching) at API level
            // This prevents low-relevance tasks from ever becoming Task objects
            // ========================================
            if (
                keywords &&
                keywords.length > 0 &&
                minimumRelevanceScore !== undefined &&
                minimumRelevanceScore > 0
            ) {
                const beforeRelevance = results.length;
                const relevanceFilter =
                    TaskSearchService.createRelevanceFilterPredicate(
                        keywords,
                        coreKeywords || keywords,
                        minimumRelevanceScore,
                        settings,
                        "datacore",
                    );
                results = results.filter(relevanceFilter);
                Logger.debug(
                    `[Datacore] Relevance filter (min score: ${minimumRelevanceScore.toFixed(2)}): ${beforeRelevance} → ${results.length} tasks`,
                );

                if (results.length === 0) {
                    Logger.debug(
                        "[Datacore] No tasks remaining after relevance filter",
                    );
                    return tasks;
                }
            }

            // ========================================
            // CONDITIONAL PAGE TAG LOADING
            // OPTIMIZATION: Only fetch page tags when actually needed
            // This is a MAJOR performance boost for large vaults (2-3 second savings!)
            // ========================================

            const pageTagsMap = new Map<string, string[]>();

            // Determine if we need page tags
            const needsPageTags =
                (inclusionFilters?.noteTags &&
                    inclusionFilters.noteTags.length > 0) ||
                (settings.exclusions.noteTags &&
                    settings.exclusions.noteTags.length > 0) ||
                settings.alwaysDisplayNoteTags; // User setting (if it exists)

            if (needsPageTags) {
                Logger.debug(
                    "[Datacore] Fetching page tags (needed for note tag filters)",
                );

                // Get unique page paths from task results
                const uniquePaths = new Set<string>(
                    results
                        .map((t: any) => (t.$file || t.file || "") as string)
                        .filter((p) => p),
                );

                if (uniquePaths.size > 0) {
                    try {
                        // OPTIMIZATION: Query only pages with matching tasks instead of ALL pages
                        // Old: "@page" → queries ALL pages in vault (10,000+ pages in large vaults!)
                        // New: "@page and ($file = "path1" or $file = "path2")" → queries only needed pages

                        const pathConditions = Array.from(uniquePaths)
                            .slice(0, 500) // Safety limit to prevent query string explosion
                            .map((path) => `$file = "${path}"`)
                            .join(" or ");

                        const pagesQuery =
                            pathConditions.length > 0
                                ? `@page and (${pathConditions})`
                                : "@page";

                        Logger.debug(
                            `[Datacore] Querying ${uniquePaths.size} pages for tags (was: all pages)`,
                        );
                        const pages = await datacoreApi.query(pagesQuery);

                        if (pages && Array.isArray(pages)) {
                            for (const page of pages) {
                                const pagePath = page.$file || page.file || "";
                                if (!pagePath) continue;

                                // Get tags from page using Datacore's native $tags property
                                const pageTags = page.$tags || page.tags || [];
                                if (pageTags.length > 0) {
                                    pageTagsMap.set(pagePath, pageTags);
                                }
                            }
                        }
                        Logger.debug(
                            `[Datacore] Loaded tags for ${pageTagsMap.size} pages`,
                        );
                    } catch (error) {
                        Logger.warn(
                            "Failed to fetch page tags from Datacore:",
                            error,
                        );
                    }
                }
            } else {
                Logger.debug("[Datacore] Skipping page tag fetch (not needed)");
            }

            // IMPORTANT: @task query returns ALL tasks (including subtasks) as a FLAT list
            // Similar to Dataview's file.tasks, Datacore already flattens the hierarchy
            // We do NOT need to recursively flatten - that causes double counting!
            //
            // Example of the problem:
            // - [ ] Parent task
            //   - [ ] Child task
            //
            // Datacore's @task returns: [Parent, Child] (2 items, already flat)
            // If we flatten: Parent -> [Parent, Child from $elements] + Child -> [Child]
            // Result: [Parent, Child, Child] = 3 tasks (WRONG! Child counted twice)
            //
            // Solution: Use results as-is, just filter out invalid items
            const allTasks: any[] = [];
            const validationStats = {
                total: 0,
                validTasks: 0,
                invalidItems: 0,
                withTypeTask: 0,
                withTypeList: 0,
                withTypeOther: 0,
                noType: 0,
            };

            for (const dcTask of results) {
                validationStats.total++;

                // Track what types we're seeing
                if (typeof dcTask.$type !== "undefined") {
                    if (dcTask.$type === "task") {
                        validationStats.withTypeTask++;
                    } else if (dcTask.$type === "list") {
                        validationStats.withTypeList++;
                    } else {
                        validationStats.withTypeOther++;
                        Logger.debug(
                            `[Datacore] Unknown $type="${dcTask.$type}": "${dcTask.$text || dcTask.text}"`,
                        );
                    }
                } else {
                    validationStats.noType++;
                    Logger.debug(
                        `[Datacore] Item WITHOUT $type: text="${dcTask.$text || dcTask.text}", has $status: ${typeof dcTask.$status !== "undefined"}, task prop: ${typeof dcTask.task}`,
                    );
                }

                if (this.isValidTask(dcTask)) {
                    allTasks.push(dcTask);
                    validationStats.validTasks++;
                } else {
                    validationStats.invalidItems++;
                    // Log rejected items to understand why they're being filtered
                    Logger.debug(
                        `[Datacore] REJECTED item: $type="${dcTask.$type}", $status="${dcTask.$status}", $text="${(dcTask.$text || dcTask.text || "").substring(0, 50)}", task prop: ${dcTask.task}`,
                    );
                }
            }

            // Process each task (including subtasks)
            // NOTE: Property filters (priority, due date, status) were already applied at API level
            // So allTasks only contains tasks that passed those filters
            let taskIndex = 0;

            for (const dcTask of allTasks) {
                // Use $file per API docs (not $path)
                const taskPath = dcTask.$file || dcTask.file || "";

                // NOTE: We do NOT filter out completed tasks here
                // The scoring system handles prioritizing incomplete tasks over completed ones
                // Users can explicitly filter by status if they want

                // Process task
                const task = this.processDatacoreTask(
                    dcTask,
                    settings,
                    taskIndex++,
                    taskPath,
                    pageTagsMap.get(taskPath) || [], // Pass note-level tags from page
                );

                if (task) {
                    tasks.push(task);
                }
            }
        } catch (error) {
            Logger.error("Error querying Datacore:", error);
        }

        return tasks;
    }

    /**
     * Get task count from Datacore with optional filtering
     * Lightweight version that only counts tasks without creating full Task objects
     *
     * PERFORMANCE: 20-30x faster than parseTasksFromDatacore because:
     * - No page tag fetching (saves 1-3 seconds in large vaults!)
     * - No Task object creation (saves memory and processing)
     * - Only counts valid tasks that pass filters
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param propertyFilters - Optional property filters (priority, dueDate, status)
     * @param inclusionFilters - Optional inclusion filters (folders, tags, notes)
     */
    static async getTaskCount(
        app: App,
        settings: PluginSettings,
        propertyFilters?: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: { start?: string; end?: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
    ): Promise<number> {
        const datacoreApi = this.getAPI();
        if (!datacoreApi) {
            Logger.warn("Datacore API not available");
            return 0;
        }

        try {
            // Build query for source-level filtering (reuse existing method)
            const query = this.buildDatacoreQuery(settings, inclusionFilters);

            // Build post-query filter for task properties (reuse existing method)
            const taskFilter = propertyFilters
                ? this.buildTaskFilter(propertyFilters, settings)
                : null;

            // Execute query to get all tasks
            let results = await datacoreApi.query(query);

            if (!results || results.length === 0) {
                return 0;
            }

            // API-LEVEL FILTERING: Apply property filters before counting
            if (taskFilter) {
                results = results.filter(taskFilter);
            }

            // Count valid tasks
            let count = 0;
            for (const dcTask of results) {
                // Skip invalid tasks
                if (!this.isValidTask(dcTask)) continue;

                // Check note-level inclusion filters if specified
                if (
                    inclusionFilters?.notes &&
                    inclusionFilters.notes.length > 0
                ) {
                    const taskPath = dcTask.$file || dcTask.file || "";
                    const matchesNote = inclusionFilters.notes.some((note) => {
                        const fileName =
                            TaskFilterService.normalizePathForDatacore(note);
                        const taskFileName =
                            taskPath.split("/").pop()?.replace(/\.md$/, "") ||
                            "";
                        return taskFileName === fileName;
                    });
                    if (!matchesNote) continue;
                }

                count++;
            }

            Logger.debug(
                `[Datacore] Task count: ${count} (from ${results.length} results)`,
            );
            return count;
        } catch (error) {
            Logger.error("Error getting task count from Datacore:", error);
            return 0;
        }
    }
}
