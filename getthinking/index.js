/**
 * GPI Get Thinking - Extract AI thinking from conversation
 * 
 * Usage: node index.js <cascadeId> [--last N]
 */

import api from '../api.js';

async function main() {
    const cascadeId = process.argv[2];
    const lastN = process.argv.includes('--last')
        ? parseInt(process.argv[process.argv.indexOf('--last') + 1]) || 5
        : 5;

    if (!cascadeId) {
        console.log('GPI Get Thinking - Extract AI thinking blocks\n');
        console.log('Usage: node index.js <cascadeId> [--last N]\n');
        console.log('Options:');
        console.log('  --last N   Show last N thinking blocks (default: 5)');
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
    console.log(`📊 Showing last ${lastN} thinking blocks\n`);

    const result = await api.getTrajectory(port, config.csrfToken, cascadeId);

    if (!result.ok) {
        console.error(`❌ Failed: ${result.status}`);
        process.exit(1);
    }

    const steps = result.data?.trajectory?.steps || [];

    // Get steps with thinking
    const thinkingSteps = steps
        .filter(s => s.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && s.plannerResponse?.thinking)
        .slice(-lastN);

    if (thinkingSteps.length === 0) {
        console.log('📭 No thinking blocks found');
        return;
    }

    console.log(`💭 Found ${thinkingSteps.length} thinking block(s):\n`);
    console.log('═'.repeat(70) + '\n');

    for (let i = 0; i < thinkingSteps.length; i++) {
        const step = thinkingSteps[i];
        const pr = step.plannerResponse;
        const thinking = pr.thinking;
        const duration = pr.thinkingDuration || 'unknown';

        console.log(`📌 Block ${i + 1}/${thinkingSteps.length}`);
        console.log(`   ⏱️  Duration: ${duration}`);
        console.log(`   📝 Length: ${thinking.length} chars\n`);
        console.log(thinking.substring(0, 500));
        if (thinking.length > 500) console.log('...\n');
        console.log('\n' + '─'.repeat(70) + '\n');
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
