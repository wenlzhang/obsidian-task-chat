# General Questions Guide

## Overview

This guide explains how Task Chat handles general/vague questions and provides comprehensive examples for different scenarios and languages.

## Types of General Questions

### 1. Time-Based Questions ("When" Focus)

**What to ask:**
- Questions about what tasks are available in a time period
- Focus on temporal context rather than task content

**Examples:**

```
English:
"What can I do today?"
"What should I work on this week?"
"What's on my plate right now?"
"Show me tomorrow's tasks"
"What's scheduled for next Monday?"

中文:
"今天可以做什么？"
"本周我应该做什么？"
"现在有什么任务？"
"明天有什么要做的？"
"下周一有什么安排？"

Swedish:
"Vad kan jag göra idag?"
"Vad ska jag jobba med den här veckan?"
"Vad har jag på gång just nu?"
"Visa morgondagens uppgifter"
"Vad är planerat för nästa måndag?"
```

**How Task Chat responds:**
1. Extracts time filter (today, this week, tomorrow)
2. Finds all tasks matching that time period
3. AI analyzes and recommends based on priority, status, and context
4. Provides summary like: "You have 5 tasks due today. Here are the most important ones..."

### 2. Priority-Based Questions ("What's Important" Focus)

**What to ask:**
- Questions about urgency and importance
- Focus on priority rather than specific tasks

**Examples:**

```
English:
"What's urgent?"
"What's most important?"
"Show me critical tasks"
"What needs immediate attention?"
"What are my top priorities?"

中文:
"有什么紧急的？"
"什么最重要？"
"显示关键任务"
"什么需要立即处理？"
"我的首要任务是什么？"

Swedish:
"Vad är brådskande?"
"Vad är viktigast?"
"Visa kritiska uppgifter"
"Vad behöver omedelbar uppmärksamhet?"
"Vilka är mina högsta prioriteringar?"
```

**How Task Chat responds:**
1. Identifies priority-related intent
2. Finds high-priority tasks (P1, P2)
3. Considers due dates and status
4. AI recommends: "You have 3 urgent tasks. Task X is overdue and should be addressed first..."

### 3. Status-Based Questions ("What's Next" Focus)

**What to ask:**
- Questions about task progress and next actions
- Focus on workflow state

**Examples:**

```
English:
"What should I work on next?"
"What's in progress?"
"What can I finish today?"
"Show me incomplete tasks"
"What am I currently working on?"

中文:
"接下来应该做什么？"
"有什么正在进行的？"
"今天能完成什么？"
"显示未完成的任务"
"我现在在做什么？"

Swedish:
"Vad ska jag jobba med härnäst?"
"Vad pågår?"
"Vad kan jag slutföra idag?"
"Visa ofullständiga uppgifter"
"Vad jobbar jag med just nu?"
```

**How Task Chat responds:**
1. Extracts status filters (open, in-progress)
2. Considers due dates for "finish today"
3. AI analyzes progress and recommends next action
4. Suggests: "You're working on 2 tasks. Task Y is closest to completion..."

### 4. Capability Questions ("What Can I Do" Focus)

**What to ask:**
- Open-ended questions about available work
- Seeking AI guidance on what's possible

**Examples:**

```
English:
"What can I do?"
"What are my options?"
"What tasks are available?"
"What should I focus on?"
"What's on my to-do list?"

中文:
"我能做什么？"
"我有什么选择？"
"有哪些可用的任务？"
"我应该专注于什么？"
"我的待办事项是什么？"

Swedish:
"Vad kan jag göra?"
"Vilka alternativ har jag?"
"Vilka uppgifter finns tillgängliga?"
"Vad ska jag fokusera på?"
"Vad finns på min att-göra-lista?"
```

**How Task Chat responds:**
1. Shows broad view of open tasks
2. AI considers multiple factors (priority, due date, status)
3. Provides categorized recommendations
4. Suggests: "You have tasks in 3 areas: 5 urgent, 8 this week, 3 in progress..."

### 5. Context Questions ("Show Me" Focus)

