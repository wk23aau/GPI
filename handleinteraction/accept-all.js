/**
 * Accept All - Poll and accept all pending commands via API
 * 
 * Usage: node accept-all.js [pollIntervalSeconds]
 * Default poll interval: 20 seconds
 */

import api from '../api.js';

const POLL_INTERVAL = (parseInt(process.argv[2], 10) || 20) * 1000;

// Step types that need acceptance
const PENDING_STEP_TYPES = [
    'CORTEX_STEP_TYPE_RUN_COMMAND',
    'CORTEX_STEP_TYPE_SEND_COMMAND_INPUT'
];

function findPendingSteps(trajectoryData) {
    const pending = [];
    const trajectory = trajectoryData?.trajectory;
    const steps = trajectory?.steps || [];
    const trajectoryId = trajectory?.trajectoryId;
    const cascadeId = trajectoryData?.cascadeId || trajectory?.cascadeId;

    if (!trajectoryId) {
        return pending;
    }

    steps.forEach((step, index) => {
        const stepType = step.stepType;

        // Look for run_command or send_command_input steps
        if (PENDING_STEP_TYPES.includes(stepType)) {
            // Check the step status
            const stepStatus = step.cortexStepStatus;

            // Look for steps that are waiting/pending
            // CORTEX_STEP_STATUS_WAITING means waiting for user approval
            const isWaiting = stepStatus === 'CORTEX_STEP_STATUS_WAITING' ||
                stepStatus === 'WAITING' ||
                step.status === 'pending';

            if (isWaiting) {
                let command = '';

                if (step.runCommand) {
                    command = step.runCommand.commandLine || '';
                } else if (step.sendCommandInput) {
                    command = step.sendCommandInput.input || '';
                }

                pending.push({
                    cascadeId,
                    trajectoryId,
                    stepIndex: index,
                    stepType,
                    command,
                    status: stepStatus
                });
            }
        }
    });

    return pending;
}

async function acceptAllPending(port, csrfToken) {
    try {
        // Get cascades from local storage
        const cascadesResult = api.listCascades();

        if (!cascadesResult.ok) {
            console.log('❌ Failed to list cascades:', cascadesResult.error);
            return { accepted: 0, errors: 0, checked: 0 };
        }

        const cascades = cascadesResult.data?.cascades || [];
        let accepted = 0;
        let errors = 0;
        let checked = 0;

        console.log(`   Found ${cascades.length} conversations`);

        for (const cascade of cascades) {
            const cascadeId = cascade.cascadeId;
            if (!cascadeId) continue;

            checked++;

            // Get full trajectory details
            const trajResult = await api.getTrajectory(port, csrfToken, cascadeId);

            if (!trajResult.ok) {
                console.log(`   ⚠️ Could not get trajectory for ${cascadeId.substring(0, 8)}`);
                continue;
            }

            // Add cascadeId to trajectory data
            trajResult.data.cascadeId = cascadeId;

            const pending = findPendingSteps(trajResult.data);

            if (pending.length > 0) {
                console.log(`   📋 Cascade ${cascadeId.substring(0, 8)}: ${pending.length} pending steps`);
            }

            for (const step of pending) {
                try {
                    console.log(`      🔄 Step ${step.stepIndex}: ${step.stepType}`);
                    console.log(`         Command: ${step.command.substring(0, 50)}...`);

                    const acceptResult = await api.acceptCommand(
                        port,
                        csrfToken,
                        cascadeId,
                        step.trajectoryId,
                        step.stepIndex,
                        step.command
                    );

                    if (acceptResult.ok) {
                        console.log(`         ✅ Accepted!`);
                        accepted++;
                    } else {
                        console.log(`         ⚠️ Status: ${acceptResult.status}`);
                        errors++;
                    }
                } catch (e) {
                    console.log(`         ❌ Error: ${e.message}`);
                    errors++;
                }
            }
        }

        return { accepted, errors, checked };
    } catch (e) {
        console.error('❌ Error:', e.message);
        return { accepted: 0, errors: 1, checked: 0 };
    }
}

async function poll() {
    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port) {
        console.error('❌ Antigravity not running');
        return;
    }

    if (!config?.csrfToken) {
        console.error('❌ Missing CSRF_TOKEN in .env');
        return;
    }

    console.log('════════════════════════════════════════════════════════════');
    console.log('🔄 Accept All - Polling every', POLL_INTERVAL / 1000, 'seconds');
    console.log('   Port:', port);
    console.log('   Press Ctrl+C to stop');
    console.log('════════════════════════════════════════════════════════════\n');

    // Initial check
    console.log('[Initial] Checking for pending commands...');
    const { accepted, errors, checked } = await acceptAllPending(port, config.csrfToken);
    console.log(`\n📊 Initial: Checked ${checked} cascades, ${accepted} accepted, ${errors} errors\n`);

    // Poll loop
    setInterval(async () => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n[${timestamp}] Checking for pending commands...`);

        const result = await acceptAllPending(port, config.csrfToken);

        if (result.accepted > 0 || result.errors > 0) {
            console.log(`📊 Checked ${result.checked}, ${result.accepted} accepted, ${result.errors} errors`);
        } else {
            console.log(`   ✓ Checked ${result.checked} cascades - no pending commands`);
        }
    }, POLL_INTERVAL);
}

poll().catch(console.error);
