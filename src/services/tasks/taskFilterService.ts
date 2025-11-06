import { moment } from "obsidian";
import { Task, TaskFilter } from "../../models/task";
import { TaskPropertyService } from "./taskPropertyService";

/**
 * Service for filtering tasks based on various criteria
 * Also provides shared utilities for query building and filter normalization
 */
export class TaskFilterService {
    /**
     * Normalize a tag by removing the # prefix
     * Used by both Datacore and Dataview services
     */
    static normalizeTag(tag: string): string {
        return tag.replace(/^#+/, "");
    }

    /**
     * Normalize a file path for Datacore queries
     * Extracts just the filename without path or extension
     * Example: "Task Chat/Test Task Chat.md" -> "Test Task Chat"
     */
    static normalizePathForDatacore(path: string): string {
        const fileName =
            path.split("/").pop()?.replace(/\.md$/i, "") ||
            path.replace(/\.md$/i, "");
        return fileName;
    }

    /**
     * Normalize a file path for Dataview queries
     * Removes .md extension but keeps the full path
     * Example: "Task Chat/Test Task Chat.md" -> "Task Chat/Test Task Chat"
     */
    static normalizePathForDataview(path: string): string {
        return path.replace(/\.md$/i, "");
    }

    /**
     * Check if two tags match (case-insensitive, normalized)
     * Used for comparing task tags with filter tags
     */
    static tagsMatch(tag1: string, tag2: string): boolean {
        const normalized1 = this.normalizeTag(tag1).toLowerCase();
        const normalized2 = this.normalizeTag(tag2).toLowerCase();
        return normalized1 === normalized2;
    }
    /**
     * Apply filters to a list of tasks
     */
    static filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
        let filtered = [...tasks];

        // Filter by folders, tags, and notes (Section 2: Task Inclusion)
        // Use OR logic across all inclusion filters - task matches if it's in ANY specified location
        const hasFolderFilter = filter.folders && filter.folders.length > 0;
        const hasNoteTagFilter = filter.noteTags && filter.noteTags.length > 0;
        const hasTaskTagFilter = filter.taskTags && filter.taskTags.length > 0;
        const hasNoteFilter = filter.notes && filter.notes.length > 0;

        if (
            hasFolderFilter ||
            hasNoteTagFilter ||
            hasTaskTagFilter ||
            hasNoteFilter
        ) {
            filtered = filtered.filter((task) => {
                // Check folder match
                // filter.folders is guaranteed to exist when hasFolderFilter is true
                const matchesFolder =
                    hasFolderFilter &&
                    task.folder &&
                    filter.folders?.some((folder) =>
                        task.folder?.startsWith(folder),
                    );

                // Check note-level tag match (uses note tags from page frontmatter/inline)
                // filter.noteTags and task.noteTags are guaranteed to exist in this context
                const matchesNoteTag =
                    hasNoteTagFilter &&
                    task.noteTags &&
                    task.noteTags.length > 0 &&
                    filter.noteTags?.some((filterTag) => {
                        const normalizedFilter = filterTag.replace(/^#+/, "");
                        return task.noteTags?.some((noteTag) => {
                            const normalizedNoteTag = noteTag.replace(
                                /^#+/,
                                "",
                            );
                            return (
                                normalizedNoteTag.toLowerCase() ===
                                normalizedFilter.toLowerCase()
                            );
                        });
                    });

                // Check task-level tag match (uses tags from task line itself)
                // filter.taskTags is guaranteed to exist when hasTaskTagFilter is true
                const matchesTaskTag =
                    hasTaskTagFilter &&
                    task.tags &&
                    task.tags.length > 0 &&
                    filter.taskTags?.some((filterTag) => {
                        const normalizedFilter = filterTag.replace(/^#+/, "");
                        return task.tags.some((taskTag) => {
                            const normalizedTask = taskTag.replace(/^#+/, "");
                            return (
                                normalizedTask.toLowerCase() ===
                                normalizedFilter.toLowerCase()
                            );
                        });
                    });

                // Check note match
                // filter.notes is guaranteed to exist when hasNoteFilter is true
                const matchesNote =
                    hasNoteFilter && filter.notes?.includes(task.sourcePath);

                // Return true if task matches ANY of the inclusion criteria (OR logic)
                return (
                    matchesFolder ||
                    matchesNoteTag ||
                    matchesTaskTag ||
                    matchesNote
                );
            });
        }

        // Filter by priorities
        if (filter.priorities && filter.priorities.length > 0) {
            filtered = filtered.filter((task) => {
                // Use centralized priority value from TaskPropertyService
                const priority =
                    task.priority !== undefined
                        ? String(task.priority)
                        : TaskPropertyService.PRIORITY_VALUES.none;
                // filter.priorities is guaranteed to exist in this scope
                return filter.priorities?.includes(priority) ?? false;
            });
        }

        // Filter by due date range
        // Delegates to TaskPropertyService for consistent date handling
        if (filter.dueDateRange) {
            // filter.dueDateRange is guaranteed to exist in this scope
            const dueDateRange = filter.dueDateRange;
            filtered = filtered.filter((task) =>
                TaskPropertyService.matchesDateRange(task, dueDateRange),
            );
        }

        // Filter by task statuses
        if (filter.taskStatuses && filter.taskStatuses.length > 0) {
            // filter.taskStatuses is guaranteed to exist in this scope
            filtered = filtered.filter((task) =>
                filter.taskStatuses?.includes(task.statusCategory) ?? false,
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
