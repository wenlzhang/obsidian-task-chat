# Model Token Limits Reference

**Date:** 2024-10-17  
**Purpose:** Comprehensive reference for output token limits across AI models

---

## Overview

Different AI models support vastly different **output token limits**. Understanding these limits helps users configure `maxTokensChat` appropriately.

**Note:** This refers to **OUTPUT tokens** (response length), not context window (input).

---

## OpenAI Models

### GPT-4o Series (Latest, Best)

**gpt-4o** (Released May 2024)
- **Output limit:** 16,384 tokens (~12,288 words)
- **Context window:** 128,000 tokens
- **Cost (input/output):** $2.50 / $10.00 per 1M tokens
- **Best for:** Long detailed analyses, comprehensive reports
- **Recommended setting:** 2000-8000 tokens

**gpt-4o-mini** (Released July 2024)
- **Output limit:** 16,384 tokens (~12,288 words)
- **Context window:** 128,000 tokens
- **Cost (input/output):** $0.15 / $0.60 per 1M tokens
- **Best for:** Most use cases, excellent value
- **Recommended setting:** 1500-4000 tokens

### GPT-4 Turbo Series

**gpt-4-turbo** / **gpt-4-turbo-2024-04-09**
- **Output limit:** 4,096 tokens (~3,072 words)
- **Context window:** 128,000 tokens
- **Cost (input/output):** $10.00 / $30.00 per 1M tokens
- **Best for:** Complex reasoning, older stable model
- **Recommended setting:** 1500-4000 tokens

**gpt-4-turbo-preview**
- **Output limit:** 4,096 tokens
- **Context window:** 128,000 tokens
- **Status:** Preview version
- **Recommended setting:** 1500-4000 tokens

### GPT-4 Legacy

**gpt-4** / **gpt-4-0613**
- **Output limit:** 8,192 tokens (~6,144 words)
- **Context window:** 8,192 tokens
- **Cost (input/output):** $30.00 / $60.00 per 1M tokens
- **Status:** Legacy, expensive
- **Recommended setting:** 1500-4000 tokens

### GPT-3.5 Series

**gpt-3.5-turbo**
- **Output limit:** 4,096 tokens
- **Context window:** 16,385 tokens
- **Cost (input/output):** $0.50 / $1.50 per 1M tokens
- **Best for:** Budget-conscious, simple tasks
- **Recommended setting:** 1000-2000 tokens

---

## Anthropic Models (Claude)

### Claude 3.5 Series

**claude-3-5-sonnet-20241022** (Latest)
- **Output limit:** 8,192 tokens (~6,144 words)
- **Context window:** 200,000 tokens
- **Cost (input/output):** $3.00 / $15.00 per 1M tokens
- **Best for:** Excellent reasoning, coding, analysis
- **Recommended setting:** 2000-6000 tokens

**claude-3-5-sonnet-20240620**
- **Output limit:** 8,192 tokens
- **Context window:** 200,000 tokens
- **Status:** Previous version
- **Recommended setting:** 2000-6000 tokens

### Claude 3 Series

**claude-3-opus-20240229**
- **Output limit:** 4,096 tokens (~3,072 words)
- **Context window:** 200,000 tokens
- **Cost (input/output):** $15.00 / $75.00 per 1M tokens
- **Best for:** Most capable, but expensive
- **Recommended setting:** 1500-4000 tokens

**claude-3-sonnet-20240229**
- **Output limit:** 4,096 tokens
- **Context window:** 200,000 tokens
- **Cost (input/output):** $3.00 / $15.00 per 1M tokens
- **Best for:** Balanced performance and cost
- **Recommended setting:** 1500-4000 tokens

**claude-3-haiku-20240307**
- **Output limit:** 4,096 tokens
- **Context window:** 200,000 tokens
- **Cost (input/output):** $0.25 / $1.25 per 1M tokens
- **Best for:** Fast, cheap responses
- **Recommended setting:** 1000-2000 tokens

---

## OpenRouter Models

OpenRouter provides access to many models. Here are popular ones:

### OpenAI via OpenRouter

**openai/gpt-4o**
- Same as OpenAI: 16,384 tokens output
- **Recommended setting:** 2000-8000 tokens

**openai/gpt-4o-mini**
- Same as OpenAI: 16,384 tokens output
- **Recommended setting:** 1500-4000 tokens

### Anthropic via OpenRouter

**anthropic/claude-3.5-sonnet**
- Same as Anthropic: 8,192 tokens output
- **Recommended setting:** 2000-6000 tokens

### Meta Llama Models

**meta-llama/llama-3.1-405b-instruct**
- **Output limit:** 4,096 tokens
- **Context window:** 128,000 tokens
- **Recommended setting:** 1500-4000 tokens

**meta-llama/llama-3.1-70b-instruct**
- **Output limit:** 4,096 tokens
- **Context window:** 128,000 tokens
- **Recommended setting:** 1500-4000 tokens

**meta-llama/llama-3.1-8b-instruct**
- **Output limit:** 4,096 tokens
- **Context window:** 128,000 tokens
- **Recommended setting:** 1000-2000 tokens

### Google Gemini Models

**google/gemini-pro-1.5**
- **Output limit:** 8,192 tokens
- **Context window:** 2,097,152 tokens (2M!)
- **Recommended setting:** 2000-6000 tokens

**google/gemini-flash-1.5**
- **Output limit:** 8,192 tokens
- **Context window:** 1,048,576 tokens (1M)
- **Recommended setting:** 2000-6000 tokens

---

## Ollama Models (Local)

### Llama 3.2 Series

**llama3.2:3b**
- **Output limit:** ~2,048 tokens (configurable)
- **Context window:** 128,000 tokens
- **Recommended setting:** 1000-2000 tokens

**llama3.2:1b**
- **Output limit:** ~2,048 tokens (configurable)
- **Context window:** 128,000 tokens
- **Recommended setting:** 1000-2000 tokens

### Llama 3.1 Series

**llama3.1:8b**
- **Output limit:** ~4,096 tokens (configurable)
- **Context window:** 128,000 tokens
- **Recommended setting:** 1500-3000 tokens

**llama3.1:70b**
- **Output limit:** ~4,096 tokens (configurable)
- **Context window:** 128,000 tokens
- **Recommended setting:** 1500-4000 tokens

### Other Popular Local Models

**mistral:7b**
- **Output limit:** ~2,048 tokens
- **Context window:** 32,768 tokens
- **Recommended setting:** 1000-2000 tokens

**phi3:mini**
- **Output limit:** ~2,048 tokens
- **Context window:** 128,000 tokens
- **Recommended setting:** 1000-2000 tokens

**qwen2.5:7b**
- **Output limit:** ~4,096 tokens
- **Context window:** 32,768 tokens
- **Recommended setting:** 1500-3000 tokens

---

## Recommended Slider Settings

### Current Implementation (Good!)

**User's current settings:**
- **Range:** 500-16,000 tokens
- **Default:** 2,000 tokens (increased from 1500)
- **Fallback:** 2,000 tokens

**Why this is good:**
- ✅ 16,000 covers GPT-4o and GPT-4o-mini (16,384 max)
- ✅ 500 minimum allows very concise responses
- ✅ 2,000 default is better for detailed responses
- ✅ Most models support at least 4,096

### Model-Specific Recommendations

**For GPT-4o / GPT-4o-mini users:**
- Use: 2,000-8,000 tokens
- These models can handle very long responses
- Great for detailed analysis

**For Claude 3.5 Sonnet users:**
- Use: 2,000-6,000 tokens
- 8,192 token limit
- Excellent for comprehensive answers

**For GPT-4-turbo / Claude 3 users:**
- Use: 1,500-4,000 tokens
- 4,096 token limit for most variants
- Still plenty for good responses

**For Local models (Ollama) users:**
- Use: 1,000-2,000 tokens
- Most local models: 2,048-4,096 limits
- Faster generation with lower values

**For Budget users:**
- Use: 1,000-1,500 tokens
- Reduces cost significantly
- Still get useful responses

---

## Cost vs Length Trade-offs

### Example with GPT-4o-mini ($0.60/1M output tokens)

**Daily usage: 50 queries**

