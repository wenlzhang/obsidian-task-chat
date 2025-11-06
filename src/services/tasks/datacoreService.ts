import { App } from "obsidian";
import { Task, TaskStatusCategory, DateRange } from "../../models/task";
import { PluginSettings } from "../../settings";
import { TaskPropertyService } from "./taskPropertyService";
import { TaskFilterService } from "./taskFilterService";
import { TaskSearchService } from "./taskSearchService";
import { TaskSortService } from "./taskSortService";
import { Logger } from "../../utils/logger";
import { VectorizedScoring } from "../../utils/vectorizedScoring";
import {
    processInChunks,
    PerformanceTimer,
} from "../../utils/chunkedProcessing";
import { CHUNK_SIZES, SMART_EARLY_LIMIT } from "../../utils/constants";

/**
 * Moment.js instance type (from window.moment)
 */
interface MomentInstance {
    format(_format: string): string;
    add(_amount: number, _unit: string): MomentInstance;
    subtract(_amount: number, _unit: string): MomentInstance;
    startOf(_unit: string): MomentInstance;
    endOf(_unit: string): MomentInstance;
    isValid(): boolean;
}

/**
 * Moment.js function type (callable function that returns a Moment instance)
 */
type MomentFn = {
    (): MomentInstance;
    (_date?: string | Date | number): MomentInstance;
};

/**
 * Datacore API interface
 */
interface DatacoreAPI {
    query(_query: string): Promise<DatacoreTask[]>;
}

/**
 * Global window extensions for Obsidian plugins
 */
interface WindowWithPlugins extends Window {
    datacore?: DatacoreAPI;
    moment?: MomentFn;
}

declare const window: WindowWithPlugins;

/**
 * Generic Datacore task type (raw format from Datacore API)
 */
interface DatacoreTask {
    $text?: string;
    text?: string;
    due?: unknown;
    $due?: unknown;
    priority?: unknown;
    status?: unknown;
    completed?: unknown;
    $completed?: unknown;
    path?: string;
    $path?: string;
    file?: { path?: string };
    $file?: { path?: string };
    tags?: string[];
    $tags?: string[];
    _mappedPriority?: number;
    _mappedStatus?: TaskStatusCategory;
    [key: string]: unknown;
}

/**
 * Service for integrating with Datacore plugin to fetch tasks
 * Datacore is the successor to Dataview with 2-10x better performance
 *
 * Architecture uses consistent patterns across the codebase
 */
export class DatacoreService {
    /**
     * Valid priority values (P1-P4)
     */
    private static readonly VALID_PRIORITIES = [1, 2, 3, 4] as const;

    /**
     * Add date range filter to query parts
     * Uses configured due date field name from settings.datacoreKeys.dueDate
     */
    private static addDateRangeFilter(
        queryParts: string[],
        settings: PluginSettings,
        dueDateRange?: DateRange | null,
    ): void {
        if (!dueDateRange) return;

        const { start, end } = dueDateRange;
        // Use configured due date field name (e.g., "due", "dueDate", etc.)
        const dueDateField: string = String(settings.datacoreKeys.dueDate);

        if (start) {
            const startDate = TaskPropertyService.parseDateRangeKeyword(start);
            if (
                startDate &&
                typeof startDate === "object" &&
                "format" in startDate
            ) {
                const startStr: string = (startDate as MomentInstance).format(
                    "YYYY-MM-DD",
                );
                queryParts.push(`${dueDateField} >= date("${startStr}")`);
                Logger.debug(
                    `[Query Builder] Due date (${dueDateField}) >= ${startStr}`,
                );
            }
        }

        if (end) {
            const endDate = TaskPropertyService.parseDateRangeKeyword(end);
            if (endDate && typeof endDate === "object" && "format" in endDate) {
                const endStr: string = (endDate as MomentInstance).format(
                    "YYYY-MM-DD",
                );
                queryParts.push(`${dueDateField} <= date("${endStr}")`);
                Logger.debug(
                    `[Query Builder] Due date (${dueDateField}) <= ${endStr}`,
                );
            }
        }
    }

    /**
     * Convert date keyword to Datacore query condition
     * Uses existing TaskPropertyService.DUE_DATE_KEYWORDS for consistency
     * Delegates date calculations to centralized logic
     */
    private static convertDateKeywordToQuery(
        dateKeyword: string,
        dueDateField: string,
    ): string | null {
        const moment = window.moment;
        if (!moment) {
            Logger.warn(
                "[Datacore] window.moment is not available, cannot convert date keywords",
            );
            return null;
        }
        const K = TaskPropertyService.DUE_DATE_KEYWORDS; // Alias for brevity

        // Map keyword to Datacore query using centralized constants
        const keywordMap: Record<string, () => string> = {
            [K.today]: () =>
                `${dueDateField} = date("${moment().format("YYYY-MM-DD")}")`,
            [K.tomorrow]: () =>
                `${dueDateField} = date("${moment().add(1, "day").format("YYYY-MM-DD")}")`,
            [K.yesterday]: () =>
                `${dueDateField} = date("${moment().subtract(1, "day").format("YYYY-MM-DD")}")`,
            [K.overdue]: () =>
                `${dueDateField} < date("${moment().format("YYYY-MM-DD")}")`,
            [K.future]: () =>
                `${dueDateField} > date("${moment().format("YYYY-MM-DD")}")`,
            [K.week]: () => {
                const start = moment().startOf("week").format("YYYY-MM-DD");
                const end = moment().endOf("week").format("YYYY-MM-DD");
                return `${dueDateField} >= date("${start}") and ${dueDateField} <= date("${end}")`;
            },
            [K.lastWeek]: () => {
                const start = moment()
                    .subtract(1, "week")
                    .startOf("week")
                    .format("YYYY-MM-DD");
                const end = moment()
                    .subtract(1, "week")
                    .endOf("week")
                    .format("YYYY-MM-DD");
                return `${dueDateField} >= date("${start}") and ${dueDateField} <= date("${end}")`;
            },
            [K.nextWeek]: () => {
                const start = moment()
                    .add(1, "week")
                    .startOf("week")
                    .format("YYYY-MM-DD");
                const end = moment()
                    .add(1, "week")
                    .endOf("week")
                    .format("YYYY-MM-DD");
                return `${dueDateField} >= date("${start}") and ${dueDateField} <= date("${end}")`;
            },
            [K.month]: () => {
                const start = moment().startOf("month").format("YYYY-MM-DD");
                const end = moment().endOf("month").format("YYYY-MM-DD");
                return `${dueDateField} >= date("${start}") and ${dueDateField} <= date("${end}")`;
            },
            [K.lastMonth]: () => {
                const start = moment()
                    .subtract(1, "month")
                    .startOf("month")
                    .format("YYYY-MM-DD");
                const end = moment()
                    .subtract(1, "month")
                    .endOf("month")
                    .format("YYYY-MM-DD");
                return `${dueDateField} >= date("${start}") and ${dueDateField} <= date("${end}")`;
            },
            [K.nextMonth]: () => {
                const start = moment()
                    .add(1, "month")
                    .startOf("month")
                    .format("YYYY-MM-DD");
                const end = moment()
                    .add(1, "month")
                    .endOf("month")
                    .format("YYYY-MM-DD");
                return `${dueDateField} >= date("${start}") and ${dueDateField} <= date("${end}")`;
            },
        };

        // Check if keyword exists in map
        if (keywordMap[dateKeyword]) {
            return keywordMap[dateKeyword]();
        }

        // Fallback: Try relative date parsing (1d, 2w, etc.) using existing service
        const parsedRelative =
            TaskPropertyService.parseRelativeDate(dateKeyword);
        if (parsedRelative) {
            return `${dueDateField} = date("${parsedRelative}")`;
        }

        // Fallback: Try exact date parsing
        const parsed = moment(dateKeyword);
        if (parsed.isValid()) {
            return `${dueDateField} = date("${parsed.format("YYYY-MM-DD")}")`;
        }

        return null;
    }

