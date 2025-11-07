import { App } from "obsidian";
import { Task, TaskFilter, DateRange } from "../../models/task";
import { PluginSettings } from "../../settings";
import { DatacoreService } from "./datacoreService";
import { TaskPropertyService } from "./taskPropertyService";
import { Logger } from "../../utils/logger";

/**
 * Moment.js instance type (from window.moment)
 */
interface MomentInstance {
    valueOf(): number;
    format(_format: string): string;
    startOf(_unit: string): MomentInstance;
    endOf(_unit: string): MomentInstance;
}

/**
 * Moment.js function type (callable function that returns a Moment instance)
 */
type MomentFn = {
    (): MomentInstance;
    (_date?: string | Date | number): MomentInstance;
};

/**
 * Global window extensions for Obsidian plugins
 */
interface WindowWithPlugins extends Window {
    datacore?: {
        core?: {
            initialized?: boolean;
        };
        [key: string]: unknown;
    };
    moment?: MomentFn;
}

declare const window: WindowWithPlugins;

/**
 * Property filters for Datacore query
 */
interface PropertyFilters {
    priority?: number | number[] | "none";
    dueDateRange?: DateRange | null;
    status?: string | string[];
    statusValues?: string[] | null;
    statusExclusions?: string[] | null;
}

/**
 * Inclusion filters for task filtering
 */
interface InclusionFilters {
    folders?: string[];
    noteTags?: string[];
    taskTags?: string[];
    notes?: string[];
}

/**
 * Unified Task Indexing Service
 *
 * Provides task indexing using Datacore API.
 *
 * Provides a unified interface for the rest of the plugin.
 *
 * Features:
 * - Query result caching (2-second TTL for rapid repeated queries)
 * - Automatic cache cleanup
 * - Minimal memory overhead (only caches filtered subsets)
 */
export class TaskIndexService {
    /**
     * Query result cache with 2-second TTL
     * Key: JSON stringified filters
     * Value: { tasks: Task[], timestamp: number }
     */
    private static queryCache = new Map<
        string,
        { tasks: Task[]; timestamp: number }
    >();

    /**
     * Cache TTL in milliseconds (2 seconds)
     */
    private static readonly CACHE_TTL = 2000;

    /**
     * Check if Datacore is available
     * @returns true if Datacore is enabled
     */
    static isDatacoreAvailable(): boolean {
        return DatacoreService.isDatacoreEnabled();
    }

    /**
     * Check if any task indexing API is available
     * @returns true if Datacore is available, false otherwise
     */
    static isAnyAPIAvailable(): boolean {
        return this.isDatacoreAvailable();
    }

    /**
     * Determine if API is ready (available AND initialized)
     * Checks both API availability and completion of indexing
     * @returns true if Datacore is available and finished indexing, false otherwise
     */
    static isAPIReady(): boolean {
        if (!this.isDatacoreAvailable()) {
            return false;
        }

        // Check if Datacore has finished indexing
        // Per Datacore API structure: window.datacore.core.initialized
        // The initialized property is on the core object, not on datacore directly
        const dc = window.datacore;
        return dc?.core?.initialized === true;
    }

    /**
     * Get human-readable status message for Datacore API
     */
    static getAPIStatus(): string {
        if (!this.isDatacoreAvailable()) {
            return "⚠️ Datacore not available - please install Datacore plugin";
        }

        const dc = window.datacore;
        if (dc?.core?.initialized === true) {
            return "✓ Using Datacore (ready)";
        }

        return "⏳ Datacore is indexing...";
    }

    /**
     * Get detailed status information for settings UI
     */
    static getDetailedStatus(): {
        datacoreAvailable: boolean;
        activeAPI: boolean;
        message: string;
    } {
        const available = this.isDatacoreAvailable();
        const ready = this.isAPIReady();

        return {
            datacoreAvailable: available,
            activeAPI: ready, // Only active if initialized
            message: this.getAPIStatus(),
        };
    }

