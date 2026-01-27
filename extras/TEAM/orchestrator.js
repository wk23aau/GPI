/**
 * Orchestrator - Starts REPL and spawns agents with terminal UUID
 * 
 * This script:
 * 1. Starts the CDP REPL (node index.js) via Antigravity run_command
 * 2. Captures the Command ID (terminal UUID)
 * 3. Spawns agents with that UUID so they can use send_command_input
 * 
 * Usage:
 *   node orchestrator.js "Apply to QA jobs on Indeed"
 *   node orchestrator.js --vision "Monitor the job application"
 *   node orchestrator.js --dual "Full automation task"
 */
import api from '../../api.js';
import { spawnAgent, spawnDualAgents } from './spawn.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, 'repl-session.json');

// ═══════════════════════════════════════════════════════════════════
// Start REPL and capture terminal UUID
// ═══════════════════════════════════════════════════════════════════

async function startReplViaAntigravity(port, csrfToken) {
    console.log('🚀 Starting CDP REPL via Antigravity...');

    // Use the Cascade API to run a command
    // This will return a command ID that we can use
    const cascadeResult = await api.startCascade(port, csrfToken);

    if (!cascadeResult.ok) {
        throw new Error('Failed to start cascade: ' + JSON.stringify(cascadeResult));
    }

    const cascadeId = cascadeResult.data?.cascadeId;
    if (!cascadeId) {
        throw new Error('No cascade ID returned');
    }

    // Send a message to run the REPL command
    const message = `Run this command and return the Command ID:
    
run_command({
    CommandLine: "node index.js",
    Cwd: "${__dirname.replace(/\\/g, '\\\\')}",
    SafeToAutoRun: true,
    WaitMsBeforeAsync: 3000
})

IMPORTANT: Return the Command ID from the response. This is the terminal UUID.`;

    await api.sendMessage(port, csrfToken, cascadeId, message);

    // Wait for the command to start and capture the ID
    // Note: This is a simplified version - in practice you'd poll for the response
    console.log('⏳ Waiting for REPL to start...');
    await new Promise(r => setTimeout(r, 5000));

    return cascadeId;
}

// Alternative: Start REPL directly as a child process
async function startReplDirect() {
    console.log('🚀 Starting CDP REPL directly...');

    const child = spawn('node', ['index.js'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
    });

    // Generate a UUID for this terminal
    const terminalUUID = `terminal-${child.pid}-${Date.now()}`;

    // Update session file with terminal UUID
    let session = {};
    try {
        session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    } catch { }

    session.terminalUUID = terminalUUID;
    session.childPid = child.pid;
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

    // Wait for REPL to be ready
    await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('REPL startup timeout')), 10000);

        child.stdout.on('data', (data) => {
            output += data.toString();
            process.stdout.write(data);
            if (output.includes('HTTP API:') || output.includes('cdp>')) {
                clearTimeout(timeout);
                resolve();
            }
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        child.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    console.log(`✓ REPL started with terminal UUID: ${terminalUUID}`);
    return { terminalUUID, child };
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2);

    // Parse flags
    let agentType = 'executor';
    if (args.includes('--vision')) {
        agentType = 'vision';
        args.splice(args.indexOf('--vision'), 1);
    } else if (args.includes('--dual') || args.includes('--both')) {
        agentType = 'dual';
        args.splice(args.findIndex(a => a === '--dual' || a === '--both'), 1);
    }

    // Check for existing terminal UUID (manual mode)
    let terminalUUID = null;
    const terminalIdArg = args.find(a => a.startsWith('--terminal-id='));
    if (terminalIdArg) {
        terminalUUID = terminalIdArg.split('=')[1];
        args.splice(args.indexOf(terminalIdArg), 1);
    }

    const task = args.join(' ') || 'Explore the current page';

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

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CDP Orchestrator');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📋 Task: ${task}`);
    console.log(`🤖 Agent: ${agentType}`);
    console.log();

    // If no terminal UUID provided, check if REPL already running
    if (!terminalUUID) {
        try {
            const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            if (session.terminalUUID) {
                terminalUUID = session.terminalUUID;
                console.log(`✓ Found existing terminal UUID: ${terminalUUID}`);
            }
        } catch {
            console.log('⚠️ No existing REPL session found');
            console.log('');
            console.log('To use this orchestrator:');
            console.log('1. Start REPL in Antigravity using run_command');
            console.log('2. Copy the Command ID from the response');
            console.log('3. Run: node orchestrator.js --terminal-id=<UUID> "Your task"');
            console.log('');
            console.log('Or provide --terminal-id=<UUID> directly');
            process.exit(1);
        }
    }

    console.log();
    console.log(`🔑 Terminal UUID: ${terminalUUID}`);
    console.log();

    // Spawn agents
    if (agentType === 'dual') {
        console.log('🚀 Spawning dual agents (Vision + Executor)...');
        const result = await spawnDualAgents(port, config.csrfToken, task, terminalUUID);
        console.log('\nResult:', JSON.stringify(result, null, 2));
    } else {
        console.log(`🚀 Spawning ${agentType} agent...`);
        const result = await spawnAgent(port, config.csrfToken, agentType, task, terminalUUID);
        console.log('\nResult:', JSON.stringify(result, null, 2));
    }
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
