import { moment } from "obsidian";
import { Task, TaskFilter } from "../models/task";

/**
 * Service for filtering tasks based on various criteria
 */
export class TaskFilterService {
    /**
     * Apply filters to a list of tasks
     */
    static filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
        let filtered = [...tasks];

        // Filter by text
        if (filter.text && filter.text.trim() !== "") {
            const searchText = filter.text.toLowerCase().trim();
            filtered = filtered.filter((task) =>
                task.text.toLowerCase().includes(searchText),
            );
        }

        // Filter by folders
        if (filter.folders && filter.folders.length > 0) {
            filtered = filtered.filter((task) => {
                if (!task.folder) return false;
                return filter.folders!.some((folder) =>
                    task.folder!.startsWith(folder),
                );
            });
        }

        // Filter by priorities
        if (filter.priorities && filter.priorities.length > 0) {
            filtered = filtered.filter((task) =>
                filter.priorities!.includes(task.priority || "none"),
            );
        }

        // Filter by due date range
        if (filter.dueDateRange) {
            filtered = filtered.filter((task) => {
                if (!task.dueDate) return false;

                const taskDate = moment(task.dueDate);
                if (!taskDate.isValid()) return false;

                if (filter.dueDateRange!.start) {
                    const startDate = moment(filter.dueDateRange!.start);
                    if (taskDate.isBefore(startDate, "day")) return false;
                }

                if (filter.dueDateRange!.end) {
                    const endDate = moment(filter.dueDateRange!.end);
                    if (taskDate.isAfter(endDate, "day")) return false;
                }

                return true;
            });
        }

        // Filter by completion status
        if (filter.completionStatus && filter.completionStatus !== "all") {
            if (filter.completionStatus === "completed") {
                filtered = filtered.filter(
                    (task) => task.statusCategory === "completed",
                );
            } else if (filter.completionStatus === "incomplete") {
                filtered = filtered.filter(
                    (task) => task.statusCategory !== "completed",
                );
            }
        }

        // Filter by task statuses
        if (filter.taskStatuses && filter.taskStatuses.length > 0) {
            filtered = filtered.filter((task) =>
                filter.taskStatuses!.includes(task.statusCategory),
            );
        }

        return filtered;
    }

    /**
     * Get unique folders from tasks
     */
    static getUniqueFolders(tasks: Task[]): string[] {
        const folders = new Set<string>();
        tasks.forEach((task) => {
            if (task.folder) {
                folders.add(task.folder);
            }
        });
        return Array.from(folders).sort();
    }

    /**
     * Get unique priorities from tasks
     */
    static getUniquePriorities(tasks: Task[]): string[] {
        const priorities = new Set<string>();
        tasks.forEach((task) => {
            priorities.add(task.priority || "none");
        });
        return Array.from(priorities).sort();
    }

    /**
     * Get unique status categories from tasks
     */
    static getUniqueStatusCategories(tasks: Task[]): string[] {
        const statuses = new Set<string>();
        tasks.forEach((task) => {
            statuses.add(task.statusCategory);
        });
        return Array.from(statuses).sort();
    }

    /**
     * Get task statistics
     */
    static getTaskStatistics(tasks: Task[]): {
        total: number;
        completed: number;
        incomplete: number;
        overdue: number;
        dueToday: number;
        dueThisWeek: number;
    } {
        const now = moment();
        const today = now.startOf("day");
        const endOfWeek = moment().endOf("week");

        let completed = 0;
        let incomplete = 0;
        let overdue = 0;
        let dueToday = 0;
        let dueThisWeek = 0;

        tasks.forEach((task) => {
            if (task.statusCategory === "completed") {
                completed++;
            } else {
                incomplete++;
            }

            if (task.dueDate) {
                const dueDate = moment(task.dueDate);
                if (dueDate.isValid()) {
                    if (
                        dueDate.isBefore(today) &&
                        task.statusCategory !== "completed"
                    ) {
                        overdue++;
                    }
                    if (dueDate.isSame(today, "day")) {
                        dueToday++;
                    }
                    if (
                        dueDate.isSameOrAfter(today) &&
                        dueDate.isSameOrBefore(endOfWeek)
                    ) {
                        dueThisWeek++;
                    }
                }
            }
        });

        return {
            total: tasks.length,
            completed,
            incomplete,
            overdue,
            dueToday,
            dueThisWeek,
        };
    }
}
