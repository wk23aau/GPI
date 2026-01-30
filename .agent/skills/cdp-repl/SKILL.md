---
name: cdp-repl
description: Chrome DevTools Protocol REPL for zero-latency browser automation
---

# CDP-REPL Skill

Direct browser control via Chrome DevTools Protocol. **EVERYTHING happens in the REPL.**

## ⛔ ABSOLUTE RULES ⛔

> [!CAUTION]
> **NEVER** use `run_command` - FORBIDDEN
> **NEVER** use `browser_subagent` - FORBIDDEN  
> **NEVER** create, edit, or execute code files
> **NEVER** spawn external processes or scripts
> **NEVER** leave the REPL for any reason
> **ONLY** use `send_command_input` to type into `cdp>` prompt
> **ONLY** use `read_terminal` to see responses

## How To Find The Terminal ID

Look in the METADATA section of the user request for `runningTerminalCommands`. Find the terminal running "node cdp-repl" or "node index.js". The `id` field (a UUID like `2088d65f-116c-4e1d-b7bb-7ac239068169`) is what you need.

**Example from metadata:**
```json
{
  "id": "2088d65f-116c-4e1d-b7bb-7ac239068169",  ← THIS IS THE CommandId
  "commandLine": "node index.js",
  "cwd": "c:\\Users\\...\\extras\\fullPROTOCOL",
  "status": "TERMINAL_SHELL_COMMAND_STATUS_RUNNING"
}
```

**Use the UUID, NOT the command name!**
- ✅ `CommandId: "2088d65f-116c-4e1d-b7bb-7ac239068169"`
- ❌ `CommandId: "node index.js"` - WRONG!

## Send Commands

Once you have the terminal ID, send commands:

```javascript
send_command_input({
  CommandId: "2088d65f-116c-4e1d-b7bb-7ac239068169",  // UUID from metadata
  Input: "__cdp.ui()\n",  // Include \n
  WaitMs: 2000,
  SafeToAutoRun: true
})
```

## Read Response

```javascript
read_terminal({
  ProcessID: "2088d65f-116c-4e1d-b7bb-7ac239068169",
  Name: "cdp-repl"
})
```

---

## REPL Commands (type these into cdp> prompt)

### Get Current State
```
__cdp.state()           # Full page state (URL, title, UI map)
__cdp.ui()              # Interactive elements only
__cdp.find("Submit")    # Find element by text
__cdp.scan()            # Force UI refresh
```

### Navigation
```
Page.navigate {"url":"https://indeed.com"}
```

### Click (2 events required)
```
Input.dispatchMouseEvent {"type":"mousePressed","x":300,"y":400,"button":"left","clickCount":1}
Input.dispatchMouseEvent {"type":"mouseReleased","x":300,"y":400,"button":"left"}
```

### Type Text
```
Input.insertText {"text":"hello world"}
```

### Press Keys
```
Input.dispatchKeyEvent {"type":"keyDown","key":"Enter","code":"Enter","windowsVirtualKeyCode":13}
Input.dispatchKeyEvent {"type":"keyUp","key":"Enter","code":"Enter"}
```

### Screenshot (returns base64)
```
Page.captureScreenshot {"format":"jpeg","quality":25}
```

---

## Vision Pattern (Screenshot → Analyze → Act)

1. **Get UI map**: `__cdp.ui()` for clickable elements
2. **Find element**: `__cdp.find("text")` returns x,y coordinates
3. **Click**: Two mouse events at x,y
4. **Repeat**

---

## IMPORTANT REMINDERS

- **Extract UUID from metadata** - Don't use command name as ID
- **REPL is running** - Don't try to start it
- **send_command_input only** - Never run_command
- **Include \n** - Commands need newline at end
- **WaitMs 1000-2000** - Give time for response
- **Loop forever** - Never exit, never stop

---

## Vision Automation Flow

### Main Loop

```
┌─────────────────────────────────────────────────┐
│  1. VISIT TARGET                                │
│     └── Page.navigate {"url":"..."}             │
│     └── Wait for page load                      │
├─────────────────────────────────────────────────┤
│  2. ANALYSE SHOT                                │
│     └── Capture screenshot (400×640)            │
│     └── Analyze page content                    │
├─────────────────────────────────────────────────┤
│  3. FIND PROBES                                 │
│     └── __cdp.ui() to get all interactables     │
│     └── __cdp.find("text") to locate targets    │
├─────────────────────────────────────────────────┤
│  4. EXECUTE (max 2 tries per probe)             │
│     ├── Try 1 (Raw DOM):                        │
│     │   └── __cdp.find() for coords             │
│     │   └── Execute action (click/type)         │
│     ├── Try 2 (Raw DOM):                        │
│     │   └── __cdp.find() for coords             │
│     │   └── Execute action                      │
│     ├── If DOM failed 2x → VISION FALLBACK:     │
│     │   └── Capture screenshot                  │
│     │   └── Vision-based coord analysis         │
│     │   └── Execute via vision coords           │
│     └── Move to next probe                      │
├─────────────────────────────────────────────────┤
│  5. NEXT SHOT                                   │
│     └── Capture new screenshot                  │
│     └── Go to step 2 (ANALYSE)                  │
└─────────────────────────────────────────────────┘
```

### Execution Pattern

```javascript
// For each probe:
for (let attempt = 1; attempt <= 2; attempt++) {
    // 1. Capture shot
    Page.captureScreenshot {"format":"jpeg","quality":50}
    
    // 2. Find coords
    __cdp.find("target text")  // → {x, y}
    
    // 3. Execute
    Input.dispatchMouseEvent {"type":"mousePressed","x":X,"y":Y,...}
    Input.dispatchMouseEvent {"type":"mouseReleased","x":X,"y":Y,...}
    
    // 4. Check success, break if done
}
// Move to next probe
```

### Retry Logic

| Attempt | Action |
|---------|--------|
| Try 1 | Capture → Find → Execute |
| Try 2 | Re-capture → Re-find → Re-execute |
| After 2 | Move to next probe |
