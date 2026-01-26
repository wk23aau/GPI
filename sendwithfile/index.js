/**
 * GPI Send With File - Send a message with embedded file content
 * 
 * Usage:
 *   node index.js <cascadeId> <filePath>              # Send file with default message
 *   node index.js <cascadeId> <filePath> "message"    # Send file with custom message
 */

import api from '../api.js';

async function main() {
    const cascadeId = process.argv[2];
    const filePath = process.argv[3];
    const message = process.argv[4] || null;

    if (!cascadeId || !filePath) {
        console.log('GPI Send With File - Embed file content in message\n');
        console.log('Usage:');
        console.log('  node index.js <cascadeId> <filePath>              # Default message');
        console.log('  node index.js <cascadeId> <filePath> "message"    # Custom message');
        console.log('\nExample:');
        console.log('  node index.js abc-123 ./README.md "Check this documentation"');
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
    console.log(`📁 File: ${filePath}`);
    if (message) console.log(`📝 Message: ${message}`);
    console.log('');

    const result = await api.sendMessageWithFile(port, config.csrfToken, cascadeId, filePath, message);

    if (result.ok) {
        console.log('✅ File content sent!');
    } else {
        console.log(`❌ Failed: ${result.status}`);
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
