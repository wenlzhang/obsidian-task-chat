import { App, moment } from "obsidian";
import { Task, TaskStatusCategory } from "../models/task";
import { PluginSettings } from "../settings";

/**
 * Service for integrating with Dataview plugin to fetch tasks
 */
export class DataviewService {
    /**
     * Check if Dataview plugin is enabled
     */
    static isDataviewEnabled(app: App): boolean {
        // @ts-ignore - DataView plugin check
        return app.plugins.plugins.dataview !== undefined;
    }

    /**
     * Get Dataview API
     */
    static getAPI(app: App): any {
        if (!this.isDataviewEnabled(app)) {
            return null;
        }

        // @ts-ignore - Access dataview API
        const api = app.plugins.plugins.dataview?.api;
        return api || null;
    }

    /**
     * Map a DataView task status symbol to status category
     */
    static mapStatusToCategory(
        symbol: string | undefined,
        settings: PluginSettings,
    ): TaskStatusCategory {
        if (!symbol) return "open";

        const cleanSymbol = symbol.replace(/[\[\]]/g, "").trim();

        for (const [category, symbols] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (symbols.some((s) => s === cleanSymbol)) {
                return category as TaskStatusCategory;
            }
        }

        if (cleanSymbol === "" || cleanSymbol === " ") {
            return "open";
        }

        return "other";
    }

    /**
     * Map a DataView priority value to internal numeric priority
     * Returns: 1 (highest), 2 (high), 3 (medium), 4 (low), or undefined (none)
     */
    static mapPriority(
        value: any,
        settings: PluginSettings,
    ): number | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        const strValue = String(value).toLowerCase().trim();

        for (const [priority, values] of Object.entries(
            settings.dataviewPriorityMapping,
        )) {
            if (values.some((v) => v.toLowerCase() === strValue)) {
                const result = parseInt(priority);
                return result; // Convert key to number
            }
        }

