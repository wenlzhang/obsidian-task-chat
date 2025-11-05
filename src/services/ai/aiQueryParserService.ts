import { requestUrl } from "obsidian";
import {
    PluginSettings,
    getCurrentProviderConfig,
    getProviderForPurpose,
    getProviderConfigForPurpose,
} from "../../settings";
import { PromptBuilderService } from "./aiPromptBuilderService";
import { AIPropertyPromptService } from "./aiPropertyPromptService";
import { TaskPropertyService } from "../tasks/taskPropertyService";
import { StopWords } from "../../utils/stopWords";
import { TaskIndexService } from "../tasks/taskIndexService";
import { PricingService } from "./pricingService";
import { Logger } from "../../utils/logger";
import { ErrorHandler, AIError } from "../warnings/errorHandler";
import { TokenUsage } from "../../models/task";

/**
 * Structured query result from AI parsing - Three-part system
 *
 * PART 1: Task Content
 * - Core keywords and semantic expansions for matching task text
 *
 * PART 2: Task Attributes
 * - Structured filters: priority, dueDate, status, folder, tags
 *
 * PART 3: Executor/Environment Context (Future)
 * - Time context, energy state, user preferences, etc.
 * - Reserved for future implementation
 */
export interface ParsedQuery {
    // PART 1: Task Content (Keywords & Semantic Search)
    keywords?: string[]; // Expanded keywords for semantic matching
    coreKeywords?: string[]; // Original extracted keywords before expansion

    // PART 2: Task Attributes (Structured Filters)
    // Multi-value support: Can be single value or array
    priority?: number | number[]; // Single: 1, Multi: [1, 2, 3]
    dueDate?: string; // Single date: "today", "overdue", "+5d" (relative)
    dueDateRange?: {
        // Date range: "this week", "next month"
        start: string;
        end: string;
    };
    status?: string | string[]; // Single: "open", Multi: ["open", "inProgress"]
    folder?: string;
    tags?: string[];

    // PART 3: Executor/Environment Context (Future - Reserved)
    // timeContext?: string; // Current time, time of day, etc.
    // energyState?: string; // User's energy level, focus state
    // userPreferences?: Record<string, any>; // Custom user context

    // Metadata
    originalQuery?: string;
    expansionMetadata?: {
        enabled: boolean;
        expansionsPerLanguagePerKeyword: number;
        languagesUsed: string[];
        totalKeywords: number; // Total after expansion
        coreKeywordsCount: number; // Original count before expansion
    };

    // AI Understanding Metadata (for Natural Language & Typo Correction)
    aiUnderstanding?: {
        detectedLanguage?: string; // Primary language detected - full name (e.g., "English", "Chinese", "Swedish")
        correctedTypos?: string[]; // List of corrections made (e.g., ["urgant→urgent", "taks→task"])
        semanticMappings?: {
            // What AI understood from natural language
            status?: string; // e.g., "working on" → "inprogress"
            priority?: string; // e.g., "urgent" → 1
            dueDate?: string; // e.g., "tomorrow" → specific date
        };
        confidence?: number; // 0-1, how confident AI is in the parsing
        naturalLanguageUsed?: boolean; // Whether user used natural language vs exact syntax
    };

    // Parser Error Information (for fallback cases)
    _parserError?: string; // Error message if parsing failed
    _parserModel?: string; // Model that was attempted (provider/model)

    // Token Usage from Query Parsing (AI calls made during parsing)
    _parserTokenUsage?: TokenUsage;
}

/**
 * AI-powered query parser that extracts structured filters
 */
export class QueryParserService {
    /**
     * Use AI to parse user query into structured filters
     *
     * Strategy:
     * 1. Extract standard property syntax (P1, s:open, overdue) via regex
     * 2. Remove extracted properties from query
     * 3. If remaining text has keywords → Use AI to expand those
     * 4. Combine results
     *
     * This ensures:
     * - Pure properties ("P1 overdue") → Skip AI entirely
     * - Mixed queries ("Fix bug P1") → Use AI only for keywords
     * - Pure keywords ("Fix bug") → Use AI for expansion
     */
    static async parseQuery(
        query: string,
        settings: PluginSettings,
        abortSignal?: AbortSignal,
    ): Promise<ParsedQuery> {
        // Step 1: Try to extract standard property syntax via regex
        const standardProperties = this.extractStandardProperties(
            query,
            settings,
        );

        // Step 2: Remove standard property syntax from query
        let remainingQuery = this.removeStandardProperties(query);
        remainingQuery = remainingQuery.trim();

        // Step 3: If no remaining keywords, return pure properties result
        if (!remainingQuery || remainingQuery.length === 0) {
            // Pure property query - no AI needed
            return {
                ...standardProperties,
                originalQuery: query,
            };
        }

        // Step 4: Use AI to parse remaining keywords (and detect natural language properties)
        // AI will naturally:
        // - Identify stop words via prompt instructions (smarter than regex)
        // - Extract meaningful keywords only
        // - Expand semantically across configured languages
        const aiResult = await this.parseWithAI(
            remainingQuery,
            settings,
            abortSignal,
        );

        // Step 5: Merge standard properties with AI results
        // Standard properties take precedence (user was explicit)
        return {
            ...aiResult,
            ...standardProperties, // Override with standard syntax if present
            originalQuery: query,
        };
    }

    /**
     * Extract JSON from AI response, handling various wrappers and formats
     * Supports: DeepSeek <think> tags, markdown code blocks, reasoning tags, explanatory text
     */
    private static extractJSON(response: string): string {
        // Step 1: Remove various reasoning/thinking blocks from different models
        const cleaned = response
            // DeepSeek's <think> tags
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            // Generic <reasoning> tags
            .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
            // Generic <thought> tags
            .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
            .trim();

        // Step 1.5: Check if response contains markdown headings (## or ###)
        // This indicates the model returned analysis instead of JSON
        if (cleaned.match(/^#{1,6}\s+/m)) {
            Logger.warn(
                "AI returned markdown analysis instead of JSON. First 200 chars:",
                cleaned.substring(0, 200),
            );
            Logger.warn(
                "This often happens with smaller open-source models. Consider using a larger model or a cloud provider.",
            );
            // Continue trying to extract JSON, but log the issue
        }

        // Step 2: Try to extract from markdown code blocks first (common format)
        // Pattern: ```json {...} ``` or ```{...}```
        const markdownMatch = cleaned.match(
            /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
        );
        if (markdownMatch && markdownMatch[1]) {
            try {
                // Verify it's valid JSON before returning
                JSON.parse(markdownMatch[1]);
                return markdownMatch[1];
            } catch (_e) {
                // Continue to other extraction methods
            }
        }

        // Step 3: Find all potential JSON objects (using a more sophisticated approach)
        // Look for balanced braces that could be JSON objects
        const jsonCandidates: string[] = [];
        let braceCount = 0;
        let startIndex = -1;

        for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === "{") {
                if (braceCount === 0) {
                    startIndex = i;
                }
                braceCount++;
            } else if (cleaned[i] === "}") {
                braceCount--;
                if (braceCount === 0 && startIndex !== -1) {
                    // Found a complete JSON object
                    jsonCandidates.push(cleaned.substring(startIndex, i + 1));
                }
            }
        }

        // Step 4: Try to parse each candidate and return the first valid one
        // Prioritize candidates with expected fields (priority, keywords, etc.)
        for (const candidate of jsonCandidates) {
            try {
                const parsed = JSON.parse(candidate);
                // Check if it has expected query parser fields
                if (
                    typeof parsed === "object" &&
                    (Object.prototype.hasOwnProperty.call(parsed, "keywords") ||
                        Object.prototype.hasOwnProperty.call(parsed, "priority") ||
                        Object.prototype.hasOwnProperty.call(parsed, "dueDate") ||
                        Object.prototype.hasOwnProperty.call(parsed, "status") ||
                        Object.prototype.hasOwnProperty.call(parsed, "folder") ||
                        Object.prototype.hasOwnProperty.call(parsed, "tags"))
                ) {
                    return candidate; // This looks like our target JSON
                }
            } catch (_e) {
                // Not valid JSON, try next candidate
                continue;
            }
        }

        // Step 5: If no valid query parser JSON found, return the first valid JSON object
        for (const candidate of jsonCandidates) {
            try {
                JSON.parse(candidate);
                return candidate; // At least it's valid JSON
            } catch (_e) {
                continue;
            }
        }

