# Troubleshooting Guide

**Topic:** Common issues, solutions, and debugging tips

**Related Documentation:**
- [← Back to README](../README.md)
- [Complete Settings Guide](SETTINGS_GUIDE.md)
- [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md)
- [Model Selection Guide](MODEL_SELECTION_GUIDE.md)
- [Chat Modes](CHAT_MODES.md)

---

## AI Query Parser Errors

### Symptom: Warning "⚠️ AI Query Parser Failed"

**What happened:**
The AI failed to parse your query in Smart Search or Task Chat mode. The plugin automatically falls back to Simple Search mode (character-level keywords + regex).

**Common Error Messages:**

#### 1. Context Length Exceeded

**Error:**
```
Maximum context length is 8192 tokens, but you requested 10000 tokens
```

**What it means:**
Your current "Max response tokens" setting is higher than the model's context window limit.

**Solutions (in order of effectiveness):**

1. **Reduce Max Response Tokens**
   - Go to: Settings → AI Provider → [Your Provider] → Max response tokens
   - Current value shown in error (e.g., 10000)
2. **Clear Chat History**
   - Click "New Session" button in Task Chat
   - Or: Settings → Task Chat → Chat history context length → Reduce to 2-3
3. **Switch to Model with Larger Context**
s
**Understanding Context vs Response Tokens:**

| Setting | What It Controls | Where to Find |
|---------|------------------|---------------|
| **Max Response Tokens** | How many tokens AI can generate in its response | Settings → AI Provider → Max response tokens |
| **Context Window** | Total tokens AI can process (input + output) | Model specification (read-only info) |

#### 2. Invalid API Key

**Error:**
```
Incorrect API key provided
```

**What it means:**
Your API key is missing, incorrect, or expired.

**Solutions:**

1. **Update API Key**
   - Settings → AI Provider → [Your Provider] → API Key
   - Check for extra spaces before/after key
   - Verify key is active in provider dashboard
2. **Regenerate Key**
   - Go to provider dashboard (platform.openai.com, console.anthropic.com, etc.)
   - Generate new API key
   - Update in plugin settings
3. **Check Provider Selection**
   - Ensure Settings → AI Provider matches your API key
   - OpenAI key won't work with Anthropic, etc.

#### 3. Server Error (500/503)

**Error:**
```
The server had an error while processing your request
```

**What it means:**
Provider's server is experiencing issues or overloaded.

**Solutions:**

1. **Retry After Short Wait**
2. **Switch Provider**
   - Use alternative provider as backup
   - OpenRouter often more stable (uses multiple backends)
3. **Check Provider Status**
   - OpenAI: status.openai.com
   - Anthropic: status.anthropic.com

#### 4. Ollama Connection Failed
s
**Error:**
```
Cannot connect to Ollama at http://localhost:11434
```

**What it means:**
Ollama server is not running or not accessible.

**Solutions:**

1. **Start Ollama Server**
   ```bash
   ollama serve
   ```
2. **Check Ollama is Running**
   - Open browser: http://localhost:11434
   - Should see "Ollama is running"
3. **Verify Model is Installed**
   ```bash
   ollama list
   ollama pull llama3.1  # If not installed
   ```
4. **Check Endpoint**
   - Settings → AI Provider → Ollama → API Endpoint
   - Default: http://localhost:11434/api/chat

### What Happens During Fallback?

When AI Query Parser fails, the plugin automatically:

1. **Smart Search Mode:**
   - Falls back to Simple Search parsing
   - Uses character-level keywords
   - Still filters and scores tasks
   - Returns relevant results without AI expansion
2. **Task Chat Mode:**
   - Falls back to Simple Search parsing
   - Filters tasks with character-level keywords
   - Still sends tasks to AI for analysis
   - You get AI response + filtered task list

**UI Message:**
```
⚠️ AI Query Parser Failed

Model: openai/gpt-4o-mini
Error: Maximum context length exceeded

💡 Solution: [Specific solution based on error type]

✓ Using fallback: Simple Search mode (regex + character-level keywords)

Found 28 matching task(s)
```

### Preventing Future Errors

**Best Practices:**

1. **Configure Max Tokens Correctly**
   - Don't set max response tokens higher than model's context window
2. **Manage Chat History**
   - Keep chat history context length at 2-3 messages
   - Start new session for unrelated queries
   - Clear history if responses slow down
3. **Verify Configuration**
   - Test connection: Settings → AI Provider → Test Connection
   - Check model name matches available models
   - Ensure API key is valid and active
4. **Monitor Token Usage**
   - Enable: Settings → Usage Tracking → Show token usage
   - Watch for high token counts
   - Adjust settings if costs too high

