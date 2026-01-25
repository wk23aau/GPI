/**
 * GPI Get Response - Fetch the AI's reply from a conversation
 * 
 * Endpoint: /exa.language_server_pb.LanguageServerService/GetCascadeTrajectory
 * 
 * Usage: node index.js <cascadeId>
 */

import api from '../api.js';

async function main() {
    const cascadeId = process.argv[2];

    if (!cascadeId) {
        console.log('Usage: node index.js <cascadeId>');
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
    console.log('📥 Fetching response...\n');

    try {
        const result = await api.getTrajectory(port, config.csrfToken, cascadeId);

        if (result.ok && result.data) {
            // Parse the trajectory to find messages
            const trajectory = result.data.trajectory;

            if (trajectory?.steps) {
                console.log(`Found ${trajectory.steps.length} steps:\n`);

                for (const step of trajectory.steps) {
                    if (step.type === 'CORTEX_STEP_TYPE_USER_INPUT' && step.userInput?.query) {
                        console.log('👤 USER:');
                        console.log(`   ${step.userInput.query.substring(0, 200)}`);
                        console.log('');
                    }

                    if (step.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && step.plannerResponse?.response) {
                        console.log('🤖 AI:');
                        console.log(`   ${step.plannerResponse.response.substring(0, 500)}`);
                        console.log('');
                    }
                }
            } else {
                console.log('No conversation history found.');
                console.log('Raw response:');
                console.log(JSON.stringify(result.data, null, 2).substring(0, 1000));
            }
        } else {
            console.log('❌ Failed to get trajectory');
            console.log(result.data);
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

main().catch(console.error);
