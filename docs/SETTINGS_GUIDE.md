# Complete Settings Guide

**📚 Comprehensive guide to understanding and customizing Task Chat settings**

## Quick Start

### 👉 Start with Defaults

**All settings are pre-configured with recommended values.** Most users get excellent results without changing anything!

**When to Customize:**
- Too many results → Increase quality filter (10-30%)
- Urgent tasks overwhelming keywords → Add minimum relevance (20-40%)
- Wrong task priority → Adjust coefficients (R, D, P)
- Generic words matching everything → Add custom stop words

---

## The Processing Pipeline

```
User Query
    ↓
1. PARSING - Extract keywords & properties
    ↓
2. FILTERING
   a. DataView Filter - Match keywords/properties → ~500 tasks
   b. Stop Words Filter - Remove generic keywords
   c. Quality Filter - Keep above threshold → ~50 tasks
   d. Minimum Relevance - Require keyword quality (optional)
    ↓
3. SCORING - Calculate: (R×20) + (D×4) + (P×1)
    ↓
4. SORTING - Order by comprehensive score
    ↓
5. DISPLAY - Simple/Smart: show | Task Chat: AI analysis
```

---

## Settings Reference

### Stop Words

**What:** Generic words filtered out during search  
**Built-in:** ~100 words (the, a, task, work, etc.)  
**Impact:** Filtering, Scoring, AI Prompt  

**Custom stop words when:**
- Domain-specific: `plugin, feature, module`
- Additional language: `und, der, die` (German)
- Personal: Terms generic in your workflow

### Quality Filter

**What:** Filters by comprehensive score: (R×20) + (D×4) + (P×1)  
**Default:** 0% (adaptive)  
**Impact:** Filtering (primary)  

**Levels:**
- 0%: Adaptive (recommended)
- 1-25%: Permissive
- 26-50%: Balanced  
- 51-75%: Strict
- 76-100%: Very strict

### Minimum Relevance Score

**What:** Additional filter requiring keyword match quality  
**Default:** 0% (disabled)  
**Impact:** Filtering (secondary, after quality filter)  

**When to use:** Urgent tasks with weak keywords passing quality filter  
**Max value:** Auto-updates with core keyword bonus (core + 1.0)  
**Note:** Only applies to keyword queries

### Scoring Coefficients

**What:** Weight of each factor in final score  
**Defaults:** R: 20, D: 4, P: 1 (Max: 31 points)  
**Impact:** Filtering, Scoring, Sorting  

**Common adjustments:**
- Urgency-focused: R:15, D:10, P:5
- Importance-focused: R:15, D:3, P:10
- Balanced: R:10, D:10, P:10
- Keyword-focused: R:30, D:2, P:1

### Sub-Coefficients

**Core Keyword Match Bonus (0.0-1.0, default: 0.2)**
- Bonus for exact query matches vs semantic expansions
- 0.0: Pure semantic search (all equal)
- 0.5: Strong preference for exact terms

**Due Date Scores (0.0-10.0):**
- Overdue: 1.5 (most urgent)
- Within 7 days: 1.0
- Within 1 month: 0.5
- Later: 0.2
- None: 0.1

**Priority Scores (0.0-1.0):**
- P1: 1.0, P2: 0.75, P3: 0.5, P4: 0.2, None: 0.1

### Task Display Limits

- **Max direct results (20):** Simple/Smart Search display
- **Max tasks for AI (100):** Context sent to AI
- **Max recommendations (20):** AI's recommended limit

### Property Terms

**What:** Help AI recognize properties in different languages  
**Built-in:** English, Chinese, Swedish  
**Impact:** AI parsing (Smart Search & Task Chat)  

**Add when:** Your language not covered, domain-specific terms

### Sort Order

**What:** Tiebreaker for equal comprehensive scores  
**Default:** [relevance, dueDate, priority]  
**Impact:** Sorting (secondary only)  

**Note:** Coefficients determine importance, NOT sort order!

---

## Common Scenarios

### 1. Too Many Irrelevant Results

**Problem:** Query "Fix bug" → 500 tasks including "task manager"  

**Solutions:**
1. Add custom stop words: `task, work, item`
2. Increase quality filter: 20%
3. Add minimum relevance: 30%

### 2. Urgent Tasks Overwhelming Keywords

**Problem:** Query "Implement feature" → Overdue docs/meetings appear  

**Solution:** Minimum Relevance Score → 30-40%

### 3. Keywords Dominate Too Much

**Problem:** Overdue P1 tasks buried in keyword matches  

**Solution:** Adjust coefficients  
- Relevance: 20 → 15 (decrease)
- Due Date: 4 → 8 (increase)
- Priority: 1 → 3 (increase)

### 4. Domain-Specific Generic Terms

**Problem:** Software development - "plugin" matches everything  

**Solution:** Add to stop words: `plugin, feature, module, component`

---

## Troubleshooting

### No/Few Results
- Quality filter too strict → Decrease to 0-20%
- Minimum relevance too high → Decrease or disable
- Properties-only query → Minimum relevance skipped (by design)

### Wrong Tasks Appearing
- Generic keywords → Add custom stop words
- Urgent tasks overwhelming → Add minimum relevance (30-40%)
- Quality filter too permissive → Increase to 10-30%

### Wrong Task Order
- Check scoring coefficients (R, D, P)
- Check sub-coefficients (urgency/importance curves)
- Remember: Primary sort is score, sort order is tiebreaker only

### Task Chat Recommends Too Few
- Quality filter too strict → Decrease
- Max tasks for AI too low → Increase to 100-150
- Max recommendations too low → Increase to 20-30

---

## Best Practices

1. **Start with defaults** - Try queries first!
2. **Adjust incrementally** - Change one setting at a time
3. **Use reset buttons** - Quick recovery from experiments
4. **Check console logs** - See detailed score breakdowns
5. **Refer to descriptions** - Each setting explains its impact

For detailed examples and advanced configurations, see the main README.
