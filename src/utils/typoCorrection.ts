/**
 * Local typo correction utility (no AI required)
 * Corrects common misspellings in task queries
 */
export class TypoCorrection {
    /**
     * Dictionary of common typos and their corrections
     * Format: [typo] → correction
     */
    private static readonly COMMON_TYPOS: Map<string, string> = new Map([
        // Task-related typos
        ["taks", "task"],
        ["tasl", "task"],
        ["taskk", "task"],
        ["tsak", "task"],
        ["takss", "tasks"],
        ["tassks", "tasks"],

        // Priority typos
        ["priorty", "priority"],
        ["priortiy", "priority"],
        ["priorit", "priority"],
        ["piority", "priority"],
        ["priorites", "priorities"],
        ["prioritys", "priorities"],

        // Status typos
        ["opne", "open"],
        ["openn", "open"],
        ["complated", "completed"],
        ["compelted", "completed"],
        ["copleted", "completed"],
        ["compleated", "completed"],
        ["complet", "complete"],

        // Urgency typos
        ["urgant", "urgent"],
        ["urgnet", "urgent"],
        ["urgemt", "urgent"],
        ["urget", "urgent"],

        // Date typos
        ["overdu", "overdue"],
        ["overdeu", "overdue"],
        ["tommorow", "tomorrow"],
        ["tommorrow", "tomorrow"],
        ["tomorow", "tomorrow"],
        ["todya", "today"],
        ["toady", "today"],

        // Progress typos
        ["progres", "progress"],
        ["proggress", "progress"],
        ["inprogress", "in-progress"],

        // Common action words
        ["paymant", "payment"],
        ["payemnt", "payment"],
        ["critcal", "critical"],
        ["criticla", "critical"],
        ["importent", "important"],
        ["imporant", "important"],
        ["imprtant", "important"],

        // System/tech typos
        ["systme", "system"],
        ["sytem", "system"],
        ["sysem", "system"],
        ["desing", "design"],
        ["desgin", "design"],
        ["developement", "development"],
        ["devlopment", "development"],

        // Other common typos
        ["recieve", "receive"],
        ["reciept", "receipt"],
        ["seperete", "separate"],
        ["seperately", "separately"],
        ["definately", "definitely"],
        ["occured", "occurred"],
        ["occurence", "occurrence"],
    ]);

    /**
     * Correct common typos in query string
     * Only corrects known typos, preserves everything else
     * Maintains original case pattern (uppercase, title case, lowercase)
     *
     * @param query Original query string
     * @returns Corrected query string with typo fixes applied
     */
    static correctTypos(query: string): string {
        if (!query || typeof query !== "string") {
            return query;
        }

        const corrections: string[] = [];

        // Split into words, preserving delimiters
        const words = query.split(/(\s+|[^\w\s]+)/);

        const correctedWords = words.map((word) => {
            // Skip empty strings and non-word characters
            if (!word || !/\w/.test(word)) {
                return word;
            }

            const lower = word.toLowerCase();
            const correction = this.COMMON_TYPOS.get(lower);

            if (correction) {
                corrections.push(`${word}→${correction}`);
                // Preserve original case pattern
                return this.preserveCase(word, correction);
            }
            return word;
        });

        const corrected = correctedWords.join("");

        // Log corrections if any were made
        if (corrections.length > 0) {
            console.log(`[Typo Correction] Fixed: [${corrections.join(", ")}]`);
        }

        return corrected;
    }

    /**
     * Preserve the case pattern of original word when applying correction
     * Handles: ALL CAPS, Title Case, lowercase
     */
    private static preserveCase(original: string, correction: string): string {
        if (!original || !correction) {
            return correction;
        }

        // All uppercase: URGANT → URGENT
        if (original === original.toUpperCase() && /[A-Z]/.test(original)) {
            return correction.toUpperCase();
        }

        // Title case: Urgant → Urgent
        if (
            original[0] === original[0].toUpperCase() &&
            /[A-Z]/.test(original[0])
        ) {
            return (
                correction.charAt(0).toUpperCase() +
                correction.slice(1).toLowerCase()
            );
        }

        // Lowercase: urgant → urgent
        return correction.toLowerCase();
    }

    /**
     * Add custom typo corrections at runtime
     * Useful for user-specific or domain-specific typos
     */
    static addCustomTypo(typo: string, correction: string): void {
        this.COMMON_TYPOS.set(typo.toLowerCase(), correction.toLowerCase());
    }

    /**
     * Get all registered typo corrections (for debugging/settings UI)
     */
    static getAllTypos(): Map<string, string> {
        return new Map(this.COMMON_TYPOS);
    }

    /**
     * Check if a word has a known correction
     */
    static hasCorrection(word: string): boolean {
        return this.COMMON_TYPOS.has(word.toLowerCase());
    }
}
