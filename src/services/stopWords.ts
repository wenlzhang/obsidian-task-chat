/**
 * Shared stop word list for both direct search and AI-powered search modes
 *
 * Stop words are common words that add no semantic value to search queries.
 * Removing them improves:
 * - Keyword relevance scoring
 * - Consistency between search modes
 * - Threshold calculations (fewer keywords = more appropriate thresholds)
 */
export class StopWords {
    /**
     * Comprehensive stop word list covering multiple languages
     */
    private static readonly STOP_WORDS = new Set([
        // English articles and prepositions
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "from",
        "as",
        "is",
        "was",
        "are",
        "were",

        // English query/question words
        "show",
        "find",
        "get",
        "list",
        "tell",
        "give",
        "me",
        "my",
        "all",
        "how",
        "what",
        "when",
        "where",
        "why",
        "which",
        "who",
        "whom",
        "whose",
        "do",
        "does",
        "did",
        "can",
        "could",
        "should",
        "would",
        "will",
        "have",
        "has",
        "had",

        // Chinese stop words (common particles and question words)
        "给", // "give"
        "我", // "me/I"
        "的", // possessive particle
        "了", // completion particle
        "吗", // question particle
        "呢", // question particle
        "啊", // exclamation particle
        "如何", // "how"
        "怎么", // "how"
        "怎样", // "how"
        "什么", // "what"
        "哪些", // "which (plural)"
        "哪个", // "which"
        "哪里", // "where"
        "为什么", // "why"
    ]);

    /**
     * Check if a word is a stop word
     * @param word Word to check (case-insensitive)
     * @returns true if word is a stop word
     */
    static isStopWord(word: string): boolean {
        return this.STOP_WORDS.has(word.toLowerCase());
    }

    /**
     * Filter stop words from an array of words
     * Also filters out single-character words (except CJK characters)
     * @param words Array of words to filter
     * @returns Filtered array with stop words removed
     */
    static filterStopWords(words: string[]): string[] {
        return words.filter((word) => {
            // Filter out empty strings
            if (word.length === 0) return false;

            // Keep single CJK characters (they're meaningful)
            if (word.length === 1) {
                const charCode = word.charCodeAt(0);
                const isCJK =
                    (charCode >= 0x4e00 && charCode <= 0x9fff) || // CJK Unified Ideographs
                    (charCode >= 0x3400 && charCode <= 0x4dbf) || // CJK Extension A
                    (charCode >= 0x20000 && charCode <= 0x2a6df) || // CJK Extension B
                    (charCode >= 0xf900 && charCode <= 0xfaff) || // CJK Compatibility
                    (charCode >= 0x3040 && charCode <= 0x309f) || // Hiragana
                    (charCode >= 0x30a0 && charCode <= 0x30ff); // Katakana
                if (!isCJK) return false; // Filter out single non-CJK characters
            }

            // Filter out stop words
            return !this.isStopWord(word);
        });
    }

    /**
     * Get the full list of stop words (for debugging or display)
     * @returns Array of all stop words
     */
    static getStopWordsList(): string[] {
        return Array.from(this.STOP_WORDS);
    }
}
