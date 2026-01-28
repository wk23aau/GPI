# xAPI - CDP-Based Antigravity Control

**Control Antigravity using keyboard shortcuts instead of APIs!**

---

## 🎯 What Is This?

This tool lets a Node.js script control Antigravity as if a human was typing. It uses Chrome DevTools Protocol (CDP) to simulate keyboard presses.

**Think of it like a robot that can:**
- Open new chats
- Type messages
- Press Enter to send
- Press Alt+Enter to accept commands

---

## 🤔 Why We Built This

The normal way to talk to Antigravity is through HTTP APIs. But there was a problem:

> **The API couldn't send messages to the chat!**

So we switched to a different approach: **simulate keyboard presses**.

---

## 🐛 Problems We Faced (and Fixed!)

### Problem 1: Modifiers Not Working

**What happened:** We tried `Ctrl+Shift+L` to open a new chat, but only `Ctrl+L` was triggered (which sends terminal logs instead).

**Why:** The CDP "modifiers" parameter wasn't being recognized by Electron/Antigravity.

**Fix:** We now explicitly press down Ctrl, then Shift, then L, then release them in reverse order. Like a real human would!

```javascript
// Before (didn't work):
await this.send('Input.dispatchKeyEvent', { key: 'l', modifiers: 10 });

// After (works!):
// 1. Press Ctrl down
// 2. Press Shift down  
// 3. Press L down/up
// 4. Release Shift
// 5. Release Ctrl
```

---

### Problem 2: Typing Text Into Chat

**What happened:** We tried 3 different ways to type text:

1. ❌ `Input.insertText` - First attempt, didn't work with Monaco editor
2. ❌ Clipboard + Ctrl+V - Clipboard API doesn't work in Electron
3. ❌ Monaco editor API - Antigravity chat isn't a Monaco editor

**What finally worked:** `Input.insertText` actually DOES work! We just had bugs in other parts of the code that made it seem broken.

```javascript
// The simple solution that works:
async typeText(text) {
    await this.send('Input.insertText', { text });
}
```

---

### Problem 3: Detecting Pending Tasks

**What happened:** We tried using the HTTP API to poll for "pending cascades" (commands waiting for approval), but it always returned empty.

**Why:** The API endpoint wasn't returning data for new conversations.

**Fix:** Instead of polling an API, we just **press Alt+Enter every few seconds**. If there's something to accept, it accepts it. If not, nothing happens. Simple!

```javascript
// Just keep pressing Alt+Enter
for (let i = 0; i < 20; i++) {
    await sleep(3000);
    await client.accept();  // Sends Alt+Enter
}
```

---

## 🚀 How It Works Now

The `cdp-flow.js` script does this:

```
1. Connect to Antigravity via CDP (port 9222)
2. Press Ctrl+Shift+L → Opens new chat
3. Type the prompt using Input.insertText
4. Press Enter → Sends the message
5. Wait and press Alt+Enter repeatedly → Accepts any pending commands
```

---

## 📁 Key Files

| File | What It Does |
|------|--------------|
| `xapi.js` | The main library - connects to CDP and simulates keys |
| `cdp-flow.js` | Automation script - runs the full flow |
| `repl.js` | Interactive mode - type commands manually |
| `debug.js` | Debug script - tests each step one by one |

---

## 🔧 Installation

```bash
cd extras/xAPI
npm install
```

---

## ▶️ Running the Flow

**Step 1:** Make sure Antigravity is running with remote debugging:
```bash
# Antigravity must be started with this flag:
--remote-debugging-port=9222
```

**Step 2:** Run the automation:
```bash
node cdp-flow.js
```

---

## 🎮 Using the REPL

For manual control:
```bash
node repl.js
```

Commands:
- `newchat` - Open new conversation
- `send Hello world` - Send a message
- `accept` - Press Alt+Enter
- `help` - Show all commands

---

## 📖 API Reference

### Sending Messages

```javascript
import AntigravityClient from './xapi.js';

const client = new AntigravityClient(9222);
await client.connect();

await client.newChat();           // Ctrl+Shift+L
await client.sendMessage('Hi!');  // Types + Enter
await client.accept();            // Alt+Enter
```

### Key Shortcuts

| Method | Shortcut | What It Does |
|--------|----------|--------------|
| `newChat()` | Ctrl+Shift+L | Open new conversation |
| `accept()` | Alt+Enter | Accept pending step |
| `reject()` | Alt+Shift+Backspace | Reject pending step |
| `toggleChatPanel()` | Ctrl+Alt+B | Show/hide chat panel |

### Modifier Keys

When using `pressKey(key, modifiers)`:
- `1` = Alt
- `2` = Ctrl  
- `8` = Shift
- Add them together: `Ctrl+Shift = 2+8 = 10`

---

## 📝 Summary

| What | Before | After |
|------|--------|-------|
| Send messages | ❌ HTTP API failed | ✅ CDP keyboard simulation |
| Key combos | ❌ Modifiers ignored | ✅ Explicit key press/release |
| Type text | ❌ Multiple failed attempts | ✅ `Input.insertText` |
| Accept tasks | ❌ API polling failed | ✅ Just press Alt+Enter |

**The lesson:** When APIs fail, simulate what a human would do! 🤖
