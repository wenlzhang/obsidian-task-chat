# AI Prompt Settings Audit

**Date:** 2024-10-17  
**Type:** Comprehensive Analysis  
**Status:** ⚠️ Multiple Issues Found

## Overview

Audit of all user settings to identify which are properly reflected in AI prompts and which are missing.

---

## Settings Audit Matrix

| Setting | Currently in Prompt? | Impact if Missing | Priority |
|---------|---------------------|-------------------|----------|
| **dataviewPriorityMapping** | ✅ Yes (buildPriorityMapping) | N/A | - |
| **dataviewKeys.dueDate** | ✅ Yes (buildDueDateMapping) | N/A | - |
| **dataviewKeys.createdDate** | ❌ **No** | AI doesn't know created date format | Medium |
| **dataviewKeys.completedDate** | ❌ **No** | AI doesn't know completed date format | Low |
| **taskStatusMapping** | ❌ **No** | AI doesn't know valid status values | **High** |
| **responseLanguage** | ✅ Yes (languageInstruction) | N/A | - |
| **queryLanguages** | ✅ Partial (in language instruction) | Could be more explicit | Low |
| **maxRecommendations** | ❌ **No** | AI doesn't know how many to recommend | **Critical** |
| **maxTasksForAI** | ❌ **No** | AI doesn't know it's seeing limited context | High |
| **relevanceThreshold** | ❌ **No** | AI doesn't know quality filtering applied | Medium |
| **sortOrder** | ✅ Yes (just added) | N/A | - |
| **systemPrompt** | ❌ **NO - COMPLETELY IGNORED!** | User customization doesn't work | **CRITICAL** |

---

## Critical Issue #1: User's systemPrompt Ignored!

### **The Problem**

**User can configure** (`settings.ts` line 65):
```typescript
systemPrompt: string; // Default: "You are a task assistant for Obsidian..."
```

**But code completely ignores it** (`aiService.ts` line 836):
```typescript
let systemPrompt = `You are a task management assistant for Obsidian...`;
// ^^^ Hardcoded! settings.systemPrompt is never used!
```

**Impact:**
- ❌ User's custom system prompt is completely ignored
- ❌ Users think they can customize AI behavior but can't
- ❌ Settings UI misleading - shows option that doesn't work
- ❌ This is a **user-facing bug**!

### **Solution**

Should either:
1. **Use user's systemPrompt as base** (recommended)
2. **Or append enhancements** to user's prompt
3. **Or remove setting** if not meant to be customizable

**Recommended approach:**
```typescript
// Start with user's custom prompt
let systemPrompt = settings.systemPrompt;

// Append technical instructions
systemPrompt += `\n\nTECHNICAL INSTRUCTIONS:
[task reference format]
[priority mapping]
[sort order]
etc.`;
```

---

## Critical Issue #2: maxRecommendations Not Communicated

### **The Problem**

**User configures** (`settings.ts` line 77):
```typescript
maxRecommendations: number; // Max tasks AI should recommend (default: 20)
```

**But AI doesn't know this limit**:
- AI might recommend 50 tasks when user wants max 20
- AI might recommend only 3 tasks when user wants up to 20
- No guidance on how many tasks to include

### **Solution**

Add to prompt:
```typescript
RECOMMENDATION LIMITS:
- Recommend up to ${settings.maxRecommendations} tasks maximum
- If more tasks are relevant, prioritize the most critical ones
- It's okay to recommend fewer if only a few are truly relevant
```

---

## High Priority Issue #3: Status Mapping Not Documented

### **The Problem**

**User customizes** (`settings.ts` lines 47-49):
```typescript
taskStatusMapping: Record<string, string[]>; // e.g., {open: [" ", ""], completed: ["x", "X"]}
taskStatusDisplayNames: Record<string, string>; // e.g., {open: "Open", completed: "Completed"}
```

**But AI doesn't know:**
- What status categories exist (open, completed, inProgress, cancelled, other)
- What display names user uses
- How to interpret task status

### **Solution**

