# Task Chat - Quick Start Guide

## Installation

1. **Install DataView Plugin** (Required)
   - Go to Settings → Community Plugins
   - Search for "Dataview"
   - Install and enable it

2. **Install Task Chat**
   - Copy the `build` folder contents to `.obsidian/plugins/task-chat/`
   - Or install from Community Plugins (when published)

3. **Configure API Key**
   - Go to Settings → Task Chat
   - Select your AI provider
   - Enter your API key
   - Choose your model

## First Steps

1. **Open Task Chat**
   - Click the chat icon in the ribbon (left sidebar)
   - Or use Command Palette: "Task Chat: Open Task Chat"

2. **Refresh Tasks**
   - Click "Refresh tasks" button
   - Tasks will load from your vault via DataView

3. **Start Chatting**
   - Ask questions like:
     - "What tasks are due today?"
     - "Show me high priority tasks"
     - "What should I work on next?"
   
4. **Navigate to Tasks**
   - AI will recommend tasks
   - Click the → button to jump to the task in your note

## Task Format Examples

Make sure your tasks include metadata:

```markdown
# Project Tasks
- [ ] Design mockups 📅 2025-01-20 ⏫
- [ ] Code review [due::2025-01-18] [priority::medium]
- [x] Initial setup [completed::2025-01-15]
```

## Filtering Tasks

Click "Filter tasks" to narrow down which tasks to discuss:

- **Text search**: Find tasks by content
- **Folders**: Focus on specific project folders
- **Priority**: Filter by high/medium/low
- **Due dates**: Set date ranges
- **Status**: Completed vs incomplete

## Tips

- Use Cmd/Ctrl+Enter to send messages quickly
- Clear chat history to start fresh conversations
- Refresh tasks after making changes to your notes
- Try different AI models to find what works best

## Troubleshooting

**No tasks showing up?**
- Ensure DataView is installed and enabled
- Check your task format includes proper metadata
- Click "Refresh tasks"

**AI not responding?**
- Verify your API key is correct
- Check your internet connection
- Look at console for errors (Cmd/Ctrl+Shift+I)

**Can't navigate to tasks?**
- Make sure the source file still exists
- Try refreshing tasks first

## AI Providers

### OpenAI
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: `gpt-4o-mini` or `gpt-4o`

### Anthropic
- Endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-3-5-sonnet-20241022`

### OpenRouter
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Model: Various options available

### Ollama (Local)
- Endpoint: `http://localhost:11434/api/chat`
- Model: `llama3.2`, `mistral`, etc.
- No API key needed!

## Next Steps

1. Explore different filters
2. Try various AI models
3. Customize the system prompt
4. Set up auto-open sidebar
5. Adjust DataView field mappings for your workflow

For more details, see the full [README.md](README.md)
