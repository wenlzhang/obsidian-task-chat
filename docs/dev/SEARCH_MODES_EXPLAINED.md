# Search Modes Explained

## Overview

Task Chat has two search modes that give you control over how your queries are processed and results are delivered.

---

## The Two Search Modes

### Smart search
**Query parsing**: AI-powered  
**Result delivery**: Automatic (intelligent decision)  
**Cost**: ~$0.0001-$0.0021 per query  
**Best for**: Complex queries, multilingual searches, getting AI insights

**How it works**:
1. AI analyzes your query to understand intent (~$0.0001)
2. Extracts keywords, filters, and semantic meaning
3. Filters and scores tasks for relevance
4. **Decides automatically**:
   - Simple query + few results (≤20) → Shows direct results
   - Complex query or many results → AI analyzes and recommends

**Examples**:
```
Query: "urgent meetings this week"
→ AI parsing: extracts keywords [urgent, meeting], filter [due: this week]
→ 8 tasks found
→ Simple query → Direct results
→ Cost: ~$0.0001

Query: "高优先级的开发任务" (multilingual)
→ AI parsing: translates and extracts [high priority, development, task]
→ 45 tasks found
→ Many results → AI analysis
→ Cost: ~$0.0021
```

### Direct search
**Query parsing**: Regex-based (pattern matching)  
**Result delivery**: Always direct  
**Cost**: Free ($0)  
**Best for**: Simple filters, fast results, cost-free searches

**How it works**:
1. Regex patterns extract filters and keywords (free)
2. Filters and scores tasks for relevance
3. **Always shows direct results** (never AI analysis)

**Examples**:
```
Query: "high priority"
→ Regex parsing: extracts filter [priority: high]
→ 15 tasks found
→ Direct results shown
→ Cost: $0

Query: "due today"
→ Regex parsing: extracts filter [due: today]
→ 3 tasks found
→ Direct results shown
→ Cost: $0
```

---

## Understanding the Two Phases

Every query goes through two distinct phases:

### Phase 1: Query Parsing (Understanding your query)

**AI-powered parsing** (Smart search only):
- Semantic understanding of natural language
- Multilingual keyword extraction and translation
- Context-aware filter detection
- Handles complex, conversational queries
- Cost: ~$0.0001 per query

**Regex-based parsing** (Direct search):
- Pattern matching for known filters
- Simple keyword extraction
- Fast and predictable
- Best for structured queries
- Cost: $0

### Phase 2: Result Delivery (How results are shown)

**Direct results**:
- Filtered and sorted task list
- No AI commentary
- Fast and predictable
- Cost: $0

**AI analysis** (Smart search only):
- AI reads filtered tasks
- Provides insights and recommendations
- Natural language explanations
- Prioritizes and explains choices
- Cost: ~$0.002 per analysis

---

## When Does AI Analysis Happen?

### In Smart Search Mode
AI analysis is **automatic and intelligent**:

✅ **Triggers AI analysis when**:
- Query has multiple filter types (e.g., priority + due date + keywords)
- Result count exceeds max direct results (default: 20 tasks)
- Query complexity suggests AI insights would be valuable

✅ **Skips AI analysis when**:
- Simple query (single filter or basic keyword)
- Few results (≤20 tasks)
- Direct results are sufficient

### In Direct Search Mode
AI analysis is **always disabled**:
- ❌ Never uses AI analysis
- ✅ Always shows direct results
- ✅ Always $0 cost

---

## Message Format Guide

### Direct Results (System Message)

**Smart search → Direct**:
```
System • 10:45 AM

Found 15 matching task(s):

[Task list with checkboxes and navigation arrows]

📊 Query: AI-parsed • Results: Direct (simple query) • ~$0.0001
```

**Direct search → Direct**:
```
System • 10:45 AM

Found 20 matching task(s):

[Task list with checkboxes and navigation arrows]

📊 Query: Regex-parsed • Results: Direct • Mode: Direct search • $0
```

### AI-Analyzed Results (Assistant Message)

**Smart search → AI analysis**:
```
Assistant • 10:45 AM

Based on your tasks, I recommend focusing on these three high-priority items:

1. [TASK_1] is overdue and blocks other work
2. [TASK_5] has a deadline today
3. [TASK_3] is high priority for this week

[Recommended task list with checkboxes and navigation arrows]

📊 Query: AI-parsed • Results: AI-analyzed (complex query, 45→15 tasks) • Model: gpt-4o-mini • 1,234 tokens (1,000 in, 234 out) • ~$0.0021
```

---

## Cost Breakdown

| Scenario | Query Parsing | Result Delivery | Total Cost |
|----------|--------------|----------------|------------|
| Direct search (any query) | $0 (regex) | $0 (direct) | **$0** |
| Smart search (simple, ≤20 results) | ~$0.0001 (AI) | $0 (direct) | **~$0.0001** |
| Smart search (complex or >20 results) | ~$0.0001 (AI) | ~$0.002 (AI analysis) | **~$0.0021** |

