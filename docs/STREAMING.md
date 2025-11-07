# Streaming Responses in Task Chat

## Overview

Task Chat supports two modes for AI responses: **streaming** and **non-streaming**. You can toggle between these modes in the plugin settings under "Chat" settings.

## Streaming vs Non-Streaming

### Streaming Mode

**Advantages:**
- **User Experience**: Responses appear gradually as they're generated, similar to ChatGPT
- **Progress Indication**: Natural visual feedback that AI is working

**Technical Implementation:**
- Uses native browser `fetch()` API with streaming support
- Bypasses Obsidian's built-in `requestUrl()` function
- Processes Server-Sent Events (SSE) for real-time data streaming

**Considerations:**
- **CORS**: fetch() is subject to browser CORS policies. Most AI providers (OpenAI, Anthropic, OpenRouter) have proper CORS headers configured
- **Security**: Runs in the same security context as Obsidian, but doesn't benefit from Obsidian's additional request sanitization
- **Compatibility**: Works with all major AI providers that support streaming responses

### Non-Streaming Mode

**Advantages:**
- **Enhanced Security**: Uses Obsidian's `requestUrl()` which includes additional security checks
- **Better CORS Handling**: Obsidian handles CORS issues automatically
- **Network Reliability**: Built-in retry logic and error handling
- **Plugin Store Compliance**: Preferred by Obsidian for security-sensitive operations

**Technical Implementation:**
- Uses Obsidian's built-in `requestUrl()` function
- Waits for complete response before displaying
- Processes response in single batch

**Considerations:**
- **Slower Perceived Response**: User must wait for entire response to complete
- **No Progress Indication**: No visual feedback until response is complete

## Technical Details

### API Compatibility

| Provider | Streaming Support | Non-Streaming Support | Notes |
|----------|-------------------|----------------------|-------|
| OpenAI | ✅ | ✅ | Full support for both modes |
| Anthropic | ✅ | ✅ | Full support for both modes |
| OpenRouter | ✅ | ✅ | Full support for both modes |
| Ollama | ✅ | ✅ | Local server, no CORS issues |

### Security Considerations

#### Streaming Mode (fetch())
- **Pros**: Standard browser API, widely tested
- **Cons**: Bypasses Obsidian's request sanitization
- **Risk Level**: Low for established AI providers

#### Non-Streaming Mode (requestUrl())
- **Pros**: Obsidian's security layer, CORS handling
- **Cons**: Less flexibility for custom implementations
- **Risk Level**: Lowest, recommended for sensitive environments

## Troubleshooting

### Common Issues

#### Issue: CORS Errors with Streaming
**Symptom**: Console shows "CORS policy" errors
**Solution**: Disable streaming in settings to use requestUrl()
**Why**: Some network configurations block CORS for fetch()

#### Issue: Incomplete Responses with Streaming
**Symptom**: Responses cut off mid-sentence
**Solution**: Check network stability, consider disabling streaming
**Why**: Network interruptions can break SSE connections

#### Issue: Slow Responses with Non-Streaming
**Symptom**: Long wait times before seeing any response
**Solution**: Enable streaming for better perceived performance
**Why**: Non-streaming waits for complete response

## Configuration

### Enabling Streaming
1. Open Settings → Chat
2. Toggle "Enable streaming responses"
3. Setting takes effect immediately for new requests

## Related Documentation

- [AI Provider Configuration](./AI_PROVIDER_CONFIGURATION.md) - Provider-specific configuration
- [Model Configuration](./MODEL_CONFIGURATION.md) - Model-specific configuration
- [Cost Tracking](./COST_TRACKING.md) - Token usage and pricing
