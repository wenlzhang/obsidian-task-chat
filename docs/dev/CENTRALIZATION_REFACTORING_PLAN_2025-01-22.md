# Centralization Refactoring Plan
**Date:** 2025-01-22  
**Status:** 🔍 **ANALYSIS COMPLETE - Ready for Implementation**

---

## 🎯 **GOALS**

1. **Centralize hardcoded task property definitions** (due date fields, priority mappings, status terms)
2. **Remove code duplication** across services
3. **Improve AI prompts** to respect ALL user settings
4. **Single source of truth** for all task property operations

---

## 🔍 **ISSUES IDENTIFIED**

### **Issue #1: Hardcoded Date Field Names**

**Files affected:**
- `dataviewService.ts` (lines ~150-160)
- `taskFilterService.ts` (lines ~200-250)
- `propertyRecognitionService.ts` (lines ~50-60)

**Hardcoded values:**
```typescript
// Repeated in multiple files:
const dueDateFields = ["due", "dueDate", "deadline", "scheduled"];
const dateFieldAliases = {
    due: ["due"],
    dueDate: ["due"],
    completion: ["completion"],
    completed: ["completion"],
    // ... etc
};

const emojiPatterns = {
    due: /🗓️\s*(\d{4}-\d{2}-\d{2})/,
    completion: /✅\s*(\d{4}-\d{2}-\d{2})/,
    // ... etc
};
```

**Solution:** Move to `TaskPropertyService.DATE_FIELD_CONSTANTS`

---

### **Issue #2: Hardcoded Priority/Status/Date Terms**

**Files affected:**
- `taskSearchService.ts` (INTERNAL_PRIORITY_TERMS, INTERNAL_DUE_DATE_TERMS, INTERNAL_STATUS_TERMS)
- `propertyRecognitionService.ts` (similar terms)
- `queryParserService.ts` (removeStandardProperties patterns)

**Hardcoded values:**
```typescript
// taskSearchService.ts (lines 50-150)
private static INTERNAL_PRIORITY_TERMS = {
    general: ["priority", "important", "urgent", "优先级", ...],
    high: ["high", "highest", "critical", ...],
    medium: ["medium", "normal", ...],
    low: ["low", "minor", ...],
};

private static INTERNAL_DUE_DATE_TERMS = {
    general: ["due", "deadline", "scheduled", ...],
    today: ["today", "今天", "idag"],
    // ... etc
};

private static INTERNAL_STATUS_TERMS = {
    general: ["status", "state", "progress", ...],
    open: ["open", "pending", "todo", ...],
    // ... etc
};
```

**Problem:** These are duplicated and should respect user's configured terms!

**Solution:** 
1. Move base terms to `TaskPropertyService`
2. Create methods that **combine** built-in terms + user-configured terms
3. Remove all duplication

---

### **Issue #3: AI Prompts Don't Fully Respect User Settings**

**Files affected:**
- `promptBuilderService.ts` (all methods)
- `queryParserService.ts` (parseWithAI prompt)
- `propertyRecognitionService.ts` (recognizeProperties prompt)

**Problems:**

**A) Hardcoded language references:**
```typescript
// queryParserService.ts
"English, Chinese, Swedish terms" // Should use settings.queryLanguages!
```

**B) Missing user settings in prompts:**
- Not using `settings.userPropertyTerms.priority`
- Not using `settings.userPropertyTerms.dueDate`
- Not using `settings.userPropertyTerms.status`
- Not showing user's custom status categories comprehensively

**C) Prompts built separately in each service:**
- `PromptBuilderService` has some methods
- `QueryParserService` builds its own prompts
- `PropertyRecognitionService` builds its own prompts
- Should be centralized!

---

### **Issue #4: Repeated Property Extraction Logic**

**Files affected:**
- `dataviewService.ts` (extractInlineField, emoji patterns)
- `propertyRecognitionService.ts` (similar extraction)
- `taskFilterService.ts` (field name lists)

**Repeated patterns:**
```typescript
// Pattern 1: Inline field extraction
const regex = new RegExp(`\\[${fieldKey}::([^\\]]+)\\]`, "i");

// Pattern 2: Emoji date extraction
const emojiPatterns = {
    due: /🗓️\s*(\d{4}-\d{2}-\d{2})/,
    // ...
};

// Pattern 3: Field name lists
const priorityFields = ["priority", "p", "pri", settings.dataviewKeys.priority];
const dueDateFields = ["due", "dueDate", "deadline", "scheduled"];
```

**Solution:** Centralize in `TaskPropertyService`

---

### **Issue #5: Query Cleaning Logic Duplicated**

