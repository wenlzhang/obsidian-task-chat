/**
 * Multilingual text splitter for query parsing
 * Handles English, Chinese, and mixed-language text
 */
export class TextSplitter {
    /**
     * Split text into words/terms, handling multiple languages
     * Supports: English, Chinese, Japanese, Korean, and mixed text
     */
    static splitIntoWords(text: string): string[] {
        if (!text || text.trim().length === 0) {
            return [];
        }

        const words: string[] = [];

        // Step 1: Extract hashtags first (preserve them)
        const hashtagPattern = /#[^\s#]+/g;
        const hashtags = text.match(hashtagPattern) || [];
        // Remove hashtags temporarily
        const cleanText = text.replace(hashtagPattern, " ");

        // Step 2: Split by whitespace and punctuation for alphabetic languages
        // This handles English, German, French, Spanish, etc.
        const alphaWords = cleanText
            .split(/[\s,;:!?.()[\]{}""''<>\/\\|~`@#$%^&*+=]+/)
            .filter((word) => word.length > 0);

        for (const word of alphaWords) {
            // Check if word contains CJK characters (Chinese, Japanese, Korean)
            if (this.hasCJK(word)) {
                // Split CJK text into individual characters/words
                const cjkWords = this.splitCJK(word);
                words.push(...cjkWords);
            } else if (word.length > 0) {
                // Regular alphabetic word
                words.push(word);
            }
        }

        // Step 3: Add hashtags back (without the # symbol)
        for (const tag of hashtags) {
            words.push(tag.substring(1)); // Remove # prefix
        }

        // Remove duplicates while preserving order
        return [...new Set(words)];
    }

    /**
     * Check if text contains CJK (Chinese, Japanese, Korean) characters
     */
    private static hasCJK(text: string): boolean {
        // CJK Unified Ideographs range
        return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(text);
    }

    /**
     * Split CJK text into meaningful units
     * For Chinese: splits into individual characters and common 2-character words
     * Handles mixed CJK and English text
     */
    private static splitCJK(text: string): string[] {
        const words: string[] = [];
        let i = 0;

        while (i < text.length) {
            const char = text[i];

            // If it's a CJK character
            if (this.hasCJK(char)) {
                // Try to extract 2-character combinations (common in Chinese)
                if (i + 1 < text.length && this.hasCJK(text[i + 1])) {
                    const twoChar = text.substring(i, i + 2);
                    words.push(twoChar);
                    // Also add individual characters for better matching
                    words.push(char);
                    words.push(text[i + 1]);
                    i += 2;
                } else {
                    words.push(char);
                    i++;
                }
            } else if (char.match(/[a-zA-Z]/)) {
                // Extract complete English word within CJK text
                let word = "";
                while (i < text.length && text[i].match(/[a-zA-Z0-9_]/)) {
                    word += text[i];
                    i++;
                }
                if (word.length > 0) {
                    words.push(word);
                }
            } else {
                // Skip non-word characters
                i++;
            }
        }

        return words.filter((w) => w.length > 0);
    }

    /**
     * Extract hashtags from text
     */
    static extractHashtags(text: string): string[] {
        const hashtagPattern = /#([^\s#]+)/g;
        const matches = text.matchAll(hashtagPattern);
        const tags: string[] = [];

        for (const match of matches) {
            tags.push(match[1]); // Get capture group (tag without #)
        }

        return tags;
    }

    /**
     * Remove hashtags from text
     */
    static removeHashtags(text: string): string {
        return text.replace(/#[^\s#]+/g, " ").trim();
    }
}
