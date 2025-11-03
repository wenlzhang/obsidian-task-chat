# Chat History Context - Complete Guide

**Topic:** How chat history context works, what gets sent to AI, and how to configure it

**Related Documentation:**
- [← Back to README](../README.md)
- [Complete Settings Guide](SETTINGS_GUIDE.md)
- [Chat Modes](CHAT_MODES.md)

---

## Quick Summary

**What it does:** Sends recent chat messages to AI as context for better conversation continuity

**User control:** Settings → Chat history context length (1-100 messages, default: 5)

**What gets cleaned:** Warning messages and task references are automatically removed before sending to AI

**Token impact:** More history = better context but higher token cost

---

## How It Works

### **The Basic Flow**

```
User sends Query #2
    ↓
System loads recent N messages from chat history
    ↓
Cleans messages (removes warnings, task references)
    ↓
Sends to AI:
    - System prompt (task list, format requirements)
    - N cleaned history messages
    - Current user query
    ↓
AI generates response with full context
```

### **What Gets Included**

**From each historical message:**
- ✅ User queries (your previous questions)
- ✅ AI summaries (cleaned - see below)
- ❌ Warning messages (automatically removed)
- ❌ Task reference numbers (e.g., **Task 1**) (automatically replaced)
- ❌ System messages (not sent to AI)

---

## Chat History Context Length Setting

### **Location:**

Settings → Task Chat → Chat history context length

### **What It Controls:**

Number of recent messages sent to AI as context for each new query.

**Range:** 1-100 messages  
**Default:** 5 messages  
**Recommended:** 3-10 messages for most users

### **How to Choose:**

**Use Lower Values (1-3):**
- You want to save tokens (lower cost)
- You ask independent questions (no conversation flow)
- You switch topics frequently
- You're using expensive models

**Use Medium Values (5-10):**  
- You have multi-turn conversations about tasks
- You refer to "that task" or "the one I mentioned"
- You want AI to remember recent context
- **Recommended for most users** ✅

**Use Higher Values (15-50):**
- You have very long conversations about complex projects
- You need AI to remember details from many messages ago
- Token cost is not a concern
- You're using models with large context windows

**Use Maximum (100):**
- Only for special cases with extremely long conversations
- Be aware of significant token cost increase
- Most models can handle this, but cost adds up quickly

---

## Automatic Message Cleaning

### **Why We Clean Messages**

Previous messages can contain elements that confuse the AI:
- **Warning messages:** AI might think [TASK_X] format causes errors
- **Task numbers:** **Task 1**, **Task 2** don't match new task IDs
- **System messages:** Not relevant for AI context

### **What Gets Cleaned**

**1. Warning Messages (Completely Removed)**

**Before cleaning:**
```
⚠️ AI Model Failed to Reference Tasks Correctly

Query: "开发插件" (13:42:15)

🔍 What Went Wrong:
The AI model did not use [TASK_1], [TASK_2]...

---

为了有效地开发插件，您需要关注紧急任务...
```

**After cleaning (only AI response kept):**
```
为了有效地开发插件，您需要关注紧急任务...
```

**Why:** Warning messages confuse AI about format requirements. AI might interpret warning as "don't use [TASK_X] format", leading to repeated failures.

**2. Task Reference Numbers (Replaced)**

**Before cleaning:**
```
Start with **Task 1** and **Task 2**, which are overdue. Next, **Task 3** is high priority...
```

**After cleaning:**
```
Start with a task and a task, which are overdue. Next, a task is high priority...
```

**Why:** **Task 1**, **Task 2** are display numbers that don't match new query's task IDs. If AI sees "Task 1" in history but new query has different Task 1, it creates confusion.

**3. System Messages (Excluded)**

System messages (if any) are not sent to AI at all.

---

## Token Usage Impact

### **How Many Tokens Does History Use?**

**Rough estimates** (actual varies by language and content):

**English:**
- 1 message pair (user query + AI response): ~100-300 tokens
- 5 message pairs: ~500-1500 tokens
- 10 message pairs: ~1000-3000 tokens

**Chinese:**
- 1 message pair: ~50-200 tokens (more efficient)
- 5 message pairs: ~250-1000 tokens
- 10 message pairs: ~500-2000 tokens

**Mixed (English + Chinese):**
- Use average of above

### **Total Token Cost Per Query**

```
Total tokens = System prompt + History + Current query + AI response
               (~1000)       + (varies) + (~50)         + (~200-500)

With 5 messages history: ~2000-3000 tokens per query
With 10 messages history: ~3000-4500 tokens per query
With 20 messages history: ~4000-6000 tokens per query
```

### **Cost Examples**

Using gpt-4o-mini ($0.15/1M input tokens, $0.60/1M output tokens):

**5 messages history:**
- Input: ~2500 tokens × $0.15/1M = $0.000375
- Output: ~300 tokens × $0.60/1M = $0.00018
- **Total per query: ~$0.0006 (less than 1 cent)**

**20 messages history:**
- Input: ~5000 tokens × $0.15/1M = $0.00075
- Output: ~300 tokens × $0.60/1M = $0.00018
- **Total per query: ~$0.0009 (less than 1 cent)**

**100 queries per month:**
- With 5 history: ~$0.06/month
- With 20 history: ~$0.09/month
- **Difference: ~$0.03/month** (minimal)

### **Conclusion:**

For most users with gpt-4o-mini or similar pricing, **token cost difference is negligible** between 5 and 20 messages. The real trade-off is:
- **More history:** Better context, AI understands conversation flow
- **Less history:** Slightly faster, AI focuses only on current query

---

## Benefits of Chat History Context

### **1. Conversation Continuity**

**Without history:**
```
User: "Show me urgent tasks"
AI: [Lists 10 urgent tasks]

User: "Which one should I do first?"
AI: "I don't have information about specific tasks. Could you describe them?"
```
❌ AI doesn't remember the previous response

**With history:**
```
User: "Show me urgent tasks"  
AI: [Lists 10 urgent tasks]

User: "Which one should I do first?"
AI: "Based on the urgent tasks above, start with Task 1 (overdue since yesterday)..."
```
✅ AI remembers and can reference previous tasks

### **2. Follow-Up Questions**

**Example conversation:**
```
User: "Show me tasks for Project X"
AI: [Shows 5 tasks]

User: "What about the high priority ones?"
AI: [Filters to 2 high priority tasks from Project X]
   ↑ Understands "the high priority ones" refers to Project X tasks

User: "When are those due?"
AI: "Task 1 is due tomorrow, Task 2 is due next week"
   ↑ Knows "those" = the 2 high priority tasks from Project X
```

### **3. Task Disambiguation**

**Example:**
```
User: "Show development tasks"
AI: [Shows 8 development tasks]

User: "Mark task 3 as complete"
AI: "I see Task 3: 'Implement authentication'. Should I help you update it?"
   ↑ Knows which "task 3" because it remembers the list
```

---

## When History Helps vs. Hurts

### **History Helps:**

✅ **Multi-turn conversations** - "Show urgent tasks" → "Which one first?" → "How about the others?"

✅ **Refinement** - "Show all tasks" → "Just the urgent ones" → "Only those overdue"

✅ **Follow-up questions** - Referring to "those tasks", "the one I mentioned", "as you said"

✅ **Context accumulation** - Building up understanding across multiple queries

### **History Can Hurt:**

⚠️ **Topic switches** - Talking about Project X, then suddenly ask about Project Y (old context might bias response)

⚠️ **Error propagation** - If AI misunderstood something earlier, it might carry that misunderstanding forward

⚠️ **Token cost** - For simple, independent queries, history just wastes tokens

⚠️ **Confusion from old warnings** - This is why we automatically clean warnings!

### **Solution: Start New Session**

When switching topics or AI seems confused:
- Click "New Session" button
- Clears all history
- Starts fresh conversation
- Often fixes persistent issues

---

## Technical Details

### **Message Storage**

**Location:** `.obsidian/plugins/task-chat/data.json`

```json
{
  "sessions": [
    {
      "id": "session-123",
      "messages": [
        {
          "role": "user",
          "content": "Show urgent tasks",
          "timestamp": 1706284935000
        },
        {
          "role": "chat",
          "content": "为了有效管理紧急任务...",
          "timestamp": 1706284936000,
          "recommendedTasks": [...]
        }
      ]
    }
  ]
}
```

### **Two Different Settings**

**1. `maxSessions` (default: 50)**
- Maximum number of **chat sessions** to keep
- Session storage limit
- **Automatically prunes oldest sessions** when limit is exceeded
- Maintains the most recent N sessions, discarding older ones
- Range: 10-100 sessions
- Each session can have unlimited messages

**2. `chatHistoryContextLength` (default: 5)**
- Number of messages to **send to AI** from current session
- Context limit for AI requests
- Balances context quality vs. token cost
- Does not affect message storage

**Example:**
- You have 30 sessions saved (storage: maxSessions = 50)
- Current session has 100 messages
- Only last 5 messages are sent to AI (context: chatHistoryContextLength = 5)

### **Message Cleaning Process**

**Code location:** `src/services/aiService.ts` lines 1362-1417

```typescript
// 1. Get last N messages
const historyLength = Math.min(Math.max(1, settings.chatHistoryContextLength), 100);
const recentHistory = chatHistory.slice(-historyLength);

// 2. Clean each message
recentHistory.forEach((msg) => {
    let cleanedContent = msg.content;
    
    // Remove warnings
    if (cleanedContent.includes("⚠️ **AI Model Failed to Reference Tasks Correctly**")) {
        const parts = cleanedContent.split("---\n\n");
        cleanedContent = parts[parts.length - 1].trim();
    }
    
    // Replace **Task N** with generic text
    cleanedContent = cleanedContent.replace(/\*\*Task \d+\*\*/g, "a task");
    
    // Send cleaned content to AI
    messages.push({ role: apiRole, content: cleanedContent });
});
```

### **What Gets Sent to AI**

**Full context includes:**

1. **System prompt** (~1000 tokens)
   - Task list with [TASK_1], [TASK_2], etc.
   - Format requirements
   - Instructions for AI

2. **Cleaned history** (~varies)
   - Last N message pairs
   - Warnings removed
   - Task numbers replaced

3. **Current query** (~50 tokens)
   - User's new question

**Total:** System prompt + History + Query = Input tokens

---

## Troubleshooting

### **Problem: AI doesn't remember previous conversation**

**Possible causes:**
1. Chat history context length set to 1 (only current query sent)
2. Started new session (history cleared)
3. Too many messages ago (beyond context length)

**Solutions:**
- Increase context length (Settings → 5-10 messages)
- Don't start new session unless needed
- Repeat important information if it was many messages ago

### **Problem: AI seems confused or gives wrong answers**

**Possible causes:**
1. Old context is misleading AI
2. Topic changed but history still has old topic
3. Previous error propagating forward

**Solutions:**
- Start new session (clears all history)
- Reduce context length (less old context)
- Be explicit in queries ("ignoring previous tasks, show me...")

### **Problem: Token usage is too high**

**Possible causes:**
1. Context length set too high (20+)
2. Very long AI responses in history
3. Using expensive model

**Solutions:**
- Reduce context length (Settings → 3-5 messages)
- Use Smart Search instead of Task Chat for simple queries
- Switch to cheaper model (gpt-4o-mini instead of gpt-4)

### **Problem: Warning messages keep appearing**

**Possible causes:**
1. Model too small (gpt-4o-mini, gpt-3.5-turbo)
2. Previous warnings confusing AI
3. Response truncated (token limit)

**Solutions:**
- Start new session (clears warning history)
- Switch to larger model (gpt-4, claude-3-opus)
- Warnings are automatically cleaned from history (already implemented!)

---

## Best Practices

### **For Most Users:**

✅ **Default setting (5 messages)** works well for typical conversations

✅ **Increase to 10** if you have longer, more complex conversations

✅ **Reduce to 3** if you ask mostly independent questions

✅ **Start new session** when switching projects or topics

### **For Power Users:**

✅ **Monitor token usage** in response messages to see actual cost

✅ **Adjust based on model:**
   - Cheap models (gpt-4o-mini): Can use 10-20 without worry
   - Expensive models (gpt-4): Keep at 5-10 to control costs

✅ **Use Smart Search** for simple queries (no history needed)

✅ **Use Task Chat** only when you need conversation and context

### **For Cost-Conscious Users:**

✅ **Set to 3 messages** (minimal context, low cost)

✅ **Use Simple Search** whenever possible (no AI, no tokens)

✅ **Use Smart Search** for keyword-based queries (AI parsing only, no history)

✅ **Reserve Task Chat** for when you truly need AI analysis

---

## FAQ

### **Q: Why is default only 5 messages?**

A: Balance between context and cost. 5 messages usually captures recent conversation flow while keeping token usage reasonable. Most conversations don't need more.

### **Q: Can I set it to 0 (no history)?**

A: No, minimum is 1. If you don't want history, use Smart Search mode instead (AI parses query but doesn't generate conversational response).

### **Q: Why clean task numbers but keep AI summary?**

A: AI summary provides useful context about previous conversation. Task numbers (**Task 1**, **Task 2**) are just display labels that change with each query, so they would confuse AI. The actual task context is in the new task list sent with each query.

### **Q: What if I want AI to remember specific tasks across queries?**

A: The task list is sent fresh with EVERY query, so AI always has current tasks. History is for conversation flow, not task persistence. If you need to track specific tasks, mention them by name/description.

### **Q: Does this affect Simple Search or Smart Search?**

A: No. Chat history is only used in Task Chat mode. Simple Search and Smart Search don't generate conversational responses, so history isn't relevant.

### **Q: Can history cause AI to hallucinate or make errors?**

A: Rarely. More often, history helps AI understand context better. If you suspect history is causing issues, start a new session to clear it.

---

## Related Documentation

- **Settings Guide:** [SETTINGS_GUIDE.md](SETTINGS_GUIDE.md#2-task-chat)
- **Chat History Mechanism:** [docs/dev/CHAT_HISTORY_AND_FALLBACK_MECHANISM_2025-01-26.md](dev/CHAT_HISTORY_AND_FALLBACK_MECHANISM_2025-01-26.md)
- **AI Model Warning:** [docs/dev/AI_MODEL_ISSUE_WARNING_ANALYSIS_2025-01-26.md](dev/AI_MODEL_ISSUE_WARNING_ANALYSIS_2025-01-26.md)

---

**Updated:** January 26, 2025  
**Status:** Complete guide with all improvements implemented