---

## No Results Found

### Symptom: Warning "⚠️ No Tasks Found After Filtering"

**What happened:**
Tasks were found matching your query, but they were all filtered out by quality filter or minimum relevance settings.

**How Filtering Works:**

```
Query: "urgent tasks due today"
    ↓
Step 1: Datacore Filter (keyword + property matching)
    → Found 50 matching tasks ✅
    ↓
Step 2: Quality Filter (score threshold)
    → Threshold: 20.00 points (50% of max 40.0)
    → Top task score: 10.6 points
    → Result: 0 tasks pass ❌
    ↓
Step 3: Minimum Relevance Filter (optional)
    → Threshold: 75%
    → Top task relevance: 30%
    → Result: 0 tasks pass ❌
```

### Common Causes & Solutions

#### 1. Minimum Relevance Too High

**Symptom in warning:**
```
Minimum Relevance: 75% threshold requires strong keyword matches
```

**What it means:**
- Your minimum relevance is set to 75%
- Tasks need very strong keyword matches to pass
- Top task only has 30% keyword relevance

**Solutions:**

**Quick Fix:**
- **Settings → Task Filtering → Minimum relevance score**
- Current: 75% → Try: **30%** or **0%** (disable)

**When to Use High Values:**
- Keyword-heavy queries where you need exact matches
- When you have many tasks and want only perfect matches

**When to Disable (0%):**
- Broad semantic searches
- When you're getting zero results

#### 2. Quality Filter Too Strict

**Symptom in warning:**
```
Quality Filter: 50% threshold eliminates low-scoring tasks
(threshold: 20.00/40.0 points)
```

**What it means:**
- Your quality filter is set to 50%
- Maximum possible score is 40.0 points
- Threshold is 50% × 40 = 20.00 points
- Your top task only scored 10.6 points

**Solutions:**

**Quick Fix:**
- **Settings → Task Filtering → Quality filter strength**
- Current: 50% → Try: **30%** or **20%**
- Lower percentage = more permissive filter

#### 3. Low Relevance Coefficient

**Symptom in warning:**
```
Low relevance coefficient (5) reduces keyword match importance
```

**What it means:**
- Your relevance coefficient is set very low (5)
- Default is 20-30
- This significantly reduces the impact of keyword matches on scores

**Solutions:**

**Quick Fix:**
- **Settings → Task Scoring → Main Coefficients → Relevance**
- Current: 5 → Try: **20** (default) or **30**

**Understanding Coefficients:**
```
Score = (Relevance × R) + (DueDate × D) + (Priority × P) + (Status × S)

With R=5, D=2, P=1, S=1:
Task: relevance=0.8, dueDate=1.5, priority=1.0, status=0.8
Score = (0.8 × 5) + (1.5 × 2) + (1.0 × 1) + (0.8 × 1)
      = 4.0 + 3.0 + 1.0 + 0.8 = 8.8 points

With R=20, D=2, P=1, S=1 (default):
Same task would score:
      = 16.0 + 3.0 + 1.0 + 0.8 = 20.8 points ✅ Much higher!
```

#### 4. Tasks Are Close But Not Enough

**Symptom in warning:**
```
Top Task Score: 10.6 points (needed: 20.0)
Tasks are close to threshold but not quite enough
```

**What it means:**
- Your top task is at 53% of the threshold (10.6 / 20.0)
- Tasks are relevant but slightly below cutoff
- Small adjustment needed

**Solutions:**

1. **Lower quality filter slightly:**
   - 50% → 40%: Threshold becomes 16.0 (task still fails)
   - 50% → 30%: Threshold becomes 12.0 (task still fails)
   - 50% → 25%: Threshold becomes 10.0 (task passes! ✅)
2. **Check why score is low:**
   - Weak keyword matches? → Adjust relevance coefficient
   - Missing due dates? → Check task properties
   - Low priority? → Review scoring sub-coefficients

#### 5. Keyword Matches Too Weak

**Symptom in warning:**
```
Keyword matches are too weak (30% < 75% minimum)
```

**What it means:**
- Your task content has weak keyword overlap with query
- Top task only matches 30% of search keywords
- Your minimum threshold requires 75%

**Solutions:**

1. **Lower minimum relevance:**
   - 75% → 30%: Matches your actual task relevance
   - Or set to 0% to disable this filter entirely
2. **Simplify your query:**
   - Remove some keywords
   - Use broader terms
   - Focus on main concepts
3. **Check semantic expansion:**
   - **Settings → Semantic Expansion → Enable**
   - Increases keyword variations
   - Better cross-language matching

