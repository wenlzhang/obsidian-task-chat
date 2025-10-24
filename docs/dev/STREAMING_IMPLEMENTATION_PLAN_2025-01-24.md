# Streaming Implementation Plan (2025-01-24)

## 🎯 User's Request

> "It would be impressive if users could see the AI parsing phase in a streaming format. For example, displaying the expansion of keywords, the collection of data, and the generation of responses could be beneficial. If the user remains stuck for an extended period with the response icon displayed, but nothing is showing, it could lead to frustration. Please enable streaming for the response."

**User is 100% correct!** Streaming significantly improves UX.

---

## 🔍 Investigation: How Obsidian Copilot Implements Streaming

### Key Discovery: They Use LangChain

**Source:** https://github.com/logancyang/obsidian-copilot

**Architecture:**
```typescript
// 1. Create chat model with streaming enabled
const baseConfig = {
  modelName: modelName,
  streaming: customModel.stream ?? true,  // Streaming ON
  maxRetries: 3,
  ...
};

// 2. Use LangChain's .stream() method
const chatStream = await this.chatModelManager
  .getChatModel()
  .stream(messages, {
    signal: abortController.signal,
  });

// 3. Async iteration over chunks
for await (const chunk of chatStream) {
  if (abortController.signal.aborted) break;
  streamer.processChunk(chunk);
}
```

**Key Benefits:**
- ✅ LangChain handles SSE parsing for all providers
- ✅ Unified API across OpenAI, Anthropic, Ollama, etc.
- ✅ Built-in abort signal support
- ✅ Clean async iteration

**Why It Works:**
- LangChain uses native Fetch API under the hood
- Abstracts away provider-specific SSE formats
- Handles errors, reconnections, parsing

---

## 📊 Task Chat vs Copilot Comparison

| Aspect | Task Chat (Current) | Obsidian Copilot |
|--------|---------------------|------------------|
| **API Calls** | Direct `requestUrl` | LangChain library |
| **Streaming** | ❌ Not supported | ✅ Full support |
| **Dependencies** | Minimal (chrono-node) | Many (LangChain + providers) |
| **Bundle Size** | Small (~150kb) | Large (~several MB) |
| **Code Complexity** | Simple API calls | Abstracted via LangChain |
| **Provider Support** | Manual for each | Automatic via LangChain |

---

## 🎯 Implementation Options

### Option 1: Add LangChain (Like Copilot)

**Approach:**
```bash
npm install @langchain/core @langchain/openai @langchain/anthropic @langchain/ollama
```

**Pros:**
- ✅ Streaming works automatically for all providers
- ✅ Clean, unified API
- ✅ Handles SSE parsing internally
- ✅ Proven solution (Copilot uses it)
- ✅ Less code to maintain

**Cons:**
- ❌ Large dependency (~5-10 MB added to bundle)
- ❌ Overkill for Task Chat's focused needs
- ❌ Learning curve for LangChain API
- ❌ More abstraction = less control

### Option 2: Native Fetch + Manual SSE Parsing ⭐ RECOMMENDED

**Approach:**
```typescript
// Use native Fetch API
const response = await fetch(endpoint, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ stream: true, ... }),
  signal: abortSignal,
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // Parse SSE format and call onStream callback
}
```

**Pros:**
- ✅ No new dependencies (keeps bundle small)
- ✅ Full control over implementation
- ✅ Can optimize for Task Chat's specific needs
- ✅ Incremental implementation (start with Task Chat only)
- ✅ Maintains lightweight philosophy

**Cons:**
- ❌ Need to handle each provider's SSE format
- ❌ More code to write and maintain
- ❌ Need to handle errors, reconnection manually

---

## ✅ Decision: Option 2 (Native Fetch + SSE Parsing)

**Rationale:**
1. **Lightweight:** Task Chat is focused, doesn't need full LangChain
2. **Incremental:** Can add streaming gradually
3. **Control:** Full control over behavior
4. **Learning:** User learns real streaming implementation

