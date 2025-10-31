import { App, Notice, TFile, WorkspaceLeaf, MarkdownView } from "obsidian";
import { Task } from "../models/task";
import { Logger } from "../utils/logger";

/**
 * Service for navigating to tasks in notes
 */
export class NavigationService {
    /**
     * Navigate to a task in its source note
     */
    static async navigateToTask(app: App, task: Task): Promise<void> {
        try {
            const file = app.vault.getAbstractFileByPath(task.sourcePath);

            if (!file || !(file instanceof TFile)) {
                new Notice(`Could not find file: ${task.sourcePath}`);
                return;
            }

            // Open the file
            const leaf = app.workspace.getLeaf(false);
            await leaf.openFile(file);

            // Get the view and navigate to the line
            const view = leaf.view;
            if (view instanceof MarkdownView) {
                const editor = view.editor;

                // Navigate to the line
                if (task.lineNumber >= 0) {
                    editor.setCursor({
                        line: task.lineNumber,
                        ch: 0,
                    });

                    // Scroll to the line
                    editor.scrollIntoView(
                        {
                            from: { line: task.lineNumber, ch: 0 },
                            to: { line: task.lineNumber, ch: 0 },
                        },
                        true,
                    );
                } else {
                    // If line number is not available, search for the task text
                    const content = editor.getValue();
                    const lines = content.split("\n");

                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes(task.text)) {
                            editor.setCursor({ line: i, ch: 0 });
                            editor.scrollIntoView(
                                {
                                    from: { line: i, ch: 0 },
                                    to: { line: i, ch: 0 },
                                },
                                true,
                            );
                            break;
                        }
                    }
                }

                new Notice(
                    `Navigated to task: ${task.text.substring(0, 50)}${task.text.length > 50 ? "..." : ""}`,
                );
            }
        } catch (error) {
            Logger.error("Error navigating to task:", error);
            new Notice("Failed to navigate to task");
        }
    }

    /**
     * Open a task in a new pane
     */
    static async navigateToTaskInNewPane(app: App, task: Task): Promise<void> {
        try {
            const file = app.vault.getAbstractFileByPath(task.sourcePath);

            if (!file || !(file instanceof TFile)) {
                new Notice(`Could not find file: ${task.sourcePath}`);
                return;
            }

            // Open the file in a new pane
            const leaf = app.workspace.getLeaf("split");
            await leaf.openFile(file);

            // Get the view and navigate to the line
            const view = leaf.view;
            if (view instanceof MarkdownView) {
                const editor = view.editor;

                if (task.lineNumber >= 0) {
                    editor.setCursor({
                        line: task.lineNumber,
                        ch: 0,
                    });

                    editor.scrollIntoView(
                        {
                            from: { line: task.lineNumber, ch: 0 },
                            to: { line: task.lineNumber, ch: 0 },
                        },
                        true,
                    );
                }

                new Notice(`Opened task in new pane`);
            }
        } catch (error) {
            Logger.error("Error opening task in new pane:", error);
            new Notice("Failed to open task in new pane");
        }
    }
}
