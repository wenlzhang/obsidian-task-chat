import { Task } from "../models/task";
import { PluginSettings } from "../settings";

export class TaskSortService {
    /**
     * Sort tasks based on settings
     */
    static sortTasks(tasks: Task[], settings: PluginSettings): Task[] {
        const { taskSortBy, taskSortDirection } = settings;

        // "relevance" means don't sort - keep original order (from search/filter)
        if (taskSortBy === "relevance") {
            return tasks;
        }

        const sorted = [...tasks].sort((a, b) => {
            let comparison = 0;

            switch (taskSortBy) {
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
            return taskSortDirection === "asc" ? comparison : -comparison;
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
