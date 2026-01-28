# xAPI - CDP-Based Antigravity Control

**Replaces HTTP API messaging with native keyboard simulation via Chrome DevTools Protocol.**

## Installation

```bash
cd extras/xAPI
npm install
```

## Quick Start

```javascript
import { AntigravityClient } from './xapi.js';

const client = new AntigravityClient();
await client.connect();  // Or client.connectToManager() if focused on Manager window

// Create new chat and send task
await client.newChat();
await new Promise(r => setTimeout(r, 500));
await client.sendMessage('Your task here');

// Accept agent steps
await client.accept();
```

## API Reference

### Connection

| Method | Description |
|--------|-------------|
| `connect()` | Auto-connect to main Antigravity editor |
| `connectToManager()` | Connect to Manager window (use when focused there) |
| `close()` | Close connection |
| `status()` | Get connection status |

### Messaging

| Method | Description |
|--------|-------------|
| `sendMessage(text)` | Type and send a message to chat |
| `typeText(text)` | Insert text at cursor |
| `pressKey(key, modifiers)` | Simulate keyboard input |

### Conversation Management

| Method | Shortcut | Description |
|--------|----------|-------------|
| `newChat()` | Ctrl+Shift+L | Open new conversation |
| `toggleChatPanel()` | Ctrl+Alt+B | Toggle chat panel visibility |
| `focusChat()` | Ctrl+Alt+B | Open panel and focus input |
| `openConversationPicker()` | Ctrl+Shift+A | Show conversation picker |
| `switchConversation(n)` | - | Switch to conversation #n |
| `listConversations()` | - | Query all conversation IDs + titles |

### Agent Actions

| Method | Shortcut | Description |
|--------|----------|-------------|
| `accept()` | Alt+Enter | Accept agent step |
| `reject()` | Alt+Shift+Backspace | Reject agent step |
| `triggerAgent()` | Ctrl+Shift+I | Trigger agent mode |

### Navigation

| Method | Shortcut | Description |
|--------|----------|-------------|
| `nextHunk()` | Alt+J | Navigate to next diff hunk |
| `prevHunk()` | Alt+K | Navigate to previous diff hunk |

### Utility

| Method | Shortcut | Description |
|--------|----------|-------------|
| `escape()` | Escape | Cancel/close |
| `tab()` | Tab | Press Tab |

## Modifier Keys

When using `pressKey(key, modifiers)`:
- `1` = Alt
- `2` = Ctrl
- `4` = Meta (Cmd on Mac)
- `8` = Shift

Combine by adding: `Ctrl+Shift = 2+8 = 10`

## Requirements

- Antigravity running with `--remote-debugging-port=9222`
- Node.js with `ws` package
