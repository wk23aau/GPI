/**
 * GPI Handle Interaction - Accept or reject pending commands
 * 
 * Endpoint: /exa.language_server_pb.LanguageServerService/HandleCascadeUserInteraction
 * 
 * Usage:
 *   node index.js accept <cascadeId> <trajectoryId> <stepIndex> "command"
 *   node index.js reject <cascadeId> <trajectoryId> <stepIndex>
 */

import api from '../api.js';

async function main() {
    const action = process.argv[2];
    const cascadeId = process.argv[3];
    const trajectoryId = process.argv[4];
    const stepIndex = parseInt(process.argv[5], 10);
    const command = process.argv[6];

    if (!action || !cascadeId || !trajectoryId || isNaN(stepIndex)) {
        console.log('Usage:');
        console.log('  node index.js accept <cascadeId> <trajectoryId> <stepIndex> "command"');
        console.log('  node index.js reject <cascadeId> <trajectoryId> <stepIndex>');
        console.log('');
        console.log('To find trajectoryId and stepIndex, use getresponse module first.');
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
    console.log(`📍 Cascade: ${cascadeId}`);
    console.log(`📍 Trajectory: ${trajectoryId}`);
    console.log(`📍 Step: ${stepIndex}`);
    console.log(`🎯 Action: ${action.toUpperCase()}`);
    if (command) console.log(`💻 Command: ${command}`);
    console.log('');

    try {
        let result;

        if (action === 'accept') {
            if (!command) {
                console.error('❌ Command text required for accept');
                process.exit(1);
            }
            result = await api.acceptCommand(port, config.csrfToken, cascadeId, trajectoryId, stepIndex, command);
        } else if (action === 'reject') {
            result = await api.rejectCommand(port, config.csrfToken, cascadeId, trajectoryId, stepIndex);
        } else {
            console.error('❌ Invalid action. Use "accept" or "reject"');
            process.exit(1);
        }

        if (result.ok) {
            console.log(`✅ Command ${action}ed!`);
        } else {
            console.log(`❌ Failed: Status ${result.status}`);
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

main().catch(console.error);
