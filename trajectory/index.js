/**
 * GPI Trajectory - View complete conversation trajectory with all details
 * 
 * Endpoint: /exa.language_server_pb.LanguageServerService/GetCascadeTrajectory
 * 
 * Usage:
 *   node index.js <cascadeId>              # Show summary
 *   node index.js <cascadeId> --full       # Show all steps
 *   node index.js <cascadeId> --raw        # Show raw JSON
 *   node index.js <cascadeId> --pending    # Show only pending steps
 */

import api from '../api.js';

// Step type display names
const STEP_TYPES = {
    'CORTEX_STEP_TYPE_USER_INPUT': '👤 USER_INPUT',
    'CORTEX_STEP_TYPE_PLANNER_RESPONSE': '🤖 PLANNER_RESPONSE',
    'CORTEX_STEP_TYPE_RUN_COMMAND': '💻 RUN_COMMAND',
    'CORTEX_STEP_TYPE_CODE_ACTION': '✏️ CODE_ACTION',
    'CORTEX_STEP_TYPE_NOTIFY_USER': '📢 NOTIFY_USER',
    'CORTEX_STEP_TYPE_EPHEMERAL_MESSAGE': '💭 EPHEMERAL',
    'CORTEX_STEP_TYPE_TASK_BOUNDARY': '📋 TASK_BOUNDARY',
    'CORTEX_STEP_TYPE_BROWSER_SCREENSHOT': '📸 SCREENSHOT',
    'CORTEX_STEP_TYPE_BROWSER_SUBAGENT': '🌐 BROWSER',
    'CORTEX_STEP_TYPE_VIEW_FILE': '👁️ VIEW_FILE',
    'CORTEX_STEP_TYPE_COMMAND_STATUS': '⏳ COMMAND_STATUS',
    'CORTEX_STEP_TYPE_SEARCH': '🔍 SEARCH',
    'CORTEX_STEP_TYPE_FILE_WRITE': '💾 FILE_WRITE',
};

// Step status display
const STEP_STATUS = {
    'CORTEX_STEP_STATUS_DONE': '✅',
    'CORTEX_STEP_STATUS_WAITING': '⏳',
    'CORTEX_STEP_STATUS_RUNNING': '🔄',
    'CORTEX_STEP_STATUS_ERROR': '❌',
};

function formatStep(step, index, showFull = false) {
    const type = STEP_TYPES[step.type] || step.type;
    const status = STEP_STATUS[step.status] || step.status;
    const time = step.metadata?.createdAt ? new Date(step.metadata.createdAt).toLocaleTimeString() : '';

    let output = `${status} [${index}] ${type} ${time}`;

    if (showFull) {
        // Show step-specific details
        if (step.userInput?.query) {
            output += `\n      Query: ${step.userInput.query.substring(0, 100)}...`;
        }
        if (step.plannerResponse?.response) {
            output += `\n      Response: ${step.plannerResponse.response.substring(0, 100)}...`;
        }
        if (step.runCommand) {
            output += `\n      Command: ${step.runCommand.command || step.runCommand.commandLine || 'N/A'}`;
            output += `\n      Cwd: ${step.runCommand.cwd || 'N/A'}`;
            if (step.runCommand.exitCode !== undefined) {
                output += `\n      Exit: ${step.runCommand.exitCode}`;
            }
        }
        if (step.codeAction) {
            output += `\n      File: ${step.codeAction.filePath || 'N/A'}`;
            output += `\n      Action: ${step.codeAction.actionType || 'N/A'}`;
        }
        if (step.notifyUser?.message) {
            output += `\n      Message: ${step.notifyUser.message.substring(0, 100)}...`;
        }
        if (step.taskBoundary) {
            output += `\n      Task: ${step.taskBoundary.taskName || 'N/A'}`;
            output += `\n      Mode: ${step.taskBoundary.mode || 'N/A'}`;
        }
        if (step.metadata?.toolCall) {
            output += `\n      Tool: ${step.metadata.toolCall.name}`;
            output += `\n      ID: ${step.metadata.toolCall.id}`;
        }
    }

    return output;
}

