---
description: Full xAPI flow - new chat, send message, accept using REPL only
---

# xAPI Full Flow Workflow

## ⛔ ABSOLUTE RULES ⛔

> [!CAUTION]
> **ONLY** use `send_command_input` to type into `xapi>` prompt
> **ONLY** use `read_terminal` to see responses
> **NEVER** use `browser_subagent`
> **NEVER** create code files - use REPL commands only

---

## Step 1: Start xAPI REPL

// turbo
```bash
cd c:\Users\wk23aau\Documents\GPI\extras\xAPI && node repl.js
```

Wait 2000ms for REPL to connect and show `xapi>` prompt.

---

## Step 2: Create New Chat

// turbo
```
newchat
```

Sends **Ctrl+Shift+L** - creates new chat AND focuses input automatically.
Wait 1000ms.

---

## Step 3: Type Message and Send

// turbo
```
send <your message here>
```

**No focus command needed** - input is already focused after `newchat`.
This types the message via `Input.insertText` then presses **Enter**.
Wait 3000ms+ for agent response.

---

## Step 4: Accept (if prompted)

// turbo
```
accept
```

Sends **Alt+Enter** to accept the current agent step.
Repeat as needed for each pending step.

---

## Key Mappings

| Command | Keys Sent |
|---------|-----------|
| `newchat` | Ctrl+Shift+L |
| `send <msg>` | insertText + Enter |
| `accept` | Alt+Enter |
| `reject` | Alt+Shift+Backspace |

---

## Complete Example

```
xapi> newchat
✓ New chat (Ctrl+Shift+L)

xapi> send Create a hello world function
✓ Message sent

xapi> accept
✓ Accept (Alt+Enter)
```

// turbo-all