---

## 📝 Implementation Phases

### Phase 1: Infrastructure Setup ✅ (This Phase)

**Goals:**
1. Create SSE parser utilities
2. Implement streaming for Task Chat (final response only)
3. Replace `requestUrl` with native Fetch for streaming calls
4. Support all 4 providers (OpenAI, Anthropic, Ollama, OpenRouter)

**Files to Create:**
- `src/services/streamingService.ts` - SSE parsing utilities
- `src/services/aiStreamingService.ts` - Streaming-enabled AI calls

**Files to Modify:**
- `src/services/aiService.ts` - Switch to streaming when enabled
- `src/views/chatView.ts` - Display streaming responses
- `src/settingsTab.ts` - Enable streaming toggle

**What Users See (Phase 1):**
```
[User types query]
      ↓
Query: "Show high-priority tasks"
      ↓
[Loading indicator: "AI is thinking..."]
      ↓
[Streaming text appears character by character:]
"I found 15 high-priority tasks..."
"The most urgent is..."
"Task 1: Fix critical bug..." ← Text appears in real-time!
```

### Phase 2: Query Parsing Streaming (Future Enhancement)

**Goals:**
1. Stream keyword expansion process
2. Show filtering progress
3. Display task collection in real-time

**What Users See (Phase 2):**
```
Query: "urgent bug fixes"
      ↓
🔍 Expanding keywords...
  • urgent → critical, important, high-priority
  • bug → issue, defect, problem
  • fixes → repairs, solutions
      ↓
📊 Filtering tasks...
  • Found 487 tasks with keywords
  • Applying quality filter...
  • 52 tasks passed filter
      ↓
💬 Analyzing tasks...
  [Streaming AI response appears]
```

**Note:** Phase 2 is more complex because:
- Query parsing returns JSON (not streamable text)
- Would need to restructure as multiple streaming steps
- UI would need progress indicators
- May not add enough value vs complexity

**Recommendation:** Start with Phase 1, evaluate if Phase 2 is needed.

---

## 🔧 Technical Implementation Details

### SSE Format by Provider

#### OpenAI / OpenRouter
```
data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","choices":[{"delta":{"content":" world"},"finish_reason":null}]}

data: [DONE]
```

**Key Fields:**
- `choices[0].delta.content` - Text chunk
- `finish_reason` - "stop" when complete
- `[DONE]` - Stream end marker

#### Anthropic
```
event: message_start
data: {"type":"message_start","message":{"id":"msg_123"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}

event: message_stop
data: {"type":"message_stop"}
```

**Key Fields:**
- Event types: `message_start`, `content_block_delta`, `message_stop`
- `delta.text` - Text chunk
- Multi-line format with `event:` and `data:` lines

#### Ollama
```
data: {"model":"qwen3:14b","message":{"content":"Hello"},"done":false}

data: {"model":"qwen3:14b","message":{"content":" world"},"done":false}

data: {"model":"qwen3:14b","message":{"content":""},"done":true}
```

**Key Fields:**
- `message.content` - Text chunk
- `done` - Boolean for completion
- OpenAI-compatible format

### Streaming Service Architecture

```typescript
// streamingService.ts
export class StreamingService {
  static async *parseSSE(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    provider: string
  ): AsyncGenerator<string> {
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const chunk = this.parseChunk(line, provider);
        if (chunk) yield chunk;
      }
    }
  }

  private static parseChunk(line: string, provider: string): string | null {
    // Provider-specific parsing
    switch (provider) {
      case "openai":
      case "openrouter":
        return this.parseOpenAIChunk(line);
      case "anthropic":
        return this.parseAnthropicChunk(line);
      case "ollama":
        return this.parseOllamaChunk(line);
      default:
        return null;
    }
  }

  private static parseOpenAIChunk(line: string): string | null {
    if (!line.startsWith("data: ")) return null;
    const data = line.substring(6);
    if (data === "[DONE]") return null;
    
    try {
      const json = JSON.parse(data);
      return json.choices?.[0]?.delta?.content || null;
    } catch {
      return null;
    }
  }

  // Similar for parseAnthropicChunk, parseOllamaChunk
}
```

