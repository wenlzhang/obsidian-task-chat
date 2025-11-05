import { Task } from "../../models/task";
import { PluginSettings, SortCriterion } from "../../settings";
import { TaskPropertyService } from "./taskPropertyService";

/**
 * Datacore task representation (subset of properties used for sorting)
 */
interface DatacoreTask {
    _dueDate?: string;
    _mappedPriority?: number;
    _mappedStatus?: string;
    $text?: string;
    text?: string;
    [key: string]: unknown; // Allow other datacore properties
}

/**
 * Score cache entry with component scores
 */
interface ScoreCacheEntry {
    relevance?: number;
    [key: string]: unknown; // Allow other score components
}

export class TaskSortService {
    /**
     * Sort tasks using multi-criteria sorting with smart internal defaults
     * Applies sort criteria in order: primary, secondary, tertiary, etc.
     * Each criterion is only used when previous criteria result in a tie
     *
     * SMART SORT DIRECTIONS (optimized for intuitive behavior):
     * - Relevance: DESC (higher scores = more relevant, shown first)
     * - Priority: ASC (1=highest priority shown first, then 2, 3, 4)
     * - Due Date: ASC (overdue/earliest = most urgent, shown first)
     * - Status: Smart order based on user's configured categories (active > finished)
     * - Created: DESC (newest tasks shown first)
     * - Alphabetical: ASC (A → Z natural order)
     *
     * @param tasks - Tasks to sort
     * @param sortOrder - Ordered array of sort criteria (e.g., ["relevance", "dueDate", "priority"])
     * @param settings - Plugin settings (required for status/priority sorting to respect user configuration)
     * @param relevanceScores - Optional map of task IDs to relevance scores (required if "relevance" in sortOrder)
     * @returns Sorted tasks
     */
    static sortTasksMultiCriteria(
        tasks: Task[],
        sortOrder: SortCriterion[],
        settings: PluginSettings,
        relevanceScores?: Map<string, number>,
    ): Task[] {
        // If no sort order specified, return tasks as-is
        if (!sortOrder || sortOrder.length === 0) {
            return tasks;
        }

        const sorted = [...tasks].sort((a, b) => {
            return this.applyCriteriaComparison(
                a,
                b,
                sortOrder,
                settings,
                (task) => relevanceScores?.get(task.id) || 0,
                (task) => task.dueDate,
                (task) => task.priority,
                (task) => task.statusCategory,
                (task) => task.createdDate,
                (task) => task.text,
            );
        });

        return sorted;
    }

    /**
     * Sort scored dcTask objects using multi-criteria sorting
     * Used by datacoreService for API-level sorting before Task object creation
     *
     * @param scoredTasks - Array of {dcTask, finalScore} objects to sort
     * @param sortOrder - Ordered array of sort criteria (same as sortTasksMultiCriteria)
     * @param settings - Plugin settings for status/priority configuration
     * @param getTaskId - Function to extract task ID from dcTask
     * @param scoreCache - Map of taskId to cached component scores
     * @returns Sorted array (mutates in place, but also returns for convenience)
     */
    static sortScoredDcTasks(
        scoredTasks: Array<{ dcTask: DatacoreTask; finalScore: number }>,
        sortOrder: SortCriterion[],
        settings: PluginSettings,
        getTaskId: (dcTask: DatacoreTask) => string,
        scoreCache: Map<string, ScoreCacheEntry>,
    ): Array<{ dcTask: DatacoreTask; finalScore: number }> {
        scoredTasks.sort((a, b) => {
            // Primary sort: finalScore DESC (highest first)
            const scoreDiff = b.finalScore - a.finalScore;
            if (Math.abs(scoreDiff) > 0.0001) {
                return scoreDiff;
            }

            // Scores equal - apply multi-criteria tiebreaker
            // Skip "relevance" since it's already included in finalScore
            const tiebreakOrder = sortOrder.filter((c) => c !== "relevance");

            return this.applyCriteriaComparison(
                a,
                b,
                tiebreakOrder,
                settings,
                (item) => {
                    const taskId = getTaskId(item.dcTask);
                    return scoreCache.get(taskId)?.relevance || 0;
                },
                (item) => item.dcTask._dueDate,
                (item) => item.dcTask._mappedPriority,
                (item) => item.dcTask._mappedStatus || "incomplete",
                (item) => undefined, // createdDate not available at API level
                (item) => item.dcTask.$text || item.dcTask.text || "",
            );
        });

        return scoredTasks;
    }