    /**
     * Add simple due date filter to query parts
     * Converts extracted date keywords to Datacore query conditions
     * Uses existing TaskPropertyService extraction methods and constants
     */
    private static addSimpleDueDateFilter(
        queryParts: string[],
        settings: PluginSettings,
        dueDate?: string | string[] | null,
    ): void {
        if (!dueDate) return;

        const dueDateField = settings.datacoreKeys.dueDate;
        const dueDateValues = Array.isArray(dueDate) ? dueDate : [dueDate];
        const conditions: string[] = [];

        for (const dateValue of dueDateValues) {
            // Check for special filter keywords using centralized constants
            if (
                dateValue ===
                    TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.all ||
                dateValue === TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.any
            ) {
                conditions.push(`${dueDateField}`);
                continue;
            }

            if (
                dateValue === TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.none
            ) {
                queryParts.push(`!${dueDateField}`);
                Logger.debug(
                    `[Query Builder] Due date filter (${dueDateField}): none`,
                );
                return;
            }

            // Convert using centralized conversion method
            const dateCondition = this.convertDateKeywordToQuery(
                dateValue,
                dueDateField,
            );
            if (dateCondition) {
                conditions.push(dateCondition);
            }
        }

        if (conditions.length > 0) {
            const combinedCondition =
                conditions.length === 1
                    ? conditions[0]
                    : `(${conditions.join(" or ")})`;
            queryParts.push(combinedCondition);
            Logger.debug(
                `[Query Builder] Due date filter (${dueDateField}): ${dueDateValues.join(", ")}`,
            );
        }
    }

    /**
     * Add priority filter to query parts
     * Uses configured priority field name from settings.datacoreKeys.priority
     */
    private static addPriorityFilter(
        queryParts: string[],
        settings: PluginSettings,
        priority?: number | number[] | "all" | "any" | "none" | null,
    ): void {
        if (priority === undefined || priority === null) return;

        // Use configured priority field name (e.g., "p", "priority", etc.)
        const priorityField = settings.datacoreKeys.priority;

        // Helper to build OR condition from priority array
        const buildPriorityCondition = (priorities: readonly number[]) =>
            priorities.map((p) => `${priorityField} = ${p}`).join(" or ");

        // Handle special keywords
        if (
            priority === TaskPropertyService.PRIORITY_FILTER_KEYWORDS.all ||
            priority === TaskPropertyService.PRIORITY_FILTER_KEYWORDS.any
        ) {
            // Tasks with any priority (P1-P4)
            queryParts.push(
                `(${buildPriorityCondition(this.VALID_PRIORITIES)})`,
            );
        } else if (
            priority === TaskPropertyService.PRIORITY_FILTER_KEYWORDS.none
        ) {
            // Tasks with no priority
            queryParts.push(`!${priorityField}`);
        } else if (Array.isArray(priority)) {
            // Multiple specific priorities - filter out invalid values
            const validPriorities = priority.filter((p): p is 1 | 2 | 3 | 4 =>
                (this.VALID_PRIORITIES as readonly number[]).includes(p),
            );
            if (validPriorities.length > 0) {
                queryParts.push(`(${buildPriorityCondition(validPriorities)})`);
            }
        } else {
            // Single specific priority
            queryParts.push(`${priorityField} = ${priority}`);
        }

        const priorityStr = Array.isArray(priority)
            ? priority.join(", ")
            : String(priority);
        Logger.debug(
            `[Query Builder] Priority filter (${priorityField}): ${priorityStr}`,
        );
    }

    /**
     * Add status filter to query parts
     * Supports both inclusion (statusValues) and exclusion (statusExclusions) filters
     */
    private static addStatusFilter(
        queryParts: string[],
        statusValues?: string[] | null,
        statusExclusions?: string[] | null,
    ): void {
        // Handle inclusion filter (include specific symbols)
        if (statusValues && statusValues.length > 0) {
            // Build OR condition from status symbols
            const statusConditions = statusValues
                .map((symbol) => `$status = "${symbol}"`)
                .join(" or ");

            queryParts.push(`(${statusConditions})`);
            Logger.debug(
                `[Query Builder] Status filter (include): ${statusValues.join(", ")}`,
            );
        }

        // Handle exclusion filter (exclude defined symbols - for "other" category)
        if (statusExclusions && statusExclusions.length > 0) {
            // Build exclusion condition: NOT (symbol1 OR symbol2 OR ...)
            const exclusionConditions = statusExclusions
                .map((symbol) => `$status = "${symbol}"`)
                .join(" or ");

            queryParts.push(`!(${exclusionConditions})`);
            Logger.debug(
                `[Query Builder] Status filter (exclude): ${statusExclusions.join(", ")}`,
            );
        }
    }