**Daily usage estimate**:
- 50 direct searches: $0
- 50 smart searches (mix): ~$0.05-$0.10
- Cost-effective for regular use

---

## Choosing the Right Mode

### Use Smart Search When:
- ✅ Writing natural language queries
- ✅ Using multilingual searches
- ✅ Need AI to analyze and prioritize tasks
- ✅ Want intelligent recommendations
- ✅ Query is complex or conversational
- ✅ Willing to spend ~$0.0001-$0.0021 per query

### Use Direct Search When:
- ✅ Need instant, free results
- ✅ Using simple filters (priority, due date, etc.)
- ✅ Want raw filtered data without AI interpretation
- ✅ Cost is a primary concern
- ✅ Query is straightforward
- ✅ Don't need AI insights

---

## Settings Integration

### Enabling/Disabling Smart Search

**Settings → Task Chat → Enable smart search mode**

**When enabled**:
- Both modes available in chat dropdown
- Default: Smart search
- Can switch between modes per query

**When disabled**:
- Only direct search available
- All queries use regex parsing
- All queries show direct results
- All queries are free ($0)

---

## Advanced: Understanding the Decision Logic

### Smart Search Decision Tree

```
User Query
    ↓
[AI Parsing: ~$0.0001]
    ↓
[Extract filters & keywords]
    ↓
[Apply filters to tasks]
    ↓
[Quality scoring & filtering]
    ↓
[Sort by relevance or user preference]
    ↓
Decision Point:
    ├─ IF simple query AND ≤20 results
    │  → Show direct results ($0.0001 total)
    │
    └─ IF complex query OR >20 results
       → AI analysis ($0.002 additional)
       → Total: ~$0.0021
```

### Direct Search Process

```
User Query
    ↓
[Regex Parsing: $0]
    ↓
[Extract filters & keywords]
    ↓
[Apply filters to tasks]
    ↓
[Quality scoring & filtering]
    ↓
[Sort by user preference]
    ↓
[Show direct results: $0 total]
```

---

## FAQ

**Q: If I enable smart search, will every query use AI?**  
A: No. Smart search uses AI for query parsing (~$0.0001), but only triggers AI analysis for complex queries or many results. Simple queries show direct results.

**Q: Can I force direct results even with smart search enabled?**  
A: Yes! Just switch the dropdown to "Direct search" in the chat interface.

**Q: What counts as a "simple query"?**  
A: Single filter type or basic keyword search with ≤20 results. Examples: "overdue tasks", "high priority", "meeting".

**Q: What counts as a "complex query"?**  
A: Multiple filter types or >20 results. Examples: "high priority tasks due this week in project folder", "开发 urgent".

**Q: How do I minimize costs?**  
A: Use Direct search mode for simple queries, Smart search only when you need AI insights.

**Q: What's the quality difference?**  
A: Both modes apply the same quality filtering. Smart search adds AI interpretation and recommendations on top.

**Q: Can I see which mode was used?**  
A: Yes! Every message shows the query parsing method and result delivery method in the token usage line.

---

## Examples by Use Case

### 1. Quick Priority Check (Direct Search)
```
Query: "high priority"
Mode: Direct search
Result: List of 8 high-priority tasks
Cost: $0
Time: <1 second
```

### 2. Overdue Task Review (Direct Search)
```
Query: "overdue"
Mode: Direct search
Result: List of 12 overdue tasks, sorted by due date
Cost: $0
Time: <1 second
```

### 3. Multilingual Project Search (Smart Search)
```
Query: "开发任务 urgent" (Chinese + English)
Mode: Smart search
Result: AI-analyzed tasks with bilingual understanding
Cost: ~$0.0021
Time: ~2-3 seconds
```

### 4. Weekly Planning (Smart Search)
```
Query: "what should I focus on this week?"
Mode: Smart search
Result: AI analyzes your tasks and recommends priorities
Cost: ~$0.0021
Time: ~2-3 seconds
```

### 5. Simple Due Date Filter (Either Mode)
```
Query: "due today"
Mode: Direct search → Free, instant
Mode: Smart search → ~$0.0001, instant (direct results)
```

---

## Summary

- **Smart search**: AI-powered, intelligent, adaptive (~$0.0001-$0.0021)
- **Direct search**: Regex-based, fast, free ($0)
- **Choose based on**: Query complexity and need for AI insights
- **Switch anytime**: Use the dropdown in chat interface
- **Transparent**: Every response shows which methods were used
- **Cost-effective**: Average cost per query: $0-$0.0021

Both modes produce high-quality filtered results. Smart search adds AI intelligence on top.