Add buildStatusMapping helper:
```typescript
private static buildStatusMapping(settings: PluginSettings): string {
    const names = settings.taskStatusDisplayNames;
    return `\nSTATUS CATEGORIES:
- Open: ${names.open || "Open"}
- Completed: ${names.completed || "Completed"}
- In Progress: ${names.inProgress || "In progress"}
- Cancelled: ${names.cancelled || "Cancelled"}
- Other: ${names.other || "Other"}`;
}
```

---

## High Priority Issue #4: Task Count Context Missing

### **The Problem**

**What's missing:**
- AI receives N tasks but doesn't know if there are more
- AI doesn't know: "You're seeing top 30 out of 200 tasks"
- AI can't inform user if they're missing relevant tasks

**Example scenario:**
- User has 500 tasks total
- System sends top 30 to AI (maxTasksForAI=30)
- AI analyzes 30 tasks
- User asks: "Do I have any documentation tasks?"
- AI says: "No documentation tasks found"
- **But there might be doc tasks in the other 470!**

### **Solution**

Add context about task counts:
```typescript
TASK CONTEXT:
- You are seeing ${tasksToAnalyze.length} tasks (top ranked by relevance/priority)
- These were selected from ${totalTasksBeforeFiltering} total tasks in the vault
- If the user's query isn't fully satisfied, mention that more tasks exist but weren't shown
```

---

## Medium Priority Issue #5: Date Format for Created/Completed

### **The Problem**

**Currently documented:**
- ✅ Due date format (`buildDueDateMapping`)

**Missing:**
- ❌ Created date format
- ❌ Completed date format

**Impact:**
- AI doesn't know how to interpret `[created::2024-10-15]`
- Users might ask about creation dates, AI doesn't understand format

### **Solution**

Enhance buildDueDateMapping to include all date formats:
```typescript
private static buildDateFormats(settings: PluginSettings): string {
    return `\nDATE FORMATS (DataView):
- Due date: [${settings.dataviewKeys.dueDate}::YYYY-MM-DD]
- Created date: [${settings.dataviewKeys.createdDate}::YYYY-MM-DD]
- Completed date: [${settings.dataviewKeys.completedDate}::YYYY-MM-DD]
Users may reference tasks by any of these dates.`;
}
```

---

## Medium Priority Issue #6: Relevance Filtering Context

### **The Problem**

**What happens:**
- System applies quality filtering (relevance threshold)
- Low-relevance tasks are filtered out
- AI receives only high-quality matches

**What AI doesn't know:**
- That filtering was applied
- What threshold was used
- That some lower-relevance tasks exist but were excluded

