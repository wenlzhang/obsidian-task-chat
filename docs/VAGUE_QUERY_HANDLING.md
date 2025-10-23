# Vague Query Handling Strategy

## Problem Statement

Vague or general queries like "今天可以做什么？" (What can I do today?) or "What should I work on?" contain **generic question words** rather than specific task-related keywords. This causes issues:

1. **Over-filtering**: Generic keywords like "can", "do", "what", "should" don't appear in task text
2. **Zero results**: After keyword filtering, 0 tasks remain even when property filters match tasks
3. **Poor UX**: Users asking natural questions get no results

### Example from Console Logs

```
Query: "今天可以做什么？" (What can I do today?)
Parsed:
  - Due date: today ✅ (correctly detected)
  - Keywords: ["可以", "做", "什么"] → expanded to 53 keywords
  - After property filter: 1 task found ✅
  - After keyword filter: 0 tasks found ❌
Result: No tasks shown, but there WAS a task due today!
```

## Classification: Vague vs. Specific Queries

### Vague Queries (Need Special Handling)

**Characteristics:**
- Contain generic question words: what, when, which, how
- Contain generic verbs: do, make, work, should, can
- Focus on TIME/CONTEXT rather than CONTENT
- Property filters are more important than keywords

**Examples:**
```
English:
- "What should I work on today?"
- "What can I do now?"
- "Show me tasks for this week"
- "What's urgent?"
- "What's due soon?"

中文:
- "今天可以做什么？"
- "我应该做什么？"
- "现在能做什么？"
- "有什么紧急的？"
- "本周有什么任务？"

Swedish:
- "Vad ska jag göra idag?"
- "Vad kan jag göra nu?"
- "Visa uppgifter för denna vecka"
```

### Specific Queries (Current Handling Works)

**Characteristics:**
- Contain specific keywords related to task content
- Keywords likely appear in task descriptions
- Keyword matching adds value

**Examples:**
```
English:
- "Fix authentication bug"
- "Deploy to production"
- "Write documentation for API"

中文:
- "修复登录问题"
- "部署到生产环境"
- "编写 API 文档"

Swedish:
- "Fixa autentiseringsfel"
- "Distribuera till produktion"
```

## Detection Strategy

### Generic Keywords to Detect

**Question Words (High Weight):**
- English: what, when, where, which, how, why, who
- 中文: 什么, 怎么, 哪里, 哪个, 为什么, 怎样, 谁
- Swedish: vad, när, var, vilken, hur, varför, vem

**Generic Verbs (Medium Weight):**
- English: do, make, work, should, can, may, need, have
- 中文: 做, 可以, 能, 应该, 需要, 有
- Swedish: göra, kan, ska, behöver, har

**Generic Nouns (Low Weight):**
- English: task, tasks, item, items, thing, things, work
- 中文: 任务, 事情, 东西, 工作
- Swedish: uppgift, uppgifter, sak, saker, arbete

### Detection Algorithm

```typescript
function isVagueQuery(coreKeywords: string[]): boolean {
    const genericWords = [
        // Question words
        'what', 'when', 'where', 'which', 'how', 'why', 'who',
        '什么', '怎么', '哪里', '哪个', '为什么', '怎样', '谁',
        'vad', 'när', 'var', 'vilken', 'hur', 'varför', 'vem',
        
        // Generic verbs
        'do', 'make', 'work', 'should', 'can', 'may', 'need', 'have',
        '做', '可以', '能', '应该', '需要', '有',
        'göra', 'kan', 'ska', 'behöver', 'har',
        
        // Generic nouns
        'task', 'tasks', 'item', 'items', 'thing', 'things', 'work',
        '任务', '事情', '东西', '工作',
        'uppgift', 'uppgifter', 'sak', 'saker', 'arbete'
    ];
    
    // If 70%+ of core keywords are generic, it's a vague query
    const genericCount = coreKeywords.filter(kw => 
        genericWords.some(gw => kw.toLowerCase().includes(gw.toLowerCase()))
    ).length;
    
    return genericCount >= coreKeywords.length * 0.7;
}
```

## Handling Strategies by Mode

### Simple Search Mode

**Current Behavior:**
- Uses regex-based extraction
- No keyword expansion
- Direct property matching

**For Vague Queries:**
- ✅ Works fine - focuses on property filters
- ✅ No keyword filtering by default
- Example: "due:today" → Shows all tasks due today

### Smart Search Mode  

**Current Behavior:**
- AI expands keywords semantically
- Applies both property AND keyword filters
- **Problem**: Generic keywords filter out everything

**Proposed Fix:**

```typescript
if (isVagueQuery(coreKeywords)) {
    console.log('[Smart Search] Vague query detected - skipping keyword filter');
    
    // Skip keyword filtering, rely on property filters only
    filteredTasks = TaskSearchService.applyCompoundFilters(tasks, {
        priority: intent.priority,
        dueDate: intent.dueDate,
        status: intent.status,
        folder: intent.folder,
        tags: intent.tags,
        keywords: undefined // Skip keyword filter
    });
} else {
    // Normal handling with keywords
    filteredTasks = TaskSearchService.applyCompoundFilters(tasks, {
        ...intent,
        keywords: expandedKeywords
    });
}
```

### Task Chat Mode

**Current Behavior:**
- AI parses query
- Expands keywords semantically  
- Filters with properties + keywords
- AI analyzes and recommends
- **Problem**: Same as Smart Search - generic keywords filter out everything

**Proposed Fix:**

