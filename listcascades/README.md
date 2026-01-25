# 📋 List Cascades

**What it does:** Shows you all your Antigravity conversations.

## How it works

Antigravity stores each conversation as a `.pb` file in:
```
~/.gemini/antigravity/conversations/
```

This script reads those files and shows you:
- The conversation ID (a long unique code like `cf174549-2581-4c24-b82b-a4115c015cea`)
- The file size (bigger = more messages)
- When it was last updated

## Usage

```bash
node index.js
```

## Example Output

```
📋 Found 14 conversations:

📌 cf174549-2581-4c24-b82b-a4115c015cea
   6622.9 KB | 25/01/2026 14:45:25

📌 b02157cf-fa4b-41e8-a299-c2e0a8c42c8e
   12799.1 KB | 25/01/2026 14:39:34
```

## What's a cascade ID?

A **cascade ID** is like a phone number for a conversation. Every chat in Antigravity has a unique one. You need this ID to send messages to that conversation.
