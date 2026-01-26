/**
 * GPI Send With URL - Fetch remote file content and send to cascade
 * 
 * Usage:
 *   node index.js <cascadeId> <url>              # Fetch and send with default message
 *   node index.js <cascadeId> <url> "message"    # Fetch and send with custom message
 */

import api from '../api.js';

async function main() {
    const cascadeId = process.argv[2];
    const url = process.argv[3];
    const message = process.argv[4] || null;

    if (!cascadeId || !url) {
        console.log('GPI Send With URL - Fetch and embed remote file content\n');
        console.log('Usage:');
        console.log('  node index.js <cascadeId> <url>              # Default message');
        console.log('  node index.js <cascadeId> <url> "message"    # Custom message');
        console.log('\nExample:');
        console.log('  node index.js abc-123 https://example.com/file.js "Review this"');
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
    console.log(`🌐 URL: ${url}`);
    if (message) console.log(`📝 Message: ${message}`);
    console.log('\n⏳ Fetching remote content...');

    const result = await api.sendMessageWithUrl(port, config.csrfToken, cascadeId, url, message);

    if (result.ok) {
        console.log('✅ Remote file content sent!');
    } else {
        console.log(`❌ Failed: ${result.status}`);
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