| Setting | Words/Response | Per Query | Daily | Monthly |
|---------|----------------|-----------|-------|---------|
| 1,000 | ~750 words | $0.0006 | $0.03 | **$0.90** |
| 2,000 | ~1,500 words | $0.0012 | $0.06 | **$1.80** |
| 4,000 | ~3,000 words | $0.0024 | $0.12 | **$3.60** |
| 8,000 | ~6,000 words | $0.0048 | $0.24 | **$7.20** |
| 16,000 | ~12,000 words | $0.0096 | $0.48 | **$14.40** |

**Key insight:** Doubling tokens doubles cost!

### Example with Claude 3.5 Sonnet ($15/1M output tokens)

**Daily usage: 50 queries**

| Setting | Words/Response | Per Query | Daily | Monthly |
|---------|----------------|-----------|-------|---------|
| 2,000 | ~1,500 words | $0.0300 | $1.50 | **$45.00** |
| 4,000 | ~3,000 words | $0.0600 | $3.00 | **$90.00** |
| 6,000 | ~4,500 words | $0.0900 | $4.50 | **$135.00** |
| 8,000 | ~6,000 words | $0.1200 | $6.00 | **$180.00** |

**Key insight:** Claude is more expensive, watch your token usage!

---

## How to Choose

### Questions to Ask Yourself

**1. Which model are you using?**
- GPT-4o/4o-mini → Can go up to 8,000+
- Claude 3.5 → Can go up to 6,000
- GPT-4-turbo → Keep under 4,000
- Local models → Keep under 2,000

**2. What do you need?**
- Quick checks → 1,000 tokens
- Daily task analysis → 2,000 tokens
- Detailed reports → 4,000-6,000 tokens
- Comprehensive analysis → 8,000+ tokens

**3. What's your budget?**
- Very cost-conscious → 1,000 tokens
- Balanced → 2,000 tokens (new default)
- Money not an issue → 4,000+ tokens

**4. How fast do you need responses?**
- Fast → Lower tokens (1,000-2,000)
- Don't care → Higher tokens okay

---

## Technical Details

### Output Tokens vs Context Window

**Output tokens:** Maximum response length
- What the AI can **return** to you
- What `max_tokens` controls
- What you pay for as "output"

**Context window:** Maximum input + output combined
- How much the AI can **process**
- Includes: prompt + history + tasks + response
- Larger = can analyze more tasks at once

**Example: GPT-4o**
- Context: 128,000 tokens (can process huge inputs)
- Output: 16,384 tokens (response length limit)
- Your setting: Controls output only

### Why Not Set to Maximum Always?

**Reasons to keep it lower:**

1. **Cost:** More tokens = more money
2. **Speed:** Longer responses take more time
3. **Quality:** Focused responses often better than verbose
4. **Necessity:** Most questions don't need 16,000 tokens

**When to increase:**
- Complex analysis needed
- Multiple questions at once
- Detailed explanations required
- Learning/educational purposes

---

## Settings Tab Guidance

### What to Tell Users

**In settings description:**
```
"Different models support different maximum output tokens:
• GPT-4o/4o-mini: Up to 16,384 tokens (use 2000-8000)
• Claude 3.5 Sonnet: Up to 8,192 tokens (use 2000-6000)
• GPT-4-turbo: Up to 4,096 tokens (use 1500-4000)
• Local models: Typically 2,048-4,096 (use 1000-2000)

Check your model's specifications for exact limits.
Setting above model limit may cause errors or truncation."
```

---

## Summary

**Recommended slider range:** 500-16,000 ✅ (already implemented!)  
**Recommended default:** 2,000 ✅ (already implemented!)  
**Most common limit:** 4,096 tokens (older models)  
**Best modern models:** 8,192-16,384 tokens  
**Local models:** 2,048-4,096 tokens  

**User's current implementation is excellent!** 🎉

The 500-16,000 range covers:
- ✅ All modern OpenAI models (16,384)
- ✅ All Anthropic models (4,096-8,192)
- ✅ All local models (2,048-4,096)
- ✅ Budget users (500-1,000)
- ✅ Power users (8,000-16,000)

**Only consideration:** Document model-specific limits in settings and README!
