#!/usr/bin/env node
/**
 * xAPI Auto-Accept - Listens for pending interactions and accepts via key
 * 
 * Polls the GetCascadeTrajectory API for pending steps (BLOCKED_ON_USER_INPUT)
 * and sends Alt+Enter when found.
 * 
 * Uses keyboard simulation (Alt+Enter), not API calls for accepting.
 * 
 * Usage: node auto-accept.js <cascadeId>
 */
import { AntigravityClient } from './xapi.js';
import api from '../../api.js';

const POLL_INTERVAL = 1000; // Check every 1 second

async function main() {
    const cascadeId = process.argv[2];

    if (!cascadeId) {
        console.log('Usage: node auto-accept.js <cascadeId>');
        console.log('');
        console.log('Listens for pending steps and accepts via Alt+Enter key.');
        process.exit(1);
    }

    const client = new AntigravityClient();
    await client.connect();
    console.log('✓ Connected to Antigravity');

    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port || !config?.csrfToken) {
        console.error('❌ Antigravity not running or missing CSRF token');
        process.exit(1);
    }

    console.log(`🔗 Port: ${port}`);
    console.log(`📍 Watching cascade: ${cascadeId}`);
    console.log(`⏱️  Polling every ${POLL_INTERVAL}ms for pending steps...`);
    console.log('Press Ctrl+C to stop.\n');

    let lastAcceptedStep = -1;

    async function checkForPending() {
        try {
            const response = await api.getTrajectory(port, config.csrfToken, cascadeId);

            if (!response.ok || !response.data) return;

            const trajectory = response.data;

            // Look for steps that are waiting for user input
            // Check the turns/steps for BLOCKED_ON_USER_INPUT status
            const turns = trajectory.turns || [];

            for (const turn of turns) {
                const steps = turn.steps || [];

                for (let i = 0; i < steps.length; i++) {
                    const step = steps[i];

                    // Check if step is pending (waiting for user input)
                    if (step.status === 'BLOCKED_ON_USER_INPUT' ||
                        step.blockedOnUserInput ||
                        step.pendingUserAction) {

                        const stepIndex = step.stepIndex || i;

                        if (stepIndex > lastAcceptedStep) {
                            console.log(`\n⏳ Pending step detected!`);
                            console.log(`   Step index: ${stepIndex}`);
                            console.log(`   Type: ${step.type || step.toolName || 'unknown'}`);
                            console.log(`   Sending Alt+Enter...`);

                            // Send accept via keyboard
                            await client.accept();
                            console.log(`✅ Accept sent (Alt+Enter)`);

                            lastAcceptedStep = stepIndex;
                            return; // Only accept one at a time
                        }
                    }
                }
            }
        } catch (e) {
            // Ignore polling errors silently
            if (e.message && !e.message.includes('timeout')) {
                console.error('Poll error:', e.message);
            }
        }
    }

    // Start polling
    setInterval(checkForPending, POLL_INTERVAL);
    checkForPending(); // Initial check
}

main().catch(console.error);
