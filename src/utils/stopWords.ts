/**
 * Shared stop word list and language utilities for text processing
 *
 * Stop words are common words that add no semantic value to search queries.
 * Removing them improves:
 * - Keyword relevance scoring
 * - Consistency between search modes
 * - Threshold calculations (fewer keywords = more appropriate thresholds)
 *
 * Also provides CJK (Chinese/Japanese/Korean) character detection for
 * language-aware text processing (e.g., deduplication logic).
 *
 * Supports user-configurable stop words that merge with internal stop words.
 */
export class StopWords {
    /**
     * CJK (Chinese/Japanese/Korean) character ranges
     * Used for language-aware text processing
     */
    private static readonly CJK_REGEX =
        /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u3040-\u309f\u30a0-\u30ff]/u;

    /**
     * Unicode ranges covered:
     * - \u4e00-\u9fff: CJK Unified Ideographs (most common Chinese characters)
     * - \u3400-\u4dbf: CJK Extension A
     * - \u{20000}-\u{2a6df}: CJK Extension B
     * - \u3040-\u309f: Hiragana (Japanese)
     * - \u30a0-\u30ff: Katakana (Japanese)
     */
    /**
     * Internal stop word list covering multiple languages
     * These are always active and cannot be disabled
     */
    private static readonly INTERNAL_STOP_WORDS = new Set([
        // English articles and prepositions
        "the",
        "a",
        "an",
        "but",
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
        "to", // Very common: "to-do", "Todoist", "sync to", etc.
        "in", // Common: "in progress", "in work"
        "on", // Common: "on hold", "work on"
        "at", // Common: "at work", "look at"

        // English query/question words
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
     * User-configurable stop words (set via settings)
     * Combined with internal stop words for filtering
     */
    private static userStopWords: Set<string> = new Set();

    /**
     * Set user-configurable stop words
     * These are combined with internal stop words
     * @param words Array of user-defined stop words
     */
    static setUserStopWords(words: string[]): void {
        this.userStopWords = new Set(words.map((w) => w.toLowerCase()));
    }

    /**
     * Get combined stop words (internal + user)
     * @returns Set of all stop words
     */
    private static getAllStopWords(): Set<string> {
        return new Set([...this.INTERNAL_STOP_WORDS, ...this.userStopWords]);
    }

    /**
     * Check if a word is a stop word (internal or user-defined)
     * @param word Word to check (case-insensitive)
     * @returns true if word is a stop word
     */
    static isStopWord(word: string): boolean {
        const lowerWord = word.toLowerCase();
        return (
            this.INTERNAL_STOP_WORDS.has(lowerWord) ||
            this.userStopWords.has(lowerWord)
        );
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
     * Get the full list of stop words (internal + user, for AI prompt)
     * @returns Array of all stop words
     */
    static getStopWordsList(): string[] {
        return Array.from(this.getAllStopWords());
    }

    /**
     * Get only internal stop words (for reference)
     * @returns Array of internal stop words
     */
    static getInternalStopWords(): string[] {
        return Array.from(this.INTERNAL_STOP_WORDS);
    }

    /**
     * Get only user stop words (for settings display)
     * @returns Array of user stop words
     */
    static getUserStopWords(): string[] {
        return Array.from(this.userStopWords);
    }

    /**
     * Check if a string contains CJK (Chinese/Japanese/Korean) characters
     *
     * Used for language-aware text processing, such as:
     * - Deduplication logic (CJK character splitting vs different words)
     * - Text segmentation
     * - Language detection
     *
     * @param text Text to check
     * @returns true if text contains any CJK characters
     */
    static isCJK(text: string): boolean {
        return this.CJK_REGEX.test(text);
    }
}
