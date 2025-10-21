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

        for (const [category, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (config.symbols.some((s) => s === cleanSymbol)) {
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

        // Use 'visual' field if available (task text without children)
        // Fall back to 'text' if visual not available
        const text = dvTask.visual || dvTask.text || dvTask.content || "";
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
     * Process task recursively including ALL children
     *
     * CRITICAL BEHAVIOR:
     * - Processes ALL child tasks regardless of parent match
     * - Handles list items that aren't tasks but have task children
     * - Applies filter to EACH task independently (parent and children separate)
     * - Ensures no child tasks are missed even if parent doesn't match
     *
     * @param dvTask DataView task object (could be task or list item)
     * @param settings Plugin settings
     * @param tasks Array to collect matching tasks
     * @param path File path
     * @param taskIndex Current task index
     * @param taskFilter Optional filter to apply to each task
     * @returns Updated task index
     */
    private static processTaskRecursively(
        dvTask: any,
        settings: PluginSettings,
        tasks: Task[],
        path: string,
        taskIndex: number,
        taskFilter?: ((dvTask: any) => boolean) | null,
    ): number {
        // Try to process as a task (handles both tasks and list items)
        const task = this.processDataviewTask(
            dvTask,
            settings,
            taskIndex++,
            path,
        );

        // Apply task-level filter if provided
        // Add task if: (1) no filter OR (2) filter passes
        if (task) {
            const shouldInclude = !taskFilter || taskFilter(dvTask);
            if (shouldInclude) {
                tasks.push(task);
            }
        }

        // ALWAYS process children, regardless of parent match
        // This ensures child tasks aren't missed even if parent doesn't match filter
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
                    taskFilter, // Pass filter to children
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
     * Build task-level filter based on extracted intent
     * Applies to INDIVIDUAL TASKS (not pages) during recursive processing
     * This ensures child tasks are evaluated independently of their parents
     *
     * CRITICAL: Filters at task level, not page level, so:
     * - Child tasks with due dates match even if parent doesn't
     * - List items without task markers are recursively processed
     * - Each task/subtask is evaluated independently
     *
     * @param intent Extracted intent with property filters
     * @param settings Plugin settings with user-configured field names
     * @returns Task filter function or null if no filters
     */
    private static buildTaskFilter(
        intent: {
            priority?: number | number[] | null; // Support multi-value
            dueDate?: string | null;
            dueDateRange?: { start: string; end: string } | null;
            status?: string | string[] | null; // Support multi-value
        },
        settings: PluginSettings,
    ): ((dvTask: any) => boolean) | null {
        const filters: ((dvTask: any) => boolean)[] = [];

        // Build priority filter (supports multi-value)
        if (intent.priority) {
            const priorityFields = [
                settings.dataviewKeys.priority,
                "priority",
                "p",
                "pri",
            ];
            const targetPriorities = Array.isArray(intent.priority)
                ? intent.priority
                : [intent.priority];

            filters.push((dvTask: any) => {
                // Check task's own fields
                for (const field of priorityFields) {
                    const value = dvTask[field];
                    if (value !== undefined && value !== null) {
                        const mapped = this.mapPriority(value, settings);
                        if (
                            mapped !== undefined &&
                            targetPriorities.includes(mapped)
                        ) {
                            return true;
                        }
                    }
                }
                return false;
            });
        }

        // Build due date filter (checks task metadata)
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
                filters.push((dvTask: any) => {
                    for (const field of dueDateFields) {
                        const value = dvTask[field];
                        if (value !== undefined && value !== null) {
                            return true;
                        }
                    }
                    return false;
                });
            } else if (intent.dueDate === "today") {
                const today = moment().format("YYYY-MM-DD");
                filters.push((dvTask: any) => {
                    for (const field of dueDateFields) {
                        const value = dvTask[field];
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
                filters.push((dvTask: any) => {
                    for (const field of dueDateFields) {
                        const value = dvTask[field];
                        if (value) {
                            const taskDate = moment(this.formatDate(value));
                            if (taskDate.isBefore(today, "day")) {
                                return true;
                            }
                        }
                    }
                    return false;
                });
            } else if (intent.dueDate.startsWith("+")) {
                // Relative date: +Nd (days), +Nw (weeks), +Nm (months)
                const match = intent.dueDate.match(/^\+(\d+)([dwm])$/);
                if (match) {
                    const amount = parseInt(match[1]);
                    const unit = match[2];
                    let targetDate: moment.Moment;

                    if (unit === "d") {
                        targetDate = moment().add(amount, "days");
                    } else if (unit === "w") {
                        targetDate = moment().add(amount, "weeks");
                    } else if (unit === "m") {
                        targetDate = moment().add(amount, "months");
                    } else {
                        // Invalid unit, skip this filter
                        targetDate = moment(); // Fallback to today
                    }

                    const targetDateStr = targetDate.format("YYYY-MM-DD");
                    filters.push((dvTask: any) => {
                        for (const field of dueDateFields) {
                            const value = dvTask[field];
                            if (value) {
                                const formatted = this.formatDate(value);
                                if (formatted === targetDateStr) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    });
                }
            }
            // Add more due date filters as needed (tomorrow, week, etc.)
        }

        // Build date range filter
        if (intent.dueDateRange) {
            const dueDateFields = [
                settings.dataviewKeys.dueDate,
                "due",
                "deadline",
                "dueDate",
                "scheduled",
            ];
            const { start, end } = intent.dueDateRange;

            // Parse range keywords (week-start, month-start, etc.)
            let startDate: moment.Moment;
            let endDate: moment.Moment;

            if (start === "week-start") {
                startDate = moment().startOf("week");
            } else if (start === "next-week-start") {
                startDate = moment().add(1, "week").startOf("week");
            } else if (start === "month-start") {
                startDate = moment().startOf("month");
            } else {
                startDate = moment(start);
            }

            if (end === "week-end") {
                endDate = moment().endOf("week");
            } else if (end === "next-week-end") {
                endDate = moment().add(1, "week").endOf("week");
            } else if (end === "month-end") {
                endDate = moment().endOf("month");
            } else {
                endDate = moment(end);
            }

            filters.push((dvTask: any) => {
                for (const field of dueDateFields) {
                    const value = dvTask[field];
                    if (value) {
                        const taskDate = moment(this.formatDate(value));
                        if (
                            taskDate.isSameOrAfter(startDate, "day") &&
                            taskDate.isSameOrBefore(endDate, "day")
                        ) {
                            return true;
                        }
                    }
                }
                return false;
            });
        }

        // Build status filter (supports multi-value)
        if (intent.status) {
            const targetStatuses = Array.isArray(intent.status)
                ? intent.status
                : [intent.status];

            filters.push((dvTask: any) => {
                const status = dvTask.status;
                if (status !== undefined) {
                    const mapped = this.mapStatusToCategory(status, settings);
                    return targetStatuses.includes(mapped);
                }
                return false;
            });
        }

        // Combine all filters with AND logic
        if (filters.length === 0) {
            return null; // No filters
        }

        return (dvTask: any) => {
            return filters.every((f) => f(dvTask));
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
            priority?: number | number[] | null; // Support multi-value
            dueDate?: string | null; // Single date or relative
            dueDateRange?: { start: string; end: string } | null; // Date range
            status?: string | string[] | null; // Support multi-value
        },
    ): Promise<Task[]> {
        const dataviewApi = this.getAPI(app);
        if (!dataviewApi) {
            console.error("DataView API not available");
            return [];
        }

        const tasks: Task[] = [];
        let foundTasks = false;

        // Build task-level filter from property filters
        // CRITICAL: This filters TASKS, not PAGES, so child tasks are evaluated independently
        const taskFilter = propertyFilters
            ? this.buildTaskFilter(propertyFilters, settings)
            : null;

        if (taskFilter) {
            const filterDesc = [];
            if (propertyFilters?.priority)
                filterDesc.push(`priority=${propertyFilters.priority}`);
            if (propertyFilters?.dueDate)
                filterDesc.push(`dueDate=${propertyFilters.dueDate}`);
            if (propertyFilters?.status)
                filterDesc.push(`status=${propertyFilters.status}`);
            console.log(
                `[Task Chat] Task-level filtering: ${filterDesc.join(", ")}`,
            );
            console.log(
                `[Task Chat] Child tasks will be evaluated independently of parents`,
            );
        }

        // Fetch ALL pages and use DataView's expand() to flatten ALL tasks
        // CRITICAL: expand("children") recursively flattens the entire task hierarchy
        // This automatically handles:
        // - Parent tasks, child tasks, grandchildren, etc. at any depth
        // - List items with task children
        // - Mixed hierarchies (list → task → list → task)
        if (
            !foundTasks &&
            dataviewApi.pages &&
            typeof dataviewApi.pages === "function"
        ) {
            try {
                const pages = dataviewApi.pages();

                if (pages && pages.length > 0) {
                    // Get ALL tasks from ALL pages using DataView's API
                    // file.tasks returns task objects (may be hierarchical)
                    const allPageTasks = pages.file.tasks;

                    if (allPageTasks && allPageTasks.length > 0) {
                        // Use DataView's expand() to flatten ALL subtasks recursively
                        // This handles unlimited nesting depth automatically
                        const flattenedTasks = allPageTasks.expand
                            ? allPageTasks.expand("children")
                            : allPageTasks;

                        let taskIndex = 0;

                        // Process each flattened task
                        for (const dvTask of flattenedTasks.array()) {
                            const task = this.processDataviewTask(
                                dvTask,
                                settings,
                                taskIndex++,
                                dvTask.path || "",
                            );

                            // Apply task-level filter if provided
                            if (task) {
                                const shouldInclude =
                                    !taskFilter || taskFilter(dvTask);
                                if (shouldInclude) {
                                    tasks.push(task);
                                }
                            }
                        }

                        foundTasks = true;
                    }
                }
            } catch (e) {
                console.error("Error using DataView pages API:", e);

                // Fallback to recursive processing if expand() fails
                console.log("[Task Chat] Falling back to recursive processing");
                try {
                    const pages = dataviewApi.pages();
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
                                            taskFilter,
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
                } catch (fallbackError) {
                    console.error(
                        "Fallback processing also failed:",
                        fallbackError,
                    );
                }
            }
        }

        if (taskFilter) {
            console.log(
                `[Task Chat] Task-level filtering complete: ${tasks.length} tasks matched`,
            );
        }

        return tasks;
    }
}
