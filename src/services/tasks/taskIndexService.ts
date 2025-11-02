import { App } from "obsidian";
import { Task } from "../../models/task";
import { PluginSettings } from "../../settings";
import { DatacoreService } from "./datacoreService";
import { Logger } from "../../utils/logger";

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
     * Determine if API is ready
     * @returns true if Datacore is available, false otherwise
     */
    static isAPIReady(): boolean {
        return this.isDatacoreAvailable();
    }

    /**
     * Get human-readable status message for Datacore API
     */
    static getAPIStatus(): string {
        if (!this.isDatacoreAvailable()) {
            return "⚠️ Datacore not available - please install Datacore plugin";
        }

        return "✓ Using Datacore";
    }

    /**
     * Get detailed status information for settings UI
     */
    static getDetailedStatus(): {
        datacoreAvailable: boolean;
        message: string;
    } {
        const available = this.isDatacoreAvailable();

        return {
            datacoreAvailable: available,
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

        // Generate cache key from filters (exclude settings for faster key generation)
        const cacheKey = JSON.stringify({
            dateFilter,
            propertyFilters,
            inclusionFilters,
            exclusions: settings.exclusions, // Include exclusions as they affect results
        });

        // Check cache
        const cached = this.queryCache.get(cacheKey);
        const moment = (window as any).moment;
        const now = moment().valueOf();

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
        const moment = (window as any).moment;
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
     */
    static buildPropertyFilters(filter: any): any {
        const propertyFilters: any = {};

        if (filter.priorities && filter.priorities.length > 0) {
            // Convert string priorities to numbers
            propertyFilters.priority = filter.priorities.map((p: string) =>
                p === "none" ? "none" : parseInt(p),
            );
            if (propertyFilters.priority.length === 1) {
                propertyFilters.priority = propertyFilters.priority[0];
            }
        }

        if (filter.dueDateRange) {
            propertyFilters.dueDateRange = filter.dueDateRange;
        }

        if (filter.taskStatuses && filter.taskStatuses.length > 0) {
            propertyFilters.statusValues = filter.taskStatuses;
        }

        return Object.keys(propertyFilters).length > 0
            ? propertyFilters
            : undefined;
    }

    /**
     * Build inclusion filters from TaskFilter
     * Shared utility used by both parseTasksFromIndex() and getTaskCount()
     */
    static buildInclusionFilters(filter: any): any {
        const inclusionFilters: any = {};

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
    ): Promise<number> {
        if (!this.isDatacoreAvailable()) {
            Logger.error("Cannot get task count: Datacore not available");
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
}
