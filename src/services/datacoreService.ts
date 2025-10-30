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
        Logger.debug(
            `[DATACORE QUERY] Building query with inclusionFilters:`,
            JSON.stringify(inclusionFilters, null, 2),
        );

        const queryParts: string[] = ["@task"];

        // ========================================
        // EXCLUSIONS (AND logic - all applied)
        // ========================================

        // Exclude folders
        if (
            settings.exclusions.folders &&
            settings.exclusions.folders.length > 0
        ) {
            Logger.debug(
                `[DATACORE QUERY] Excluding folders: ${settings.exclusions.folders.join(", ")}`,
            );
            for (const folder of settings.exclusions.folders) {
                queryParts.push(`!path("${folder}")`);
            }
        }

        // Exclude specific notes (tasks in these specific pages)
        if (settings.exclusions.notes && settings.exclusions.notes.length > 0) {
            Logger.debug(
                `[DATACORE QUERY] Excluding notes: ${settings.exclusions.notes.join(", ")}`,
            );
            for (const note of settings.exclusions.notes) {
                // Extract just the filename without path or extension
                // Datacore uses $name which is the filename only (no path, no extension)
                const fileName =
                    note.split("/").pop()?.replace(/\.md$/i, "") ||
                    note.replace(/\.md$/i, "");
                Logger.debug(
                    `[DATACORE QUERY] Note exclusion: childof(@page and $name = "${fileName}")`,
                );
                queryParts.push(`!childof(@page and $name = "${fileName}")`);
            }
        }

        // Exclude note-level tags (tasks in pages with these tags)
        if (
            settings.exclusions.noteTags &&
            settings.exclusions.noteTags.length > 0
        ) {
            Logger.debug(
                `[DATACORE QUERY] Excluding note tags: ${settings.exclusions.noteTags.join(", ")}`,
            );
            for (const tag of settings.exclusions.noteTags) {
                const normalizedTag = tag.replace(/^#+/, "");
                queryParts.push(`!childof(@page and #${normalizedTag})`);
            }
        }

        // Exclude task-level tags (tasks with these tags)
        if (
            settings.exclusions.taskTags &&
            settings.exclusions.taskTags.length > 0
        ) {
            Logger.debug(
                `[DATACORE QUERY] Excluding task tags: ${settings.exclusions.taskTags.join(", ")}`,
            );
            for (const tag of settings.exclusions.taskTags) {
                const normalizedTag = tag.replace(/^#+/, "");
                queryParts.push(`!#${normalizedTag}`);
            }
        }

        // ========================================
        // INCLUSIONS (OR logic - at least one must match)
        // ========================================

        const inclusionConditions: string[] = [];

        // Include folders
        if (inclusionFilters?.folders && inclusionFilters.folders.length > 0) {
            Logger.debug(
                `[DATACORE QUERY] Including folders: ${inclusionFilters.folders.join(", ")}`,
            );
            for (const folder of inclusionFilters.folders) {
                inclusionConditions.push(`path("${folder}")`);
            }
        }

        // Include specific notes (tasks in these specific pages)
        if (inclusionFilters?.notes && inclusionFilters.notes.length > 0) {
            Logger.debug(
                `[DATACORE QUERY] Including notes: ${inclusionFilters.notes.join(", ")}`,
            );
            for (const note of inclusionFilters.notes) {
                // Extract just the filename without path or extension
                // Datacore uses $name which is the filename only (no path, no extension)
                const fileName =
                    note.split("/").pop()?.replace(/\.md$/i, "") ||
                    note.replace(/\.md$/i, "");
                const condition = `childof(@page and $name = "${fileName}")`;
                Logger.debug(`[DATACORE QUERY] Note inclusion: ${condition}`);
                inclusionConditions.push(condition);
            }
        }

        // Include note-level tags (tasks in pages with these tags)
        if (
            inclusionFilters?.noteTags &&
            inclusionFilters.noteTags.length > 0
        ) {
            Logger.debug(
                `[DATACORE QUERY] Including note tags: ${inclusionFilters.noteTags.join(", ")}`,
            );
            for (const tag of inclusionFilters.noteTags) {
                const normalizedTag = tag.replace(/^#+/, "");
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
            Logger.debug(
                `[DATACORE QUERY] Including task tags: ${inclusionFilters.taskTags.join(", ")}`,
            );
            for (const tag of inclusionFilters.taskTags) {
                const normalizedTag = tag.replace(/^#+/, "");
                inclusionConditions.push(`#${normalizedTag}`);
            }
        }

        // Add inclusion conditions with OR logic
        if (inclusionConditions.length > 0) {
            const inclusionQuery = inclusionConditions.join(" or ");
            queryParts.push(`(${inclusionQuery})`);
            Logger.debug(
                `[DATACORE QUERY] Inclusion OR group: (${inclusionQuery})`,
            );
        }

        const query = queryParts.join(" and ");

        Logger.debug(`[DATACORE QUERY] Final query: ${query}`);
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

        // DIAGNOSTIC: Check Datacore API health
        Logger.debug(
            `[DATACORE API CHECK] API object exists: ${!!datacoreApi}`,
        );
        Logger.debug(
            `[DATACORE API CHECK] Top-level keys: ${Object.keys(datacoreApi).join(", ")}`,
        );
        Logger.debug(
            `[DATACORE API CHECK] query method type: ${typeof datacoreApi.query}`,
        );

        // Check if API is nested
        if (datacoreApi.api) {
            Logger.debug(
                `[DATACORE API CHECK] Found nested .api object with keys: ${Object.keys(datacoreApi.api).join(", ")}`,
            );
        }
        if (datacoreApi.core) {
            Logger.debug(
                `[DATACORE API CHECK] Found .core object with keys: ${Object.keys(datacoreApi.core).join(", ")}`,
            );
        }

        // Check window.datacore structure
        const windowDc = (window as any).datacore;
        if (windowDc) {
            Logger.debug(
                `[DATACORE API CHECK] window.datacore keys: ${Object.keys(windowDc).join(", ")}`,
            );
            if (windowDc.api) {
                Logger.debug(
                    `[DATACORE API CHECK] window.datacore.api keys: ${Object.keys(windowDc.api).join(", ")}`,
                );
                Logger.debug(
                    `[DATACORE API CHECK] window.datacore.api.query type: ${typeof windowDc.api.query}`,
                );
            }
        }

        // Check plugin API
        const datacorePlugin = (app as any).plugins?.plugins?.datacore;
        if (datacorePlugin) {
            Logger.debug(`[DATACORE API CHECK] Found datacore plugin object`);
            Logger.debug(
                `[DATACORE API CHECK] Plugin keys: ${Object.keys(datacorePlugin).join(", ")}`,
            );

            // Check initialization status - THIS IS KEY!
            if (datacorePlugin.core) {
                Logger.debug(
                    `[DATACORE API CHECK] ⚠️  Plugin.core.initialized: ${datacorePlugin.core.initialized}`,
                );
                Logger.debug(
                    `[DATACORE API CHECK] Plugin.core._loaded: ${datacorePlugin.core._loaded}`,
                );

                // Check datastore for indexed data
                if (datacorePlugin.core.datastore) {
                    const ds = datacorePlugin.core.datastore;
                    Logger.debug(
                        `[DATACORE API CHECK] Datastore exists, checking index...`,
                    );
                    try {
                        // Try to access indexed data
                        if (ds.pages) {
                            Logger.debug(
                                `[DATACORE API CHECK] Datastore.pages type: ${typeof ds.pages}`,
                            );
                            if (ds.pages.size !== undefined) {
                                Logger.debug(
                                    `[DATACORE API CHECK] ⚠️  Datastore has ${ds.pages.size} pages indexed`,
                                );
                            }
                        }
                    } catch (e) {
                        Logger.debug(
                            `[DATACORE API CHECK] Could not check datastore pages:`,
                            e,
                        );
                    }
                }
            }

            if (datacorePlugin.api) {
                Logger.debug(
                    `[DATACORE API CHECK] Plugin has .api with keys: ${Object.keys(datacorePlugin.api).join(", ")}`,
                );
            }
        }

        // Test if basic query works
        try {
            Logger.debug(`[DATACORE API CHECK] Testing basic @task query...`);
            const testQuery = "@task";
            const testResults = await datacoreApi.query(testQuery);
            Logger.debug(
                `[DATACORE API CHECK] Basic @task returned: ${testResults?.length || 0} tasks`,
            );
            Logger.debug(
                `[DATACORE API CHECK] Result is array: ${Array.isArray(testResults)}`,
            );
            if (testResults && testResults.length > 0) {
                const sample = testResults[0];
                Logger.debug(
                    `[DATACORE API CHECK] Sample task keys: ${Object.keys(sample).join(", ")}`,
                );
                Logger.debug(
                    `[DATACORE API CHECK] Sample $file: ${sample.$file || sample.file}`,
                );
            }

            // Try alternate API access if window.datacore.api exists
            if (windowDc?.api?.query) {
                Logger.debug(
                    `[DATACORE API CHECK] Testing via window.datacore.api.query...`,
                );
                const apiResults = await windowDc.api.query(testQuery);
                Logger.debug(
                    `[DATACORE API CHECK] window.datacore.api.query returned: ${apiResults?.length || 0} tasks`,
                );
            }

            // Try plugin API if available
            if (datacorePlugin?.api?.query) {
                Logger.debug(
                    `[DATACORE API CHECK] Testing via plugin.api.query...`,
                );
                const pluginResults = await datacorePlugin.api.query(testQuery);
                Logger.debug(
                    `[DATACORE API CHECK] plugin.api.query returned: ${pluginResults?.length || 0} tasks`,
                );
            }

            // Check for useQuery method (user's suggestion!)
            Logger.debug(
                `[DATACORE API CHECK] Checking for useQuery method...`,
            );
            Logger.debug(
                `[DATACORE API CHECK] datacoreApi.useQuery type: ${typeof datacoreApi.useQuery}`,
            );
            if (typeof datacoreApi.useQuery === "function") {
                Logger.debug(
                    `[DATACORE API CHECK] Testing dc.useQuery() instead...`,
                );
                const useQueryResults = datacoreApi.useQuery(testQuery);
                Logger.debug(
                    `[DATACORE API CHECK] dc.useQuery returned type: ${typeof useQueryResults}`,
                );
                Logger.debug(
                    `[DATACORE API CHECK] dc.useQuery result: ${useQueryResults?.length || 0} items`,
                );
            }

            // Check window.datacore.api.useQuery
            if (windowDc?.api?.useQuery) {
                Logger.debug(
                    `[DATACORE API CHECK] Testing window.datacore.api.useQuery...`,
                );
                const apiUseQueryResults = windowDc.api.useQuery(testQuery);
                Logger.debug(
                    `[DATACORE API CHECK] window.datacore.api.useQuery returned: ${apiUseQueryResults?.length || 0} items`,
                );
            }

            // Check plugin.api.useQuery
            if (datacorePlugin?.api?.useQuery) {
                Logger.debug(
                    `[DATACORE API CHECK] Testing plugin.api.useQuery...`,
                );
                const pluginUseQueryResults =
                    datacorePlugin.api.useQuery(testQuery);
                Logger.debug(
                    `[DATACORE API CHECK] plugin.api.useQuery returned: ${pluginUseQueryResults?.length || 0} items`,
                );
            }
        } catch (apiError) {
            Logger.error(`[DATACORE API CHECK] API query failed:`, apiError);
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
                `[DATACORE RESULTS] Query returned: ${results?.length || 0} results`,
            );

            // If note tag filter returns 0, verify the tag exists in the vault
            if (
                (!results || results.length === 0) &&
                inclusionFilters?.noteTags &&
                inclusionFilters.noteTags.length > 0
            ) {
                try {
                    const testTag = inclusionFilters.noteTags[0].replace(
                        /^#+/,
                        "",
                    );
                    const pageCheckQuery = `@page and #${testTag}`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Testing if pages with tag exist: ${pageCheckQuery}`,
                    );
                    const pagesWithTag =
                        await datacoreApi.query(pageCheckQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Found ${pagesWithTag?.length || 0} pages with tag #${testTag}`,
                    );
                    if (pagesWithTag && pagesWithTag.length > 0) {
                        const samplePage = pagesWithTag[0];
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Sample page: ${samplePage.$file || samplePage.file}\n` +
                                `  Tags: ${JSON.stringify(samplePage.$tags || [])}`,
                        );
                    }
                } catch (testError) {
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Failed to test page query:`,
                        testError,
                    );
                }
            }

            // If note filter returns 0, verify the page exists and test different query formats
            if (
                (!results || results.length === 0) &&
                inclusionFilters?.notes &&
                inclusionFilters.notes.length > 0
            ) {
                try {
                    const testNote = inclusionFilters.notes[0];
                    const notePathNoExt = testNote.replace(/\.md$/i, "");

                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Testing note filter for: ${testNote}`,
                    );

                    // Test 1: Does the page exist?
                    const pageQuery = `@page and path("${notePathNoExt}")`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 1 - Check if page exists: ${pageQuery}`,
                    );
                    const pageExists = await datacoreApi.query(pageQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Page exists: ${pageExists?.length > 0 ? "YES" : "NO"} (${pageExists?.length || 0} matches)`,
                    );
                    if (pageExists && pageExists.length > 0) {
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Page path in Datacore: ${pageExists[0].$file || pageExists[0].file}`,
                        );
                    }

                    // Test 2: Try path() directly on @task
                    const directPathQuery = `@task and path("${notePathNoExt}")`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 2 - Direct path on @task: ${directPathQuery}`,
                    );
                    const directPathResults =
                        await datacoreApi.query(directPathQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Direct path returned: ${directPathResults?.length || 0} tasks`,
                    );

                    // Test 3: Try with .md extension
                    const withExtQuery = `@task and path("${testNote}")`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 3 - With .md extension: ${withExtQuery}`,
                    );
                    const withExtResults =
                        await datacoreApi.query(withExtQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] With extension returned: ${withExtResults?.length || 0} tasks`,
                    );

                    // Test 4: Try childof with @page
                    const childofQuery = `@task and childof(@page and path("${notePathNoExt}"))`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 4 - childof(@page): ${childofQuery}`,
                    );
                    const childofResults =
                        await datacoreApi.query(childofQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] childof returned: ${childofResults?.length || 0} tasks`,
                    );

                    // Test 5: Try using $file property
                    const fileQuery = `@page and $file = "${notePathNoExt}"`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 5 - Using $file: ${fileQuery}`,
                    );
                    const fileResults = await datacoreApi.query(fileQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] $file returned: ${fileResults?.length || 0} pages`,
                    );

                    // Test 6: Try using $name property (your suggestion!)
                    const fileName =
                        notePathNoExt.split("/").pop() || notePathNoExt;
                    const nameQuery = `@page and $name = "${fileName}"`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 6 - Using $name: ${nameQuery}`,
                    );
                    const nameResults = await datacoreApi.query(nameQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] $name returned: ${nameResults?.length || 0} pages`,
                    );
                    if (nameResults && nameResults.length > 0) {
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Found page with $name! Path: ${nameResults[0].$file || nameResults[0].file}`,
                        );

                        // Test 6a: If $name works, try it with childof on tasks
                        const nameChildofQuery = `@task and childof(@page and $name = "${fileName}")`;
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Test 6a - childof with $name: ${nameChildofQuery}`,
                        );
                        const nameChildofResults =
                            await datacoreApi.query(nameChildofQuery);
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] childof($name) returned: ${nameChildofResults?.length || 0} tasks`,
                        );
                    }

                    // Test 7: Try $file with full path including extension
                    const fileExtQuery = `@page and $file = "${testNote}"`;
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 7 - Using $file with .md: ${fileExtQuery}`,
                    );
                    const fileExtResults =
                        await datacoreApi.query(fileExtQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] $file (with .md) returned: ${fileExtResults?.length || 0} pages`,
                    );

                    // Test 8: Just query all pages to see the format
                    const allPagesQuery = "@page";
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 8 - Getting all pages to see path format`,
                    );
                    const allPages = await datacoreApi.query(allPagesQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] @page returned: ${allPages?.length || 0} total pages`,
                    );
                    if (allPages && allPages.length > 0) {
                        const taskChatPages = allPages.filter((p: any) =>
                            (p.$file || p.file || "").includes("Task Chat"),
                        );
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Found ${taskChatPages.length} pages in "Task Chat" folder`,
                        );
                        if (taskChatPages.length > 0) {
                            Logger.debug(
                                `[DATACORE DIAGNOSTICS] Sample pages in "Task Chat" folder:`,
                            );
                            taskChatPages.slice(0, 3).forEach((p: any) => {
                                Logger.debug(
                                    `  - $file: "${p.$file || p.file}", $name: "${p.$name || p.name}"`,
                                );
                            });
                        }
                    }

                    // Test 9: Try path() with just filename + .md (user's suggestion!)
                    const justFileName = testNote.split("/").pop() || testNote;
                    if (justFileName !== testNote) {
                        const filenameQuery = `@task and path("${justFileName}")`;
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Test 9 - Just filename: ${filenameQuery}`,
                        );
                        const filenameResults =
                            await datacoreApi.query(filenameQuery);
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Just filename returned: ${filenameResults?.length || 0} tasks`,
                        );
                    }

                    // Test 10: Get all tasks and check actual file paths
                    const allTasksQuery = "@task";
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Test 10 - Getting all tasks to check paths`,
                    );
                    const allTasks = await datacoreApi.query(allTasksQuery);
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] @task returned: ${allTasks?.length || 0} total tasks`,
                    );
                    if (allTasks && allTasks.length > 0) {
                        const tasksInFile = allTasks.filter((t: any) =>
                            (t.$file || t.file || "").includes(
                                "Test Task Chat",
                            ),
                        );
                        Logger.debug(
                            `[DATACORE DIAGNOSTICS] Found ${tasksInFile.length} tasks with "Test Task Chat" in path`,
                        );
                        if (tasksInFile.length > 0) {
                            Logger.debug(
                                `[DATACORE DIAGNOSTICS] Sample task file path: "${tasksInFile[0].$file || tasksInFile[0].file}"`,
                            );
                        }
                    }
                } catch (testError) {
                    Logger.debug(
                        `[DATACORE DIAGNOSTICS] Failed to test note queries:`,
                        testError,
                    );
                }
            }

            if (!results || results.length === 0) {
                Logger.debug(
                    `[DATACORE RESULTS] No results returned from query. This could mean:
  1. The query syntax is incorrect
  2. No tasks match the filters
  3. The inclusion filters are too restrictive`,
                );
                return tasks;
            }

            // Log sample file paths from results to help debug path/tag filtering
            const samplePaths = results
                .slice(0, 5)
                .map((r: any) => r.$file || r.file || "unknown");
            Logger.debug(
                `[DATACORE RESULTS] Sample file paths from results:\n  ${samplePaths.join("\n  ")}`,
            );

            // Sample first few results to understand structure
            if (results.length > 0 && settings.enableDebugLogging) {
                const sample = results[0];
                Logger.debug(
                    `[DATACORE RESULTS] Sample result structure:\n` +
                        `  Keys: ${Object.keys(sample)
                            .filter((k) => k.startsWith("$"))
                            .join(", ")}\n` +
                        `  $type: ${sample.$type}\n` +
                        `  $status: ${sample.$status}\n` +
                        `  $completed: ${sample.$completed}\n` +
                        `  $file: ${sample.$file}\n` +
                        `  $tags: ${JSON.stringify(sample.$tags || [])}\n` +
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
            // Note: Use @page for Datacore (not FROM "" which is Dataview syntax)
            try {
                const pagesQuery = "@page";
                const pages = await datacoreApi.query(pagesQuery);
                Logger.debug(
                    `[DATACORE PAGE TAGS] Queried @page, got ${pages?.length || 0} pages`,
                );

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
                        `[DATACORE PAGE TAGS] Fetched note tags for ${pageTagsMap.size} pages (out of ${uniquePaths.size} pages with tasks)`,
                    );

                    // Log sample page tags to help debug
                    const sampleEntries = Array.from(
                        pageTagsMap.entries(),
                    ).slice(0, 3);
                    if (sampleEntries.length > 0) {
                        Logger.debug(
                            `[DATACORE PAGE TAGS] Sample page tags:\n${sampleEntries
                                .map(
                                    ([path, tags]) =>
                                        `  ${path}: [${tags.join(", ")}]`,
                                )
                                .join("\n")}`,
                        );
                    }
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

            for (const dcTask of allTasks) {
                // Use $file per API docs (not $path)
                const taskPath = dcTask.$file || dcTask.file || "";

                // NOTE: We do NOT filter out completed tasks here
                // The scoring system handles prioritizing incomplete tasks over completed ones
                // Users can explicitly filter by status if they want

                // ========================================
                // POST-QUERY FILTERING
                // ========================================
                // NOTE: All source-level filters (folders, notes, note tags, task tags)
                // are now handled at query level with correct OR/AND logic.
                // Only task properties (due, priority, status) need post-query filtering.

                // Apply task property filters (due date, priority, status)
                // These use AND logic - all specified properties must match
                const shouldInclude = !taskFilter || taskFilter(dcTask);
                if (!shouldInclude) {
                    propertyFilterRejects++;
                    continue;
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
                `Datacore filtering stats: ${allTasks.length} total tasks -> ${tasks.length} final (property filters rejected: ${propertyFilterRejects})`,
            );
        } catch (error) {
            Logger.error("Error querying Datacore:", error);
        }

        return tasks;
    }
}
