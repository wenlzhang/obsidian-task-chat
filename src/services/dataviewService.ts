import { App, moment } from "obsidian";
import { Task, TaskStatusCategory } from "../models/task";
import { PluginSettings } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";
import { Logger } from "../utils/logger";

/**
 * Service for integrating with Dataview plugin to fetch tasks
 */
export class DataviewService {
    /**
     * Check if Dataview plugin is enabled
     */
    static isDataviewEnabled(app: App): boolean {
        // @ts-ignore - Dataview plugin check
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
     * Map a Dataview task status symbol to status category
     * Delegates to TaskPropertyService for consistent behavior
     */
    static mapStatusToCategory(
        symbol: string | undefined,
        settings: PluginSettings,
    ): TaskStatusCategory {
        return TaskPropertyService.mapStatusToCategory(symbol, settings);
    }

    /**
     * Map a Dataview priority value to internal numeric priority
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
     * Get field value from Dataview task using multiple strategies
     * Dataview stores metadata in multiple places:
     * 1. Direct properties (from frontmatter or emoji shorthands): task.fieldName
     * 2. Fields object (from inline fields): task.fields.fieldName
     * 3. Dataview standard emoji field names (due, completion, created, etc.)
     * 4. Emoji shorthands extracted from text (fallback)
     * 5. Inline field syntax in text: [fieldName::value]
     *
     * IMPORTANT: Respects user's configured field names while also checking
     * Dataview's standard emoji shorthand field names
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

        // Strategy 3: Check Dataview's standard emoji shorthand field names
        // These are FIXED by Dataview and different from user's configured names
        const standardFieldMap: { [key: string]: string[] } = {
            // Map common user field names to Dataview's standard emoji field names
            due: ["due"], // User might configure as "due", "dueDate", etc.
            dueDate: ["due"],
            completion: ["completion"],
            completed: ["completion"], // Dataview uses "completion", not "completed"
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
     * Extract Dataview emoji shorthands
     * See: https://blacksmithgu.github.io/obsidian-dataview/annotation/metadata-tasks/
     *
     * IMPORTANT: Dataview emoji shorthands use FIXED field names:
     * 🗓️ → "due" (always this name in Dataview, regardless of user settings)
     * ✅ → "completion" (always this name, even if user configured "completed")
     * ➕ → "created" (always this name)
     * 🛫 → "start" (always this name)
     * ⏳ → "scheduled" (always this name)
     *
     * This method extracts emoji dates from text as a fallback.
     * The primary extraction happens in getFieldValue() using Dataview's API.
     */
    private static extractEmojiShorthand(
        text: string,
        fieldKey: string,
    ): string | undefined {
        if (!text || typeof text !== "string") return undefined;

        // Use centralized emoji patterns from TaskPropertyService
        // Check all emoji patterns and return the first match
        // This allows the function to work regardless of field naming
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
            (task.text || task.content) &&
            (typeof task.status !== "undefined" ||
                typeof task.symbol !== "undefined") &&
            (typeof task.real === "undefined" || task.real === true)
        );
    }

