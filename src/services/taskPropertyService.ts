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
     * Default configurations for built-in status categories
     * Used when user hasn't explicitly configured order/description/terms
     * Based on category KEY (stable), not display name (user-defined)
     */
    private static readonly DEFAULT_STATUS_CONFIG: Record<
        string,
        { order: number; description: string; terms: string }
    > = {
        open: {
            order: 1,
            description: "Tasks not yet started or awaiting action",
            terms: "open, todo, pending, new, unstarted, incomplete, not started, to do, 待办, 未完成, öppen",
        },
        inProgress: {
            order: 2,
            description: "Tasks currently being worked on",
            terms: "inprogress, in-progress, wip, doing, active, working, ongoing, current, 进行中, 正在做, pågående",
        },
        completed: {
            order: 6,
            description: "Tasks that have been finished",
            terms: "completed, done, finished, closed, resolved, complete, 完成, 已完成, klar, färdig",
        },
        cancelled: {
            order: 7,
            description: "Tasks that were abandoned or cancelled",
            terms: "cancelled, canceled, abandoned, dropped, discarded, rejected, 取消, 已取消, avbruten",
        },
    };

    // ==========================================
    // CENTRALIZED CONSTANTS
    // ==========================================

    /**
     * Standard date field names (DataView compatible)
     * Used across dataviewService, taskFilterService, propertyRecognitionService
     */
    static readonly DATE_FIELDS = {
        due: ["due", "dueDate", "deadline", "scheduled"],
        completion: ["completion", "completed", "completedDate"],
        created: ["created", "createdDate"],
        start: ["start", "startDate"],
        scheduled: ["scheduled", "scheduledDate"],
    } as const;

    /**
     * Date field emoji patterns for extraction
     * Used in dataviewService for extracting dates from task text
     */
    static readonly DATE_EMOJI_PATTERNS = {
        due: /🗓️\s*(\d{4}-\d{2}-\d{2})/,
        completion: /✅\s*(\d{4}-\d{2}-\d{2})/,
        created: /➕\s*(\d{4}-\d{2}-\d{2})/,
        start: /🛫\s*(\d{4}-\d{2}-\d{2})/,
        scheduled: /⏳\s*(\d{4}-\d{2}-\d{2})/,
    } as const;

    /**
     * Priority field names
     * Used across multiple services for priority extraction
     */
    static readonly PRIORITY_FIELDS = {
        primary: "priority",
        aliases: ["p", "pri", "prio"],
    } as const;

    /**
     * Base priority terms (English, Chinese, Swedish)
     * These are COMBINED with user's configured terms via getCombinedPriorityTerms()
     */
    private static readonly BASE_PRIORITY_TERMS = {
        general: [
            "priority",
            "important",
            "urgent",
            "优先级",
            "优先",
            "重要",
            "紧急",
            "prioritet",
            "viktig",
            "brådskande",
        ],
        high: [
            "high",
            "highest",
            "critical",
            "top",
            "高",
            "最高",
            "关键",
            "首要",
            "hög",
            "högst",
            "kritisk",
        ],
        medium: ["medium", "normal", "中", "中等", "普通", "medel", "normal"],
        low: ["low", "minor", "低", "次要", "不重要", "låg", "mindre"],
    } as const;

    /**
     * Base due date terms (English, Chinese, Swedish)
     * These are COMBINED with user's configured terms via getCombinedDueDateTerms()
     */
    private static readonly BASE_DUE_DATE_TERMS = {
        general: [
            "due",
            "deadline",
            "scheduled",
            "截止日期",
            "到期",
            "期限",
            "计划",
            "förfallodatum",
            "deadline",
            "schemalagd",
        ],
        today: ["today", "今天", "今日", "idag"],
        tomorrow: ["tomorrow", "明天", "imorgon"],
        overdue: [
            "overdue",
            "late",
            "past due",
            "过期",
            "逾期",
            "延迟",
            "försenad",
            "sen",
        ],
        thisWeek: ["this week", "本周", "这周", "denna vecka"],
        nextWeek: ["next week", "下周", "nästa vecka"],
        future: [
            "future",
            "upcoming",
            "later",
            "未来",
            "将来",
            "以后",
            "framtida",
            "kommande",
        ],
    } as const;

    /**
     * Base status terms (English, Chinese, Swedish)
     * Note: For status, we also have user's custom categories with their own terms!
     */
    private static readonly BASE_STATUS_TERMS = {
        general: [
            "status",
            "state",
            "progress",
            "状态",
            "进度",
            "情况",
            "status",
            "tillstånd",
            "progress",
        ],
    } as const;

    /**
     * Regex patterns for query syntax recognition
     * Used in queryParserService and taskSearchService
     */
    static readonly QUERY_PATTERNS = {
        priority: /\bp[1-4]\b/gi,
        status: /\bs:[^\s&|]+/gi,
        project: /##+[A-Za-z0-9_-]+/g,
        search: /search:\s*["']?[^"'&|]+["']?/gi,
        hashtag: /#([\w-]+)/g,
        dueBeforeRange: /due\s+before:\s*[^&|]+/gi,
        dueAfterRange: /due\s+after:\s*[^&|]+/gi,
        dateBeforeRange: /(?<!due\s)date\s+before:\s*[^&|]+/gi,
        dateAfterRange: /(?<!due\s)date\s+after:\s*[^&|]+/gi,
        operators: /[&|!]/g,
        specialKeywordOverdue: /\b(overdue|over\s+due|od)\b/gi,
        specialKeywordRecurring: /\brecurring\b/gi,
        specialKeywordSubtask: /\bsubtask\b/gi,
        specialKeywordNoDate: /\bno\s+date\b/gi,
        specialKeywordNoPriority: /\bno\s+priority\b/gi,
    } as const;

    /**
     * Special keywords recognized in queries
     */
    static readonly SPECIAL_KEYWORDS = [
        "overdue",
        "over due",
        "od",
        "recurring",
        "subtask",
        "no date",
        "no priority",
    ] as const;

    // ==========================================
    // COMBINED TERM METHODS (Base + User Settings)
    // ==========================================

    /**
     * Get combined priority terms (base + user-configured)
     * Used in property recognition and AI prompts
     *
     * @param settings - Plugin settings with user-configured terms
     * @returns Combined priority terms across all categories
     */
    static getCombinedPriorityTerms(settings: PluginSettings): {
        general: string[];
        high: string[];
        medium: string[];
        low: string[];
    } {
        return {
            general: [
                ...this.BASE_PRIORITY_TERMS.general,
                ...settings.userPropertyTerms.priority,
            ],
            high: [...this.BASE_PRIORITY_TERMS.high],
            medium: [...this.BASE_PRIORITY_TERMS.medium],
            low: [...this.BASE_PRIORITY_TERMS.low],
        };
    }

    /**
     * Get combined due date terms (base + user-configured)
     * Used in property recognition and AI prompts
     *
     * @param settings - Plugin settings with user-configured terms
     * @returns Combined due date terms across all time periods
     */
    static getCombinedDueDateTerms(settings: PluginSettings): {
        general: string[];
        today: string[];
        tomorrow: string[];
        overdue: string[];
        thisWeek: string[];
        nextWeek: string[];
        future: string[];
    } {
        return {
            general: [
                ...this.BASE_DUE_DATE_TERMS.general,
                ...settings.userPropertyTerms.dueDate,
            ],
            today: [...this.BASE_DUE_DATE_TERMS.today],
            tomorrow: [...this.BASE_DUE_DATE_TERMS.tomorrow],
            overdue: [...this.BASE_DUE_DATE_TERMS.overdue],
            thisWeek: [...this.BASE_DUE_DATE_TERMS.thisWeek],
            nextWeek: [...this.BASE_DUE_DATE_TERMS.nextWeek],
            future: [...this.BASE_DUE_DATE_TERMS.future],
        };
    }

    /**
     * Get combined status terms (base + user-configured + category terms)
     * Used in property recognition and AI prompts
     *
     * @param settings - Plugin settings with user-configured terms and status categories
     * @returns Combined status terms including all custom categories
     */
    static getCombinedStatusTerms(settings: PluginSettings): {
        general: string[];
        [categoryKey: string]: string[];
    } {
        const result: { general: string[]; [key: string]: string[] } = {
            general: [
                ...this.BASE_STATUS_TERMS.general,
                ...settings.userPropertyTerms.status,
            ],
        };

        // Add terms from each status category
        for (const [categoryKey, config] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (config) {
                const terms = this.inferStatusTerms(categoryKey, settings);
                result[categoryKey] = terms.split(", ");
            }
        }

        return result;
    }

    /**
     * Get all priority field names to check
     * Combines primary field + aliases + user's configured DataView key
     *
     * @param settings - Plugin settings
     * @returns Array of field names to check for priority
     */
    static getAllPriorityFieldNames(settings: PluginSettings): string[] {
        return [
            settings.dataviewKeys.priority,
            this.PRIORITY_FIELDS.primary,
            ...this.PRIORITY_FIELDS.aliases,
        ];
    }

    /**
     * Get all due date field names to check
     * Returns user's configured DataView key + standard aliases
     *
     * @param settings - Plugin settings
     * @returns Array of field names to check for due dates
     */
    static getAllDueDateFieldNames(settings: PluginSettings): string[] {
        return [settings.dataviewKeys.dueDate, ...this.DATE_FIELDS.due];
    }


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
     * Uses category key (stable) instead of display name (user-defined)
     * Priority: User config > Built-in defaults > Generic fallback
     *
     * @param categoryKey - Status category key (e.g., "open", "inProgress", "myCustom")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Order number (lower = higher priority in sorting)
     */
    static getStatusOrder(
        categoryKey: string | undefined,
        settings: PluginSettings,
    ): number {
        if (!categoryKey) return 999; // Unknown goes last

        const config = settings.taskStatusMapping[categoryKey];
        if (!config) return 999; // Category not found

        // 1. Use explicit order if configured by user
        if (config.order !== undefined) {
            return config.order;
        }

        // 2. Use built-in default if available
        const defaultConfig = this.DEFAULT_STATUS_CONFIG[categoryKey];
        if (defaultConfig) {
            return defaultConfig.order;
        }

        // 3. Generic fallback for custom categories
        return 8; // Custom categories appear after built-in ones
    }

    /**
     * Get description for a status category
     * Uses category key (stable) instead of display name (user-defined)
     * Priority: User config > Built-in defaults > Generic fallback
     * Used in AI prompts to help AI understand category meaning
     *
     * @param categoryKey - Status category key (e.g., "open", "inProgress", "myCustom")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Human-readable description for AI prompts
     */
    static inferStatusDescription(
        categoryKey: string,
        settings: PluginSettings,
    ): string {
        const config = settings.taskStatusMapping[categoryKey];
        if (!config) {
            return `Tasks with ${categoryKey} status`; // Fallback for unknown category
        }

        // 1. Use explicit description if configured by user
        if (config.description) {
            return config.description;
        }

        // 2. Use built-in default if available
        const defaultConfig = this.DEFAULT_STATUS_CONFIG[categoryKey];
        if (defaultConfig) {
            return defaultConfig.description;
        }

        // 3. Generic fallback for custom categories
        return `Tasks with ${config.displayName} status`;
    }

    /**
     * Get semantic terms for a status category
     * Uses category key (stable) instead of display name (user-defined)
     * Priority: User config > Built-in defaults > Generic fallback
     * Used in AI prompts and property recognition for multilingual matching
     *
     * @param categoryKey - Status category key (e.g., "open", "inProgress", "myCustom")
     * @param settings - Plugin settings with taskStatusMapping
     * @returns Comma-separated multilingual semantic terms
     */
    static inferStatusTerms(
        categoryKey: string,
        settings: PluginSettings,
    ): string {
        const config = settings.taskStatusMapping[categoryKey];
        if (!config) {
            return categoryKey; // Fallback for unknown category
        }

        // 1. Use explicit terms if configured by user
        if (config.terms) {
            return config.terms;
        }

        // 2. Use built-in default if available
        const defaultConfig = this.DEFAULT_STATUS_CONFIG[categoryKey];
        if (defaultConfig) {
            return defaultConfig.terms;
        }

        // 3. Generic fallback for custom categories
        // Combine category key, display name, and aliases for maximum coverage
        const parts = [
            categoryKey.toLowerCase(),
            config.displayName.toLowerCase(),
        ];
        if (config.aliases) {
            parts.push(config.aliases.toLowerCase());
        }
        return parts.join(", ");
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
