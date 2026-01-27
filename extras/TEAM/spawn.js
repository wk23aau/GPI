/**
 * Agent Orchestrator - Spawns Vision + Executor agents via Cascade API
 * 
 * Agents receive prompts that instruct them to:
 * 1. Find the running REPL terminal
 * 2. Use send_command_input to type commands
 * 3. NEVER use run_command
 * 4. Stay in REPL loop forever
 */
import api from '../../api.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORLD_FILE = path.join(__dirname, 'world.json');

// System prompts for agents - REPL via send_command_input
const EXECUTOR_PROMPT = `You are the EXECUTOR AGENT for browser automation.

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
  Page.navigate {"url":"https://indeed.com"}

Click (need BOTH events):
  Input.dispatchMouseEvent {"type":"mousePressed","x":300,"y":400,"button":"left","clickCount":1}
  Input.dispatchMouseEvent {"type":"mouseReleased","x":300,"y":400,"button":"left"}

Type text:
  Input.insertText {"text":"search query"}

Scroll:
  window.scrollBy(0, 500)

## LOOP PATTERN

1. send_command_input → __cdp.ui()\\n
2. send_command_input → __cdp.find("target")\\n
3. send_command_input → click at coordinates
4. Repeat forever

NEVER STOP. Keep looping until task is complete.`;

const VISION_PROMPT = `You are the VISION AGENT for browser automation.

## ⛔ ABSOLUTE RULES ⛔

> [!CAUTION]
> **NEVER** use run_command - FORBIDDEN
> **NEVER** use browser_subagent - FORBIDDEN
> **NEVER** create or edit files  
> **NEVER** spawn processes
> **ONLY** use send_command_input to type into the running REPL
> **ONLY** use read_terminal to see responses

## How to Use send_command_input

ALWAYS use this exact format:
send_command_input({
  CommandId: "<TERMINAL_UUID>",
  Input: "__cdp.state()\\n",
  WaitMs: 2000,
  SafeToAutoRun: true
})

- CommandId: The terminal UUID provided below
- Input: Command followed by \\n (newline)
- SafeToAutoRun: ALWAYS true

## REPL Commands

Screenshot:
  Page.captureScreenshot {"format":"jpeg","quality":50}

Page state:
  __cdp.state()
  __cdp.ui()

Update world state:
  __cdp.world.VISION_STATUS = "analyzing"
  __cdp.world.VISION_PLAN = {elements: [...], ts: Date.now()}

## LOOP PATTERN

1. send_command_input → __cdp.state()\\n
2. Analyze the response
3. send_command_input → update __cdp.world.VISION_PLAN
4. Repeat forever

NEVER STOP. Keep observing and reporting.`;

// ═══════════════════════════════════════════════════════════════════
// Read REPL Session File
// ═══════════════════════════════════════════════════════════════════

const SESSION_FILE = path.join(__dirname, 'repl-session.json');

function readReplSession() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            console.log('📄 Found REPL session:', data.targetTitle?.slice(0, 40));
            return data;
        }
    } catch (e) {
        console.error('⚠️ Could not read session file:', e.message);
    }
    return null;
}