**What to ask:**
- Requests to see specific categories or contexts
- Often combined with folders, tags, or topics

**Examples:**

```
English:
"Show me work tasks"
"What's in my personal folder?"
"Display all #meeting tasks"
"What bugs do I have?"
"Show me documentation tasks"

中文:
"显示工作任务"
"个人文件夹里有什么？"
"显示所有 #会议 任务"
"我有哪些 bug？"
"显示文档任务"

Swedish:
"Visa arbetsuppgifter"
"Vad finns i min personliga mapp?"
"Visa alla #mötes-uppgifter"
"Vilka buggar har jag?"
"Visa dokumentationsuppgifter"
```

**How Task Chat responds:**
1. Extracts folder/tag filters
2. Searches for keywords ("bug", "documentation")
3. AI provides context-specific analysis
4. Shows: "You have 12 work tasks. 3 are high priority..."

## Combining General + Specific

### Mixed Questions (Best Practice)

**Structure:** [General intent] + [Specific context]

```
English:
"What should I work on today for the API project?"
→ Time (today) + Context (API project)

"What's urgent in the backend?"
→ Priority (urgent) + Context (backend)

"What can I finish this week in #development?"
→ Time (this week) + Tag (#development) + Status (completable)

中文:
"今天 API 项目应该做什么？"
→ 时间（今天）+ 上下文（API 项目）

"后端有什么紧急的？"
→ 优先级（紧急）+ 上下文（后端）

"本周 #开发 能完成什么？"
→ 时间（本周）+ 标签（#开发）+ 状态（可完成）
```

**Benefits:**
- More focused results
- Better AI recommendations
- Combines natural language with precise filtering

## Advanced Patterns

### Sequential Refinement

Start general, then refine based on AI response:

```
1. "What should I work on today?"
   → AI shows 10 tasks across multiple areas

2. "Focus on high priority ones"
   → AI filters to 3 P1 tasks

3. "Which one is closest to completion?"
   → AI recommends specific task based on progress
```

### Contextual Follow-ups

Build on previous context:

```
1. "Show me tasks due this week"
   → AI displays 15 tasks

2. "Which are in the work folder?"
   → AI filters to work-related subset

3. "Sort by priority"
   → AI reorders recommendations
```

## Strategy by Mode

### Simple Search

**Best for:**
- Specific property filters: `due:today`, `p1`, `s:open`
- Quick filters without AI overhead

**General questions handling:**
- ⚠️ Limited - uses regex extraction only
- Works best with explicit filters
- Example: "due:today p1" works, "what's urgent today?" may not

### Smart Search

**Best for:**
- Keyword expansion across languages
- Semantic matching
- Moderate complexity questions

**General questions handling:**
- ✅ Good - expands keywords semantically
- Detects properties from natural language
- Example: "urgent tasks" → expands "urgent" to synonyms, finds priority

### Task Chat (Recommended for General Questions)

**Best for:**
- Vague/general questions
- Complex analysis needed
- Multi-factor recommendations

**General questions handling:**
- ✅ Excellent - AI understands intent fully
- Adapts filtering for vague queries
- Provides analysis and recommendations
- Example: "What should I do?" → AI analyzes all factors and recommends

## Tips for Best Results

### DO ✅

1. **Use natural language freely**
   - "What's on my plate today?"
   - "Show me what's important"

2. **Combine time + priority**
   - "What's urgent this week?"
   - "今天有什么重要的？"

3. **Ask for guidance**
   - "What should I focus on?"
   - "Where should I start?"

4. **Use follow-up questions**
   - Build context over conversation
   - Refine based on AI response

5. **Mix general + specific**
   - "What can I do today in the API project?"
   - Best of both worlds

### DON'T ❌

1. **Don't use only generic words in Simple Search**
   - ❌ "What to do?" (no filters)
   - ✅ "What to do today?" (has time filter)

2. **Don't expect keyword matching on question words**
   - Questions like "what", "how", "when" are generic
   - System focuses on properties (date, priority) instead

3. **Don't mix too many intents**
   - ❌ "Show me yesterday's future high priority in-progress done tasks"
   - ✅ Ask multiple simpler questions

