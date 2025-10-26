# Troubleshooting Guide

**Topic:** Common issues, solutions, and debugging tips

**Related Documentation:**
- [← Back to README](../README.md)
- [Complete Settings Guide](SETTINGS_GUIDE.md)
- [Model Parameters](MODEL_PARAMETERS.md)
- [Chat Modes](CHAT_MODES.md)

---

## Quick Navigation

- [AI Model Format Issues](#ai-model-format-issues)
- [Search Results Issues](#search-results-issues)
- [Connection Issues](#connection-issues)
- [Performance Issues](#performance-issues)

---

## AI Model Format Issues

### Symptom: Warning "AI Model May Have Failed to Reference Tasks Correctly"

**What happened:**
The AI model did not use the correct Task ID format to reference tasks in its response. Your tasks are still shown below, but the AI summary may be generic.

**Common Causes:**

1. **Model Too Small**
   - Small models (especially those under 7B parameters) struggle with complex format requirements
   - Symptom: Generic advice instead of specific task references

2. **Response Truncated**
   - Model hit token limit before writing task IDs
   - Check: Settings → Task Chat → Max response tokens
   - Solution: Increase max response tokens OR reduce max tasks for AI

3. **Chat History Overload**
   - Too many previous messages overwhelm the model's context window
   - Check: Settings → Task Chat → Chat history context length
   - Solution: Reduce from 5 to 2-3 messages

4. **Task List Too Large**
   - Too many tasks for model to process
   - Check: Settings → Task Chat → Max tasks for AI
   - Solution: Reduce from 30 to 15-20 tasks

**Solutions (In Order of Effectiveness):**

1. **Look at task list below** - tasks are correctly ranked by relevance, due date, and priority
2. **Try Again** - Model behavior has inherent randomness, retry might work
3. **Start New Chat Session** - Clears history that might confuse the model
4. **Adjust Settings**:
   - Reduce max tasks for AI (30 → 15)
   - Reduce chat history length (5 → 2)
   - Increase max response tokens (8000 → 12000)
5. **Switch to Larger Model** - Use models known for reliability:
   - Cloud: GPT-5, Claude Sonnet 4.5
   - Local: Qwen3 (14B+)
6. **Check Model Configuration** - See [Model Parameters Guide](MODEL_PARAMETERS.md)

**When to Use Smart Search Instead:**
- If model fails repeatedly
- If you just need filtered tasks (no AI analysis)
- If you want to save tokens/cost
- Smart Search provides filtered + scored tasks without AI summary

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
3. Check if DataView is enabled in Obsidian settings
4. Verify task properties exist (try: `dataview` code block in a note)

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

## DataView Integration Issues

### "No tasks found" but tasks exist in vault

**Cause:** DataView not properly configured

**Solutions:**
1. Enable DataView plugin in Obsidian
2. Verify task properties exist: Try this in a note:
   ```dataview
   TASK
   WHERE file.path
   ```
3. Check property names: Settings → DataView Integration
   - Default due date fields: `due, dueDate`
   - Default priority fields: `priority, p`
4. Restart Obsidian after enabling DataView

### Tasks missing due dates or priorities

**Cause:** Property names don't match configuration

**Solutions:**
1. Check your task format in notes:
   ```markdown
   - [ ] Task #p1 📅 2025-01-30
   ```
2. Verify DataView extracts properties: Try dataview code block
3. Adjust property names: Settings → DataView Integration
4. See your task manager plugin's documentation (e.g., Task Marker)

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
