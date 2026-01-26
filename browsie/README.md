# Browsie - Direct CDP Controller

Pure WebSocket CDP browser control. No overhead, no waits.

## Why Direct CDP API?

**The Problem:** Most browser automation tools add layers:
```
Your Code → Selenium → WebDriver → HTTP → Browser
Your Code → Puppeteer → Node wrapper → CDP → Browser
Your Code → Playwright → Abstraction layer → CDP → Browser
```

Each layer adds latency, complexity, and failure points.

**The Solution:** Direct CDP WebSocket:
```
Your Code → WebSocket → Chrome (10ms)
```

### Why Direct API Always Wins

| Approach | Latency | Overhead |
|----------|---------|----------|
| Selenium/WebDriver | 100-500ms | HTTP, protocol translation |
| Puppeteer/Playwright | 20-50ms | Node abstractions, promise chains |
| **Direct CDP** | **<10ms** | **Zero** - native WebSocket |

### Direct API Benefits

1. **Speed** - 10-50x faster than abstraction layers
2. **Control** - Access every CDP domain (Input, DOM, Network, etc.)
3. **Simplicity** - One file, no dependencies except `ws`
4. **Reliability** - No middleware to break or update
5. **Debugging** - See exactly what's sent to Chrome

### When to Use Direct CDP

- **Always** for performance-critical automation
- **Always** for real-time browser control
- **Always** for agent/AI browser interaction
- **Always** when you need <100ms response times

The only reason to use Puppeteer/Playwright is if you need their convenience APIs and don't care about speed.

---

## Usage

```bash
node index.js                           # Interactive REPL
node index.js --url https://example.com # Open URL first
```

## Commands

| Cmd | Action | Example |
|-----|--------|---------|
| `g` | Navigate | `g https://google.com` |
| `c` | Click (hover+click) | `c 500 300` |
| `t` | Type text | `t hello world` |
| `p` | Press key | `p Enter` |
| `s` | Screenshot | `s shot.png` |
| `e` | Eval JavaScript | `e document.title` |
| `f` | Find element coords | `f textarea` |
| `r` | Scroll | `r 300` |
| `q` | Quit | `q` |

## CDP API

Direct access via `CDP` object:

```javascript
CDP.nav(url)         // Navigate
CDP.click(x, y)      // Hover + click
CDP.type(text)       // Insert text
CDP.press(key)       // Key down + up
CDP.shot(name)       // Screenshot to file
CDP.eval(js)         // Run JavaScript
CDP.find(selector)   // Get element center coords
CDP.scroll(deltaY)   // Mouse wheel

// Raw events
CDP.move(x, y)       // Mouse move
CDP.down(x, y)       // Mouse press
CDP.up(x, y)         // Mouse release
CDP.keyDown(key)     // Key down
CDP.keyUp(key)       // Key up
```

## Performance

- CDP WebSocket: ~10ms per command
- Navigate: ~80ms
- Click + Type: <50ms

## Port

Uses port `9223` to avoid conflicts. Chrome launches automatically if not running.
