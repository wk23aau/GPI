/**
 * GPI Swarm - Multi-agent orchestration
 * 
 * Create and manage multiple cascades, send messages to all at once,
 * and collect responses from all agents.
 * 
 * Usage:
 *   node index.js                           # Interactive swarm mode
 *   node index.js <cascade1> <cascade2>...  # Use existing cascades
 *   node index.js --new 3                   # Create 3 new cascades
 */

import api from '../api.js';
import readline from 'readline';

let swarmAgents = [];  // Array of { id, name, status }

// Initialize agents
async function initSwarm(port, csrfToken, cascadeIds = [], newCount = 0) {
    console.log('\n🐝 INITIALIZING SWARM\n');

    // Create new cascades if requested
    if (newCount > 0) {
        console.log(`Creating ${newCount} new agents...`);
        const promises = [];
        for (let i = 0; i < newCount; i++) {
            promises.push(api.startCascade(port, csrfToken));
        }
        const results = await Promise.all(promises);
        for (let i = 0; i < results.length; i++) {
            if (results[i].ok && results[i].data?.cascadeId) {
                swarmAgents.push({
                    id: results[i].data.cascadeId,
                    name: `Agent-${i + 1}`,
                    status: 'ready'
                });
            }
        }
    }

    // Add existing cascade IDs
    for (let i = 0; i < cascadeIds.length; i++) {
        swarmAgents.push({
            id: cascadeIds[i],
            name: `Agent-${swarmAgents.length + 1}`,
            status: 'ready'
        });
    }

    console.log(`\n✅ Swarm initialized with ${swarmAgents.length} agents:\n`);
    swarmAgents.forEach((a, i) => {
        console.log(`   ${i + 1}. ${a.name}: ${a.id.substring(0, 8)}...`);
    });

    return swarmAgents;
}

// Send message to all agents
async function sendToAll(port, csrfToken, message) {
    console.log(`\n📤 Sending to ${swarmAgents.length} agents: "${message.substring(0, 40)}..."\n`);

    const promises = swarmAgents.map(agent =>
        api.sendMessage(port, csrfToken, agent.id, message)
    );

    const results = await Promise.all(promises);

    results.forEach((r, i) => {
        const status = r.ok ? '✅' : '❌';
        console.log(`   ${status} ${swarmAgents[i].name}`);
    });

    return results;
}

// Get responses from all agents
async function getResponses(port, csrfToken, waitMs = 5000) {
    console.log(`\n⏳ Waiting ${waitMs / 1000}s for responses...\n`);
    await new Promise(r => setTimeout(r, waitMs));

    const responses = [];

    for (const agent of swarmAgents) {
        const result = await api.getTrajectory(port, csrfToken, agent.id);

        if (result.ok && result.data?.trajectory?.steps) {
            const steps = result.data.trajectory.steps;
            // Find latest planner response
            for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i].type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' &&
                    steps[i].plannerResponse?.response) {
                    responses.push({
                        agent: agent.name,
                        id: agent.id,
                        response: steps[i].plannerResponse.response
                    });
                    break;
                }
            }
        }
    }

    return responses;
}

// Display responses
function displayResponses(responses) {
    console.log('═'.repeat(60));
    console.log(`RESPONSES (${responses.length}/${swarmAgents.length} agents)`);
    console.log('═'.repeat(60));

    if (responses.length === 0) {
        console.log('\n⚠️ No responses yet. Try:');
        console.log('   - Use /wait 15 to increase wait time');
        console.log('   - New agents need more time to warm up');
    }

    for (const r of responses) {
        console.log(`\n🤖 ${r.agent} (${r.id.substring(0, 8)}...):`);
        console.log('─'.repeat(40));
        console.log(r.response.substring(0, 500));
        if (r.response.length > 500) console.log('...[truncated]');
    }
    console.log('');
}

// Interactive mode
async function interactiveMode(port, csrfToken) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n🐝 SWARM INTERACTIVE MODE');
    console.log('Commands:');
    console.log('  /list       - List all agents');
    console.log('  /add <id>   - Add existing cascade');
    console.log('  /new        - Create new agent');
    console.log('  /wait <sec> - Set response wait time');
    console.log('  /exit       - Exit swarm');
    console.log('  <message>   - Send to all agents\n');

    let waitTime = 8000;  // 8 seconds default

    while (true) {
        const input = await ask('\n🐝 Swarm> ');

        if (input.startsWith('/exit') || input.startsWith('/quit')) {
            console.log('👋 Exiting swarm');
            break;
        } else if (input.startsWith('/list')) {
            console.log('\nAgents:');
            swarmAgents.forEach((a, i) => {
                console.log(`   ${i + 1}. ${a.name}: ${a.id}`);
            });
        } else if (input.startsWith('/add ')) {
            const id = input.replace('/add ', '').trim();
            swarmAgents.push({
                id,
                name: `Agent-${swarmAgents.length + 1}`,
                status: 'ready'
            });
            console.log(`✅ Added ${id.substring(0, 8)}... as Agent-${swarmAgents.length}`);
        } else if (input.startsWith('/new')) {
            const result = await api.startCascade(port, csrfToken);
            if (result.ok && result.data?.cascadeId) {
                swarmAgents.push({
                    id: result.data.cascadeId,
                    name: `Agent-${swarmAgents.length + 1}`,
                    status: 'ready'
                });
                console.log(`✅ Created Agent-${swarmAgents.length}: ${result.data.cascadeId.substring(0, 8)}...`);
            }
        } else if (input.startsWith('/wait ')) {
            waitTime = parseInt(input.replace('/wait ', '')) * 1000;
            console.log(`⏱️ Wait time set to ${waitTime / 1000}s`);
        } else if (input.trim()) {
            // Send message to all
            await sendToAll(port, csrfToken, input);
            const responses = await getResponses(port, csrfToken, waitTime);
            displayResponses(responses);
        }
    }

    rl.close();
}

async function main() {
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

    // Parse arguments
    const args = process.argv.slice(2);
    let cascadeIds = [];
    let newCount = 0;

    if (args.includes('--new')) {
        const idx = args.indexOf('--new');
        newCount = parseInt(args[idx + 1]) || 2;
    } else {
        cascadeIds = args.filter(a => !a.startsWith('--'));
    }

    // Initialize swarm
    if (cascadeIds.length === 0 && newCount === 0) {
        newCount = 2;  // Default: create 2 agents
    }

    await initSwarm(port, config.csrfToken, cascadeIds, newCount);

    // Enter interactive mode
    await interactiveMode(port, config.csrfToken);
}

main().catch(console.error);
