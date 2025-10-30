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
     * Datacore stores metadata using $ prefix for built-in fields:
     * 1. Built-in properties: $text, $symbol, $completed, $due, etc.
     * 2. Custom properties: Same as user's configured field names
     * 3. Inline fields: Datacore indexes these automatically
     *
     * IMPORTANT: Datacore has better indexing than Dataview
     */
    private static getFieldValue(
        dcTask: any,
        fieldKey: string,
        text: string,
    ): any {
        // Strategy 1: Check Datacore built-in properties (with $ prefix)
        const builtInFieldMap: { [key: string]: string } = {
            text: "$text",
            symbol: "$symbol",
            status: "$symbol",
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
        const emojiValue = this.extractEmojiShorthand(text, fieldKey);
        if (emojiValue !== undefined) {
            return emojiValue;
        }

        // Strategy 5: Extract from inline field syntax in text
        const inlineValue = this.extractInlineField(text, fieldKey);
        if (inlineValue !== undefined) {
            return inlineValue;
        }

        return undefined;
    }

    /**
     * Extract Datacore emoji shorthands (same format as Dataview)
     * Datacore maintains compatibility with Tasks plugin emoji format
     */
    private static extractEmojiShorthand(
        text: string,
        fieldKey: string,
    ): string | undefined {
        if (!text || typeof text !== "string") return undefined;

        // Use centralized emoji patterns from TaskPropertyService
        for (const pattern of Object.values(
            TaskPropertyService.DATE_EMOJI_PATTERNS,
        )) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const extractedDate = match[1].trim();
                const momentDate = moment(extractedDate, "YYYY-MM-DD", true);
                if (momentDate.isValid()) {
                    return extractedDate;
                }
            }
        }

        return undefined;
    }

    /**
     * Extract inline field from task text using [key::value] syntax
     */
    private static extractInlineField(
        text: string,
        fieldKey: string,
    ): string | undefined {
        if (!text || typeof text !== "string") return undefined;

        // Match [fieldKey::value] or [fieldKey:: value]
        const regex = new RegExp(`\\[${fieldKey}::([^\\]]+)\\]`, "i");
        const match = text.match(regex);

        if (match && match[1]) {
            return match[1].trim();
        }

        return undefined;
    }

    /**
     * Check if a task is valid for processing
     */
    private static isValidTask(task: any): boolean {
        return (
            task &&
            (task.$text || task.text) &&
            typeof task.$symbol !== "undefined"
        );
    }

    /**
     * Check if a task should be excluded based on task-level tags
     * This checks tags that are ON the task line itself
     */
    private static isTaskExcludedByTag(
        dcTask: any,
        excludedTags: string[],
    ): boolean {
        if (!excludedTags || excludedTags.length === 0) {
            return false;
        }

        // Get task-level tags from Datacore task object
        const taskTags = dcTask.$tags || dcTask.tags || [];

        if (taskTags.length === 0) {
            return false;
        }

        // Check if task has any excluded tag (case-insensitive comparison)
        return excludedTags.some((excludedTag: string) => {
            const normalizedExcluded = excludedTag.replace(/^#+/, "");

            return taskTags.some((taskTag: string) => {
                const normalizedTaskTag = taskTag.replace(/^#+/, "");
                return (
                    normalizedTaskTag.toLowerCase() ===
                    normalizedExcluded.toLowerCase()
                );
            });
        });
    }

    /**
     * Process a single Datacore task
     * Converts Datacore task format to internal Task model
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

        // Extract path
        const path = filePath || dcTask.$path || dcTask.path || "";

        // Use $text for task text (Datacore's built-in field)
        const text = dcTask.$text || dcTask.text || "";
        const status = dcTask.$symbol || dcTask.symbol || "";
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
     * Build Datacore query string from filters
     * Datacore uses query syntax similar to Dataview but with $ prefix for built-in fields
     */
    private static buildDatacoreQuery(
        settings: PluginSettings,
        propertyFilters?: {
            priority?: number | number[] | "all" | "none" | null;
            dueDate?: string | string[] | null;
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
    ): string {
        // Start with base query for tasks
        let query = "@task";

        const conditions: string[] = [];

        // Apply property filters
        if (propertyFilters) {
            // Priority filter
            if (propertyFilters.priority) {
                if (propertyFilters.priority === "all") {
                    conditions.push("$priority != null");
                } else if (propertyFilters.priority === "none") {
                    conditions.push("$priority = null");
                } else {
                    const priorities = Array.isArray(propertyFilters.priority)
                        ? propertyFilters.priority
                        : [propertyFilters.priority];
                    const priorityConditions = priorities.map(
                        (p) => `$priority = ${p}`,
                    );
                    conditions.push(`(${priorityConditions.join(" or ")})`);
                }
            }

            // Due date filter
            if (propertyFilters.dueDate) {
                const dueDates = Array.isArray(propertyFilters.dueDate)
                    ? propertyFilters.dueDate
                    : [propertyFilters.dueDate];

                const dateConditions = dueDates.map((date) => {
                    // Handle special keywords
                    if (date === "any" || date === "all") {
                        return "$due != null";
                    } else if (date === "none") {
                        return "$due = null";
                    } else if (date === "today") {
                        const today = moment().format("YYYY-MM-DD");
                        return `$due = date("${today}")`;
                    } else if (date === "overdue") {
                        const today = moment().format("YYYY-MM-DD");
                        return `$due < date("${today}")`;
                    } else {
                        // Specific date
                        return `$due = date("${date}")`;
                    }
                });
                conditions.push(`(${dateConditions.join(" or ")})`);
            }

            // Due date range filter
            if (propertyFilters.dueDateRange) {
                const { start, end } = propertyFilters.dueDateRange;
                if (start && end) {
                    conditions.push(
                        `$due >= date("${start}") and $due <= date("${end}")`,
                    );
                } else if (start) {
                    conditions.push(`$due >= date("${start}")`);
                } else if (end) {
                    conditions.push(`$due <= date("${end}")`);
                }
            }

            // Status filter (unified s: syntax)
            if (
                propertyFilters.statusValues &&
                propertyFilters.statusValues.length > 0
            ) {
                const statusConditions = propertyFilters.statusValues.map(
                    (value) => {
                        // Try exact symbol match
                        return `$symbol = "${value}"`;
                    },
                );
                conditions.push(`(${statusConditions.join(" or ")})`);
            }
        }

        // Apply inclusion filters (page-level)
        if (inclusionFilters) {
            const pageConditions: string[] = [];

            // Folder filter
            if (
                inclusionFilters.folders &&
                inclusionFilters.folders.length > 0
            ) {
                const folderConditions = inclusionFilters.folders.map(
                    (folder) => `$path starts with "${folder}/"`,
                );
                pageConditions.push(`(${folderConditions.join(" or ")})`);
            }

            // Note tags filter
            if (
                inclusionFilters.noteTags &&
                inclusionFilters.noteTags.length > 0
            ) {
                // Note: Datacore's tag filtering syntax may vary
                const tagConditions = inclusionFilters.noteTags.map(
                    (tag) => `#${tag.replace(/^#+/, "")}`,
                );
                pageConditions.push(`(${tagConditions.join(" or ")})`);
            }

            // Specific notes filter
            if (inclusionFilters.notes && inclusionFilters.notes.length > 0) {
                const noteConditions = inclusionFilters.notes.map(
                    (note) => `$path = "${note}"`,
                );
                pageConditions.push(`(${noteConditions.join(" or ")})`);
            }

            if (pageConditions.length > 0) {
                conditions.push(...pageConditions);
            }
        }

        // Combine all conditions
        if (conditions.length > 0) {
            query += " and " + conditions.join(" and ");
        }

        return query;
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
            // Build Datacore query
            const query = this.buildDatacoreQuery(
                settings,
                propertyFilters,
                inclusionFilters,
            );

            Logger.debug(`Datacore query: ${query}`);

            // Execute query
            const results = await datacoreApi.query(query);

            Logger.debug(`Datacore returned ${results?.length || 0} results`);

            if (!results || results.length === 0) {
                return tasks;
            }

            // Process each task
            let taskIndex = 0;
            for (const dcTask of results) {
                // Apply exclusions (post-query filtering)
                // Folder exclusions
                if (
                    settings.exclusions.folders &&
                    settings.exclusions.folders.length > 0
                ) {
                    const taskPath = dcTask.$path || dcTask.path || "";
                    const isExcluded = settings.exclusions.folders.some(
                        (folder: string) => {
                            const normalizedFolder = folder.replace(
                                /^\/+|\/+$/g,
                                "",
                            );
                            return taskPath.startsWith(normalizedFolder + "/");
                        },
                    );
                    if (isExcluded) continue;
                }

                // Note exclusions
                if (
                    settings.exclusions.notes &&
                    settings.exclusions.notes.length > 0
                ) {
                    const taskPath = dcTask.$path || dcTask.path || "";
                    if (settings.exclusions.notes.includes(taskPath)) {
                        continue;
                    }
                }

                // Task tag exclusions
                if (
                    this.isTaskExcludedByTag(
                        dcTask,
                        settings.exclusions.taskTags || [],
                    )
                ) {
                    continue;
                }

                // Task tag inclusion filter (if specified)
                if (
                    inclusionFilters?.taskTags &&
                    inclusionFilters.taskTags.length > 0
                ) {
                    const taskTags = dcTask.$tags || dcTask.tags || [];
                    const hasRequiredTag = taskTags.some((taskTag: string) => {
                        const normalizedTaskTag = taskTag
                            .replace(/^#+/, "")
                            .toLowerCase();
                        return inclusionFilters.taskTags!.some(
                            (filterTag: string) => {
                                const normalizedFilter = filterTag
                                    .replace(/^#+/, "")
                                    .toLowerCase();
                                return normalizedTaskTag === normalizedFilter;
                            },
                        );
                    });
                    if (!hasRequiredTag) continue;
                }

                // Process task
                const task = this.processDatacoreTask(
                    dcTask,
                    settings,
                    taskIndex++,
                    dcTask.$path || dcTask.path || "",
                    [], // Page tags would need separate query
                );

                if (task) {
                    tasks.push(task);
                }
            }

            Logger.debug(
                `Processed ${tasks.length} tasks from Datacore after filtering`,
            );
        } catch (error) {
            Logger.error("Error querying Datacore:", error);
        }

        return tasks;
    }
}