async function main() {
    const cascadeId = process.argv[2];
    const showFull = process.argv.includes('--full');
    const showRaw = process.argv.includes('--raw');
    const showPending = process.argv.includes('--pending');

    if (!cascadeId || cascadeId.startsWith('--')) {
        console.log('GPI Trajectory Viewer\n');
        console.log('Usage:');
        console.log('  node index.js <cascadeId>              # Show summary');
        console.log('  node index.js <cascadeId> --full       # Show all step details');
        console.log('  node index.js <cascadeId> --raw        # Show raw JSON');
        console.log('  node index.js <cascadeId> --pending    # Show only pending steps');
        process.exit(1);
    }

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
    console.log(`📍 Cascade: ${cascadeId}\n`);

    const result = await api.getTrajectory(port, config.csrfToken, cascadeId);

    if (!result.ok || !result.data?.trajectory) {
        console.error('❌ Failed to get trajectory');
        console.error(result.data);
        process.exit(1);
    }

    const traj = result.data.trajectory;
    const steps = traj.steps || [];

    // Show raw JSON if requested
    if (showRaw) {
        console.log(JSON.stringify(result.data, null, 2));
        return;
    }

    // Header info
    console.log('═'.repeat(60));
    console.log('TRAJECTORY INFO');
    console.log('═'.repeat(60));
    console.log(`Trajectory ID: ${traj.trajectoryId}`);
    console.log(`Cascade ID:    ${traj.cascadeId}`);
    console.log(`Type:          ${traj.trajectoryType}`);
    console.log(`Total Steps:   ${steps.length}`);
    console.log(`Status:        ${result.data.status}`);
    console.log('');

    // Count step types
    const typeCounts = {};
    const pending = [];
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const shortType = step.type?.replace('CORTEX_STEP_TYPE_', '') || 'UNKNOWN';
        typeCounts[shortType] = (typeCounts[shortType] || 0) + 1;

        if (step.status === 'CORTEX_STEP_STATUS_WAITING') {
            pending.push({ index: i, step });
        }
    }

    console.log('═'.repeat(60));
    console.log('STEP TYPE COUNTS');
    console.log('═'.repeat(60));
    Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
    console.log('');

    // Show pending steps if any
    if (pending.length > 0) {
        console.log('═'.repeat(60));
        console.log(`⏳ PENDING STEPS (${pending.length})`);
        console.log('═'.repeat(60));
        for (const { index, step } of pending) {
            console.log(formatStep(step, index, true));
            console.log('');
        }
    }

    // Show all steps if requested
    if (showFull && !showPending) {
        console.log('═'.repeat(60));
        console.log('ALL STEPS');
        console.log('═'.repeat(60));
        for (let i = 0; i < steps.length; i++) {
            console.log(formatStep(steps[i], i, true));
        }
    } else if (!showPending) {
        // Show last 5 steps
        console.log('═'.repeat(60));
        console.log('RECENT STEPS (last 5)');
        console.log('═'.repeat(60));
        const start = Math.max(0, steps.length - 5);
        for (let i = start; i < steps.length; i++) {
            console.log(formatStep(steps[i], i, true));
        }
    }

    // Footer with useful commands
    console.log('');
    console.log('─'.repeat(60));
    console.log('Commands:');
    if (pending.length > 0) {
        const p = pending[0];
        console.log(`  Accept pending: node ../handleinteraction/index.js accept ${cascadeId} ${traj.trajectoryId} ${p.index} "command"`);
        console.log(`  Reject pending: node ../handleinteraction/index.js reject ${cascadeId} ${traj.trajectoryId} ${p.index}`);
    }
    console.log(`  Send message: node ../sendmessage/index.js ${cascadeId} "message"`);
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
