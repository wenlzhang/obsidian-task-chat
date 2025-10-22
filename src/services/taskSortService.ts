import { Task } from "../models/task";
import { PluginSettings, SortCriterion } from "../settings";
import { TaskPropertyService } from "./taskPropertyService";

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
            // Try each criterion in order until we find a difference
            for (const criterion of sortOrder) {
                let comparison = 0;

                switch (criterion) {
                    case "relevance":
                        // RELEVANCE: Higher scores = more relevant
                        // Direction: DESC (100 before 50)
                        // Rationale: Best matches should appear first
                        if (relevanceScores) {
                            const scoreA = relevanceScores.get(a.id) || 0;
                            const scoreB = relevanceScores.get(b.id) || 0;
                            comparison = scoreB - scoreA; // DESC
                        }
                        break;

                    case "dueDate":
                        // DUE DATE: Earlier dates = more urgent
                        // Direction: ASC (2025-10-15 before 2025-10-20)
                        // Rationale: Overdue and soon-due tasks should appear first
                        // Special: Tasks without due dates appear last
                        comparison = TaskPropertyService.compareDates(a.dueDate, b.dueDate); // ASC
                        break;

                    case "priority":
                        // PRIORITY: Internal values 1-4 (1=highest, 4=lowest/none)
                        // Direction: ASC (1 before 2 before 3 before 4)
                        // Rationale: Highest priority (1) should appear first
                        // Note: Priority values map to user-defined strings (e.g., "high", "medium", "low")
                        // Uses TaskPropertyService to respect user's dataviewPriorityMapping
                        comparison = TaskPropertyService.comparePriority(
                            a.priority,
                            b.priority,
                        ); // ASC
                        break;

                    case "status":
                        // STATUS: Smart ordering for task workflow
                        // Direction: Active work (open/inProgress) > finished work (completed/cancelled)
                        // Rationale: Active tasks should appear before finished tasks
                        // Uses TaskPropertyService to respect user's custom status categories
                        const aOrder = TaskPropertyService.getStatusOrder(a.statusCategory, settings);
                        const bOrder = TaskPropertyService.getStatusOrder(b.statusCategory, settings);
                        comparison = aOrder - bOrder;
                        break;

                    case "created":
                        // CREATED DATE: Newer = more relevant
                        // Direction: DESC (2025-10-20 before 2025-10-15)
                        // Rationale: Recently created tasks are usually more relevant
                        comparison = TaskPropertyService.compareDates(
                            a.createdDate,
                            b.createdDate,
                        );
                        comparison = -comparison; // DESC (reverse ASC)
                        break;

                    case "alphabetical":
                        // ALPHABETICAL: Natural A-Z order
                        // Direction: ASC (A before Z)
                        // Rationale: Standard alphabetical ordering
                        comparison = a.text.localeCompare(b.text); // ASC
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

    // Note: All comparison methods have been moved to TaskPropertyService
    // This eliminates duplication and ensures user settings are respected consistently
}