**Example:**
```
Query: "urgent important critical high-priority overdue tasks"
Problem: Too many keywords, hard to match all

Better: "urgent overdue tasks"  
Result: Fewer keywords = higher match percentage
```

### Step-by-Step Diagnostic

When you see zero results, check these in order:

1. **Check the warning message** - Shows specific reasons
   - Minimum relevance threshold
   - Quality filter threshold
   - Top task scores
   - Specific settings values
2. **Lower quality filter first:**
   - Settings → Task Filtering → Quality filter strength
   - Try 30% or 20% or 0% (adaptive)
3. **Disable minimum relevance:**
   - Settings → Task Filtering → Minimum relevance score
   - Set to 0%
4. **Check relevance coefficient:**
   - Settings → Task Scoring → Relevance coefficient
   - Should be 20-30 for keyword queries
5. **Review advanced settings:**
   - Settings → Task Scoring → Advanced coefficients
   - Reset to defaults if unsure
6. **Simplify query:**
   - Remove extra filters
   - Use fewer keywords
   - Try basic search first

---

## AI Model Format Issues

### Symptom: Warning "⚠️ AI Response Format Issue"

**What happened:**
The AI didn't use the expected task reference format (`[TASK_1]`, `[TASK_2]`, etc.). Your tasks are still shown below (scored by relevance), but the AI summary may not reference them correctly.

**Example of Issue:**
```
AI wrote: "Focus on urgent tasks first"
Instead of: "Focus on [TASK_2] and [TASK_5] first"
```

**Your tasks are still correctly filtered and ranked** - only the AI summary format is affected.

### Quick Solutions

**Try these in order:**

1. **Use the task list below** ✅
   - Tasks are correctly filtered and ranked
   - Ignore the generic AI summary
   - Trust the scored task list
2. **Try your query again** 🔄
   - AI behavior varies between requests
   - Often works on second attempt
3. **Start new chat session** 🆕
   - Click "New Session" button
   - Clears conversation history
   - May help model stay focused
4. **Switch to larger model** 🚀
   - Larger models more reliable with format
   - Settings → AI Provider → Model

### Common Causes

**1. Model Too Small**
- Models under 7-8B parameters struggle with format requirements

**2. Response Truncated**
- Model ran out of tokens before finishing
- **Check:** Settings → AI Provider → Max response length

**3. Too Many Tasks**
- Model overwhelmed by long task list
- **Check:** Settings → Task Chat → Max tasks for AI

**4. Chat History Too Long**
- Previous messages confuse the model
- **Check:** Settings → Task Chat → Chat history context length

### When This Isn't a Problem

**You can safely ignore this warning when:**
- The task list below is exactly what you need
- You don't need AI analysis/prioritization
- Tasks are correctly filtered and sorted

**Consider using Smart Search mode instead:**
- Provides filtered + scored tasks without AI
- No token cost
- No format issues
- Faster results

### Settings to Adjust

If this happens frequently:

**Reduce Complexity:**
```
Settings → Task Chat:
• Max tasks for AI: 100 → 30
• Chat history: 5 → 2
```

**Increase Response Space:**
```
Settings → AI Provider:
• Max response length: 1500 → 3000
```

**Upgrade Model:**
```
Settings → AI Provider → Model:
• Current: gpt-5-nano ❌
• Better: gpt-5-mini ✅
```

---

## Search Results Issues

### Too Many Results

**Cause:** Quality filter too low or disabled

**Solutions:**
1. Increase quality filter: Settings → Task Filtering → Quality filter strength (try 40-50%)
2. Enable minimum relevance: Settings → Task Filtering → Minimum relevance score (try 30-40%)
3. Adjust max results: Settings → Task Display → Max results (try 20-30)

### Too Few Results

**Cause:** Quality filter too strict or keywords too specific

**Solutions:**
1. Lower quality filter: Settings → Task Filtering → Quality filter strength (try 10-20%)
2. Disable minimum relevance: Settings → Task Filtering → Set to 0%
3. Check if Datacore is enabled in Obsidian settings
4. Verify task properties are being indexed by Datacore

### Results Not Relevant

**Cause:** Scoring coefficients not aligned with your priorities

**Solutions:**
1. Adjust main coefficients: Settings → Task Scoring → Main coefficients
   - Keyword-focused: R:30, D:5, P:1
   - Deadline-focused: R:10, D:20, P:5
   - Priority-focused: R:10, D:5, P:15
2. Customize sub-coefficients: Settings → Task Scoring → Advanced
3. See [Scoring System Guide](SCORING_SYSTEM.md)

### Multilingual Search Not Working

**Cause:** Language not configured or semantic expansion disabled

