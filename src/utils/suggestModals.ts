import { App, FuzzySuggestModal, TFile } from "obsidian";

/**
 * Folder Suggest Modal
 * Uses Obsidian's FuzzySuggestModal for searchable folder selection
 */
export class FolderSuggestModal extends FuzzySuggestModal<string> {
    constructor(
        app: App,
        private _onChooseFolder: (_folder: string) => void,
    ) {
        super(app);
        this.setPlaceholder("Type to search folders...");
    }

    getItems(): string[] {
        const folderSet = new Set<string>();

        // Add root folder option
        folderSet.add("/");

        // Get all files and extract unique folder paths
        this.app.vault.getAllLoadedFiles().forEach((file) => {
            if (file.parent && file.parent.path) {
                // Add the folder and all parent folders
                let currentPath = file.parent.path;
                while (currentPath && currentPath !== "/") {
                    folderSet.add(currentPath);
                    const parentFolder =
                        this.app.vault.getAbstractFileByPath(
                            currentPath,
                        )?.parent;
                    currentPath = parentFolder?.path || "";
                }
            }
        });

        return Array.from(folderSet).sort();
    }

    getItemText(folder: string): string {
        return folder === "/" ? "/ (root)" : folder;
    }

    onChooseItem(folder: string, _evt: MouseEvent | KeyboardEvent): void {
        this._onChooseFolder(folder);
    }
}

/**
 * Tag Suggest Modal
 * Uses Obsidian's FuzzySuggestModal for searchable tag selection
 */
export class TagSuggestModal extends FuzzySuggestModal<string> {
    constructor(
        app: App,
        private _onChooseTag: (_tag: string) => void,
    ) {
        super(app);
        this.setPlaceholder("Type to search tags...");
    }

    getItems(): string[] {
        const tagSet = new Set<string>();

        // Get all markdown files
        const files = this.app.vault.getMarkdownFiles();

        // Extract tags from each file's cache
        files.forEach((file) => {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.tags) {
                cache.tags.forEach((tagCache) => {
                    tagSet.add(tagCache.tag);
                });
            }

            // Also check frontmatter tags
            if (cache?.frontmatter?.tags) {
                const fmTags = cache.frontmatter.tags;
                if (Array.isArray(fmTags)) {
                    fmTags.forEach((tag) => {
                        // Ensure tag is a string before processing
                        if (typeof tag === "string") {
                            const normalizedTag = tag.startsWith("#")
                                ? tag
                                : `#${tag}`;
                            tagSet.add(normalizedTag);
                        }
                    });
                } else if (typeof fmTags === "string") {
                    const normalizedTag = fmTags.startsWith("#")
                        ? fmTags
                        : `#${fmTags}`;
                    tagSet.add(normalizedTag);
                }
            }
        });

        return Array.from(tagSet).sort();
    }

    getItemText(tag: string): string {
        return tag;
    }

    onChooseItem(tag: string, _evt: MouseEvent | KeyboardEvent): void {
        this._onChooseTag(tag);
    }
}

/**
 * Note Suggest Modal
 * Uses Obsidian's FuzzySuggestModal for searchable note selection
 */
export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
    constructor(
        app: App,
        private _onChooseNote: (_note: TFile) => void,
    ) {
        super(app);
        this.setPlaceholder("Type to search notes...");
    }

    getItems(): TFile[] {
        // Get all markdown files
        const files = this.app.vault.getMarkdownFiles();

        // Sort by recent files first, then alphabetically
        const recentFiles = this.app.workspace
            .getLastOpenFiles()
            .map((path) => this.app.vault.getAbstractFileByPath(path))
            .filter((file): file is TFile => file instanceof TFile);

        const recentPaths = new Set(recentFiles.map((f) => f.path));

        const otherFiles = files
            .filter((file) => !recentPaths.has(file.path))
            .sort((a, b) => a.basename.localeCompare(b.basename));

        return [...recentFiles, ...otherFiles];
    }

    getItemText(file: TFile): string {
        // Show path for better context
        return file.path;
    }

    onChooseItem(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
        this._onChooseNote(file);
    }
}
