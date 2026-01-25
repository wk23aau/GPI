# GPI - Gravity Protocol Interface

🔮 **A simple way to talk to Antigravity AI from your own code!**

This is an API client that lets you send messages to Antigravity conversations programmatically - meaning you can write code that chats with the AI instead of typing manually.

---

## 🎯 What This Does

Antigravity is an AI coding assistant. Normally you type messages in its chat window. With GPI, you can:

- Send messages to any conversation from a script
- Build automation that talks to the AI
- Create your own tools on top of Antigravity

---

## 📖 The Story: How We Figured This Out

### The Problem

Antigravity doesn't have a public API. There's no documentation on how to talk to it from code. We wanted to send messages programmatically.

### The Solution: Watch and Learn

We used **reverse engineering** - watching what Antigravity does and copying it. Here's how:

#### Step 1: Find the Network Traffic

When you chat in Antigravity, it sends messages over the network to a "Language Server" running on your computer. We used Chrome DevTools (press F12) to see these messages.

```
Network tab → Filter by "127.0.0.1" → Watch for POST requests
```

#### Step 2: Find the Right Endpoint

We saw many different API calls. The one for sending chat messages is:

```
/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage
```

#### Step 3: Decode the Format

At first we thought it used "protobuf" (a binary format). But looking at the actual data, we discovered it's just JSON (text)! Here's what a message looks like:

```json
{
  "cascadeId": "your-conversation-id",
  "items": [{ "text": "Your message here" }],
  "metadata": {
    "ideName": "antigravity",
    "locale": "en",
    "ideVersion": "1.15.8",
    "extensionName": "antigravity"
  },
  "cascadeConfig": {
    "plannerConfig": {
      "conversational": {
        "plannerMode": "CONVERSATIONAL_PLANNER_MODE_DEFAULT",
        "agenticMode": true
      },
      "toolConfig": { ... },
      "requestedModel": {
        "model": "MODEL_PLACEHOLDER_M12"
      }
    }
  }
}
```

#### Step 4: Find the Authentication

Every request needs a special "CSRF token" - like a password that proves you're allowed to talk to the server. We found it in the request headers:

```
x-codeium-csrf-token: some-uuid-here
```

#### Step 5: Build the Client

We put it all together:
1. Find the port the Language Server is running on
2. Get the CSRF token from DevTools
3. Send JSON to the right endpoint
4. ✅ Message delivered!

---

## 🚀 Quick Start

### 0. Start Antigravity with Debug Port (Optional)

If DevTools isn't working, start Antigravity with debug port enabled:

```powershell
& "$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9222
```

---

### 1. Get Your CSRF Token

1. Open Antigravity
2. Press **F12** to open DevTools
3. Go to **Network** tab
4. Send any message in Antigravity
5. Click on a request to `127.0.0.1`
6. Look for `x-codeium-csrf-token` in the headers
7. Copy that value!

### 2. Configure GPI

Create a `.env` file:

```
CSRF_TOKEN=paste-your-token-here
```

### 3. Send a Message

```bash
node send.js <cascadeId> "Your message"
```

Example:
```bash
node send.js b02157cf-fa4b-41e8-a299-c2e0a8c42c8e "Hello from my script!"
```

Output:
```
🔗 Port: 57829
📍 Cascade: b02157cf-fa4b-41e8-a299-c2e0a8c42c8e
📤 Message: Hello from my script!

✅ Message sent!
```

---

## 📁 Modules

| Module | What it does |
|--------|--------------|
| `listcascades/` | 📋 List all conversations |
| `startcascade/` | 🆕 Create new conversation |
| `sendmessage/` | 📤 Send message to AI |
| `getresponse/` | 📥 Fetch AI's reply (after it finishes) |
| `trajectory/` | 📊 View complete history (--full, --errors, --pending, --raw) |
| `handleinteraction/` | ⚡ Accept/reject pending commands |
| `retry/` | 🔄 Retry after error (--last) |
| `streamcascade/` | 📡 Watch AI response in real-time |
| `swarm/` | 🐝 Multi-agent orchestration |
| `autoexec/` | ⚡ Model + auto-execution control (--auto, --turbo, --model) |
| `api.js` | Core API functions |

---

## 🔧 Using in Your Own Code

```javascript
import api from './api.js';

// Find Antigravity
const port = api.discoverPort();
const config = api.loadConfig();

// Send a message
const result = await api.sendMessage(
    port, 
    config.csrfToken, 
    'your-cascade-id', 
    'Hello!'
);

if (result.ok) {
    console.log('Message sent!');
}
```

### Available Functions

| Function | What it does |
|----------|-------------|
| `discoverPort()` | Finds which port the Language Server is on |
| `loadConfig()` | Loads your CSRF token from .env |
| `sendMessage(port, csrf, cascadeId, message)` | Sends a chat message |
| `getTrajectory(port, csrf, cascadeId)` | Gets conversation history |
| `startCascade(port, csrf)` | Creates a new conversation |

---

## 🤔 FAQ

**Q: What's a cascadeId?**\
A: It's the unique ID for a conversation. Every chat in Antigravity has one. You can find it in the URL or in DevTools network traffic.

**Q: Why does my CSRF token stop working?**\
A: The token changes when Antigravity restarts. Just get a new one from DevTools.

**Q: Can I use this to get AI responses?**\
A: You can send messages. Getting the streaming response is more complex - the AI's reply comes through a different endpoint (`StreamCascadeReactiveUpdates`).

---

## 🛠️ Technical Details

- **Protocol**: HTTPS to localhost
- **Content-Type**: `application/json`
- **Auth**: `x-codeium-csrf-token` header
- **Port**: Dynamically discovered from running Language Server process

---

## ⚠️ Notes

- This is reverse-engineered and may break if Antigravity updates
- The CSRF token expires when Antigravity restarts
- Keep your `.env` file private (it's in `.gitignore`)

---

## 📜 License

MIT - Do whatever you want with it!
