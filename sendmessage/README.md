# 📤 Send Message

**What it does:** Sends a message to an Antigravity conversation from your code.

## How it works

1. You give it a conversation ID and a message
2. It connects to Antigravity's Language Server (running on your computer)
3. It sends your message using the `SendUserCascadeMessage` API
4. The AI receives your message and starts responding!

## Usage

```bash
node index.js <cascadeId> "Your message here"
```

## Example

```bash
node index.js b02157cf-fa4b-41e8-a299-c2e0a8c42c8e "Hello from my script!"
```

Output:
```
🔗 Port: 57829
📍 Cascade: b02157cf-fa4b-41e8-a299-c2e0a8c42c8e
📤 Message: Hello from my script!

✅ Message sent!
```

## 🆕 New Features!

### Automatic Retry (More Reliable!)

Sometimes messages fail to send (like when your wifi hiccups). The new retry feature automatically tries again if something goes wrong!

**Use it in your own code:**

```javascript
import api from '../api.js';

// This will retry up to 3 times if it fails
await api.sendWithRetry(port, csrf, cascadeId, "Your message");
```

**What it does:**
- If the AI is temporarily down, it waits a bit and tries again
- If your quota is full, it tells you to switch accounts (doesn't waste time retrying)
- If your token expired, it tells you to get a new one

### Advanced Settings (Power User Mode!)

You can now control special settings when sending messages:

```javascript
// Limit how much the AI "thinks" (saves quota!)
await api.sendMessage(port, csrf, cascadeId, "Your message", {
    maxNumChatInputTokens: 2000
});

// Turn off browser features for safety
await api.sendMessage(port, csrf, cascadeId, "Your message", {
    browserJsExecutionEnabled: false
});
```

**Want to see more examples?** Check out `examples/send-with-config.js`!

## What happens next?

After you send a message, the AI will start responding in that conversation. You can see the response by opening Antigravity and going to that conversation.

## Requirements

You need a CSRF token in the `.env` file (one folder up). See the main README for how to get it.

