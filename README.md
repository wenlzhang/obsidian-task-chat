# Task Chat

An AI-powered Obsidian plugin that enables you to chat with your tasks. Filter tasks by text, folders, priority, due date, completion status, and more. Get AI recommendations and navigate directly to tasks in your notes.

## Features

- **AI Chat Interface**: Chat with an AI assistant about your tasks
- **Advanced Filtering**: Filter tasks by:
  - Text content
  - Folders
  - Priority levels
  - Due date ranges
  - Completion status
  - Task status categories
- **Task Navigation**: Click on recommended tasks to jump directly to their location in your notes
- **DataView Integration**: Leverages the DataView plugin to access task properties
- **Multiple AI Providers**: Supports OpenAI, Anthropic, OpenRouter, and Ollama (local)
- **Real-time Updates**: Automatically refreshes tasks when your notes change

## Requirements

- **Obsidian** v1.0.0 or higher
- **DataView plugin** (required for task access)
- **API Key** for your chosen AI provider (not needed for Ollama)

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Task Chat"
4. Click Install, then Enable

### Manual Installation

1. Download the latest release from the [Releases](https://github.com/wenlzhang/obsidian-task-chat/releases) page
2. Extract the files to your vault's `.obsidian/plugins/task-chat/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Setup

1. Install and enable the **DataView** plugin
2. Open Task Chat settings (Settings → Task Chat)
3. Configure your AI provider:
   - Select your provider (OpenAI, Anthropic, OpenRouter, or Ollama)
   - Enter your API key (not needed for Ollama)
   - Choose your preferred model
4. Optionally customize DataView field mappings to match your task setup

## Usage

### Opening Task Chat

- Click the chat icon in the left ribbon, or
- Use the command palette: "Task Chat: Open Task Chat"

### Chatting with Tasks

1. Click "Filter tasks" to select which tasks to focus on
2. Type your question or request in the chat input
3. Press Cmd/Ctrl+Enter to send
4. Click the → button next to recommended tasks to navigate to them

### Example Conversations

- "What are my highest priority tasks?"
- "Which tasks are overdue?"
- "Show me tasks due this week"
- "What should I work on next?"
- "Are there any tasks in the project folder?"

### Filtering Tasks

Click "Filter tasks" to open the filter modal where you can:

- Search by text content
- Select specific folders
- Filter by priority levels
- Set due date ranges
- Filter by completion or task status
- Use quick filters (Today, This week, This month)

## Configuration

### AI Provider Settings

- **AI Provider**: Choose between OpenAI, Anthropic, OpenRouter, or Ollama
- **API Key**: Your provider's API key
- **Model**: Model name (e.g., gpt-4o-mini, claude-3-5-sonnet-20241022, llama3.2)
- **API Endpoint**: Custom API endpoint URL

### Chat Settings

- **Max Chat History**: Number of messages to keep (default: 50)
- **Show Task Count**: Display task count in filter status
- **Auto-open Sidebar**: Open Task Chat automatically on startup
- **System Prompt**: Customize the AI assistant's behavior

### DataView Integration

Configure field names to match your task metadata:

- **Due Date Field**: Default is `due`
- **Created Date Field**: Default is `created`
- **Completed Date Field**: Default is `completed`
- **Priority Field**: Default is `priority`

## Task Format

Task Chat works with standard Markdown tasks that include DataView metadata:

```markdown
- [ ] Buy groceries 📅 2025-01-20 ⏫
- [x] Write blog post [due::2025-01-15] [priority::high]
- [/] Review pull requests [due::2025-01-18] [priority::medium]
```

Supported task properties:
- Due dates: `📅 YYYY-MM-DD` or `[due::YYYY-MM-DD]`
- Priority: `⏫` (high), `🔼` (medium), `🔽` (low) or `[priority::high]`
- Status: `[ ]` (open), `[x]` (completed), `[/]` (in progress), `[-]` (cancelled)
- Tags: Standard Obsidian tags

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Acknowledgments

This plugin leverages code patterns from:
- [Task Scope](https://github.com/wenlzhang/obsidian-task-scope) - DataView task integration
- [Todoist Context Bridge](https://github.com/wenlzhang/obsidian-todoist-context-bridge) - Task property handling

## Privacy & Security

- Your API keys are stored locally in Obsidian's data folder
- Task data is only sent to your chosen AI provider when you send a message
- No data is collected or stored by this plugin
- For maximum privacy, use Ollama for local AI processing

## Troubleshooting

### Tasks not showing up

1. Ensure DataView plugin is installed and enabled
2. Check that your tasks follow the proper format
3. Click "Refresh tasks" in the chat view
4. Verify DataView field mappings in settings

### AI not responding

1. Check your API key is entered correctly
2. Verify your API endpoint is correct
3. Ensure you have internet connection (except for Ollama)
4. Check the console for error messages (Ctrl/Cmd + Shift + I)

### Cannot navigate to tasks

1. Ensure the source file still exists
2. Try refreshing tasks
3. Check that line numbers are being captured correctly

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Support

<a href='https://ko-fi.com/C0C66C1TB' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