**Files affected:**
- `queryParserService.ts` (removeStandardProperties)
- `taskSearchService.ts` (extractKeywords - removes filters)

**Repeated logic:**
```typescript
// Remove priority syntax
cleaned = cleaned.replace(/\bp[1-4]\b/gi, "");

// Remove status syntax
cleaned = cleaned.replace(/\bs:[^\s&|]+/gi, "");

// Remove date ranges
cleaned = cleaned.replace(/due\s+before:\s*[^&|]+/gi, "");

// ... repeated in multiple places
```

**Solution:** Single method in `TaskPropertyService.cleanQueryText()`

---

## 📋 **REFACTORING PLAN**

### **Phase 1: Extend TaskPropertyService with Constants**

**Add to TaskPropertyService:**

```typescript
/**
 * Centralized constants for task property fields and patterns
 */
export class TaskPropertyService {
    // ==========================================
    // FIELD NAME CONSTANTS
    // ==========================================
    
    /**
     * Standard date field names (DataView compatible)
     */
    static readonly DATE_FIELDS = {
        due: ["due", "dueDate", "deadline", "scheduled"],
        completion: ["completion", "completed", "completedDate"],
        created: ["created", "createdDate"],
        start: ["start", "startDate"],
        scheduled: ["scheduled", "scheduledDate"],
    } as const;
    
    /**
     * Date field emoji patterns for extraction
     */
    static readonly DATE_EMOJI_PATTERNS = {
        due: /🗓️\s*(\d{4}-\d{2}-\d{2})/,
        completion: /✅\s*(\d{4}-\d{2}-\d{2})/,
        created: /➕\s*(\d{4}-\d{2}-\d{2})/,
        start: /🛫\s*(\d{4}-\d{2}-\d{2})/,
        scheduled: /⏳\s*(\d{4}-\d{2}-\d{2})/,
    } as const;
    
    /**
     * Priority field names
     */
    static readonly PRIORITY_FIELDS = {
        primary: "priority",
        aliases: ["p", "pri", "prio"],
    } as const;
    
    // ==========================================
    // PROPERTY TERM CONSTANTS (Base Terms)
    // ==========================================
    
    /**
     * Base priority terms (English, Chinese, Swedish)
     * These are COMBINED with user's configured terms
     */
    static readonly BASE_PRIORITY_TERMS = {
        general: ["priority", "important", "urgent", "优先级", "优先", "重要", "紧急", "prioritet", "viktig", "brådskande"],
        high: ["high", "highest", "critical", "top", "高", "最高", "关键", "首要", "hög", "högst", "kritisk"],
        medium: ["medium", "normal", "中", "中等", "普通", "medel", "normal"],
        low: ["low", "minor", "低", "次要", "不重要", "låg", "mindre"],
    } as const;
    
    /**
     * Base due date terms (English, Chinese, Swedish)
     */
    static readonly BASE_DUE_DATE_TERMS = {
        general: ["due", "deadline", "scheduled", "截止日期", "到期", "期限", "计划", "förfallodatum", "deadline", "schemalagd"],
        today: ["today", "今天", "今日", "idag"],
        tomorrow: ["tomorrow", "明天", "imorgon"],
        overdue: ["overdue", "late", "past due", "过期", "逾期", "延迟", "försenad", "sen"],
        thisWeek: ["this week", "本周", "这周", "denna vecka"],
        nextWeek: ["next week", "下周", "nästa vecka"],
        future: ["future", "upcoming", "later", "未来", "将来", "以后", "framtida", "kommande"],
    } as const;
    
    /**
     * Base status terms (English, Chinese, Swedish)
     * Note: For status, we also have user's custom categories with their own terms!
     */
    static readonly BASE_STATUS_TERMS = {
        general: ["status", "state", "progress", "状态", "进度", "情况", "status", "tillstånd", "progress"],
    } as const;
    
    // ==========================================
    // QUERY SYNTAX PATTERNS
    // ==========================================
    
    /**
     * Regex patterns for query syntax recognition
     */
    static readonly QUERY_PATTERNS = {
        priority: /\bp[1-4]\b/gi,
        status: /\bs:[^\s&|]+/gi,
        project: /##+[A-Za-z0-9_-]+/g,
        search: /search:\s*["']?[^"'&|]+["']?/gi,
        hashtag: /#([\w-]+)/g,
        dueRange: /due\s+(?:before|after):\s*[^&|]+/gi,
        dateRange: /(?<!due\s)date\s+(?:before|after):\s*[^&|]+/gi,
        operators: /[&|!]/g,
    } as const;
    
    /**
     * Special keywords recognized in queries
     */
    static readonly SPECIAL_KEYWORDS = [
        "overdue", "over due", "od",
        "recurring",
        "subtask",
        "no date", "no priority"
    ] as const;
}
```