    /**
     * Check if Datacore plugin is enabled and available
     */
    static isDatacoreEnabled(): boolean {
        const dc = window.datacore;

        // Debug logging to help diagnose issues
        if (dc === undefined) {
            Logger.debug(
                "[Datacore] window.datacore is undefined - Datacore plugin not loaded",
            );
            return false;
        }

        if (typeof dc.query !== "function") {
            Logger.warn(
                `[Datacore] window.datacore exists but query is not a function. Type: ${typeof dc.query}`,
            );
            Logger.debug("[Datacore] Available properties:", Object.keys(dc));
            return false;
        }

        Logger.debug("[Datacore] Plugin detected and available");
        return true;
    }

    /**
     * Generate a stable identifier for a Datacore task.
     * Used for score caching so we can reuse quality/relevance calculations between passes.
     */
    private static getTaskId(dcTask: DatacoreTask): string {
        const rawPath = dcTask?.$file || dcTask?.file || "";
        const path: string =
            typeof rawPath === "string"
                ? rawPath
                : typeof rawPath === "object" &&
                    rawPath !== null &&
                    "path" in rawPath &&
                    typeof rawPath.path === "string"
                  ? rawPath.path
                  : "";
        const rawLine = dcTask?.$line ?? dcTask?.line;
        const line: number = typeof rawLine === "number" ? rawLine : 0;
        const rawText = dcTask?.$text || dcTask?.text;
        const textSnippet: string = typeof rawText === "string" ? rawText : "";
        return `${path}:${line}:${textSnippet}`;
    }

    /**
     * Get Datacore API
     */
    static getAPI(): DatacoreAPI | null {
        if (!this.isDatacoreEnabled()) {
            return null;
        }

        return window.datacore ?? null;
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
        value: unknown,
        settings: PluginSettings,
    ): number | undefined {
        return TaskPropertyService.mapPriority(value, settings);
    }

