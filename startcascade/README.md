# 🆕 Start Cascade

**What it does:** Creates a brand new Antigravity conversation.

## How it works

1. It connects to Antigravity's Language Server
2. It calls the `StartCascade` API
3. Antigravity creates a new empty conversation
4. It gives you the new conversation's ID

## Usage

```bash
node index.js
```

## Example Output

```
🔗 Port: 57829
🆕 Creating new conversation...

✅ New conversation created!

📌 Cascade ID: abc12345-6789-wxyz-0000-abcdef123456

To send a message to it:
  node ../sendmessage/index.js abc12345-6789-wxyz-0000-abcdef123456 "Hello!"
```

## When to use this?

Use this when you want to start a fresh conversation with the AI instead of continuing an existing one.

## What happens in Antigravity?

After running this, a new conversation will appear in your Antigravity sidebar. It will be empty until you send messages to it.
