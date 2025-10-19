import { Task } from "../models/task";
import { PluginSettings, SortCriterion } from "../settings";

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
     * - Status: Smart order (open > inProgress > completed > cancelled)
     * - Created: DESC (newest tasks shown first)
     * - Alphabetical: ASC (A → Z natural order)
     *
     * @param tasks - Tasks to sort
     * @param sortOrder - Ordered array of sort criteria (e.g., ["relevance", "dueDate", "priority"])
     * @param relevanceScores - Optional map of task IDs to relevance scores (required if "relevance" in sortOrder)
     * @returns Sorted tasks
     */
    static sortTasksMultiCriteria(
        tasks: Task[],
        sortOrder: SortCriterion[],
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
                        comparison = this.compareDates(a.dueDate, b.dueDate); // ASC
                        break;

                    case "priority":
                        // PRIORITY: Internal values 1-4 (1=highest, 4=lowest/none)
                        // Direction: ASC (1 before 2 before 3 before 4)
                        // Rationale: Highest priority (1) should appear first
                        // Note: Priority values map to user-defined strings (e.g., "high", "medium", "low")
                        comparison = this.comparePriority(
                            a.priority,
                            b.priority,
                        ); // ASC
                        break;

                    case "status":
                        // STATUS: Smart ordering for task workflow
                        // Direction: open > inProgress > completed > cancelled
                        // Rationale: Active tasks (open/inProgress) should appear before finished tasks
                        comparison = this.compareStatus(
                            a.statusCategory,
                            b.statusCategory,
                        );
                        break;

                    case "created":
                        // CREATED DATE: Newer = more relevant
                        // Direction: DESC (2025-10-20 before 2025-10-15)
                        // Rationale: Recently created tasks are usually more relevant
                        comparison = this.compareDates(
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

    /**
     * Compare status with smart workflow ordering
     * Order: open (1) > inProgress (2) > completed (3) > cancelled (4) > other (5)
     * Rationale: Active work appears before finished work
     */
    private static compareStatus(
        a: string | undefined,
        b: string | undefined,
    ): number {
        const getStatusOrder = (status: string | undefined): number => {
            if (!status) return 5; // Unknown/other goes last
            switch (status.toLowerCase()) {
                case "open":
                    return 1; // Highest priority - new work
                case "inprogress":
                case "in-progress":
                case "in progress":
                    return 2; // Active work
                case "completed":
                case "done":
                    return 3; // Finished work
                case "cancelled":
                case "canceled":
                    return 4; // Abandoned work
                default:
                    return 5; // Other/unknown
            }
        };

        const aOrder = getStatusOrder(a);
        const bOrder = getStatusOrder(b);

        return aOrder - bOrder;
    }
}
