# Ollama Setup Guide

Complete guide for setting up and using Ollama with Task Chat plugin.

---

## 📋 What is Ollama?

Ollama is a free, open-source tool that allows you to run large language models (LLMs) locally on your computer. Unlike cloud providers (OpenAI, Anthropic), Ollama models run entirely offline with:

✅ **Zero cost** - No API fees
✅ **Complete privacy** - Data never leaves your computer  
✅ **No internet required** - Works offline
✅ **Full control** - Choose your model and parameters

**Trade-offs:**
- ⚠️ Slower than cloud providers (depends on your hardware)
- ⚠️ Requires good hardware (8GB+ RAM recommended)
- ⚠️ Smaller models may have lower quality outputs

---

## 🚀 Installation

### Step 1: Install Ollama

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download installer from [ollama.com](https://ollama.com)

**Verify installation:**
```bash
ollama --version
```

### Step 2: Pull a Model

Download a model to use with Task Chat:

```bash
# Recommended models (balanced performance)
ollama pull qwen3:14b          # Good balance

# High-quality models (requires more RAM)
ollama pull qwen3:32b          # Better reasoning

# Specialized models
ollama pull deepseek-r1:32b      # Reasoning-focused
ollama pull gpt-oss:20b          # GPT-like responses
```

**Check installed models:**
```bash
ollama list
```

### Step 3: Configure CORS for Obsidian

Ollama needs to allow requests from Obsidian's app protocol.

**macOS (Ollama app):**
```bash
launchctl setenv OLLAMA_ORIGINS "app://obsidian.md*"
```
Then **restart Ollama** from the menu bar.

**macOS (Terminal):**
```bash
OLLAMA_ORIGINS="app://obsidian.md*" ollama serve
```

**Linux:**
Add to `/etc/systemd/system/ollama.service`:
```ini
[Service]
Environment="OLLAMA_ORIGINS=app://obsidian.md*"
```
Then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

**Windows (PowerShell):**
```powershell
$env:OLLAMA_ORIGINS="app://obsidian.md*"
ollama serve
```

### Step 4: Configure in Task Chat

1. Open Task Chat settings
2. Select **AI Provider**: Ollama
3. Set **API Endpoint**: `http://localhost:11434/api/chat` (default)
4. Select **Model**: Choose from your installed models
5. Click **Test connection** to verify

---

## 🎯 Recommended Models by Use Case

### For Balanced Performance (14B-20B parameters) ⭐ RECOMMENDED
| Model | Size | RAM | Speed | Quality | Best For |
|-------|------|-----|-------|---------|----------|
| **qwen3:14b** | 9GB | 12GB | ⚡⚡ | ⭐⭐⭐⭐ | General use |
| **gpt-oss:20b** | 11GB | 16GB | ⚡⚡ | ⭐⭐⭐⭐ | GPT-like |

### For Best Quality (32B-70B parameters)
| Model | Size | RAM | Speed | Quality | Best For |
|-------|------|-----|-------|---------|----------|
| **qwen3:32b** | 19GB | 24GB | ⚡ | ⭐⭐⭐⭐⭐ | Complex analysis |
| **deepseek-r1:32b** | 19GB | 24GB | ⚡ | ⭐⭐⭐⭐⭐ | Reasoning |

**Legend:**
- ⚡ = Speed (more = faster)
- ⭐ = Quality (more = better)

---

## ⚙️ Parameter Configuration

### Recommended Settings for Task Chat

**For Small Models (7B-14B):**
```yaml
Model: qwen3:14b
Temperature: 0.1
Max Response Tokens: 6000
Context Window: 16000
```

**For Medium Models (20B-32B):**
```yaml
Model: qwen3:32b
Temperature: 0.1
Max Response Tokens: 8000
Context Window: 32000
```

### Parameter Guidance

**Temperature (0.0 - 2.0):**
- **0.1** ⭐ RECOMMENDED - Consistent, reliable JSON output
- **0.3-0.5** - Slightly more varied responses
- **0.7+** - Creative but may break JSON format (not recommended)

**Max Response Tokens:**
- **4000** - Fast, may truncate long responses
- **8000** ⭐ DEFAULT - Balanced, supports full keyword expansion
- **12000+** - Comprehensive, slower, higher memory usage

**Context Window:**
- **8000-16000** - Small models, limited task lists
- **32000** ⭐ DEFAULT - Medium models, typical usage
- **64000+** - Large models, extensive task lists

**Critical:** `Input + Response ≤ Context Window`  
If you get "context length exceeded" errors, reduce context window or max response tokens.

---

## 🔧 Troubleshooting

### Issue 1: Connection Failed

**Symptoms:**
```
Cannot connect to Ollama at http://localhost:11434/api/chat
```

**Solutions:**
1. ✅ Check if Ollama is running:
   ```bash
   ollama list
   ```
2. ✅ Start Ollama service:
   ```bash
   ollama serve
   ```
3. ✅ Verify CORS configuration (see Step 3 above)
4. ✅ Check endpoint in settings (default: `http://localhost:11434/api/chat`)

### Issue 2: Model Not Found

**Symptoms:**
```
Model 'qwen2.5:14b' not found in Ollama
```

**Solutions:**
1. ✅ List installed models:
   ```bash
   ollama list
   ```
2. ✅ Pull the model:
   ```bash
   ollama pull qwen2.5:14b
   ```
3. ✅ Refresh available models in Task Chat settings
4. ✅ Select a model from the dropdown

### Issue 3: Context Length Exceeded

**Symptoms:**
```
context length exceeded
```

**Solutions:**
1. ✅ Reduce **Context Window** (32000 → 16000)
2. ✅ Reduce **Max Response Tokens** (8000 → 6000)
3. ✅ Reduce **Max Chat History** (in Task Chat settings)
4. ✅ Use a larger model with bigger context window

### Issue 4: Slow Responses

**Symptoms:**
- Queries take 30+ seconds
- High CPU/memory usage

**Solutions:**
1. ✅ Use a smaller model (32B → 14B → 8B)
2. ✅ Reduce max response tokens
3. ✅ Close other applications
4. ✅ Upgrade hardware (more RAM/faster CPU)
5. ✅ Consider using cloud providers for speed

### Issue 5: Poor Quality Results

**Symptoms:**
- Incorrect JSON format
- Missing relevant tasks
- Poor task analysis

**Solutions:**
1. ✅ Use a larger model (8B → 14B → 32B)
2. ✅ Ensure temperature is 0.1
3. ✅ Increase context window
4. ✅ Adjust filtering parameters (see Performance Tuning below)
5. ✅ Consider cloud providers (OpenAI, Anthropic)

### Issue 6: JSON Parsing Errors

**Symptoms:**
```
Query parsing error: Unexpected token
```

**Solutions:**
1. ✅ Set temperature to 0.1 (lower = more consistent)
2. ✅ Use newer models (qwen2.5, llama3.1)
3. ✅ Increase max response tokens (model may be truncating)
4. ✅ Try a different model
5. ✅ Check model supports JSON output

---

## 📊 Performance Comparison

### Quality Comparison

| Model Type | JSON Format | Task Analysis | Keyword Expansion | Recommendation |
|------------|-------------|---------------|-------------------|----------------|
| Small (7B-8B) | ⭐⭐ | ⭐⭐ | ⭐⭐ | Use for simple queries only |
| Medium (14B-20B) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ Best balance |
| Large (32B-70B) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Best quality, slower |
| Cloud (GPT/Claude) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Fastest, costs money |

---

## 🎯 Performance Tuning

If Ollama model performance is not satisfactory, try these approaches:

### Approach 1: Model Upgrade Path

**Start small, upgrade if needed:**
```
qwen3:14b (balanced) ⭐ Try this first
    ↓ Still not good enough?
qwen3:32b (high quality)
    ↓ Still not good enough?
Switch to cloud providers (OpenAI, Anthropic)
```

### Approach 2: Adjust Filtering Parameters

Instead of upgrading model, tune filtering:

**Issue: Too many irrelevant results**
```yaml
Quality Filter Strength: 30% → 40%
Minimum Relevance Score: 0% → 30%
Stop Words: Add domain-specific terms
```

**Issue: Missing relevant tasks**
```yaml
Quality Filter Strength: 30% → 20%
Minimum Relevance Score: 30% → 0%
Semantic Expansion: Enable with more languages
Max Keyword Expansions: 5 → 10
```

**Issue: Wrong priorities**
```yaml
Scoring Coefficients:
  Relevance: 20 → 30 (emphasize keyword matching)
  Due Date: 4 → 2 (reduce date urgency)
  Priority: 1 → 5 (emphasize task priority)
```

### Approach 3: Hybrid Strategy

Use different providers for different purposes:

**Fast iteration (Ollama):**
- Testing queries
- Simple searches
- Learning the system

**Production use (Cloud):**
- Complex analysis
- Critical tasks
- Time-sensitive work

**Cost-effective:**
- Use Ollama for Smart Search (keyword expansion only)
- Use cloud for Task Chat (full AI analysis)

---

## 💡 Best Practices

### 1. Start with Recommended Model
```bash
ollama pull qwen3:14b
```
This model offers the best balance of speed, quality, and resource usage.

### 2. Use Appropriate Parameters
- Temperature: **0.1** (always)
- Max Tokens: **6000-8000**
- Context Window: **16000-32000**

### 3. Monitor Performance
Watch console logs for:
- Response times
- Token usage
- JSON parsing success rate

### 4. Upgrade Strategically
Don't immediately jump to the largest model. Try:
1. **Tune parameters** first (temperature, filtering)
2. **Upgrade to medium model** (14B → 20B)
3. **Try large model** if budget allows (32B)
4. **Consider cloud** for critical work

### 5. Use Cloud for Comparison
Test same query with:
- Ollama (qwen3:14b)
- OpenRouter (qwen3:14b)

This isolates whether issues are:
- Model capability (same result on both)
- Performance/speed (different on local vs cloud)

### 6. Match Model to Task Complexity

**Simple queries** ("show priority 1 tasks"):
- llama3.1:8b is fine

**Complex analysis** ("analyze my project roadmap"):
- qwen2.5:32b or cloud providers

---

## 🔗 Additional Resources

### Official Documentation
- **Ollama Website:** https://ollama.com
- **Model Library:** https://ollama.com/library
- **API Documentation:** https://github.com/ollama/ollama/blob/main/docs/api.md
- **Modelfile Guide:** https://github.com/ollama/ollama/blob/main/docs/modelfile.md

### Task Chat Documentation
- **AI Provider Configuration:** [AI_PROVIDER_CONFIGURATION.md](AI_PROVIDER_CONFIGURATION.md)
- **Model Selection Guide:** [MODEL_SELECTION_GUIDE.md](MODEL_SELECTION_GUIDE.md)
- **Settings Guide:** [SETTINGS_GUIDE.md](SETTINGS_GUIDE.md)

### Community
- **Ollama Discord:** https://discord.gg/ollama
- **GitHub Issues:** https://github.com/ollama/ollama/issues

---

## 📝 Quick Reference

### Essential Commands
```bash
# Install model
ollama pull <model-name>

# List installed models
ollama list

# Remove model
ollama rm <model-name>

# Start server
ollama serve

# Test model
ollama run <model-name>
```

### Default Settings
```yaml
Provider: Ollama
Endpoint: http://localhost:11434/api/chat
Model: qwen3:14b
Temperature: 0.1
Max Tokens: 8000
Context Window: 32000
```

### When to Use Ollama
✅ Privacy is important  
✅ Cost is a concern  
✅ Offline work needed  
✅ Learning/experimenting  

### When to Use Cloud
✅ Speed is critical  
✅ Best quality needed  
✅ Complex analysis required  
✅ Production environment  

---

## 🆘 Getting Help

If you're still having issues:

1. **Check console logs** in Obsidian Developer Tools (Ctrl+Shift+I)
2. **Test connection** in Task Chat settings
3. **Verify CORS** configuration
4. **Try different model** to isolate issue
5. **Report bug** with model name, error message, and logs

**Support:**
- GitHub Issues: [Report issue](https://github.com/wenlzhang/obsidian-task-chat/issues)
- Documentation: [All guides](../README.md)

---

**Last Updated:** 2025-10-24