### AI Service Integration

```typescript
// aiStreamingService.ts
export class AIStreamingService {
  static async callAIWithStreaming(
    messages: any[],
    settings: PluginSettings,
    onStream: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<{ response: string; tokenUsage: TokenUsage }> {
    const providerConfig = getCurrentProviderConfig(settings);
    const endpoint = providerConfig.apiEndpoint;

    // Use native Fetch instead of requestUrl
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages: messages,
        stream: true, // Enable streaming!
        temperature: providerConfig.temperature,
        max_tokens: providerConfig.maxTokens,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    let fullResponse = "";

    for await (const chunk of StreamingService.parseSSE(reader, settings.aiProvider)) {
      fullResponse += chunk;
      onStream(chunk); // Call streaming callback
    }

    return {
      response: fullResponse,
      tokenUsage: { /* extract from stream */ },
    };
  }
}
```

### Chat View Updates

```typescript
// chatView.ts
private async handleUserMessage(userMessage: string) {
  // Create streaming message element
  const streamingEl = this.messagesContainer.createDiv({
    cls: "task-chat-message task-chat-message-ai",
  });

  let currentResponse = "";

  const onStream = (chunk: string) => {
    currentResponse += chunk;
    streamingEl.setText(currentResponse);
    // Auto-scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  };

  const result = await AIService.queryTasks(
    this.tasks,
    this.chatHistory,
    this.plugin.settings,
    onStream, // Pass streaming callback
    this.abortController?.signal
  );

  // Final update with complete response
  streamingEl.setText(result.response);
}
```

---

## 🎨 UX Improvements

### Before (No Streaming)
```
User types: "Show urgent tasks"
      ↓
[Loading spinner for 5-10 seconds]
      ↓
[Complete response appears all at once]
```

**Problems:**
- ❌ Long wait with no feedback
- ❌ User doesn't know if it's working
- ❌ All-or-nothing (complete or error)
- ❌ Feels slow even if fast

### After (With Streaming)
```
User types: "Show urgent tasks"
      ↓
[1-2 seconds]
      ↓
"I found" ← First chunk appears!
"15 urgent" ← More chunks stream in
"tasks that need" ← User can start reading
"attention. The" ← Feels much faster
"most critical..." ← Progressive disclosure
```

**Benefits:**
- ✅ Immediate feedback (1-2 seconds to first chunk)
- ✅ User knows it's working
- ✅ Can start reading while generating
- ✅ Feels much faster (better perceived performance)
- ✅ Can abort mid-stream if not helpful

---

## 📊 Performance Impact

### Metrics (Estimated)

**Time to First Chunk:**
- Without streaming: N/A (wait for complete response)
- With streaming: 1-2 seconds ✅

**Total Time:**
- Without streaming: 5-30 seconds (depends on model/query)
- With streaming: 5-30 seconds (same, but feels faster)

**User Perception:**
- Without streaming: "It's taking forever..."
- With streaming: "Wow, it's already responding!"

**Actual vs Perceived Performance:**
```
Actual time: Same (5-30 seconds)
Perceived time: 50-70% faster (because of progressive disclosure)
User satisfaction: 80-90% higher (immediate feedback)
```

---

## 🚧 Implementation Challenges

### Challenge 1: Provider-Specific SSE Formats

**Problem:** Each provider has different SSE format

**Solution:**
- Create unified SSE parser
- Provider-specific parsing methods
- Extensible for future providers

### Challenge 2: Error Handling Mid-Stream

**Problem:** Connection can drop mid-stream

**Solution:**
```typescript
try {
  for await (const chunk of streamIterator) {
    onStream(chunk);
  }
} catch (error) {
  if (error.name === "AbortError") {
    // User aborted, show partial response
    return { response: partialResponse, wasAborted: true };
  } else {
    // Network error, show error message
    throw error;
  }
}
```

