# Model Selection Guide

> **⚠️ IMPORTANT:** Model performance varies significantly between users depending on hardware, system configuration, query complexity, and individual use cases. The recommendations below are general guidelines based on testing, not guarantees. Always test models yourself to determine what works best for your specific needs.

## Key Principle: Smart Search Quality Determines Task Chat Quality

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

**Critical:** If Smart Search results are poor, Task Chat will very likely be poor regardless of model quality. Always optimize filtering and scoring first!

---

## When to Use Local (Ollama) vs Cloud

### Use Ollama When:
s
✅ **Privacy is critical** - Data never leaves your computer
✅ **Cost is a concern** - Zero API fees
✅ **Offline work needed** - No internet required
✅ **Learning/experimenting** - Safe to test freely

### Use Cloud (OpenAI/Anthropic/OpenRouter) When:

✅ **Speed is critical** - Faster responses
✅ **Reliability needed** - More consistent format compliance
✅ **Complex queries** - Better reasoning capabilities

---

## General Troubleshooting Approach

### Step 1: Optimize Filtering First (Most Important!)

Before changing models, ensure Smart Search results are good:
- Adjust quality filter strength
- Tune scoring coefficients (relevance, due date, priority)
- Enable semantic expansion as needed
- Add custom stop words if needed

**See:** [Scoring System Guide](SCORING_SYSTEM.md) and [Settings Guide](SETTINGS_GUIDE.md)

### Step 2: Check Model Parameters

- **Temperature:** Must be 0.1 for reliable JSON parsing
- **Max Response Tokens:** Increase if responses are truncated
- **Context Window (Ollama):** Ensure it's large enough for your task list

**See:** [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md)

### Step 3: Test Different Models

- Start with your current model + optimized settings
- If issues persist, try a larger model or cloud provider
- Compare same query across models to identify if model is the bottleneck

### Step 4: Consider Hybrid Approach

- Use Simple Search when AI not needed (fastest, free)
- Use Smart Search with local models for keyword expansion (free)
- Use Task Chat with cloud models for complex analysis (paid but reliable)

---

## Common Issues & Quick Fixes

| Issue | Most Likely Cause | First Step |
|-------|-------------------|------------|
| Too many irrelevant tasks | Relevance threshold too low | Increase relevance threshold |
| Missing relevant tasks | Relevance threshold too high | Decrease relevance threshold |
| AI format errors | Temperature too high or model too small | Set temperature to 0.1, try larger model |
| Slow responses (Ollama) | Model too large for hardware | Use smaller model (14B instead of 32B) |
| Truncated responses | Max response tokens too low | Increase max response tokens |
| Context exceeded | Input + response > context | Reduce tokens or increase window |

---

## 🔗 Related Documentation

- [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md) - Temperature, tokens, context window
- [Ollama Setup Guide](OLLAMA_SETUP.md) - Complete installation and configuration
- [Chat Modes Guide](CHAT_MODES.md) - Understand the three modes
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked and filtered
- [Settings Guide](SETTINGS_GUIDE.md) - All configuration options
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
