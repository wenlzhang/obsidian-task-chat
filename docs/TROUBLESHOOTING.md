# Troubleshooting Guide

**Topic:** Common issues, solutions, and debugging tips

**Related Documentation:**
- [← Back to README](../README.md)
- [Complete Settings Guide](SETTINGS_GUIDE.md)
- [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md)
- [Model Selection Guide](MODEL_SELECTION_GUIDE.md)
- [Chat Modes](CHAT_MODES.md)

---

## Quick Navigation

- [AI Query Parser Errors](#ai-query-parser-errors) ⚠️ **Start Here**
- [No Results Found](#no-results-found) 🔍 **Common Issue**
- [AI Model Format Issues](#ai-model-format-issues)
- [Search Results Issues](#search-results-issues)
- [Connection Issues](#connection-issues)
- [Performance Issues](#performance-issues)

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

1. **Reduce Max Response Tokens** (Recommended)
   - Go to: Settings → AI Provider → [Your Provider] → Max response tokens
   - Current value shown in error (e.g., 10000)
   - Try these values:
     - OpenAI models: 1000-4000 tokens
     - Claude models: 1000-4000 tokens
     - Ollama models: 1000-2000 tokens

2. **Clear Chat History**
   - Click "New Session" button in Task Chat
   - Or: Settings → Task Chat → Chat history context length → Reduce to 2-3

3. **Switch to Model with Larger Context**
   - OpenAI: gpt-4o-mini (128K context)
   - Anthropic: claude-3-5-sonnet (200K context)
   - Settings → AI Provider → Model

**Understanding Context vs Response Tokens:**

| Setting | What It Controls | Where to Find |
|---------|------------------|---------------|
| **Max Response Tokens** | How many tokens AI can generate in its response | Settings → AI Provider → Max response tokens |
| **Context Window** | Total tokens AI can process (input + output) | Model specification (read-only info) |

**Example:**
- Model: gpt-4o-mini (128K context window)
- Your setting: Max response tokens = 10000
- If your query + chat history = 120K tokens
- Then: 120K + 10K = 130K > 128K ❌ Error!
- Solution: Reduce max response tokens to 4000 or clear chat history

#### 2. Model Not Found

**Error:**
```
The model 'gpt-5-turbo' does not exist
```

**What it means:**
The model name in settings doesn't match any available model from the provider.

**Solutions:**

1. **Check Model Name**
   - Settings → AI Provider → Model
   - Common typos: "gpt-4o-mini" vs "gpt4-o-mini"
   - Case-sensitive for some providers

2. **Verify Available Models**
   - OpenAI: gpt-4o-mini, gpt-4o, gpt-4-turbo
   - Anthropic: claude-3-5-sonnet, claude-3-opus, claude-3-haiku
   - OpenRouter: Varies (check openrouter.ai/models)
   - Ollama: Run `ollama list` to see installed models

3. **Pull Model (Ollama Only)**
   ```bash
   ollama pull llama3.1
   ollama pull qwen2.5
   ```

#### 3. Invalid API Key

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

#### 4. Rate Limit Exceeded

**Error:**
```
Rate limit exceeded. Please try again later.
```

**What it means:**
You've made too many requests in a short time period.

**Solutions:**

1. **Wait and Retry**
   - Free tier: Wait 1-5 minutes
   - Paid tier: Wait 10-30 seconds

2. **Upgrade Plan**
   - OpenAI: Upgrade to Tier 2+ for higher limits
   - Anthropic: Upgrade plan for higher RPM

3. **Switch Provider**
   - Try OpenRouter (aggregates multiple providers)
   - Or switch between OpenAI/Anthropic

#### 5. Server Error (500/503)

**Error:**
```
The server had an error while processing your request
```

**What it means:**
Provider's server is experiencing issues or overloaded.

**Solutions:**

1. **Retry After Short Wait**
   - Usually temporary (1-5 minutes)

2. **Switch Provider**
   - Use alternative provider as backup
   - OpenRouter often more stable (uses multiple backends)

3. **Check Provider Status**
   - OpenAI: status.openai.com
   - Anthropic: status.anthropic.com

#### 6. Ollama Connection Failed

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
   - Uses character-level keywords (e.g., [如, 何, 提, 高])
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
   - Recommended values:
     - GPT-4o-mini: 2000-4000 tokens
     - Claude-3-5-Sonnet: 2000-4000 tokens  
     - Ollama models: 1000-2000 tokens

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

#### 1. Quality Filter Too Strict

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

**Recommended Values:**
- **0%** (Adaptive): Let system auto-adjust (recommended for most users)
- **20-30%**: Balanced - filters obvious irrelevant tasks
- **40-50%**: Strict - only high-quality matches (your current setting)
- **60%+**: Very strict - may eliminate too many tasks

**Example Impact:**
```
With 50% filter:
- Threshold: 20.0 points
- Task score: 10.6
- Result: Filtered out ❌

With 30% filter:
- Threshold: 12.0 points  
- Task score: 10.6
- Result: Still filtered out ❌

With 20% filter:
- Threshold: 8.0 points
- Task score: 10.6
- Result: Passes! ✅
```

#### 2. Minimum Relevance Too High

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

**Recommended Values:**
- **0%** (Disabled): No minimum required (recommended for most queries)
- **20-30%**: Moderate - reasonable keyword match required
- **40-60%**: Strict - strong keyword match required
- **70%+**: Very strict - near-perfect keyword match (your current setting)

**When to Use High Values:**
- Keyword-heavy queries where you need exact matches
- When you have many tasks and want only perfect matches
- Not recommended for properties-only queries (e.g., "due today")

**When to Disable (0%):**
- Properties-only queries ("priority 1", "overdue tasks")
- Broad semantic searches
- When you're getting zero results

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

**Recommended Values:**
- **Keyword-focused:** R:30, D:5, P:1, S:1
- **Balanced (default):** R:20, D:4, P:1, S:1  
- **Deadline-focused:** R:10, D:20, P:5, S:1
- **Priority-focused:** R:10, D:5, P:15, S:1

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
   - Quality filter threshold
   - Minimum relevance threshold
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

### Understanding the Warning Message

The warning shows you exactly why tasks were filtered:

```
⚠️ No Tasks Found After Filtering

Found 50 matching tasks, but all were filtered out.

Top Task Score: 10.6 points (needed: 20.00) | Relevance: 30%

Why Tasks Were Filtered:
• Quality Filter: 50% threshold eliminates low-scoring tasks 
  (threshold: 20.00/40.0 points)
• Minimum Relevance: 75% threshold requires strong keyword matches
• Tasks are close to threshold but not quite enough

💡 Quick Fixes:
• Lower quality filter to 30% (currently 50%)
• Lower minimum relevance to 30% or disable (currently 75%)

🔧 More Options:
• Simplify your query (remove some filters)
• Check if tasks exist with these criteria
• Review Advanced Scoring settings
```

**What each part means:**

- **Found X matching tasks**: Datacore found these tasks with your keywords/properties
- **Top Task Score**: The highest-scoring task (still wasn't enough)
- **Why Tasks Were Filtered**: Lists specific reasons based on YOUR settings
- **Quick Fixes**: Actionable solutions with your current values shown
- **More Options**: Additional troubleshooting steps

### Best Practices to Avoid Zero Results

**For Most Users:**

1. **Use Adaptive Mode (0% quality filter)**
   - Let system auto-adjust thresholds
   - Works for 95% of queries
   - Settings → Task Filtering → Quality filter strength → 0%

2. **Disable Minimum Relevance**
   - Only enable for specific use cases
   - Set to 0% by default
   - Settings → Task Filtering → Minimum relevance score → 0%

3. **Use Default Coefficients**
   - R:20, D:4, P:1, S:1
   - Balanced for most queries
   - Settings → Task Scoring → Reset to defaults

**For Power Users:**

1. **Test in Smart Search First**
   - Verify filtering before using Task Chat
   - Adjust settings based on Smart Search results
   - Only use Task Chat when results are good

2. **Use Explicit Filters Carefully**
   - Quality filter > 0% disables adaptive mode
   - System respects your strict settings
   - May result in zero results if too strict

3. **Monitor Your Settings**
   - Quality filter: 0-30% for most queries
   - Minimum relevance: 0% unless needed
   - Relevance coefficient: 20-30 for keywords

4. **Understand Query Types**
   - **Keywords-only** ("fix bug"): Needs high relevance coefficient
   - **Properties-only** ("priority 1"): Disable minimum relevance
   - **Mixed** ("urgent tasks due today"): Balance both

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
   - **Recommended:** GPT-4o, Claude-3.5-Sonnet
   - Larger models more reliable with format
   - Settings → AI Provider → Model

### Common Causes

**1. Model Too Small**
- Models under 7-8B parameters struggle with format requirements
- **Solution:** Use GPT-4o-mini (cloud) or Qwen-14B+ (local)

**2. Response Truncated**
- Model ran out of tokens before finishing
- **Check:** Settings → AI Provider → Max response length
- **Solution:** Increase from 1500 to 3000+ tokens

**3. Too Many Tasks**
- Model overwhelmed by long task list
- **Check:** Settings → Task Chat → Max tasks for AI
- **Solution:** Reduce from 100 to 30-50 tasks

**4. Chat History Too Long**
- Previous messages confuse the model
- **Check:** Settings → Task Chat → Chat history context length
- **Solution:** Reduce from 5 to 2-3 messages

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
• Current: gpt-4o-nano ❌
• Better: gpt-4o-mini ✅
• Best: gpt-4o or claude-3.5-sonnet ✅
```

### Understanding the Warning

```
⚠️ AI Response Format Issue

The AI didn't use the expected task reference format. 
Showing 28 tasks (scored by relevance) instead.

💡 Quick Fixes:
• Try your query again (AI behavior varies)
• Start new session (may help with consistency)  
• Use larger model like GPT-4 (more reliable)

🔧 Debug Info: Model: openai/gpt-4o-nano | Time: 12:25:18
📖 Troubleshooting: AI format issues guide
```

**What this means:**
- **28 tasks shown**: Your results are valid and ranked correctly
- **scored by relevance**: Used comprehensive scoring as fallback
- **Quick Fixes**: Actionable solutions to try
- **Debug Info**: For console log correlation if needed

### Advanced Troubleshooting

**Check Console Logs:**
1. Press `Cmd/Ctrl + Shift + I` to open Developer Tools
2. Look for lines starting with `[Task Chat]`
3. Check for:
   - "Invalid task reference [TASK_X]" warnings
   - "FALLBACK TRIGGERED" messages
   - Task count and scoring information

**Verify Model Configuration:**
- Settings → AI Provider → Test Connection
- Ensure model supports longer responses
- Check token limits match model capabilities

**Test Different Queries:**
- Simple query ("urgent tasks"): Should work better
- Complex query with many filters: May trigger issue more often
- Properties-only query ("priority 1"): Less likely to have issue

### Related Issues

- [AI Query Parser Errors](#ai-query-parser-errors) - If AI parsing fails
- [No Results Found](#no-results-found) - If filtering too strict
- [Performance Issues](#performance-issues) - If responses too slow

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
   - Use English names: "English", "Chinese", "Swedish" (not "Svenska")
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
   - Use faster models: GPT-4o-mini, Claude-3-5-Haiku
   - Trade-off: Speed vs. quality

4. **High Token Count**
   - Disable semantic expansion for simple queries
   - Use Simple Search mode when possible
   - Reduce max response tokens (8000 → 4000)

### Slow Responses (Ollama)

**Causes & Solutions:**

1. **Model Too Large**
   - Use smaller models: 7B-8B instead of 13B-14B
   - Recommended: Qwen3-8B, Llama-3.1-8B

2. **CPU vs GPU**
   - Verify GPU is being used: Check Ollama logs
   - Mac: Ollama uses Metal by default
   - Linux/Windows: Verify CUDA/ROCm setup

3. **System Resources**
   - Close other applications
   - Increase context window if RAM allows
   - See [Ollama Setup Guide](OLLAMA_SETUP.md#performance-tuning)

4. **Model Parameters**
   - Reduce max response tokens: 8000 → 4000
   - Reduce context window: 8192 → 4096
   - See [Model Parameters Guide](MODEL_PARAMETERS.md)

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
   - Too few tasks (<5): Not enough context
   - Too many tasks (>30): Model overwhelmed
   - Sweet spot: 10-20 tasks

3. **Model Selection**
   - Use models known for good summarization
   - Cloud: GPT-4o-mini (balanced), Claude-3-5-Sonnet (best quality)
   - Local: Qwen3-14B+ (good instructions), Llama-3.1-8B+ (decent)

4. **Prompt Configuration**
   - Adjust temperature: Settings → Model Parameters → Temperature (try 0.3-0.5)
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
- **Console Logs:** Include console output when reporting issues

---

**Related Guides:**
- [Model Parameters](MODEL_PARAMETERS.md) - Configure AI behavior
- [Settings Guide](SETTINGS_GUIDE.md) - Complete settings reference
- [Ollama Setup](OLLAMA_SETUP.md) - Local model configuration
- [Chat Modes](CHAT_MODES.md) - Understanding different search modes
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked
