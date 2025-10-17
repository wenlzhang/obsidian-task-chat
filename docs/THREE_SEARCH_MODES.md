# Three Search Modes

Task Chat offers three distinct modes, each designed for different use cases. Choose the mode that best fits your needs.

---

## 🚀 Simple Search

**Fast, free keyword search**

- **How it works**: Regex-based keyword matching with stop word removal
- **AI usage**: None
- **Cost**: $0 (completely free)
- **Speed**: Instant
- **Best for**: Quick searches, simple filters, cost-conscious use

**Example**:
```
Query: "high priority bug"
→ Finds tasks containing "high", "priority", "bug"
→ Cost: $0
```

---

## 🧠 Smart Search  

**AI-enhanced keyword search**

- **How it works**: AI expands your keywords into multilingual synonyms
- **AI usage**: Keyword expansion only (no analysis)
- **Cost**: ~$0.0001 per query
- **Speed**: ~1-2 seconds
- **Best for**: Multilingual searches, broader results, semantic matching

**Example**:
```
Query: "urgent meeting"
→ AI expands to: ["urgent", "紧急", "meeting", "会议", "reunion"]
→ Finds tasks in any language
→ Cost: ~$0.0001
```

---

## 💬 Task Chat

**Full AI assistant with analysis and recommendations**

- **How it works**: AI expands keywords + analyzes tasks + provides recommendations
- **AI usage**: Keyword expansion + Analysis + Recommendations
- **Cost**: ~$0.0021 per query
- **Speed**: ~2-3 seconds
- **Best for**: Complex queries, task prioritization, AI insights

**Example**:
```
Query: "what should I focus on this week?"
→ AI expands keywords
→ AI analyzes your tasks
→ AI recommends top priorities with explanations
→ Cost: ~$0.0021
```

---

## Comparison Table

| Feature | Simple Search | Smart Search | Task Chat |
|---------|--------------|--------------|-----------|
| **Keyword matching** | Regex-based | AI-expanded synonyms | AI-expanded synonyms |
| **Multilingual** | Basic | ✅ Automatic | ✅ Automatic |
| **AI analysis** | ❌ No | ❌ No | ✅ Yes |
| **Recommendations** | ❌ No | ❌ No | ✅ Yes |
| **Sorting** | User preference | User preference | User preference + Auto |
| **Cost per query** | $0 | ~$0.0001 | ~$0.0021 |
| **Speed** | Instant | 1-2 sec | 2-3 sec |

---

## How to Choose

### Use Simple Search when:
- You want instant, free results
- You're using simple filters (priority, due date, tags)
- You know exactly what keywords to search for
- Cost is a concern

### Use Smart Search when:
- You're searching in multiple languages
- You want broader, more comprehensive results
- You want AI to understand synonyms and related terms
- You don't need AI recommendations (just better search)

### Use Task Chat when:
- You have a complex question about your tasks
- You want AI to recommend which tasks to prioritize
- You need insights and analysis, not just a list
- You want conversational interaction with your task data

---

## Switching Modes

### In Settings
1. Go to **Settings** → **Task Chat**
2. Find **Search mode** dropdown
3. Select your preferred default mode

### In Chat Interface
- Use the dropdown in the chat view to switch modes per query
- Your selection overrides the default for that query only

---

## Cost Examples

### Daily Usage Scenarios

**Scenario 1: Free user (Simple Search only)**
- 50 queries per day
- Daily cost: **$0**
- Monthly cost: **$0**

**Scenario 2: Mixed user**
- 30 Simple Search queries (free)
- 15 Smart Search queries (~$0.0015)
- 5 Task Chat queries (~$0.0105)
- Daily cost: **~$0.012**
- Monthly cost: **~$0.36**

**Scenario 3: Power user (Task Chat heavy)**
- 50 Task Chat queries per day
- Daily cost: **~$0.105**
- Monthly cost: **~$3.15**

---

## Token Usage Display

Every response shows which mode was used and the exact cost:

```
📊 Mode: Simple Search • $0

📊 Mode: Smart Search • OpenAI gpt-4o-mini • 250 tokens (200 in, 50 out) • ~$0.0001

📊 Mode: Task Chat • OpenAI gpt-4o-mini • 1,234 tokens (1,000 in, 234 out) • ~$0.0021
```

---

## Tips

### Optimizing Costs
1. **Default to Simple Search** for most queries
2. **Use Smart Search** when you need multilingual or broader results
3. **Reserve Task Chat** for when you need AI insights

### Best Practices
- Simple Search is perfect for: "priority 1", "due today", "#work"
- Smart Search shines for: "开发任务", "urgent meetings", "fix bug"
- Task Chat excels at: "what's urgent?", "prioritize my week", "what's overdue?"

### Performance Tips
- Simple Search is always instant (no API calls)
- Smart Search and Task Chat require internet connection
- All modes cache results in your vault

---

## FAQ

**Q: Can I use multiple modes in one session?**  
A: Yes! Switch modes anytime using the dropdown.

**Q: Which mode should I use by default?**  
A: Start with Simple Search. Upgrade to Smart Search when you need better multilingual support. Use Task Chat when you want AI recommendations.

**Q: Do all modes support the same filters?**  
A: Yes! Priority, due date, status, folder, and tag filters work in all modes.

**Q: Will my old searches still work?**  
A: Yes! The plugin automatically migrates your settings.

**Q: Can I disable AI completely?**  
A: Yes! Just use Simple Search mode only (default setting).

---

## Technical Details

### Simple Search
- Uses regex patterns to extract filters
- Removes stop words (the, a, how, what, etc.)
- Filters and sorts based on user preferences
- No external API calls

### Smart Search
- Calls AI once for keyword expansion
- Translates keywords to all configured languages
- Returns direct results (no AI analysis)
- ~200-300 tokens per query

### Task Chat
- Calls AI for keyword expansion (first call)
- Sends filtered tasks to AI for analysis (second call)
- AI provides ranked recommendations with explanations
- ~1,000-1,500 tokens per query

---

## Summary

Three modes, three use cases:

1. **Simple Search** = Fast & Free
2. **Smart Search** = Better Results
3. **Task Chat** = AI Insights

Choose based on your needs, switch anytime, transparent costs.