---

### **Phase 2: Add Combined Term Methods**

**Add methods that combine base terms + user terms:**

```typescript
/**
 * Get combined priority terms (base + user-configured)
 * Used in property recognition and AI prompts
 */
static getCombinedPriorityTerms(settings: PluginSettings): {
    general: string[];
    high: string[];
    medium: string[];
    low: string[];
} {
    return {
        general: [
            ...this.BASE_PRIORITY_TERMS.general,
            ...settings.userPropertyTerms.priority
        ],
        high: [...this.BASE_PRIORITY_TERMS.high],
        medium: [...this.BASE_PRIORITY_TERMS.medium],
        low: [...this.BASE_PRIORITY_TERMS.low],
    };
}

/**
 * Get combined due date terms (base + user-configured)
 */
static getCombinedDueDateTerms(settings: PluginSettings): {
    general: string[];
    today: string[];
    tomorrow: string[];
    overdue: string[];
    thisWeek: string[];
    nextWeek: string[];
    future: string[];
} {
    return {
        general: [
            ...this.BASE_DUE_DATE_TERMS.general,
            ...settings.userPropertyTerms.dueDate
        ],
        today: [...this.BASE_DUE_DATE_TERMS.today],
        tomorrow: [...this.BASE_DUE_DATE_TERMS.tomorrow],
        overdue: [...this.BASE_DUE_DATE_TERMS.overdue],
        thisWeek: [...this.BASE_DUE_DATE_TERMS.thisWeek],
        nextWeek: [...this.BASE_DUE_DATE_TERMS.nextWeek],
        future: [...this.BASE_DUE_DATE_TERMS.future],
    };
}

/**
 * Get combined status terms (base + user-configured + category terms)
 */
static getCombinedStatusTerms(settings: PluginSettings): {
    general: string[];
    [categoryKey: string]: string[];
} {
    const result: { general: string[]; [key: string]: string[] } = {
        general: [
            ...this.BASE_STATUS_TERMS.general,
            ...settings.userPropertyTerms.status
        ],
    };
    
    // Add terms from each status category
    for (const [categoryKey, config] of Object.entries(settings.taskStatusMapping)) {
        const terms = this.inferStatusTerms(categoryKey, settings);
        result[categoryKey] = terms.split(", ");
    }
    
    return result;
}
```

---

### **Phase 3: Centralize Prompt Building**

**Move ALL prompt building to PromptBuilderService:**

```typescript
/**
 * Build comprehensive property term guidance for AI prompts
 * Combines base terms + user terms + status category terms
 * Respects ALL user settings!
 */
static buildPropertyTermGuidance(settings: PluginSettings, queryLanguages: string[]): string {
    const combined = {
        priority: TaskPropertyService.getCombinedPriorityTerms(settings),
        dueDate: TaskPropertyService.getCombinedDueDateTerms(settings),
        status: TaskPropertyService.getCombinedStatusTerms(settings),
    };
    
    const languageList = queryLanguages.join(", ");
    
    return `
🚨 PROPERTY TERM RECOGNITION (Three-Layer System)

You have access to three layers of property term recognition:

LAYER 1: User-Configured Terms (Highest Priority)
${settings.userPropertyTerms.priority.length > 0 ? `- Priority: ${settings.userPropertyTerms.priority.join(", ")}` : "- Priority: (none configured)"}
${settings.userPropertyTerms.dueDate.length > 0 ? `- Due Date: ${settings.userPropertyTerms.dueDate.join(", ")}` : "- Due Date: (none configured)"}
${settings.userPropertyTerms.status.length > 0 ? `- Status: ${settings.userPropertyTerms.status.join(", ")}` : "- Status: (none configured)"}

LAYER 2: Base Terms (Built-in, Multilingual)
Priority Terms:
- General: ${combined.priority.general.join(", ")}
- High: ${combined.priority.high.join(", ")}
- Medium: ${combined.priority.medium.join(", ")}
- Low: ${combined.priority.low.join(", ")}

Due Date Terms:
- General: ${combined.dueDate.general.join(", ")}
- Today: ${combined.dueDate.today.join(", ")}
- Tomorrow: ${combined.dueDate.tomorrow.join(", ")}
- Overdue: ${combined.dueDate.overdue.join(", ")}
- This Week: ${combined.dueDate.thisWeek.join(", ")}
- Next Week: ${combined.dueDate.nextWeek.join(", ")}
- Future: ${combined.dueDate.future.join(", ")}

