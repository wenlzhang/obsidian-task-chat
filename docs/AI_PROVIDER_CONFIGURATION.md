# AI Provider Configuration Guide

This guide explains the configuration parameters for AI providers (OpenAI, Anthropic, OpenRouter, Ollama).

## 📋 Quick Reference

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| **Temperature** | 0.0 - 2.0 | 0.1 | Controls response randomness |
| **Max Response Tokens** | 2000 - 16000 | 8000 | Maximum length of AI responses |
| **Context Window** | 8000 - 200000 | Varies | Maximum context size model can process |

---

## 🌡️ Temperature

### What It Does
Controls how random or deterministic the AI's responses are.

### Values
- **0.0** - Completely deterministic (same input = same output)
- **0.1** - Very consistent, focused ⭐ **RECOMMENDED**
- **0.5** - Moderate creativity
- **1.0** - Balanced between creativity and consistency
- **2.0** - Maximum creativity and randomness

### Recommended Settings

#### For Smart Search & Task Chat (JSON Output)
```
Temperature: 0.1
```
**Why:** Lower temperature ensures reliable JSON parsing and structured output. Higher values may cause:
- ❌ Invalid JSON format
- ❌ Inconsistent property extraction
- ❌ Unpredictable keyword expansion

#### For Experimental/Creative Use
```
Temperature: 0.5 - 1.0
```
**Use with caution:** May impact Smart Search and Task Chat reliability.

### Impact by Mode

| Mode | Impact | Recommended |
|------|--------|-------------|
| **Simple Search** | None (doesn't use AI) | N/A |
| **Smart Search** | High (JSON parsing) | 0.1 |
| **Task Chat** | High (JSON + responses) | 0.1 |

---

## 📊 Max Response Tokens

### What It Does
Sets the maximum length of AI-generated responses. Affects **BOTH** Smart Search query parsing AND Task Chat responses.

### Values
- **2000** - Minimal (may truncate)
- **8000** - Default ⭐ **RECOMMENDED**
- **12000** - Extended
- **16000** - Maximum

### Why 8000 is Default
- Supports 60 keywords semantic expansion
- Accommodates comprehensive task analysis
- Allows detailed explanations in Task Chat
- Balances performance and cost

### Parameter Names by Provider

| Provider | Parameter Name | Notes |
|----------|---------------|-------|
| **OpenAI** | `max_tokens` | Standard OpenAI API |
| **Anthropic** | `max_tokens` | Same as OpenAI |
| **OpenRouter** | `max_tokens` | OpenAI-compatible |
| **Ollama** | `num_predict` | Different name! |

### When to Increase

**Increase to 12000-16000 if:**
- ✅ You have many configured languages (4+)
- ✅ You want very detailed Task Chat responses
- ✅ You're getting truncated responses
- ✅ Cost is not a primary concern

### When to Decrease

**Decrease to 4000-6000 if:**
- ✅ You want faster responses
- ✅ You want to reduce API costs
- ✅ You only use 1-2 languages
- ✅ You prefer concise responses

### Cost Impact Example

With gpt-4o-mini ($0.150 per 1M output tokens):
- 2000 tokens: $0.0003 per query
- 8000 tokens: $0.0012 per query
- 16000 tokens: $0.0024 per query

---

## 🗂️ Context Window

### What It Does
Sets the maximum total context size (input prompt + response) the model can process.

### Provider Differences

#### OpenAI / Anthropic / OpenRouter
- **Purpose:** Informational only
- **Behavior:** Context window is determined by the selected model
- **Examples:**
  - gpt-4o-mini: 128,000 tokens
  - claude-sonnet-4: 200,000 tokens
  - Model determines actual limit

#### Ollama
- **Purpose:** Actively used as `num_ctx` parameter
- **Behavior:** You MUST configure this correctly
- **Default:** 32,000 tokens
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

### Recommended Settings

#### For Ollama (IMPORTANT!)

**Small models (7B-14B):**
```
Context Window: 8000 - 16000
Max Response Tokens: 4000 - 8000
```

**Medium models (20B-32B):**
```
Context Window: 32000 (default)
Max Response Tokens: 8000
```

**Large models (70B+):**
```
Context Window: 64000+
Max Response Tokens: 8000 - 12000
```

#### For Cloud Providers

**OpenAI:**
```
Context Window: 128000 (gpt-4o-mini)
Max Response Tokens: 8000
```

**Anthropic:**
```
Context Window: 200000 (claude-sonnet-4)
Max Response Tokens: 8000
```

**OpenRouter:**
```
Context Window: Varies by model (see model specs)
Max Response Tokens: 8000
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
- Simplify system prompts

---

## 🔧 Configuration Examples

### Configuration 1: Cost-Optimized
```yaml
Temperature: 0.1
Max Response Tokens: 4000
Context Window: 16000 (Ollama) / 128000 (Cloud)
```
**Best for:** Budget-conscious users, simple queries

### Configuration 2: Balanced (Default) ⭐
```yaml
Temperature: 0.1
Max Response Tokens: 8000
Context Window: 32000 (Ollama) / 128000+ (Cloud)
```
**Best for:** Most users, general usage

### Configuration 3: Maximum Quality
```yaml
Temperature: 0.1
Max Response Tokens: 12000
Context Window: 64000 (Ollama) / 200000 (Cloud)
```
**Best for:** Complex queries, detailed analysis

### Configuration 4: Ollama Small Model
```yaml
Temperature: 0.1
Max Response Tokens: 4000
Context Window: 8000
```
**Best for:** 7B-14B models with limited memory

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
3. ✅ Use shorter system prompts

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
3. ✅ Use a faster/smaller model

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
- Default model: **gpt-oss:20b**

---

## 🎯 Summary

### Key Takeaways

1. **Temperature 0.1** is essential for Smart Search and Task Chat reliability
2. **Max Response Tokens 8000** is the sweet spot for most users
3. **Context Window** matters primarily for Ollama users
4. **Always ensure:** Input + Response ≤ Context Window
5. **When in doubt:** Use default settings (they're optimized!)

### Quick Decision Tree

```
Are you using Ollama?
├─ Yes → Configure context window carefully
│   ├─ Small model (7B-14B) → 8000-16000
│   ├─ Medium model (20B-32B) → 32000
│   └─ Large model (70B+) → 64000+
└─ No → Context window is informational only

Do you need detailed responses?
├─ Yes → Max tokens 12000-16000
└─ No → Max tokens 4000-8000 (faster & cheaper)

Experiencing issues?
├─ JSON errors → Temperature 0.1
├─ Truncation → Increase max tokens
├─ Context errors → Reduce window or tokens
└─ Slow → Reduce tokens or use smaller model
```

---

## 🔗 Related Documentation

- [Model Selection Guide](MODEL_SELECTION_GUIDE.md) - Choose the right model for your needs
- [Ollama Setup Guide](OLLAMA_SETUP.md) - Complete installation and configuration
- [Chat Modes Guide](CHAT_MODES.md) - Understand the three modes
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked and filtered
- [Settings Guide](SETTINGS_GUIDE.md) - All configuration options
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
