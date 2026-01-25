/**
 * GPI Start Cascade - Create a new conversation
 * 
 * Endpoint: /exa.language_server_pb.LanguageServerService/StartCascade
 * 
 * Usage: node index.js
 */

import api from '../api.js';

async function main() {
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
    console.log('🆕 Creating new conversation...\n');

    try {
        const result = await api.startCascade(port, config.csrfToken);

        if (result.ok && result.data?.cascadeId) {
            console.log('✅ New conversation created!\n');
            console.log(`📌 Cascade ID: ${result.data.cascadeId}`);
            console.log(`\nTo send a message to it:`);
            console.log(`  node ../sendmessage/index.js ${result.data.cascadeId} "Hello!"`);
        } else {
            console.log('❌ Failed to create conversation');
            console.log(result.data);
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

main().catch(console.error);
