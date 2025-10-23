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
 *
 * Also provides generic/vague query words for detecting open-ended questions.
 */
export class StopWords {
    /**
     * Generic words that indicate vague/open-ended queries
     * Used to detect queries like "What should I do?" vs specific "Fix authentication bug"
     *
     * Categories:
     * 1. Question words - indicate asking/uncertainty
     * 2. Generic verbs - non-specific actions
     * 3. Generic nouns - non-specific objects
     * 4. Modal verbs - possibility/obligation
     * 5. Time interrogatives - asking about when
     */
    public static readonly GENERIC_QUERY_WORDS = new Set([
        // English question words
        "what",
        "when",
        "where",
        "which",
        "how",
        "why",
        "who",
        "whom",
        "whose",

        // English generic verbs
        "do",
        "does",
        "did",
        "doing",
        "done",
        "make",
        "makes",
        "made",
        "making",
        "work",
        "works",
        "worked",
        "working",
        "get",
        "gets",
        "got",
        "getting",
        "go",
        "goes",
        "went",
        "going",
        "come",
        "comes",
        "came",
        "coming",
        "take",
        "takes",
        "took",
        "taking",
        "give",
        "gives",
        "gave",
        "giving",

        // English modal verbs
        "should",
        "could",
        "would",
        "might",
        "must",
        "can",
        "may",
        "shall",
        "will",

        // English auxiliary/helping verbs
        "need",
        "needs",
        "needed",
        "needing",
        "have",
        "has",
        "had",
        "having",
        "want",
        "wants",
        "wanted",
        "wanting",

        // English generic nouns
        "task",
        "tasks",
        "item",
        "items",
        "thing",
        "things",
        "work",
        "job",
        "jobs",
        "stuff",
        "matter",
        "matters",
        "issue",
        "issues",
        "problem",
        "problems",

        // Chinese question words (什么/怎么/哪里等)
        "什么",
        "怎么",
        "哪里",
        "哪个",
        "为什么",
        "怎样",
        "谁",
        "哪",
        "何",

        // Chinese generic verbs (做/可以/能等)
        "做",
        "可以",
        "能",
        "应该",
        "需要",
        "有",
        "要",
        "干",
        "搞",
        "弄",
        "办",
        "处理",

        // Chinese generic nouns (任务/事情等)
        "任务",
        "事情",
        "东西",
        "工作",
        "活",
        "问题",
        "事",
        "事儿",

        // Swedish question words
        "vad",
        "när",
        "var",
        "vilken",
        "vilka",
        "vilket",
        "hur",
        "varför",
        "vem",
        "vems",

        // Swedish generic verbs
        "göra",
        "gör",
        "gjorde",
        "gjort",
        "arbeta",
        "arbetar",
        "arbetade",
        "ta",
        "tar",
        "tog",
        "tagit",

        // Swedish modal/auxiliary verbs
        "kan",
        "kunde",
        "kunnat",
        "ska",
        "skulle",
        "skolat",
        "behöver",
        "behövde",
        "behövt",
        "har",
        "hade",
        "haft",
        "vill",
        "ville",
        "velat",

        // Swedish generic nouns
        "uppgift",
        "uppgifter",
        "sak",
        "saker",
        "arbete",
        "jobb",
        "ärende",

        // German question words
        "was",
        "wann",
        "wo",
        "welche",
        "welcher",
        "welches",
        "wie",
        "warum",
        "wer",
        "wessen",

        // German generic verbs
        "machen",
        "macht",
        "machte",
        "gemacht",
        "tun",
        "tat",
        "getan",
        "arbeiten",
        "arbeitete",
        "gearbeitet",

        // German modal verbs
        "sollen",
        "sollte",
        "können",
        "konnte",
        "müssen",
        "musste",
        "dürfen",
        "durfte",

        // German generic nouns
        "aufgabe",
        "aufgaben",
        "sache",
        "sachen",
        "arbeit",
        "ding",
        "dinge",

        // Spanish question words
        "qué",
        "cuándo",
        "dónde",
        "cuál",
        "cuáles",
        "cómo",
        "por qué",
        "quién",
        "quiénes",

        // Spanish generic verbs
        "hacer",
        "hace",
        "hizo",
        "hecho",
        "trabajar",
        "trabaja",
        "trabajó",

        // Spanish modal verbs
        "deber",
        "debe",
        "debería",
        "poder",
        "puede",
        "podría",
        "necesitar",
        "necesita",

        // Spanish generic nouns
        "tarea",
        "tareas",
        "cosa",
        "cosas",
        "trabajo",
        "asunto",
        "asuntos",

        // French question words
        "quoi",
        "que",
        "quel",
        "quelle",
        "quels",
        "quelles",
        "quand",
        "où",
        "comment",
        "pourquoi",
        "qui",

        // French generic verbs
        "faire",
        "fait",
        "fais",
        "font",
        "travailler",
        "travaille",
        "travaillé",

        // French modal verbs
        "devoir",
        "doit",
        "devrait",
        "pouvoir",
        "peut",
        "pourrait",
        "falloir",
        "faut",
        "faudrait",

        // French generic nouns
        "tâche",
        "tâches",
        "chose",
        "choses",
        "travail",
        "affaire",
        "affaires",

        // Japanese question words (hiragana)
        "なに",
        "なん",
        "いつ",
        "どこ",
        "どれ",
        "どう",
        "なぜ",
        "だれ",

        // Japanese generic verbs
        "する",
        "やる",
        "できる",

        // Japanese generic nouns
        "こと",
        "もの",
        "タスク",
        "仕事",
    ]);

    /**
     * Check if a word is generic/vague
     * Case-insensitive matching
     */
    public static isGenericWord(word: string): boolean {
        return this.GENERIC_QUERY_WORDS.has(word.toLowerCase());
    }

    /**
     * Calculate vagueness ratio of keywords
     * Returns 0.0-1.0 representing percentage of generic words
     */
    public static calculateVaguenessRatio(keywords: string[]): number {
        if (!keywords || keywords.length === 0) {
            return 0.0;
        }

        const genericCount = keywords.filter((kw) =>
            Array.from(this.GENERIC_QUERY_WORDS).some((generic) =>
                kw.toLowerCase().includes(generic.toLowerCase()),
            ),
        ).length;

        return genericCount / keywords.length;
    }
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
