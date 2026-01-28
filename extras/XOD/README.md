# XOD - Real-Time Browser Automation

**30 Hz closed-loop CDP control with streaming perception.**

Inspired by autonomous vehicle architectures: continuous sensing, fast reflexes, smooth control.

## Quick Start

```bash
# 1. Start Chrome with CDP
chrome --remote-debugging-port=9222

# 2. Install dependencies
cd extras/XOD && npm install

# 3. Run XOD
npm start
```

## Architecture

```
┌─────────────────┐        ┌─────────────────┐       ┌──────────────┐
│  Page Agent     │◄──────►│  Executor Loop  │◄─────►│  REPL/HIM    │
│  (60 fps rAF)   │ deltas │  (30-120 Hz)    │ goals │  (async)     │
└─────────────────┘        └─────────────────┘       └──────────────┘
       │                           │
       ▼                           ▼
 MutationObserver          Input.dispatchMouseEvent
 ResizeObserver            Smooth glide paths
 Focus tracking            Time-budgeted actions
```

## REPL Commands

| Command | Description |
|---------|-------------|
| `state` | Show current page state |
| `ui` | List clickable elements |
| `find <text>` | Find element by text content |
| `goto <url>` | Navigate to URL |
| `click <x> <y>` | Click at coordinates |
| `glide <x> <y>` | Smooth move to position |
| `type <text>` | Type text into focused element |
| `key <key>` | Press key (Enter, Tab, etc.) |
| `watch <selector>` | Watch selector for visibility changes |
| `start` | Start 30 Hz executor loop |
| `stop` | Stop executor loop |
| `shot` | Take screenshot |

## Key Features

### 1. Streaming Perception
Page agent runs at 60 fps, pushing deltas to a ring buffer. No DOM re-analysis.

### 2. Smooth Input
Mouse glides with 20-40 micro-moves. No teleporting.

### 3. Reflex System
Fast local rules handle common patterns (cookie banners, scroll into view) without model latency.

### 4. Escalation Triggers
Only invoke expensive models when: navigation, repeated failures, stuck, ambiguous UI.

### 5. Visual Overlay
Fake cursor with click ripples for demos and debugging.

## Files

| File | Purpose |
|------|---------|
| `index.js` | Main entry, CDP client, REPL |
| `agent.js` | Injectable page perception (60 fps) |
| `executor.js` | 30 Hz tick loop engine |
| `input.js` | Smooth mouse/keyboard dispatch |
| `overlay.js` | Visual cursor overlay |
| `reflexes.js` | Fast local decision rules |
| `escalation.js` | HIM trigger conditions |

## API Usage

```javascript
import { CDP } from './index.js';
import { Executor } from './executor.js';

const cdp = new CDP(9222);
await cdp.connect();
await cdp.injectAgent();

const exec = new Executor(cdp);
exec.start();

// Smooth click at position
await exec.clickAt(500, 300);

// Find and click element by text
const el = await exec.findByText('Submit');
if (el) await exec.clickAt(el.x, el.y);
```

## Why XOD?

Traditional automation (Puppeteer, Playwright) is request/response. You wait for each action to complete.

XOD is **continuous**. The executor runs at 30 Hz whether you're commanding it or not. Perception never stops. Input is queued and budgeted. The REPL is just a steering wheel.

This is how AV systems work. This is how you get "instant" hover menus and human-like interaction.