```typescript
const queryType = {
    hasKeywords: keywords.length > 0,
    hasProperties: !!(priority || dueDate || status || folder || tags?.length),
    isVague: isVagueQuery(coreKeywords)
};

if (queryType.isVague && queryType.hasProperties) {
    console.log('[Task Chat] Vague query with properties - using light filtering');
    
    // Use property filters primarily
    filteredTasks = TaskSearchService.applyCompoundFilters(tasks, {
        priority,
        dueDate,
        status,
        folder,
        tags,
        keywords: undefined // Skip strict keyword matching
    });
    
    // Let AI do the natural language understanding
    // AI will analyze all property-matched tasks and recommend relevant ones
} else {
    // Normal handling with strict keyword filtering
}
```

## Implementation Plan

### Phase 1: Detection

**File:** `src/services/queryParserService.ts`

Add detection function:
```typescript
static isVagueQuery(coreKeywords: string[]): boolean {
    // Implementation as shown above
}
```

Add to QueryIntent interface:
```typescript
interface QueryIntent {
    // ... existing fields
    isVague?: boolean; // NEW: indicates generic/vague query
}
```

### Phase 2: Smart Search Handling

**File:** `src/services/aiService.ts` (Smart Search section)

Modify filtering logic to skip keyword filtering for vague queries:
```typescript
// In Smart Search handling
if (queryIntent.isVague && queryHasProperties) {
    // Skip keyword filtering, use properties only
} else {
    // Normal keyword filtering
}
```

### Phase 3: Task Chat Handling

**File:** `src/services/aiService.ts` (Task Chat section)

Modify filtering logic similarly:
```typescript
// In Task Chat handling  
if (queryIntent.isVague && queryHasProperties) {
    // Light filtering - properties only
    // Let AI handle natural language understanding
} else {
    // Strict filtering with keywords
}
```

### Phase 4: Logging & Debug

Add clear logging:
```typescript
if (queryIntent.isVague) {
    console.log('[Task Chat] Vague query detected:', {
        coreKeywords,
        genericRatio: genericCount / coreKeywords.length,
        strategy: 'property-filters-only'
    });
}
```

## Expected Results After Fix

### Query: "今天可以做什么？" (What can I do today?)

**Before Fix:**
```
Parsed: dueDate=today, keywords=["可以", "做", ...]
Property filter: 1 task (due today) ✅
Keyword filter: 0 tasks ❌
Result: No tasks shown ❌
```

**After Fix:**
```
Parsed: dueDate=today, isVague=true
Property filter: 1 task (due today) ✅
Keyword filter: SKIPPED (vague query) ✅
Result: 1 task shown ✅
AI analyzes: "You have 1 task due today: [task details]" ✅
```

### Query: "Fix authentication bug" (Specific)

**Before & After (No Change):**
```
Parsed: keywords=["fix", "authentication", "bug"], isVague=false
Property filter: N tasks
Keyword filter: M tasks (containing fix/auth/bug) ✅
Result: Relevant tasks shown ✅
```

## Benefits

### For Users

✅ **Vague questions work**: "What can I do today?" returns tasks  
✅ **Natural language**: Ask questions naturally in any language  
✅ **Better UX**: Property filters alone are often enough  
✅ **AI understanding**: AI interprets intent from all matched tasks  

### For Developers

✅ **Clear strategy**: Explicit handling for different query types  
✅ **Flexible**: Can tune generic word list per language  
✅ **Debuggable**: Clear logging shows detection and handling  
✅ **Backward compatible**: Specific queries work exactly as before  

## Testing Scenarios

### Vague Queries (Should Return Results)

```
English:
✅ "What should I work on today?" → Tasks due today
✅ "What's urgent?" → High priority tasks
✅ "Show me this week's tasks" → Tasks due this week
✅ "What can I do now?" → Open tasks

中文:
✅ "今天可以做什么？" → 今天到期的任务
✅ "有什么紧急的？" → 高优先级任务
✅ "本周有什么？" → 本周任务
✅ "现在能做什么？" → 未完成任务

Swedish:
✅ "Vad ska jag göra idag?" → Uppgifter som förfaller idag
✅ "Vad är brådskande?" → Högprioriterade uppgifter
```

### Specific Queries (Should Use Keywords)

```
✅ "Fix authentication bug" → Tasks containing fix/auth/bug
✅ "Deploy production server" → Tasks containing deploy/production/server
✅ "修复登录问题" → Tasks containing 修复/登录/问题
```

### Mixed Queries

```
✅ "What bugs should I fix today?" 
    → isVague=false (specific: "bugs", "fix")
    → Uses keyword filtering ✅
    
✅ "Show me tasks for API"
    → isVague=false (specific: "API")
    → Uses keyword filtering ✅
```

## Future Enhancements

1. **Machine Learning**: Train model to detect vague queries more accurately
2. **User Feedback**: Let users mark queries as vague/specific to improve detection
3. **Confidence Scoring**: Show "vague query detected" message to users
4. **Adaptive Filtering**: Gradually relax keyword strictness if no results found
5. **Context Awareness**: Remember user's recent tasks to improve vague query understanding

## Related Documentation

- [Chat Modes](CHAT_MODES.md) - How different modes work
- [Query Syntax](../README.md#query-syntax) - Supported filters and syntax
- [Semantic Expansion](COMPLETE_KEYWORD_FLOW_2024-10-17.md) - How keyword expansion works

## Conclusion

Vague queries are a natural way users interact with task management systems. By detecting these queries and adapting our filtering strategy, we can provide much better results while maintaining accuracy for specific queries.

The key insight: **For vague questions, property filters (due date, priority, status) are MORE important than keyword matching. Let AI handle the natural language understanding instead of strict keyword filtering.**