**Impact:**
- User: "Show me ALL tasks with 'meeting'"
- System filters out tasks with relevance < 40
- AI: "Here are the meeting tasks" (but doesn't mention filtered ones)
- User confused why some meeting tasks aren't shown

### **Solution**

Add filtering context:
```typescript
QUALITY FILTERING:
- Tasks shown have been filtered for relevance (minimum score: ${threshold})
- Lower-scoring matches were excluded to focus on the most relevant results
- If the user needs broader results, they can adjust the relevance threshold in settings
```

---

## Low Priority Issues

### **Issue 7: Query Languages**

**Current:** Mentioned in language instruction  
**Enhancement:** Could be more explicit about multilingual support

```typescript
MULTILINGUAL SUPPORT:
- System supports queries in: ${settings.queryLanguages.join(", ")}
- Tasks may be in any of these languages
- Respond in the language of the user's query
```

### **Issue 8: Temperature**

**Current:** Used in API call but not mentioned in prompt  
**Enhancement:** Could inform AI about creativity vs. consistency mode

```typescript
RESPONSE STYLE:
- Temperature set to ${settings.temperature} (0.0 = consistent, 2.0 = creative)
- ${settings.temperature < 0.5 ? "Focus on consistent, deterministic responses" : "Be creative in suggestions"}
```

---

## Implementation Recommendations

### **Phase 1: Critical Fixes (Immediate)**

1. **Use settings.systemPrompt as base**
   ```typescript
   let systemPrompt = settings.systemPrompt;
   systemPrompt += "\n\n[Technical enhancements]";
   ```

2. **Add maxRecommendations guidance**
   ```typescript
   RECOMMENDATION LIMITS:
   - Recommend up to ${settings.maxRecommendations} tasks maximum
   ```

### **Phase 2: High Priority (Soon)**

3. **Add status mapping documentation**
4. **Add task count context**

### **Phase 3: Medium Priority (Later)**

5. **Add all date formats** (not just due date)
6. **Add relevance filtering context**

### **Phase 4: Nice to Have**

7. **Enhanced multilingual context**
8. **Temperature-based style guidance**

---

## Proposed Enhanced buildMessages()

```typescript
private static buildMessages(
    userMessage: string,
    taskContext: string,
    chatHistory: ChatMessage[],
    settings: PluginSettings,
    intent: any,
    sortOrder: SortCriterion[],
    taskCounts: { shown: number; filtered: number; total: number }, // NEW
): any[] {
    // 1. Start with user's custom system prompt
    let systemPrompt = settings.systemPrompt;
    
    // 2. Add language instruction
    const languageInstruction = this.buildLanguageInstruction(settings);
    
    // 3. Add technical documentation
    const priorityMapping = this.buildPriorityMapping(settings);
    const statusMapping = this.buildStatusMapping(settings);       // NEW
    const dateFormats = this.buildDateFormats(settings);            // NEW (enhanced)
    const sortExplanation = this.buildSortOrderExplanation(sortOrder);
    
    // 4. Add operational context
    const recommendationLimits = this.buildRecommendationLimits(settings); // NEW
    const taskCountContext = this.buildTaskCountContext(taskCounts);       // NEW
    const qualityFilterContext = this.buildQualityFilterContext(intent);   // NEW
    
    // 5. Add filter context
    const filterContext = this.buildFilterContext(intent);
    
    // 6. Append all enhancements to user's system prompt
    systemPrompt += `\n\n
${languageInstruction}
${priorityMapping}
${statusMapping}
${dateFormats}
${sortExplanation}
${recommendationLimits}
${taskCountContext}
${qualityFilterContext}
${filterContext}

${taskContext}`;
    
    return [{
        role: "system",
        content: systemPrompt
    }];
}
```

---

## User Impact Analysis

### **Current State: Settings That Don't Work**

Users can configure these settings but they're ignored:
1. ❌ **systemPrompt** - Completely ignored (major bug!)
2. ❌ **maxRecommendations** - AI doesn't follow limit
3. ❌ **taskStatusDisplayNames** - AI doesn't know custom names

**This creates user frustration:**
- "I customized the system prompt but AI behaves the same"
- "I set max recommendations to 5 but AI gives me 20"
- "I renamed 'Open' to 'Todo' but AI still says 'Open'"

### **After Fixes: Full Settings Respect**

All settings properly reflected:
1. ✅ User's systemPrompt is base for AI behavior
2. ✅ AI respects maxRecommendations limit
3. ✅ AI uses user's custom status names
4. ✅ AI understands all date formats
5. ✅ AI knows task count context
6. ✅ AI knows quality filtering was applied

**Result:**
- Users feel empowered
- Settings actually work as expected
- AI behavior matches configuration
- No surprises or confusion

---

## Testing Checklist

After fixes, verify:

- [ ] User's systemPrompt is used as base
- [ ] AI recommends ≤ maxRecommendations tasks
- [ ] AI uses user's status display names
- [ ] AI understands created/completed date formats
- [ ] AI mentions task count context appropriately
- [ ] AI acknowledges quality filtering when relevant
- [ ] All settings changes immediately affect prompt
- [ ] No hardcoded values override user preferences

---

## Conclusion

**Current state:** 8 out of 12 relevant settings properly reflected in prompt (67%)  
**Critical issues:** 2 (systemPrompt ignored, maxRecommendations missing)  
**High priority issues:** 2 (status mapping, task count context)  

**Recommendation:** Implement Phase 1 and 2 immediately to respect user configuration and fix the critical systemPrompt bug.

This will make the system **truly user-configurable** instead of having settings that don't work.
