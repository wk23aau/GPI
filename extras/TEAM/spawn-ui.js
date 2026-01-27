/**
 * Spawn UI - Hybrid API + UI automation agent spawner
 * 
 * Uses API to start cascade, then switches to PyAutoGUI for interaction
 * 
 * Usage:
 *   node spawn-ui.js "Navigate to Google"
 */
import api from '../../api.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMAND_FILE = path.join(__dirname, 'command.txt');

// Agent prompt - uses REPL via send_command_input (UI will accept)
const AGENT_PROMPT = `You are the EXECUTOR AGENT for browser automation.

## ⛔ ABSOLUTE RULES ⛔

> [!CAUTION]
> **NEVER** use browser_subagent - FORBIDDEN
> **NEVER** create or edit files
> **ONLY** use send_command_input to type into the running REPL
> **ONLY** use read_terminal to see responses

## How to Use send_command_input

ALWAYS use this exact format:
send_command_input({
  CommandId: "{{TERMINAL_UUID}}",
  Input: "__cdp.ui()\\n",
  WaitMs: 2000,
  SafeToAutoRun: true
})

## REPL Commands (type these via send_command_input)

Get page state:
  __cdp.ui()
  __cdp.state()
  __cdp.find("Button Text")

Navigate:
  nav https://google.com

Click element:
  click "Apply Now"

Type text:
  type "search query"

## LOOP PATTERN

1. send_command_input → __cdp.ui()\\n
2. Analyze response
3. send_command_input → action command
4. Repeat until task complete

NEVER STOP. Keep looping until task is complete.`;

/**
 * Write command for Python UI bridge
 */
function sendUICommand(command) {
    fs.writeFileSync(COMMAND_FILE, command, 'utf-8');
    console.log(`📤 UI Command: ${command.slice(0, 50)}...`);
}

/**
 * Start Python UI bridge in background
 */
function startUIBridge() {
    const pythonProcess = spawn('python', [
        path.join(__dirname, 'ui-bridge.py'),
        '--watch',
        COMMAND_FILE
    ], {
        detached: true,
        stdio: 'ignore'
    });

    pythonProcess.unref();
    console.log('🐍 UI Bridge started');
    return pythonProcess;
}

/**
 * Wait for cascade to reach idle state
 */
async function waitForIdle(port, csrfToken, cascadeId, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 1000));

        const trajResponse = await api.getTrajectory(port, csrfToken, cascadeId);
        const status = trajResponse.data?.status || '';

        if (status.includes('IDLE') || status.includes('DONE')) {
            console.log(`✓ Cascade status: ${status}`);
            return true;
        }

        if (status.includes('ERROR')) {
            console.log(`❌ Cascade error: ${status}`);
            return false;
        }

        if (i % 10 === 0) {
            console.log(`⏳ Waiting for cascade... (${i}s)`);
        }
    }

    console.log('⚠️ Timeout waiting for cascade');
    return false;
}

/**
 * Main spawn function
 */
async function spawnWithUI(task) {
    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port) {
        console.error('❌ Antigravity not running');
        return { ok: false, error: 'No port' };
    }

    if (!config?.csrfToken) {
        console.error('❌ Missing CSRF_TOKEN');
        return { ok: false, error: 'No token' };
    }

    console.log(`🔗 Port: ${port}`);
    console.log(`📋 Task: ${task}\n`);

    // Clear command file
    fs.writeFileSync(COMMAND_FILE, '', 'utf-8');

    // Start Python UI bridge
    startUIBridge();
    await new Promise(r => setTimeout(r, 1000));

    // Step 1: Start cascade via API
    console.log('📤 Starting cascade via API...');
    const cascadeResult = await api.startCascade(port, config.csrfToken);

    if (!cascadeResult.ok) {
        return { ok: false, error: 'Failed to start cascade' };
    }

    const cascadeId = cascadeResult.data?.cascadeId;
    console.log(`✓ Cascade: ${cascadeId}`);

    // Step 2: Send initial prompt via API
    const initialMessage = `${AGENT_PROMPT}

═══════════════════════════════════════════════════════════════
STEP 1: START THE REPL
═══════════════════════════════════════════════════════════════

Run this command:
  cd c:/Users/wk23aau/Documents/GPI/extras/TEAM && taskkill /f /im node.exe 2>nul; node index.js

The run_command response will give you the CommandId (UUID).

TASK: ${task}

START NOW.`;

    console.log('📤 Sending initial prompt via API...');
    await api.sendMessage(port, config.csrfToken, cascadeId, initialMessage);

    // Step 3: Use UI bridge to accept actions
    console.log('🔄 Using UI to accept pending actions...');

    // Give the cascade time to generate actions
    await new Promise(r => setTimeout(r, 3000));

    // Send accept commands via UI
    for (let i = 0; i < 10; i++) {
        sendUICommand('ACCEPT');
        await new Promise(r => setTimeout(r, 2000));

        // Check if cascade is idle
        const trajResponse = await api.getTrajectory(port, config.csrfToken, cascadeId);
        const status = trajResponse.data?.status || '';

        if (status.includes('IDLE')) {
            console.log(`✓ Cascade completed`);
            break;
        }
    }

    // Step 4: Send follow-up via UI if needed
    console.log('📤 Sending follow-up via UI...');
    sendUICommand(`SEND:Continue with the task: ${task}`);

    return {
        ok: true,
        cascadeId,
        task
    };
}

// CLI
if (process.argv[1]?.includes('spawn-ui')) {
    const task = process.argv.slice(2).join(' ') || 'Navigate to Google';

    spawnWithUI(task).then(result => {
        console.log('\nResult:', JSON.stringify(result, null, 2));

        // Stop UI bridge
        fs.writeFileSync(COMMAND_FILE, 'EXIT', 'utf-8');
    });
}

export default { spawnWithUI };
