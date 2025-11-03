# AI Provider Configuration Guide

This guide explains the configuration parameters for AI providers (OpenAI, Anthropic, OpenRouter, Ollama).

## 🌡️ Temperature

### What It Does

Controls how random or deterministic the AI's responses are.

### Values

- **0.0** - Completely deterministic (same input = same output)
- **0.1** - Very consistent, focused ⭐ **RECOMMENDED FOR TASK QUERIES**
- **0.5** - Moderate creativity
- **1.0** - Balanced between creativity and consistency
- **2.0** - Maximum creativity and randomness

---

## 📊 Max Response Tokens

### What It Does

Sets the maximum length of AI-generated responses. Affects **BOTH** Smart Search query parsing AND Task Chat responses.

### Parameter Names by Provider

| Provider | Parameter Name | Notes |
|----------|---------------|-------|
| **OpenAI** | `max_tokens` | Standard OpenAI API |
| **Anthropic** | `max_tokens` | Same as OpenAI |
| **OpenRouter** | `max_tokens` | OpenAI-compatible |
| **Ollama** | `num_predict` | Different name! |

---

## 🗂️ Context Window

### What It Does

Sets the maximum total context size (input prompt + response) the model can process.

### Provider Differences

#### OpenAI / Anthropic / OpenRouter

- **Purpose:** Informational only
- **Behavior:** Context window is determined by the selected model

#### Ollama

- **Purpose:** Actively used as `num_ctx` parameter
- **Important:** This is sent to Ollama API

### Critical Relationship

```
Input Prompt + Max Response Tokens ≤ Context Window
```

**Example:**
```
Input prompt: ~5000 tokens (large task list + system prompt)
Max response: 8000 tokens
Required context window: ≥13000 tokens
```

### Troubleshooting Context Length Errors

If you get errors like "context length exceeded":

**Option 1: Reduce Context Window (Ollama only)**
```
Try: 32000 → 24000 → 16000
```

**Option 2: Reduce Max Response Tokens**
```
Try: 8000 → 6000 → 4000
```

**Option 3: Reduce Input Size**
- Decrease max chat history
- Use fewer languages in semantic expansion

---

## 🚨 Common Issues

### Issue 1: Invalid JSON Output

**Symptoms:** Smart Search fails with parsing errors

**Solutions:**
1. ✅ Set temperature to 0.1
2. ✅ Ensure max response tokens ≥ 8000
3. ✅ Check model supports JSON output

### Issue 2: Truncated Responses

**Symptoms:** Task Chat responses cut off mid-sentence

**Solutions:**
1. ✅ Increase max response tokens (8000 → 12000)
2. ✅ Reduce input size (fewer chat history messages)

### Issue 3: Context Length Errors (Ollama)

**Symptoms:** "context length exceeded" error

**Solutions:**
1. ✅ Reduce context window (32000 → 16000)
2. ✅ Reduce max response tokens (8000 → 6000)
3. ✅ Use a larger model

### Issue 4: Slow Responses

**Symptoms:** Queries take too long

**Solutions:**
1. ✅ Reduce max response tokens (8000 → 4000)
2. ✅ Reduce context window
3. ✅ Use a faster/more powerful model

---

## 📚 Provider-Specific Documentation

### OpenAI

- Models: https://platform.openai.com/docs/models
- API Reference: https://platform.openai.com/docs/api-reference
- Default model: **gpt-4o-mini**

### Anthropic

- Models: https://docs.anthropic.com/claude/docs/models-overview
- API Reference: https://docs.anthropic.com/claude/reference
- Default model: **claude-sonnet-4**

### OpenRouter

- Models: https://openrouter.ai/models
- Documentation: https://openrouter.ai/docs
- Default model: **openai/gpt-4o-mini**

### Ollama

- Models: https://ollama.com/library
- API Reference: https://github.com/ollama/ollama/blob/main/docs/api.md
- Parameter Guide: https://github.com/ollama/ollama/blob/main/docs/modelfile.md#parameter
- Default model: **qwen3:14b**

---

## 🎯 Summary

### Key Takeaways

1. **Temperature 0.1** is essential for Smart Search and Task Chat query reliability
2. **Max Response Tokens 8000** is the sweet spot for many users
3. **Context Window** matters primarily for Ollama users
4. **Always ensure:** Input + Response ≤ Context Window
5. **When in doubt:** Use default settings (they're optimized!)

---

## 🔗 Related Documentation

- [Model Selection Guide](MODEL_SELECTION_GUIDE.md) - Choose the right model for your needs
- [Ollama Setup Guide](OLLAMA_SETUP.md) - Complete installation and configuration
- [Chat Modes Guide](CHAT_MODES.md) - Understand the three modes
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked and filtered
- [Settings Guide](SETTINGS_GUIDE.md) - All configuration options
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
