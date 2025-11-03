# Ollama Setup Guide

Complete guide for setting up and using Ollama with Task Chat plugin.

---

## 📋 What is Ollama?

Ollama is a free tool that allows you to run large language models (LLMs) locally on your computer. Unlike cloud providers (OpenAI, Anthropic), Ollama models run entirely offline with:

✅ **Zero cost** - No API fees
✅ **Complete privacy** - Data never leaves your computer  
✅ **No internet required** - Works offline
✅ **Full control** - Choose your model and parameters

**Trade-offs:**
- ⚠️ Slower than cloud providers (depends on your hardware)
- ⚠️ Requires good hardware
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
Model 'qwen3:14b' not found in Ollama
```

**Solutions:**
1. ✅ List installed models:
   ```bash
   ollama list
   ```
2. ✅ Pull the model:
   ```bash
   ollama pull qwen3:14b
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
5. ✅ Consider cloud providers (OpenAI, Anthropic, OpenRouter)

### Issue 6: JSON Parsing Errors

**Symptoms:**
```
Query parsing error: Unexpected token
```

**Solutions:**
1. ✅ Set temperature to 0.1 (lower = more consistent)
2. ✅ Use newer models
3. ✅ Increase max response tokens (model may be truncating)
4. ✅ Try a different model
5. ✅ Check model supports JSON output

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
