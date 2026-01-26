/**
 * GPI Cancel - Stop AI generation mid-stream
 * 
 * Usage: node index.js <cascadeId>
 */

import api from '../api.js';

async function main() {
    const cascadeId = process.argv[2];

    if (!cascadeId) {
        console.log('GPI Cancel - Stop AI generation\n');
        console.log('Usage: node index.js <cascadeId>');
        console.log('\nThis immediately stops the AI from generating a response.');
        console.log('Useful when the AI is going in the wrong direction!');
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
    console.log(`🛑 Canceling generation...\n`);

    const result = await api.cancelCascadeInvocation(port, config.csrfToken, cascadeId);

    if (result.ok) {
        console.log('✅ Generation canceled!');
        console.log('   The AI will stop generating immediately.');
    } else {
        console.error(`❌ Failed: ${result.status}`);
        console.error('   The generation might already be complete.');
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
