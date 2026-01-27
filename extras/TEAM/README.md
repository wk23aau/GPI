# TEAM - Multi-Agent Browser Automation

This directory contains the multi-agent system for browser automation using the CDP REPL.

## Overview

The system consists of:

1. **CDP REPL** (`index.js`) - Chrome DevTools Protocol REPL with extension support
2. **Spawn System** (`spawn.js`) - Spawns AI agents via the Cascade API
3. **Vision Agent** (`vision-agent.js`) - Captures screenshots and updates world state
4. **World State** (`world.js`) - Shared state coordination between agents
5. **Chrome Extension** (`extension/`) - Browser-side UI element detection

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Antigravity                     │
│  ┌──────────────┐    ┌──────────────┐           │
│  │   Executor   │    │    Vision    │           │
│  │    Agent     │    │    Agent     │           │
│  └──────┬───────┘    └──────┬───────┘           │
│         │send_command_input │                    │
│         └────────┬──────────┘                    │
└──────────────────┼───────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │    CDP REPL       │
         │   (index.js)      │
         │  Port: 9223       │
         └─────────┬─────────┘
                   │ Chrome DevTools Protocol
         ┌─────────▼─────────┐
         │     Chrome        │
         │  + Extension      │
         │   Port: 9222      │
         └───────────────────┘
```

## Quick Start

### 1. Start Chrome with Remote Debugging

```bash
chrome.exe --remote-debugging-port=9222
```

### 2. Start the CDP REPL

```bash
cd extras/TEAM
node index.js
```

### 3. Spawn an Agent

```bash
node spawn.js executor "Apply to QA jobs on Indeed"
```

## Known Limitations

### send_command_input via API

When agents are spawned via the Cascade API, `send_command_input` requires manual approval in the UI. The spawn.js auto-accept loop handles this, but there may be timing issues.

**Workaround**: After spawning via API, open the cascade in the Antigravity UI to continue interaction.

## Files

| File | Description |
|------|-------------|
| `index.js` | CDP REPL main entry point |
| `spawn.js` | Agent spawner via Cascade API |
| `spawn-ui.js` | **Hybrid spawner (API + UI automation)** |
| `ui-bridge.py` | **Python UI automation via PyAutoGUI** |
| `orchestrator.js` | Multi-agent orchestration |
| `vision-agent.js` | Screenshot capture and analysis |
| `world.js` | Shared world state management |
| `cdp.js` | Chrome DevTools Protocol client |
| `extension/` | Chrome extension for UI detection |

## UI Automation (Hybrid Approach)

```bash
# Option 1: Run UI bridge, then spawn
python ui-bridge.py --watch command.txt &
node spawn-ui.js "Navigate to Google"

# Option 2: One-shot message
python ui-bridge.py "Hello from Python"
```

## REPL Commands

Once the REPL is running, you can type commands directly:

```
cdp> __cdp.ui()           # Get interactive UI elements
cdp> __cdp.state()        # Get full page state
cdp> nav https://google.com  # Navigate to URL
cdp> click "Apply Now"    # Click element by text
cdp> type "Hello World"   # Type text
cdp> enter                # Press Enter key
```
