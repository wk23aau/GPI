# CDP REPL - AI Browser Automation

**Best method for AI automation**: Direct WebSocket to Chrome DevTools Protocol with an interactive REPL.

## Why REPL is Superior for AI

| Approach | Latency | Flexibility | AI Control |
|----------|---------|-------------|------------|
| Puppeteer/Playwright | High (abstraction overhead) | Limited to API | Scripted |
| Selenium | Very High | Framework-bound | Scripted |
| **CDP REPL** | **~50ms** | **Full CDP access** | **Interactive** |

### Key Insights

1. **SSH is just plumbing** - The transport layer doesn't matter. What matters is giving AI direct WebSocket access to CDP.

2. **Blank script, all domains** - The minimal approach wins. Enable all CDP domains, expose the REPL, let AI decide what to do.

3. **0.2s polling > hardcoded waits** - Poll for element readiness every 200ms instead of guessing wait times.

4. **AI sends commands interactively** - No pre-written script. AI observes (screenshot), decides, acts (CDP command), repeats.

## Quick Start

### 1. Launch Chrome with CDP exposed
```bash
chrome --remote-debugging-port=9222 --user-data-dir="./chrome-profile"
```

### 2. Run the REPL
```bash
node extras/cdp.js
```

### 3. Send commands
```
cdp> Page.navigate {"url":"https://google.com"}
cdp> document.title
cdp> Page.captureScreenshot {"format":"jpeg","quality":50}
```

## Module Usage

```javascript
import CDP from './extras/cdp.js';

const cdp = new CDP(9222);
await cdp.connect();
await cdp.enableAll();

// Navigate with polling (no hardcoded waits)
await cdp.nav('https://google.com');
await cdp.poll('document.querySelector("input[name=q]")');

// Interact
await cdp.eval('document.querySelector("input[name=q]").focus()');
await cdp.type('search query');
await cdp.key('Enter');

// Capture result
await cdp.screenshot('result.jpg');
cdp.close();
```

## API Reference

| Method | Description |
|--------|-------------|
| `connect()` | Connect to Chrome on CDP port |
| `enableAll()` | Enable all common CDP domains |
| `send(method, params)` | Send raw CDP command |
| `eval(js)` | Evaluate JavaScript in browser |
| `nav(url)` | Navigate to URL |
| `poll(js, maxPolls)` | Poll until JS returns truthy (200ms intervals) |
| `click(x, y)` | Click at coordinates |
| `type(text)` | Insert text at focus |
| `key(key)` | Press key (e.g., 'Enter') |
| `screenshot(path, quality)` | Capture JPEG screenshot |
| `close()` | Close WebSocket connection |

## Performance Results

From actual automation sessions:

| Task | Total Time | CDP Commands |
|------|------------|--------------|
| AI Studio chat | 15-20s | ~12 commands |
| YouTube search + subscribe | 25-30s | ~15 commands |
| Google → Pinterest → pins | ~11s | ~20 commands |

**CDP command latency**: ~50-100ms per WebSocket roundtrip

## Architecture

```
┌─────────────────┐
│   AI Model      │  ← Sends CDP commands via REPL
└────────┬────────┘
         │ (Interactive REPL)
┌────────▼────────┐
│   cdp.js        │  ← Minimal WebSocket wrapper
└────────┬────────┘
         │ (WebSocket)
┌────────▼────────┐
│   Chrome CDP    │  ← Port 9222
└────────┬────────┘
         │ (Renders)
┌────────▼────────┐
│   Target Page   │
└─────────────────┘
```

No Puppeteer. No Playwright. No Selenium. Just WebSocket → CDP → Browser.

## Files

- `cdp.js` - CDP REPL module (run directly or import as module)
- `ss.js` - Quick screenshot utility
- `final-chat.jpg` - Latest screenshot from automation

## Why This Works

1. **AI can see** - Screenshots provide visual feedback
2. **AI can act** - CDP commands control browser
3. **AI can adapt** - Polling handles dynamic content
4. **No abstraction tax** - Direct CDP = lowest latency
5. **Full control** - All CDP domains available

This is browser automation reduced to its essence: observe, decide, act.