Status Terms:
- General: ${combined.status.general.join(", ")}
${Object.entries(settings.taskStatusMapping).map(([key, config]) => {
    const terms = TaskPropertyService.inferStatusTerms(key, settings);
    return `- ${config.displayName}: ${terms}`;
}).join("\n")}

LAYER 3: Semantic Expansion (You provide this!)
- Apply semantic expansion to ALL property terms across configured languages: ${languageList}
- Generate semantic equivalents DIRECTLY in each language
- This enables cross-language property recognition
`;
}
```

---

### **Phase 4: Update All Services**

**Services to update:**

1. **taskSearchService.ts:**
   - Remove `INTERNAL_*_TERMS` constants
   - Use `TaskPropertyService.getCombinedPriorityTerms(settings)`
   - Use `TaskPropertyService.getCombinedDueDateTerms(settings)`
   - Use `TaskPropertyService.getCombinedStatusTerms(settings)`

2. **dataviewService.ts:**
   - Use `TaskPropertyService.DATE_FIELDS`
   - Use `TaskPropertyService.DATE_EMOJI_PATTERNS`
   - Remove hardcoded field lists

3. **taskFilterService.ts:**
   - Use `TaskPropertyService.DATE_FIELDS`
   - Use `TaskPropertyService.PRIORITY_FIELDS`
   - Remove hardcoded field lists

4. **queryParserService.ts:**
   - Use `TaskPropertyService.QUERY_PATTERNS`
   - Use `PromptBuilderService.buildPropertyTermGuidance()`
   - Remove hardcoded patterns
   - Remove `removeStandardProperties()` or refactor to use constants

5. **propertyRecognitionService.ts:**
   - Use `PromptBuilderService` methods
   - Remove duplicate prompt building

6. **promptBuilderService.ts:**
   - Add all missing prompt building methods
   - Use TaskPropertyService constants
   - Respect ALL user settings

---

### **Phase 5: Improve AI Prompts**

**Key improvements:**

1. **Always use `settings.queryLanguages`** instead of hardcoded languages
2. **Show user's custom terms** in prompts
3. **Show ALL status categories** with their terms
4. **Centralize prompt generation** in PromptBuilderService
5. **Make prompts dynamically adapt** to user configuration

**Example improved prompt:**
```typescript
// BEFORE (hardcoded):
"Generate semantic equivalents in English, Chinese, Swedish"

// AFTER (respects user settings):
const languageList = settings.queryLanguages.join(", ");
`Generate semantic equivalents in ALL ${settings.queryLanguages.length} configured languages: ${languageList}`
```

---

## 📊 **EXPECTED BENEFITS**

### **Code Quality:**
- ✅ **Single source of truth** for all task property operations
- ✅ **No duplication** - constants defined once, used everywhere
- ✅ **Easy maintenance** - change in one place, applies everywhere
- ✅ **Type safety** - use constants instead of magic strings

### **User Experience:**
- ✅ **Respects ALL user settings** - custom terms, languages, categories
- ✅ **Better AI understanding** - prompts show complete configuration
- ✅ **Consistent behavior** - same logic across all modes
- ✅ **Multilingual support** - works with user's languages

### **Developer Experience:**
- ✅ **Clear APIs** - well-documented methods
- ✅ **Easy to extend** - add new constants in one place
- ✅ **Easy to test** - centralized logic
- ✅ **Better organization** - logical structure

---

## 🎯 **IMPLEMENTATION ORDER**

1. ✅ **Phase 1:** Add constants to TaskPropertyService
2. ✅ **Phase 2:** Add combined term methods
3. ✅ **Phase 3:** Centralize prompt building
4. ✅ **Phase 4:** Update all services to use centralized APIs
5. ✅ **Phase 5:** Test and verify

---

## 📝 **FILES TO MODIFY**

- `src/services/taskPropertyService.ts` (+200 lines - constants & methods)
- `src/services/promptBuilderService.ts` (+150 lines - improved prompts)
- `src/services/taskSearchService.ts` (-150 lines - remove duplicates)
- `src/services/dataviewService.ts` (-50 lines - use constants)
- `src/services/taskFilterService.ts` (-30 lines - use constants)
- `src/services/queryParserService.ts` (-50 lines - use constants & centralized prompts)
- `src/services/propertyRecognitionService.ts` (-40 lines - use centralized prompts)

**Net change:** ~+30 lines (small increase for much better organization!)

---

## ✅ **NEXT STEPS**

Ready to implement! Shall I proceed?