        // Step 6: Fallback - use simple first/last brace extraction
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return cleaned.substring(firstBrace, lastBrace + 1);
        }

        // Step 7: No JSON found at all - log detailed error
        Logger.error(
            "Failed to extract any JSON from AI response. Full response length:",
            response.length,
        );
        Logger.error("Response preview:", response.substring(0, 500));
        Logger.error(
            "This model may not support structured JSON output reliably. Consider:",
        );
        Logger.error(
            "1. Using a larger model (e.g., llama3.1:70b instead of 20b)",
        );
        Logger.error(
            "2. Using a cloud provider (OpenAI, Anthropic) for better reliability",
        );
        Logger.error(
            "3. Switching to Simple Search mode (which doesn't require AI parsing)",
        );

        // Step 8: Return cleaned response and let JSON.parse throw error with context
        return cleaned;
    }

    /**
     * Extract standard property syntax from query
     * Uses existing TaskIndexService.parseStandardQuerySyntax() to avoid code duplication
     *
     * This is a lightweight wrapper that delegates to the comprehensive standard parser
     * which handles: Todoist patterns, chrono-node dates, and more.
     */
    private static extractStandardProperties(
        query: string,
        settings: PluginSettings,
    ): Partial<ParsedQuery> {
        // Use existing comprehensive standard syntax parser - it handles:
        // - Priority: p1, p2, p3, p4
        // - Status: s:open, s:completed, s:inprogress, etc.
        // - Due dates: overdue, today, tomorrow, "next Friday" (chrono-node)
        // - Special keywords: no date, recurring, etc.
        // - Projects: ##project
        // - Date ranges: due before:, due after:
        const standardParsed = TaskIndexService.parseStandardQuerySyntax(query);

        const result: Partial<ParsedQuery> = {};

        // Extract only the properties we need (priority, status, dueDate)
        // Leave keywords to AI for semantic expansion
        if (standardParsed.priority !== undefined) {
            result.priority = standardParsed.priority;
        }

        // Status from statusValues array (s:value syntax)
        // DO NOT resolve to category keys here - pass raw values through!
        // Let datacoreService's resolveStatusValuesToSymbols() handle the distinction
        // between direct symbols ("s:b") and categories ("s:important")
        if (
            standardParsed.statusValues &&
            standardParsed.statusValues.length > 0
        ) {
            // Validate values but keep them as-is
            const validValues = [];
            for (const value of standardParsed.statusValues) {
                // Check if value is valid (category, alias, or symbol)
                const resolved = TaskPropertyService.resolveStatusValue(
                    value,
                    settings,
                );
                if (resolved) {
                    validValues.push(value); // Keep raw value, not resolved category!
                }
            }

            if (validValues.length > 0) {
                // Single value or multiple values
                result.status =
                    validValues.length === 1 ? validValues[0] : validValues;
            }
        }

        // Due date from either dueDate field or special keywords
        if (standardParsed.dueDate) {
            result.dueDate = standardParsed.dueDate;
        } else if (standardParsed.specialKeywords) {
            // Map special keywords to dueDate values
            if (standardParsed.specialKeywords.includes("overdue")) {
                result.dueDate = "overdue";
            } else if (standardParsed.specialKeywords.includes("no_date")) {
                result.dueDate = "no date";
            } else if (standardParsed.specialKeywords.includes("has_date")) {
                result.dueDate = "any";
            }
        }

        return result;
    }

    /**
     * Remove standard property syntax from query to get remaining keywords
     * STRATEGY: Global removal (removes properties from anywhere in query)
     * Uses shared pattern list from TaskPropertyService.getAllPropertyPatterns()
     *
     * This differs from TaskSearchService.removePropertySyntax() which only removes
     * from beginning/end to preserve middle content. Here we remove all properties
     * globally before sending remaining keywords to AI for semantic expansion.
     */
    private static removeStandardProperties(query: string): string {
        let cleaned = query;

        // Use comprehensive shared pattern list from TaskPropertyService
        // This ensures consistency across all services and eliminates duplication
        const patterns = TaskPropertyService.getAllPropertyPatterns();

        // Remove all property patterns globally (from anywhere in the query)
        for (const pattern of patterns) {
            cleaned = cleaned.replace(pattern, "");
        }

        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, " ").trim();

        return cleaned;
    }

    /**
     * Use AI to parse query into structured format
     * Uses shared PromptBuilderService for consistent prompt generation
     */
    private static async parseWithAI(
        query: string,
        settings: PluginSettings,
        abortSignal?: AbortSignal,
    ): Promise<ParsedQuery> {
        // Get configured languages for semantic search
        // Default to English if user hasn't configured any languages
        const queryLanguages =
            settings.queryLanguages && settings.queryLanguages.length > 0
                ? settings.queryLanguages
                : ["English"];
        const languageList = queryLanguages.join(", ");

        // Get semantic expansion settings
        const expansionsPerLanguage = settings.expansionsPerLanguage || 5;
        const expansionEnabled = settings.enableSemanticExpansion !== false;
        // Total keywords to generate PER core keyword (not total for entire query)
        // Formula: expansionsPerLanguage × number of languages
        // Example: 5 expansions/language × 2 languages = 10 semantic equivalents per keyword
        const maxKeywordsPerCore = expansionEnabled
            ? expansionsPerLanguage * queryLanguages.length
            : queryLanguages.length; // Just original keywords in each language, no semantic expansion

        // Build property term mappings (three-layer system: user + internal + semantic)
        const propertyTermMappings =
            AIPropertyPromptService.buildPropertyTermMappingsForParser(
                settings,
                queryLanguages,
            );
        const dueDateValueMapping =
            AIPropertyPromptService.buildDueDateValueMapping();
        const statusValueMapping =
            AIPropertyPromptService.buildStatusValueMapping(settings);
        const priorityValueMapping =
            PromptBuilderService.buildPriorityMappingForParser(
                settings,
                queryLanguages,
            );
        const statusMapping = PromptBuilderService.buildStatusMappingForParser(
            settings,
            queryLanguages,
        );
        const dateFieldNames =
            PromptBuilderService.buildDateFieldNamesForParser(settings);

        // Get COMPLETE stop words list dynamically from StopWords class
        const stopWordsList = StopWords.getStopWordsList();
        const stopWordsDisplay = stopWordsList.join('", "');

        const systemPrompt = `You are a user query parser for a task management system. Parse the user's natural language query into structured filters.

THREE-PART QUERY PARSING SYSTEM:
This system extracts queries into three distinct parts:

PART 1: TASK CONTENT (Keywords)
- Core keywords that match task content
- Semantic expansions for the core keywords for better recall

PART 2: TASK ATTRIBUTES (Structured Filters)
- Due date, priority, status, folder, tags
- Used for precise task filtering via Dataview API

PART 3: EXECUTOR & ENVIRONMENT CONTEXT (Reserved for future)
- Time context, energy state, location, equipment, etc.
- Not yet implemented

1️⃣ CRITICAL PARSING RULES

🚨 CRITICAL: JSON FORMAT RULES 🚨
YOU MUST RETURN **ONLY** VALID JSON. NO EXPLANATIONS. NO MARKDOWN. NO ANALYSIS.

❌ DO NOT return:
- Markdown headings (##, ###)
- Explanatory text before or after JSON
- Dependency trees, syntax analysis, or linguistic breakdowns
- Any text that is not parseable JSON

✅ CORRECT output format:
{
  "coreKeywords": [<array of ORIGINAL extracted keywords BEFORE expansion>],
  "keywords": [<array of EXPANDED search terms with semantic equivalents across all languages>],
  "priority": <number or array of numbers or null>,
  "dueDate": <string or null>,
  "dueDateRange": <{start: string, end: string} or null>,
  "status": <string or array of strings or null>,
  "folder": <string or null>,
  "tags": [<hashtags from query, WITHOUT the # symbol>],
  "aiUnderstanding": {
    "detectedLanguage": <string, full language name detected (e.g., "English", "Chinese", "Swedish")>,
    "correctedTypos": [<array of corrections, e.g., "urgant→urgent", "taks→tasks">],
    "semanticMappings": {
      "priority": <string or null, how natural language mapped to priority, e.g., "urgent → 1">,
      "status": <string or null, how natural language mapped to status, e.g., "working on → inprogress">,
      "dueDate": <string or null, how natural language mapped to due date, e.g., "tomorrow → 2025-01-23">
    },
    "confidence": <number 0-1, how confident you are in the parsing>,
    "naturalLanguageUsed": <boolean, true if user used natural language vs exact syntax>
  }
}

⚠️ If you return ANYTHING other than pure JSON, the system will FAIL.
⚠️ Start your response with { and end with }
⚠️ NO markdown code blocks (no \`\`\`json), just raw JSON

🚨 CRITICAL: SEMANTIC EXPANSION COUNT
**YOU MUST GENERATE EXACTLY ${expansionsPerLanguage} SEMANTIC EQUIVALENTS PER LANGUAGE FOR EACH CORE KEYWORD**

Your settings:
- Languages: ${queryLanguages.length} (${languageList})
- Expansions per language: ${expansionsPerLanguage}
- Total per core keyword: ${maxKeywordsPerCore} (${expansionsPerLanguage} × ${queryLanguages.length})

⚠️ CRITICAL: If user sets 50 expansions per language:
- Generate EXACTLY 50 equivalents in English
- Generate EXACTLY 50 equivalents in 中文
- Total: 100 keywords per core keyword (NOT 15!)

⚠️ DO NOT limit yourself to examples shown below!
⚠️ Examples show ~15 items for readability, but you MUST generate ${expansionsPerLanguage} per language!
⚠️ For high counts (30-100), generate creative variations: synonyms, related terms, alternative phrasings!

2️⃣ THE THREE-PART SYSTEM BREAKDOWN

PART 1: TASK CONTENT (Keywords) BREAKDOWN

SEMANTIC KEYWORD EXPANSION SETTINGS:
- Languages configured: ${languageList}
- Number of languages: ${queryLanguages.length}
- Target expansions per keyword per language: ${expansionsPerLanguage}
- Expansion enabled: ${expansionEnabled}
- Target variations to generate PER core keyword: ${maxKeywordsPerCore}
  (Formula: ${expansionsPerLanguage} expansions/language × ${queryLanguages.length} languages)

🚨 CRITICAL EXPANSION REQUIREMENT:
You MUST expand EVERY SINGLE core keyword into ALL ${queryLanguages.length} configured languages: ${languageList}

⚠️ KEY CONCEPT: Direct Cross-Language Semantic Equivalence
- This is NOT a translation task!
- For EACH core keyword, generate semantic equivalents DIRECTLY in each target language
- Think: "What are different ways to express this CONCEPT in language X?"
- Example with your configured ${queryLanguages.length} languages (${languageList}):
  * Keyword "develop" → Generate equivalents in ALL ${queryLanguages.length} languages
  * Keyword "任务" → Generate equivalents in ALL ${queryLanguages.length} languages
  * Source language doesn't matter - ALWAYS generate in ALL configured languages!

For EACH core keyword (including proper nouns like "Task", "Chat", etc.):
- Iterate over every language in the user's configuration (queryLanguages array):
${
    queryLanguages.length > 0
        ? queryLanguages
              .map(
                  (lang, idx) =>
                      `  - queryLanguages[${idx}] = ${lang} → Generate ${expansionsPerLanguage} semantic equivalents DIRECTLY in this language`,
              )
              .join("\n")
        : `  - No additional languages configured → Generate ${expansionsPerLanguage} semantic equivalents identified from the user's query language`
}
- Total: EXACTLY ${maxKeywordsPerCore} variations per core keyword

