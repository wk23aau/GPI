/**
 * GPI Delete Cascade - Permanently delete a conversation
 * 
 * Usage: node index.js <cascadeId>
 */

import api from '../api.js';
import readline from 'readline';

async function main() {
    const cascadeId = process.argv[2];

    if (!cascadeId) {
        console.log('GPI Delete - Permanently delete a conversation\n');
        console.log('Usage: node index.js <cascadeId>');
        console.log('\n⚠️  WARNING: This action CANNOT be undone!');
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
    console.log('\n⚠️  WARNING: This will PERMANENTLY delete the conversation!');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question('Type "yes" to confirm: ', resolve));
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Cancelled');
        process.exit(0);
    }

    console.log('\n🗑️  Deleting...');
    const result = await api.deleteCascadeTrajectory(port, config.csrfToken, cascadeId);

    if (result.ok) {
        console.log('✅ Conversation deleted permanently!');
    } else {
        console.error(`❌ Failed: ${result.status}`);
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
