# CDP WorldState Extension

**Push-based WorldState streaming for CDP REPL.**

Eliminates round-trips by continuously updating `window.__cdp.world` with fresh page state.

## Install

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this `extension` folder

## Usage from CDP REPL

```javascript
// WorldState is always fresh - no queries needed
__cdp.world.url          // Current URL
__cdp.world.title        // Page title
__cdp.world.readyState   // loading/interactive/complete
__cdp.world.uiMap        // All visible interactables with coords
__cdp.world.errors       // Recent errors
__cdp.world.toasts       // Toast/alert notifications

// Helpers
__cdp.find('Subscribe')      // Find element by text → {x, y, text, ...}
__cdp.clickCoords('Submit')  // Get click coordinates → {x, y}
__cdp.ui()                   // Full UI map
__cdp.state()                // State snapshot
__cdp.isIdle()               // Network idle + DOM complete?
__cdp.pageText()             // Last 2000 chars of page text
__cdp.ssName()               // Generate screenshot filename
__cdp.scan()                 // Force rescan UI map
```

## Speed Gain

```
Before (pull):                After (push):
├─ Query DOM (100ms)          ├─ __cdp.world ready
├─ Process                    ├─ Execute (50ms)
├─ Execute (50ms)             └─ Done
├─ Query result (100ms)       
└─ Total: 250ms+              Total: 50ms (5x faster)
```

## Architecture

```
Content Script (content.js)
├── MutationObserver → uiMap updates
├── Error/toast capture
├── Focus tracking
└── Exposes window.__cdp

CDP REPL
├── Runtime.evaluate('__cdp.world')
├── No polling needed
└── Act on fresh state
```

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `__cdp.world` | WorldState | Full state object |
| `__cdp.find(text)` | Element | First element matching text |
| `__cdp.findAll(text)` | Element[] | All elements matching text |
| `__cdp.clickCoords(text)` | {x,y} | Click coordinates for element |
| `__cdp.ui()` | Element[] | Full UI map |
| `__cdp.state()` | Object | State snapshot |
| `__cdp.isIdle()` | boolean | Network idle check |
| `__cdp.pageText(len)` | string | Page text (last N chars) |
| `__cdp.focused()` | Element | Currently focused element |
| `__cdp.ssName(prefix)` | string | Screenshot filename with timestamp |
| `__cdp.scan()` | number | Force rescan, returns element count |

## WorldState Object

```javascript
{
    url: string,
    title: string,
    readyState: 'loading' | 'interactive' | 'complete',
    uiMap: [{
        tag: string,
        type: string,
        text: string,
        id: string | null,
        x: number,  // center x
        y: number,  // center y
        w: number,  // width
        h: number   // height
    }],
    networkInflight: number,
    errors: [{ msg: string, ts: number }],
    toasts: [{ text: string, ts: number }],
    focusedElement: string | null,
    ts: number  // last update timestamp
}
```