function isReplAlive(session) {
    if (!session?.pid) return false;
    try {
        process.kill(session.pid, 0); // Check if process exists
        return true;
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════
// Agent Spawner
// ═══════════════════════════════════════════════════════════════════

export async function spawnAgent(port, csrfToken, agentType, taskDescription) {
    const cascadeResult = await api.startCascade(port, csrfToken);

    if (!cascadeResult.ok) {
        return { error: 'Failed to start cascade', details: cascadeResult };
    }

    const cascadeId = cascadeResult.data?.cascadeId;
    if (!cascadeId) {
        return { error: 'No cascade ID returned', details: cascadeResult };
    }

    let systemPrompt = agentType === 'vision' ? VISION_PROMPT : EXECUTOR_PROMPT;

    const message = `${systemPrompt}

═══════════════════════════════════════════════════════════════
STEP 1: START THE REPL (kill existing first)
═══════════════════════════════════════════════════════════════

First, run this command to kill any existing REPL and start fresh:
  cd c:/Users/wk23aau/Documents/GPI/extras/TEAM && taskkill /f /im node.exe 2>nul; node index.js

NOTE: The taskkill may show error if no node running - that's OK.
The run_command response will give you the CommandId (UUID).
Save that CommandId - you'll need it for send_command_input.

TASK: ${taskDescription}

START NOW - run the command above.`;

    console.log('📤 Sending task to agent...');
    const sendResult = await api.sendMessage(port, csrfToken, cascadeId, message);

    // Helper: Poll for pending and accept
    async function pollAndAccept(label, maxPolls = 20) {
        console.log(`⏳ [${label}] Polling for pending...`);
        for (let poll = 0; poll < maxPolls; poll++) {
            await new Promise(r => setTimeout(r, 500));
            try {
                const trajResponse = await api.getTrajectory(port, csrfToken, cascadeId);
                if (trajResponse.ok && trajResponse.data?.trajectory) {
                    const traj = trajResponse.data.trajectory;
                    const steps = traj.steps || [];
                    for (let i = steps.length - 1; i >= 0; i--) {
                        const step = steps[i];
                        const status = step.status || '';
                        const stepType = step.type || '';

                        if (status.includes('WAITING') || status.includes('PENDING')) {
                            console.log(`✓ [${label}] Found pending at step ${i} (${stepType.slice(-25)})`);

                            // Use appropriate accept function based on step type
                            if (stepType.includes('SEND_COMMAND_INPUT')) {
                                await api.acceptSendInput(port, csrfToken, cascadeId, traj.trajectoryId, i, '');
                                console.log(`✓ [${label}] Accepted (send input)`);
                            } else if (stepType.includes('RUN_COMMAND')) {
                                await api.acceptRunCommand(port, csrfToken, cascadeId, traj.trajectoryId, i, '');
                                console.log(`✓ [${label}] Accepted (run command)`);
                            } else {
                                await api.acceptCommand(port, csrfToken, cascadeId, traj.trajectoryId, i, '');
                                console.log(`✓ [${label}] Accepted (generic)`);
                            }
                            return true;
                        }
                    }
                }
            } catch (e) { }
            if (poll % 3 === 0) process.stdout.write('.');
        }
        console.log(`\n⚠️ [${label}] No pending found`);
        return false;
    }

    // Keep accepting pending commands continuously
    console.log('🔄 Auto-accepting agent actions...');
    let consecutiveIdleRounds = 0;
    const MAX_IDLE_ROUNDS = 3;

    for (let round = 0; round < 100; round++) {
        const accepted = await pollAndAccept(`Round ${round + 1}`, 10);
        if (accepted) {
            consecutiveIdleRounds = 0;
        } else {
            const trajResponse = await api.getTrajectory(port, csrfToken, cascadeId);
            const status = trajResponse.data?.status || '';

            if (status.includes('ERROR')) {
                console.log(`❌ Cascade error: ${status}`);
                break;
            }

            if (status.includes('IDLE') || status.includes('DONE')) {
                consecutiveIdleRounds++;
                console.log(`⏸️ Idle round ${consecutiveIdleRounds}/${MAX_IDLE_ROUNDS}`);
                if (consecutiveIdleRounds >= MAX_IDLE_ROUNDS) {
                    console.log(`✓ Cascade status: ${status} (stable)`);
                    break;
                }
            }
        }
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('✓ Agent spawn complete');

    return {
        ok: sendResult.ok,
        agentType,
        cascadeId,
        task: taskDescription
    };
}

export async function spawnDualAgents(port, csrfToken, taskDescription) {
    const [visionResult, executorResult] = await Promise.all([
        spawnAgent(port, csrfToken, 'vision', `Observe and report: ${taskDescription}`),
        spawnAgent(port, csrfToken, 'executor', taskDescription)
    ]);

    const world = {
        task: taskDescription,
        agents: {
            vision: visionResult,
            executor: executorResult
        },
        spawnedAt: new Date().toISOString(),
        protocol: {
            EPOCH: Date.now(),
            ACTION_ID: 0,
            VISION_ACK: 0,
            EXEC_STATUS: 'spawned',
            VISION_STATUS: 'spawned'
        }
    };

    fs.writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2));

    return {
        ok: visionResult.ok && executorResult.ok,
        vision: visionResult,
        executor: executorResult,
        worldFile: WORLD_FILE
    };
}

// ═══════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════

if (process.argv[1]?.includes('spawn')) {
    const args = process.argv.slice(2);

    const agentType = args[0] || 'executor';
    const task = args.slice(1).join(' ') || 'Explore the current page';

    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port) {
        console.error('❌ Antigravity not running');
        process.exit(1);
    }

    if (!config?.csrfToken) {
        console.error('❌ Missing CSRF_TOKEN in .env');
        process.exit(1);
    }

    console.log(`🔗 Port: ${port}`);
    console.log(`🤖 Spawning ${agentType} agent...`);
    console.log(`📋 Task: ${task}\n`);

    if (agentType === 'dual' || agentType === 'both') {
        const result = await spawnDualAgents(port, config.csrfToken, task);
        console.log('Result:', JSON.stringify(result, null, 2));
    } else {
        const result = await spawnAgent(port, config.csrfToken, agentType, task);
        console.log('Result:', JSON.stringify(result, null, 2));
    }
}

export default {
    spawnAgent,
    spawnDualAgents,
    readReplSession,
    isReplAlive,
    VISION_PROMPT,
    EXECUTOR_PROMPT
};