    /**
     * Check if a task should be excluded based on task-level tags
     * This checks tags that are ON the task line itself (e.g., "- [ ] Task #skip")
     * @param dvTask DataView task object
     * @param excludedTags Array of tags to exclude
     * @returns true if task should be excluded, false otherwise
     */
    private static isTaskExcludedByTag(
        dvTask: any,
        excludedTags: string[],
    ): boolean {
        if (!excludedTags || excludedTags.length === 0) {
            return false;
        }

        // Get task-level tags from DataView task object
        const taskTags = dvTask.tags || [];

        if (taskTags.length === 0) {
            return false;
        }

        // Check if task has any excluded tag (case-insensitive comparison)
        return excludedTags.some((excludedTag: string) => {
            const normalizedExcluded = excludedTag.replace(/^#+/, "");

            return taskTags.some((taskTag: string) => {
                const normalizedTaskTag = taskTag.replace(/^#+/, "");
                // Case-insensitive comparison
                return (
                    normalizedTaskTag.toLowerCase() ===
                    normalizedExcluded.toLowerCase()
                );
            });
        });
    }

    /**
     * Process a single Dataview task
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

        // Exclusions are handled by DataView query filtering (WHERE clause)
        // No need for post-processing exclusion checks

        // Extract path
        const path = filePath || dvTask.path || "";

        // Use 'visual' field if available (task text without children)
        // Fall back to 'text' if visual not available
        const text = dvTask.visual || dvTask.text || dvTask.content || "";
        const status = dvTask.status || dvTask.symbol || "";
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
            // Use centralized emoji mappings from TaskPropertyService
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

        // Due date - check all Dataview locations
        const dueDateValue = this.getFieldValue(
            dvTask,
            settings.dataviewKeys.dueDate,
            text,
        );
        if (dueDateValue) {
            dueDate = this.formatDate(dueDateValue, settings.dateFormats.due);
        }

        // Created date - check all Dataview locations
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

        // Completed date - check all Dataview locations
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
     * Process task recursively, including all children
     *
     * CRITICAL BEHAVIOR:
     * - Processes ALL child tasks regardless of parent match
     * - Handles list items that aren't tasks but have task children
     * - Applies filter to EACH task independently (parent and children separate)
     * - Ensures no child tasks are missed even if parent doesn't match
     *
     * @param dvTask Dataview task object (could be task or list item)
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
     * Delegates to TaskPropertyService for consistent behavior
     */
    static convertDateFilterToRange(dateFilter: string): {
        start?: string;
        end?: string;
    } | null {
        return TaskPropertyService.convertDateFilterToRange(dateFilter);
    }

    /**
     * Parse date strings (DATE-ONLY)
     * Delegates to TaskPropertyService
     *
     * @deprecated This method now delegates to TaskPropertyService
     */
    private static parseComplexDate(dateStr: string): string | null {
        return TaskPropertyService.parseDate(dateStr);
    }

    // Note: ~250 lines of parseRelativeDateRange implementation have been
    // moved to TaskPropertyService.parseRelativeDateRange()
    // This eliminates duplication and provides a single source of truth

    /**
     * Parse standard query syntax (comprehensive parser)
     *
     * Handles multiple syntax types:
     * - Todoist patterns: p1-p4, s:value, ##project, search:term
     * - Natural language dates: "next Friday", "in 3 days" (via chrono-node)
     * - Special keywords: overdue, recurring, no date, etc.
     * - Date ranges: due before:, due after:
     * - Dataview field compatibility
     * - Operators: &, |, !
     *
     * This is the standard parser used by all three modes (Simple Search, Smart Search, Task Chat)
     * for extracting explicitly-specified task properties from queries.
     *
     * @param query Query string with standard syntax
     * @returns Parsed query components compatible with our system
     */
    static parseStandardQuerySyntax(query: string): {
        keywords?: string[];
        priority?: number;
        dueDate?: string;
        dueDateRange?: { start?: string; end?: string };
        project?: string;
        statusValues?: string[]; // Unified: can be categories or symbols
        specialKeywords?: string[];
        operators?: { and?: boolean; or?: boolean; not?: boolean };
    } {
        const result: any = {
            specialKeywords: [],
            operators: {},
        };

        // NEW: Detect operators
        if (query.includes("&")) result.operators.and = true;
        if (query.includes("|")) result.operators.or = true;
        if (query.includes("!")) result.operators.not = true;

        // Pattern 1: "search: keyword" or "search: 'phrase with spaces'"
        const searchMatch = query.match(/search:\s*["']?([^"'&|]+)["']?/i);
        if (searchMatch) {
            const searchTerm = searchMatch[1].trim();
            result.keywords = [searchTerm];
        }

        // NEW Pattern 2: Projects "#ProjectName" or "##SubProject"
        const projectMatch = query.match(/##+([A-Za-z0-9_-]+)/);
        if (projectMatch) {
            result.project = projectMatch[1];
        }

        // Pattern 3: Priority "p1", "p2", "p3", "p4"
        const priorityMatch = query.match(/\bp([1-4])\b/i);
        if (priorityMatch) {
            result.priority = parseInt(priorityMatch[1]);
        }

        // NEW Pattern 4: Unified Status Syntax "s:value" or "status:value" or "s:value1,value2"
        // Supports:
        // - Category names (internal or alias): s:open, s:completed, s:done, s:in-progress
        // - Symbols: s:x, s:/, s:?
        // - Multiple values: s:x,/, s:open,wip
        // Use centralized pattern from TaskPropertyService
        const statusMatch = query.match(
            TaskPropertyService.QUERY_PATTERNS.status,
        );
        if (statusMatch && statusMatch[1]) {
            const rawValues = statusMatch[1];
            // Split by comma (no spaces allowed per user request)
            result.statusValues = rawValues
                .split(",")
                .map((v) => v.trim())
                .filter((v) => v.length > 0);
        }

        // NEW Pattern 5: Special keywords
        // "overdue" or "over due" or "od"
        if (
            /\b(overdue|over\s+due|od)\b/i.test(query) &&
            !query.includes("!overdue")
        ) {
            result.specialKeywords.push("overdue");
            // Set date range to show overdue tasks
            const today = moment().startOf("day");
            result.dueDateRange = { end: today.format("YYYY-MM-DD") };
        }

        // "recurring"
        if (/\brecurring\b/i.test(query) && !query.includes("!recurring")) {
            result.specialKeywords.push("recurring");
        }

        // "subtask"
        if (/\bsubtask\b/i.test(query) && !query.includes("!subtask")) {
            result.specialKeywords.push("subtask");
        }

        // "no date" or "!no date"
        if (/\bno\s+date\b/i.test(query)) {
            if (query.includes("!no date")) {
                result.specialKeywords.push("has_date");
            } else {
                result.specialKeywords.push("no_date");
            }
        }

        // "no priority"
        if (/\bno\s+priority\b/i.test(query)) {
            result.specialKeywords.push("no_priority");
            result.priority = 4; // In Todoist, no priority = p4
        }

        // NEW Pattern 5: "due before: <date>" vs "date before: <date>" (distinguished)
        const dueBeforeMatch = query.match(
            /due\s+before:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dueBeforeMatch) {
            const dateStr = dueBeforeMatch[1].trim();
            const parsedDate = this.parseComplexDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { end: parsedDate };
            }
        }

        // Pattern 6: "date before: <date>" (for tasks with date property)
        const dateBeforeMatch = query.match(
            /(?<!due\s)date\s+before:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dateBeforeMatch && !dueBeforeMatch) {
            const dateStr = dateBeforeMatch[1].trim();
            const parsedDate = this.parseComplexDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { end: parsedDate };
            }
        }

        // NEW Pattern 7: "due after: <date>" vs "date after: <date>" (distinguished)
        const dueAfterMatch = query.match(
            /due\s+after:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dueAfterMatch) {
            const dateStr = dueAfterMatch[1].trim();
            const parsedDate = this.parseComplexDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { start: parsedDate };
            }
        }

        // Pattern 8: "date after: <date>"
        const dateAfterMatch = query.match(
            /(?<!due\s)date\s+after:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dateAfterMatch && !dueAfterMatch) {
            const dateStr = dateAfterMatch[1].trim();
            const parsedDate = this.parseComplexDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { start: parsedDate };
            }
        }

