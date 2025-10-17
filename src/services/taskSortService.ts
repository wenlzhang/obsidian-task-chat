import { Task } from "../models/task";
import { PluginSettings, SortCriterion } from "../settings";

export class TaskSortService {
    /**
     * Sort tasks based on sort preference and direction (LEGACY - single criterion)
     */
    static sortTasks(
        tasks: Task[],
        sortBy:
            | "relevance"
            | "dueDate"
            | "priority"
            | "created"
            | "alphabetical",
        sortDirection: "asc" | "desc" = "asc",
    ): Task[] {
        // "relevance" means don't sort - keep original order (from search/filter)
        if (sortBy === "relevance") {
            return tasks;
        }

        const sorted = [...tasks].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case "dueDate":
                    comparison = this.compareDates(a.dueDate, b.dueDate);
                    break;
                case "priority":
                    comparison = this.comparePriority(a.priority, b.priority);
                    break;
                case "created":
                    comparison = this.compareDates(
                        a.createdDate,
                        b.createdDate,
                    );
                    break;
                case "alphabetical":
                    comparison = a.text.localeCompare(b.text);
                    break;
            }

            // Apply sort direction
            return sortDirection === "asc" ? comparison : -comparison;
        });

        return sorted;
    }

    /**
     * Sort tasks using multi-criteria sorting (NEW)
     * Applies sort criteria in order: primary, secondary, tertiary, etc.
     * Each criterion is only used when previous criteria result in a tie
     *
     * @param tasks - Tasks to sort
     * @param sortOrder - Ordered array of sort criteria (e.g., ["relevance", "dueDate", "priority"])
     * @param sortDirection - Direction for non-relevance sorts
     * @param relevanceScores - Optional map of task IDs to relevance scores (required if "relevance" in sortOrder)
     * @returns Sorted tasks
     */
    static sortTasksMultiCriteria(
        tasks: Task[],
        sortOrder: SortCriterion[],
        sortDirection: "asc" | "desc" = "asc",
        relevanceScores?: Map<string, number>,
    ): Task[] {
        // If no sort order specified, return tasks as-is
        if (!sortOrder || sortOrder.length === 0) {
            return tasks;
        }

        // Filter out "auto" from sortOrder - it's a placeholder that should be resolved before calling this
        const effectiveSortOrder = sortOrder.filter(
            (criterion) => criterion !== "auto",
        );

        if (effectiveSortOrder.length === 0) {
            return tasks;
        }

        const sorted = [...tasks].sort((a, b) => {
            // Try each criterion in order until we find a difference
            for (const criterion of effectiveSortOrder) {
                let comparison = 0;

                switch (criterion) {
                    case "relevance":
                        // Relevance: higher scores come first (DESC), regardless of sortDirection
                        if (relevanceScores) {
                            const scoreA = relevanceScores.get(a.id) || 0;
                            const scoreB = relevanceScores.get(b.id) || 0;
                            comparison = scoreB - scoreA; // DESC by default for relevance
                        }
                        break;

                    case "dueDate":
                        comparison = this.compareDates(a.dueDate, b.dueDate);
                        comparison =
                            sortDirection === "asc" ? comparison : -comparison;
                        break;

                    case "priority":
                        comparison = this.comparePriority(
                            a.priority,
                            b.priority,
                        );
                        comparison =
                            sortDirection === "asc" ? comparison : -comparison;
                        break;

                    case "created":
                        comparison = this.compareDates(
                            a.createdDate,
                            b.createdDate,
                        );
                        comparison =
                            sortDirection === "asc" ? comparison : -comparison;
                        break;

                    case "alphabetical":
                        comparison = a.text.localeCompare(b.text);
                        comparison =
                            sortDirection === "asc" ? comparison : -comparison;
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
        });

        return sorted;
    }

    /**
     * Compare dates (undefined dates go to the end)
     */
    private static compareDates(
        a: string | undefined,
        b: string | undefined,
    ): number {
        if (!a && !b) return 0;
        if (!a) return 1; // a goes to end
        if (!b) return -1; // b goes to end

        return a.localeCompare(b);
    }

    /**
     * Compare priorities (undefined = lowest priority)
     * Priority 1 = highest, 4 = lowest
     */
    private static comparePriority(
        a: number | undefined,
        b: number | undefined,
    ): number {
        // Treat undefined as priority 5 (lowest)
        const aPriority = a ?? 5;
        const bPriority = b ?? 5;

        return aPriority - bPriority;
    }
}
