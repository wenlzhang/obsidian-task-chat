import { App, moment } from "obsidian";
import { Task, TaskStatusCategory } from "../models/task";
import { PluginSettings } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";
import { Logger } from "../utils/logger";

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
    ): any {
        // Strategy 1: Check Datacore built-in properties (with $ prefix)
        // Based on official API documentation
        const builtInFieldMap: { [key: string]: string } = {
            text: "$text",
            symbol: "$status", // API docs: $status is the status marker
            status: "$status",
            completed: "$completed",
            due: "$due",
            dueDate: "$due",
            created: "$created",
            createdDate: "$created",
            completion: "$completion",
            completedDate: "$completion",
            start: "$start",
            startDate: "$start",
            scheduled: "$scheduled",
            scheduledDate: "$scheduled",
            priority: "$priority",
            tags: "$tags",
            file: "$file",
            path: "$file", // Map path to $file
        };

        const builtInKey = builtInFieldMap[fieldKey];
        if (builtInKey && dcTask[builtInKey] !== undefined) {
            return dcTask[builtInKey];
        }

        // Strategy 2: Check user's configured field name (direct property)
        if (dcTask[fieldKey] !== undefined) {
            return dcTask[fieldKey];
        }

        // Strategy 3: Check fields object (inline fields)
        if (dcTask.fields && dcTask.fields[fieldKey] !== undefined) {
            return dcTask.fields[fieldKey];
        }

        // Strategy 4: Extract emoji shorthands from text (fallback compatibility)
        const emojiValue = TaskPropertyService.extractEmojiShorthand(
            text,
            fieldKey,
        );
        if (emojiValue !== undefined) {
            return emojiValue;
        }

        // Strategy 5: Extract from inline field syntax in text
        const inlineValue = TaskPropertyService.extractInlineField(
            text,
            fieldKey,
        );
        if (inlineValue !== undefined) {
            return inlineValue;
        }

        return undefined;
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
        const priorityKey = settings.dataviewKeys.priority;

        // Check Datacore built-in priority first
        let priorityValue = dcTask.$priority;

        // Fallback to user's configured field name
        if (priorityValue === undefined) {
            priorityValue = this.getFieldValue(dcTask, priorityKey, text);
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
        if (dueDateValue === undefined) {
            dueDateValue = this.getFieldValue(
                dcTask,
                settings.dataviewKeys.dueDate,
                text,
            );
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
     * Build comprehensive Datacore query with exclusions AND inclusions
     * Per user requirements:
     * - SOURCE LEVEL (query): folders, notes, note tags (exclusions + inclusions)
     * - POST-QUERY LEVEL: task tags, task properties (exclusions + inclusions)
     *
     * Per Datacore API docs:
     * - `@task` - all tasks (excludes list items automatically)
     * - `#tag` - filter by page tag (note-level)
     * - `!#tag` - exclude by page tag
     * - `path("folder")` or `path("Note.md")` - filter by path
     * - `!path("folder")` or `!path("Note.md")` - exclude by path
     * - `and` / `or` - combine conditions
     *
     * Note: Task-level tags use dcTask.$tags API post-query (query #tag filters pages)
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
        // EXCLUSIONS (Settings tab level)
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

        // Exclude specific notes (files)
        if (settings.exclusions.notes && settings.exclusions.notes.length > 0) {
            for (const note of settings.exclusions.notes) {
                queryParts.push(`!path("${note}")`);
            }
        }

        // Exclude note-level tags (page tags)
        if (
            settings.exclusions.noteTags &&
            settings.exclusions.noteTags.length > 0
        ) {
            for (const tag of settings.exclusions.noteTags) {
                const normalizedTag = tag.replace(/^#+/, "");
                queryParts.push(`!#${normalizedTag}`);
            }
        }

        // NOTE: Task-level tag exclusions handled post-query with dcTask.$tags

        // ========================================
        // INCLUSIONS (Chat interface level)
        // ========================================

        // Include folders - add ALL to query with OR logic
        if (inclusionFilters?.folders && inclusionFilters.folders.length > 0) {
            if (inclusionFilters.folders.length === 1) {
                queryParts.push(`path("${inclusionFilters.folders[0]}")`);
            } else {
                // Multiple folders with OR logic: (path("A") or path("B"))
                const folderConditions = inclusionFilters.folders
                    .map((folder) => `path("${folder}")`)
                    .join(" or ");
                queryParts.push(`(${folderConditions})`);
            }
        }

        // Include specific notes (files) - add ALL to query with OR logic
        if (inclusionFilters?.notes && inclusionFilters.notes.length > 0) {
            if (inclusionFilters.notes.length === 1) {
                queryParts.push(`path("${inclusionFilters.notes[0]}")`);
            } else {
                // Multiple notes with OR logic: (path("A.md") or path("B.md"))
                const noteConditions = inclusionFilters.notes
                    .map((note) => `path("${note}")`)
                    .join(" or ");
                queryParts.push(`(${noteConditions})`);
            }
        }

        // Include note-level tags - add ALL to query with OR logic
        if (
            inclusionFilters?.noteTags &&
            inclusionFilters.noteTags.length > 0
        ) {
            if (inclusionFilters.noteTags.length === 1) {
                const normalizedTag = inclusionFilters.noteTags[0].replace(
                    /^#+/,
                    "",
                );
                queryParts.push(`#${normalizedTag}`);
            } else {
                // Multiple tags with OR logic: (#tag1 or #tag2)
                const tagConditions = inclusionFilters.noteTags
                    .map((tag) => {
                        const normalizedTag = tag.replace(/^#+/, "");
                        return `#${normalizedTag}`;
                    })
                    .join(" or ");
                queryParts.push(`(${tagConditions})`);
            }
        }

        // NOTE: Task-level tag inclusions handled post-query with dcTask.$tags
        // NOTE: Task properties handled post-query

        const query = queryParts.join(" and ");

        Logger.debug(
            `Datacore query (source-level): ${query} (folders + notes + note tags)`,
        );
        return query;
    }

    /**
     * Build task filter function (post-query filtering)
     * Mirrors DataviewService.buildTaskFilter approach
     */
    private static buildTaskFilter(
        propertyFilters: {
            priority?: number | number[] | "all" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: { start: string; end: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        settings: PluginSettings,
    ): ((dcTask: any) => boolean) | null {
        const filters: ((dcTask: any) => boolean)[] = [];

        // Build priority filter
        if (propertyFilters.priority) {
            if (propertyFilters.priority === "all") {
                // Tasks with ANY priority
                filters.push((dcTask: any) => {
                    const priority = dcTask.$priority;
                    return priority !== undefined && priority !== null;
                });
            } else if (propertyFilters.priority === "none") {
                // Tasks with NO priority
                filters.push((dcTask: any) => {
                    const priority = dcTask.$priority;
                    return priority === undefined || priority === null;
                });
            } else {
                // Specific priority values
                const targetPriorities = Array.isArray(propertyFilters.priority)
                    ? propertyFilters.priority
                    : [propertyFilters.priority];

                filters.push((dcTask: any) => {
                    const taskText = dcTask.$text || dcTask.text || "";
                    const priorityValue = this.getFieldValue(
                        dcTask,
                        settings.dataviewKeys.priority,
                        taskText,
                    );

                    if (priorityValue !== undefined && priorityValue !== null) {
                        const mapped = this.mapPriority(
                            priorityValue,
                            settings,
                        );
                        return (
                            mapped !== undefined &&
                            targetPriorities.includes(mapped)
                        );
                    }
                    return false;
                });
            }
        }

        // Build due date filter
        if (propertyFilters.dueDate) {
            const dueDateValues = Array.isArray(propertyFilters.dueDate)
                ? propertyFilters.dueDate
                : [propertyFilters.dueDate];

            filters.push((dcTask: any) => {
                for (const dueDateValue of dueDateValues) {
                    if (
                        this.matchesDueDateValue(dcTask, dueDateValue, settings)
                    ) {
                        return true;
                    }
                }
                return false;
            });
        }

        // Build date range filter
        if (propertyFilters.dueDateRange) {
            const { start, end } = propertyFilters.dueDateRange;
            const startDate = TaskPropertyService.parseDateRangeKeyword(start);
            const endDate = TaskPropertyService.parseDateRangeKeyword(end);

            filters.push((dcTask: any) => {
                const taskText = dcTask.$text || dcTask.text || "";
                const dueDateValue = this.getFieldValue(
                    dcTask,
                    settings.dataviewKeys.dueDate,
                    taskText,
                );

                if (!dueDateValue) return false;

                const taskDate = moment(this.formatDate(dueDateValue));
                return (
                    taskDate.isSameOrAfter(startDate, "day") &&
                    taskDate.isSameOrBefore(endDate, "day")
                );
            });
        }

        // Build status filter (unified s: syntax)
        if (
            propertyFilters.statusValues &&
            propertyFilters.statusValues.length > 0
        ) {
            filters.push((dcTask: any) => {
                // Use $status per API docs (not $symbol)
                const taskStatus = dcTask.$status || dcTask.status;
                if (taskStatus === undefined) return false;

                return propertyFilters.statusValues!.some((value) => {
                    // 1. Try exact symbol match
                    if (taskStatus === value) return true;

                    // 2. Try category match
                    const normalizedValue = value
                        .toLowerCase()
                        .replace(/-/g, "")
                        .replace(/\s+/g, "");

                    for (const [categoryKey, categoryConfig] of Object.entries(
                        settings.taskStatusMapping,
                    )) {
                        if (
                            categoryKey.toLowerCase() === normalizedValue ||
                            categoryKey.toLowerCase().replace(/-/g, "") ===
                                normalizedValue
                        ) {
                            return categoryConfig.symbols.includes(taskStatus);
                        }

                        const aliases = categoryConfig.aliases
                            .toLowerCase()
                            .split(",")
                            .map((a) => a.trim());
                        if (aliases.includes(value.toLowerCase())) {
                            return categoryConfig.symbols.includes(taskStatus);
                        }
                    }

                    return false;
                });
            });
        }

        // Combine all filters with AND logic
        if (filters.length === 0) {
            return null;
        }

        return (dcTask: any) => {
            return filters.every((f) => f(dcTask));
        };
    }

    /**
     * Check if task matches a due date value
     * Mirrors DataviewService.matchesDueDateValue
     */
    private static matchesDueDateValue(
        dcTask: any,
        dueDateValue: string,
        settings: PluginSettings,
    ): boolean {
        const taskText = dcTask.$text || dcTask.text || "";
        const taskDueDate = this.getFieldValue(
            dcTask,
            settings.dataviewKeys.dueDate,
            taskText,
        );

        // Handle "all" or "any" - task must have a due date
        if (dueDateValue === "all" || dueDateValue === "any") {
            return taskDueDate !== undefined && taskDueDate !== null;
        }

        // Handle "none" - task must NOT have a due date
        if (dueDateValue === "none") {
            return taskDueDate === undefined || taskDueDate === null;
        }

        // Task must have a due date for other comparisons
        if (!taskDueDate) return false;

        const formattedDate = this.formatDate(taskDueDate);
        if (!formattedDate) return false;

        const taskDate = moment(formattedDate, "YYYY-MM-DD", true);
        if (!taskDate.isValid()) return false;

        // Handle "today"
        if (dueDateValue === "today") {
            return taskDate.isSame(moment(), "day");
        }

        // Handle "overdue"
        if (dueDateValue === "overdue") {
            return taskDate.isBefore(moment(), "day");
        }

        // Handle "tomorrow"
        if (dueDateValue === "tomorrow") {
            return taskDate.isSame(moment().add(1, "day"), "day");
        }

        // Handle "future"
        if (dueDateValue === "future") {
            return taskDate.isAfter(moment(), "day");
        }

        // Handle "week" (next 7 days)
        if (dueDateValue === "week") {
            const weekEnd = moment().add(7, "days");
            return (
                taskDate.isSameOrAfter(moment(), "day") &&
                taskDate.isSameOrBefore(weekEnd, "day")
            );
        }

        // Handle "next-week" (days 8-14)
        if (dueDateValue === "next-week") {
            const nextWeekStart = moment().add(8, "days");
            const nextWeekEnd = moment().add(14, "days");
            return (
                taskDate.isSameOrAfter(nextWeekStart, "day") &&
                taskDate.isSameOrBefore(nextWeekEnd, "day")
            );
        }

        // Handle specific date (YYYY-MM-DD)
        const specificDate = moment(dueDateValue, "YYYY-MM-DD", true);
        if (specificDate.isValid()) {
            return taskDate.isSame(specificDate, "day");
        }

        return false;
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
     */
    static async parseTasksFromDatacore(
        app: App,
        settings: PluginSettings,
        dateFilter?: string,
        propertyFilters?: {
            priority?: number | number[] | null;
            dueDate?: string | null;
            dueDateRange?: { start: string; end: string } | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
        },
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
    ): Promise<Task[]> {
        const datacoreApi = this.getAPI();
        if (!datacoreApi) {
            Logger.warn("Datacore API not available");
            return [];
        }

        // Log exclusion information
        if (
            settings.exclusions &&
            (settings.exclusions.noteTags?.length > 0 ||
                settings.exclusions.taskTags?.length > 0 ||
                settings.exclusions.folders?.length > 0 ||
                settings.exclusions.notes?.length > 0)
        ) {
            const exclusionParts: string[] = [];
            if (settings.exclusions.noteTags?.length > 0) {
                exclusionParts.push(
                    `${settings.exclusions.noteTags.length} note tag(s)`,
                );
            }
            if (settings.exclusions.taskTags?.length > 0) {
                exclusionParts.push(
                    `${settings.exclusions.taskTags.length} task tag(s)`,
                );
            }
            if (settings.exclusions.folders?.length > 0) {
                exclusionParts.push(
                    `${settings.exclusions.folders.length} folder(s)`,
                );
            }
            if (settings.exclusions.notes?.length > 0) {
                exclusionParts.push(
                    `${settings.exclusions.notes.length} note(s)`,
                );
            }
            Logger.debug(
                `Datacore query exclusions: ${exclusionParts.join(", ")}`,
            );
        }

        const tasks: Task[] = [];

        try {
            // Build query for source-level filtering: folders + note tags (exclusions + inclusions)
            const query = this.buildDatacoreQuery(settings, inclusionFilters);

            // Build post-query filter for task properties (priority, due date, status)
            const taskFilter = propertyFilters
                ? this.buildTaskFilter(propertyFilters, settings)
                : null;

            Logger.debug(`Datacore query: ${query}`);

            // Execute query to get all tasks (including subtasks)
            const results = await datacoreApi.query(query);

            Logger.debug(
                `[Datacore] Query: ${query}\n` +
                    `  Returned: ${results?.length || 0} results\n` +
                    `  Expected (from Dataview): ~755 tasks\n` +
                    `  Difference: ${755 - (results?.length || 0)} tasks missing from query`,
            );

            if (!results || results.length === 0) {
                return tasks;
            }

            // Sample first few results to understand structure
            if (results.length > 0 && settings.enableDebugLogging) {
                const sample = results[0];
                Logger.debug(
                    `[Datacore] Sample result structure:\n` +
                        `  Keys: ${Object.keys(sample)
                            .filter((k) => k.startsWith("$"))
                            .join(", ")}\n` +
                        `  $type: ${sample.$type}\n` +
                        `  $status: ${sample.$status}\n` +
                        `  $completed: ${sample.$completed}\n` +
                        `  Has $elements: ${Array.isArray(sample.$elements)}\n` +
                        `  $elements length: ${sample.$elements?.length || 0}`,
                );
            }

            // Build page metadata map for note-level tags
            // We only need this for passing to processDatacoreTask
            const pageTagsMap = new Map<string, string[]>();

            // Get unique page paths from task results
            const uniquePaths = new Set<string>(
                results.map((t: any) => (t.$file || t.file || "") as string),
            );

            // Query all pages using Datacore API to get their tags
            try {
                const pagesQuery = 'FROM ""';
                const pages = await datacoreApi.query(pagesQuery);

                if (pages && Array.isArray(pages)) {
                    for (const page of pages) {
                        const pagePath = page.$file || page.file || "";
                        if (!pagePath || !uniquePaths.has(pagePath)) continue;

                        // Get tags from page using Datacore's native $tags property
                        const pageTags = page.$tags || page.tags || [];
                        if (pageTags.length > 0) {
                            pageTagsMap.set(pagePath, pageTags);
                        }
                    }
                    Logger.debug(
                        `Fetched note tags for ${pageTagsMap.size} pages (out of ${uniquePaths.size} pages with tasks)`,
                    );
                }
            } catch (error) {
                Logger.warn("Failed to fetch page tags from Datacore:", error);
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

            Logger.debug(
                `[Datacore] Validation Stats:\n` +
                    `  Total from @task query: ${validationStats.total}\n` +
                    `  - $type="task": ${validationStats.withTypeTask}\n` +
                    `  - $type="list": ${validationStats.withTypeList}\n` +
                    `  - $type=other: ${validationStats.withTypeOther}\n` +
                    `  - no $type: ${validationStats.noType}\n` +
                    `  Valid tasks accepted: ${validationStats.validTasks}\n` +
                    `  Invalid items filtered: ${validationStats.invalidItems}`,
            );

            // Process each task (including subtasks)
            let taskIndex = 0;
            let propertyFilterRejects = 0;
            let exclusionRejects = 0;
            let inclusionRejects = 0;

            for (const dcTask of allTasks) {
                // Use $file per API docs (not $path)
                const taskPath = dcTask.$file || dcTask.file || "";

                // NOTE: We do NOT filter out completed tasks here
                // The scoring system handles prioritizing incomplete tasks over completed ones
                // Users can explicitly filter by status if they want

                // ========================================
                // EXCLUSIONS (Settings tab level)
                // Order: Query-level first, then post-query
                // ========================================

                // NOTE: Folders, notes, and note-level tags are handled at query level
                // Only task-level tags need post-query filtering for exclusions

                // Apply task-level tag exclusions using Datacore API (dcTask.$tags)
                if (
                    settings.exclusions.taskTags &&
                    settings.exclusions.taskTags.length > 0
                ) {
                    const taskTags = dcTask.$tags || dcTask.tags || [];
                    if (taskTags.length > 0) {
                        const isExcluded = settings.exclusions.taskTags.some(
                            (excludedTag: string) => {
                                const normalizedExcluded = excludedTag.replace(
                                    /^#+/,
                                    "",
                                );
                                return taskTags.some((taskTag: string) => {
                                    const normalizedTaskTag = taskTag.replace(
                                        /^#+/,
                                        "",
                                    );
                                    return (
                                        normalizedTaskTag.toLowerCase() ===
                                        normalizedExcluded.toLowerCase()
                                    );
                                });
                            },
                        );
                        if (isExcluded) {
                            exclusionRejects++;
                            continue;
                        }
                    }
                }

                // Apply property filters (post-query)
                const shouldInclude = !taskFilter || taskFilter(dcTask);
                if (!shouldInclude) {
                    propertyFilterRejects++;
                    continue;
                }

                // ========================================
                // INCLUSIONS (Chat interface filter level)
                // Applied after exclusions
                // ========================================
                // NOTE: Folders, notes, and note tags are already filtered at query level
                // Only need to check: task tags

                // Check task tag inclusion (AND logic)
                if (
                    inclusionFilters?.taskTags &&
                    inclusionFilters.taskTags.length > 0
                ) {
                    const taskTags = dcTask.$tags || dcTask.tags || [];
                    const hasRequiredTaskTag = taskTags.some(
                        (taskTag: string) => {
                            const normalizedTaskTag = taskTag
                                .replace(/^#+/, "")
                                .toLowerCase();
                            return inclusionFilters.taskTags!.some(
                                (filterTag: string) => {
                                    const normalizedFilter = filterTag
                                        .replace(/^#+/, "")
                                        .toLowerCase();
                                    return (
                                        normalizedTaskTag === normalizedFilter
                                    );
                                },
                            );
                        },
                    );
                    if (!hasRequiredTaskTag) {
                        inclusionRejects++;
                        continue;
                    }
                }

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

            Logger.debug(
                `Datacore filtering stats: ${allTasks.length} total tasks (flattened) -> ${tasks.length} final (property:${propertyFilterRejects}, exclusion:${exclusionRejects}, inclusion:${inclusionRejects})`,
            );
        } catch (error) {
            Logger.error("Error querying Datacore:", error);
        }

        return tasks;
    }
}
