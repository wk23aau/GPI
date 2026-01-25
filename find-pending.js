/**
 * Find pending commands in a cascade
 */

import api from './api.js';

async function main() {
    const cascadeId = process.argv[2];

    if (!cascadeId) {
        console.log('Usage: node find-pending.js <cascadeId>');
        process.exit(1);
    }

    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port || !config?.csrfToken) {
        console.error('❌ Missing port or auth');
        process.exit(1);
    }

    console.log(`🔗 Port: ${port}`);
    console.log(`📍 Cascade: ${cascadeId}\n`);

    const result = await api.getTrajectory(port, config.csrfToken, cascadeId);

    if (!result.ok || !result.data?.trajectory) {
        console.log('❌ Failed to get trajectory');
        return;
    }

    const traj = result.data.trajectory;
    const trajId = result.data.trajectoryId || traj.id;

    console.log(`📋 Trajectory ID: ${trajId}`);
    console.log(`📋 Steps: ${traj.steps?.length || 0}\n`);

    // Find run_command steps
    const steps = traj.steps || [];
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.type === 'CORTEX_STEP_TYPE_RUN_COMMAND' ||
            step.type?.includes('RUN_COMMAND') ||
            step.runCommand) {
            console.log(`⚡ Step ${i}: RUN_COMMAND`);
            if (step.runCommand) {
                console.log(`   Command: ${step.runCommand.command || step.runCommand.commandLine}`);
                console.log(`   Status: ${step.runCommand.status || 'pending'}`);
            }
            console.log(`   To accept: node handleinteraction/index.js accept ${cascadeId} ${trajId} ${i} "command"`);
            console.log('');
        }

        // Also check for pending user interaction
        if (step.type === 'CORTEX_STEP_TYPE_NOTIFY_USER' || step.notifyUser) {
            console.log(`📢 Step ${i}: NOTIFY_USER`);
        }
    }

    // Show last few steps
    console.log('─'.repeat(40));
    console.log('Last 3 steps:');
    for (let i = Math.max(0, steps.length - 3); i < steps.length; i++) {
        console.log(`  ${i}: ${steps[i].type}`);
    }
}

main().catch(console.error);
