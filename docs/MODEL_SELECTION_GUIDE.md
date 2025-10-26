# Model Selection Guide

> **⚠️ IMPORTANT:** Model performance varies significantly between users depending on hardware, system configuration, query complexity, and individual use cases. The ratings and recommendations below are general guidelines based on testing, not guarantees. Always test models yourself to determine what works best for your specific needs.

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
✅ **Privacy is critical** - Data never leaves your computer  
✅ **Cost is a concern** - Zero API fees  
✅ **Offline work needed** - No internet required  
✅ **Learning/experimenting** - Safe to test freely  

### Use Cloud (OpenAI/Anthropic/OpenRouter) When:
✅ **Speed is critical** - Faster responses  
✅ **Reliability needed** - More consistent format compliance  
✅ **Complex queries** - Better reasoning capabilities  
✅ **Production environment** - Proven track record  

---

## Default Models by Provider

| Provider | Default Model | Context Window | Best For |
|----------|---------------|----------------|----------|
| **OpenAI** | gpt-4o-mini | 128K tokens | Speed, cost, quality balance |
| **Anthropic** | claude-sonnet-4 | 200K tokens | Large context, complex analysis |
| **OpenRouter** | openai/gpt-4o-mini | Varies | Access to multiple providers |
| **Ollama** | gpt-oss:20b | User-configured | Privacy, offline, free |

---

## Recommended Models by Provider

> **Note:** Performance ratings are subjective and may not reflect your experience. Test multiple models to find what works best for you.

### Cloud Providers (Paid)

#### OpenAI
- **gpt-4o-mini** ⭐⭐⭐⭐⭐ - Excellent balance of speed, cost, and quality (default)
- **gpt-5-mini** ⭐⭐⭐⭐⭐ - Good balance of speed, cost, and quality
- **gpt-5-nano** ⭐⭐⭐⭐ - Still being evaluated

**Pricing:** Very competitive, typically $0.150-0.600 per 1M tokens

**Best for:** Most users, production environments, reliability

#### Anthropic
- **claude-sonnet-4** ⭐⭐⭐⭐⭐ - Large context window, excellent reasoning (default)
- **claude-3-5-sonnet** ⭐⭐⭐⭐ - Previous generation, still very capable
- **claude-3-haiku** ⭐⭐⭐ - Faster, lower cost

**Pricing:** Competitive, similar to OpenAI

**Best for:** Complex analysis, large context needs, detailed responses

#### OpenRouter (Multiple Models)
- **openai/gpt-4o-mini** - Access to OpenAI models through unified API (default)
- **anthropic/claude-sonnet-4** - Access to Anthropic models
- **Various others** - Access models from different providers

**Pricing:** Varies by model, typically includes small markup

**Best for:** Flexibility, accessing multiple providers with one API key

### Local (Ollama - Free)

> **⚠️ Hardware-Dependent:** Performance varies greatly based on your GPU. Ratings below assume modern hardware (M-series Mac, recent NVIDIA GPU, or powerful CPU).

#### Qwen3 Series (Tested, Good Instruction Following)
- **qwen3:8b** ⭐⭐⭐ - Fast, reasonable quality, good starting point
  - RAM: ~8GB
  - Speed: Fast
  - Quality: Good for basic queries
  
- **qwen3:14b** ⭐⭐⭐⭐ - Balanced, good for most users
  - RAM: ~12GB
  - Speed: Moderate
  - Quality: Very good
  
- **qwen3:32b** ⭐⭐⭐⭐ - High quality, slower, needs more RAM
  - RAM: ~24GB
  - Speed: Slower
  - Quality: Excellent

#### Gemma Series
- **gemma-3:12b-it** ⭐⭐⭐ - Moderate size and performance
  - RAM: ~12GB
  - Speed: Moderate
  - Quality: Good
  
- **gemma-3:27b-it** ⭐⭐⭐⭐ - Larger, potentially better quality
  - RAM: ~20GB
  - Speed: Slower
  - Quality: Very good