**Solutions:**
1. Enable semantic expansion: Settings → Semantic Expansion → Toggle on
2. Add languages: Settings → Semantic Expansion → Query languages
3. Increase expansions per language: Settings → Semantic Expansion → Max expansions (try 5-8)
4. See [Semantic Expansion Guide](SEMANTIC_EXPANSION.md)

---

## Connection Issues

### "Invalid API key" or "Unauthorized"

**Cause:** API key not set or incorrect

**Solutions:**
1. Check Settings → AI Provider → API Key
2. Verify key is active in provider dashboard (OpenAI, Anthropic, etc.)
3. Check for extra spaces before/after key
4. Try regenerating key in provider dashboard

### "Connection timeout" or "Network error"

**Cause:** Network issues or provider downtime

**Solutions:**
1. Check internet connection
2. Test connection: Settings → AI Provider → Test Connection button
3. Try different provider (OpenAI, Anthropic, OpenRouter)
4. For Ollama: Verify server is running (`ollama list`)
5. For Ollama: Check CORS configuration - See [Ollama Setup Guide](OLLAMA_SETUP.md)

### Ollama: "Failed to fetch" or CORS Error

**Cause:** Ollama server not configured for browser requests

**Solutions:**
1. Set environment variable:
   ```bash
   # Mac/Linux
   export OLLAMA_ORIGINS="*"
   ollama serve
   
   # Windows
   set OLLAMA_ORIGINS=*
   ollama serve
   ```
2. Verify Ollama is running: `http://localhost:11434` in browser
3. See complete guide: [Ollama Setup](OLLAMA_SETUP.md)

---

## Performance Issues

### Slow Responses (Cloud Providers)

**Causes & Solutions:**

1. **Large Chat History**
   - Reduce: Settings → Task Chat → Chat history context length (5 → 2-3)
   - Saves tokens and response time
2. **Too Many Tasks**
   - Reduce: Settings → Task Chat → Max tasks for AI (30 → 15-20)
   - Faster processing, more focused analysis
3. **Model Selection**
   - Use faster models
   - Trade-off: Speed vs. quality
4. **High Token Count**
   - Disable semantic expansion for simple queries
   - Use Simple Search mode when possible
   - Reduce max response tokens

---

## Task Chat Quality Issues

### AI Summary Not Helpful

**Root Cause:** Task Chat quality depends on Smart Search filtering quality

**How It Works:**
```
User Query
    ↓
Smart Search (filters + scores tasks)
    ↓
High-quality filtered tasks → Good AI summary ✅
Low-quality filtered tasks → Poor AI summary ❌
    ↓
Task Chat (AI analyzes filtered tasks)
```

**Solutions:**

1. **Improve Filtering First** (Most Important!)
   - Adjust quality filter: Settings → Task Filtering
   - Fine-tune scoring: Settings → Task Scoring
   - Test in Smart Search mode first
   - Only use Task Chat when Smart Search results are good
2. **Optimize Task List Size**
3. **Model Selection**
   - Use models known for good summarization
4. **Prompt Configuration**
   - Adjust temperature
   - Increase max tokens if summaries are cut off
   - See [Model Parameters Guide](MODEL_PARAMETERS.md)

**When Smart Search Results Are Poor:**

Don't use Task Chat! Instead:
1. Fix the filtering settings first
2. Verify results in Smart Search mode
3. Once Smart Search results are good, Task Chat will work well

---

## Still Having Issues?

### Debug Steps:

1. **Check Console Logs**
   - Open Developer Tools: `Cmd/Ctrl + Shift + I`
   - Go to Console tab
   - Look for errors or warnings
2. **Test Connection**
   - Settings → AI Provider → Test Connection
   - Verify API key and model availability
3. **Try Different Modes**
   - Simple Search: Test basic functionality
   - Smart Search: Test filtering and scoring
   - Task Chat: Test AI integration
4. **Reset to Defaults**
   - Settings → Advanced → Reset buttons
   - Start with default configuration
   - Gradually adjust settings

### Get Help:

- **GitHub Issues:** [Report a bug or request feature](https://github.com/wenlzhang/obsidian-task-chat/issues)
- **Documentation:** Check other guides for detailed explanations
- **Console Logs:** Include console output when reporting issues (**Remember to remove any sensitive information!**)

---

**Related Guides:**
- [Model Parameters](MODEL_PARAMETERS.md) - Configure AI behavior
- [Settings Guide](SETTINGS_GUIDE.md) - Complete settings reference
- [Ollama Setup](OLLAMA_SETUP.md) - Local model configuration
- [Chat Modes](CHAT_MODES.md) - Understanding different search modes
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked
