# Chat History Context

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

Settings → Task Chat → Chat history context length

### **What It Controls:**

Number of recent messages sent to AI as context for each new query.

**Range:** 1-100 messages
**Default:** 5 messages

## Automatic Message Cleaning

### **Why We Clean Messages**

Previous messages can contain elements that confuse the AI:
- **Warning messages:** AI might think task reference format causes errors
- **Task numbers:** **Task 1**, **Task 2** don't match new task IDs
- **System messages:** Not relevant for AI context

---

## Technical Details

### **Two Different Settings**

**1. `maxSessions` (default: 50)**
- Maximum number of **chat sessions** to keep
- Session storage limit
- **Automatically prunes oldest sessions** when limit is exceeded
- Maintains the most recent N sessions, discarding older ones
- Each session can have unlimited messages

**2. `chatHistoryContextLength` (default: 5)**
- Number of messages to **send to AI** from current session
- Context limit for AI requests
- Balances context quality vs. token cost
- Does not affect message storage

---

## Troubleshooting

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

## Related Documentation

- **Settings Guide:** [SETTINGS_GUIDE.md](SETTINGS_GUIDE.md#2-task-chat)
- **Chat History Mechanism:** [docs/dev/CHAT_HISTORY_AND_FALLBACK_MECHANISM_2025-01-26.md](dev/CHAT_HISTORY_AND_FALLBACK_MECHANISM_2025-01-26.md)
- **AI Model Warning:** [docs/dev/AI_MODEL_ISSUE_WARNING_ANALYSIS_2025-01-26.md](dev/AI_MODEL_ISSUE_WARNING_ANALYSIS_2025-01-26.md)
