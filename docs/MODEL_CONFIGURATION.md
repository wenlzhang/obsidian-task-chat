# Model Purpose Configuration

Configure different AI models for query parsing and task analysis to optimize costs and performance.

## Overview

Task Chat and Smart Search use AI in two distinct phases:

1. **Query Parsing** (Smart Search & Task Chat)
   - Extracts keywords from natural language
   - Generates semantic expansions
   - Identifies task properties (priority, status, due date)
   - **Needs**: Fast, reliable JSON output
   - **Recommended**: Cheap, fast models (gpt-4o-mini, claude-haiku-3-5)

2. **Task Analysis** (Task Chat only)
   - Analyzes filtered tasks
   - Generates recommendations
   - Provides comprehensive insights
   - **Needs**: Deep understanding, quality responses
   - **Recommended**: Powerful models (gpt-4o, claude-sonnet-4)

## Benefits

### Cost Optimization
Save ~95% on parsing costs while maintaining premium analysis quality:
- Parsing: gpt-4o-mini ($0.00015/1K output) → ~$0.0001 per query
- Analysis: gpt-4o ($0.006/1K output) → ~$0.012 per query
- **Total**: $0.0121 vs $0.024 (all gpt-4o) = 50% savings!

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

Go to **Settings → Task Chat → AI Provider → Model Purpose Configuration**

### Options

#### Query Parsing Provider/Model
- **Provider**: Which AI provider for parsing
  - Default (use main provider)
  - OpenAI
  - Anthropic
  - OpenRouter
  - Ollama (Local)
- **Model**: Which model for parsing (leave empty for provider default)
  - Examples: "gpt-4o-mini", "claude-haiku-3-5", "qwen2.5:14b"

#### Task Analysis Provider/Model
- **Provider**: Which AI provider for analysis (Task Chat only)
  - Default (use main provider)
  - OpenAI
  - Anthropic
  - OpenRouter
  - Ollama (Local)
- **Model**: Which model for analysis (leave empty for provider default)
  - Examples: "gpt-4o", "claude-sonnet-4", "qwen2.5:32b"

## Example Configurations

### 1. Cost-Optimized (Recommended)

**Setup**:
- Main Provider: OpenAI (gpt-4o-mini)
- Parsing: Default (gpt-4o-mini)
- Analysis: gpt-4o

**Benefits**:
- 50% cost savings vs all gpt-4o
- Fast parsing, quality analysis
- Single provider (simple API key management)

**Monthly Cost** (50 queries/day):
- Parsing: ~$1.50
- Analysis: ~$18.00
- **Total**: ~$19.50

### 2. Local + Cloud Hybrid

**Setup**:
- Main Provider: Anthropic (claude-sonnet-4)
- Parsing: Ollama (qwen2.5:14b)
- Analysis: Default (claude-sonnet-4)

**Benefits**:
- Zero parsing costs (local Ollama)
- Privacy (queries stay local)
- Premium analysis when needed

**Monthly Cost** (50 queries/day):
- Parsing: $0 (free, local)
- Analysis: ~$30.00
- **Total**: ~$30.00

### 3. Performance-Focused

**Setup**:
- Main Provider: OpenAI (gpt-4o)
- Parsing: gpt-4o-mini
- Analysis: Default (gpt-4o)

**Benefits**:
- Fastest JSON parsing
- High-quality analysis
- Single provider

**Monthly Cost** (50 queries/day):
- Parsing: ~$1.50
- Analysis: ~$18.00
- **Total**: ~$19.50

### 4. Multi-Provider

**Setup**:
- Main Provider: OpenAI (gpt-4o-mini)
- Parsing: Anthropic (claude-haiku-3-5)
- Analysis: OpenRouter (anthropic/claude-opus-4)

**Benefits**:
- Leverage each provider's strengths
- Provider diversification
- Failover capability

**Monthly Cost** (50 queries/day):
- Parsing: ~$1.50
- Analysis: ~$60.00 (premium model)
- **Total**: ~$61.50

## How It Works

### Smart Search Mode
```
User Query → AI Parsing (parsing model) → Extract Keywords + Properties
         ↓
    Filter Tasks (DataView API)
         ↓
    Score & Sort Tasks
         ↓
    Display Results
```

**Model Used**: Parsing model only  
**Token Usage**: ~500-800 tokens  
**Cost**: ~$0.0001 per query (with gpt-4o-mini)

### Task Chat Mode
```
User Query → AI Parsing (parsing model) → Extract Keywords + Properties
         ↓
    Filter Tasks (DataView API)
         ↓
    Score & Sort Tasks
         ↓
    AI Analysis (analysis model) → Recommendations + Insights
         ↓
    Display Results
```