### Challenge 3: Token Counting During Stream

**Problem:** Token usage info comes at end of stream

**Solution:**
- Accumulate chunks
- Extract usage from final SSE event
- Display token count after stream completes

### Challenge 4: Abort Signal Integration

**Problem:** Need to cancel stream mid-generation

**Solution:**
```typescript
const abortController = new AbortController();

// Pass to fetch
fetch(url, { signal: abortController.signal });

// User clicks stop button
abortController.abort();

// Stream stops immediately, partial response available
```

---

## 🎯 Success Criteria

### Phase 1 (Task Chat Streaming)

**Must Have:**
- ✅ Streaming works for all 4 providers
- ✅ Text appears in real-time
- ✅ Abort signal works (can stop mid-stream)
- ✅ Error handling for network issues
- ✅ Falls back to non-streaming on error

**Nice to Have:**
- ✅ Auto-scroll to bottom
- ✅ Visual indicator (typing animation)
- ✅ Token usage shown after completion

### Phase 2 (Query Parsing Streaming - Future)

**Must Have:**
- ✅ Show keyword expansion progress
- ✅ Display filtering steps
- ✅ Task collection visibility

**Nice to Have:**
- ✅ Progress bars
- ✅ Estimated time remaining
- ✅ Cancel during parsing phase

---

## 📅 Timeline

### Week 1: Phase 1 Implementation
- Day 1-2: Create streaming utilities (SSE parser)
- Day 3-4: Implement streaming for each provider
- Day 5: Integrate with AI service
- Day 6: Update chat view UI
- Day 7: Testing and bug fixes

### Week 2: Polish and Documentation
- Day 1-2: Error handling improvements
- Day 3: Performance optimization
- Day 4-5: Documentation
- Day 6: User testing
- Day 7: Release

### Future: Phase 2 (If Needed)
- Evaluate after Phase 1 feedback
- Design progress UI
- Implement multi-stage streaming

---

## 🔗 References

### Obsidian Copilot Implementation
- Repository: https://github.com/logancyang/obsidian-copilot
- Key file: `src/LLMProviders/chainRunner/LLMChainRunner.ts`
- Approach: LangChain with async iteration

### Provider Documentation
- **OpenAI:** https://platform.openai.com/docs/api-reference/streaming
- **Anthropic:** https://docs.anthropic.com/claude/reference/streaming
- **Ollama:** https://github.com/ollama/ollama/blob/main/docs/api.md#streaming
- **OpenRouter:** https://openrouter.ai/docs#streaming (OpenAI-compatible)

### MDN References
- **Fetch API:** https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- **ReadableStream:** https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
- **AbortSignal:** https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal

---

## ✅ Next Steps

1. **Create streaming service** (`streamingService.ts`)
2. **Implement provider-specific SSE parsers**
3. **Create AI streaming service** (`aiStreamingService.ts`)
4. **Update AI service** to use streaming when enabled
5. **Update chat view** to display streaming responses
6. **Enable streaming toggle** in settings
7. **Test with all providers**
8. **Document implementation**

---

## 💡 Key Insights

### Why Copilot Uses LangChain
- Large plugin with many features
- Needs unified API across providers
- Worth the bundle size trade-off
- Focus on features over size

### Why Task Chat Should Use Native Fetch
- Focused plugin with specific needs
- Keep bundle size small
- Full control over implementation
- Learning opportunity

### User's Request is Perfect
> "If the user remains stuck for an extended period with the response icon displayed, but nothing is showing, it could lead to frustration."

**This is exactly why streaming matters!** Not just technical feature, but UX improvement.

---

**Status:** Plan complete, ready for implementation  
**Priority:** High (significantly improves UX)  
**Complexity:** Medium (provider-specific SSE formats)  
**Risk:** Low (can fall back to non-streaming)

**Let's implement Phase 1!** 🚀
