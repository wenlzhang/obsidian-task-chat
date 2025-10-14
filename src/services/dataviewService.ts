import { App, moment } from "obsidian";
import { Task, TaskStatusCategory } from "../models/task";
import { PluginSettings } from "../settings";

/**
 * Service for integrating with Dataview plugin to fetch tasks
 */
export class DataviewService {
    /**
     * Check if Dataview plugin is enabled
     */
    static isDataviewEnabled(app: App): boolean {
        // @ts-ignore - DataView plugin check
        return app.plugins.plugins.dataview !== undefined;
    }

    /**
     * Get Dataview API
     */
    static getAPI(app: App): any {
        if (!this.isDataviewEnabled(app)) {
            return null;
        }

        // @ts-ignore - Access dataview API
        const api = app.plugins.plugins.dataview?.api;
        return api || null;
    }

    /**
     * Map a DataView task status symbol to status category
     */
    static mapStatusToCategory(
        symbol: string | undefined,
        settings: PluginSettings,
    ): TaskStatusCategory {
        if (!symbol) return "open";

        const cleanSymbol = symbol.replace(/[\[\]]/g, "").trim();

        for (const [category, symbols] of Object.entries(
            settings.taskStatusMapping,
        )) {
            if (symbols.some((s) => s === cleanSymbol)) {
                return category as TaskStatusCategory;
            }
        }

        if (cleanSymbol === "" || cleanSymbol === " ") {
            return "open";
        }

        return "other";
    }

    /**
     * Map a DataView priority value to internal priority
     */
    static mapPriority(
        value: any,
        settings: PluginSettings,
    ): string | undefined {
        if (value === undefined || value === null) return undefined;

        const strValue = String(value).toLowerCase().trim();

        for (const [priority, values] of Object.entries(
            settings.dataviewPriorityMapping,
        )) {
            if (values.some((v) => v.toLowerCase() === strValue)) {
                return priority;
            }
        }

        return "none";
    }

    /**
     * Format date to consistent string format
     */
    static formatDate(date: any, format?: string): string | undefined {
        if (!date) return undefined;

        try {
            if (date instanceof Date) {
                return format
                    ? moment(date).format(format)
                    : moment(date).format("YYYY-MM-DD");
            }

            if (date && typeof date === "object" && date.format) {
                return format ? date.format(format) : date.format("YYYY-MM-DD");
            }

            if (typeof date === "string") {
                const dateStr = date.trim();
                const parsedDate = moment(dateStr);
                if (parsedDate.isValid()) {
                    return format ? parsedDate.format(format) : dateStr;
                }
            }

            const momentDate = moment(date);
            if (momentDate.isValid()) {
                return format
                    ? momentDate.format(format)
                    : momentDate.format("YYYY-MM-DD");
            }
        } catch (e) {
            console.error("Error formatting date:", e);
        }

        return undefined;
    }

    /**
     * Extract inline date from task text
     */
    private static extractInlineDate(
        text: string,
        fieldKey: string,
    ): string | undefined {
        if (!text || typeof text !== "string") return undefined;

        const regex = new RegExp(`\\[${fieldKey}::([^\\]]+)\\]`, "i");
        const match = text.match(regex);

        if (match && match[1]) {
            const extractedDate = match[1].trim();
            const momentDate = moment(extractedDate);
            if (!momentDate.isValid()) {
                return undefined;
            }
            return extractedDate;
        }

        if (fieldKey === "due") {
            const calendarRegex = /📅\s*([^\s]+)/;
            const calendarMatch = text.match(calendarRegex);

            if (calendarMatch && calendarMatch[1]) {
                const extractedDate = calendarMatch[1].trim();
                const momentDate = moment(extractedDate);
                if (!momentDate.isValid()) {
                    return undefined;
                }
                return extractedDate;
            }
        }

        return undefined;
    }

    /**
     * Check if a task is valid for processing
     */
    private static isValidTask(task: any): boolean {
        return (
            task &&
            (task.text || task.content) &&
            (typeof task.status !== "undefined" ||
                typeof task.symbol !== "undefined") &&
            (typeof task.real === "undefined" || task.real === true)
        );
    }