#### Other Options
- **DeepSeek-R1** - Various sizes available, good reasoning
- **GLM** - Alternative option, solid performance
- **gpt-oss:20b** - Default model, balanced (default)

**See [Ollama Setup Guide](OLLAMA_SETUP.md) for installation and configuration.**

---

## Model Selection Decision Tree

```
Is privacy critical?
├─ Yes → Use Ollama (local)
└─ No → Continue

Is cost a major concern?
├─ Yes → Use Ollama (free)
└─ No → Continue

Do you need maximum reliability?
├─ Yes → Use OpenAI (gpt-4o-mini) or Anthropic (claude-sonnet-4)
└─ No → Continue

Do you need offline capability?
├─ Yes → Use Ollama
└─ No → Use Cloud providers

Do you have powerful hardware?
├─ Yes → Ollama 32B+ models OR Cloud
└─ No → Ollama 8B-14B models OR Cloud (faster)
```

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
| Invalid JSON | Temperature not 0.1 | Set temperature to 0.1 |
| Context exceeded | Input + response > context | Reduce tokens or increase window |

---

## Hardware Requirements (Ollama)

### Minimum Requirements
- **RAM:** 8GB for 7B-8B models
- **Storage:** 5-20GB per model
- **CPU:** Modern multi-core processor
- **GPU:** Optional but recommended for speed

### Recommended Configuration
- **RAM:** 16GB+ for 14B-20B models, 32GB+ for 32B+ models
- **GPU:** 
  - Apple: M1/M2/M3 series (8GB+ unified memory)
  - NVIDIA: RTX 3060+ (12GB+ VRAM)
  - AMD: RX 6800+ (12GB+ VRAM)
- **Storage:** SSD for faster model loading

### Performance Tips
- **Smaller models:** Faster but less capable (good for Simple/Smart Search)
- **Larger models:** Slower but more capable (better for Task Chat)
- **GPU acceleration:** 5-10x faster than CPU-only
- **RAM matters:** More RAM = can run larger models

---

## Cost Comparison

### Cloud Providers (per 1,000 queries, avg 10K tokens each)

**OpenAI (gpt-4o-mini):**
- Input: ~$0.75 (5K tokens × $0.150/M)
- Output: ~$0.75 (5K tokens × $0.150/M)
- **Total: ~$1.50**

**Anthropic (claude-sonnet-4):**
- Input: ~$1.50 (5K tokens × $0.300/M)
- Output: ~$1.50 (5K tokens × $0.300/M)
- **Total: ~$3.00**

**OpenRouter:**
- Similar to base providers plus small markup
- **Total: ~$2-4**

### Ollama (Local)
- **Total: $0** (after initial setup)
- One-time cost: Hardware (optional GPU upgrade)
- Electricity: Negligible for most users

---

## Migration Path

### Starting Out
1. **Try Simple Search first** - Free, no AI needed
2. **If you like it, try Smart Search** - Test with Ollama (free)
3. **If you need more, try Task Chat** - Start with Ollama, upgrade to cloud if needed

### Scaling Up
1. **Start local:** Ollama with smaller models (8B-14B)
2. **Test cloud:** Try OpenAI gpt-4o-mini for comparison
3. **Optimize:** Tune settings before upgrading models
4. **Scale:** Larger Ollama models OR switch to cloud permanently

### Hybrid Usage
- **Development/testing:** Ollama (unlimited free testing)
- **Production/important:** Cloud providers (reliability)
- **Personal/private:** Ollama (data stays local)
- **Team/work:** Cloud providers (consistency across users)

---

## 🔗 Related Documentation

- [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md) - Temperature, tokens, context window
- [Ollama Setup Guide](OLLAMA_SETUP.md) - Complete installation and configuration
- [Chat Modes Guide](CHAT_MODES.md) - Understand the three modes
- [Scoring System](SCORING_SYSTEM.md) - How tasks are ranked and filtered
- [Settings Guide](SETTINGS_GUIDE.md) - All configuration options
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