## Multilingual Support

### Language Mixing

Task Chat handles mixed-language queries:

```
"今天 due tasks for API project"
→ Chinese (今天 = today) + English (due, tasks, API project)
→ Works seamlessly across all modes
```

### Language-Specific Patterns

**English:** Often uses modal verbs
- "What should I..."
- "What can I..."
- "What do I need to..."

**中文:** Often uses question particles
- "...什么？"
- "...怎么办？"
- "...有哪些？"

**Swedish:** Often uses modal verbs + question words
- "Vad ska jag..."
- "Vad kan jag..."
- "Vilka..."

All patterns are understood equally well.

## Real-World Scenarios

### Morning Planning

```
User: "What should I work on today?"
Task Chat: "You have 8 tasks due today. Here are the top priorities:
  1. [P1] Fix login bug - Overdue
  2. [P1] Deploy hotfix - Due today
  3. [P2] Write API docs - Due today
  Would you like me to focus on any specific area?"

User: "Focus on bugs"
Task Chat: "You have 2 bugs to fix:
  1. Login bug (P1, overdue)
  2. Search performance (P2, due Friday)
  I recommend starting with the login bug as it's highest priority."
```

### Weekly Review

```
User: "本周我有什么？" (What do I have this week?)
Task Chat: "本周你有 15 个任务：
  - 紧急: 3 个 (2 个过期)
  - 高优先级: 5 个
  - 进行中: 4 个
  建议先处理过期的紧急任务。"

User: "显示过期的" (Show overdue ones)
Task Chat: "过期的任务：
  1. 修复登录问题 (P1, 3天前)
  2. 更新文档 (P2, 1天前)"
```

### Context Switching

```
User: "What's urgent in backend?"
Task Chat: "3 urgent backend tasks:
  1. Database optimization (P1, overdue)
  2. API rate limiting (P1, due tomorrow)
  3. Cache invalidation (P2, due Friday)"

User: "What about frontend?"
Task Chat: "2 urgent frontend tasks:
  1. Login UI fix (P1, due today)
  2. Mobile responsiveness (P2, due Monday)"
```

## Implementation Notes

### How It Works Behind the Scenes

1. **Query Analysis**
   ```
   Input: "今天可以做什么？"
   Detected: isVague=true, dueDate=today
   Strategy: Property-filter-only (skip keyword matching)
   ```

2. **Task Filtering**
   ```
   Step 1: Apply property filters (due date, priority, status)
   Step 2: Skip keyword filter (vague query)
   Result: All tasks matching properties
   ```

3. **AI Analysis**
   ```
   AI receives: All property-matched tasks
   AI considers: Priority, status, description, context
   AI recommends: Top N most relevant tasks with reasoning
   ```

4. **Response Generation**
   ```
   AI formats: Clear recommendations
   AI explains: Why each task is suggested
   AI offers: Follow-up options
   ```

## Related Documentation

- [Chat Modes](CHAT_MODES.md) - Mode comparison and features
- [Query Syntax](../README.md#query-syntax) - Specific filter syntax
- [Vague Query Handling](VAGUE_QUERY_HANDLING.md) - Technical implementation details

## Quick Reference

| Question Type | Example | Best Mode | Key Property |
|--------------|---------|-----------|--------------|
| Time-based | "What's due today?" | Task Chat | Due date |
| Priority-based | "What's urgent?" | Task Chat | Priority |
| Status-based | "What's in progress?" | Smart/Task Chat | Status |
| Capability | "What can I do?" | Task Chat | All factors |
| Context | "Show me work tasks" | Smart/Task Chat | Folder/tags |
| Mixed | "What's urgent today?" | Task Chat | Multiple |

## Conclusion

General questions are not just supported - they're one of Task Chat's strengths! The AI understands intent, adapts filtering strategies, and provides intelligent recommendations.

**Key Principle:** For vague questions, property filters (time, priority, status) matter more than keyword matching. Let AI handle the natural language understanding.

**Best Practice:** Use Task Chat mode for general questions to get AI-powered analysis and recommendations.