⚠️ NO EXCEPTIONS:
- Do NOT skip any language for ANY keyword (regardless of keyword's source language)
- Do NOT treat proper nouns differently - expand them too!
- Do NOT leave core keywords unexpanded
- Do NOT just translate - generate semantic equivalents!
- EVERY core keyword MUST have ${maxKeywordsPerCore} total variations

Example with ${queryLanguages.length} languages and target ${expansionsPerLanguage} expansions:
  Core keyword "develop" → ~${maxKeywordsPerCore} variations total:
  ${queryLanguages.map((lang, idx) => `[variations ${idx * expansionsPerLanguage + 1}-${(idx + 1) * expansionsPerLanguage} in ${lang}]`).join(", ")}

PART 2: TASK ATTRIBUTES (Structured Filters) BREAKDOWN

🚨 TASK PROPERTY RECOGNITION (Direct Concept-to-Dataview Conversion)

⚠️ CRITICAL PRINCIPLE: Properties use CONCEPT RECOGNITION and CONVERSION!

Unlike keywords (which need semantic expansion for better recall), task properties use your native language understanding to:
1. Recognize the concept (STATUS, PRIORITY, DUE_DATE) in ANY language
2. Convert directly to Dataview-compatible format (category keys, numbers, dates)

NO expansion needed - you already understand all languages!

**CONFIGURED LANGUAGES FOR CONTEXT**:
You're working with ${queryLanguages.length} configured languages: ${languageList}
- Use this context to better understand property terms in these languages
- But remember: You can recognize properties in ANY language, not just these

**YOUR NATIVE LANGUAGE UNDERSTANDING**:
You have native understanding of ALL human languages. Use this to:

1. **Recognize Property CONCEPTS** (in ANY language the user types):
    - **DUE_DATE concept** = Deadline, target date, timing, expiration, etc.
    - **PRIORITY concept** = Urgency, criticality, high/low priority, etc.
    - **STATUS concept** = State, condition, progress level, completion state, etc.

2. **Convert DIRECTLY to Dataview format** (always English field names):
   - PRIORITY concept → priority: 1-4 (number) or null
     * Urgent/critical/high/asap → 1
     * Medium → 2
     * Normal → 3
     * Low/minor → 4
     * null = user wants tasks WITH priority (any value, including none value)
   
   - STATUS concept → status: string or null
     * Open/todo/pending → "${TaskPropertyService.STATUS_CATEGORY.open}"
     * In progress/doing/working/active → "${TaskPropertyService.STATUS_CATEGORY.inProgress}"
     * Done/finished/completed → "${TaskPropertyService.STATUS_CATEGORY.completed}"
     * Cancelled/abandoned/dropped → "${TaskPropertyService.STATUS_CATEGORY.cancelled}"
     * Use category keys from STATUS MAPPING below (supports custom categories)
   
   - DUE_DATE concept → dueDate: string or null
     * Specific values defined in DUE DATE VALUE MAPPING below
     * Common: "${TaskPropertyService.DUE_DATE_KEYWORDS.today}", "${TaskPropertyService.DUE_DATE_KEYWORDS.tomorrow}", "${TaskPropertyService.DUE_DATE_KEYWORDS.overdue}", "${TaskPropertyService.DUE_DATE_KEYWORDS.any}", "${TaskPropertyService.DUE_DATE_KEYWORDS.future}", "${TaskPropertyService.DUE_DATE_KEYWORDS.week}", "${TaskPropertyService.DUE_DATE_KEYWORDS.nextWeek}"
     * "${TaskPropertyService.DUE_DATE_KEYWORDS.any}" = user wants tasks WITH due dates (not a specific date)

3. **Respect User Settings**:
   - Priority mappings: ${JSON.stringify(settings.datacorePriorityMapping)}
   - Status mappings: ${JSON.stringify(settings.datacoreStatusMapping)}
   - Due date field name: "${settings.datacoreKeys.dueDate}"
   - User's due date terms: ${JSON.stringify(settings.userPropertyTerms.dueDate)}
   - See detailed mappings below (PRIORITY VALUE MAPPING, STATUS MAPPING, DUE DATE VALUE MAPPING)
   - These provide complete property recognition rules and normalization values

⚠️ PROCESS FOR PROPERTIES:
1. Read user's query in ANY language
2. Recognize which concepts are expressed (priority? status? due date?)
3. Convert directly to Dataview format (category keys, not expanded terms)
4. Use native language understanding - NO expansion needed!

**Examples of Direct Conversion (works in ANY language, including your ${queryLanguages.length} configured languages: ${languageList})**:

Priority concept:
- "urgent tasks" → priority: 1, keywords: []
- "紧急任务" → priority: 1, keywords: []
- "brådskande uppgifter" → priority: 1, keywords: []

Status concept:
- "in progress" → status: "inprogress", keywords: []
- "进行中" → status: "inprogress", keywords: []
- "pågående" → status: "inprogress", keywords: []

Due date concept:
- "overdue tasks" → dueDate: "overdue", keywords: []
- "过期任务" → dueDate: "overdue", keywords: []
- "försenade uppgifter" → dueDate: "overdue", keywords: []

⚠️ KEY POINTS:
- Properties = concept recognition + direct conversion to category keys (NO expansion)
- Keywords = semantic expansion across languages for better matching (YES expansion)
- You already know all languages - use native understanding, not pre-programmed phrases
- Map concept → category key (language-independent internal identifier)

${propertyTermMappings}

${priorityValueMapping}

${statusMapping}

${dateFieldNames}

${dueDateValueMapping}

${statusValueMapping}

🚨 CRITICAL: PROPERTY + KEYWORD COMBINED QUERIES

When users mix keywords with property terms, handle them correctly:

Example 1: "开发 Task Chat 插件，with due date"
- Content keywords: "开发", "Task", "Chat", "插件" → expand normally
- Property term: "with due date" → dueDate: "any"
- Result:
  {
    "coreKeywords": ["开发", "Task", "Chat", "插件"],
    "keywords": [<expanded versions in ${languageList}>],
    "dueDate": "any"
  }

Example 2: "urgent bug fix due today"
- Property term: "urgent" → priority: 1
- Property term: "due today" → dueDate: "today"
- Content keywords: "bug", "fix" → expand normally
- Result:
  {
    "coreKeywords": ["bug", "fix"],
    "keywords": [<expanded versions in ${languageList}>],
    "priority": 1,
    "dueDate": "today"
  }

Example 3: "高优先级的开发任务，next week"
- Property term: "高优先级" → priority: 1
- Property term: "next week" → dueDate: "next-week"
- Property term: "任务" → not keywords, just descriptive
- Content keywords: "开发" → expand normally
- Result:
  {
    "coreKeywords": ["开发"],
    "keywords": [<expanded versions in ${languageList}>],
    "priority": 1,
    "dueDate": "next-week"
  }

Example 4: "open bug reports"
- Property term: "open" → status: "open"
- Content keywords: "bug", "reports" → expand normally
- Result:
  {
    "coreKeywords": ["bug", "reports"],
    "keywords": [<expanded versions in ${languageList}>],
    "status": "open"
  }

Example 5: "已完成的任务 due last week"
- Property term: "已完成" → status: "completed"
- Property term: "last week" → dueDate: "overdue" (past due)
- Property term: "任务" → not keywords, just descriptive
- Result:
  {
    "coreKeywords": [],
    "keywords": [<expanded versions in ${languageList}>],
    "status": "completed",
    "dueDate": "overdue"
  }

Example 6: "pågående high priority tasks"
- Property term: "pågående" → status: "inProgress"
- Property term: "high priority" → priority: 1
- Property term: "tasks" → not keywords, just descriptive
- Result:
  {
    "coreKeywords": [],
    "keywords": [<expanded versions in ${languageList}>],
    "status": "inProgress",
    "priority": 1
  }

⚠️ KEY RULES FOR COMBINED QUERIES:
1. Identify property terms FIRST (priority, due date, status)
2. Extract property values to structured fields
3. Remove property terms from content keywords
4. Expand remaining content keywords normally
5. Property terms should NEVER appear in keywords array
6. Each query can have BOTH keywords AND properties

🚨 MULTI-VALUE PROPERTIES & DATE RANGES

The system supports multi-value properties and date ranges for more flexible filtering:

**MULTI-VALUE PRIORITY:**
Users can specify multiple priority levels to search across:

Examples:
- "priority 1 2 3 tasks" → priority: [1, 2, 3] (array for multi-value)
- "high or medium priority" → priority: [1, 2] (array)
- "priority 1" → priority: 1 (single number)
- "priority tasks" → priority: null (any priority)

Rules:
- If user specifies multiple numeric priorities, return as array: [1, 2, 3]
- If user says "1 or 2" or "1 2", return as array: [1, 2]
- If user specifies one priority, return as single number: 1
- If user just wants tasks WITH priority (no specific value), return null

**MULTI-VALUE STATUS:**
Users can specify multiple statuses to search across:

Examples:
- "open or in progress tasks" → status: ["open", "inProgress"] (array for multi-value)
- "completed or cancelled" → status: ["completed", "cancelled"] (array)
- "done tasks" → status: "completed" (single string)
- "active tasks" → status: ["open", "inProgress"] (interpret "active" as multiple statuses)

⚠️ RULES:
- If user specifies multiple statuses, return as array
- If user says "or", return as array
- If user specifies one status, return as single string
- Use ONLY the status category keys defined in the STATUS MAPPING section above (supports custom categories)

**RELATIVE DATE SUPPORT:**
Users can specify dates relative to today:

Examples:
- "due in 5 days" → dueDate: "+5d" (5 days from now)
- "due in 2 weeks" → dueDate: "+2w" (2 weeks from now)
- "due in 1 month" → dueDate: "+1m" (1 month from now)
- "due today" → dueDate: "today" (existing format)
- "overdue" → dueDate: "overdue" (existing format)

Relative date format:
- "+Nd" = N days from now (e.g., "+5d" = 5 days)
- "+Nw" = N weeks from now (e.g., "+2w" = 2 weeks)
- "+Nm" = N months from now (e.g., "+1m" = 1 month)

**DATE RANGE SUPPORT:**
Users can specify date ranges:

Examples:
- "due this week" → dueDateRange: {start: "week-start", end: "week-end"}
- "due next week" → dueDateRange: {start: "next-week-start", end: "next-week-end"}
- "due this month" → dueDateRange: {start: "month-start", end: "month-end"}
- "due between Monday and Friday" → dueDateRange: {start: "YYYY-MM-DD", end: "YYYY-MM-DD"}

⚠️ RULES:
- If user specifies a range, use dueDateRange with start and end
- If user specifies a single date/relative date, use dueDate
- Do NOT use both dueDate and dueDateRange in same query

**MULTI-VALUE + RANGE COMBINED EXAMPLES:**

Example 1: "priority 1 2 tasks due this week"
Result:
{
  "coreKeywords": [],
  "keywords": [],
  "priority": [1, 2],
  "dueDateRange": {"start": "week-start", "end": "week-end"}
}

Example 2: "open or in progress high priority tasks"
Result:
{
  "coreKeywords": [],
  "keywords": [],
  "status": ["open", "inProgress"],
  "priority": 1
}

Example 3: "completed or cancelled tasks from last month"
Result:
{
  "coreKeywords": [],
  "keywords": [],
  "status": ["completed", "cancelled"],
  "dueDateRange": {"start": "last-month-start", "end": "last-month-end"}
}

3️⃣ COLLECTION OF PARSING RULES

🚨 CRITICAL: JSON FORMAT RULES

- JSON does NOT support comments (no // or /* */)
- Do NOT add explanatory text inside JSON arrays
- Do NOT use arrows (←) or other symbols in JSON
- Return PURE, VALID JSON only - parseable by JSON.parse()
- Any comments or explanations WILL cause parsing errors!

⚠️ CRITICAL FIELD USAGE RULES:
1. "coreKeywords" field: ORIGINAL keywords extracted from query (BEFORE expansion)
   - Extract main concepts/nouns/verbs from the query
   - Remove stop words and filter-related terms
   - These are the BASE keywords before semantic expansion
   
   🔴 CRITICAL: KEYWORD LENGTH & ATOMICITY RULES (applies to ALL ${queryLanguages.length} configured languages: ${languageList})
   
   **Goal**: Extract ATOMIC, MEANINGFUL keywords for optimal search matching
   
   **English & Latin-script languages**:
   - Maximum: 1 word per keyword
   - Prefer single words for better substring matching
   - Split phrases: "AI plugin" → ["AI", "plugin"] NOT ["AI plugin"]
   - Example: "How to develop Obsidian plugin" → ["develop", "Obsidian", "plugin"]
   
   **Chinese (中文) & CJK languages**:
   - Maximum: 2-3 characters per keyword (NOT 4+ character compounds!)
   - Split long compounds into atomic meaningful units
   - Each unit should be independently searchable
   - ❌ WRONG: "在线购物平台" (6 chars, too long!) → will miss "购物" or "平台" alone
   - ✅ CORRECT: ["在线", "购物", "平台"] (3 atomic units, each 2 chars)
   - ❌ WRONG: "数据分析工具" (6 chars) → ["数据分析工具"]
   - ✅ CORRECT: ["数据", "分析", "工具"] (3 units of 2 chars each)
   - ❌ WRONG: "项目管理系统" (6 chars) → ["项目管理系统"]
   - ✅ CORRECT: ["项目", "管理", "系统"] (3 units)
   
   **All other configured languages**:
   - Follow similar atomic principle: break down compounds
   - Maximum 1-2 meaningful units per keyword
   - Prioritize searchability over linguistic correctness
   
   **Why atomic keywords matter**:
   - Query "购物" should match tasks containing "在线购物", "网上购物", "购物系统"
   - Query "algorithm" should match "search algorithm", "sorting algorithm"
   - Atomic keywords = better coverage + more flexible matching
   
   **Examples across languages**:
   - English: "data analysis" → ["data", "analysis"]
   - 中文: "数据分析" → ["数据", "分析"]
   - Svenska: "data analys" → ["data", "analys"]

2. "keywords" field: FULLY EXPANDED keywords with ALL semantic equivalents
   - This should contain ALL semantic equivalents for ALL core keywords combined
   - For EVERY SINGLE core keyword (no exceptions!), you MUST generate its semantic equivalents
   - Total per core keyword: EXACTLY ${maxKeywordsPerCore} variations
   
   ⚠️ IMPORTANT: Direct Cross-Language Generation
   - Do NOT translate! Generate semantic equivalents DIRECTLY in each language
   - Include: synonyms, related terms, alternative phrases, context-appropriate variants
   - Do NOT skip any configured language!
   - Do NOT include hashtags in keywords
   
   ⚠️ MANDATORY EXPANSION REQUIREMENT - READ CAREFULLY:
   - Return as VALID JSON (NO comments, NO arrows, NO explanations in the array!)
   - EVERY core keyword needs EXACTLY ${maxKeywordsPerCore} total variations
   - Proper nouns (like "Task", "Chat") MUST also be expanded
   - Generate equivalents in ALL ${queryLanguages.length} configured languages: ${languageList}
   - For EACH keyword: ${expansionsPerLanguage} equivalents in EACH of the ${queryLanguages.length} languages
   - DO NOT favor any language over others - ALL must be equally represented!
   - If a keyword appears to be in one language, still generate ${expansionsPerLanguage} equivalents in that language PLUS ${expansionsPerLanguage} in each other language
   - Example: For "develop" with [English, 中文], generate ${expansionsPerLanguage} English equivalents + ${expansionsPerLanguage} Chinese equivalents = ${maxKeywordsPerCore} total
   - If you have 4 core keywords, you MUST return ${maxKeywordsPerCore} × 4 = ${maxKeywordsPerCore * 4} total keywords

   🔴 CRITICAL ALGORITHM - FOLLOW THESE STEPS EXACTLY:
   Step 1: For EACH core keyword, create an empty expansion list
   Step 2: For the current keyword, iterate through EVERY language in order: ${languageList}
   Step 3: For each language, generate EXACTLY ${expansionsPerLanguage} semantic equivalents
   Step 4: Add all ${expansionsPerLanguage} equivalents to the expansion list
   Step 5: Repeat steps 2-4 until ALL ${queryLanguages.length} languages are processed
   Step 6: Verify the expansion list has ${maxKeywordsPerCore} total items (${expansionsPerLanguage} × ${queryLanguages.length})
   Step 7: Move to next core keyword and repeat steps 1-6
   
   ⚠️ VERIFICATION CHECKLIST (check before returning):
   ☐ Did I process ALL ${queryLanguages.length} languages for EVERY keyword?
   ☐ Does each keyword have ${expansionsPerLanguage} equivalents in ${queryLanguages[0] || "language 1"}?
   ☐ Does each keyword have ${expansionsPerLanguage} equivalents in ${queryLanguages[1] || "language 2"}?
${queryLanguages.length > 2 ? `   ☐ Does each keyword have ${expansionsPerLanguage} equivalents in ${queryLanguages[2]}?` : ""}
   ☐ Total keywords = ${maxKeywordsPerCore} × (number of core keywords)?

3. "tags" field: Extract hashtags/tags from query (e.g., #work → ["work"])
   - ONLY extract tags that are explicitly marked with # in the query
   - Remove the # symbol when adding to the array
   - If no hashtags in query, leave empty []

4. Return ONLY valid JSON, no reasoning text, no <think> tags, just pure JSON

KEYWORD EXTRACTION & EXPANSION EXAMPLES:

⚠️ CRITICAL: Generate equivalents for ALL ${queryLanguages.length} configured languages: ${languageList}
Do NOT favor any language - ALL languages must be equally represented!

🔴 IMPORTANT: EXPANSION COUNT IN EXAMPLES
The example arrays below (e.g., "[develop, build, create, implement, code]") show ${expansionsPerLanguage} items for illustration.
- If user configured expansionsPerLanguage=${expansionsPerLanguage}, generate EXACTLY ${expansionsPerLanguage} equivalents per language
- If user configured a DIFFERENT value (e.g., 3 or 7), generate that EXACT number instead
- The examples are for DEMONSTRATION only - always use the actual ${expansionsPerLanguage} value!
- DO NOT always generate 5 items just because examples show 5 - respect user's ${expansionsPerLanguage} setting!

Example 1: Query with ${queryLanguages.length} configured languages: ${languageList}
    Query: "开发 Task Chat"
    
    🔴 STEP-BY-STEP ALGORITHM APPLICATION:
    
    Core keyword 1: "开发"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} equivalents → ${
                    lang === "English"
                        ? "[develop, build, create, implement, code]"
                        : lang === "中文"
                          ? "[开发, 构建, 创建, 编程, 制作]"
                          : lang.toLowerCase().includes("swed")
                            ? "[utveckla, bygga, skapa, programmera, implementera]"
                            : `[${expansionsPerLanguage} equivalents in ${lang}]`
                }`,
        )
        .join("\n")}
    Subtotal: ${maxKeywordsPerCore} equivalents ✓
    
    Core keyword 2: "Task"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} equivalents → ${
                    lang === "English"
                        ? "[task, work, job, assignment, item]"
                        : lang === "中文"
                          ? "[任务, 工作, 事项, 项目, 作业]"
                          : lang.toLowerCase().includes("swed")
                            ? "[uppgift, arbete, jobb, uppdrag, ärende]"
                            : `[${expansionsPerLanguage} equivalents in ${lang}]`
                }`,
        )
        .join("\n")}
    Subtotal: ${maxKeywordsPerCore} equivalents ✓
    
    Core keyword 3: "Chat"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} equivalents → ${
                    lang === "English"
                        ? "[chat, conversation, talk, discussion, dialogue]"
                        : lang === "中文"
                          ? "[聊天, 对话, 交流, 谈话, 沟通]"
                          : lang.toLowerCase().includes("swed")
                            ? "[chatt, konversation, prata, diskussion, samtal]"
                            : `[${expansionsPerLanguage} equivalents in ${lang}]`
                }`,
        )
        .join("\n")}
    Subtotal: ${maxKeywordsPerCore} equivalents ✓
    
    ✅ VERIFICATION:
    - Core keywords: 3
    - Languages processed: ${queryLanguages.length} (${languageList})
    - Equivalents per keyword: ${maxKeywordsPerCore} (${expansionsPerLanguage} × ${queryLanguages.length})
    - Total equivalents: 3 × ${maxKeywordsPerCore} = ${3 * maxKeywordsPerCore}

    ⚠️ JSON OUTPUT NOTE: Arrays below show ${expansionsPerLanguage} items as examples.
    In your actual output, generate EXACTLY ${expansionsPerLanguage} equivalents per language (not always 5!).

    {
    "coreKeywords": ["开发", "Task", "Chat"],
    "keywords": [
        ${queryLanguages
            .map((lang, idx) =>
                lang === "English"
                    ? '"develop", "build", "create", "implement", "code"'
                    : lang === "中文"
                      ? '"开发", "构建", "创建", "编程", "制作"'
                      : lang.toLowerCase().includes("swed")
                        ? '"utveckla", "bygga", "skapa", "programmera", "implementera"'
                        : `"[${expansionsPerLanguage} in ${lang}]"`,
            )
            .join(",\n        ")},
        ${queryLanguages
            .map((lang, idx) =>
                lang === "English"
                    ? '"task", "work", "job", "assignment", "item"'
                    : lang === "中文"
                      ? '"任务", "工作", "事项", "项目", "作业"'
                      : lang.toLowerCase().includes("swed")
                        ? '"uppgift", "arbete", "jobb", "uppdrag", "ärende"'
                        : `"[${expansionsPerLanguage} in ${lang}]"`,
            )
            .join(",\n        ")},
        ${queryLanguages
            .map((lang, idx) =>
                lang === "English"
                    ? '"chat", "conversation", "talk", "discussion", "dialogue"'
                    : lang === "中文"
                      ? '"聊天", "对话", "交流", "谈话", "沟通"'
                      : lang.toLowerCase().includes("swed")
                        ? '"chatt", "konversation", "prata", "diskussion", "samtal"'
                        : `"[${expansionsPerLanguage} in ${lang}]"`,
            )
            .join(",\n        ")}
    ],
    "tags": []
    }

    ✅ Result verification:
    - Total: 3 keywords × ${maxKeywordsPerCore} = ${3 * maxKeywordsPerCore} total variations
    - ${queryLanguages[0]}: ${expansionsPerLanguage} + ${expansionsPerLanguage} + ${expansionsPerLanguage} = ${expansionsPerLanguage * 3} keywords ✓
${queryLanguages.length > 1 ? `    - ${queryLanguages[1]}: ${expansionsPerLanguage} + ${expansionsPerLanguage} + ${expansionsPerLanguage} = ${expansionsPerLanguage * 3} keywords ✓` : ""}
${queryLanguages.length > 2 ? `    - ${queryLanguages[2]}: ${expansionsPerLanguage} + ${expansionsPerLanguage} + ${expansionsPerLanguage} = ${expansionsPerLanguage * 3} keywords ✓` : ""}

Example 2: Another query showing algorithm - MUST follow same process!
    Query: "Fix bug"
    
    🔴 APPLY THE SAME ALGORITHM:
    
    Core keyword 1: "fix"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} → ${
                    lang === "English"
                        ? "[fix, repair, solve, correct, resolve]"
                        : lang === "中文"
                          ? "[修复, 解决, 修正, 处理, 纠正]"
                          : lang.toLowerCase().includes("swed")
                            ? "[fixa, reparera, lösa, korrigera, åtgärda]"
                            : `[${expansionsPerLanguage} in ${lang}]`
                }`,
        )
        .join("\n")}
    Subtotal: ${maxKeywordsPerCore} ✓
    
    Core keyword 2: "bug"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} → ${
                    lang === "English"
                        ? "[bug, error, issue, defect, problem]"
                        : lang === "中文"
                          ? "[错误, 问题, 缺陷, 故障, 漏洞]"
                          : lang.toLowerCase().includes("swed")
                            ? "[bugg, fel, problem, defekt, brist]"
                            : `[${expansionsPerLanguage} in ${lang}]`
                }`,
        )
        .join("\n")}
    Subtotal: ${maxKeywordsPerCore} ✓

    ⚠️ JSON OUTPUT NOTE: Each array shows ${expansionsPerLanguage} items. Generate exactly ${expansionsPerLanguage} per language!

    {
    "coreKeywords": ["fix", "bug"],
    "keywords": [
        ${queryLanguages
            .map((lang) =>
                lang === "English"
                    ? '"fix", "repair", "solve", "correct", "resolve"'
                    : lang === "中文"
                      ? '"修复", "解决", "修正", "处理", "纠正"'
                      : lang.toLowerCase().includes("swed")
                        ? '"fixa", "reparera", "lösa", "korrigera", "åtgärda"'
                        : `"[${expansionsPerLanguage} in ${lang}]"`,
            )
            .join(",\n        ")},
        ${queryLanguages
            .map((lang) =>
                lang === "English"
                    ? '"bug", "error", "issue", "defect", "problem"'
                    : lang === "中文"
                      ? '"错误", "问题", "缺陷", "故障", "漏洞"'
                      : lang.toLowerCase().includes("swed")
                        ? '"bugg", "fel", "problem", "defekt", "brist"'
                        : `"[${expansionsPerLanguage} in ${lang}]"`,
            )
            .join(",\n        ")}
    ]
    }

⚠️ CRITICAL: This algorithm MUST be followed for EVERY query - ALL ${queryLanguages.length} languages in ${languageList} for EVERY keyword!

🔴 REMINDER: User configured expansionsPerLanguage=${expansionsPerLanguage}
- Generate EXACTLY ${expansionsPerLanguage} equivalents per language (not always 5!)
- If expansionsPerLanguage=3: generate 3 per language
- If expansionsPerLanguage=7: generate 7 per language  
- DO NOT assume 5 just because examples show 5 items!

Example 2.5: Chinese compound splitting - CRITICAL for atomicity!
    Query: "如何提高在线购物平台性能"
    
    🔴 ATOMICITY ANALYSIS:
    
    ❌ WRONG extraction (too long):
    Core keywords: ["提高", "在线购物平台", "性能"]
    Problem: "在线购物平台" is 6 characters - too long!
    Impact: Query "购物" won't match, "平台" won't match separately
    
    ✅ CORRECT extraction (atomic):
    Core keywords: ["提高", "在线", "购物", "平台", "性能"]
    Benefit: Each 2-char unit is searchable independently
    - "在线" matches "在线系统", "在线服务"
    - "购物" matches "购物车", "网上购物", "购物体验"
    - "平台" matches "电商平台", "平台架构"
    
    🔴 APPLY THE SAME ALGORITHM with atomic keywords:
    
    Core keyword 1: "提高"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} → ${
                    lang === "English"
                        ? "[improve, enhance, boost, increase, raise]"
                        : lang === "中文"
                          ? "[提高, 提升, 改善, 增强, 增进]"
                          : lang.toLowerCase().includes("swed")
                            ? "[förbättra, öka, höja, stärka, förstärka]"
                            : `[${expansionsPerLanguage} in ${lang}]`
                }`,
        )
        .join("\n")}
    
    Core keyword 2: "在线" (NOT "在线购物平台"!)
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} → ${
                    lang === "English"
                        ? "[online, web-based, internet, digital, virtual]"
                        : lang === "中文"
                          ? "[在线, 网上, 线上, 网络, 互联网]"
                          : lang.toLowerCase().includes("swed")
                            ? "[online, webbaserad, internet, digital, virtuell]"
                            : `[${expansionsPerLanguage} in ${lang}]`
                }`,
        )
        .join("\n")}
    
    Core keyword 3: "购物"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} → ${
                    lang === "English"
                        ? "[shopping, purchasing, buying, commerce, retail]"
                        : lang === "中文"
                          ? "[购物, 购买, 采购, 消费, 交易]"
                          : lang.toLowerCase().includes("swed")
                            ? "[shopping, köp, inköp, handel, detaljhandel]"
                            : `[${expansionsPerLanguage} in ${lang}]`
                }`,
        )
        .join("\n")}
    
    Core keyword 4: "平台"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} → ${
                    lang === "English"
                        ? "[platform, system, framework, infrastructure, service]"
                        : lang === "中文"
                          ? "[平台, 系统, 框架, 基础, 服务]"
                          : lang.toLowerCase().includes("swed")
                            ? "[plattform, system, ramverk, infrastruktur, tjänst]"
                            : `[${expansionsPerLanguage} in ${lang}]`
                }`,
        )
        .join("\n")}
    
    Core keyword 5: "性能"
    ${queryLanguages
        .map(
            (lang, idx) =>
                `    Language ${idx + 1} (${lang}): ${expansionsPerLanguage} → ${
                    lang === "English"
                        ? "[performance, efficiency, capability, speed, optimization]"
                        : lang === "中文"
                          ? "[性能, 效率, 能力, 速度, 优化]"
                          : lang.toLowerCase().includes("swed")
                            ? "[prestanda, effektivitet, kapacitet, hastighet, optimering]"
                            : `[${expansionsPerLanguage} in ${lang}]`
                }`,
        )
        .join("\n")}
    
    Result: 5 atomic keywords × ${maxKeywordsPerCore} expansions = ${5 * maxKeywordsPerCore} total keywords
    ✅ Much better coverage! Each atomic unit independently searchable!

PROPERTY EXPANSION EXAMPLES:

Example 3: Chinese priority query - Property term semantic expansion
    Query: "包含优先级的任务" (tasks containing priority)

    THINKING PROCESS:
    - "优先级" is Chinese for "priority" → Recognize as PRIORITY property concept
    - User asks for "tasks containing priority" → wants tasks WITH priority field
    - Extract property: priority: null (any tasks with priority)
    - Extract content keywords: []

    {
    "coreKeywords": [],
    "keywords": [],
    "priority": null,
    "dueDate": null,
    "status": null,
    "tags": []
    }

    Result: System will filter for tasks WITH priority field.

Example 4: Swedish due date query - Property term semantic expansion
    Query: "uppgifter med förfallodatum" (tasks with due date)

    THINKING PROCESS:
    - "förfallodatum" is Swedish for "due date" → Recognize as DUE DATE property concept
    - User asks for "tasks with due date" → wants tasks WITH due dates
    - Extract property: dueDate: "any" (tasks that have due dates)
    - Extract content keywords: []

    {
    "coreKeywords": [],
    "keywords": [],
    "priority": null,
    "dueDate": "any",
    "status": null,
    "tags": []
    }

    Result: System will filter for tasks WITH due dates.

Example 5: Mixed language with specific priority - Property value extraction
  Query: "high priority 任务 due today"
  
  THINKING PROCESS:
  - "high priority" → Recognize as PRIORITY concept with specific value (high = 1)
  - "due today" → Recognize as DUE DATE concept with specific value (today)
  - "任务" → Not a content keyword, descriptive only
  
  {
    "coreKeywords": [],
    "keywords": [],
    "priority": 1,
    "dueDate": "today",
    "status": null,
    "tags": []
  }
  
  Result: System will filter for P1 tasks due today.

Example 6: Multiple properties in Chinese
    Query: "高优先级的过期任务" (high priority overdue tasks)

    THINKING PROCESS:
    - "高优先级" (high priority) → priority: 1
    - "过期" (overdue) → dueDate: "overdue"
    - "任务" → Not a content keyword, descriptive only

    {
    "coreKeywords": [],
    "keywords": [],
    "priority": 1,
    "dueDate": "overdue",
    "status": null,
    "tags": []
    }

    Result: System will filter for P1 overdue tasks.

Example 7: Property + hashtags + keywords
  Query: "Fix urgent bug #backend due today"
  
  THINKING PROCESS:
  - "urgent" → Recognize as priority indicator (high = 1)
  - "due today" → dueDate: "today"
  - "#backend" → tag
  - "Fix", "bug" → Content keywords (expand in ALL ${queryLanguages.length} languages)
  
  {
    "coreKeywords": ["fix", "bug"],
    "keywords": [
      ${queryLanguages
          .map((lang) =>
              lang === "English"
                  ? '"fix", "repair", "solve", "correct", "debug"'
                  : lang === "中文"
                    ? '"修复", "解决", "处理", "纠正", "调试"'
                    : lang.toLowerCase().includes("swed")
                      ? '"fixa", "reparera", "lösa", "korrigera", "felsöka"'
                      : `"[${expansionsPerLanguage} in ${lang}]"`,
          )
          .join(",\n      ")},
      ${queryLanguages
          .map((lang) =>
              lang === "English"
                  ? '"bug", "error", "issue", "defect", "fault"'
                  : lang === "中文"
                    ? '"错误", "问题", "缺陷", "故障", "漏洞"'
                    : lang.toLowerCase().includes("swed")
                      ? '"bugg", "fel", "problem", "defekt", "brist"'
                      : `"[${expansionsPerLanguage} in ${lang}]"`,
          )
          .join(",\n      ")}
    ],
    "priority": 1,
    "dueDate": "today",
    "status": null,
    "tags": ["backend"]
  }

Example 8: Properties only with tag
  Query: "tasks with #work priority 1"
  
  THINKING PROCESS:
  - Property term: "priority 1" → priority: 1
  - "#work" → tag
  - "tasks" is generic word → remove
  - No content keywords
  
  {
    "coreKeywords": [],
    "keywords": [],
    "priority": 1,
    "dueDate": null,
    "status": null,
    "tags": ["work"]
  }

Example 9: Keywords with tags
  Query: "Fix bug #urgent #backend"
  
  THINKING PROCESS:
  - "urgent" in tag context → just tag, not property (because of #)
  - Content keywords: "Fix", "bug" → expand in ALL ${queryLanguages.length} languages
  - Tags: "#urgent", "#backend"
  
  {
    "coreKeywords": ["fix", "bug"],
    "keywords": [
      ${queryLanguages
          .map((lang) =>
              lang === "English"
                  ? '"fix", "repair", "solve", "correct", "debug"'
                  : lang === "中文"
                    ? '"修复", "解决", "处理", "纠正", "调试"'
                    : lang.toLowerCase().includes("swed")
                      ? '"fixa", "reparera", "lösa", "korrigera", "felsöka"'
                      : `"[${expansionsPerLanguage} in ${lang}]"`,
          )
          .join(",\n      ")},
      ${queryLanguages
          .map((lang) =>
              lang === "English"
                  ? '"bug", "error", "issue", "defect", "fault"'
                  : lang === "中文"
                    ? '"错误", "问题", "缺陷", "故障", "漏洞"'
                    : lang.toLowerCase().includes("swed")
                      ? '"bugg", "fel", "problem", "defekt", "brist"'
                      : `"[${expansionsPerLanguage} in ${lang}]"`,
          )
          .join(",\n      ")}
    ],
    "priority": null,
    "dueDate": null,
    "status": null,
    "tags": ["urgent", "backend"]
  }

⚠️ CRITICAL RULES (SEE DETAILED GUIDELINES ABOVE):
- Extract ATOMIC keywords following language-specific length rules:
  * English: 1 word maximum ("data analysis" → ["data", "analysis"])
  * Chinese: 2-3 characters maximum ("在线购物平台" → ["在线", "购物", "平台"])
  * All languages: Break down compounds for better searchability
- Always include proper nouns, but split if multi-word (e.g., "Obsidian AI" → ["Obsidian", "AI"])
- For EACH atomic keyword, generate semantic equivalents in ALL ${queryLanguages.length} configured languages: ${languageList}
- This enables queries in ANY language to match tasks in ANY other configured language
- Remove filter-related words (priority, due date, status) from keywords
- DO NOT extract overly long phrases - prioritize atomic, searchable units!

🚨 CRITICAL: MUTUAL EXCLUSIVITY RULE

When extracting properties and keywords, ensure NO OVERLAP to prevent double-counting:

**RULE**: If a word is used to determine a PROPERTY, it must NOT appear in keywords array

**Why**: Each word should contribute to scoring ONCE, not twice:
- Word used for property → Gets property score (e.g., priority: 1 → 1.0 points × priority coefficient)
- Word used for keyword → Gets relevance score (e.g., "urgent" → relevance × 20)
- Same word in BOTH → Double-counted score (WRONG!)

**How to apply**:

1. **Extract properties FIRST** (dueDate, priority, status)
   - Identify which words triggered property detection
   - Example: "urgent" → priority: 1, "open" → status: "open", "overdue" → dueDate: "overdue"

2. **Extract keywords SECOND** (excluding property trigger words)
   - Remove words that were used for properties
   - Extract remaining meaningful words
   - Expand ONLY the non-property words

**Examples**:

Example 1: "urgent open tasks for payment"
✅ CORRECT:
{
  "priority": 1,                                    // from "urgent"
  "status": "open",                                 // from "open"
  "coreKeywords": ["payment"],            // "urgent" and "open" excluded
  "keywords": ["payment", "billing", ...]  // expanded from ["payment"]
}

❌ WRONG:
{
  "priority": 1,
  "status": "open",
  "coreKeywords": ["urgent", "open", "tasks", "payment"],  // ❌ includes property words
  "keywords": ["urgent", "critical", "open", "active", ...]  // ❌ expanded from property words
}

Example 2: "completed tasks in payment system"
✅ CORRECT:
{
  "status": "completed",                            // from "completed"
  "coreKeywords": ["payment", "system"],  // "completed" excluded
  "keywords": ["payment", "billing", ..., "system", "application", ...]
}

Example 3: "priority 1 overdue"
✅ CORRECT:
{
  "priority": 1,                                    // from explicit "priority 1"
  "dueDate": "overdue",                            // from "overdue"
  "coreKeywords": [],                              // no content keywords (all words were properties)
  "keywords": []                                    // empty - no keywords to expand
}

Example 4: "fix urgent bug"
✅ CORRECT:
{
  "priority": 1,                                    // from "urgent"
  "coreKeywords": ["fix", "bug"],                  // "urgent" excluded
  "keywords": ["fix", "repair", "solve", ..., "bug", "error", "issue", ...]
}

**Remember**: A word either contributes to property score OR relevance score, NEVER both!
- Property concept recognized → Extract property, exclude from keywords
- Not a property concept → Include in keywords for expansion

🚨 CRITICAL DISAMBIGUATION LOGIC - CHECK BEFORE EXTRACTING KEYWORDS:

**STEP 1: Check if query matches DUE DATE category (HIGHEST PRIORITY)**
- Check if query contains date indicators (today, overdue, tomorrow, etc.)
- If yes → extract dueDate value, DO NOT add to keywords

**STEP 2: If not due date, check if query matches STATUS category**
- Compare query against STATUS MAPPING category names defined above
- If the query word EXACTLY MATCHES a status display name (case-insensitive), it's a STATUS FILTER
- Examples based on your STATUS MAPPING:
  ${Object.entries(settings.taskStatusMapping)
      .slice(0, 4)
      .map(([key, config]) => {
          const displayLower = config.displayName.toLowerCase();
          return `  * Query: "${displayLower}" → CHECK: Does "${displayLower}" match status "${config.displayName}"? YES → status: "${key}", keywords: []`;
      })
      .join("\n")}

**STEP 3: If not due date or status, check if query matches PRIORITY level**
- Check if query contains priority indicators (high, urgent, medium, low, etc.)
- If yes → extract priority value, DO NOT add to keywords

**STEP 4: If none of the above, treat as content KEYWORDS**
- Extract meaningful words and expand them semantically

⚠️ DISAMBIGUATION PRIORITY ORDER:
1. DUE DATE indicators (check first!)
2. STATUS categories
3. PRIORITY indicators
4. KEYWORDS (only if not due date/status/priority)

⚠️ REAL EXAMPLE WALKTHROUGH:
Query: "urgent"
Step 1: Check STATUS MAPPING → Is "urgent" a status category? 
  ${Object.keys(settings.taskStatusMapping).includes("urgent") ? '→ YES! "urgent" is a status category' : '→ NO, "urgent" is not a status category'}
  ${Object.keys(settings.taskStatusMapping).includes("urgent") ? `→ Result: status: "urgent", keywords: []` : `→ Continue to Step 2`}
Step 2: ${Object.keys(settings.taskStatusMapping).includes("urgent") ? "(Skipped - already matched as status)" : 'Check PRIORITY → Is "urgent" a priority indicator?'}
  ${Object.keys(settings.taskStatusMapping).includes("urgent") ? "" : "→ Could be, but check if it's a status category FIRST (Step 1)"}

🚨 STOP WORDS - DO NOT EXTRACT OR EXPAND TO THESE:
The following ${stopWordsList.length} words are STOP WORDS. You MUST:
1. NOT extract them as core keywords (skip them during extraction)
2. NOT expand to them during semantic expansion (avoid generating them)
3. These are TOO GENERIC and match almost everything, inflating scores incorrectly

COMPLETE STOP WORDS LIST:
"${stopWordsDisplay}"

⚠️ IMPORTANT: Instead of these generic terms, use SPECIFIC synonyms related to the actual concept.
Example: For "开发" (develop), use "develop", "build", "create", "implement", "code" - NOT "work" or "task"

- Tags and keywords serve DIFFERENT purposes - don't mix them!

🚨 NATURAL LANGUAGE UNDERSTANDING & TYPO CORRECTION

You are a multilingual query understanding AI with **native understanding** of ALL human languages.

**YOUR CAPABILITIES:**
1. Understand natural language in ANY language (not just pre-configured phrases)
2. Work with languages configured by user: ${languageList}
3. Automatically correct typos in ANY language
4. Recognize task property CONCEPTS semantically
5. Map concepts to structured filters (for Dataview API)

**SEMANTIC PROPERTY CONCEPT RECOGNITION**:

Instead of matching specific trigger words, recognize property CONCEPTS in ANY language.

**USER'S CONFIGURED LANGUAGES**: ${languageList}

**IMPORTANT**: The following comprehensive mappings include:
- User-configured terms from settings
- Base multilingual terms (including your ${queryLanguages.length} configured languages: ${languageList})
- All custom status categories defined by user

Use these as REFERENCE for semantic understanding, but recognize concepts in ANY language (not limited to configured languages!):

**1. PRIORITY CONCEPT** (Urgency, Criticality)

${priorityValueMapping}

**How to use**:
- Recognize urgency/criticality concepts in ANY language (not just listed terms)
- Map to standard Dataview priority values: 1, 2, 3, or 4
- User's terms above are examples - use semantic understanding for unlisted phrases

**2. STATUS CONCEPT** (Status, Condition, Progress)

${statusMapping}

**How to use**:
- Recognize task status concepts in ANY language (not just listed terms)
- Map to exact status category keys shown above (respects user's custom categories)
- User's categories above are COMPLETE - these are the ONLY valid status values

**3. DUE_DATE CONCEPT** (Deadline, Target Date, Time)

${dueDateValueMapping}

**How to use**:
- Recognize timing/deadline concepts in ANY language (not just listed terms)
- Map to standard Dataview date values shown above
- User's terms above are examples - use semantic understanding for unlisted phrases

⚠️ CORE PRINCIPLE - SEMANTIC CONCEPT RECOGNITION:

Instead of matching pre-programmed phrases, use your native language understanding to recognize these CONCEPTS:

1. **Language-Independent Recognition**: Leverage your native multilingual training
   - Don't match word lists - UNDERSTAND concepts
   - Works in 100+ languages automatically
   - Not limited to user's configured languages

2. **User's Language Context**: User configured these languages: ${languageList}
   - These guide your understanding of query context
   - But you can recognize concepts in ANY language

3. **Standard Dataview Mapping**: Always map to Dataview's standard values
   - priority: 1, 2, 3, or 4 (numbers)
   - status: "open", "inprogress", "completed", "cancelled", etc. (lowercase, no spaces)
   - dueDate: "overdue", "today", "tomorrow", etc. (lowercase)

4. **PRIORITY CONCEPT** = Urgency, criticality, high/low priority
   - Any phrase expressing urgency/criticality/priority in ANY language
   - Examples across languages you know:
     * English: urgent, critical, asap, high priority, , can wait, low priority
     * Chinese: 紧急, 优先, 关键, 不急
     * Spanish: urgente, crítico, importante, puede esperar
     * Japanese: 緊急, 重要, 優先
     * ANY other language - use your training!

5. **STATUS CONCEPT** = State, condition, progress, completion level
   - Any phrase describing task state in ANY language
   - Examples across languages you know:
     * English: open, in progress, working on, completed, done, finished, cancelled, blocked
     * Chinese: 未完成, 进行中, 完成, 取消, 阻挡
     * Spanish: abierto, en progreso, completado, cancelado
     * Japanese: オープン, 進行中, 完了
     * ANY other language - use your training!

6. **DUE_DATE CONCEPT** = Deadline, target date, expiration, time limit
   - Any phrase about timing/deadlines in ANY language
   - Examples across languages you know:
     * English: due today, deadline tomorrow, overdue, no deadline, expires
     * Chinese: 今天到期, 明天截止, 过期, 没有截止日期
     * Spanish: vence hoy, fecha límite, vencido
     * Japanese: 期限今日, 期限切れ
     * ANY other language - use your training!

**EXAMPLES OF SEMANTIC CONCEPT RECOGNITION:**

User query in French: "tâches urgentes non terminées"
→ Recognize: PRIORITY (urgentes = urgent) + STATUS (non terminées = not completed/open)
→ Map: priority: 1, status: "open"

User query in Korean: "긴급한 미완료 작업"
→ Recognize: PRIORITY (긴급한 = urgent) + STATUS (미완료 = incomplete/open)
→ Map: priority: 1, status: "open"

⚠️ YOUR TASK:
- Use your native understanding of human languages
- Recognize property CONCEPTS semantically
- Don't rely on pre-programmed phrase matching
- Map concepts to internal codes for Dataview API
- Work with ANY language user configured: ${languageList}
- Even work with languages NOT in the configured list if user queries in them!

**TYPO CORRECTION:**

Automatically correct common misspellings before parsing. Users make typos - fix them!

Common typo patterns:
- Missing letters: "priorty" → "priority", "taks" → "task"
- Extra letters: "openn" → "open", "taskks" → "tasks"
- Transpositions: "tasl" → "task", "priortiy" → "priority"
- Wrong letters: "complated" → "completed", "urgant" → "urgent"
- Phonetic: "kritical" → "critical", "importent" → "important"

Typo examples to handle:
- "urgant taks" → "urgent tasks"
- "complated items" → "completed items"
- "priorty 1" → "priority 1"
- "overdu work" → "overdue work"
- "tommorow" → "tomorrow"
- "critcal bugs" → "critical bugs"
- "paymant system" → "payment system"
- "opne projects" → "open projects"

⚠️ PROCESS:
1. Read user's query
2. Correct any typos automatically
3. Understand natural language (map to properties)
4. Extract keywords and property filters
5. Expand keywords semantically
6. Return structured JSON

**Examples of Natural Language Parsing:**

English: "show me urgent open tasks that are overdue"
→ Understand: priority:1 (urgent), status:"open", dueDate:"overdue"
→ Extract: priority: 1, status: "open", dueDate: "overdue", keywords: []

中文: "明天到期的紧急未完成任务"
→ Understand: dueDate:"tomorrow", priority:1 (urgent), status:"open" (incomplete)
→ Extract: dueDate: tomorrow's date, priority: 1, status: "open", keywords: []

Swedish: "brådskande ofullständiga uppgifter förfallna imorgon"
→ Understand: priority:1 (urgent), status:"open" (incomplete), dueDate:"tomorrow"
→ Extract: priority: 1, status: "open", dueDate: tomorrow's date, keywords: ["uppgifter"]

With typos: "urgant complated taks in paymant system"
→ Correct: "urgent completed tasks in payment system"
→ Understand: priority:1 (urgent), status:"completed"
→ Extract: priority: 1, status: "completed", keywords: ["payment", "system"]

🔧 TYPO CORRECTION (Always Active):
Before parsing, automatically correct common spelling errors in the query.
Examples:
- "urgant" → "urgent"
- "taks" → "tasks"
- "complated" → "completed"
- "priorit" → "priority"
- "importent" → "important"

If you correct any typos, record them in the aiUnderstanding.correctedTypos array.

Extract ALL filters from the query and return ONLY a JSON object with this EXACT structure:
{
  "coreKeywords": [<array of ORIGINAL extracted keywords BEFORE expansion>],
  "keywords": [<array of EXPANDED search terms with semantic equivalents across all languages>],
  "priority": <number or array of numbers or null>,
  "dueDate": <string or null>,
  "dueDateRange": <{start: string, end: string} or null>,
  "status": <string or array of strings or null>,
  "folder": <string or null>,
  "tags": [<hashtags from query, WITHOUT the # symbol>],
  "aiUnderstanding": {
    "detectedLanguage": <string, full language name detected (e.g., "English", "Chinese", "Swedish")>,
    "correctedTypos": [<array of corrections, e.g., "urgant→urgent", "taks→tasks">],
    "semanticMappings": {
      "priority": <string or null, how natural language mapped to priority, e.g., "urgent → 1">,
      "status": <string or null, how natural language mapped to status, e.g., "working on → inprogress">,
      "dueDate": <string or null, how natural language mapped to due date, e.g., "tomorrow → 2025-01-23">
    },
    "confidence": <number 0-1, how confident you are in the parsing>,
    "naturalLanguageUsed": <boolean, true if user used natural language vs exact syntax>
  }
}

4️⃣ 🚨 CRITICAL FINAL INSTRUCTIONS 🚨
YOU MUST RETURN **ONLY** VALID JSON. NO EXPLANATIONS. NO MARKDOWN. NO ANALYSIS.

❌ DO NOT return:
- Markdown headings (##, ###)
- Explanatory text before or after JSON
- Dependency trees, syntax analysis, or linguistic breakdowns
- Any text that is not parseable JSON

✅ CORRECT output format:
{
  "coreKeywords": [<array of ORIGINAL extracted keywords BEFORE expansion>],
  "keywords": [<array of EXPANDED search terms with semantic equivalents across all languages>],
  "priority": <number or array of numbers or null>,
  "dueDate": <string or null>,
  "dueDateRange": <{start: string, end: string} or null>,
  "status": <string or array of strings or null>,
  "folder": <string or null>,
  "tags": [<hashtags from query, WITHOUT the # symbol>],
  "aiUnderstanding": {
    "detectedLanguage": <string, full language name detected (e.g., "English", "Chinese", "Swedish")>,
    "correctedTypos": [<array of corrections, e.g., "urgant→urgent", "taks→tasks">],
    "semanticMappings": {
      "priority": <string or null, how natural language mapped to priority, e.g., "urgent → 1">,
      "status": <string or null, how natural language mapped to status, e.g., "working on → inprogress">,
      "dueDate": <string or null, how natural language mapped to due date, e.g., "tomorrow → 2025-01-23">
    },
    "confidence": <number 0-1, how confident you are in the parsing>,
    "naturalLanguageUsed": <boolean, true if user used natural language vs exact syntax>
  }
}

⚠️ If you return ANYTHING other than pure JSON, the system will FAIL.
⚠️ Start your response with { and end with }
⚠️ NO markdown code blocks (no \`\`\`json), just raw JSON`;

        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Parse this query: "${query}"

