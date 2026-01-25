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

## What happens next?

After you send a message, the AI will start responding in that conversation. You can see the response by opening Antigravity and going to that conversation.

## Requirements

You need a CSRF token in the `.env` file (one folder up). See the main README for how to get it.
