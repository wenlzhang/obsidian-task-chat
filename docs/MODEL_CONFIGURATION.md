# Model Purpose Configuration

Configure different AI models for query parsing and task analysis to optimize costs and performance.

## Overview

Task Chat and Smart Search use AI in two distinct phases:

1. **Query Parsing** (Smart Search & Task Chat)
   - Extracts keywords from natural language
   - Generates semantic expansions
   - Identifies task properties (priority, status, due date)
   - **Needs**: Fast, reliable JSON output
2. **Task Analysis** (Task Chat only)
   - Analyzes filtered tasks
   - Generates recommendations
   - Provides comprehensive insights
   - **Needs**: Deep understanding, quality responses

## Benefits

### Performance Optimization

- Fast parsing: Sub-second JSON generation
- Deep analysis: High-quality recommendations when needed
- Best of both worlds

### Provider Flexibility

- Mix providers: OpenAI + Anthropic + Ollama
- Leverage strengths: Each model does what it's best at
- Failover support: Switch providers per purpose

## Configuration

### Settings Location

Go to **Settings → Task Chat → AI Provider → Model purpose configuration**

### Options

#### Query parsing configuration

- **Provider**: Which AI provider for parsing (required)
  - OpenAI
  - Anthropic
  - OpenRouter
  - Ollama (Local)
- **Model**: Select from dropdown of available models
  - Click 'Refresh' to fetch latest models
  - Examples: "gpt-4o-mini", "claude-sonnet-4", "qwen3:14b"
- **Temperature**: Control consistency (0-2, default 0.1)

#### Task analysis configuration

- **Provider**: Which AI provider for analysis (Task Chat only)
  - OpenAI
  - Anthropic
  - OpenRouter
  - Ollama (Local)
- **Model**: Select from dropdown of available models
  - Click 'Refresh' to fetch latest models  
  - Examples: "gpt-4o", "claude-sonnet-4", "qwen3:14b"
- **Temperature**: Control creativity (0-2, default 0.1)
  - Lower = more structured, higher = more creative

## How It Works

### Smart Search Mode

```
User Query → AI Parsing (parsing model) → Extract Keywords + Properties
         ↓
    Filter Tasks
         ↓
    Score & Sort Tasks
         ↓
    Display Results
```

**Model Used**: Parsing model only  

### Task Chat Mode

```
User Query → AI Parsing (parsing model) → Extract Keywords + Properties
         ↓
    Filter Tasks
         ↓
    Score & Sort Tasks
         ↓
    AI Analysis (analysis model) → Recommendations + Insights
         ↓
    Display Results
```

**Models Used**: Parsing + Analysis

## Troubleshooting

### Parsing Errors

**Issue**: JSON parsing fails  
**Solution**:
1. Check parsing model supports JSON output reliably
2. Try gpt-4o-mini (known reliable)
3. Verify API key for parsing provider
4. Check parsing model is available

### Analysis Errors

**Issue**: Task Chat recommendations fail  
**Solution**:
1. Check analysis model is available
2. Verify API key for analysis provider
3. Try gpt-5-mini
4. Check model context window supports task count

### Cost Higher Than Expected

**Issue**: Bills higher than anticipated  
**Solution**:
1. Check which models are configured
2. Verify parsing uses cheap model (gpt-4o-mini)
3. Monitor token usage in chat metadata
4. Consider Ollama for parsing (free)

### Different Results

**Issue**: Results vary between searches  
**Solution**:
- This is expected with different models
- Different models have different capabilities
- Parsing differences are minimal
- Analysis differences are by design (different model intelligence)

## FAQ

**Q: Can I use the same model for both?**  
A: Yes, set both parsing and analysis to the same provider and model.

**Q: Can I mix free and paid models?**  
A: Yes! Use Ollama for parsing (free, local) and cloud for analysis (paid).

**Q: Do I need multiple API keys?**  
A: Only if using different providers. Same provider uses same key.

## Support

For issues or questions:
1. Check this documentation
2. Review [Settings Guide](SETTINGS_GUIDE.md)
3. Check [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md)
4. Open a GitHub issue