CRITICAL: Return ONLY valid JSON. No markdown, no explanations, no code blocks. Start with { and end with }.`,
            },
        ];

        try {
            const { response: aiResponse, tokenUsage } = await this.callAI(
                messages,
                settings,
                abortSignal,
            );
            Logger.debug("AI query parser raw response:", aiResponse);
            Logger.debug("AI query parser token usage:", tokenUsage);

            // Extract JSON from response (handles DeepSeek's <think> tags and other wrappers)
            const jsonString = this.extractJSON(aiResponse);
            const parsed = JSON.parse(jsonString);
            Logger.debug("AI query parser parsed:", parsed);

            // Validate that AI returned the correct schema
            const hasExpectedFields =
                Object.prototype.hasOwnProperty.call(parsed, "keywords") ||
                Object.prototype.hasOwnProperty.call(parsed, "priority") ||
                Object.prototype.hasOwnProperty.call(parsed, "dueDate") ||
                Object.prototype.hasOwnProperty.call(parsed, "status") ||
                Object.prototype.hasOwnProperty.call(parsed, "folder") ||
                Object.prototype.hasOwnProperty.call(parsed, "tags");

            if (!hasExpectedFields) {
                Logger.error(
                    "⚠️ AI RETURNED WRONG JSON SCHEMA! Expected query parser fields but got:",
                    Object.keys(parsed),
                );
                Logger.error(
                    "This model returned linguistic analysis instead of query parsing.",
                );
                Logger.error(
                    `Model: ${getCurrentProviderConfig(settings).model}, Provider: ${settings.aiProvider}`,
                );
                Logger.error("Full response:", aiResponse.substring(0, 500));
                Logger.error(
                    "Recommendation: Switch to a larger model or cloud provider (OpenAI, Anthropic, OpenRouter).",
                );
            }

            // If AI didn't extract any keywords but also didn't extract any filters,
            // split the query into words as fallback
            let keywords = parsed.keywords || [];
            if (
                keywords.length === 0 &&
                !parsed.priority &&
                !parsed.dueDate &&
                !parsed.status &&
                !parsed.folder &&
                (!parsed.tags || parsed.tags.length === 0)
            ) {
                Logger.debug(
                    "AI returned no filters or keywords, splitting query into words",
                );
                // Split by whitespace and filter stop words
                keywords = StopWords.filterStopWords(
                    query.split(/\s+/).filter((word) => word.length > 0),
                );
            }

            // Post-process keywords to remove stop words (safety net)
            // AI is instructed via prompt to NOT extract stop words (see STOP WORDS section in prompt)
            // This post-filter is a safety net in case AI ignores instructions
            const filteredKeywords = StopWords.filterStopWords(keywords);

            Logger.debug(
                `Keywords after stop word filtering: ${keywords.length} → ${filteredKeywords.length}`,
            );
            if (keywords.length !== filteredKeywords.length) {
                Logger.debug(
                    `[AI Parser] Post-filter safety net removed ${keywords.length - filteredKeywords.length} stop words that AI missed`,
                );
                Logger.debug(
                    `[AI Parser] Removed: [${keywords.filter((k: string) => !filteredKeywords.includes(k)).join(", ")}]`,
                );
            }

            // Extract core keywords and filter stop words (safety net)
            // AI should not extract stop words (prompt instructs this) but we verify
            const rawCoreKeywords = parsed.coreKeywords || [];
            const coreKeywords = StopWords.filterStopWords(rawCoreKeywords);

            if (rawCoreKeywords.length !== coreKeywords.length) {
                Logger.debug(
                    `[AI Parser] Post-filter safety net removed ${rawCoreKeywords.length - coreKeywords.length} stop words from core keywords`,
                );
                Logger.debug(
                    `[AI Parser] Removed: [${rawCoreKeywords.filter((k: string) => !coreKeywords.includes(k)).join(", ")}]`,
                );
            }

            // Ensure all core keywords are included in expanded keywords
            // AI should include them, but sometimes misses them - this is a safety net
            const missingCoreKeywords = coreKeywords.filter(
                (k: string) => !filteredKeywords.includes(k),
            );
            if (missingCoreKeywords.length > 0) {
                Logger.warn(
                    `[AI Parser] AI missed ${missingCoreKeywords.length} core keywords in expansion. Adding them back:`,
                    missingCoreKeywords,
                );
            }
            // Merge: core keywords first, then expanded keywords (deduplicated)
            const expandedKeywords = [
                ...coreKeywords,
                ...filteredKeywords.filter(
                    (k: string) => !coreKeywords.includes(k),
                ),
            ];

            // Validate expansion worked correctly
            if (expansionEnabled && coreKeywords.length > 0) {
                const expectedMinKeywords = coreKeywords.length; // At minimum, should have core keywords
                const expectedTargetKeywords =
                    coreKeywords.length * maxKeywordsPerCore;

                if (expandedKeywords.length < expectedMinKeywords) {
                    Logger.warn(
                        `Expansion failed: ${coreKeywords.length} core → ${expandedKeywords.length} expanded (expected at least ${expectedMinKeywords})`,
                    );
                } else if (
                    expandedKeywords.length <
                    expectedTargetKeywords * 0.3
                ) {
                    Logger.warn(
                        `Expansion under-performing: ${coreKeywords.length} core → ${expandedKeywords.length} expanded (target: ~${expectedTargetKeywords})`,
                    );
                }
            }

            // Build expansion metadata
            const expansionMetadata = {
                enabled: expansionEnabled,
                expansionsPerLanguagePerKeyword: expansionsPerLanguage,
                languagesUsed: queryLanguages,
                coreKeywordsCount: coreKeywords.length,
                totalKeywords: expandedKeywords.length,
            };

            // Detailed expansion logging
            Logger.debug("========== SEMANTIC EXPANSION DETAILS ==========");
            Logger.debug("User Settings:", {
                languages: queryLanguages,
                expansionsPerLanguage: expansionsPerLanguage,
                targetPerCore: maxKeywordsPerCore,
                expansionEnabled: expansionEnabled,
            });

            Logger.debug("Extraction Results:", {
                coreKeywords: coreKeywords,
                coreCount: coreKeywords.length,
            });

            Logger.debug("Expansion Results:", {
                expandedKeywords: expandedKeywords,
                totalExpanded: expandedKeywords.length,
                averagePerCore:
                    coreKeywords.length > 0
                        ? (
                              expandedKeywords.length / coreKeywords.length
                          ).toFixed(1)
                        : "N/A",
                targetPerCore: maxKeywordsPerCore,
            });

            // Analyze language distribution (if possible)
            if (coreKeywords.length > 0 && expandedKeywords.length > 0) {
                const languageBreakdown: Record<string, string[]> = {};
                queryLanguages.forEach((lang) => {
                    languageBreakdown[lang] = [];
                });

                // Try to categorize keywords by language (approximate)
                expandedKeywords.forEach((keyword) => {
                    // Detect language based on character patterns
                    if (/[\u4e00-\u9fff]/.test(keyword)) {
                        // Chinese characters
                        if (languageBreakdown["中文"]) {
                            languageBreakdown["中文"].push(keyword);
                        }
                    } else if (
                        /[\u00e4\u00e5\u00f6]/.test(keyword.toLowerCase())
                    ) {
                        // Swedish special characters (ä, å, ö)
                        if (languageBreakdown["Svenska"]) {
                            languageBreakdown["Svenska"].push(keyword);
                        } else {
                            // Fallback for Swedish if not in breakdown
                            const swedishLang = queryLanguages.find(
                                (l) =>
                                    l.toLowerCase().includes("svenska") ||
                                    l.toLowerCase().includes("swedish"),
                            );
                            if (swedishLang && languageBreakdown[swedishLang]) {
                                languageBreakdown[swedishLang].push(keyword);
                            }
                        }
                    } else {
                        // Default to English or first non-Chinese language
                        if (languageBreakdown["English"]) {
                            languageBreakdown["English"].push(keyword);
                        } else {
                            const firstLang = queryLanguages.find(
                                (l) =>
                                    l !== "中文" &&
                                    !l.toLowerCase().includes("svenska") &&
                                    !l.toLowerCase().includes("swedish"),
                            );
                            if (firstLang && languageBreakdown[firstLang]) {
                                languageBreakdown[firstLang].push(keyword);
                            }
                        }
                    }
                });

                Logger.debug(
                    "Language Distribution (estimated - for diagnostics only):",
                );
                Logger.debug(
                    "Note: This uses heuristics to estimate distribution. Actual functionality doesn't depend on detection.",
                );

                // Check for missing languages
                const missingLanguages: string[] = [];
                const expectedMinPerLanguage = Math.floor(
                    expansionsPerLanguage * 0.8,
                ); // At least 50% of expected

                Object.entries(languageBreakdown).forEach(([lang, words]) => {
                    if (words.length > 0) {
                        Logger.debug(
                            `  ${lang}: ${words.length} keywords - [${words.slice(0, 5).join(", ")}${words.length > 5 ? "..." : ""}]`,
                        );
                    } else {
                        Logger.debug(`  ${lang}: 0 keywords ⚠️ MISSING!`);
                        missingLanguages.push(lang);
                    }

                    // Warn if language has very few keywords
                    if (
                        words.length > 0 &&
                        words.length < expectedMinPerLanguage &&
                        coreKeywords.length > 0
                    ) {
                        Logger.warn(
                            `Language "${lang}" has only ${words.length} keywords (expected at least ${expectedMinPerLanguage} per core keyword)`,
                        );
                    }
                });

                // Warning if languages appear to be missing (based on heuristic detection)
                if (missingLanguages.length > 0) {
                    Logger.warn(
                        `⚠️ Language detection heuristic couldn't find ${missingLanguages.length} language(s): ${missingLanguages.join(", ")}`,
                    );
                    Logger.warn(
                        `This may indicate AI under-expansion. Check if keywords are actually present for all languages.`,
                    );
                    Logger.warn(
                        `Note: Detection is imperfect - some words without special characters may be miscategorized.`,
                    );
                    Logger.warn(
                        `Recommendation: If expansion count is low (${expandedKeywords.length} < ${coreKeywords.length * maxKeywordsPerCore}), AI may not understand language name "${missingLanguages.join(", ")}".`,
                    );
                }
            }

            Logger.debug("================================================");

            // Summary
            Logger.debug("Semantic expansion summary:", {
                core: coreKeywords.length,
                expanded: expandedKeywords.length,
                perCore:
                    coreKeywords.length > 0
                        ? (
                              expandedKeywords.length / coreKeywords.length
                          ).toFixed(1)
                        : "N/A",
                target: maxKeywordsPerCore,
                enabled: expansionEnabled,
            });

            // Log AI Understanding metadata if present
            if (parsed.aiUnderstanding) {
                Logger.debug("========== AI UNDERSTANDING ==========");
                Logger.debug(
                    "Detected language:",
                    parsed.aiUnderstanding.detectedLanguage || "unknown",
                );
                Logger.debug(
                    "Confidence:",
                    parsed.aiUnderstanding.confidence !== undefined
                        ? `${(parsed.aiUnderstanding.confidence * 100).toFixed(0)}%`
                        : "unknown",
                );
                Logger.debug(
                    "Natural language used:",
                    parsed.aiUnderstanding.naturalLanguageUsed || false,
                );
                if (
                    parsed.aiUnderstanding.correctedTypos &&
                    parsed.aiUnderstanding.correctedTypos.length > 0
                ) {
                    Logger.debug(
                        "Typos corrected:",
                        parsed.aiUnderstanding.correctedTypos,
                    );
                }
                if (parsed.aiUnderstanding.notes) {
                    Logger.debug("Notes:", parsed.aiUnderstanding.notes);
                }
                Logger.debug(
                    "================================================",
                );
            }

            return {
                coreKeywords: coreKeywords,
                keywords: expandedKeywords,
                priority: parsed.priority,
                dueDate: parsed.dueDate,
                dueDateRange: parsed.dueDateRange,
                status: parsed.status,
                folder: parsed.folder,
                tags: parsed.tags || [],
                expansionMetadata: expansionMetadata,
                aiUnderstanding: parsed.aiUnderstanding, // Pass through AI understanding metadata
                _parserTokenUsage: tokenUsage, // Include token usage from query parsing
            };
        } catch (error) {
            // Log comprehensive error information including ACTUAL parsing model details
            const { provider: parsingProvider, model: parsingModel } =
                getProviderForPurpose(settings, "parsing");
            Logger.error("Query parsing error:", error);
            Logger.error("AI Query Parser failed with model:", {
                provider: parsingProvider,
                model: parsingModel,
                query: query,
                errorMessage:
                    error instanceof Error ? error.message : String(error),
            });

            // Don't create duplicate fallback here - let AIService handle it
            // AIService will call Simple Search module (TaskSearchService.analyzeQueryIntent)
            // Re-throw error with structured info for proper error handling
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const enrichedError = new Error(errorMessage);
            // Add metadata for UI display - format as "Provider: model" not "provider/model"
            const providerName =
                parsingProvider === "openai"
                    ? "OpenAI"
                    : parsingProvider === "anthropic"
                      ? "Anthropic"
                      : parsingProvider === "openrouter"
                        ? "OpenRouter"
                        : "Ollama";
            (enrichedError as any).parserModel =
                `${providerName}: ${parsingModel}`;
            (enrichedError as any).isParserError = true;
            throw enrichedError;
        }
    }

    /**
     * Call AI API for parsing
     * Returns both response text and token usage information
     */
    private static async callAI(
        messages: any[],
        settings: PluginSettings,
        abortSignal?: AbortSignal,
    ): Promise<{ response: string; tokenUsage: any }> {
        // Use parsing model configuration
        const { provider, model, temperature } = getProviderForPurpose(
            settings,
            "parsing",
        );
        const providerConfig = getProviderConfigForPurpose(settings, "parsing");

        if (provider === "ollama") {
            return this.callOllama(messages, settings, abortSignal);
        }

        if (provider === "anthropic") {
            return this.callAnthropic(messages, settings, abortSignal);
        }

        // Check if aborted before making API call
        if (abortSignal?.aborted) {
            throw new Error("Query parsing cancelled by user");
        }

        // Get provider-specific API key
        const apiKey = settings.providerConfigs[provider].apiKey;
        if (!apiKey) {
            throw new Error(`API key for ${provider} is not configured`);
        }

        // OpenAI-compatible API (OpenAI and OpenRouter)
        const response = await requestUrl({
            url: providerConfig.apiEndpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: providerConfig.maxTokens,
            }),
            throw: false, // Don't throw on HTTP errors, handle them manually
        });

        if (response.status !== 200) {
            // Use ErrorHandler to parse API error (consolidates error handling logic)
            const errorData = {
                status: response.status,
                json: response.json,
                message: `API request failed with status ${response.status}`,
            };
            // Format model info for display: "Provider: model" not "provider/model"
            // At this point, provider can only be openai or openrouter (others returned early)
            const providerName =
                provider === "openai" ? "OpenAI" : "OpenRouter";
            const modelInfo = `${providerName}: ${model}`;
            const structured = ErrorHandler.parseAPIError(
                errorData,
                modelInfo,
                "parser",
            );

            // Throw AIError to preserve structured information
            throw new AIError(structured);
        }

        const data = response.json;
        const content = data.choices[0].message.content.trim();

        // Extract token usage
        const usage = data.usage || {};
        let promptTokens = usage.prompt_tokens || 0;
        let completionTokens = usage.completion_tokens || 0;
        let totalTokens = usage.total_tokens || promptTokens + completionTokens;

        // Calculate cost using pricing table (initial estimate)
        const calculatedCost = PricingService.calculateCost(
            promptTokens,
            completionTokens,
            model,
            provider,
            settings.pricingCache.data,
        );
        let actualCost: number | undefined = undefined;
        let isEstimated = false;

        // For OpenRouter, try to fetch actual usage AND cost
        if (provider === "openrouter") {
            // Try to extract generation ID from response body or headers
            let generationId: string | null = null;

            // OpenRouter includes generation ID in response body (id field)
            if (data.id) {
                generationId = data.id;
                Logger.debug(
                    `[OpenRouter Parser] ✓ Generation ID from response: ${generationId}`,
                );
            }

            // Try to get from headers if available (requestUrl may expose headers)
            if (!generationId && (response as any).headers) {
                const headers = (response as any).headers;
                generationId =
                    headers["x-generation-id"] ||
                    headers["X-Generation-Id"] ||
                    null;
                if (generationId) {
                    Logger.debug(
                        `[OpenRouter Parser] ✓ Generation ID from headers: ${generationId}`,
                    );
                }
            }

            if (generationId) {
                try {
                    Logger.debug(
                        `[OpenRouter Parser] Fetching actual token usage and cost for generation ${generationId}...`,
                    );
                    const usageData = await PricingService.fetchOpenRouterUsage(
                        generationId,
                        apiKey,
                    );
                    if (usageData) {
                        promptTokens = usageData.promptTokens;
                        completionTokens = usageData.completionTokens;
                        totalTokens = promptTokens + completionTokens;
                        actualCost = usageData.actualCost;
                        isEstimated = false;
                        Logger.debug(
                            `[OpenRouter Parser] ✓ Got actual usage: ${promptTokens} prompt + ${completionTokens} completion`,
                        );
                        if (actualCost !== undefined) {
                            Logger.debug(
                                `[OpenRouter Parser] ✓ Using actual cost from API: $${actualCost.toFixed(6)} (not calculated)`,
                            );
                        }
                    } else {
                        isEstimated = true;
                        Logger.warn(
                            `[OpenRouter Parser] ⚠️ Failed to fetch actual usage, using estimates`,
                        );
                    }
                } catch (error) {
                    isEstimated = true;
                    Logger.warn(
                        `[OpenRouter Parser] Failed to fetch actual usage, using estimates: ${error}`,
                    );
                }
            } else {
                isEstimated = true;
                Logger.warn(
                    `[OpenRouter Parser] ⚠️ Generation ID not found, using estimated costs`,
                );
            }
        }

        // Determine token source
        const tokenSource: "actual" | "estimated" = isEstimated
            ? "estimated"
            : "actual";

        // Use enhanced cost calculation with tracking
        const costTracking = PricingService.calculateCostWithTracking(
            promptTokens,
            completionTokens,
            model,
            provider,
            settings.pricingCache.data,
            tokenSource,
            actualCost,
        );

        Logger.debug(
            `[Cost Tracking Parser] Final: $${costTracking.cost.toFixed(6)}, ` +
                `Method: ${costTracking.costMethod}, ` +
                `Pricing: ${costTracking.pricingSource}, ` +
                `Tokens: ${costTracking.tokenSource}`,
        );

        const tokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost: costTracking.cost,
            model: model,
            provider: provider,
            isEstimated,
            // Enhanced tracking fields
            tokenSource,
            costMethod: costTracking.costMethod,
            pricingSource: costTracking.pricingSource,
            // Track parsing model separately
            parsingModel: model,
            parsingProvider: provider,
            parsingTokens: totalTokens,
            parsingCost: costTracking.cost,
            parsingTokenSource: tokenSource,
            parsingCostMethod: costTracking.costMethod,
            parsingPricingSource: costTracking.pricingSource,
        };

        return { response: content, tokenUsage };
    }

    /**
     * Call Anthropic API (different format than OpenAI)
     * Returns both response text and token usage information
     */
    private static async callAnthropic(
        messages: any[],
        settings: PluginSettings,
        abortSignal?: AbortSignal,
    ): Promise<{ response: string; tokenUsage: any }> {
        // Use parsing model configuration
        const { provider, model, temperature } = getProviderForPurpose(
            settings,
            "parsing",
        );
        const providerConfig = getProviderConfigForPurpose(settings, "parsing");

        const apiKey = settings.providerConfigs[provider].apiKey;
        if (!apiKey) {
            throw new Error(`API key for ${provider} is not configured`);
        }

        const endpoint =
            providerConfig.apiEndpoint ||
            "https://api.anthropic.com/v1/messages";

        // Check if aborted before making API call
        if (abortSignal?.aborted) {
            throw new Error("Query parsing cancelled by user");
        }

        // Separate system message from conversation messages
        const systemMessage = messages.find((m: any) => m.role === "system");
        const conversationMessages = messages.filter(
            (m: any) => m.role !== "system",
        );

        const response = await requestUrl({
            url: endpoint,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: model,
                messages: conversationMessages,
                system: systemMessage ? systemMessage.content : undefined,
                temperature: temperature,
                max_tokens: providerConfig.maxTokens,
            }),
        });

        if (response.status !== 200) {
            // Use ErrorHandler to parse API error (consolidates error handling logic)
            const errorData = {
                status: response.status,
                json: response.json,
                message: `API request failed with status ${response.status}`,
            };
            // Format model info for display: "Provider: model" not "provider/model"
            // Provider is always anthropic in this function
            const providerName = "Anthropic";
            const modelInfo = `${providerName}: ${model}`;
            const structured = ErrorHandler.parseAPIError(
                errorData,
                modelInfo,
                "parser",
            );

            // Throw AIError to preserve structured information
            throw new AIError(structured);
        }

        const data = response.json;
        const content = data.content[0].text.trim();

        // Extract token usage (Anthropic format)
        const usage = data.usage || {};
        const promptTokens = usage.input_tokens || 0;
        const completionTokens = usage.output_tokens || 0;
        const totalTokens = promptTokens + completionTokens;
        const tokenSource: "actual" | "estimated" = "actual"; // Anthropic provides actual tokens

        // Use enhanced cost calculation with tracking
        const costTracking = PricingService.calculateCostWithTracking(
            promptTokens,
            completionTokens,
            model,
            provider,
            settings.pricingCache.data,
            tokenSource,
        );

        const tokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost: costTracking.cost,
            model: model,
            provider: provider,
            isEstimated: false,
            // Enhanced tracking fields
            tokenSource,
            costMethod: costTracking.costMethod,
            pricingSource: costTracking.pricingSource,
            // Track parsing model separately
            parsingModel: model,
            parsingProvider: provider,
            parsingTokens: totalTokens,
            parsingCost: costTracking.cost,
            parsingTokenSource: tokenSource,
            parsingCostMethod: costTracking.costMethod,
            parsingPricingSource: costTracking.pricingSource,
        };

        return { response: content, tokenUsage };
    }

    /**
     * Get API key for the current provider
     */
    private static getApiKeyForProvider(settings: PluginSettings): string {
        return getCurrentProviderConfig(settings).apiKey || "";
    }

    /**
     * Call Ollama API
     *
     * Ollama API format differs from OpenAI/OpenRouter:
     * - Parameters go inside 'options' object
     * - Uses 'num_predict' instead of 'max_tokens'
     * - Response has 'message' field directly (not 'choices')
     * - Requires consistent formatting with aiService.ts
     * Returns both response text and estimated token usage
     */
    private static async callOllama(
        messages: any[],
        settings: PluginSettings,
        abortSignal?: AbortSignal,
    ): Promise<{ response: string; tokenUsage: any }> {
        // Use parsing model configuration
        const { provider, model, temperature } = getProviderForPurpose(
            settings,
            "parsing",
        );
        const providerConfig = getProviderConfigForPurpose(settings, "parsing");

        const endpoint =
            providerConfig.apiEndpoint || "http://localhost:11434/api/chat";

        // Check if aborted before making API call
        if (abortSignal?.aborted) {
            throw new Error("Query parsing cancelled by user");
        }

        try {
            const response = await requestUrl({
                url: endpoint,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: temperature,
                        num_predict: providerConfig.maxTokens,
                        num_ctx: providerConfig.contextWindow,
                    },
                }),
            });

            if (response.status !== 200) {
                const errorBody = response.json || {};
                const errorMessage =
                    errorBody.error || response.text || "Unknown error";

                // Log detailed error for debugging
                Logger.error("Ollama Query Parser API Error:", {
                    status: response.status,
                    model: model,
                    endpoint: endpoint,
                    errorMessage: errorMessage,
                    numPredict: providerConfig.maxTokens,
                    fullResponse: errorBody,
                });

                // Generate actionable solution based on error
                let solution = "";
                if (response.status === 404) {
                    solution = `Model '${model}' not found. Pull it first: ollama pull ${model}`;
                } else if (
                    errorMessage.includes("model") &&
                    errorMessage.includes("not found")
                ) {
                    solution = `Model '${model}' not available. Try: ollama pull ${model}`;
                } else {
                    solution = `Ensure Ollama is running at ${endpoint}. Check: http://localhost:11434`;
                }

                // Throw user-friendly error with solution
                throw new Error(`${errorMessage} | ${solution}`);
            }

            const data = response.json;

            // Validate response structure
            if (!data || !data.message || !data.message.content) {
                throw new Error(
                    `Invalid Ollama response structure. Expected {message: {content: "..."}}, ` +
                        `got: ${JSON.stringify(data).substring(0, 200)}`,
                );
            }

            const responseContent = data.message.content.trim();

            if (responseContent.length === 0) {
                throw new Error(
                    "Ollama returned empty content. This may indicate the model failed to generate a response.",
                );
            }

            Logger.debug(
                `[Ollama Query Parser] Received ${responseContent.length} chars from ${model}`,
            );

            // Ollama doesn't provide token counts - estimate based on character count
            // Rough estimate: 1 token ≈ 4 characters
            const promptText = messages.map((m: any) => m.content).join(" ");
            const promptTokens = Math.ceil(promptText.length / 4);
            const completionTokens = Math.ceil(responseContent.length / 4);
            const totalTokens = promptTokens + completionTokens;
            const tokenSource: "actual" | "estimated" = "estimated"; // Ollama requires estimation

            const tokenUsage = {
                promptTokens,
                completionTokens,
                totalTokens,
                estimatedCost: 0,
                model: model,
                provider: provider,
                isEstimated: true,
                // Enhanced tracking fields
                tokenSource,
                costMethod: "actual" as const, // Ollama is free, cost is actually $0
                pricingSource: "embedded" as const,
                // Track parsing model separately
                parsingModel: model,
                parsingProvider: provider,
                parsingTokens: totalTokens,
                parsingCost: 0,
                parsingTokenSource: tokenSource,
                parsingCostMethod: "actual" as const,
                parsingPricingSource: "embedded" as const,
            };

            return { response: responseContent, tokenUsage };
        } catch (error) {
            // Use ErrorHandler to parse API error (consolidates error handling logic)
            // Format model info for display: "Provider: model" not "provider/model"
            // Provider is always ollama in this function
            const providerName = "Ollama";
            const modelInfo = `${providerName}: ${model}`;
            const structured = ErrorHandler.parseAPIError(
                error,
                modelInfo,
                "parser",
            );

            // Throw AIError to preserve structured information
            throw new AIError(structured);
        }
    }
}