    /**
     * Parse all tasks from Datacore
     * This is the main entry point used throughout the plugin
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param dateFilter - Optional date filter (legacy parameter)
     * @param propertyFilters - Optional property filters
     * @param inclusionFilters - Optional inclusion filters
     * @param qualityThreshold - Optional quality threshold for filtering
     * @param keywords - Optional keywords for relevance filtering
     * @param coreKeywords - Optional core keywords for relevance filtering
     * @param minimumRelevanceScore - Optional minimum relevance score
     * @param maxResults - Optional maximum results for early limiting at API level
     * @returns Array of tasks
     */
    static async parseTasksFromIndex(
        app: App,
        settings: PluginSettings,
        dateFilter?: string,
        propertyFilters?: {
            priority?: number | number[] | "all" | "any" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: DateRange | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
            statusExclusions?: string[] | null;
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
        if (!this.isDatacoreAvailable()) {
            Logger.error("Cannot fetch tasks: Datacore not available");
            return [];
        }

        // Check if Datacore is initialized (finished indexing)
        // Querying while indexing can cause severe performance issues in large vaults
        if (!this.isAPIReady()) {
            Logger.warn(
                "Datacore is still indexing. Skipping query to avoid performance issues.",
            );
            return [];
        }

        // Generate cache key from filters (exclude settings for faster key generation)
        const cacheKey = JSON.stringify({
            dateFilter,
            propertyFilters,
            inclusionFilters,
            exclusions: settings.exclusions, // Include exclusions as they affect results
        });

        // Check cache
        const cached = this.queryCache.get(cacheKey);
        const moment = window.moment;
        if (!moment) {
            Logger.warn(
                "[TaskIndex] window.moment is not available, cache check skipped",
            );
            // Proceed without cache
        }
        const now = moment ? moment().valueOf() : Date.now();

        if (cached && now - cached.timestamp < this.CACHE_TTL) {
            Logger.debug(
                `Query cache HIT (age: ${now - cached.timestamp}ms, ${cached.tasks.length} tasks)`,
            );
            return cached.tasks;
        }

        // Clean up expired cache entries (keep cache size small)
        this.cleanupExpiredCache();

        try {
            Logger.debug(
                "Fetching tasks from Datacore (with API-level quality/relevance filtering and early limiting)",
            );
            const tasks = await DatacoreService.parseTasksFromDatacore(
                app,
                settings,
                dateFilter,
                propertyFilters,
                inclusionFilters,
                qualityThreshold,
                keywords,
                coreKeywords,
                minimumRelevanceScore,
                maxResults,
            );

            // Cache the results
            this.queryCache.set(cacheKey, { tasks, timestamp: now });
            Logger.debug(
                `Query cached (${tasks.length} tasks, TTL: ${this.CACHE_TTL}ms)`,
            );

            return tasks;
        } catch (error) {
            Logger.error("Error fetching tasks from Datacore:", error);
            return [];
        }
    }

    /**
     * Clean up expired cache entries to prevent memory leaks
     * Only keeps entries that are still valid
     */
    private static cleanupExpiredCache(): void {
        const moment = window.moment;
        if (!moment) {
            return; // Cannot cleanup without moment
        }
        const now = moment().valueOf();
        let cleanedCount = 0;

        for (const [key, value] of this.queryCache.entries()) {
            if (now - value.timestamp >= this.CACHE_TTL) {
                this.queryCache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            Logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
        }
    }

    /**
     * Clear all cached query results
     * Useful when settings change or manual refresh is triggered
     */
    static clearQueryCache(): void {
        const size = this.queryCache.size;
        this.queryCache.clear();
        if (size > 0) {
            Logger.debug(`Cleared query cache (${size} entries removed)`);
        }
    }

    /**
     * Wait for Datacore to be ready
     * Checks Datacore with appropriate timeout
     *
     * @param maxAttempts - Maximum number of polling attempts (default: 20 = 10 seconds)
     * @returns true if Datacore is ready, false if timeout
     */
    static async waitForAPI(maxAttempts = 20): Promise<boolean> {
        for (let i = 0; i < maxAttempts; i++) {
            if (this.isDatacoreAvailable()) {
                Logger.info(`Datacore ready (attempt ${i + 1}/${maxAttempts})`);
                return true;
            }

            if (i === 0) {
                Logger.debug("Waiting for Datacore...");
            } else {
                Logger.debug(
                    `Still waiting for Datacore... (attempt ${i + 1}/${maxAttempts})`,
                );
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        Logger.error("Datacore not available after waiting 10 seconds");
        return false;
    }

    /**
     * Get recommendation message for users
     * Helps users understand they need Datacore
     */
    static getRecommendationMessage(): string | null {
        if (!this.isDatacoreAvailable()) {
            return "⚠️ Datacore is required for Task Chat. Please install the Datacore plugin from Community Plugins.";
        }

        return null;
    }

    /**
     * Build property filters from TaskFilter
     * Shared utility used by both parseTasksFromIndex() and getTaskCount()
     *
     * CRITICAL: This method converts UI filter values to API-level PropertyFilters:
     * - Priority: String array ["1", "2", "none"] -> Number array [1, 2, "none"]
     * - Status: Category keys ["open", "completed"] -> Symbols [" ", "x", "X", ...]
     * - Date Range: Direct passthrough
     *
     * @param filter - TaskFilter from UI (filterModal.ts)
     * @param settings - Plugin settings (needed for status category -> symbol mapping)
     * @returns PropertyFilters for Datacore query or undefined if no filters
     */
    static buildPropertyFilters(
        filter: TaskFilter,
        settings: PluginSettings,
    ): PropertyFilters | undefined {
        const propertyFilters: PropertyFilters = {};

        // Priority Filter: Convert string priorities to numbers
        if (filter.priorities && filter.priorities.length > 0) {
            const priorityValues: (number | "none")[] = filter.priorities.map(
                (p: string) => (p === "none" ? "none" : parseInt(p)),
            );
            // Simplify single-value arrays to scalar for cleaner query building
            if (priorityValues.length === 1) {
                propertyFilters.priority = priorityValues[0];
            } else {
                // Filter out "none" from multi-value arrays as it doesn't make sense with other values
                const numericPriorities = priorityValues.filter(
                    (p): p is number => typeof p === "number",
                );
                propertyFilters.priority =
                    numericPriorities.length > 0
                        ? numericPriorities
                        : undefined;
            }
        }

        // Date Range Filter: Direct passthrough (already in correct format)
        if (filter.dueDateRange) {
            propertyFilters.dueDateRange = filter.dueDateRange;
        }

        // Status Filter: Convert category keys to symbols
        // IMPORTANT: Filter UI stores category keys (e.g., "open", "completed")
        // but Datacore query needs status symbols (e.g., " ", "x", "X")
        // Uses centralized conversion method from TaskPropertyService
        if (filter.taskStatuses && filter.taskStatuses.length > 0) {
            const converted =
                TaskPropertyService.convertStatusCategoriesToSymbols(
                    filter.taskStatuses,
                    settings,
                );

            // Apply converted symbols and exclusions
            if (converted.statusValues) {
                propertyFilters.statusValues = converted.statusValues;
            }
            if (converted.statusExclusions) {
                propertyFilters.statusExclusions = converted.statusExclusions;
            }
        }

        const hasFilters = Object.keys(propertyFilters).length > 0;

        if (hasFilters) {
            Logger.debug(
                `[buildPropertyFilters] Built property filters:`,
                propertyFilters,
            );
        } else {
            Logger.debug(
                `[buildPropertyFilters] No property filters (empty filter)`,
            );
        }

        return hasFilters ? propertyFilters : undefined;
    }

    /**
     * Build inclusion filters from TaskFilter
     * Shared utility used by both parseTasksFromIndex() and getTaskCount()
     */
    static buildInclusionFilters(
        filter: TaskFilter,
    ): InclusionFilters | undefined {
        const inclusionFilters: InclusionFilters = {};

        if (filter.folders && filter.folders.length > 0) {
            inclusionFilters.folders = filter.folders;
        }
        if (filter.noteTags && filter.noteTags.length > 0) {
            inclusionFilters.noteTags = filter.noteTags;
        }
        if (filter.taskTags && filter.taskTags.length > 0) {
            inclusionFilters.taskTags = filter.taskTags;
        }
        if (filter.notes && filter.notes.length > 0) {
            inclusionFilters.notes = filter.notes;
        }

        return Object.keys(inclusionFilters).length > 0
            ? inclusionFilters
            : undefined;
    }

    /**
     * Get task count from Datacore (lightweight)
     * Main entry point for counting tasks throughout the plugin
     *
     * PERFORMANCE: 20-30x faster than parseTasksFromIndex because:
     * - No page tag fetching (saves 1-3 seconds in large vaults)
     * - No Task object creation (saves memory and processing)
     * - Only counts valid tasks that pass filters
     *
     * @param app - Obsidian app instance
     * @param settings - Plugin settings
     * @param propertyFilters - Optional property filters (priority, dueDate, status)
     * @param inclusionFilters - Optional inclusion filters (folders, tags, notes)
     * @returns Count of tasks matching the filters
     */
    static async getTaskCount(
        app: App,
        settings: PluginSettings,
        propertyFilters?: {
            priority?: number | number[] | "all" | "none" | null;
            dueDate?: string | string[] | null;
            dueDateRange?: DateRange | null;
            status?: string | string[] | null;
            statusValues?: string[] | null;
            statusExclusions?: string[] | null;
        },
        inclusionFilters?: {
            folders?: string[];
            noteTags?: string[];
            taskTags?: string[];
            notes?: string[];
        },
    ): Promise<number> {
        Logger.debug(
            "[TaskIndexService.getTaskCount] propertyFilters:",
            propertyFilters,
        );
        Logger.debug(
            "[TaskIndexService.getTaskCount] inclusionFilters:",
            inclusionFilters,
        );
        if (!this.isDatacoreAvailable()) {
            Logger.error("Cannot get task count: Datacore not available");
            return 0;
        }

        // Check if Datacore is initialized (finished indexing)
        // Querying while indexing can cause severe performance issues in large vaults
        if (!this.isAPIReady()) {
            Logger.warn(
                "Datacore is still indexing. Returning 0 count to avoid performance issues.",
            );
            return 0;
        }

        try {
            Logger.debug("Getting task count from Datacore");
            return await DatacoreService.getTaskCount(
                app,
                settings,
                propertyFilters,
                inclusionFilters,
            );
        } catch (error) {
            Logger.error("Error getting task count from Datacore:", error);
            return 0;
        }
    }

    /**
     * Parse standard query syntax for task searches
     *
     * This is a general query parsing utility used across all search modes
     * (Simple Search, Smart Search, Task Chat) for extracting explicitly-specified
     * task properties from queries.
     *
     * Supports:
     * - Keywords: search: "phrase"
     * - Projects: #ProjectName
     * - Priority: p1, p2, p3, p4
     * - Status: s:value or status:value (supports categories and symbols)
     * - Date ranges: due before:, due after:
     * - Special keywords: overdue, recurring, subtask, no date, no priority
     * - Operators: &, |, !
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
        const result: {
            keywords?: string[];
            priority?: number;
            dueDate?: string;
            dueDateRange?: { start?: string; end?: string };
            project?: string;
            statusValues?: string[];
            specialKeywords: string[];
            operators: { and?: boolean; or?: boolean; not?: boolean };
        } = {
            specialKeywords: [],
            operators: {},
        };

        // Detect operators
        if (query.includes("&")) result.operators.and = true;
        if (query.includes("|")) result.operators.or = true;
        if (query.includes("!")) result.operators.not = true;

        // Pattern 1: "search: keyword" or "search: 'phrase with spaces'"
        const searchMatch = query.match(/search:\s*["']?([^"'&|]+)["']?/i);
        if (searchMatch) {
            const searchTerm = searchMatch[1].trim();
            result.keywords = [searchTerm];
        }

        // Pattern 2: Projects "#ProjectName" or "##SubProject"
        const projectMatch = query.match(/##+([A-Za-z0-9_-]+)/);
        if (projectMatch) {
            result.project = projectMatch[1];
        }

        // Pattern 3: Priority "p1", "p2", "p3", "p4"
        const priorityMatch = query.match(/\bp([1-4])\b/i);
        if (priorityMatch) {
            result.priority = parseInt(priorityMatch[1]);
        }

        // Pattern 4: Unified Status Syntax "s:value" or "status:value" or "s:value1,value2"
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

        // Pattern 5: Special keywords
        const moment = window.moment;

        // "overdue" or "over due" or "od"
        if (
            /\b(overdue|over\s+due|od)\b/i.test(query) &&
            !query.includes("!overdue") &&
            moment
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

        // Pattern 6: "due before: <date>" vs "date before: <date>" (distinguished)
        const dueBeforeMatch = query.match(
            /due\s+before:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dueBeforeMatch) {
            const dateStr = dueBeforeMatch[1].trim();
            const parsedDate = TaskPropertyService.parseDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { end: parsedDate };
            }
        }

        // Pattern 7: "date before: <date>" (for tasks with date property)
        const dateBeforeMatch = query.match(
            /(?<!due\s)date\s+before:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dateBeforeMatch && !dueBeforeMatch) {
            const dateStr = dateBeforeMatch[1].trim();
            const parsedDate = TaskPropertyService.parseDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { end: parsedDate };
            }
        }

        // Pattern 8: "due after: <date>" vs "date after: <date>" (distinguished)
        const dueAfterMatch = query.match(
            /due\s+after:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dueAfterMatch) {
            const dateStr = dueAfterMatch[1].trim();
            const parsedDate = TaskPropertyService.parseDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { start: parsedDate };
            }
        }

        // Pattern 9: "date after: <date>"
        const dateAfterMatch = query.match(
            /(?<!due\s)date\s+after:\s*([^&|]+?)(?:\s+&|\s+\||$)/i,
        );
        if (dateAfterMatch && !dueAfterMatch) {
            const dateStr = dateAfterMatch[1].trim();
            const parsedDate = TaskPropertyService.parseDate(dateStr);
            if (parsedDate) {
                result.dueDateRange = { start: parsedDate };
            }
        }

        return result;
    }
}