    /**
     * Format date to consistent string format
     * Delegates to TaskPropertyService for consistent behavior
     */
    static formatDate(date: unknown, format?: string): string | undefined {
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
        dcTask: DatacoreTask,
        fieldKey: string,
        text: string,
        settings: PluginSettings,
    ): unknown {
        // Delegate to unified extraction method in TaskPropertyService
        return TaskPropertyService.getUnifiedFieldValue(
            dcTask,
            fieldKey,
            text,
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
    private static isValidTask(task: DatacoreTask): boolean {
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
        dcTask: DatacoreTask,
        settings: PluginSettings,
        index: number,
        filePath = "",
    ): Task | null {
        if (!this.isValidTask(dcTask)) {
            return null;
        }

        // Extract path (use $file per API docs)
        const rawPath = filePath || dcTask.$file || dcTask.file || "";
        const path: string =
            typeof rawPath === "string"
                ? rawPath
                : typeof rawPath === "object" &&
                    rawPath !== null &&
                    "path" in rawPath &&
                    typeof rawPath.path === "string"
                  ? rawPath.path
                  : "";

        // Use $text for task text (Datacore's built-in field)
        const rawText = dcTask.$text || dcTask.text;
        const text: string = typeof rawText === "string" ? rawText : "";
        // Use $status for task status marker (not $symbol)
        const rawStatus = dcTask.$status || dcTask.status;
        const status: string = typeof rawStatus === "string" ? rawStatus : "";
        const rawLine = dcTask.$line ?? dcTask.line;
        const line: number = typeof rawLine === "number" ? rawLine : 0;
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
                settings.datacoreKeys.createdDate,
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
                settings.datacoreKeys.completedDate,
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
            // noteTags removed - not needed (filtering happens at DataCore query level, not displayed in UI)
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
     * - TASK PROPERTIES (due, priority, status): IN QUERY with AND logic
     *
     * DATACORE SYNTAX:
     * - @task - matches all tasks
     * - path("folder") - matches files in folder (FOLDERS only)
     * - childof(@page and path("Note")) - matches tasks in specific page (NOTES)
     * - childof(@page and #tag) - matches tasks in pages with tag (NOTE TAGS)
     * - #tag - matches tasks with tag (TASK TAGS)
     * - $due, $priority, $status - task properties
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
     * and $due >= date("2025-01-01") and $due <= date("2025-12-31")
     * and $priority = 1
     * and $status != "x"
     */
    private static buildDatacoreQuery(
        settings: PluginSettings,
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
        propertyFilters?: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: DateRange | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
            statusExclusions?: string[] | null; // For "other" category - excludes defined symbols
        },
    ): string {
        const queryParts: string[] = ["@task"];

        // ========================================
        // STATUS VALUE TO SYMBOL CONVERSION
        // Convert status values (categories, aliases, or direct symbols) to symbols
        // Uses centralized TaskPropertyService.resolveStatusValuesToSymbols()
        // Handles mixed searches like "s:open,b" or "s:important"
        // ========================================
        let resolvedPropertyFilters = propertyFilters;
        if (
            propertyFilters?.status &&
            !propertyFilters?.statusValues &&
            !propertyFilters?.statusExclusions
        ) {
            // Convert status values to symbols using centralized method
            const statusValues = Array.isArray(propertyFilters.status)
                ? propertyFilters.status
                : [propertyFilters.status];

            Logger.debug(
                `[Query Builder] Converting status values to symbols: [${statusValues.join(", ")}]`,
            );

            const resolvedSymbols =
                TaskPropertyService.resolveStatusValuesToSymbols(
                    statusValues,
                    settings,
                );

            Logger.debug(
                `[Query Builder] Resolved symbols: [${resolvedSymbols.join(", ")}]`,
            );

            // Create new propertyFilters with resolved symbols
            resolvedPropertyFilters = {
                ...propertyFilters,
                statusValues: resolvedSymbols,
            };
        }

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

        // Exclude completed tasks (if hideCompletedTasks is enabled)
        // This provides a massive performance boost in large vaults by filtering out
        // completed tasks at the Datacore query level (before Task object creation)
        // Excludes ALL symbols mapped to the "completed" category, not just $completed
        if (settings.hideCompletedTasks) {
            const completedCategory = settings.taskStatusMapping?.completed;
            if (completedCategory && completedCategory.symbols.length > 0) {
                // Build exclusion for all completed symbols
                // Example: !($status = "x" or $status = "X")
                const completedExclusions = completedCategory.symbols
                    .map((symbol) => `$status = "${symbol}"`)
                    .join(" or ");
                queryParts.push(`!(${completedExclusions})`);
                Logger.debug(
                    `Excluding completed category symbols: ${completedCategory.symbols.join(", ")}`,
                );
            } else {
                // Fallback to $completed if category not configured
                queryParts.push("!$completed");
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

        // ========================================
        // PROPERTY FILTERS (AND logic - all applied)
        // Filter by task properties directly in Datacore query for performance
        // ========================================

        if (resolvedPropertyFilters) {
            // Simple Due Date Filter (today, overdue, tomorrow, etc.)
            this.addSimpleDueDateFilter(
                queryParts,
                settings,
                resolvedPropertyFilters.dueDate,
            );

            // Due Date Range Filter (from X to Y)
            this.addDateRangeFilter(
                queryParts,
                settings,
                resolvedPropertyFilters.dueDateRange,
            );

            // Priority Filter
            this.addPriorityFilter(
                queryParts,
                settings,
                resolvedPropertyFilters.priority,
            );

            // Status Filter (supports both inclusion and exclusion)
            // Uses statusValues (symbols) converted from status (categories)
            this.addStatusFilter(
                queryParts,
                resolvedPropertyFilters.statusValues,
                resolvedPropertyFilters.statusExclusions,
            );
        }

        const query = queryParts.join(" and ");
        Logger.debug(`[Query Builder] Complete Datacore query: ${query}`);
        return query;
    }

    /**
     * Build task filter function (post-query filtering)
     * DEPRECATED: Property filters are now built directly into the Datacore query
     * for much better performance (database-level filtering vs JavaScript filtering)
     *
     * This method is kept for backwards compatibility but should not be used.
     */
    private static buildTaskFilter(
        propertyFilters: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: DateRange | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
            statusExclusions?: string[] | null; // For "other" category - excludes defined symbols
        },
        settings: PluginSettings,
    ): ((_dcTask: DatacoreTask) => boolean) | null {
        // Delegate to unified filter building method in TaskPropertyService
        return TaskPropertyService.buildUnifiedTaskFilter(
            propertyFilters,
            settings,
        );
    }

    /**
     * Parse all tasks from Datacore with optional filtering
     * Main entry point for fetching tasks from the Datacore API
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
     * @param maxResults - Optional maximum number of tasks to return (for early limiting)
     */
    static async parseTasksFromDatacore(
        app: App,
        settings: PluginSettings,
        dateFilter?: string,
        propertyFilters?: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: DateRange | null;
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
        maxResults?: number,
    ): Promise<Task[]> {
        const datacoreApi = this.getAPI();
        if (!datacoreApi) {
            Logger.warn("Datacore API not available");
            return [];
        }

        let tasks: Task[] = [];

        try {
            // Build query for folder/tag filtering AND property filtering (all in Datacore query)
            const query = this.buildDatacoreQuery(
                settings,
                inclusionFilters,
                propertyFilters,
            );

            // OPTIMIZATION: Property filters now applied in Datacore query (above)
            // No need for JavaScript post-filtering - Datacore does it all!

            // Execute query to get all tasks (already filtered by Datacore)
            let results: DatacoreTask[] = await datacoreApi.query(query);

            if (!results || results.length === 0) {
                Logger.debug("[Datacore] Query returned no results");
                return tasks;
            }

            Logger.debug(
                `[Datacore] Query returned ${String(results.length)} results (already filtered by Datacore)`,
            );

            // ========================================
            // SCORE CACHING OPTIMIZATION
            // Cache scores during API-level filtering to avoid redundant calculations
            // at JS-level scoring. This eliminates ~50% of score calculations for large vaults.
            // ========================================
            const scoreCache = new Map<
                string,
                {
                    dueDate?: number;
                    priority?: number;
                    status?: number;
                    relevance?: number;
                    finalScore?: number;
                    _comprehensiveScore?: number; // Final comprehensive score (if calculated early)
                }
            >();

            // ========================================
            // FILTER ORDERING OPTIMIZATION
            // Apply RELEVANCE filter BEFORE quality filter for massive performance gain:
            //
            // WHY THIS ORDER IS CRITICAL:
            // - Relevance filter: Fast keyword matching (no property extraction)
            // - Quality filter: Slow property extraction (due date, priority, status parsing)
            //
            // Example with 46,981 tasks:
            // - Old order: Extract properties for 46,981 tasks (51 seconds!) → Relevance filters to 282
            // - New order: Relevance filters to 282 tasks (fast!) → Extract properties for only 282 (0.3 seconds)
            // Performance gain: 170x faster!
            // ========================================

            // ========================================
            // API-LEVEL RELEVANCE FILTERING (VECTORIZED - High Performance)
            // Apply relevance filter (keyword matching) at API level FIRST
            // This dramatically reduces the dataset before expensive property extraction
            //
            // OPTIMIZATION: Uses vectorized batch processing:
            // - Traditional: N tasks × keyword matching = N calls (slow, high overhead)
            // - Vectorized: Extract texts → Batch calculate relevance → Filter (10-100x faster)
            // ========================================
            if (
                keywords &&
                keywords.length > 0 &&
                minimumRelevanceScore !== undefined &&
                minimumRelevanceScore > 0
            ) {
                const beforeRelevance = results.length;
                const relevanceTimer = new PerformanceTimer("Relevance Filter");

                // VECTORIZED RELEVANCE FILTERING
                // Processes all texts in optimized batch operations
                results = VectorizedScoring.vectorizedRelevanceFilter(
                    results,
                    keywords,
                    coreKeywords || keywords,
                    minimumRelevanceScore,
                    settings,
                    scoreCache,
                    this.getTaskId.bind(this),
                );

                relevanceTimer.lap(
                    `Filtered ${beforeRelevance} → ${results.length} tasks`,
                );

                Logger.debug(
                    `[Datacore] Relevance filter (min score: ${minimumRelevanceScore.toFixed(2)}): ${beforeRelevance} → ${results.length} tasks (vectorized, scores cached for ${scoreCache.size} tasks)`,
                );

                if (results.length === 0) {
                    Logger.debug(
                        "[Datacore] No tasks remaining after relevance filter",
                    );
                    return tasks;
                }
            }

            // ========================================
            // API-LEVEL QUALITY FILTERING (VECTORIZED + CHUNKED - High Performance)
            // Apply quality filter (due date + priority + status scores) at API level
            // This is a PRE-FILTER that reduces tasks before scoring
            //
            // PURPOSE: Filter out low-quality tasks early to reduce scoring work
            // Example: 30,000 tasks → quality filter → 5,000 high-quality tasks → score only 5,000
            //
            // IMPORTANT: This runs AFTER relevance filter to minimize expensive property extraction
            //
            // HYBRID OPTIMIZATION:
            // - Vectorized: Batch calculations (10-100x faster)
            // - Chunked: Process in chunks with yielding (keeps UI responsive)
            // ========================================
            if (qualityThreshold !== undefined && qualityThreshold > 0) {
                const beforeQuality = results.length;
                const timer = new PerformanceTimer("Quality Filter");

                // PREPROCESSING: Extract and map properties with chunked processing
                // This prevents UI freezing for large datasets (>5000 tasks)
                await processInChunks(
                    results,
                    (task: DatacoreTask) => {
                        const taskText = task.$text || task.text || "";

                        // Extract and store due date
                        const dueValue =
                            TaskPropertyService.getUnifiedFieldValue(
                                task,
                                "due",
                                taskText,
                            );
                        // Use formatDate to handle all date types (string, Datacore date, moment, etc.)
                        task._dueDate = dueValue
                            ? TaskPropertyService.formatDate(dueValue)
                            : undefined;

                        // Extract and map priority
                        const priorityValue =
                            TaskPropertyService.getUnifiedFieldValue(
                                task,
                                "priority",
                                taskText,
                            );
                        task._mappedPriority =
                            priorityValue !== undefined &&
                            priorityValue !== null
                                ? TaskPropertyService.mapPriority(
                                      priorityValue,
                                      settings,
                                  )
                                : undefined;

                        // Extract and map status
                        const rawStatus = task.$status || task.status;
                        const statusValue: string =
                            typeof rawStatus === "string" ? rawStatus : "";
                        task._mappedStatus = this.mapStatusToCategory(
                            statusValue,
                            settings,
                        );
                    },
                    CHUNK_SIZES.DEFAULT,
                );

                timer.lap("Property extraction");

                // VECTORIZED QUALITY FILTERING
                // Processes all tasks in optimized batch operations
                results = VectorizedScoring.vectorizedQualityFilter(
                    results,
                    qualityThreshold,
                    settings,
                    scoreCache,
                    this.getTaskId.bind(this),
                );

                timer.lap("Vectorized filtering");

                Logger.debug(
                    `[Datacore] Quality filter (threshold: ${qualityThreshold.toFixed(2)}): ${beforeQuality} → ${results.length} tasks (vectorized + chunked, scores cached for ${scoreCache.size} tasks)`,
                );

                if (results.length === 0) {
                    Logger.debug(
                        "[Datacore] No tasks remaining after quality filter",
                    );
                    return tasks;
                }
            }

            // ========================================
            // SMART EARLY LIMITING (Quality-based Pre-filtering)
            // When we have a large result set without quality filtering, apply automatic
            // quality-based limiting to avoid scoring tens of thousands of tasks
            //
            // STRATEGY:
            // 1. Calculate quality scores for all tasks (fast, vectorized)
            // 2. Sort by quality score
            // 3. Take top N tasks (where N = 10× maxResults, or 5000 max)
            // 4. Then do full scoring on that reduced set
            //
            // GUARANTEES: We get the highest quality tasks from the full set
            // ========================================
            const hasKeywords = keywords && keywords.length > 0;
            const qualityFilterWasApplied =
                qualityThreshold !== undefined && qualityThreshold > 0;

            // Apply early limiting if:
            // - Result set is large (> THRESHOLD tasks)
            // - No quality filter was applied (so quality scores not yet calculated)
            // - No keywords (property-only search, so relevance won't help)
            const shouldApplyEarlyLimit =
                results.length > SMART_EARLY_LIMIT.THRESHOLD &&
                !qualityFilterWasApplied &&
                !hasKeywords &&
                maxResults !== undefined;

            if (shouldApplyEarlyLimit) {
                const earlyLimitTimer = new PerformanceTimer(
                    "Smart Early Limiting",
                );

                Logger.debug(
                    `[Datacore] Large result set (${results.length} tasks) without quality filter. Applying smart early limiting...`,
                );

                // STEP 1: Extract properties if not already extracted
                const needsPropertyExtraction = results.some(
                    (dcTask: DatacoreTask) =>
                        dcTask._dueDate === undefined &&
                        dcTask._mappedPriority === undefined &&
                        dcTask._mappedStatus === undefined,
                );

                if (needsPropertyExtraction) {
                    await processInChunks(
                        results,
                        (task: DatacoreTask) => {
                            const taskText = task.$text || task.text || "";

                            task._dueDate =
                                TaskPropertyService.getUnifiedFieldValue(
                                    task,
                                    "due",
                                    taskText,
                                );
                            const priorityValue =
                                TaskPropertyService.getUnifiedFieldValue(
                                    task,
                                    "priority",
                                    taskText,
                                );
                            task._mappedPriority =
                                priorityValue !== undefined &&
                                priorityValue !== null
                                    ? TaskPropertyService.mapPriority(
                                          priorityValue,
                                          settings,
                                      )
                                    : undefined;
                            const rawStatus = task.$status || task.status;
                            const statusValue: string =
                                typeof rawStatus === "string" ? rawStatus : "";
                            task._mappedStatus = this.mapStatusToCategory(
                                statusValue,
                                settings,
                            );
                        },
                        CHUNK_SIZES.DEFAULT,
                    );
                }

                earlyLimitTimer.lap("Property extraction");

                // STEP 2: Calculate quality scores (vectorized, fast)
                results = VectorizedScoring.vectorizedQualityFilter(
                    results,
                    0.0, // No threshold - we want all tasks with their quality scores
                    settings,
                    scoreCache,
                    this.getTaskId.bind(this),
                );

                earlyLimitTimer.lap("Quality score calculation");

                // STEP 3: Sort by quality score and take top N
                const earlyLimit = Math.min(
                    maxResults * SMART_EARLY_LIMIT.MULTIPLIER,
                    SMART_EARLY_LIMIT.MAX,
                );

                // Sort by quality score (highest first)
                const qualitySortedTasks = results
                    .map((dcTask: DatacoreTask) => {
                        const taskId = this.getTaskId(dcTask);
                        const cached = scoreCache.get(taskId);
                        const qualityScore =
                            (cached?.dueDate || 0) +
                            (cached?.priority || 0) +
                            (cached?.status || 0);
                        return { dcTask, qualityScore };
                    })
                    .sort(
                        (
                            a: { dcTask: DatacoreTask; qualityScore: number },
                            b: { dcTask: DatacoreTask; qualityScore: number },
                        ) => b.qualityScore - a.qualityScore,
                    );

                results = qualitySortedTasks
                    .slice(0, earlyLimit)
                    .map(
                        (item: {
                            dcTask: DatacoreTask;
                            qualityScore: number;
                        }) => item.dcTask,
                    );

                earlyLimitTimer.lap(
                    `Sorted and limited to top ${results.length} quality tasks`,
                );

                Logger.debug(
                    `[Datacore] Smart early limiting applied: ${qualitySortedTasks.length} → ${results.length} tasks (top ${results.length} by quality score)`,
                );
            }

            // ========================================
            // API-LEVEL SCORING, SORTING & LIMITING (Simplified Architecture)
            // Apply coefficients to cached component scores, sort, and limit BEFORE creating Task objects
            //
            // KEY INSIGHT: Scoring is just weighted sum of cached component scores!
            // No need for complex "comprehensive scoring" function.
            //
            // BENEFITS:
            // 1. Always sort by finalScore (ensures consistent ordering)
            // 2. Limit early when needed to avoid unnecessary Task creation
            // 3. Use maxResults from user settings (no arbitrary buffer multiplier)
            // 4. Respect user's scoring coefficients
            //
            // APPLIES TO:
            // - ALL queries: Always score and sort for consistent results
            // - Limit only when results.length > maxResults
            // ========================================
            const shouldScoreAndSort = results.length > 0; // Always score/sort if we have results
            const shouldLimit =
                maxResults !== undefined && results.length > maxResults;

            if (shouldScoreAndSort) {
                const earlyLimitTimer = new PerformanceTimer(
                    "API-level Score + Sort" + (shouldLimit ? " + Limit" : ""),
                );

                Logger.debug(
                    shouldLimit
                        ? `[Datacore] Applying API-level score + sort + limit: ${results.length} → ${maxResults} tasks`
                        : `[Datacore] Applying API-level score + sort: ${results.length} tasks`,
                );

                // STEP 1: Extract properties if needed (for scoring)
                const needsPropertyExtraction = results.some(
                    (dcTask: DatacoreTask) =>
                        dcTask._dueDate === undefined &&
                        dcTask._mappedPriority === undefined &&
                        dcTask._mappedStatus === undefined,
                );

                if (needsPropertyExtraction) {
                    Logger.debug(
                        `[Datacore] Extracting properties for scoring (${results.length} tasks)`,
                    );
                    await processInChunks(
                        results,
                        (task: DatacoreTask) => {
                            const taskText = task.$text || task.text || "";

                            // Extract and store due date
                            const dueValue =
                                TaskPropertyService.getUnifiedFieldValue(
                                    task,
                                    "due",
                                    taskText,
                                );
                            // Use formatDate to handle all date types (string, Datacore date, moment, etc.)
                            task._dueDate = dueValue
                                ? TaskPropertyService.formatDate(dueValue)
                                : undefined;

                            // Extract and map priority
                            const priorityValue =
                                TaskPropertyService.getUnifiedFieldValue(
                                    task,
                                    "priority",
                                    taskText,
                                );
                            task._mappedPriority =
                                priorityValue !== undefined &&
                                priorityValue !== null
                                    ? TaskPropertyService.mapPriority(
                                          priorityValue,
                                          settings,
                                      )
                                    : undefined;

                            // Extract and map status
                            const rawStatus = task.$status || task.status;
                            const statusValue: string =
                                typeof rawStatus === "string" ? rawStatus : "";
                            task._mappedStatus = this.mapStatusToCategory(
                                statusValue,
                                settings,
                            );
                        },
                        CHUNK_SIZES.DEFAULT,
                    );
                    earlyLimitTimer.lap(
                        `Property extraction for ${results.length} tasks`,
                    );
                }

                // STEP 2: Calculate component scores (if not already cached) and cache them
                const hasKeywords = keywords && keywords.length > 0;
                const queryHasDueDate =
                    propertyFilters?.dueDate !== undefined ||
                    propertyFilters?.dueDateRange !== undefined;
                const queryHasPriority =
                    propertyFilters?.priority !== undefined;
                const queryHasStatus = propertyFilters?.status !== undefined;

                // Get user's coefficient settings
                const relevCoeff = settings.relevanceCoefficient; // Default: 20
                const dateCoeff = settings.dueDateCoefficient; // Default: 4
                const priorCoeff = settings.priorityCoefficient; // Default: 1
                const statusCoeff = settings.statusCoefficient; // Default: 1

                // Determine which coefficients to activate (0.0 = disabled, 1.0 = enabled)
                const relevanceActive = hasKeywords ? 1.0 : 0.0;
                const dueDateActive = queryHasDueDate ? 1.0 : 0.0;
                const priorityActive = queryHasPriority ? 1.0 : 0.0;
                const statusActive = queryHasStatus ? 1.0 : 0.0;

                Logger.debug(
                    `[Datacore] Scoring with coefficients: relevance=${relevCoeff * relevanceActive}, dueDate=${dateCoeff * dueDateActive}, priority=${priorCoeff * priorityActive}, status=${statusCoeff * statusActive}`,
                );

                // STEP 3: Score all tasks by applying coefficients to component scores
                // Scoring is just: finalScore = sum of (componentScore × coefficient × activationFlag)
                const scoredTasks = results.map((dcTask: DatacoreTask) => {
                    const taskId = this.getTaskId(dcTask);
                    const taskText = dcTask.$text || dcTask.text || "";
                    let cached = scoreCache.get(taskId);

                    // Calculate component scores if not cached
                    if (!cached) {
                        cached = {};

                        // Relevance score (already calculated in relevance filter if keywords present)
                        cached.relevance = hasKeywords
                            ? TaskSearchService.calculateRelevanceScoreFromText(
                                  taskText,
                                  coreKeywords || keywords || [],
                                  keywords || [],
                                  settings,
                              )
                            : 0.0;

                        // Property scores
                        cached.dueDate =
                            TaskSearchService.calculateDueDateScore(
                                typeof dcTask._dueDate === "string"
                                    ? dcTask._dueDate
                                    : undefined,
                                settings,
                            );
                        cached.priority =
                            TaskSearchService.calculatePriorityScore(
                                dcTask._mappedPriority,
                                settings,
                            );
                        cached.status = TaskSearchService.calculateStatusScore(
                            dcTask._mappedStatus || "incomplete",
                            settings,
                        );

                        scoreCache.set(taskId, cached);
                    }

                    // Apply coefficients to component scores
                    const finalScore =
                        (cached.relevance || 0) * relevCoeff * relevanceActive +
                        (cached.dueDate || 0) * dateCoeff * dueDateActive +
                        (cached.priority || 0) * priorCoeff * priorityActive +
                        (cached.status || 0) * statusCoeff * statusActive;

                    // Cache finalScore for Task objects to use
                    cached.finalScore = finalScore;
                    scoreCache.set(taskId, cached);

                    return { dcTask, finalScore };
                });

                earlyLimitTimer.lap(`Scored ${scoredTasks.length} tasks`);

                // STEP 4: Sort by final score (highest first) + multi-criteria tiebreaker
                // Uses existing TaskSortService.sortScoredDcTasks method
                TaskSortService.sortScoredDcTasks(
                    scoredTasks,
                    settings.taskSortOrder,
                    settings,
                    this.getTaskId.bind(this),
                    scoreCache,
                );

                // STEP 5: Limit to user's maxResults if needed (NO buffer multiplier!)
                if (shouldLimit) {
                    const limitedTasks = scoredTasks.slice(0, maxResults);
                    results = limitedTasks.map(
                        (item: { dcTask: DatacoreTask; finalScore: number }) =>
                            item.dcTask,
                    );
                    earlyLimitTimer.lap(
                        `Sorted and limited to ${results.length} tasks`,
                    );
                    Logger.debug(
                        `[Datacore] API-level score + sort + limit complete: ${results.length} top-scored tasks (scores cached for reuse)`,
                    );
                } else {
                    results = scoredTasks.map(
                        (item: { dcTask: DatacoreTask; finalScore: number }) =>
                            item.dcTask,
                    );
                    earlyLimitTimer.lap(`Sorted ${results.length} tasks`);
                    Logger.debug(
                        `[Datacore] API-level score + sort complete: ${results.length} tasks (scores cached for reuse)`,
                    );
                }
            }

            // NOTE: Page tag fetching REMOVED - it's not needed!
            // Reason 1: Note tag filtering already happens at DataCore query level (lines 350-409: childof(@page and #tag))
            // Reason 2: Task.noteTags field is not displayed in UI
            // Reason 3: TaskFilterService.filterTasks() is never called (JavaScript-level filtering is dead code)
            // Performance gain: Saves 2-3 seconds in large vaults!

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
            // ========================================
            // VALIDATION (CHUNKED - Non-blocking)
            // Filter out invalid items with periodic yielding
            // ========================================
            const allTasks: DatacoreTask[] = [];
            const validationStats = {
                total: 0,
                validTasks: 0,
                invalidItems: 0,
                withTypeTask: 0,
                withTypeList: 0,
                withTypeOther: 0,
                noType: 0,
            };

            const validationTimer = new PerformanceTimer("Validation");

            await processInChunks(
                results,
                (dcTask: DatacoreTask) => {
                    validationStats.total++;

                    // Track what types we're seeing
                    if (typeof dcTask.$type !== "undefined") {
                        if (dcTask.$type === "task") {
                            validationStats.withTypeTask++;
                        } else if (dcTask.$type === "list") {
                            validationStats.withTypeList++;
                        } else {
                            validationStats.withTypeOther++;
                        }
                    } else {
                        validationStats.noType++;
                    }

                    if (this.isValidTask(dcTask)) {
                        allTasks.push(dcTask);
                        validationStats.validTasks++;
                    } else {
                        validationStats.invalidItems++;
                    }
                },
                CHUNK_SIZES.LIGHTWEIGHT,
            );

            validationTimer.lap(
                `Validated ${validationStats.validTasks}/${validationStats.total} tasks`,
            );

            Logger.debug(
                `[Datacore] Validation stats: ${JSON.stringify(validationStats)}`,
            );

            // ========================================
            // TASK PROCESSING (CHUNKED - Non-blocking)
            // Convert Datacore tasks to Task objects with periodic yielding
            // ========================================
            const processingTimer = new PerformanceTimer("Task Processing");
            let taskIndex = 0;

            await processInChunks(
                allTasks,
                (dcTask: DatacoreTask) => {
                    // Use $file per API docs (not $path)
                    const rawPath = dcTask.$file || dcTask.file || "";
                    const taskPath: string =
                        typeof rawPath === "string"
                            ? rawPath
                            : typeof rawPath === "object" &&
                                rawPath !== null &&
                                "path" in rawPath &&
                                typeof rawPath.path === "string"
                              ? rawPath.path
                              : "";

                    // Process task
                    const task = this.processDatacoreTask(
                        dcTask,
                        settings,
                        taskIndex++,
                        taskPath,
                    );

                    if (task) {
                        // ATTACH CACHED SCORES: Retrieve scores calculated during API-level filtering
                        // This eliminates redundant calculations at JS-level scoring (~50% reduction)
                        const cached = scoreCache.get(task.id);
                        if (cached) {
                            task._cachedScores = cached;
                        }

                        tasks.push(task);
                    }
                },
                CHUNK_SIZES.DEFAULT,
            );

            processingTimer.lap(`Processed ${tasks.length} Task objects`);

            // ========================================
            // FINAL LIMITING: Always respect maxResults
            // This ensures we never return more tasks than requested,
            // even if early limiting didn't apply or validation added more tasks
            // ========================================
            if (maxResults !== undefined && tasks.length > maxResults) {
                Logger.debug(
                    `[Datacore] Final limiting: ${tasks.length} → ${maxResults} tasks (respecting user setting)`,
                );
                tasks = tasks.slice(0, maxResults);
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
            dueDateRange?: DateRange | null;
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
        Logger.debug(
            "[DatacoreService.getTaskCount] Received propertyFilters:",
            propertyFilters,
        );
        Logger.debug(
            "[DatacoreService.getTaskCount] Received inclusionFilters:",
            inclusionFilters,
        );

        const profiler = {
            start: Date.now(),
            steps: [] as Array<{ name: string; duration: number }>,
            log(stepName: string, startTime: number) {
                const duration = Date.now() - startTime;
                this.steps.push({ name: stepName, duration });
                Logger.debug(`  [Count Profiler] ${stepName}: ${duration}ms`);
            },
        };

        Logger.info(
            "[Task Count] Starting with property filters:",
            propertyFilters,
        );

        const datacoreApi = this.getAPI();
        if (!datacoreApi) {
            Logger.warn("Datacore API not available");
            return 0;
        }

        try {
            // Build query for source-level filtering AND property filtering (all in Datacore query)
            const stepStart = Date.now();
            const query = this.buildDatacoreQuery(
                settings,
                inclusionFilters,
                propertyFilters,
            );
            profiler.log("Build query", stepStart);
            Logger.debug(`[Task Count] Datacore query: ${query}`);

            // OPTIMIZATION: Property filters now applied in Datacore query (above)
            // No need for JavaScript post-filtering - Datacore does it all!

            // Execute query to get all tasks (already filtered by Datacore)
            const queryStart = Date.now();
            const results = await datacoreApi.query(query);
            profiler.log(
                `Datacore query execution (${results?.length || 0} results, already filtered)`,
                queryStart,
            );

            // DEBUG: Log sample tasks to inspect field names and values
            if (results && results.length > 0) {
                Logger.debug(
                    "[DEBUG] Sample Datacore task object (first result):",
                    JSON.stringify(
                        {
                            $status: results[0].$status,
                            status: results[0].status,
                            $due: results[0].$due,
                            due: results[0].due,
                            dueDate: results[0].dueDate,
                            $priority: results[0].$priority,
                            priority: results[0].priority,
                            $text: results[0].$text,
                            text: results[0].text,
                            $path: results[0].$path,
                            path: results[0].path,
                        },
                        null,
                        2,
                    ),
                );
            }

            if (!results || results.length === 0) {
                Logger.info("[Task Count] No results from Datacore query");
                // DEBUG: Test simpler query without property filters
                Logger.debug(
                    "[DEBUG] Testing simpler query without property filters...",
                );
                const simpleQuery = this.buildDatacoreQuery(
                    settings,
                    inclusionFilters,
                    undefined, // No property filters
                );
                Logger.debug("[DEBUG] Simple query:", simpleQuery);
                const simpleResults = await datacoreApi.query(simpleQuery);
                Logger.debug(
                    `[DEBUG] Simple query returned ${simpleResults?.length || 0} results`,
                );
                if (simpleResults && simpleResults.length > 0) {
                    Logger.debug(
                        "[DEBUG] Sample task from simple query:",
                        JSON.stringify(
                            {
                                $status: simpleResults[0].$status,
                                status: simpleResults[0].status,
                                $due: simpleResults[0].$due,
                                due: simpleResults[0].due,
                                dueDate: simpleResults[0].dueDate,
                                $priority: simpleResults[0].$priority,
                                priority: simpleResults[0].priority,
                                $text: simpleResults[0].$text,
                                text: simpleResults[0].text,
                            },
                            null,
                            2,
                        ),
                    );
                }
                return 0;
            }

            Logger.info(
                `[Task Count] Datacore returned ${results.length} results (already filtered by query)`,
            );

            // Count valid tasks
            const validationStart = Date.now();
            let count = 0;
            for (const dcTask of results) {
                // Skip invalid tasks
                if (!this.isValidTask(dcTask)) continue;

                // Check note-level inclusion filters if specified
                if (
                    inclusionFilters?.notes &&
                    inclusionFilters.notes.length > 0
                ) {
                    const rawPath = dcTask.$file || dcTask.file || "";
                    const taskPath: string =
                        typeof rawPath === "string"
                            ? rawPath
                            : typeof rawPath === "object" &&
                                rawPath !== null &&
                                "path" in rawPath &&
                                typeof rawPath.path === "string"
                              ? rawPath.path
                              : "";
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

            profiler.log(
                `Validation & counting (${count} valid)`,
                validationStart,
            );

            // Log total time and summary
            const totalTime = Date.now() - profiler.start;
            Logger.info(
                `[Task Count] COMPLETE: ${count} tasks (total: ${totalTime}ms)`,
            );

            // Log profiling summary if operation was slow
            if (totalTime > 1000) {
                Logger.warn(
                    `[Task Count] SLOW OPERATION: ${totalTime}ms. Breakdown:`,
                );
                profiler.steps.forEach((step) => {
                    Logger.warn(`  - ${step.name}: ${step.duration}ms`);
                });
            }

            return count;
        } catch (error) {
            Logger.error("Error getting task count from Datacore:", error);
            return 0;
        }
    }
}