        return undefined; // No priority = undefined
    }

    /**
     * Format date to consistent string format
     */
    static formatDate(date: any, format?: string): string | undefined {
        if (!date) return undefined;

        try {
            // Handle native Date objects
            if (date instanceof Date) {
                return format
                    ? moment(date).format(format)
                    : moment(date).format("YYYY-MM-DD");
            }

            // Handle objects with .format() method (moment/luxon objects)
            if (
                date &&
                typeof date === "object" &&
                typeof date.format === "function"
            ) {
                return format ? date.format(format) : date.format("YYYY-MM-DD");
            }

            // Handle Dataview date objects (which have toString() but not .format())
            // These need to be converted to string first, then parsed by moment
            if (
                date &&
                typeof date === "object" &&
                typeof date.toString === "function"
            ) {
                const dateStr = date.toString();
                const momentDate = moment(dateStr);
                if (momentDate.isValid()) {
                    return format
                        ? momentDate.format(format)
                        : momentDate.format("YYYY-MM-DD");
                }
            }

            // Handle string dates
            if (typeof date === "string") {
                const dateStr = date.trim();
                const parsedDate = moment(dateStr);
                if (parsedDate.isValid()) {
                    return format ? parsedDate.format(format) : dateStr;
                }
            }

            // Fallback: try moment() directly
            const momentDate = moment(date);
            if (momentDate.isValid()) {
                return format
                    ? momentDate.format(format)
                    : momentDate.format("YYYY-MM-DD");
            }
        } catch (e) {
            console.error("Error formatting date:", e);
        }

        return undefined;
    }

    /**
     * Get field value from DataView task using multiple strategies
     * DataView stores metadata in multiple places:
     * 1. Direct properties (from frontmatter or emoji shorthands): task.fieldName
     * 2. Fields object (from inline fields): task.fields.fieldName
     * 3. DataView standard emoji field names (due, completion, created, etc.)
     * 4. Emoji shorthands extracted from text (fallback)
     * 5. Inline field syntax in text: [fieldName::value]
     *
     * IMPORTANT: Respects user's configured field names while also checking
     * DataView's standard emoji shorthand field names
     */
    private static getFieldValue(
        dvTask: any,
        fieldKey: string,
        text: string,
    ): any {
        // Strategy 1: Check user's configured field name (direct property)
        if (dvTask[fieldKey] !== undefined) {
            return dvTask[fieldKey];
        }

        // Strategy 2: Check user's configured field name (fields object)
        if (dvTask.fields && dvTask.fields[fieldKey] !== undefined) {
            return dvTask.fields[fieldKey];
        }

        // Strategy 3: Check DataView's standard emoji shorthand field names
        // These are FIXED by DataView and different from user's configured names
        const standardFieldMap: { [key: string]: string[] } = {
            // Map common user field names to DataView's standard emoji field names
            due: ["due"], // User might configure as "due", "dueDate", etc.
            dueDate: ["due"],
            completion: ["completion"],
            completed: ["completion"], // DataView uses "completion", not "completed"
            completedDate: ["completion"],
            created: ["created"],
            createdDate: ["created"],
            start: ["start"],
            startDate: ["start"],
            scheduled: ["scheduled"],
            scheduledDate: ["scheduled"],
        };

        const standardFields = standardFieldMap[fieldKey] || [];
        for (const standardField of standardFields) {
            // Check direct property
            if (dvTask[standardField] !== undefined) {
                return dvTask[standardField];
            }
            // Check fields object
            if (dvTask.fields && dvTask.fields[standardField] !== undefined) {
                return dvTask.fields[standardField];
            }
        }

        // Strategy 4: Extract emoji shorthands from text (fallback)
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
     * Extract DataView emoji shorthands
     * See: https://blacksmithgu.github.io/obsidian-dataview/annotation/metadata-tasks/
     *
     * IMPORTANT: DataView emoji shorthands use FIXED field names:
     * 🗓️ → "due" (always this name in DataView, regardless of user settings)
     * ✅ → "completion" (always this name, even if user configured "completed")
     * ➕ → "created" (always this name)
     * 🛫 → "start" (always this name)
     * ⏳ → "scheduled" (always this name)
     *
     * This method extracts emoji dates from text as a fallback.
     * The primary extraction happens in getFieldValue() using DataView's API.
     */
    private static extractEmojiShorthand(
        text: string,
        fieldKey: string,
    ): string | undefined {
        if (!text || typeof text !== "string") return undefined;

        // Map of all possible emoji shorthands
        // We check all emojis and let the caller decide which one to use
        const emojiPatterns: { [key: string]: RegExp } = {
            due: /🗓️\s*(\d{4}-\d{2}-\d{2})/,
            completion: /✅\s*(\d{4}-\d{2}-\d{2})/,
            created: /➕\s*(\d{4}-\d{2}-\d{2})/,
            start: /🛫\s*(\d{4}-\d{2}-\d{2})/,
            scheduled: /⏳\s*(\d{4}-\d{2}-\d{2})/,
        };

        // Check all emoji patterns and return the first match
        // This allows the function to work regardless of field naming
        for (const pattern of Object.values(emojiPatterns)) {
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
            (task.text || task.content) &&
            (typeof task.status !== "undefined" ||
                typeof task.symbol !== "undefined") &&
            (typeof task.real === "undefined" || task.real === true)
        );
    }

    /**
     * Process a single DataView task
     */
    static processDataviewTask(
        dvTask: any,
        settings: PluginSettings,
        index: number,
        filePath: string = "",
    ): Task | null {
        if (!this.isValidTask(dvTask)) {
            return null;
        }

        const text = dvTask.text || dvTask.content || "";
        const status = dvTask.status || dvTask.symbol || "";
        const path = filePath || dvTask.path || "";
        const line = dvTask.line || 0;
        const statusCategory = this.mapStatusToCategory(status, settings);

        // Extract folder from path
        const folder = path.includes("/")
            ? path.substring(0, path.lastIndexOf("/"))
            : "";

        // Handle priority using unified field extraction
        let priority;
        const priorityKey = settings.dataviewKeys.priority;
        const priorityValue = this.getFieldValue(dvTask, priorityKey, text);

        if (priorityValue !== undefined) {
            priority = this.mapPriority(priorityValue, settings);
        } else if (text) {
            // Fallback to emoji-based priority (Tasks plugin format)
            if (text.includes("⏫")) {
                priority = 1; // high
            } else if (text.includes("🔼")) {
                priority = 2; // medium
            } else if (text.includes("🔽") || text.includes("⏬")) {
                priority = 3; // low
            }
        }

        // Handle dates using unified field extraction
        let dueDate, createdDate, completedDate;

        // Due date - check all DataView locations
        const dueDateValue = this.getFieldValue(
            dvTask,
            settings.dataviewKeys.dueDate,
            text,
        );
        if (dueDateValue) {
            dueDate = this.formatDate(dueDateValue, settings.dateFormats.due);
        }

        // Created date - check all DataView locations
        const createdDateValue = this.getFieldValue(
            dvTask,
            settings.dataviewKeys.createdDate,
            text,
        );
        if (createdDateValue) {
            createdDate = this.formatDate(
                createdDateValue,
                settings.dateFormats.created,
            );
        }

        // Completed date - check all DataView locations
        const completedDateValue = this.getFieldValue(
            dvTask,
            settings.dataviewKeys.completedDate,
            text,
        );
        if (completedDateValue) {
            completedDate = this.formatDate(
                completedDateValue,
                settings.dateFormats.completed,
            );
        }

        // Handle tags
        let tags: string[] = [];
        if (Array.isArray(dvTask.tags)) {
            tags = dvTask.tags;
        }

        const taskId = `dataview-${path}-${line}-${text.substring(0, 20)}-${index}`;

        const task = {
            id: taskId,
            text: text,
            status: status,
            statusCategory: statusCategory,
            createdDate: createdDate,
            completedDate: completedDate,
            dueDate: dueDate,
            priority: priority, // undefined = no priority
            tags: tags,
            sourcePath: path,
            lineNumber: line,
            originalText: text,
            folder: folder,
        };

        return task;
    }

    /**
     * Check if task matches date range filter
     */
    private static matchesDateRange(
        task: Task,
        dateRange: { start?: string; end?: string } | null,
    ): boolean {
        if (!dateRange) return true; // No filter = include all

        // "any" filter - task must have a due date
        if (
            Object.keys(dateRange).length === 0 &&
            dateRange.constructor === Object
        ) {
            return !!task.dueDate;
        }

        if (!task.dueDate) return false; // No due date = exclude

        const taskDate = moment(task.dueDate).startOf("day");
        if (!taskDate.isValid()) return false;

        // Check start range
        if (dateRange.start) {
            const startDate = moment(dateRange.start).startOf("day");
            if (taskDate.isBefore(startDate)) return false;
        }

        // Check end range
        if (dateRange.end) {
            const endDate = moment(dateRange.end).startOf("day");
            if (taskDate.isAfter(endDate)) return false;
        }

        return true;
    }

    /**
     * Process task recursively including children
     */
    private static processTaskRecursively(
        dvTask: any,
        settings: PluginSettings,
        tasks: Task[],
        path: string,
        taskIndex: number,
        dateRange?: { start?: string; end?: string } | null,
    ): number {
        const task = this.processDataviewTask(
            dvTask,
            settings,
            taskIndex++,
            path,
        );

        // Apply date range filtering at load time
        if (task && this.matchesDateRange(task, dateRange || null)) {
            tasks.push(task);
        }

        if (
            dvTask.children &&
            Array.isArray(dvTask.children) &&
            dvTask.children.length > 0
        ) {
            for (const childTask of dvTask.children) {
                taskIndex = this.processTaskRecursively(
                    childTask,
                    settings,
                    tasks,
                    path,
                    taskIndex,
                    dateRange,
                );
            }
        }

        return taskIndex;
    }

    /**
     * Convert date filter to Dataview date range query
     */
    static convertDateFilterToRange(dateFilter: string): {
        start?: string;
        end?: string;
    } | null {
        const today = moment().startOf("day");

        switch (dateFilter) {
            case "any":
                // Has a due date (non-null)
                return {}; // Will check for existence, not range

            case "today":
                return {
                    start: today.format("YYYY-MM-DD"),
                    end: today.format("YYYY-MM-DD"),
                };

            case "tomorrow": {
                const tomorrow = moment().add(1, "day").startOf("day");
                return {
                    start: tomorrow.format("YYYY-MM-DD"),
                    end: tomorrow.format("YYYY-MM-DD"),
                };
            }

            case "overdue":
                return {
                    end: today.clone().subtract(1, "day").format("YYYY-MM-DD"),
                };

            case "future":
                return {
                    start: today.clone().add(1, "day").format("YYYY-MM-DD"),
                };

            case "week": {
                const weekEnd = today.clone().add(7, "days").endOf("day");
                return {
                    start: today.format("YYYY-MM-DD"),
                    end: weekEnd.format("YYYY-MM-DD"),
                };
            }

            case "next-week": {
                const nextWeekStart = today
                    .clone()
                    .add(7, "days")
                    .startOf("day");
                const nextWeekEnd = today.clone().add(14, "days").endOf("day");
                return {
                    start: nextWeekStart.format("YYYY-MM-DD"),
                    end: nextWeekEnd.format("YYYY-MM-DD"),
                };
            }

            default:
                // Try to parse as specific date (YYYY-MM-DD)
                const parsedDate = moment(dateFilter, "YYYY-MM-DD", true);
                if (parsedDate.isValid()) {
                    return {
                        start: parsedDate.format("YYYY-MM-DD"),
                        end: parsedDate.format("YYYY-MM-DD"),
                    };
                }
                return null;
        }
    }

    /**
     * Build DataView query filter based on extracted intent
     * Converts user intent (priority, dueDate, status) to DataView field queries
     *
     * @param intent Extracted intent with property filters
     * @param settings Plugin settings with user-configured field names
     * @returns DataView query predicate function or null if no filters
     */
    private static buildDataviewFilter(
        intent: {
            priority?: number | null;
            dueDate?: string | null;
            status?: string | null;
        },
        settings: PluginSettings,
    ): ((page: any) => boolean) | null {
        const filters: ((page: any) => boolean)[] = [];

        // Build priority filter
        if (intent.priority) {
            const priorityFields = [
                settings.dataviewKeys.priority,
                "priority",
                "p",
                "pri",
            ];
            const targetPriority = intent.priority;

            filters.push((page: any) => {
                for (const field of priorityFields) {
                    const value = page[field];
                    if (value !== undefined && value !== null) {
                        const mapped = this.mapPriority(value, settings);
                        if (mapped === targetPriority) {
                            return true;
                        }
                    }
                }
                return false;
            });
        }

        // Build due date filter
        if (intent.dueDate) {
            const dueDateFields = [
                settings.dataviewKeys.dueDate,
                "due",
                "deadline",
                "dueDate",
                "scheduled",
            ];

            if (intent.dueDate === "any") {
                // Has any due date
                filters.push((page: any) => {
                    for (const field of dueDateFields) {
                        const value = page[field];
                        if (value !== undefined && value !== null) {
                            return true;
                        }
                    }
                    return false;
                });
            } else if (intent.dueDate === "today") {
                const today = moment().format("YYYY-MM-DD");
                filters.push((page: any) => {
                    for (const field of dueDateFields) {
                        const value = page[field];
                        if (value) {
                            const formatted = this.formatDate(value);
                            if (formatted === today) {
                                return true;
                            }
                        }
                    }
                    return false;
                });
            } else if (intent.dueDate === "overdue") {
                const today = moment();
                filters.push((page: any) => {
                    for (const field of dueDateFields) {
                        const value = page[field];
                        if (value) {
                            const taskDate = moment(this.formatDate(value));
                            if (taskDate.isBefore(today, "day")) {
                                return true;
                            }
                        }
                    }
                    return false;
                });
            }
            // Add more due date filters as needed (tomorrow, week, etc.)
        }

        // Build status filter
        if (intent.status) {
            filters.push((page: any) => {
                const status = page.status || page.task?.status;
                if (status) {
                    const mapped = this.mapStatusToCategory(status, settings);
                    return mapped === intent.status;
                }
                return false;
            });
        }

        // Combine all filters with AND logic
        if (filters.length === 0) {
            return null; // No filters
        }

        return (page: any) => {
            return filters.every((f) => f(page));
        };
    }

    /**
     * Parse all tasks from Dataview with optional date filtering
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param dateFilter - Optional date filter: "any", "today", "overdue", "future", "week", "next-week", "tomorrow", or specific date (YYYY-MM-DD)
     * @param propertyFilters Optional property filters (priority, dueDate, status)
     *
     * When dateFilter is provided, tasks are filtered AT LOAD TIME (before adding to array),
     * which is more efficient than loading all tasks and filtering afterward.
     * This converts the user's date query to Dataview date ranges before querying.
     */
    static async parseTasksFromDataview(
        app: App,
        settings: PluginSettings,
        dateFilter?: string,
        propertyFilters?: {
            priority?: number | null;
            dueDate?: string | null;
            status?: string | null;
        },
    ): Promise<Task[]> {
        const dataviewApi = this.getAPI(app);
        if (!dataviewApi) {
            console.error("DataView API not available");
            return [];
        }

        const tasks: Task[] = [];
        let foundTasks = false;

        // Build DataView filter from property filters
        const dvFilter = propertyFilters
            ? this.buildDataviewFilter(propertyFilters, settings)
            : null;

        if (dvFilter) {
            const filterDesc = [];
            if (propertyFilters?.priority)
                filterDesc.push(`priority=${propertyFilters.priority}`);
            if (propertyFilters?.dueDate)
                filterDesc.push(`dueDate=${propertyFilters.dueDate}`);
            if (propertyFilters?.status)
                filterDesc.push(`status=${propertyFilters.status}`);
            console.log(
                `[Task Chat] DataView API filtering: ${filterDesc.join(", ")}`,
            );
        }

        // Try using pages method with optional filter
        if (
            !foundTasks &&
            dataviewApi.pages &&
            typeof dataviewApi.pages === "function"
        ) {
            try {
                // Apply DataView filter at API level if provided
                const pages = dvFilter
                    ? dataviewApi.pages().where(dvFilter)
                    : dataviewApi.pages();
                let taskIndex = 0;

                if (pages && pages.length > 0) {
                    for (const page of pages) {
                        try {
                            if (!page.file || !page.file.path) continue;

                            if (
                                page.file.tasks &&
                                Array.isArray(page.file.tasks)
                            ) {
                                for (const pageTask of page.file.tasks) {
                                    taskIndex = this.processTaskRecursively(
                                        pageTask,
                                        settings,
                                        tasks,
                                        page.file.path,
                                        taskIndex,
                                        null, // No date range filtering (done at API level)
                                    );
                                }
                            } else if (
                                page.tasks &&
                                Array.isArray(page.tasks)
                            ) {
                                for (const pageTask of page.tasks) {
                                    taskIndex = this.processTaskRecursively(
                                        pageTask,
                                        settings,
                                        tasks,
                                        page.file.path,
                                        taskIndex,
                                        null, // No date range filtering (done at API level)
                                    );
                                }
                            }
                        } catch (pageError) {
                            console.warn(
                                `Error processing page: ${page.file?.path}`,
                            );
                        }
                    }

                    if (tasks.length > 0) {
                        foundTasks = true;
                    }
                }
            } catch (e) {
                console.error("Error using DataView pages API:", e);
            }
        }

        if (dvFilter) {
            console.log(
                `[Task Chat] DataView API filtering complete: ${tasks.length} tasks returned`,
            );
        }

        return tasks;
    }
}