        return result;
    }

    // Note: parseComplexDate() has been moved to TaskPropertyService.parseDate()
    // and is delegated at line 427. The implementation is no longer duplicated here.

    /**
     * Helper: Check if a task matches a specific due date value
     * Uses centralized keyword matching from TaskPropertyService
     */
    private static matchesDueDateValue(
        dvTask: any,
        dueDateValue: string,
        dueDateFields: string[],
        settings: PluginSettings,
    ): boolean {
        // Check for special value "any" or "all" - has any due date
        if (
            dueDateValue === TaskPropertyService.DUE_DATE_KEYWORDS.any ||
            dueDateValue === TaskPropertyService.DUE_DATE_KEYWORDS.all
        ) {
            return dueDateFields.some(
                (field) =>
                    dvTask[field] !== undefined && dvTask[field] !== null,
            );
        }

        // Check for special value "none" - no due date
        if (
            dueDateValue === TaskPropertyService.DUE_DATE_FILTER_KEYWORDS.none
        ) {
            return !dueDateFields.some(
                (field) =>
                    dvTask[field] !== undefined && dvTask[field] !== null,
            );
        }

        // Check for standard due date keywords (today, tomorrow, yesterday, overdue, future, week, last-week, next-week, month, last-month, next-month, year, last-year, next-year)
        // Use centralized matching from TaskPropertyService
        const dueDateKeywords = Object.values(
            TaskPropertyService.DUE_DATE_KEYWORDS,
        ) as string[];
        if (dueDateKeywords.includes(dueDateValue)) {
            return dueDateFields.some((field) =>
                TaskPropertyService.matchesDueDateKeyword(
                    dvTask[field],
                    dueDateValue as keyof typeof TaskPropertyService.DUE_DATE_KEYWORDS,
                    this.formatDate.bind(this),
                ),
            );
        }

        // Check for relative date with enhanced syntax
        // Supports: 1d, +1d, -1d, 1w, +1w, -1w, 1m, +1m, -1m, 1y, +1y, -1y
        const parsedRelativeDate =
            TaskPropertyService.parseRelativeDate(dueDateValue);
        if (parsedRelativeDate) {
            return dueDateFields.some((field) => {
                const formatted = this.formatDate(dvTask[field]);
                return formatted === parsedRelativeDate;
            });
        }

        // Check for specific date (YYYY-MM-DD format or other formats)
        return dueDateFields.some((field) => {
            const formatted = this.formatDate(dvTask[field]);
            return formatted === dueDateValue;
        });
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
            priority?: number | number[] | "all" | "none" | null; // Support multi-value and special values
            dueDate?: string | string[] | null; // Support multi-value
            dueDateRange?: { start: string; end: string } | null;
            status?: string | string[] | null; // Support multi-value
            statusValues?: string[] | null; // NEW: Unified s: syntax (categories or symbols)
        },
        settings: PluginSettings,
    ): ((dvTask: any) => boolean) | null {
        const filters: ((dvTask: any) => boolean)[] = [];

        // Build priority filter (supports multi-value and special values)
        if (intent.priority) {
            // Use centralized priority field names
            const priorityFields =
                TaskPropertyService.getAllPriorityFieldNames(settings);

            if (
                intent.priority ===
                TaskPropertyService.PRIORITY_FILTER_KEYWORDS.all
            ) {
                // Tasks with ANY priority (P1-P4)
                filters.push((dvTask: any) => {
                    return priorityFields.some((field) => {
                        const value = dvTask[field];
                        if (value === undefined || value === null) return false;

                        const mapped = this.mapPriority(value, settings);
                        return (
                            mapped !== undefined && mapped >= 1 && mapped <= 4
                        );
                    });
                });
            } else if (
                intent.priority ===
                TaskPropertyService.PRIORITY_FILTER_KEYWORDS.none
            ) {
                // Tasks with NO priority
                filters.push((dvTask: any) => {
                    return !priorityFields.some((field) => {
                        const value = dvTask[field];
                        if (value === undefined || value === null) return false;

                        const mapped = this.mapPriority(value, settings);
                        return mapped !== undefined;
                    });
                });
            } else {
                // Specific priority values
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
        }

        // Build due date filter (checks task metadata, supports multi-value)
        if (intent.dueDate) {
            // Use centralized date field names
            const dueDateFields =
                TaskPropertyService.getAllDueDateFieldNames(settings);

            // Handle multi-value due dates (d:today,tomorrow,overdue)
            const dueDateValues = Array.isArray(intent.dueDate)
                ? intent.dueDate
                : [intent.dueDate];

            // Build filter that matches ANY of the due date values (OR logic)
            filters.push((dvTask: any) => {
                for (const dueDateValue of dueDateValues) {
                    if (
                        this.matchesDueDateValue(
                            dvTask,
                            dueDateValue,
                            dueDateFields,
                            settings,
                        )
                    ) {
                        return true; // Match ANY value
                    }
                }
                return false;
            });
        }

        // Build date range filter
        if (intent.dueDateRange) {
            // Use centralized date field names
            const dueDateFields =
                TaskPropertyService.getAllDueDateFieldNames(settings);
            const { start, end } = intent.dueDateRange;

            // Parse range keywords using centralized method from TaskPropertyService
            const startDate = TaskPropertyService.parseDateRangeKeyword(start);
            const endDate = TaskPropertyService.parseDateRangeKeyword(end);

            filters.push((dvTask: any) => {
                return dueDateFields.some((field) => {
                    const value = dvTask[field];
                    if (!value) return false;

                    const taskDate = moment(this.formatDate(value));
                    return (
                        taskDate.isSameOrAfter(startDate, "day") &&
                        taskDate.isSameOrBefore(endDate, "day")
                    );
                });
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

        // NEW: Build unified status filter (s: syntax - categories or symbols)
        // Supports: s:open, s:x, s:done, s:x,/, etc.
        if (intent.statusValues && intent.statusValues.length > 0) {
            filters.push((dvTask: any) => {
                const taskStatus = dvTask.status;
                if (taskStatus === undefined) return false;

                // Check each value with OR logic
                return intent.statusValues!.some((value) => {
                    // 1. Try exact symbol match first (highest priority)
                    if (taskStatus === value) return true;

                    // 2. Try matching against category (internal name or aliases)
                    // Normalize value for comparison: remove hyphens, lowercase
                    const normalizedValue = value
                        .toLowerCase()
                        .replace(/-/g, "")
                        .replace(/\s+/g, "");

                    for (const [categoryKey, categoryConfig] of Object.entries(
                        settings.taskStatusMapping,
                    )) {
                        // Check internal name match (case-insensitive, normalized)
                        if (
                            categoryKey.toLowerCase() === normalizedValue ||
                            categoryKey.toLowerCase().replace(/-/g, "") ===
                                normalizedValue
                        ) {
                            return categoryConfig.symbols.includes(taskStatus);
                        }

                        // Check aliases match (case-insensitive)
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
     * @param propertyFilters Optional property filters (priority, dueDate, status, statusValues)
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
            statusValues?: string[] | null; // NEW: Unified s: syntax (categories or symbols)
        },
    ): Promise<Task[]> {
        const dataviewApi = this.getAPI(app);
        if (!dataviewApi) {
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
                `DataView JavaScript API exclusions (using .where() method): ${exclusionParts.join(", ")}`,
            );
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
            Logger.debug(`Task-level filtering: ${filterDesc.join(", ")}`);
            Logger.debug(
                `Child tasks will be evaluated independently of parents`,
            );
        }

        // Fetch ALL pages using DataView JavaScript API
        // Then filter using .where() method (JavaScript API, not DQL WHERE clause)
        if (
            !foundTasks &&
            dataviewApi.pages &&
            typeof dataviewApi.pages === "function"
        ) {
            try {
                // Get ALL pages first (no source filter)
                let pages = dataviewApi.pages("");

                // Apply exclusion filters using JavaScript API (.where method)
                if (settings.exclusions) {
                    // Exclude specific notes
                    if (
                        settings.exclusions.notes &&
                        settings.exclusions.notes.length > 0
                    ) {
                        pages = pages.where((page: any) => {
                            return !settings.exclusions.notes.includes(
                                page.file.path,
                            );
                        });
                    }

                    // Exclude folders (and subfolders)
                    if (
                        settings.exclusions.folders &&
                        settings.exclusions.folders.length > 0
                    ) {
                        pages = pages.where((page: any) => {
                            const pagePath = page.file.path || "";
                            return !settings.exclusions.folders.some(
                                (folder: string) => {
                                    const normalizedFolder = folder.replace(
                                        /^\/+|\/+$/g,
                                        "",
                                    );
                                    if (
                                        !normalizedFolder ||
                                        normalizedFolder === "/"
                                    )
                                        return false;
                                    // Check if page is in this folder or subfolder
                                    return pagePath.startsWith(
                                        normalizedFolder + "/",
                                    );
                                },
                            );
                        });
                    }

                    // Exclude note-level tags (file.tags includes both frontmatter and inline)
                    // This excludes ALL tasks in notes that have these tags
                    if (
                        settings.exclusions.noteTags &&
                        settings.exclusions.noteTags.length > 0
                    ) {
                        pages = pages.where((page: any) => {
                            // Get all tags from the page
                            const pageTags = page.file.tags || [];

                            // Check if page has any excluded note tag (case-insensitive)
                            return !settings.exclusions.noteTags.some(
                                (excludedTag: string) => {
                                    // Normalize for comparison (remove # prefix)
                                    const normalizedExcluded =
                                        excludedTag.replace(/^#+/, "");

                                    return pageTags.some((pageTag: string) => {
                                        const normalizedPageTag =
                                            pageTag.replace(/^#+/, "");
                                        // Case-insensitive comparison
                                        return (
                                            normalizedPageTag.toLowerCase() ===
                                            normalizedExcluded.toLowerCase()
                                        );
                                    });
                                },
                            );
                        });
                    }
                }

                if (pages && pages.length > 0) {
                    // Get ALL tasks from ALL pages using Dataview's API
                    // Use flatMap to collect tasks from all pages
                    const allPageTasks = pages.flatMap((page: any) => {
                        if (page.file.tasks && Array.isArray(page.file.tasks)) {
                            return page.file.tasks;
                        }
                        return [];
                    });

                    if (allPageTasks && allPageTasks.length > 0) {
                        // Use Dataview's expand() to flatten ALL subtasks recursively
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

                                // Also check task-level tag exclusions
                                const isTaskTagExcluded =
                                    this.isTaskExcludedByTag(
                                        dvTask,
                                        settings.exclusions.taskTags || [],
                                    );

                                if (shouldInclude && !isTaskTagExcluded) {
                                    tasks.push(task);
                                }
                            }
                        }

                        foundTasks = true;
                    }
                }
            } catch (e) {
                Logger.error("Error using Dataview pages API:", e);

                // Fallback to recursive processing if expand() fails
                Logger.debug("Falling back to recursive processing");
                try {
                    const pages = dataviewApi.pages("");
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
                                Logger.warn(
                                    `Error processing page: ${page.file?.path}`,
                                );
                            }
                        }

                        if (tasks.length > 0) {
                            foundTasks = true;
                        }
                    }
                } catch (fallbackError) {
                    Logger.error(
                        "Fallback processing also failed:",
                        fallbackError,
                    );
                }
            }
        }

        if (taskFilter) {
            Logger.debug(
                `Task-level filtering complete: ${tasks.length} tasks matched`,
            );
        }

        // Log summary including exclusions
        const totalExclusionsForLog =
            (settings.exclusions?.noteTags?.length || 0) +
            (settings.exclusions?.taskTags?.length || 0) +
            (settings.exclusions?.folders?.length || 0) +
            (settings.exclusions?.notes?.length || 0);
        if (totalExclusionsForLog > 0) {
            Logger.debug(
                `Total tasks from DataView (filtered with .where(), ${totalExclusionsForLog} exclusion(s)): ${tasks.length} tasks`,
            );
        } else {
            Logger.debug(`Total tasks from DataView: ${tasks.length}`);
        }

        return tasks;
    }
}
