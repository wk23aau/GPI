# 🌐 Browsie - GOD Mode Browser Control

**What it does:** Take full control of any browser via CDP (Chrome DevTools Protocol). Click, type, screenshot, scroll, run JavaScript - everything!

## Quick Start

```bash
# 1. Start Antigravity with debug port
& "$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9222

# 2. Run browsie
cd GPI/browsie
node index.js
```

---

## Interactive Commands

| Command | What it does |
|---------|--------------|
| `goto <url>` | Navigate to URL |
| `click <x> <y>` | Click at coordinates |
| `click <selector>` | Click element (e.g., `click button#submit`) |
| `hover <x> <y>` | Move mouse to position |
| `type <text>` | Type text into focused element |
| `press <key>` | Press key (Enter, Tab, Escape, etc.) |
| `scroll <amount>` | Scroll (positive = down, negative = up) |
| `screenshot [name]` | Save screenshot as PNG |
| `eval <js>` | Run JavaScript and get result |
| `title` | Get page title |
| `url` | Get current URL |
| `wait <ms>` | Wait milliseconds |
| `exit` | Exit browsie |

---

## Example Session

```
🔮 browsie> goto https://google.com
🌐 Navigating to: https://google.com

🔮 browsie> type Hello World
⌨️ Typing: "Hello World"

🔮 browsie> press Enter
⌨️ Press: Enter

🔮 browsie> screenshot search_results.png
📸 Screenshot saved: search_results.png

🔮 browsie> eval document.querySelectorAll('h3').length
📤 Result: 10

🔮 browsie> exit
👋 Goodbye!
```

---

## CDP Domains Enabled (GOD Mode)

| Domain | What it controls |
|--------|------------------|
| `Page` | Navigation, screenshots, reload |
| `Network` | HTTP requests, responses |
| `DOM` | HTML elements, selectors |
| `Runtime` | JavaScript execution |
| `Input` | Keyboard, mouse events |
| `Overlay` | Element highlighting |

---

## Programmatic Usage

```javascript
import { GOD } from './index.js';

await GOD.goto('https://example.com');
await GOD.type('Hello!');
await GOD.click(100, 200);
await GOD.screenshot('result.png');
const title = await GOD.getTitle();
```

---

## Prerequisites

1. **Browser with CDP enabled:**
   ```powershell
   # Antigravity
   & "$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9222
   
   # Chrome
   chrome --remote-debugging-port=9222
   ```

2. **WebSocket package:**
   ```bash
   npm install ws
   ```
