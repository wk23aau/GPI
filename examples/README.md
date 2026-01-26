# Examples Folder 📚

This folder has example scripts showing you how to use GPI's cool new features!

## What's Here?

### `send-with-config.js` - Advanced Message Sending

**What it does:** Shows you how to send messages with special settings like:
- Limiting how many "tokens" (words/ideas) the AI uses (saves your quota!)
- Turning off browser features for safety
- Starting from a specific point in your conversation
- Using automatic retry if something goes wrong

**How to run it:**

```bash
node examples/send-with-config.js YOUR-CASCADE-ID
```

Replace `YOUR-CASCADE-ID` with the ID of your conversation (the long weird code like `b02157cf-fa4b-41e8-a299-c2e0a8c42c8e`).

**What you'll see:** 4 different examples running one after another, each showing a different cool feature!

---

## Why Use These Examples?

Think of regular GPI like sending a text message. These examples are like learning to send messages with:
- 📊 A word limit (to save money)
- 🔒 Privacy mode (browser off)
- ⏱️ Starting from where you left off
- 🔄 Auto-retry (if it doesn't send the first time)

---

## What's a "Config"?

A config is just settings! Like when you play a video game and can choose:
- Easy/Medium/Hard mode
- Sound on/off
- Controller vibration

In GPI, configs let you choose:
- How many tokens to use
- Whether the AI can use a browser
- Where to start in your conversation
- And more!

---

## Example Output

When you run the script, you'll see something like:

```
═══════════════════════════════════════════════════════════
Example 1: Limited Token Usage
═══════════════════════════════════════════════════════════
Setting maxNumChatInputTokens to 2000 to conserve quota

✅ Sent with token limit
```

---

## Need Help?

- **Can't find your cascade ID?** Run `node listcascades/index.js` to see all your conversations
- **Getting errors?** Make sure Antigravity is running and your CSRF token is in `.env`
- **What's a token?** Think of it like "AI thinking points" - more tokens = more thinking but costs more quota

---

## Try It Yourself!

1. Start Antigravity
2. Get a cascade ID (or create one with `node startcascade/index.js`)
3. Run: `node examples/send-with-config.js YOUR-CASCADE-ID`
4. Watch the examples run!

Each example is independent - you can copy the code and use it in your own scripts!
