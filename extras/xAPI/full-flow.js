#!/usr/bin/env node
/**
 * xAPI Full Flow with CDP REPL for Browser Automation
 * 
 * 1. Sends prompt telling agent to start TEAM/index.js (the CDP REPL)
 * 2. Accepts first pending command
 * 3. Waits for idle or cancels if stuck
 * 4. Sends follow-up "Use REPL directly native"
 */
import { AntigravityClient } from './xapi.js';
import windowFocus from './browsie/window-focus.js';
import api from '../../api.js';

// Clear prompt with exact command to start CDP REPL
const PROMPT = `BROWSER AUTOMATION TASK

## Step 1: Start Chrome with CDP (port 9222)
Run this EXACT command:
\`\`\`
Start-Process "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" -ArgumentList "--remote-debugging-port=9222", "--user-data-dir=C:/temp/cdp-chrome", "https://www.google.com"
\`\`\`

## Step 2: Start the CDP REPL
Run this EXACT command:
\`\`\`
cd c:\\Users\\wk23aau\\Documents\\GPI\\extras\\TEAM && node index.js
\`\`\`

This will show a \`cdp>\` prompt. Wait for it to say "✓ Connected".

## Step 3: Use ONLY the CDP REPL
Send commands to the running REPL using send_command_input:
- Navigate: \`nav https://google.com\`
- Type: \`type your search text\`
- Press Enter: \`enter\`
- Click: \`click "button text"\`
- Screenshot: \`ss\`
- UI elements: \`ui\`

## CRITICAL RULES
- NEVER use search_web tool
- NEVER use browser_subagent  
- ONLY use send_command_input to type into the cdp> REPL
- ONLY use read_terminal to see results

## Your Task
Search Google for: latest AI agent news today`;

const FOLLOW_UP = 'Use REPL directly native';

const MAX_WAIT = 60000;
const POLL_INTERVAL = 500;

async function main() {
    const client = new AntigravityClient();

    try {
        await client.connect();
        console.log('✓ Connected');

        const port = api.discoverPort();
        const config = api.loadConfig();

        if (!port || !config?.csrfToken) {
            throw new Error('Antigravity not running or missing CSRF token');
        }

        // New chat
        await client.newChat();
        console.log('✓ New chat');
        await sleep(1000);

        // Send prompt
        await client.sendMessage(PROMPT);
        console.log('✓ Prompt sent');

        // Accept first pending step
        console.log('⏳ Waiting for first pending step...');
        const first = await waitForPending(port, config.csrfToken, MAX_WAIT);

        if (first) {
            console.log(`📋 First pending: ${first.type}`);
            await windowFocus.focusAndAccept();
            console.log('✓ Accept #1');

            // Wait for agent to become idle (no pending for 10s)
            console.log('⏳ Waiting for idle...');
            const idle = await waitForIdle(port, config.csrfToken, 30000);

            if (idle) {
                console.log('✓ Agent idle');
            } else {
                console.log('⚠ Not idle, canceling...');
                // TODO: integrate cancel if needed
            }

            // Send follow-up
            await sleep(1000);
            await client.sendMessage(FOLLOW_UP);
            console.log(`📝 Sent: "${FOLLOW_UP}"`);

            // Continue accepting all pending steps
            console.log('⏳ Auto-accepting remaining steps...');
            let acceptCount = 1;
            let noMorePending = 0;

            while (acceptCount < 50 && noMorePending < 5) {
                const pending = await waitForPending(port, config.csrfToken, 15000);

                if (pending) {
                    console.log(`📋 Pending: ${pending.type}`);
                    await windowFocus.focusAndAccept();
                    acceptCount++;
                    console.log(`✓ Accept #${acceptCount}`);
                    noMorePending = 0;
                    await sleep(500);
                } else {
                    noMorePending++;
                    console.log(`...no pending (${noMorePending}/5)`);
                }
            }

            console.log(`\n✅ Flow complete (${acceptCount} accepts)`);
        } else {
            console.log('⚠ No pending step detected');
        }

        client.close();

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

async function waitForPending(port, csrfToken, maxWait) {
    const start = Date.now();

    while (Date.now() - start < maxWait) {
        try {
            const listResult = api.listCascades();
            if (listResult.ok && listResult.data?.cascades?.length > 0) {
                const latest = listResult.data.cascades[0];
                const result = await api.getTrajectory(port, csrfToken, latest.cascadeId);

                if (result.ok && result.data?.trajectory) {
                    const steps = result.data.trajectory.steps || [];
                    for (let i = 0; i < steps.length; i++) {
                        if (steps[i].status === 'CORTEX_STEP_STATUS_WAITING') {
                            return {
                                index: i,
                                type: steps[i].type?.replace('CORTEX_STEP_TYPE_', '') || 'UNKNOWN'
                            };
                        }
                    }
                }
            }
        } catch (e) { }

        await sleep(POLL_INTERVAL);
        process.stdout.write('.');
    }
    return null;
}

async function waitForIdle(port, csrfToken, maxWait) {
    const start = Date.now();
    let idleStart = null;

    while (Date.now() - start < maxWait) {
        const pending = await checkForPending(port, csrfToken);

        if (!pending) {
            if (!idleStart) idleStart = Date.now();
            // Consider idle if no pending for 5 seconds
            if (Date.now() - idleStart > 5000) {
                return true;
            }
        } else {
            idleStart = null;
        }

        await sleep(500);
        process.stdout.write('.');
    }
    return false;
}

async function checkForPending(port, csrfToken) {
    try {
        const listResult = api.listCascades();
        if (listResult.ok && listResult.data?.cascades?.length > 0) {
            const latest = listResult.data.cascades[0];
            const result = await api.getTrajectory(port, csrfToken, latest.cascadeId);

            if (result.ok && result.data?.trajectory) {
                const steps = result.data.trajectory.steps || [];
                return steps.some(s => s.status === 'CORTEX_STEP_STATUS_WAITING');
            }
        }
    } catch (e) { }
    return false;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

main();
