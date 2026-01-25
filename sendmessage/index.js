/**
 * GPI Send Message
 * 
 * Usage: node send.js <cascadeId> "Your message"
 */

import api from '../api.js';

async function main() {
    const cascadeId = process.argv[2];
    const message = process.argv.slice(3).join(' ');

    if (!cascadeId || !message) {
        console.log('Usage: node send.js <cascadeId> "Your message"');
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
        console.log('   Create .env with: CSRF_TOKEN=your-token-here');
        process.exit(1);
    }

    console.log(`🔗 Port: ${port}`);
    console.log(`📍 Cascade: ${cascadeId}`);
    console.log(`📤 Message: ${message}\n`);

    const result = await api.sendMessage(port, config.csrfToken, cascadeId, message);

    if (result.ok) {
        console.log('✅ Message sent!');
    } else {
        console.error(`❌ Failed: ${result.status}`);
        console.error(result.data);
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
