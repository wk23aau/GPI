---
description: Execute browser automation tasks via CDP-REPL with zero latency
---

# CDP-REPL Workflow

## ⚠️ CRITICAL RULES ⚠️

> **NEVER** create, edit, or modify code files
> **NEVER** run external scripts or write Node.js code blocks
> **ONLY** use CDP-REPL for all browser automation

---

## Prerequisites

// turbo
1. Chrome with debug port:
```bash
chrome --remote-debugging-port=9222 --window-size=430,932
```

// turbo
2. Install extension: `chrome://extensions` → Load unpacked → `cdp-repl/extension`

// turbo
3. Start REPL:
```bash
node cdp-repl
```

---

## REPL Commands (use in cdp> prompt)

4. Navigate:
```
cdp> Page.navigate {"url":"https://example.com"}
```

5. Set mobile viewport:
```
cdp> Emulation.setDeviceMetricsOverride {"width":430,"height":932,"deviceScaleFactor":2,"mobile":true}
```

6. Get elements:
```
cdp> __cdp.ui()
cdp> __cdp.find("Submit")
```

7. Click:
```
cdp> Input.dispatchMouseEvent {"type":"mousePressed","x":300,"y":400,"button":"left","clickCount":1}
cdp> Input.dispatchMouseEvent {"type":"mouseReleased","x":300,"y":400,"button":"left"}
```

8. Insert text:
```
cdp> Input.insertText {"text":"hello"}
```

9. Screenshot:
```
cdp> Page.captureScreenshot {"format":"jpeg","quality":25}
```

---

## Dual Agent Mode

// turbo
10. Start dashboard for coordinated agents:
```bash
node extras/dashboard.js
```

11. Agents coordinate via WorldState:
```
cdp> __cdp.world.EXEC_STATUS = "waiting_for_vision"
cdp> __cdp.world.VISION_STATUS = "joined"
cdp> __cdp.world.EXEC_AGREED = true
cdp> __cdp.world.VISION_AGREED = true
```
