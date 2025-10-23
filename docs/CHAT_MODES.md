# Chat Modes

Task Chat offers three chat modes, each optimized for different use cases and AI usage levels.

## Mode Comparison

| Feature | Simple Search | Smart Search | Task Chat |
|---------|--------------|--------------|-----------|
| **Keyword matching** | Regex-based (stop words removed) | AI-expanded multilingual synonyms | AI-expanded multilingual synonyms |
| **AI usage** | None | Keyword expansion only | Keyword expansion + Analysis + Recommendations |
| **Sorting** | By user preference | By user preference | By user preference + Auto mode available (AI-driven) |
| **Cost** | Free (no AI used) | Very low (AI expands search keywords) | Higher (AI analyzes tasks and provides insights) |
| **Best for** | Quick searches, simple filters, cost-free operation | Multilingual searches, broader results, semantic matching | Complex queries, task prioritization, AI insights |

## Simple Search

**How it works:**
- Uses regex pattern matching
- Removes stop words (the, task, work, etc.)
- Fast and free (no AI calls)

**Best for:**
- Quick searches with exact keywords
- Simple property filters (priority, status, due date)
- Cost-free operation
- When you know exactly what you're looking for

**Example queries:**
- `fix bug priority:1`
- `s:open due:today`
- `urgent tasks`

## Smart Search

**How it works:**
- AI expands your keywords into multilingual synonyms
- Example: "fix" → "fix, repair, solve, correct, resolve..."
- Uses semantic expansion for better recall
- Still returns results directly (no AI analysis)

**Best for:**
- Multilingual searches
- Broader, more comprehensive results
- Semantic matching (finds related concepts)
- When you want better recall without AI analysis

**Example queries:**

*English:*
- `fix` → Finds "repair", "solve", "correct", "resolve"
- `urgent` → Finds "critical", "important", "high-priority"
- "tasks I need to finish today"

*中文:*
- `修复` → Finds "修理", "解决", "修正", "纠正"
- `紧急` → Finds "关键", "重要", "高优先级"
- "我今天需要完成的任务"

**AI features:**
- Keyword semantic expansion
- Property concept recognition (converts "urgent" → priority:1)
- Automatic typo correction

## Task Chat

**How it works:**
- AI expands keywords (like Smart Search)
- AI analyzes all matching tasks
- Provides insights, patterns, and recommendations
- Can use "Auto" sorting mode (AI-driven prioritization)

**Best for:**
- Complex queries requiring analysis
- Task prioritization and planning
- Getting AI insights and recommendations
- When you want help understanding your tasks

**Example queries:**

*English:*
- "What should I work on next?"
- "Show me urgent tasks that are overdue"
- "Analyze my high-priority tasks"

*中文:*
- "我接下来应该做什么？"
- "显示过期的紧急任务"
- "分析我的高优先级任务"

**AI features:**
- Keyword semantic expansion
- Property concept recognition
- Task analysis and insights
- Actionable recommendations
- AI-driven sorting (Auto mode)

## Choosing the Right Mode

**Use Simple Search when:**
- ✅ You know exact keywords
- ✅ You want instant results
- ✅ You want to minimize AI costs
- ✅ You're doing quick lookups

**Use Smart Search when:**
- ✅ You want broader search results
- ✅ You search in multiple languages
- ✅ You want semantic matching
- ✅ You want AI help with queries but not analysis

**Use Task Chat when:**
- ✅ You want AI analysis and insights
- ✅ You need help prioritizing tasks
- ✅ You want recommendations
- ✅ You're planning your work

## Cost Considerations

**Simple Search:** Free (no AI)

**Smart Search:** Very low cost
- Only expands keywords (small prompt)
- Example: ~100-200 tokens per query
- Estimated: $0.0001-0.0002 per query (with GPT-4o-mini)

**Task Chat:** Higher cost
- Expands keywords + analyzes tasks + generates recommendations
- Example: ~1000-5000 tokens per query (depends on task count)
- Estimated: $0.001-0.01 per query (with GPT-4o-mini)

**Tip:** Use Smart Search for most queries, Task Chat for complex analysis.

## Related Settings

- **Default chat mode:** Choose your preferred mode
- **Semantic expansion:** Control keyword expansion behavior
- **Max keyword expansions:** Limit expansion size
- **Query languages:** Configure languages for expansion
- **Max AI recommendations:** Control Task Chat output length

## See Also

- [Semantic Expansion](SEMANTIC_EXPANSION.md) - How AI expands keywords
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked
- [Sorting System](SORTING_SYSTEM.md) - How tasks are ordered
