import { moment } from "obsidian";
import { Task, TaskFilter } from "../models/task";
import { TaskPropertyService } from "./taskPropertyService";

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

        // Filter by note-level tags
        // Note: Currently uses task.tags which includes all tags from DataView
        // TODO: Distinguish between note-level and task-level tags
        if (filter.noteTags && filter.noteTags.length > 0) {
            filtered = filtered.filter((task) => {
                if (!task.tags || task.tags.length === 0) return false;
                return filter.noteTags!.some((filterTag) =>
                    task.tags.includes(filterTag),
                );
            });
        }

        // Filter by task-level tags
        if (filter.taskTags && filter.taskTags.length > 0) {
            filtered = filtered.filter((task) => {
                if (!task.tags || task.tags.length === 0) return false;
                return filter.taskTags!.some((filterTag) =>
                    task.tags.includes(filterTag),
                );
            });
        }

        // Filter by notes (specific file paths)
        if (filter.notes && filter.notes.length > 0) {
            filtered = filtered.filter((task) =>
                filter.notes!.includes(task.sourcePath),
            );
        }

        // Filter by priorities
        if (filter.priorities && filter.priorities.length > 0) {
            filtered = filtered.filter((task) => {
                // Use centralized priority value from TaskPropertyService
                const priority =
                    task.priority !== undefined
                        ? String(task.priority)
                        : TaskPropertyService.PRIORITY_VALUES.none;
                return filter.priorities!.includes(priority);
            });
        }

        // Filter by due date range
        // Delegates to TaskPropertyService for consistent date handling
        if (filter.dueDateRange) {
            filtered = filtered.filter((task) =>
                TaskPropertyService.matchesDateRange(
                    task,
                    filter.dueDateRange!,
                ),
            );
        }

        // Filter by completion status
        // Use centralized completion status constants from TaskPropertyService
        if (
            filter.completionStatus &&
            filter.completionStatus !==
                TaskPropertyService.COMPLETION_STATUS.all
        ) {
            if (
                filter.completionStatus ===
                TaskPropertyService.COMPLETION_STATUS.completed
            ) {
                filtered = filtered.filter(
                    (task) =>
                        task.statusCategory ===
                        TaskPropertyService.STATUS_CATEGORY.completed,
                );
            } else if (
                filter.completionStatus ===
                TaskPropertyService.COMPLETION_STATUS.incomplete
            ) {
                filtered = filtered.filter(
                    (task) =>
                        task.statusCategory !==
                        TaskPropertyService.STATUS_CATEGORY.completed,
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
            // Use centralized priority value from TaskPropertyService
            const priority =
                task.priority !== undefined
                    ? String(task.priority)
                    : TaskPropertyService.PRIORITY_VALUES.none;
            priorities.add(priority);
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
            // Use centralized status category from TaskPropertyService
            if (
                task.statusCategory ===
                TaskPropertyService.STATUS_CATEGORY.completed
            ) {
                completed++;
            } else {
                incomplete++;
            }

            if (task.dueDate) {
                const dueDate = moment(task.dueDate);
                if (dueDate.isValid()) {
                    if (
                        dueDate.isBefore(today) &&
                        task.statusCategory !==
                            TaskPropertyService.STATUS_CATEGORY.completed
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
