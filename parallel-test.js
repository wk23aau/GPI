/**
 * GPI Parallel Test - Send messages to multiple cascades simultaneously
 * 
 * Creates 3 cascades, sends different messages to each in parallel,
 * then fetches all responses.
 */

import api from './api.js';

async function main() {
    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port || !config?.csrfToken) {
        console.error('❌ Missing port or auth');
        process.exit(1);
    }

    console.log(`🔗 Port: ${port}`);
    console.log('\n━━━━━━ PHASE 1: CREATE 3 CASCADES ━━━━━━\n');

    // Create 3 cascades in parallel
    const cascadePromises = [
        api.startCascade(port, config.csrfToken),
        api.startCascade(port, config.csrfToken),
        api.startCascade(port, config.csrfToken)
    ];

    const cascades = await Promise.all(cascadePromises);
    const ids = cascades.map(c => c.data?.cascadeId).filter(Boolean);

    console.log(`✅ Created ${ids.length} cascades:`);
    ids.forEach((id, i) => console.log(`   ${i + 1}. ${id}`));

    if (ids.length < 3) {
        console.error('❌ Failed to create all cascades');
        process.exit(1);
    }

    console.log('\n━━━━━━ PHASE 2: SEND MESSAGES IN PARALLEL ━━━━━━\n');

    const messages = [
        { id: ids[0], msg: 'What is 5 + 5? Reply with just the number.' },
        { id: ids[1], msg: 'What is the capital of France? Reply with just the city name.' },
        { id: ids[2], msg: 'What color is the sky on a clear day? Reply with just the color.' }
    ];

    // Send all messages in parallel
    const sendPromises = messages.map(m =>
        api.sendMessage(port, config.csrfToken, m.id, m.msg)
    );

    const sendResults = await Promise.all(sendPromises);

    messages.forEach((m, i) => {
        const status = sendResults[i].ok ? '✅' : '❌';
        console.log(`${status} Cascade ${i + 1}: "${m.msg}"`);
    });

    console.log('\n⏳ Waiting 5 seconds for AI responses...\n');
    await new Promise(r => setTimeout(r, 5000));

    console.log('━━━━━━ PHASE 3: FETCH RESPONSES ━━━━━━\n');

    // Fetch all responses in parallel
    const responsePromises = ids.map(id =>
        api.getTrajectory(port, config.csrfToken, id)
    );

    const responses = await Promise.all(responsePromises);

    responses.forEach((r, i) => {
        console.log(`📌 Cascade ${i + 1} (${ids[i].substring(0, 8)}...):`);
        console.log(`   Q: ${messages[i].msg}`);

        if (r.ok && r.data?.trajectory?.steps) {
            for (const step of r.data.trajectory.steps) {
                if (step.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && step.plannerResponse?.response) {
                    console.log(`   A: ${step.plannerResponse.response.substring(0, 100)}`);
                    break;
                }
            }
        } else {
            console.log(`   A: (awaiting response)`);
        }
        console.log('');
    });

    console.log('━━━━━━ DONE ━━━━━━');
}

main().catch(console.error);
