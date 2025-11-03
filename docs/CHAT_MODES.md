# Chat Modes

Task Chat offers three chat modes, each optimized for different use cases and AI usage levels.

## Mode Comparison

| Feature | Simple Search | Smart Search | Task Chat |
|---------|--------------|--------------|-----------|
| **Keyword matching** | Regex-based (stop words removed) | AI-expanded multilingual synonyms | AI-expanded multilingual synonyms |
| **AI usage** | None | Keyword expansion only | Keyword expansion + Analysis + Recommendations |
| **Sorting** | By user preference | By user preference | By user preference + AI-driven |
| **Cost** | Free (no AI used) | Low (AI expands search keywords) | Higher (AI analyzes tasks and provides insights) |
| **Best for** | Quick searches, simple filters, cost-free operation | Multilingual searches, broader results, semantic matching | Complex queries, task prioritization, AI insights |

## Simple Search

**How it works:**
- Uses regex pattern matching
- Removes stop words (the, a, that, etc.)
- Fast and free (no AI calls)

**Best for:**
- Quick searches with exact keywords
- Simple property filters (due date, priority, status)
- Cost-free operation
- When you know exactly what you're looking for

**Example queries:**
- `fix bug p:1`
- `s:open due:today`

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

- `fix` → Finds "repair", "solve", "correct", "resolve"
- `urgent` → Finds "critical", "high-priority"
- "tasks I need to finish today"

**AI features:**
- Keyword semantic expansion
- Property concept recognition (converts "urgent" → priority:1)
- Automatic typo correction

## Task Chat

**How it works:**
- AI expands keywords (like Smart Search)
- AI analyzes all matching tasks
- Provides insights, patterns, and recommendations

**Best for:**
- Complex queries requiring analysis
- Task prioritization and planning
- Getting AI insights and recommendations
- When you want help understanding your tasks

**Example queries:**

- "Show me urgent tasks that are overdue"

**AI features:**
- Keyword semantic expansion
- Property concept recognition
- Task analysis and insights
- Actionable recommendations

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

**Smart Search:** Low cost
- Only expands keywords (small prompt)

**Task Chat:** Higher cost
- Expands keywords + analyzes tasks + generates recommendations

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