    /**
     * Process a single DataView task
     */
    static processDataviewTask(
        dvTask: any,
        settings: PluginSettings,
        index: number,
        filePath: string = "",
    ): Task | null {
        if (!this.isValidTask(dvTask)) {
            return null;
        }

        const text = dvTask.text || dvTask.content || "";
        const status = dvTask.status || dvTask.symbol || "";
        const path = filePath || dvTask.path || "";
        const line = dvTask.line || 0;
        const statusCategory = this.mapStatusToCategory(status, settings);

        // Extract folder from path
        const folder = path.includes("/")
            ? path.substring(0, path.lastIndexOf("/"))
            : "";

        // Handle priority
        let priority;
        const priorityKey = settings.dataviewKeys.priority;

        if (dvTask[priorityKey] !== undefined) {
            priority = this.mapPriority(dvTask[priorityKey], settings);
        } else if (dvTask.fields && dvTask.fields[priorityKey] !== undefined) {
            priority = this.mapPriority(dvTask.fields[priorityKey], settings);
        } else if (text) {
            if (text.includes("⏫")) priority = "high";
            else if (text.includes("🔼")) priority = "medium";
            else if (text.includes("🔽") || text.includes("⏬"))
                priority = "low";
        }

        // Handle dates
        let dueDate, createdDate, completedDate;

        // Due date
        dueDate = this.formatDate(
            dvTask[settings.dataviewKeys.dueDate],
            settings.dateFormats.due,
        );

        if (!dueDate && dvTask.fields) {
            dueDate = this.formatDate(
                dvTask.fields[settings.dataviewKeys.dueDate],
                settings.dateFormats.due,
            );
        }

        if (!dueDate && text) {
            const extractedDate = this.extractInlineDate(
                text,
                settings.dataviewKeys.dueDate,
            );
            if (extractedDate) {
                dueDate = this.formatDate(
                    extractedDate,
                    settings.dateFormats.due,
                );
            }
        }

        // Created date
        createdDate = this.formatDate(
            dvTask[settings.dataviewKeys.createdDate],
            settings.dateFormats.created,
        );

        if (!createdDate && dvTask.fields) {
            createdDate = this.formatDate(
                dvTask.fields[settings.dataviewKeys.createdDate],
                settings.dateFormats.created,
            );
        }

        // Completed date
        completedDate = this.formatDate(
            dvTask[settings.dataviewKeys.completedDate],
            settings.dateFormats.completed,
        );

        if (!completedDate && dvTask.fields) {
            completedDate = this.formatDate(
                dvTask.fields[settings.dataviewKeys.completedDate],
                settings.dateFormats.completed,
            );
        }

        // Handle tags
        let tags: string[] = [];
        if (Array.isArray(dvTask.tags)) {
            tags = dvTask.tags;
        }

        const taskId = `dataview-${path}-${line}-${text.substring(0, 20)}-${index}`;

        return {
            id: taskId,
            text: text,
            status: status,
            statusCategory: statusCategory,
            createdDate: createdDate,
            completedDate: completedDate,
            dueDate: dueDate,
            priority: priority || "none",
            tags: tags,
            sourcePath: path,
            lineNumber: line,
            originalText: text,
            folder: folder,
        };
    }

    /**
     * Process task recursively including children
     */
    private static processTaskRecursively(
        dvTask: any,
        settings: PluginSettings,
        tasks: Task[],
        path: string,
        taskIndex: number,
    ): number {
        const task = this.processDataviewTask(
            dvTask,
            settings,
            taskIndex++,
            path,
        );
        if (task) {
            tasks.push(task);
        }

        if (
            dvTask.children &&
            Array.isArray(dvTask.children) &&
            dvTask.children.length > 0
        ) {
            for (const childTask of dvTask.children) {
                taskIndex = this.processTaskRecursively(
                    childTask,
                    settings,
                    tasks,
                    path,
                    taskIndex,
                );
            }
        }

        return taskIndex;
    }

    /**
     * Parse all tasks from Dataview
     */
    static async parseTasksFromDataview(
        app: App,
        settings: PluginSettings,
    ): Promise<Task[]> {
        const dataviewApi = this.getAPI(app);
        if (!dataviewApi) {
            console.error("DataView API not available");
            return [];
        }

        const tasks: Task[] = [];
        let foundTasks = false;

        // Try using pages method
        if (
            !foundTasks &&
            dataviewApi.pages &&
            typeof dataviewApi.pages === "function"
        ) {
            try {
                const pages = dataviewApi.pages();
                let taskIndex = 0;

                if (pages && pages.length > 0) {
                    for (const page of pages) {
                        try {
                            if (!page.file || !page.file.path) continue;

                            if (
                                page.file.tasks &&
                                Array.isArray(page.file.tasks)
                            ) {
                                for (const pageTask of page.file.tasks) {
                                    taskIndex = this.processTaskRecursively(
                                        pageTask,
                                        settings,
                                        tasks,
                                        page.file.path,
                                        taskIndex,
                                    );
                                }
                            } else if (
                                page.tasks &&
                                Array.isArray(page.tasks)
                            ) {
                                for (const pageTask of page.tasks) {
                                    taskIndex = this.processTaskRecursively(
                                        pageTask,
                                        settings,
                                        tasks,
                                        page.file.path,
                                        taskIndex,
                                    );
                                }
                            }
                        } catch (pageError) {
                            console.warn(
                                `Error processing page: ${page.file?.path}`,
                            );
                        }
                    }

                    if (tasks.length > 0) {
                        foundTasks = true;
                    }
                }
            } catch (e) {
                console.error("Error using DataView pages API:", e);
            }
        }

        return tasks;
    }
}