    /**
     * Generic multi-criteria comparison helper
     * Applies sort criteria in order using property getters
     * This is the single source of truth for multi-criteria sorting logic
     *
     * @param itemA - First item to compare
     * @param itemB - Second item to compare
     * @param sortOrder - Ordered array of sort criteria
     * @param settings - Plugin settings
     * @param getRelevance - Function to get relevance score
     * @param getDueDate - Function to get due date
     * @param getPriority - Function to get priority
     * @param getStatusCategory - Function to get status category
     * @param getCreatedDate - Function to get created date
     * @param getText - Function to get text
     * @returns Comparison result: < 0 if A before B, > 0 if B before A, 0 if equal
     */
    private static applyCriteriaComparison<T>(
        itemA: T,
        itemB: T,
        sortOrder: SortCriterion[],
        settings: PluginSettings,
        getRelevance: (item: T) => number,
        getDueDate: (item: T) => string | undefined,
        getPriority: (item: T) => number | undefined,
        getStatusCategory: (item: T) => string | undefined,
        getCreatedDate: (item: T) => string | undefined,
        getText: (item: T) => string,
    ): number {
        // Try each criterion in order until we find a difference
        for (const criterion of sortOrder) {
            let comparison = 0;

            switch (criterion) {
                case "relevance": {
                    // RELEVANCE: Higher scores = more relevant
                    // Direction: DESC (100 before 50)
                    const scoreA = getRelevance(itemA);
                    const scoreB = getRelevance(itemB);
                    comparison = scoreB - scoreA; // DESC
                    break;
                }

                case "dueDate":
                    // DUE DATE: Earlier dates = more urgent
                    // Direction: ASC (overdue → today → future)
                    comparison = TaskPropertyService.compareDates(
                        getDueDate(itemA),
                        getDueDate(itemB),
                    ); // ASC
                    break;

                case "priority":
                    // PRIORITY: Lower numbers = higher priority
                    // Direction: ASC (1 → 2 → 3 → 4)
                    comparison = TaskPropertyService.comparePriority(
                        getPriority(itemA),
                        getPriority(itemB),
                    ); // ASC
                    break;

                case "status": {
                    // STATUS: User-configured status category order
                    // Direction: Active work (open/inProgress) > finished work (completed/cancelled)
                    const aOrder = TaskPropertyService.getStatusOrder(
                        getStatusCategory(itemA),
                        settings,
                    );
                    const bOrder = TaskPropertyService.getStatusOrder(
                        getStatusCategory(itemB),
                        settings,
                    );
                    comparison = aOrder - bOrder;
                    break;
                }

                case "created":
                    // CREATED DATE: Newer = more relevant
                    // Direction: DESC (newer tasks first)
                    comparison = TaskPropertyService.compareDates(
                        getCreatedDate(itemA),
                        getCreatedDate(itemB),
                    );
                    comparison = -comparison; // DESC (reverse ASC)
                    break;

                case "alphabetical":
                    // ALPHABETICAL: Natural A-Z order
                    // Direction: ASC (A before Z)
                    comparison = getText(itemA).localeCompare(getText(itemB)); // ASC
                    break;
            }

            // If this criterion produced a difference, return it
            if (comparison !== 0) {
                return comparison;
            }
            // Otherwise, continue to next criterion
        }

        // All criteria resulted in ties
        return 0;
    }
}
