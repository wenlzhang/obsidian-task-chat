import { App, moment } from "obsidian";
import { Task, TaskStatusCategory } from "../models/task";
import { PluginSettings } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";
import { TaskFilterService } from "./taskFilterService";
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
     * Build comprehensive Dataview source string with exclusions AND inclusions
     * Per Dataview docs (https://blacksmithgu.github.io/obsidian-dataview/reference/sources/):
     * - "#tag" - include pages with tag
     * - "!#tag" - exclude pages with tag (negation)
     * - '"folder"' - include folder (note the quotes!)
     * - "and" - both conditions must be true
     * - "or" - at least one condition must be true
     * - Parentheses for grouping: (condition1 or condition2)
     *
     * CORRECT LOGIC:
     * - Exclusions use AND: !#excluded1 and !#excluded2 (all exclusions apply)
     * - Inclusions use OR: ("folder1" or #tag1 or "folder2") (match any)
     * - Combined: !#excluded1 and !#excluded2 and ("folder1" or #tag1)
     *
     * CRITICAL LIMITATION:
     * - DataView source filters PAGES, not tasks
     * - If task tag inclusions exist, we CANNOT use source inclusions
     * - Must scan all pages and filter in task loop to support: folder1 OR task-tag1
     *
     * This builds the SOURCE-LEVEL filtering that applies:
     * 1. Exclusions (always applied) - folders, note tags
     * 2. Inclusions (only if NO task tag inclusions) - folders, note tags
     *
     * Note: Specific notes, task-level tags, and task properties filtered post-query
     */
    private static buildDataviewSourceString(
        settings: PluginSettings,
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
    ): string {
        const exclusionParts: string[] = [];
        const inclusionParts: string[] = [];

        // ========================================
        // EXCLUSIONS (Settings tab level) - AND logic
        // All exclusions use AND: condition1 AND condition2 AND condition3
        // ========================================

        // Exclude note-level tags (page-level: tasks in pages with these tags)
        if (
            settings.exclusions.noteTags &&
            settings.exclusions.noteTags.length > 0
        ) {
            for (const tag of settings.exclusions.noteTags) {
                const normalizedTag = TaskFilterService.normalizeTag(tag);
                exclusionParts.push(`!#${normalizedTag}`);
            }
        }

        // Exclude folders (page-level: tasks in these folders)
        if (
            settings.exclusions.folders &&
            settings.exclusions.folders.length > 0
        ) {
            for (const folder of settings.exclusions.folders) {
                exclusionParts.push(`!"${folder}"`);
            }
        }

        // NOTE: Task tag exclusions NOT here - handled post-query in task loop
        // Why? Source string filters PAGES, not individual tasks
        // Task tags are on the task line itself, so must check after getting tasks

        // ========================================
        // INCLUSIONS (Chat interface level) - OR logic
        // CRITICAL: Only add if NO task tag inclusions!
        // ========================================

        // Check if task tag inclusions exist
        const hasTaskTagInclusions = !!(
            inclusionFilters?.taskTags && inclusionFilters.taskTags.length > 0
        );

        // If task tag inclusions exist, we MUST scan all pages
        // because source string filters PAGES, not tasks
        // Example: folder1 OR #urgent (task tag)
        // - If source="folder1", we only get pages from folder1
        // - Tasks with #urgent in OTHER folders are never scanned!
        // Solution: Use empty source (or exclusions only) and filter in task loop
        if (!hasTaskTagInclusions) {
            // Safe to use source inclusions since no task-level filtering needed

            // Include folders
            if (
                inclusionFilters?.folders &&
                inclusionFilters.folders.length > 0
            ) {
                for (const folder of inclusionFilters.folders) {
                    inclusionParts.push(`"${folder}"`);
                }
            }

            // Include note-level tags
            if (
                inclusionFilters?.noteTags &&
                inclusionFilters.noteTags.length > 0
            ) {
                for (const tag of inclusionFilters.noteTags) {
                    const normalizedTag = TaskFilterService.normalizeTag(tag);
                    inclusionParts.push(`#${normalizedTag}`);
                }
            }
        }

        // NOTE: If hasTaskTagInclusions=true, inclusionParts stays empty
        // This means source string will ONLY have exclusions
        // All inclusions (folders, note tags, notes, task tags) handled in task loop

        // NOTE: Specific note exclusions/inclusions always handled post-query (no source syntax for specific files)
        // NOTE: Task properties (priority, due date, status) always handled post-query

        // ========================================
        // COMBINE: exclusions AND (inclusions OR)
        // ========================================

        let sourceString = "";

        // Build exclusion string with AND logic
        const exclusionString =
            exclusionParts.length > 0 ? exclusionParts.join(" and ") : "";

        // Build inclusion string with OR logic (wrapped in parentheses if multiple)
        const inclusionString =
            inclusionParts.length > 1
                ? `(${inclusionParts.join(" or ")})`
                : inclusionParts.length === 1
                  ? inclusionParts[0]
                  : "";

        // Combine exclusions AND inclusions
        if (exclusionString && inclusionString) {
            sourceString = `${exclusionString} and ${inclusionString}`;
        } else if (exclusionString) {
            sourceString = exclusionString;
        } else if (inclusionString) {
            sourceString = inclusionString;
        }

        Logger.debug(
            `Dataview source string: "${sourceString}"${exclusionParts.length > 0 ? ` (${exclusionParts.length} exclusion(s) with AND)` : ""}${inclusionParts.length > 0 ? ` (${inclusionParts.length} inclusion(s) with OR)` : ""}`,
        );
        return sourceString;
    }

    /**
     * Check if a task should be excluded based on task-level tags
     * This checks tags that are ON the task line itself (e.g., "- [ ] Task #skip")
     *
     * OR LOGIC: Exclude if task has ANY of the excluded tags
     * Example: excludedTags = ["skip", "archive"]
     *   - Task with #skip → EXCLUDED
     *   - Task with #archive → EXCLUDED
     *   - Task with #skip AND #archive → EXCLUDED
     *   - Task with neither → NOT EXCLUDED
     *
     * @param dvTask DataView task object
     * @param excludedTags Array of tags to exclude (e.g., ["skip", "archive"])
     * @returns true if task should be excluded (has ANY excluded tag), false otherwise
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

        // OR logic: Return true if task has ANY excluded tag
        // .some() returns true if ANY element passes the test
        return excludedTags.some((excludedTag: string) => {
            return taskTags.some((taskTag: string) => {
                return TaskFilterService.tagsMatch(taskTag, excludedTag);
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
        pageTags: string[] = [],
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
            tags: tags, // Task-level tags (from task line itself)
            noteTags: pageTags, // Note-level tags (from page frontmatter/inline)
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
            dueDateRange?: { start?: string; end?: string } | null;
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

            // Skip if both start and end are missing
            if (!start && !end) {
                return null;
            }

            // Parse range keywords using centralized method from TaskPropertyService
            const startDate = start ? TaskPropertyService.parseDateRangeKeyword(start) : null;
            const endDate = end ? TaskPropertyService.parseDateRangeKeyword(end) : null;

            filters.push((dvTask: any) => {
                return dueDateFields.some((field) => {
                    const value = dvTask[field];
                    if (!value) return false;

                    const taskDate = moment(this.formatDate(value));

                    // Check start date if provided
                    if (startDate && !taskDate.isSameOrAfter(startDate, "day")) {
                        return false;
                    }

                    // Check end date if provided
                    if (endDate && !taskDate.isSameOrBefore(endDate, "day")) {
                        return false;
                    }

                    return true;
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
            priority?: number | number[] | "all" | "none" | null; // Support multi-value and special values
            dueDate?: string | string[] | null; // Single date or relative (support multi-value)
            dueDateRange?: { start?: string; end?: string } | null; // Date range (optional start/end)
            status?: string | string[] | null; // Support multi-value
            statusValues?: string[] | null; // NEW: Unified s: syntax (categories or symbols)
        },
        inclusionFilters?: {
            folders?: string[]; // Include only these folders
            noteTags?: string[]; // Include only notes with these tags
            taskTags?: string[]; // Include only tasks with these tags
            notes?: string[]; // Include only these specific notes
        },
    ): Promise<Task[]> {
        const dataviewApi = this.getAPI(app);
        if (!dataviewApi) {
            return [];
        }

        const tasks: Task[] = [];
        let foundTasks = false;

        // Build task-level filter from property filters
        // CRITICAL: This filters TASKS, not PAGES, so child tasks are evaluated independently
        const taskFilter = propertyFilters
            ? this.buildTaskFilter(propertyFilters, settings)
            : null;

        // Build source string for Dataview filtering
        // Per Dataview docs: use source string for tag/folder filtering, then .where() for complex logic
        if (
            !foundTasks &&
            dataviewApi.pages &&
            typeof dataviewApi.pages === "function"
        ) {
            try {
                // Build comprehensive pre-filtering source string with exclusions AND inclusions
                // Format: dv.pages("-#excluded or #included or \"folder\"")
                const sourceString = this.buildDataviewSourceString(
                    settings,
                    inclusionFilters,
                );

                // Get pages using source string (applies exclusions AND inclusions at API level)
                let pages = dataviewApi.pages(sourceString);

                // ========================================
                // PAGE-LEVEL FILTERING (specific notes only)
                // Note: Folders and note tags already handled in source string
                // ========================================

                // Exclude specific notes (AND logic - all exclusions apply)
                if (
                    settings.exclusions.notes &&
                    settings.exclusions.notes.length > 0
                ) {
                    const normalizedExcludedPaths =
                        settings.exclusions.notes.map((note) =>
                            TaskFilterService.normalizePathForDataview(note),
                        );

                    pages = pages.where((page: any) => {
                        const normalizedPagePath =
                            TaskFilterService.normalizePathForDataview(
                                page.file.path,
                            );
                        return !normalizedExcludedPaths.includes(
                            normalizedPagePath,
                        );
                    });
                }

                // ========================================
                // INCLUSION FILTER SETUP
                // Handle OR logic: (folder) OR (note tag) OR (note) OR (task tag)
                // ========================================

                // Check what inclusion filters we have
                const hasFolderInclusion = !!(
                    inclusionFilters?.folders &&
                    inclusionFilters.folders.length > 0
                );
                const hasNoteTagInclusion = !!(
                    inclusionFilters?.noteTags &&
                    inclusionFilters.noteTags.length > 0
                );
                const hasNoteInclusion = !!(
                    inclusionFilters?.notes && inclusionFilters.notes.length > 0
                );
                const hasTaskTagInclusion = !!(
                    inclusionFilters?.taskTags &&
                    inclusionFilters.taskTags.length > 0
                );

                // Track if source inclusions are in source string or need manual check
                const sourceInclusionsInQuery =
                    (hasFolderInclusion || hasNoteTagInclusion) &&
                    !hasTaskTagInclusion;

                // Normalize included note paths for comparison in task loop
                const normalizedIncludedNotes =
                    hasNoteInclusion && inclusionFilters.notes
                        ? inclusionFilters.notes.map((note) =>
                              TaskFilterService.normalizePathForDataview(note),
                          )
                        : [];

                // Track if any inclusions exist
                const hasAnyInclusion =
                    hasFolderInclusion ||
                    hasNoteTagInclusion ||
                    hasNoteInclusion ||
                    hasTaskTagInclusion;

                if (pages && pages.length > 0) {
                    // CRITICAL: file.tasks already includes ALL tasks at all levels (parents + subtasks)
                    // No need for expand() - DataView automatically flattens task hierarchies
                    // Source: https://blacksmithgu.github.io/obsidian-dataview/annotation/metadata-tasks/

                    let taskIndex = 0;
                    let totalTasksFound = 0;
                    let listItemsSkipped = 0;

                    // Process each page's tasks (already includes all subtasks at all levels)
                    // Note: matchedPagePaths and hasTaskTagFilter are available from outer scope
                    for (const page of pages) {
                        if (
                            !page.file ||
                            !page.file.tasks ||
                            page.file.tasks.length === 0
                        ) {
                            continue;
                        }

                        const pageTags = page.file.tags || [];
                        const pagePath = page.file.path || "";

                        // Count all items (tasks + list items)
                        const pageItemCount = page.file.tasks.length;
                        totalTasksFound += pageItemCount;

                        // Process each task with existing filters
                        let processedCount = 0;
                        let nullTaskCount = 0;
                        let propertyFilterRejects = 0;
                        let taskTagExclusions = 0;
                        let taskTagInclusionRejects = 0;

                        for (const dvTask of page.file.tasks) {
                            // CRITICAL: Use DataView's 'task' property (Boolean)
                            // true = task with checkbox, false = regular list item
                            // Source: https://blacksmithgu.github.io/obsidian-dataview/annotation/metadata-tasks/
                            if (dvTask.task !== true) {
                                listItemsSkipped++;
                                if (settings.enableDebugLogging) {
                                    Logger.debug(
                                        `[DEBUG] Skipping list item: "${dvTask.text || dvTask.visual || "(no text)"}"`,
                                    );
                                }
                                continue;
                            }

                            processedCount++;

                            const task = this.processDataviewTask(
                                dvTask,
                                settings,
                                taskIndex++,
                                pagePath,
                                pageTags, // Pass note-level tags from page
                            );

                            // Apply task-level filter if provided
                            if (task) {
                                // Apply property filters
                                const shouldInclude =
                                    !taskFilter || taskFilter(dvTask);

                                // ========================================
                                // TASK TAG EXCLUSIONS (Settings tab level)
                                // ========================================
                                // Logic: Exclude if task has ANY excluded tag (OR within task tags)
                                //        Combined with other exclusions using AND
                                //
                                // Example: Exclude [#skip, #archive]
                                //   - Task has #skip → EXCLUDE
                                //   - Task has #archive → EXCLUDE
                                //   - Task has both → EXCLUDE
                                //   - Task has neither → continue checking
                                //
                                // Combined with other filters:
                                //   Final = shouldInclude AND !isTaskTagExcluded AND matchesInclusion
                                //   All exclusions must pass (AND logic across filter types)
                                // ========================================

                                const isTaskTagExcluded =
                                    this.isTaskExcludedByTag(
                                        dvTask,
                                        settings.exclusions.taskTags || [],
                                    );

                                // ========================================
                                // TASK TAG INCLUSIONS (Chat interface filter level)
                                // ========================================
                                // Logic: Include if task has ANY required tag (OR within task tags)
                                //        Combined with other inclusions using OR
                                //
                                // Example: Include [#urgent, #important]
                                //   - Task has #urgent → INCLUDE
                                //   - Task has #important → INCLUDE
                                //   - Task has both → INCLUDE
                                //   - Task has neither → check other inclusion filters
                                //
                                // Combined with other filters (OR logic):
                                //   matchesInclusion = matchesFolder OR matchesNoteTag OR matchesNote OR matchesTaskTag
                                //   Task included if it matches ANY inclusion criterion
                                //
                                // CRITICAL: When task tag inclusions exist, ALL pages must be scanned
                                // because source string can't filter tasks (only pages)
                                // ========================================

                                let matchesInclusion = false;

                                if (!hasAnyInclusion) {
                                    // No inclusion filters = include all
                                    matchesInclusion = true;
                                } else {
                                    // Check 1: Folder match
                                    let matchesFolder = false;
                                    if (hasFolderInclusion) {
                                        if (sourceInclusionsInQuery) {
                                            // Page already from source string (all pages match)
                                            matchesFolder = true;
                                        } else {
                                            // Manually check folder (task tags exist, so couldn't use source string)
                                            matchesFolder =
                                                inclusionFilters.folders!.some(
                                                    (folder: string) =>
                                                        pagePath.startsWith(
                                                            folder + "/",
                                                        ) ||
                                                        pagePath === folder,
                                                );
                                        }
                                    }

                                    // Check 2: Note tag match
                                    let matchesNoteTag = false;
                                    if (hasNoteTagInclusion) {
                                        if (sourceInclusionsInQuery) {
                                            // Page already from source string (all pages match)
                                            matchesNoteTag = true;
                                        } else {
                                            // Manually check note tags (task tags exist, so couldn't use source string)
                                            matchesNoteTag = pageTags.some(
                                                (pageTag: string) => {
                                                    return inclusionFilters.noteTags!.some(
                                                        (filterTag: string) => {
                                                            return TaskFilterService.tagsMatch(
                                                                pageTag,
                                                                filterTag,
                                                            );
                                                        },
                                                    );
                                                },
                                            );
                                        }
                                    }

                                    // Check 3: Specific note match
                                    const matchesNote =
                                        hasNoteInclusion &&
                                        normalizedIncludedNotes.includes(
                                            TaskFilterService.normalizePathForDataview(
                                                pagePath,
                                            ),
                                        );

                                    // Check 4: Task tag match
                                    let matchesTaskTag = false;
                                    if (hasTaskTagInclusion) {
                                        const taskTags = dvTask.tags || [];
                                        if (taskTags.length > 0) {
                                            matchesTaskTag = taskTags.some(
                                                (taskTag: string) => {
                                                    return inclusionFilters.taskTags!.some(
                                                        (filterTag: string) => {
                                                            return TaskFilterService.tagsMatch(
                                                                taskTag,
                                                                filterTag,
                                                            );
                                                        },
                                                    );
                                                },
                                            );
                                        }
                                    }

                                    // OR logic: include if ANY matches
                                    matchesInclusion =
                                        matchesFolder ||
                                        matchesNoteTag ||
                                        matchesNote ||
                                        matchesTaskTag;

                                    // Debug logging
                                    if (
                                        settings.enableDebugLogging &&
                                        !matchesInclusion
                                    ) {
                                        Logger.debug(
                                            `[DEBUG] Task REJECTED: folder=${matchesFolder}, noteTag=${matchesNoteTag}, note=${matchesNote}, taskTag=${matchesTaskTag}, page="${pagePath}"`,
                                        );
                                    }
                                }

                                // ========================================
                                // FINAL FILTER LOGIC - Combine ALL filters
                                // ========================================
                                // Complete AND/OR Logic:
                                //
                                // EXCLUSIONS (AND logic - all must pass):
                                //   1. Property filters (priority, due, status) - post-query AND
                                //   2. Task tag exclusions - post-query AND
                                //   Combined: Task must pass ALL exclusion checks
                                //
                                // INCLUSIONS (OR logic - any can match):
                                //   1. Folder match - OR
                                //   2. Note tag match - OR
                                //   3. Specific note match - OR
                                //   4. Task tag match - OR
                                //   Combined: Task matches if ANY inclusion criterion met
                                //
                                // FINAL: shouldInclude AND !isTaskTagExcluded AND matchesInclusion
                                //        All exclusions pass AND any inclusion matches
                                //
                                // Example: Include (Folder1 OR #urgent), Exclude (#skip)
                                //   Task in Folder1, no #skip → ✅ INCLUDED (Folder1 match)
                                //   Task in Folder2 with #urgent, no #skip → ✅ INCLUDED (#urgent match)
                                //   Task in Folder1 with #skip → ❌ EXCLUDED (#skip exclusion)
                                //   Task in Folder2, no tags → ❌ EXCLUDED (no inclusion match)
                                // ========================================

                                // Track rejection reasons for debugging
                                if (!shouldInclude) propertyFilterRejects++;
                                if (isTaskTagExcluded) taskTagExclusions++;
                                if (!matchesInclusion)
                                    taskTagInclusionRejects++;

                                // Apply complete filter logic
                                if (
                                    shouldInclude &&
                                    !isTaskTagExcluded &&
                                    matchesInclusion
                                ) {
                                    tasks.push(task);
                                }
                            } else {
                                nullTaskCount++;
                            }
                        }

                        // DEBUG: Log per-page filtering results
                        if (
                            settings.enableDebugLogging &&
                            (nullTaskCount > 0 ||
                                propertyFilterRejects > 0 ||
                                taskTagExclusions > 0 ||
                                taskTagInclusionRejects > 0)
                        ) {
                            Logger.debug(
                                `[DEBUG] Page ${pagePath}: processed=${processedCount} tasks, null=${nullTaskCount}, propertyFilter=${propertyFilterRejects}, taskTagExcluded=${taskTagExclusions}, taskTagInclusionFailed=${taskTagInclusionRejects}`,
                            );
                        }
                    }

                    // CRITICAL DEBUG: Log overall task filtering results
                    Logger.debug(
                        `[DEBUG] Found ${totalTasksFound} items from ${pages.length} pages (tasks + list items)`,
                    );
                    Logger.debug(
                        `[DEBUG] Skipped ${listItemsSkipped} list items (no checkbox)`,
                    );
                    Logger.debug(
                        `[DEBUG] After all filters: ${tasks.length} tasks accepted`,
                    );

                    if (tasks.length > 0) {
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

        return tasks;
    }

    /**
     * Get task count from Dataview with optional filtering
     * Lightweight version that only counts tasks without creating full Task objects
     *
     * PERFORMANCE: 20-30x faster than parseTasksFromDataview because:
     * - No page tag fetching (saves processing time)
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
            priority?: number | number[] | "all" | "none" | null;
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
        const dataviewApi = this.getAPI(app);
        if (!dataviewApi) {
            Logger.warn("Dataview API not available");
            return 0;
        }

        try {
            // Build source string for page-level filtering (reuse existing method)
            const sourceString = this.buildDataviewSourceString(
                settings,
                inclusionFilters,
            );

            // Build post-query filter for task properties (reuse existing method)
            const taskFilter = propertyFilters
                ? this.buildTaskFilter(propertyFilters, settings)
                : null;

            let count = 0;

            // Query pages with source string
            const pages = sourceString
                ? dataviewApi.pages(sourceString)
                : dataviewApi.pages("");

            if (!pages || pages.length === 0) {
                return 0;
            }

            // Process each page's tasks
            for (const page of pages) {
                if (!page.file || !page.file.path) continue;

                // Check note-level exclusions
                if (
                    settings.exclusions.notes &&
                    settings.exclusions.notes.length > 0
                ) {
                    if (settings.exclusions.notes.includes(page.file.path)) {
                        continue;
                    }
                }

                // Check note-level inclusion filters
                if (
                    inclusionFilters?.notes &&
                    inclusionFilters.notes.length > 0
                ) {
                    if (!inclusionFilters.notes.includes(page.file.path)) {
                        continue;
                    }
                }

                // Process tasks on this page
                // IMPORTANT: file.tasks is already flat (includes all subtasks)
                // Just count each valid task once - NO recursion needed!
                if (page.file.tasks && Array.isArray(page.file.tasks)) {
                    for (const dvTask of page.file.tasks) {
                        // Skip invalid tasks
                        if (!this.isValidTask(dvTask)) continue;

                        // Apply task-level exclusions (task tags)
                        if (
                            settings.exclusions.taskTags &&
                            settings.exclusions.taskTags.length > 0
                        ) {
                            const taskTags = dvTask.tags || [];
                            const isExcluded =
                                settings.exclusions.taskTags.some(
                                    (excludedTag) => {
                                        const normalizedExcludedTag =
                                            TaskFilterService.normalizeTag(
                                                excludedTag,
                                            );
                                        return taskTags.some((tag: string) => {
                                            const normalizedTaskTag =
                                                TaskFilterService.normalizeTag(
                                                    tag,
                                                );
                                            return (
                                                normalizedTaskTag ===
                                                normalizedExcludedTag
                                            );
                                        });
                                    },
                                );
                            if (isExcluded) continue;
                        }

                        // Apply task-level inclusion filters (task tags)
                        if (
                            inclusionFilters?.taskTags &&
                            inclusionFilters.taskTags.length > 0
                        ) {
                            const taskTags = dvTask.tags || [];
                            const matchesTaskTag =
                                inclusionFilters.taskTags.some((filterTag) => {
                                    const normalizedFilterTag =
                                        TaskFilterService.normalizeTag(
                                            filterTag,
                                        );
                                    return taskTags.some((tag: string) => {
                                        const normalizedTaskTag =
                                            TaskFilterService.normalizeTag(tag);
                                        return (
                                            normalizedTaskTag ===
                                            normalizedFilterTag
                                        );
                                    });
                                });
                            if (!matchesTaskTag) continue;
                        }

                        // Apply property filters if specified
                        if (taskFilter && !taskFilter(dvTask)) continue;

                        // Count this task (file.tasks is already flat, no recursion needed)
                        count++;
                    }
                }
            }

            Logger.debug(`[Dataview] Task count: ${count}`);
            return count;
        } catch (error) {
            Logger.error("Error getting task count from Dataview:", error);
            return 0;
        }
    }
}
