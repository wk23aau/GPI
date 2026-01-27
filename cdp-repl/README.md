# CDP REPL

**Direct Chrome DevTools Protocol for AI automation.**

> SSH is just plumbing. All domains. Interactive REPL.  
> This is the best method for AI browser automation.

## Why REPL?

| Approach | Latency | AI Control |
|----------|---------|------------|
| Puppeteer/Playwright | High | Scripted |
| Selenium | Very High | Scripted |
| **CDP REPL** | **~50ms** | **Interactive** |

AI sends commands, observes results, adapts. No pre-written scripts.

## Quick Start

```bash
# 1. Launch Chrome with CDP
chrome --remote-debugging-port=9222

# 2. Run REPL
cd cdp-repl && npm start

# 3. Send commands
cdp> Page.navigate {"url":"https://google.com"}
cdp> document.title
cdp> Page.captureScreenshot {"format":"jpeg"}
```

## Module Usage

```javascript
import CDP from './cdp-repl/index.js';

const cdp = new CDP(9222);
await cdp.connect();
await cdp.enableAll();

// Navigate + poll (no hardcoded waits)
await cdp.nav('https://google.com');
await cdp.poll('document.querySelector("input")');

// Interact
await cdp.eval('document.querySelector("input").focus()');
await cdp.type('search');
await cdp.key('Enter');
await cdp.screenshot('result.jpg');

cdp.close();
```

## API

| Method | Description |
|--------|-------------|
| `connect()` | Connect to Chrome CDP |
| `enableAll()` | Enable all domains |
| `send(method, params)` | Raw CDP command |
| `eval(js)` | Evaluate JS in browser |
| `nav(url)` | Navigate |
| `poll(js, max)` | Poll 200ms until truthy |
| `click(x, y)` | Mouse click |
| `type(text)` | Insert text |
| `key(key)` | Keypress |
| `screenshot(path)` | JPEG screenshot |

## Architecture

```
AI Model → REPL → WebSocket → Chrome CDP → Browser
```

No abstraction. No framework. Just observe, decide, act.