**Models Used**: Parsing + Analysis  
**Token Usage**:
- Parsing: ~500-800 tokens
- Analysis: ~2000-3000 tokens  
**Cost**: ~$0.012 per query (gpt-4o-mini → gpt-4o)

## Metadata Display

The chat interface intelligently shows which models were used:

### Simple/Smart Search
```
Mode: Smart Search • OpenAI: gpt-4o-mini • 450 tokens • $0.0001
```

### Task Chat (Same Model)
```
Mode: Task Chat • OpenAI: gpt-4o • 2,500 tokens • $0.0125
```

### Task Chat (Different Models)
```
Mode: Task Chat • Parsing: OpenAI/gpt-4o-mini • Analysis: Anthropic/claude-sonnet-4 • 3,200 tokens • $0.0280
```

## Recommendations

### For Most Users
**Use**: Cost-Optimized configuration
- Parsing: gpt-4o-mini
- Analysis: gpt-4o
- Balance of cost, speed, and quality

### For Privacy-Conscious Users
**Use**: Local + Cloud Hybrid
- Parsing: Ollama (local, free, private)
- Analysis: Your preferred cloud provider
- Queries stay local, analysis uses premium models

### For Budget-Conscious Users
**Use**: All Ollama (fully local)
- Parsing: qwen2.5:14b
- Analysis: qwen2.5:32b
- Zero API costs, fully private

### For Quality-Focused Users
**Use**: Premium models for both
- Parsing: claude-haiku-3-5 (reliable)
- Analysis: claude-opus-4 (best quality)
- Maximum quality, higher cost

## Troubleshooting

### Parsing Errors
**Issue**: JSON parsing fails  
**Solution**:
1. Check parsing model supports JSON output reliably
2. Try gpt-4o-mini or claude-haiku-3-5 (known reliable)
3. Verify API key for parsing provider
4. Check parsing model is available

### Analysis Errors
**Issue**: Task Chat recommendations fail  
**Solution**:
1. Check analysis model is available
2. Verify API key for analysis provider
3. Try gpt-4o or claude-sonnet-4 (known reliable)
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

## Advanced Topics

### Provider-Specific Configuration

Each provider's configuration is independent:
- API keys per provider
- Models per provider
- Endpoints per provider
- Temperature settings per provider

**Example**: Using both OpenAI and Anthropic
```
OpenAI Config:
- API Key: sk-...
- Model: gpt-4o-mini (for main provider)
- Temperature: 0.1

Anthropic Config:
- API Key: sk-ant-...
- Model: claude-sonnet-4 (for main provider)
- Temperature: 0.1

Purpose Config:
- Parsing Provider: OpenAI (gpt-4o-mini)
- Analysis Provider: Anthropic (claude-sonnet-4)
```

### Token Tracking

Separate tracking for each purpose:
- `parsingTokens`: Tokens used for query parsing
- `analysisTokens`: Tokens used for task analysis
- `parsingCost`: Cost for parsing
- `analysisCost`: Cost for analysis

View in chat metadata (hover over token count).

### Model Resolution

How models are resolved:
1. If purpose provider is "default" → use main provider
2. If purpose model is empty → use provider's configured model
3. Otherwise → use specified provider and model

**Example**:
```
Main Provider: OpenAI (gpt-4o-mini)
Parsing: default, "" → Uses OpenAI/gpt-4o-mini
Analysis: Anthropic, "claude-sonnet-4" → Uses Anthropic/claude-sonnet-4
```

## FAQ

**Q: Do I need different models?**  
A: No, defaults work perfectly. This is for optimization.

**Q: Can I use the same model for both?**  
A: Yes, set both to "default" (the default behavior).

**Q: Can I mix free and paid models?**  
A: Yes! Use Ollama for parsing (free) and cloud for analysis (paid).

**Q: Will this break my existing setup?**  
A: No, it's 100% backward compatible. Defaults use your main provider.

**Q: How much can I save?**  
A: 50-95% on parsing costs by using gpt-4o-mini or Ollama.

**Q: Can I use three different providers?**  
A: Yes! Main, parsing, and analysis can all be different.

**Q: Do I need multiple API keys?**  
A: Only if using different providers. Same provider uses same key.

**Q: Can I test configurations?**  
A: Yes, change settings and run queries. Metadata shows which models were used.

## Support

For issues or questions:
1. Check this documentation
2. Review [Settings Guide](SETTINGS_GUIDE.md)
3. Check [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md)
4. Open a GitHub issue

## Version History

- **v1.0.0** (2025-01-27): Initial release of model purpose configuration
