import { moment } from "obsidian";
import { Task, TaskStatusCategory, DateRange } from "../models/task";
import { PluginSettings } from "../settings";
import * as chrono from "chrono-node";

/**
 * Centralized Task Property Service
 *
 * This service consolidates ALL task property operations (status, priority, due date)
 * that were previously duplicated across multiple services:
 * - DataviewService
 * - TaskSearchService
 * - TaskSortService
 * - PromptBuilderService
 * - PropertyRecognitionService
 * - TaskFilterService
 *
 * Key Principles:
 * 1. Single source of truth for each operation
 * 2. Always respect user settings (taskStatusMapping, dataviewPriorityMapping, etc.)
 * 3. Provide both simple and advanced APIs
 * 4. Maintain backward compatibility
 *
 * Architecture:
 * - Status: Mapping, comparison, extraction, inference
 * - Priority: Mapping, comparison, extraction
 * - Date: Parsing, formatting, comparison, filtering
 * - Combined: Multi-property operations
 */
export class TaskPropertyService {
    // ==========================================
    // STATUS OPERATIONS
    // ==========================================

    /**
     * Map a DataView task status symbol to status category
     * Uses user's configured taskStatusMapping
     *
     * @param symbol - Task status symbol (e.g., "x", "/", "?", " ")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Status category key (e.g., "completed", "inProgress", "open")
     */
    static mapStatusToCategory(
        symbol: string | undefined,
        settings: PluginSettings,
    ): TaskStatusCategory {
        if (!symbol) return "open";

        const cleanSymbol = symbol.replace(/[\[\]]/g, "").trim();

        // Check user's configured status mapping
        for (const [category, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (config && Array.isArray(config.symbols)) {
                if (config.symbols.some((s) => s === cleanSymbol)) {
                    return category as TaskStatusCategory;
                }
            }
        }

        // Default fallback
        if (cleanSymbol === "" || cleanSymbol === " ") {
            return "open";
        }

        return "other";
    }

    /**
     * Get status order for sorting
     * Uses user's custom status categories with smart defaults
     *
     * @param status - Status category
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Order number (lower = higher priority in sorting)
     */
    static getStatusOrder(
        status: string | undefined,
        settings: PluginSettings,
    ): number {
        if (!status) return 999; // Unknown goes last

        const normalized = status.toLowerCase().replace(/[\s-]/g, "");

        // Check if user has this category configured
        for (const [categoryKey, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            const normalizedKey = categoryKey
                .toLowerCase()
                .replace(/[\s-]/g, "");
            if (normalizedKey === normalized) {
                // Use displayName pattern matching for smart ordering
                return this.inferStatusOrderFromPattern(config.displayName);
            }
        }

        // Fallback to hardcoded patterns (if not in user settings)
        return this.inferStatusOrderFromPattern(status);
    }

    /**
     * Infer status sort order from display name pattern
     * Active work (open/inProgress) should appear before finished work
     *
     * @param displayName - Status display name or category
     * @returns Order number for sorting
     */
    private static inferStatusOrderFromPattern(displayName: string): number {
        const lower = displayName.toLowerCase();

        // Active work (highest priority)
        if (
            lower.includes("open") ||
            lower.includes("todo") ||
            lower.includes("待办") ||
            lower.includes("öppen")
        ) {
            return 1;
        }
        if (
            lower.includes("progress") ||
            lower.includes("working") ||
            lower.includes("active") ||
            lower.includes("进行") ||
            lower.includes("pågående")
        ) {
            return 2;
        }

        // Important/urgent (high priority even if not active)
        if (
            lower.includes("important") ||
            lower.includes("urgent") ||
            lower.includes("critical") ||
            lower.includes("重要") ||
            lower.includes("viktig")
        ) {
            return 3;
        }

        // Waiting/blocked (medium priority)
        if (
            lower.includes("wait") ||
            lower.includes("block") ||
            lower.includes("pend") ||
            lower.includes("等待") ||
            lower.includes("väntar")
        ) {
            return 4;
        }

        // Bookmarked (medium-low priority)
        if (
            lower.includes("bookmark") ||
            lower.includes("mark") ||
            lower.includes("star") ||
            lower.includes("书签") ||
            lower.includes("bokmärke")
        ) {
            return 5;
        }

        // Finished work (lower priority)
        if (
            lower.includes("complete") ||
            lower.includes("done") ||
            lower.includes("finish") ||
            lower.includes("完成") ||
            lower.includes("klar")
        ) {
            return 6;
        }
        if (
            lower.includes("cancel") ||
            lower.includes("abandon") ||
            lower.includes("取消") ||
            lower.includes("avbruten")
        ) {
            return 7;
        }

        // Other/unknown (lowest priority)
        return 8;
    }

    /**
     * Infer description for a status category based on display name patterns
     * Used in prompt building for AI understanding
     *
     * @param displayName - Status display name
     * @returns Human-readable description
     */
    static inferStatusDescription(displayName: string): string {
        const lower = displayName.toLowerCase();

        if (lower.includes("open") || lower.includes("todo")) {
            return "Tasks not yet started or awaiting action";
        }
        if (
            lower.includes("progress") ||
            lower.includes("working") ||
            lower.includes("active")
        ) {
            return "Tasks currently being worked on";
        }
        if (
            lower.includes("complete") ||
            lower.includes("done") ||
            lower.includes("finish")
        ) {
            return "Finished tasks";
        }
        if (
            lower.includes("cancel") ||
            lower.includes("abandon") ||
            lower.includes("drop")
        ) {
            return "Tasks that were abandoned or cancelled";
        }
        if (
            lower.includes("important") ||
            lower.includes("urgent") ||
            lower.includes("critical")
        ) {
            return "High-importance or urgent tasks";
        }
        if (
            lower.includes("bookmark") ||
            lower.includes("mark") ||
            lower.includes("star") ||
            lower.includes("flag")
        ) {
            return "Bookmarked or marked tasks for later review";
        }
        if (
            lower.includes("wait") ||
            lower.includes("block") ||
            lower.includes("hold") ||
            lower.includes("pending")
        ) {
            return "Tasks waiting on external dependencies";
        }
        if (lower.includes("other")) {
            return "Tasks with unrecognized or custom status symbols";
        }

        return `Tasks with this status: ${displayName}`;
    }

    /**
     * Infer semantic term suggestions for status (for AI prompts)
     * Provides multilingual synonyms based on display name patterns
     *
     * @param displayName - Status display name
     * @param categoryKey - Category key (fallback)
     * @returns Comma-separated multilingual terms
     */
    static inferStatusTerms(displayName: string, categoryKey: string): string {
        const lower = displayName.toLowerCase();

        if (
            lower.includes("open") ||
            lower.includes("todo") ||
            lower.includes("待办") ||
            lower.includes("öppen")
        ) {
            return "未完成, 待办, öppen, todo, new, unstarted, incomplete";
        }
        if (
            lower.includes("progress") ||
            lower.includes("working") ||
            lower.includes("active") ||
            lower.includes("进行") ||
            lower.includes("pågående")
        ) {
            return "进行中, 正在做, pågående, working, ongoing, active, doing, wip";
        }
        if (
            lower.includes("complete") ||
            lower.includes("done") ||
            lower.includes("finish") ||
            lower.includes("完成") ||
            lower.includes("klar")
        ) {
            return "完成, 已完成, klar, färdig, done, finished, closed, resolved";
        }
        if (
            lower.includes("cancel") ||
            lower.includes("abandon") ||
            lower.includes("drop") ||
            lower.includes("取消") ||
            lower.includes("avbruten")
        ) {
            return "取消, 已取消, avbruten, canceled, abandoned, dropped, discarded";
        }
        if (
            lower.includes("important") ||
            lower.includes("urgent") ||
            lower.includes("critical") ||
            lower.includes("重要") ||
            lower.includes("viktig")
        ) {
            return "重要, 重要的, viktig, betydande, urgent, critical, high-priority, significant, key, essential";
        }
        if (
            lower.includes("bookmark") ||
            lower.includes("mark") ||
            lower.includes("star") ||
            lower.includes("书签") ||
            lower.includes("bokmärke")
        ) {
            return "书签, 标记, bokmärke, märkt, marked, starred, flagged, saved, pinned";
        }
        if (
            lower.includes("wait") ||
            lower.includes("block") ||
            lower.includes("pend") ||
            lower.includes("等待") ||
            lower.includes("väntar")
        ) {
            return "等待, 待定, väntar, väntande, blocked, pending, on-hold, deferred, postponed";
        }
        if (
            lower.includes("other") ||
            lower.includes("其他") ||
            lower.includes("övrig")
        ) {
            return "其他, övrig, unrecognized, misc, other";
        }

        return `${displayName.toLowerCase()}, ${categoryKey.toLowerCase()}`;
    }

    // ==========================================
    // PRIORITY OPERATIONS
    // ==========================================

    /**
     * Map a DataView priority value to internal numeric priority
     * Uses user's configured dataviewPriorityMapping
     *
     * @param value - Priority value (can be string or number)
     * @param settings - Plugin settings with dataviewPriorityMapping
     * @returns Priority number: 1 (highest), 2 (high), 3 (medium), 4 (low), undefined (none)
     */
    static mapPriority(
        value: any,
        settings: PluginSettings,
    ): number | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        const strValue = String(value).toLowerCase().trim();

        // Check user's configured priority mapping
        for (const [priority, values] of Object.entries(
            settings.dataviewPriorityMapping,
        )) {
            if (values.some((v) => v.toLowerCase() === strValue)) {
                return parseInt(priority);
            }
        }

        return undefined;
    }

    /**
     * Compare priorities for sorting
     * Lower number = higher priority (1 is highest)
     *
     * @param a - First priority
     * @param b - Second priority
     * @returns Comparison result for sorting
     */
    static comparePriority(
        a: number | undefined,
        b: number | undefined,
    ): number {
        const aPriority = a ?? 5; // Undefined = lowest priority (5)
        const bPriority = b ?? 5;
        return aPriority - bPriority;
    }

    // ==========================================
    // DATE OPERATIONS
    // ==========================================

    /**
     * Format date to consistent string format
     * Handles multiple date object types (Date, moment, Dataview, string)
     *
     * @param date - Date to format (various types supported)
     * @param format - Optional format string (default: YYYY-MM-DD)
     * @returns Formatted date string or undefined
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

            // Handle objects with .format() method (moment/luxon)
            if (
                date &&
                typeof date === "object" &&
                typeof date.format === "function"
            ) {
                return format ? date.format(format) : date.format("YYYY-MM-DD");
            }

            // Handle Dataview date objects (toString() but not .format())
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
     * Parse date string using multiple strategies
     * Unified parser combining chrono-node and moment
     *
     * @param dateStr - Date string to parse
     * @returns Formatted date (YYYY-MM-DD) or null
     */
    static parseDate(dateStr: string): string | null {
        if (!dateStr) return null;

        // Strategy 1: Try chrono-node (natural language dates)
        try {
            const chronoParsed = chrono.parseDate(dateStr);
            if (chronoParsed) {
                const parsed = moment(chronoParsed);
                if (parsed.isValid()) {
                    return parsed.format("YYYY-MM-DD");
                }
            }
        } catch (e) {
            // Continue to fallback
        }

        // Strategy 2: Try moment parsing
        const parsed = moment(dateStr);
        if (parsed.isValid()) {
            return parsed.format("YYYY-MM-DD");
        }

        return null;
    }

    /**
     * Compare dates for sorting
     * Undefined dates go to the end
     *
     * @param a - First date
     * @param b - Second date
     * @returns Comparison result for sorting
     */
    static compareDates(a: string | undefined, b: string | undefined): number {
        if (!a && !b) return 0;
        if (!a) return 1; // a goes to end
        if (!b) return -1; // b goes to end
        return a.localeCompare(b);
    }

    /**
     * Check if task matches date range filter
     *
     * @param task - Task to check
     * @param dateRange - Date range filter (null = no filter)
     * @returns True if task matches
     */
    static matchesDateRange(
        task: Task,
        dateRange: { start?: string; end?: string } | null,
    ): boolean {
        if (!dateRange) return true; // No filter

        // Empty object = "any" filter (task must have a due date)
        if (Object.keys(dateRange).length === 0) {
            return !!task.dueDate;
        }

        if (!task.dueDate) return false;

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
     * Convert date filter to Dataview date range query
     * Handles: today, tomorrow, overdue, week, next-week, future, any, +Nd/+Nw/+Nm, specific dates
     *
     * @param dateFilter - Date filter string
     * @returns Date range or null
     */
    static convertDateFilterToRange(dateFilter: string): DateRange | null {
        const today = moment().startOf("day");

        switch (dateFilter) {
            case "any":
                return {}; // Will check for existence

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
                // Try relative date patterns
                const relativeRange = this.parseRelativeDateRange(
                    dateFilter,
                    today,
                );
                if (relativeRange) return relativeRange;

                // Try natural language parsing
                const chronoParsed = chrono.parseDate(dateFilter);
                if (chronoParsed) {
                    const chronoDate = moment(chronoParsed).startOf("day");
                    if (chronoDate.isValid()) {
                        return {
                            start: chronoDate.format("YYYY-MM-DD"),
                            end: chronoDate.format("YYYY-MM-DD"),
                        };
                    }
                }

                // Try specific date (YYYY-MM-DD)
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
     * Parse relative date ranges
     * Supports: "5 days ago", "within 5 days", "next 2 weeks", "+3d", "-3d", etc.
     *
     * @param dateFilter - Date filter string
     * @param today - Reference date (usually current date)
     * @returns Date range or null
     */
    static parseRelativeDateRange(
        dateFilter: string,
        today: moment.Moment,
    ): DateRange | null {
        const lowerFilter = dateFilter.toLowerCase().trim();

        // Pattern 1: DataView duration (7d, 2w, 3mo, 1yr)
        const durationPattern =
            /^(\d+)\s*(d|day|days|w|wk|wks|week|weeks|mo|month|months|yr|yrs|year|years)$/;
        const durationMatch = lowerFilter.match(durationPattern);
        if (durationMatch) {
            const amount = parseInt(durationMatch[1]);
            const unit = durationMatch[2];
            const momentUnit = unit.startsWith("d")
                ? "days"
                : unit.startsWith("w")
                  ? "weeks"
                  : unit.startsWith("mo")
                    ? "months"
                    : unit.startsWith("yr")
                      ? "years"
                      : "days";

            const futureDate = today
                .clone()
                .add(
                    amount,
                    momentUnit as moment.unitOfTime.DurationConstructor,
                );
            return {
                start: today.format("YYYY-MM-DD"),
                end: futureDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 2: Todoist-style "+3 days" or "-3 days"
        const todoistMatch = lowerFilter.match(
            /^([+-])?(\d+)\s+(day|days|week|weeks)$/,
        );
        if (todoistMatch) {
            const sign = todoistMatch[1] || "+";
            const amount = parseInt(todoistMatch[2]);
            const unit = todoistMatch[3].startsWith("week") ? "weeks" : "days";

            if (sign === "+") {
                const futureDate = today.clone().add(amount, unit);
                return {
                    start: today.format("YYYY-MM-DD"),
                    end: futureDate.format("YYYY-MM-DD"),
                };
            } else {
                const pastDate = today.clone().subtract(amount, unit);
                return {
                    start: pastDate.format("YYYY-MM-DD"),
                    end: today.format("YYYY-MM-DD"),
                };
            }
        }

        // Pattern 3: "X days/weeks/months ago"
        const agoMatch = lowerFilter.match(
            /(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/,
        );
        if (agoMatch) {
            const amount = parseInt(agoMatch[1]);
            const unit = agoMatch[2].startsWith("week")
                ? "weeks"
                : agoMatch[2].startsWith("month")
                  ? "months"
                  : agoMatch[2].startsWith("year")
                    ? "years"
                    : "days";
            const pastDate = today.clone().subtract(amount, unit);
            return {
                start: pastDate.format("YYYY-MM-DD"),
                end: pastDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 4: "within X days/weeks"
        const withinMatch = lowerFilter.match(
            /within\s+(\d+)\s+(day|days|week|weeks|month|months)/,
        );
        if (withinMatch) {
            const amount = parseInt(withinMatch[1]);
            const unit = withinMatch[2].startsWith("week")
                ? "weeks"
                : withinMatch[2].startsWith("month")
                  ? "months"
                  : "days";
            const futureDate = today.clone().add(amount, unit);
            return {
                start: today.format("YYYY-MM-DD"),
                end: futureDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 5: "next X days/weeks/months"
        const nextMatch = lowerFilter.match(
            /next\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/,
        );
        if (nextMatch) {
            const amount = parseInt(nextMatch[1]);
            const unit = nextMatch[2].startsWith("week")
                ? "weeks"
                : nextMatch[2].startsWith("month")
                  ? "months"
                  : nextMatch[2].startsWith("year")
                    ? "years"
                    : "days";
            const futureDate = today.clone().add(amount, unit);
            return {
                start: today.format("YYYY-MM-DD"),
                end: futureDate.format("YYYY-MM-DD"),
            };
        }

        // Pattern 6: "last X days/weeks"
        const lastMatch = lowerFilter.match(
            /last\s+(\d+)\s+(day|days|week|weeks|month|months)/,
        );
        if (lastMatch) {
            const amount = parseInt(lastMatch[1]);
            const unit = lastMatch[2].startsWith("week")
                ? "weeks"
                : lastMatch[2].startsWith("month")
                  ? "months"
                  : "days";
            const pastDate = today.clone().subtract(amount, unit);
            return {
                start: pastDate.format("YYYY-MM-DD"),
                end: today.format("YYYY-MM-DD"),
            };
        }

        return null;
    }

    /**
     * Filter tasks by due date
     * Handles: any, today, tomorrow, overdue, future, week, next-week, +Nd/+Nw/+Nm, specific dates
     *
     * @param tasks - Tasks to filter
     * @param filter - Date filter string
     * @returns Filtered tasks
     */
    static filterByDueDate(tasks: Task[], filter: string): Task[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Special case: "any" means tasks WITH a due date
        if (filter === "any") {
            return tasks.filter(
                (task) =>
                    task.dueDate !== undefined &&
                    task.dueDate !== null &&
                    task.dueDate !== "",
            );
        }

        return tasks.filter((task) => {
            if (!task.dueDate) return false;

            // Parse date in local timezone
            let dueDate: Date;
            if (task.dueDate.includes("T") || task.dueDate.includes(" ")) {
                dueDate = new Date(task.dueDate);
            } else {
                const parts = task.dueDate.split("-");
                dueDate = new Date(
                    parseInt(parts[0]),
                    parseInt(parts[1]) - 1,
                    parseInt(parts[2]),
                );
            }
            dueDate.setHours(0, 0, 0, 0);

            switch (filter) {
                case "overdue":
                    return dueDate < today;
                case "future":
                    return dueDate > today;
                case "today":
                    return dueDate.getTime() === today.getTime();
                case "tomorrow": {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return dueDate.getTime() === tomorrow.getTime();
                }
                case "week": {
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    return dueDate >= today && dueDate <= weekEnd;
                }
                case "next-week": {
                    const nextWeekStart = new Date(today);
                    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
                    const nextWeekEnd = new Date(today);
                    nextWeekEnd.setDate(nextWeekEnd.getDate() + 14);
                    return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
                }
                default:
                    // Handle relative dates (+Nd, +Nw, +Nm)
                    if (filter.startsWith("+")) {
                        const relativeMatch = filter.match(/^\+(\d+)([dwm])$/);
                        if (relativeMatch) {
                            const amount = parseInt(relativeMatch[1]);
                            const unit = relativeMatch[2];
                            const targetDate = new Date(today);
                            if (unit === "d") {
                                targetDate.setDate(
                                    targetDate.getDate() + amount,
                                );
                            } else if (unit === "w") {
                                targetDate.setDate(
                                    targetDate.getDate() + amount * 7,
                                );
                            } else if (unit === "m") {
                                targetDate.setMonth(
                                    targetDate.getMonth() + amount,
                                );
                            }
                            targetDate.setHours(0, 0, 0, 0);
                            return dueDate.getTime() === targetDate.getTime();
                        }
                    }

                    // Try specific date match
                    try {
                        const targetDate = new Date(filter);
                        targetDate.setHours(0, 0, 0, 0);
                        if (!isNaN(targetDate.getTime())) {
                            return dueDate.getTime() === targetDate.getTime();
                        }
                    } catch (e) {
                        // Invalid date format
                    }
                    return false;
            }
        });
    }
}
